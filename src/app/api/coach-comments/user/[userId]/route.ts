/**
 * 사용자 코치 코멘트 목록 조회 API
 * 
 * GET /api/coach-comments/user/[userId]
 * 
 * 특정 사용자의 모든 코치 코멘트를 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    // 사용자의 모든 코치 코멘트 조회 (최신순)
    const { data: comments, error } = await supabase
      .from('coach_comments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('코치 코멘트 목록 조회 실패:', error);
      return NextResponse.json(
        { error: '코치 코멘트 목록을 조회하는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comments: (comments || []).map((comment) => ({
        id: comment.id,
        userId: comment.user_id,
        originalResultId: comment.original_result_id,
        retestResultId: comment.retest_result_id,
        commentData: comment.comment_data,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      })),
      count: comments?.length || 0,
    });
  } catch (error) {
    console.error('코치 코멘트 목록 조회 오류:', error);
    return NextResponse.json(
      {
        error: '코치 코멘트 목록 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
