/**
 * 코치 코멘트 생성 API
 * 
 * POST /api/coach-comments/generate
 * 
 * 재검사 결과 비교 데이터를 바탕으로 AI 코치 코멘트를 생성하고 DB에 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { generateCoachComment } from '@/lib/coach-comments/ai-generator';
import { compareTestResults } from '@/lib/movement-test/result-comparison';
import type { TestResultData } from '@/lib/movement-test/result-comparison';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, originalResultId, retestResultId } = body;

    // 필수 필드 검증
    if (!userId || !originalResultId || !retestResultId) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (userId, originalResultId, retestResultId)' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    // 원본 검사 결과 조회
    const { data: originalResult, error: originalError } = await supabase
      .from('movement_test_results')
      .select('*')
      .eq('id', originalResultId)
      .single();

    if (originalError || !originalResult) {
      console.error('원본 검사 결과 조회 실패:', originalError);
      return NextResponse.json(
        { error: '원본 검사 결과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 재검사 결과 조회
    const { data: retestResult, error: retestError } = await supabase
      .from('movement_test_results')
      .select('*')
      .eq('id', retestResultId)
      .single();

    if (retestError || !retestResult) {
      console.error('재검사 결과 조회 실패:', retestError);
      return NextResponse.json(
        { error: '재검사 결과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 결과 데이터 변환
    const originalData: TestResultData = {
      id: originalResult.id,
      main_type: originalResult.main_type,
      sub_type: originalResult.sub_type,
      confidence: originalResult.confidence,
      type_scores: originalResult.type_scores,
      imbalance_severity: originalResult.imbalance_severity || 'none',
      completed_at: originalResult.completed_at,
    };

    const retestData: TestResultData = {
      id: retestResult.id,
      main_type: retestResult.main_type,
      sub_type: retestResult.sub_type,
      confidence: retestResult.confidence,
      type_scores: retestResult.type_scores,
      imbalance_severity: retestResult.imbalance_severity || 'none',
      completed_at: retestResult.completed_at,
    };

    // 비교 분석 수행
    const comparison = compareTestResults(originalData, retestData);

    // AI 코치 코멘트 생성
    console.log('🤖 AI 코치 코멘트 생성 시작...');
    const coachComment = await generateCoachComment(originalData, retestData, comparison);

    // DB에 저장 (coach_comments 테이블)
    const { data: savedComment, error: saveError } = await supabase
      .from('coach_comments')
      .insert({
        user_id: userId,
        original_result_id: originalResultId,
        retest_result_id: retestResultId,
        comment_data: coachComment,
        created_at: new Date().toISOString(),
      })
      .select('id, created_at')
      .single();

    if (saveError) {
      console.error('코치 코멘트 저장 실패:', saveError);
      // 저장 실패해도 생성된 코멘트는 반환
      return NextResponse.json({
        success: true,
        comment: coachComment,
        saved: false,
        error: '코멘트 생성은 성공했으나 저장에 실패했습니다.',
      });
    }

    console.log('✅ 코치 코멘트 생성 및 저장 완료');

    return NextResponse.json({
      success: true,
      comment: coachComment,
      id: savedComment.id,
      createdAt: savedComment.created_at,
    });
  } catch (error) {
    console.error('코치 코멘트 생성 오류:', error);
    return NextResponse.json(
      {
        error: '코치 코멘트 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
