/**
 * 사용자 코치 코멘트 목록 조회 API
 *
 * GET /api/coach-comments/user/[userId]
 *
 * 특정 사용자의 모든 코치 코멘트를 조회합니다.
 * Auth: Bearer 토큰 필수. route param userId는 신뢰하지 않음. 서버에서 토큰으로 사용자 식별.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const effectiveUserId = await getCurrentUserId(request);
    if (!effectiveUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { userId: paramUserId } = await params;
    if (!paramUserId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (paramUserId !== effectiveUserId) {
      return NextResponse.json(
        { error: '해당 사용자의 코치 코멘트를 조회할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    const { data: comments, error } = await supabase
      .from('coach_comments')
      .select('*')
      .eq('user_id', effectiveUserId)
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
