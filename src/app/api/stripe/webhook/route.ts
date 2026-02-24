/**
 * Stripe Webhook 처리 API
 * 
 * POST /api/stripe/webhook
 * 
 * Stripe에서 발생하는 이벤트를 처리합니다:
 * - checkout.session.completed: 결제 완료 (users.plan_status/plan_tier 활성화)
 * - customer.subscription.created: 구독 생성
 * - customer.subscription.updated: 구독 업데이트
 * - customer.subscription.deleted: 구독 취소
 * - invoice.payment_succeeded: 인보이스 결제 성공
 * - invoice.payment_failed: 인보이스 결제 실패
 * 
 * 멱등성: payment_events 테이블로 event_id 중복 처리 방지
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyWebhookSignature, getStripeServerClient } from '@/lib/stripe';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { recordEventProcessed } from '@/lib/payments/idempotency';
import Stripe from 'stripe';

class WebhookMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookMetadataError';
  }
}

function validateCheckoutMetadata(session: Stripe.Checkout.Session): void {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new WebhookMetadataError('metadata.userId가 없거나 비정상입니다.');
  }
  if (!planId || typeof planId !== 'string') {
    throw new WebhookMetadataError('metadata.planId가 없습니다.');
  }
}

export const runtime = 'nodejs'; // Webhook은 Node.js 런타임 필요

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Stripe signature가 없습니다.' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET 환경 변수가 설정되지 않았습니다.');
    return NextResponse.json(
      { error: 'Webhook 설정 오류' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = verifyWebhookSignature(body, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook 서명 검증 실패' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseAdmin();
  const stripe = getStripeServerClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        try {
          validateCheckoutMetadata(session);
          const isNew = await recordEventProcessed(event.id, session.metadata!.userId);
          if (!isNew) {
            return NextResponse.json({ received: true }); // 이미 처리됨 (멱등)
          }
          await handleCheckoutSessionCompleted(session, supabase, stripe);
        } catch (err) {
          if (err instanceof WebhookMetadataError) {
            return NextResponse.json({ error: err.message }, { status: 400 });
          }
          throw err;
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription, supabase);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, supabase);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice, supabase);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice, supabase);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook 처리 중 오류 발생:', error);
    return NextResponse.json(
      {
        error: 'Webhook 처리 실패',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Checkout 세션 완료 처리 (validateCheckoutMetadata 통과 후 호출)
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getServerSupabaseAdmin>,
  stripe: Stripe
) {
  const userId = session.metadata!.userId;
  const planId = session.metadata!.planId;
  const planTier = session.metadata?.planTier;

  // 1. Payment 기록 업데이트 (paid_at 컬럼 없을 수 있음 → 제외)
  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_subscription_id: session.subscription as string | null,
    })
    .eq('order_id', `stripe_${session.id}`);

  if (paymentError) {
    console.error('Payment update error:', paymentError);
  }

  // 2. 구독 모드인 경우 Subscription 생성/업데이트
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await handleSubscriptionCreated(subscription, supabase);
  } else {
    // 3. 단건 결제: users.plan_status/plan_tier 활성화 (MVP)
    // TODO: 7일권 만료(end_at)는 subscriptions/current_period_end로 다음 PR에서 확장
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    const tier = (planTier && typeof planTier === 'string' ? planTier : plan?.tier) || 'basic';

    await supabase
      .from('users')
      .update({
        plan_tier: tier,
        plan_status: 'active',
      })
      .eq('id', userId);

    if (plan) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        billing_type: plan.billing_type,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        auto_renew: false,
      }).then(({ error: subError }) => {
        if (subError) console.error('Subscription creation error:', subError);
      });
    }
  }
}

/**
 * 구독 생성 처리
 */
async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getServerSupabaseAdmin>
) {
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  if (!userId || !planId) {
    console.error('Subscription metadata missing:', subscription.metadata);
    return;
  }

  // 플랜 정보 조회
  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!plan) {
    console.error('Plan not found:', planId);
    return;
  }

  // Subscription 생성 또는 업데이트
  const subscriptionData = {
    user_id: userId,
    plan_id: planId,
    status: subscription.status === 'active' ? 'active' : 'paused',
    billing_type: plan.billing_type,
    start_date: new Date(subscription.current_period_start * 1000).toISOString(),
    end_date: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    next_billing_date: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    auto_renew: !subscription.cancel_at_period_end,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price.id || null,
    stripe_customer_id: subscription.customer as string,
  };

  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    });

  if (upsertError) {
    console.error('Subscription upsert error:', upsertError);
    return;
  }

  // 사용자 플랜 업데이트
  await supabase
    .from('users')
    .update({
      plan_tier: plan.tier,
      plan_status: 'active',
      stripe_customer_id: subscription.customer as string,
    })
    .eq('id', userId);
}

/**
 * 구독 업데이트 처리
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getServerSupabaseAdmin>
) {
  const stripeSubscriptionId = subscription.id;

  // Subscription 업데이트
  const subscriptionData: any = {
    status:
      subscription.status === 'active'
        ? 'active'
        : subscription.status === 'canceled' ||
          subscription.status === 'unpaid'
        ? 'cancelled'
        : 'paused',
    end_date: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    next_billing_date: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    auto_renew: !subscription.cancel_at_period_end,
    cancelled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSub, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (fetchError || !existingSub) {
    console.error('Subscription not found:', stripeSubscriptionId);
    return;
  }

  // 플랜 변경 확인
  const newPriceId = subscription.items.data[0]?.price.id;
  if (newPriceId) {
    const { data: newPlan } = await supabase
      .from('plans')
      .select('tier')
      .eq('stripe_price_id', newPriceId)
      .single();

    if (newPlan && existingSub.plan_id !== newPlan.tier) {
      // 플랜 변경 시 plan_id 업데이트
      const { data: updatedPlan } = await supabase
        .from('plans')
        .select('id')
        .eq('tier', newPlan.tier)
        .single();

      if (updatedPlan) {
        subscriptionData.plan_id = updatedPlan.id;

        // 사용자 플랜도 업데이트
        await supabase
          .from('users')
          .update({ plan_tier: newPlan.tier })
          .eq('id', existingSub.user_id);
      }
    }
  }

  await supabase
    .from('subscriptions')
    .update(subscriptionData)
    .eq('stripe_subscription_id', stripeSubscriptionId);
}

/**
 * 구독 취소 처리
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getServerSupabaseAdmin>
) {
  const stripeSubscriptionId = subscription.id;

  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (!existingSub) {
    console.error('Subscription not found:', stripeSubscriptionId);
    return;
  }

  // Subscription 상태 업데이트
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      auto_renew: false,
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  // 사용자 플랜 상태 업데이트
  await supabase
    .from('users')
    .update({
      plan_status: 'cancelled',
    })
    .eq('id', existingSub.user_id);
}

/**
 * 인보이스 결제 성공 처리
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getServerSupabaseAdmin>
) {
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) {
    return; // 구독이 아닌 단건 결제는 이미 checkout.session.completed에서 처리됨
  }

  // Payment 기록 생성
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.error('Subscription not found for invoice:', subscriptionId);
    return;
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('price')
    .eq('id', subscription.plan_id)
    .single();

  await supabase.from('payments').insert({
    user_id: subscription.user_id,
    amount: plan?.price || invoice.amount_paid / 100,
    order_id: `stripe_invoice_${invoice.id}`,
    status: 'completed',
    payment_provider: 'stripe',
    stripe_subscription_id: subscriptionId,
    stripe_payment_intent_id: invoice.payment_intent as string,
    paid_at: new Date().toISOString(),
  });
}

/**
 * 인보이스 결제 실패 처리
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getServerSupabaseAdmin>
) {
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) {
    return;
  }

  // Subscription 상태를 'expired'로 업데이트 (선택적)
  await supabase
    .from('subscriptions')
    .update({
      status: 'expired',
    })
    .eq('stripe_subscription_id', subscriptionId);

  // 사용자에게 알림 발송 (선택적)
  // TODO: 알림 시스템 연동
}
