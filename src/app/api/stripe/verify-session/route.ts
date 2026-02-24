/**
 * Stripe 세션 확인 API
 *
 * GET /api/stripe/verify-session?session_id=xxx (또는 sessionId=xxx)
 *
 * Authorization: Bearer <supabase_access_token> 필수
 * 결제 확인 후 plan_status 활성화 (멱등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeServerClient } from '@/lib/stripe';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getStripeErrorMessage } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    // 1. session_id 파싱 (session_id 또는 sessionId)
    const { searchParams } = new URL(req.url);
    const sessionId =
      searchParams.get('session_id') ?? searchParams.get('sessionId') ?? '';

    if (!sessionId || !sessionId.trim()) {
      return NextResponse.json(
        {
          success: false,
          code: 'MISSING_SESSION_ID',
          error: 'session_id is required',
        },
        { status: 400 }
      );
    }

    const sid = sessionId.trim();

    // 2. Authorization header
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Missing Bearer token',
        },
        { status: 401 }
      );
    }

    // 3. 유저 검증
    const supabase = getServerSupabaseAdmin();
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Invalid session',
        },
        { status: 401 }
      );
    }

    const authedUserId = user.id;

    // 4. Stripe 세션 조회
    let session;
    try {
      const stripe = getStripeServerClient();
      session = await stripe.checkout.sessions.retrieve(sid, {
        expand: ['subscription', 'customer'],
      });
    } catch (stripeErr: unknown) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      if (
        typeof msg === 'string' &&
        (msg.includes('No such checkout.session') || msg.includes('No such customer'))
      ) {
        return NextResponse.json(
          {
            success: false,
            code: 'INVALID_SESSION_ID',
            error: 'Invalid or unknown session id',
          },
          { status: 400 }
        );
      }
      console.error('Stripe verify-session error:', stripeErr);
      return NextResponse.json(
        {
          success: false,
          code: 'STRIPE_ERROR',
          error: getStripeErrorMessage(stripeErr),
        },
        { status: 500 }
      );
    }

    // 5. 결제 완료 여부
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          code: 'NOT_PAID',
          error: 'Payment not completed',
        },
        { status: 409 }
      );
    }

    // 6. metadata.userId 검증 및 소유자 확인
    const metaUserId = session.metadata?.userId;
    if (!metaUserId || typeof metaUserId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          code: 'INCOMPLETE_METADATA',
          error: 'Session metadata missing userId',
        },
        { status: 400 }
      );
    }

    if (metaUserId !== authedUserId) {
      return NextResponse.json(
        {
          success: false,
          code: 'FORBIDDEN',
          error: 'Session does not belong to user',
        },
        { status: 403 }
      );
    }

    // 7. plan_status 활성화 (멱등)
    await supabase
      .from('users')
      .update({ plan_status: 'active' })
      .eq('id', authedUserId);

    const productId =
      (typeof session.metadata?.productId === 'string' &&
        session.metadata.productId) ||
      'move-re-7d';

    const amount = session.amount_total ? session.amount_total / 100 : 0;

    return NextResponse.json({
      success: true,
      verified: true,
      userId: authedUserId,
      productId,
      plan_status: 'active',
      sessionId: session.id,
      amount,
      planName: productId === 'move-re-7d' ? '7일 심층 분석' : 'Unknown',
      planTier: 'standard',
      isSubscription: session.mode === 'subscription',
      subscriptionId: session.subscription
        ? typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as { id?: string })?.id
        : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isEnvMissing =
      msg.includes('STRIPE_SECRET_KEY') || msg.includes('환경 변수') || msg.includes('Missing');

    if (isEnvMissing) {
      return NextResponse.json(
        {
          success: false,
          code: 'MISSING_ENV',
          error: 'Stripe configuration is missing',
        },
        { status: 500 }
      );
    }

    console.error('verify-session unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        error: 'Session verification failed',
        details: getStripeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
