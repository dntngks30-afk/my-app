/**
 * GET /api/movement-test/get-latest-by-user
 * user_id 기준 최신 attempt 1개 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabase = getServerSupabaseAdmin();

    const { data: attempt, error } = await supabase
      .from('movement_test_attempts')
      .select('id, share_id, scoring_version, main_type, sub_type, confidence, type_scores, imbalance_severity, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('get-latest-by-user error:', error);
      return NextResponse.json(
        { error: '검사 결과 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!attempt) {
      return NextResponse.json({
        success: true,
        result: null,
      });
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
