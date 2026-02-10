/**
 * Stripe 세션 확인 API
 * 
 * GET /api/stripe/verify-session?session_id=xxx
 * 
 * Stripe Checkout 세션 ID로 결제 정보 확인
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeServerClient } from '@/lib/stripe';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getStripeErrorMessage } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id가 필요합니다.' }, { status: 400 });
    }

    const stripe = getStripeServerClient();
    const supabase = getServerSupabaseAdmin();

    // Stripe 세션 조회
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 결제 완료 여부 확인
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: '결제가 완료되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 메타데이터에서 정보 추출
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const planTier = session.metadata?.planTier || '';
    const planName = session.metadata?.planName || '';

    if (!userId || !planId) {
      return NextResponse.json(
        { error: '결제 정보가 불완전합니다.' },
        { status: 400 }
      );
    }

    // 플랜 정보 조회
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('Plan lookup error:', planError);
      // 플랜 정보가 없어도 세션 정보로 응답
    }

    // 구독 정보 확인 (구독 모드인 경우)
    let subscriptionId: string | undefined;
    let isSubscription = false;

    if (session.mode === 'subscription' && session.subscription) {
      subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
      isSubscription = true;

      // 구독이 DB에 저장되었는지 확인
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (!subscription) {
        console.warn('Subscription not found in DB, webhook may not have processed yet');
      }
    }

    // 응답 데이터 구성
    const response = {
      sessionId: session.id,
      planName: planName || plan?.name || 'Unknown',
      planTier: planTier || plan?.tier || 'unknown',
      amount: session.amount_total ? session.amount_total / 100 : 0, // 센트를 원으로 변환
      subscriptionId,
      isSubscription,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Stripe session verification error:', error);
    return NextResponse.json(
      {
        error: '세션 확인에 실패했습니다.',
        details: getStripeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
