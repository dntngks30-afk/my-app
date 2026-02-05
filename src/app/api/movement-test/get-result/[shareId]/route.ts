/**
 * Movement Test - 결과 조회 API
 * 
 * GET /api/movement-test/get-result/[shareId]
 * 
 * share_id로 공유된 결과 조회 및 조회수 증가
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    const { shareId } = params;

    if (!shareId) {
      return NextResponse.json(
        { error: '공유 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 결과 조회
    const { data, error } = await supabase
      .from('movement_test_results')
      .select('*')
      .eq('share_id', shareId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: '결과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 조회수 증가
    await supabase
      .from('movement_test_results')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('share_id', shareId);

    // 응답 데이터 정리
    return NextResponse.json({
      success: true,
      result: {
        shareId: data.share_id,
        mainType: data.main_type,
        subType: data.sub_type,
        confidence: data.confidence,
        typeScores: data.type_scores,
        imbalanceYesCount: data.imbalance_yes_count,
        imbalanceSeverity: data.imbalance_severity,
        biasMainType: data.bias_main_type,
        completedAt: data.completed_at,
        viewCount: (data.view_count || 0) + 1
      }
    });

  } catch (error) {
    console.error('Get result error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
