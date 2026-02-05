/**
 * Movement Test - 결과 저장 API
 * 
 * POST /api/movement-test/save-result
 * 
 * 테스트 결과를 DB에 저장하고 공유 가능한 share_id 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      mainType,
      subType,
      confidence,
      typeScores,
      imbalanceYesCount,
      imbalanceSeverity,
      biasMainType,
      completedAt,
      durationSeconds
    } = body;

    // 필수 필드 검증
    if (!mainType || !subType || confidence === undefined || !typeScores) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // DB에 저장
    const { data, error } = await supabase
      .from('movement_test_results')
      .insert({
        main_type: mainType,
        sub_type: subType,
        confidence: confidence,
        type_scores: typeScores,
        imbalance_yes_count: imbalanceYesCount || 0,
        imbalance_severity: imbalanceSeverity || 'none',
        bias_main_type: biasMainType || null,
        completed_at: completedAt || new Date().toISOString(),
        duration_seconds: durationSeconds || null
      })
      .select('id, share_id')
      .single();

    if (error) {
      console.error('Failed to save result:', error);
      return NextResponse.json(
        { error: '결과 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 공유 URL 생성
    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/movement-test/shared/${data.share_id}`;

    return NextResponse.json({
      success: true,
      id: data.id,
      shareId: data.share_id,
      shareUrl
    });

  } catch (error) {
    console.error('Save result error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
