import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';

export async function GET(_req: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (response) return response;

    const { data: attempt, error } = await supabase
      .from('movement_test_attempts')
      .select(
        'id, share_id, scoring_version, main_type, sub_type, confidence, type_scores, imbalance_severity, completed_at'
      )
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('get-latest-by-user error:', error);
      return NextResponse.json({ error: '검사 결과 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!attempt) {
      return NextResponse.json({ success: true, result: null });
    }

    return NextResponse.json({
      success: true,
      result: {
        id: attempt.id,
        shareId: attempt.share_id,
        scoringVersion: attempt.scoring_version,
        mainType: attempt.main_type,
        subType: attempt.sub_type,
        confidence: attempt.confidence,
        typeScores: attempt.type_scores,
        imbalanceSeverity: attempt.imbalance_severity,
        completedAt: attempt.completed_at,
      },
    });
  } catch (error) {
    console.error('최신 검사 결과 조회 오류:', error);
    return NextResponse.json(
      {
        error: '검사 결과 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
