/**
 * 코치 코멘트 조회 API
 *
 * GET /api/coach-comments/[id]
 *
 * 특정 코치 코멘트를 조회합니다.
 * Auth: Bearer 토큰 필수. id만으로 권한 부여하지 않음. row.user_id가 인증 사용자와 일치해야 함.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const effectiveUserId = await getCurrentUserId(request);
    if (!effectiveUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: '코치 코멘트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    const { data: comment, error } = await supabase
      .from('coach_comments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !comment) {
      return NextResponse.json(
        { error: '코치 코멘트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (comment.user_id !== effectiveUserId) {
      return NextResponse.json(
        { error: '해당 코치 코멘트에 대한 권한이 없습니다.' },
        { status: 403 }
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
