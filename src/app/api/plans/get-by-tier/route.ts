/**
 * 플랜 조회 API (티어별)
 * 
 * GET /api/plans/get-by-tier?tier=basic
 * 
 * 티어 이름으로 활성 플랜을 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get('tier');

    if (!tier) {
      return NextResponse.json({ error: 'tier 파라미터가 필요합니다.' }, { status: 400 });
    }

    const supabase = getServerSupabaseAdmin();

    // 활성 플랜 조회
    const { data: plan, error } = await supabase
      .from('plans')
      .select('*')
      .eq('tier', tier)
      .eq('is_active', true)
      .single();

    if (error || !plan) {
      return NextResponse.json(
        { error: '플랜을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        price: plan.price,
        billingType: plan.billing_type,
        billingCycle: plan.billing_cycle,
        features: plan.features,
        limits: plan.limits,
        stripePriceId: plan.stripe_price_id,
      },
    });
  } catch (error) {
    console.error('플랜 조회 오류:', error);
    return NextResponse.json(
      {
        error: '플랜 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
