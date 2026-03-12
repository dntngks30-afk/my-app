/**
 * POST /api/session/profile
 *
 * 온보딩: 주당 목표 횟수(target_frequency) 저장 + total_sessions(8/12/16/20) 확정.
 *
 * 동작:
 *   1) auth: userId 확보 (401 fail-close)
 *   2) session_user_profile upsert (target_frequency, lifestyle_tag)
 *   3) total_sessions 매핑: 2→8, 3→12, 4→16, 5→20
 *   4) session_program_progress upsert (total_sessions만 업데이트, completed/active 건드리지 않음)
 *
 * BE-ONB-01: 온보딩 프로필 저장.
 * Auth: Bearer token (session APIs와 동일). Write: service role (RLS bypass).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { fail, ApiErrorCode } from '@/lib/api/contract';
import {
  applyTargetFrequency,
  isValidTargetFrequency,
} from '@/lib/session/profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawFreq = body.target_frequency;
    if (!isValidTargetFrequency(rawFreq)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'target_frequency는 2, 3, 4, 5 중 하나여야 합니다.' } },
        { status: 400 }
      );
    }

    const lifestyleTag = typeof body.lifestyle_tag === 'string'
      ? body.lifestyle_tag.trim() || null
      : null;

    const supabase = getServerSupabaseAdmin();
    const result = await applyTargetFrequency(supabase, userId, rawFreq, {
      lifestyleTag,
    });

    if (!result.ok) {
      if (result.code === 'POLICY_LOCKED') {
        return fail(409, ApiErrorCode.POLICY_LOCKED, result.message);
      }
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: result.message } },
        { status: 500 }
      );
    }

    const { data: existingProgress } = await supabase
      .from('session_program_progress')
      .select('completed_sessions')
      .eq('user_id', userId)
      .maybeSingle();
    const completedSessions = existingProgress?.completed_sessions ?? 0;
    const warning =
      completedSessions > 0
        ? '이미 완료된 세션이 있습니다. total_sessions 변경 시 진행률 해석에 주의하세요.'
        : undefined;

    const { data: profile } = await supabase
      .from('session_user_profile')
      .select()
      .eq('user_id', userId)
      .single();
    const { data: progress } = await supabase
      .from('session_program_progress')
      .select()
      .eq('user_id', userId)
      .single();

    const res = NextResponse.json({
      profile: profile ?? {},
      progress: progress ?? {},
      ...(warning && { warning }),
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[session/profile]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
