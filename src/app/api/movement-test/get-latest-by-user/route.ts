/**
 * 사용자의 최신 운동 검사 결과 조회 API
 * 
 * GET /api/movement-test/get-latest-by-user
 * 
 * 인증된 사용자의 최신 운동 검사 결과를 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

/**
 * 요청에서 사용자 ID 추출 (Supabase Auth 사용)
 */
async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('User authentication error:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 사용자 인증 확인
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabase = getServerSupabaseAdmin();

    // 사용자의 최신 운동 검사 결과 조회
    const { data: result, error } = await supabase
      .from('movement_test_results')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !result) {
      // 결과가 없으면 null 반환 (에러 아님)
      return NextResponse.json({
        success: true,
        result: null,
      });
    }

    return NextResponse.json({
      success: true,
      result: {
        id: result.id,
        mainType: result.main_type,
        subType: result.sub_type,
        confidence: result.confidence,
        typeScores: result.type_scores,
        imbalanceSeverity: result.imbalance_severity,
        completedAt: result.completed_at,
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
