/**
 * GET /api/movement-test/get-result/[shareId]
 * share_id로 attempt 조회, 공유용 최소 필드만 반환, 조회수 증가(RPC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;

    if (!shareId) {
      return NextResponse.json({ error: '공유 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getServerSupabaseAdmin();

    // 1) 먼저 attempt 조회(공유용 최소 필드)
    const { data: attempt, error } = await supabase
      .from('movement_test_attempts')
      .select(
        'id, share_id, main_type, sub_type, confidence, type_scores, imbalance_yes_count, imbalance_severity, bias_main_type, completed_at, view_count'
      )
      .eq('share_id', shareId)
      .single();

    if (error || !attempt) {
      return NextResponse.json({ error: '결과를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2) 조회수 증가: 직접 update 금지 → RPC로 +1만 수행
    const { error: rpcError } = await supabase.rpc('increment_attempt_view_count', {
      p_share_id: shareId,
    });

    if (rpcError) {
      // 조회수는 "부가 기능"이라 실패해도 결과 조회는 성공시켜도 됨.
      // 단, 로그는 남겨서 추적 가능하게.
      console.warn('View count RPC failed:', rpcError);
    }

    // 3) 응답 viewCount는 "이전 값 + 1"로 계산해 반환
    // (RPC 성공 여부와 무관하게 UX는 유지. 정확도가 중요하면 재조회 방식으로 바꾸면 됨.)
    const viewCount = (attempt.view_count ?? 0) + 1;

    return NextResponse.json({
      success: true,
      result: {
        shareId: attempt.share_id,
        mainType: attempt.main_type,
        subType: attempt.sub_type,
        confidence: attempt.confidence,
        typeScores: attempt.type_scores,
        imbalanceYesCount: attempt.imbalance_yes_count,
        imbalanceSeverity: attempt.imbalance_severity,
        biasMainType: attempt.bias_main_type,
        completedAt: attempt.completed_at,
        viewCount,
      },
    });
  } catch (error) {
    console.error('Get result error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
