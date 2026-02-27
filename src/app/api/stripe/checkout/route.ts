/**
 * Stripe Checkout 세션 생성 API
 *
 * POST /api/stripe/checkout
 *
 * Body (모달 호출 최소):
 * { productId: "move-re-7d", next?: string }
 * 또는 기존 호환:
 * { planId: string, successUrl?: string, cancelUrl?: string }
 *
 * Response: { success, url, sessionId } | { success: false, code, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeServerClient, getOrCreateStripeCustomer, getStripeErrorMessage } from '@/lib/stripe';
import { getServerSupabaseAdmin } from '@/lib/supabase';

function genRequestId(): string {
  return `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 오픈 리다이렉트 방지: 허용 prefix만 success_url next로 사용 */
const ALLOWED_NEXT_PREFIXES = [
  '/app/deep-test',
  '/app/home',
  '/app/deep-test/run',
  '/app/deep-test/result',
  '/app/reports',
] as const;

function isValidNextPath(next: unknown): next is string {
  if (typeof next !== 'string' || next.length === 0) return false;
  if (!next.startsWith('/')) return false;
  if (next.includes('//')) return false;
  return ALLOWED_NEXT_PREFIXES.some((p) => next === p || next.startsWith(`${p}/`));
}

export async function POST(req: NextRequest) {
  const requestId = genRequestId();

  try {
    // 1. Authorization header 파싱
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      console.error(`[${requestId}] code=UNAUTHORIZED Missing Bearer token`);
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', error: 'Missing Bearer token' },
        { status: 401 }
      );
    }

    // 2. 유저 검증 (Supabase Admin)
    const supabaseAdmin = getServerSupabaseAdmin();
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) {
      console.error(`[${requestId}] code=UNAUTHORIZED Invalid session`, authError?.message);
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = authUser.id;
    const userEmail = authUser.email ?? '';

    // 3. Body 파싱
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_BODY', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    const { productId, planId: planIdFromBody, next, successUrl, cancelUrl, consent } = body;
    const productIdStr = typeof productId === 'string' ? productId : '';
    const planIdStr = typeof planIdFromBody === 'string' ? planIdFromBody : '';

    // 3.1 법적 동의 검증 (CS 방어선)
    if (consent !== true) {
      return NextResponse.json(
        { success: false, code: 'CONSENT_REQUIRED', error: '필수 약관 동의가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 4. productId flow (우선) - DB plans 미사용
    if (productIdStr === 'move-re-7d') {
      const priceId = process.env.STRIPE_PRICE_MOVE_RE_7D;
      if (!priceId || typeof priceId !== 'string' || priceId.trim() === '') {
        console.error(`[${requestId}] code=MISSING_ENV STRIPE_PRICE_MOVE_RE_7D is not set`);
        return NextResponse.json(
          {
            success: false,
            code: 'MISSING_ENV',
            error: 'STRIPE_PRICE_MOVE_RE_7D is not set',
          },
          { status: 500 }
        );
      }

      if (!userEmail) {
        return NextResponse.json(
          { success: false, code: 'NO_EMAIL', error: 'User email is required for checkout' },
          { status: 400 }
        );
      }

      try {
        const stripe = getStripeServerClient();
        const customer = await getOrCreateStripeCustomer(
          userId,
          userEmail,
          { plan_tier: 'free' },
          null
        );

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        let successUrlFinal = `${baseUrl}/payments/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
        if (typeof successUrl === 'string' && successUrl) {
          successUrlFinal = successUrl;
        } else if (isValidNextPath(next)) {
          successUrlFinal = `${baseUrl}/payments/stripe-success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(next)}`;
        }
        const defaultCancelUrl = `${baseUrl}/pricing`;

        const session = await stripe.checkout.sessions.create({
          customer: customer.id,
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [{ price: priceId.trim(), quantity: 1 }],
          success_url: successUrlFinal,
          cancel_url: (typeof cancelUrl === 'string' ? cancelUrl : null) || defaultCancelUrl,
          metadata: { userId, productId: 'move-re-7d' },
          customer_email: userEmail,
          allow_promotion_codes: true,
        });

        return NextResponse.json({
          success: true,
          url: session.url,
          sessionId: session.id,
        });
      } catch (stripeErr) {
        const safeMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        console.error(`[${requestId}] code=STRIPE_ERROR`, safeMsg);
        return NextResponse.json(
          {
            success: false,
            code: 'STRIPE_ERROR',
            error: getStripeErrorMessage(stripeErr),
          },
          { status: 500 }
        );
      }
    }

    // 5. Unknown productId
    if (productIdStr) {
      console.error(`[${requestId}] code=UNKNOWN_PRODUCT productId=${productIdStr}`);
      return NextResponse.json(
        {
          success: false,
          code: 'UNKNOWN_PRODUCT',
          error: `Unknown productId: ${productIdStr}`,
        },
        { status: 404 }
      );
    }

    // 6. Legacy planId flow
    if (!planIdStr) {
      return NextResponse.json(
        { success: false, code: 'MISSING_PARAMS', error: 'productId or planId is required' },
        { status: 400 }
      );
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planIdStr)
      .single();

    if (planError || !plan) {
      console.error(`[${requestId}] code=LEGACY_PLAN_FLOW_FAILED planId=${planIdStr}`, planError?.message);
      return NextResponse.json(
        {
          success: false,
          code: 'LEGACY_PLAN_FLOW_FAILED',
          error: 'Plan lookup failed',
        },
        { status: 500 }
      );
    }

    // Legacy: users 테이블 조회 (email, stripe_customer_id)
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, plan_tier, plan_status, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !dbUser) {
      console.error(`[${requestId}] code=USER_RECORD_MISSING users table lookup failed`, userError?.message);
      return NextResponse.json(
        {
          success: false,
          code: 'USER_RECORD_MISSING',
          error: 'User record not found in database',
        },
        { status: 500 }
      );
    }

    const email = dbUser.email ?? userEmail;
    if (!email) {
      return NextResponse.json(
        { success: false, code: 'NO_EMAIL', error: 'User email is required' },
        { status: 400 }
      );
    }

    if (!plan.is_active || !plan.stripe_price_id) {
      return NextResponse.json(
        {
          success: false,
          code: 'PLAN_INVALID',
          error: plan.stripe_price_id ? 'Plan is inactive' : 'Plan not linked to Stripe',
        },
        { status: 400 }
      );
    }

    try {
      const stripe = getStripeServerClient();
      const customer = await getOrCreateStripeCustomer(
        userId,
        email,
        { plan_tier: dbUser.plan_tier || 'free' },
        dbUser.stripe_customer_id
      );

      if (!dbUser.stripe_customer_id && customer.id) {
        await supabaseAdmin
          .from('users')
          .update({ stripe_customer_id: customer.id })
          .eq('id', userId);
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const defaultSuccessUrl = `${baseUrl}/payments/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
      const defaultCancelUrl = `${baseUrl}/pricing`;

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        mode: plan.billing_type === 'subscription' ? 'subscription' : 'payment',
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        success_url: (typeof successUrl === 'string' ? successUrl : null) || defaultSuccessUrl,
        cancel_url: (typeof cancelUrl === 'string' ? cancelUrl : null) || defaultCancelUrl,
        metadata: { userId, productId: 'move-re-7d', planId: plan.id, planTier: plan.tier, planName: plan.name },
        customer_email: email,
        allow_promotion_codes: true,
        ...(plan.billing_type === 'subscription'
          ? {
              subscription_data: { metadata: { userId, productId: 'move-re-7d', planId: plan.id, planTier: plan.tier } },
            }
          : {}),
      });

      await supabaseAdmin.from('payments').insert({
        user_id: userId,
        amount: plan.price,
        order_id: `stripe_${session.id}`,
        status: 'pending',
        payment_provider: 'stripe',
        stripe_payment_intent_id: session.payment_intent as string | null,
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        url: session.url,
        sessionId: session.id,
        plan: { id: plan.id, name: plan.name, tier: plan.tier, price: plan.price, billingType: plan.billing_type },
      });
    } catch (stripeErr) {
      const safeMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      console.error(`[${requestId}] code=STRIPE_ERROR`, safeMsg);
      return NextResponse.json(
        {
          success: false,
          code: 'STRIPE_ERROR',
          error: getStripeErrorMessage(stripeErr),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Unexpected error`, msg);
    const isConfigMissing = msg.includes('STRIPE_SECRET_KEY') || msg.includes('환경 변수') || msg.includes('Missing');
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        error: isConfigMissing ? 'Stripe configuration is missing' : 'Checkout failed',
        details: getStripeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
