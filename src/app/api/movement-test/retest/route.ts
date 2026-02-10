import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(_req: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (response) return response;

    const userId = user.id;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('plan_tier, plan_status')
      .eq('id', userId)
      .single();

    if (userErr) {
      console.error('retest: users fetch error:', userErr);
      return NextResponse.json({ error: '구독 상태 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!userRow) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (userRow.plan_tier === 'free' || userRow.plan_status !== 'active') {
      return NextResponse.json(
        { canRetest: false, reason: '유료 플랜 사용자만 재검사를 받을 수 있습니다.' },
        { status: 200 }
      );
    }

    const { data: lastTest, error: lastErr } = await supabase
      .from('movement_test_attempts')
      .select('id, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error('retest: last attempt fetch error:', lastErr);
      return NextResponse.json({ error: '이전 검사 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!lastTest) {
      return NextResponse.json({ canRetest: false, reason: '이전 검사 결과가 없습니다.' }, { status: 200 });
    }

    const lastTestDate = new Date(lastTest.completed_at);
    const daysSinceLastTest = daysBetween(new Date(), lastTestDate);

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

export async function POST(_req: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (response) return response;

    const userId = user.id;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('plan_tier, plan_status')
      .eq('id', userId)
      .single();

    if (userErr) {
      console.error('retest: users fetch error:', userErr);
      return NextResponse.json({ error: '구독 상태 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!userRow || userRow.plan_tier === 'free' || userRow.plan_status !== 'active') {
      return NextResponse.json({ error: '유료 플랜 사용자만 재검사를 받을 수 있습니다.' }, { status: 403 });
    }

    const { data: lastTest, error: lastErr } = await supabase
      .from('movement_test_attempts')
      .select('id, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error('retest: last attempt fetch error:', lastErr);
      return NextResponse.json({ error: '이전 검사 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!lastTest) {
      return NextResponse.json({ error: '이전 검사 결과가 없습니다.' }, { status: 400 });
    }

    const lastTestDate = new Date(lastTest.completed_at);
    const daysSinceLastTest = daysBetween(new Date(), lastTestDate);

    if (daysSinceLastTest < 7) {
      return NextResponse.json(
        { error: '재검사는 마지막 검사일로부터 7일 후에 가능합니다.', daysRemaining: 7 - daysSinceLastTest },
        { status: 400 }
      );
    }

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
