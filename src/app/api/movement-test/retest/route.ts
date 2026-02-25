/**
 * 재검사 권한 확인 및 시작 API
 * 
 * GET /api/movement-test/retest - 재검사 가능 여부 확인
 * POST /api/movement-test/retest - 재검사 시작
 * SSOT: plan_status='active'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';

/**
 * 재검사 가능 여부 확인 (GET)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) {
      if (auth.status === 401) return auth;
      return NextResponse.json(
        { canRetest: false, reason: '유료 플랜 사용자만 재검사를 받을 수 있습니다.' },
        { status: 200 }
      );
    }
    const userId = auth.userId;
    const supabase = getServerSupabaseAdmin();

    // 1. 마지막 검사(attempt) 조회
    const { data: lastTest } = await supabase
      .from('movement_test_attempts')
      .select('id, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastTest) {
      return NextResponse.json(
        { canRetest: false, reason: '이전 검사 결과가 없습니다.' },
        { status: 200 }
      );
    }

    // 2. 마지막 검사일로부터 7일 경과 확인
    const lastTestDate = new Date(lastTest.completed_at);
    const daysSinceLastTest = Math.floor(
      (new Date().getTime() - lastTestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastTest < 7) {
      const daysRemaining = 7 - daysSinceLastTest;
      return NextResponse.json(
        {
          canRetest: false,
          reason: `재검사는 마지막 검사일로부터 7일 후에 가능합니다. (${daysRemaining}일 남음)`,
          daysRemaining,
          lastTestDate: lastTest.completed_at,
        },
        { status: 200 }
      );
    }

    // 3. 재검사 가능
    return NextResponse.json({
      canRetest: true,
      lastTestId: lastTest.id,
      lastTestDate: lastTest.completed_at,
      daysSinceLastTest,
    });
  } catch (error) {
    console.error('재검사 확인 오류:', error);
    return NextResponse.json(
      {
        error: '재검사 확인에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 재검사 시작 (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;
    const supabase = getServerSupabaseAdmin();

    // 1. 마지막 검사 조회
    const { data: lastTest } = await supabase
      .from('movement_test_attempts')
      .select('id, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastTest) {
      return NextResponse.json(
        { error: '이전 검사 결과가 없습니다.' },
        { status: 400 }
      );
    }

    const lastTestDate = new Date(lastTest.completed_at);
    const daysSinceLastTest = Math.floor(
      (new Date().getTime() - lastTestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastTest < 7) {
      return NextResponse.json(
        {
          error: '재검사는 마지막 검사일로부터 7일 후에 가능합니다.',
          daysRemaining: 7 - daysSinceLastTest,
        },
        { status: 400 }
      );
    }

    // 2. 재검사 세션 생성 (클라이언트에서 설문 시작 시 사용할 정보)
    // 실제 검사 결과는 설문 완료 시 저장되므로, 여기서는 재검사 가능 여부만 반환
    return NextResponse.json({
      success: true,
      canStart: true,
      originalTestId: lastTest.id,
      originalTestDate: lastTest.completed_at,
      message: '재검사를 시작할 수 있습니다.',
    });
  } catch (error) {
    console.error('재검사 시작 오류:', error);
    return NextResponse.json(
      {
        error: '재검사 시작에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
