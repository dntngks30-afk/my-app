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

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import {
  applyTargetFrequency,
  isValidTargetFrequency,
  isValidExerciseExperienceLevel,
  type ExerciseExperienceLevel,
} from '@/lib/session/profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '인증이 필요합니다.');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawFreq = body.target_frequency;
    if (!isValidTargetFrequency(rawFreq)) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'target_frequency는 2, 3, 4, 5 중 하나여야 합니다.');
    }

    /** 본문에 키가 없으면 undefined — applyTargetFrequency에서 해당 컬럼 미변경(다른 호출이 빈도만 바꿀 때 경험·통증 유지) */
    const lifestyleTag: string | null | undefined =
      'lifestyle_tag' in body
        ? typeof body.lifestyle_tag === 'string'
          ? body.lifestyle_tag.trim() || null
          : null
        : undefined;

    let exerciseExperienceLevel: ExerciseExperienceLevel | null | undefined;
    if ('exercise_experience_level' in body) {
      if (isValidExerciseExperienceLevel(body.exercise_experience_level)) {
        exerciseExperienceLevel = body.exercise_experience_level;
      } else {
        return fail(400, ApiErrorCode.VALIDATION_FAILED, 'exercise_experience_level이 올바르지 않습니다.');
      }
    } else {
      exerciseExperienceLevel = undefined;
    }

    let painOrDiscomfortPresent: boolean | null | undefined;
    if ('pain_or_discomfort_present' in body) {
      if (typeof body.pain_or_discomfort_present === 'boolean') {
        painOrDiscomfortPresent = body.pain_or_discomfort_present;
      } else {
        return fail(400, ApiErrorCode.VALIDATION_FAILED, 'pain_or_discomfort_present는 boolean 이어야 합니다.');
      }
    } else {
      painOrDiscomfortPresent = undefined;
    }

    const supabase = getServerSupabaseAdmin();
    const result = await applyTargetFrequency(supabase, userId, rawFreq, {
      ...(lifestyleTag !== undefined ? { lifestyleTag } : {}),
      ...(exerciseExperienceLevel !== undefined ? { exerciseExperienceLevel } : {}),
      ...(painOrDiscomfortPresent !== undefined ? { painOrDiscomfortPresent } : {}),
    });

    if (!result.ok) {
      if (result.code === 'POLICY_LOCKED') {
        return fail(409, ApiErrorCode.POLICY_LOCKED, result.message);
      }
      return fail(500, ApiErrorCode.INTERNAL_ERROR, result.message);
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

    const data = {
      profile: profile ?? {},
      progress: progress ?? {},
      ...(warning && { warning }),
    };
    return ok(data, data);
  } catch (err) {
    console.error('[session/profile]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '서버 오류');
  }
}
