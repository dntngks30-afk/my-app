/**
 * 코치 코멘트 조회 API
 * 
 * GET /api/coach-comments/[id]
 * 
 * 특정 코치 코멘트를 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '코치 코멘트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    // 코치 코멘트 조회
    const { data: comment, error } = await supabase
      .from('coach_comments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !comment) {
      console.error('코치 코멘트 조회 실패:', error);
      return NextResponse.json(
        { error: '코치 코멘트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        userId: comment.user_id,
        originalResultId: comment.original_result_id,
        retestResultId: comment.retest_result_id,
        commentData: comment.comment_data,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      },
    });
  } catch (error) {
    console.error('코치 코멘트 조회 오류:', error);
    return NextResponse.json(
      {
        error: '코치 코멘트 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
