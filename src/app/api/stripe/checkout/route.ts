/**
 * Stripe Checkout 세션 생성 API
 *
 * POST /api/stripe/checkout
 *
 * Body (모달 호출 최소):
 * {
 *   productId: "move-re-7d",
 *   next?: string           // 결제 완료 후 돌아갈 경로 (기본 /app)
 * }
 * 또는 기존 호환:
 * {
 *   planId: string,
 *   successUrl?: string,
 *   cancelUrl?: string
 * }
 *
 * Response: { success, url, sessionId, ... }
 * - url: Stripe Checkout 리다이렉트 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeServerClient, getOrCreateStripeCustomer } from '@/lib/stripe';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getStripeErrorMessage } from '@/lib/stripe';

/**
 * 요청에서 사용자 ID 추출 (Supabase Auth 사용)
 * TODO: 실제 인증 미들웨어로 교체 필요
 */
async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('User authentication error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. 사용자 인증 확인
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 2. 요청 본문 파싱 (productId 또는 planId)
    const body = await req.json();
    const { productId, planId: planIdFromBody, next, successUrl, cancelUrl } = body;

    // 3. Supabase 클라이언트 생성
    const supabase = getServerSupabaseAdmin();

    let plan: { id: string; name: string; tier: string; price: number; billing_type: string; stripe_price_id: string | null; is_active: boolean } | null = null;

    if (planIdFromBody) {
      // 기존 호환: planId 직접 전달
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planIdFromBody)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: '플랜을 찾을 수 없습니다.' }, { status: 404 });
      }
      plan = data;
    } else if (productId) {
      // productId → env Price ID 매핑 (DB plans 미사용)
      if (productId !== 'move-re-7d') {
        return NextResponse.json(
          { error: '지원하지 않는 상품입니다.' },
          { status: 400 }
        );
      }
      const priceId = process.env.STRIPE_PRICE_MOVE_RE_7D;
      if (!priceId || typeof priceId !== 'string' || priceId.trim() === '') {
        console.error('STRIPE_PRICE_MOVE_RE_7D 환경 변수가 설정되지 않았습니다.');
        return NextResponse.json(
          { error: '결제 설정이 누락되었습니다. 관리자에게 문의하세요.' },
          { status: 500 }
        );
      }
      plan = {
        id: 'move-re-7d',
        name: '7일 심층 분석',
        tier: 'standard',
        price: 19900,
        billing_type: 'one_time',
        stripe_price_id: priceId.trim(),
        is_active: true,
      };
    } else {
      return NextResponse.json(
        { error: 'productId 또는 planId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!plan) {
      return NextResponse.json({ error: '플랜을 찾을 수 없습니다.' }, { status: 500 });
    }

    // 4. 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, plan_tier, plan_status, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!plan.is_active) {
      return NextResponse.json(
        { error: '비활성화된 플랜입니다.' },
        { status: 400 }
      );
    }

    // 6. Stripe Price ID 확인
    if (!plan.stripe_price_id) {
      return NextResponse.json(
        {
          error:
            '이 플랜은 Stripe와 연동되지 않았습니다. 관리자에게 문의하세요.',
        },
        { status: 400 }
      );
    }

    // 7. Stripe Customer 생성 또는 조회
    if (!user.email) {
      return NextResponse.json(
        { error: '이메일이 등록되지 않은 사용자입니다.' },
        { status: 400 }
      );
    }

    const stripe = getStripeServerClient();
    const customer = await getOrCreateStripeCustomer(
      userId,
      user.email,
      {
        plan_tier: user.plan_tier || 'free',
      },
      user.stripe_customer_id
    );

    // 8. Stripe Customer ID를 users 테이블에 저장 (없는 경우)
    if (!user.stripe_customer_id && customer.id) {
      await supabase
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId);
    }

    // 9. 기본 URL 설정 (Stripe 결제 → stripe-success)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const defaultSuccessUrl = `${baseUrl}/payments/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/pricing`;

    // 10. Stripe Checkout 세션 생성
    const sessionParams: any = {
      customer: customer.id,
      payment_method_types: ['card'],
      mode: plan.billing_type === 'subscription' ? 'subscription' : 'payment',
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      metadata: {
        userId,
        productId: 'move-re-7d',
        planId: plan.id,
        planTier: plan.tier,
        planName: plan.name,
      },
      customer_email: user.email,
      allow_promotion_codes: true,
    };

    // 구독 모드인 경우 subscription_data 추가
    if (plan.billing_type === 'subscription') {
      sessionParams.subscription_data = {
        metadata: {
          userId,
          productId: 'move-re-7d',
          planId: plan.id,
          planTier: plan.tier,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // 11. payments 테이블에 결제 기록 생성 (pending 상태)
    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: userId,
      amount: plan.price,
      order_id: `stripe_${session.id}`,
      status: 'pending',
      payment_provider: 'stripe',
      stripe_payment_intent_id: session.payment_intent as string | null,
      created_at: new Date().toISOString(),
    });

    if (paymentError) {
      console.error('Payment record creation error:', paymentError);
      // 결제 세션은 생성되었으므로 에러를 반환하지 않고 계속 진행
    }

    // 12. 응답 반환
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      plan: {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        price: plan.price,
        billingType: plan.billing_type,
      },
    });
  } catch (error) {
    console.error('Stripe Checkout creation error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const isConfigMissing = msg.includes('STRIPE_SECRET_KEY') || msg.includes('환경 변수');
    return NextResponse.json(
      {
        error: isConfigMissing ? 'Stripe 구성이 누락되었습니다. 관리자에게 문의하세요.' : '결제 세션 생성에 실패했습니다.',
        details: getStripeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
