/**
 * Stripe 세션 확인 API — 완전 멱등
 *
 * GET /api/stripe/verify-session?session_id=xxx (또는 sessionId=xxx)
 * Authorization: Bearer <supabase_access_token> 필수
 *
 * - Stripe session 검증
 * - Bearer 토큰 기반 사용자 확정
 * - metadata.userId 일치 검증 (세션 탈취 방지)
 * - payments 테이블에 결제 이력 기록 (provider_session_id unique)
 * - users.plan_status = 'active' 멱등 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeServerClient, getStripeErrorMessage } from '@/lib/stripe';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // STEP 1 — Normalize session id
    const { searchParams } = new URL(req.url);
    const sessionId =
      searchParams.get('session_id') ?? searchParams.get('sessionId') ?? '';

    if (!sessionId || !sessionId.trim()) {
      return NextResponse.json(
        { error: 'MISSING_SESSION_ID' },
        { status: 400 }
      );
    }

    const sid = sessionId.trim();

    // STEP 2 — Require Authorization header
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // STEP 3 — Resolve authenticated user using Supabase service role
    const supabase = getServerSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // STEP 4 — Retrieve Stripe checkout session
    let session;
    try {
      const stripe = getStripeServerClient();
      session = await stripe.checkout.sessions.retrieve(sid, {
        expand: ['subscription', 'customer'],
      });
    } catch (stripeErr: unknown) {
      return NextResponse.json(
        { error: 'INVALID_SESSION_ID' },
        { status: 400 }
      );
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'NOT_PAID' }, { status: 409 });
    }

    // STEP 5 — Ownership validation
    const metaUserId = session.metadata?.userId;
    if (!metaUserId || typeof metaUserId !== 'string') {
      return NextResponse.json(
        { error: 'MISSING_METADATA_USER' },
        { status: 500 }
      );
    }

    if (metaUserId !== user.id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const productId =
      typeof session.metadata?.productId === 'string'
        ? session.metadata.productId
        : 'move-re-7d';

    // STEP 6 — Idempotent payment record insert
    await supabase.from('payments').upsert(
      {
        user_id: user.id,
        provider: 'stripe',
        provider_session_id: session.id,
        product_id: productId,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'krw',
        status: 'paid',
      },
      { onConflict: 'provider_session_id', ignoreDuplicates: true }
    );

    // STEP 7 — Idempotent activation logic
    const { data: dbUser } = await supabase
      .from('users')
      .select('plan_status')
      .eq('id', user.id)
      .single();

    const planName =
      productId === 'move-re-7d' ? '7일 심층 분석' : 'Unknown';
    const planTier = 'standard';
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const isSubscription = session.mode === 'subscription';
    const subscriptionId = session.subscription
      ? typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as { id?: string })?.id
      : undefined;

    if (dbUser?.plan_status === 'active') {
      return NextResponse.json({
        verified: true,
        idempotent: true,
        sessionId: session.id,
        productId,
        planName,
        planTier,
        amount,
        isSubscription,
        subscriptionId,
      });
    }

    await supabase
      .from('users')
      .update({ plan_status: 'active' })
      .eq('id', user.id);

    return NextResponse.json({
      verified: true,
      sessionId: session.id,
      productId,
      planName,
      planTier,
      amount,
      isSubscription,
      subscriptionId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isEnvMissing =
      msg.includes('STRIPE_SECRET_KEY') ||
      msg.includes('환경 변수') ||
      msg.includes('Missing') ||
      msg.includes('SUPABASE_SERVICE_ROLE_KEY');

    if (isEnvMissing) {
      return NextResponse.json(
        { error: 'MISSING_ENV' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'SERVER_ERROR', details: getStripeErrorMessage(error) },
      { status: 500 }
    );
  }
}
