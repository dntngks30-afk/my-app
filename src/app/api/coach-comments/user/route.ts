/**
 * 사용자 코치 코멘트 목록 조회 API
 *
 * GET /api/coach-comments/user
 *
 * PR3: 서버가 세션으로 user_id 확정. userId 파라미터 제거.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';

export async function GET(_request: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (response) return response; // 401

    const { data: comments, error } = await supabase
      .from('coach_comments')
      .select('*')
      .eq('user_id', user.id)
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
      comments: (comments || []).map((comment: any) => ({
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
