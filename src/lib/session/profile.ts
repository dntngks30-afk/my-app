/**
 * target_frequency → total_sessions 매핑 및 DB 적용
 * SSOT: session_user_profile + session_program_progress
 *
 * session/profile API와 deep-test finalize에서 공유.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const FREQUENCY_TO_TOTAL: Record<number, number> = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

export const VALID_FREQUENCIES = [2, 3, 4, 5] as const;
export type TargetFrequency = (typeof VALID_FREQUENCIES)[number];

/** FLOW-04: 운동 경험 수준 */
export const VALID_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExerciseExperienceLevel = (typeof VALID_EXPERIENCE_LEVELS)[number];

export function isValidExerciseExperienceLevel(v: unknown): v is ExerciseExperienceLevel {
  return typeof v === 'string' && VALID_EXPERIENCE_LEVELS.includes(v as ExerciseExperienceLevel);
}

export function isValidTargetFrequency(
  v: unknown
): v is TargetFrequency {
  return typeof v === 'number' && VALID_FREQUENCIES.includes(v as TargetFrequency);
}

/** Policy lock: true if total_sessions would be reduced below completed_sessions. */
export function wouldPolicyLock(
  existingCompletedSessions: number,
  targetFrequency: TargetFrequency
): boolean {
  return FREQUENCY_TO_TOTAL[targetFrequency] < existingCompletedSessions;
}

export type ApplyTargetFrequencyResult =
  | { ok: true; totalSessions: number }
  | { ok: false; code: 'VALIDATION' | 'POLICY_LOCKED' | 'DB_ERROR'; message: string };

/**
 * target_frequency를 session_user_profile + session_program_progress에 적용.
 * profile API와 동일한 로직. 실패 시 ok:false 반환.
 */
export type OnboardingProfileOptions = {
  lifestyleTag?: string | null;
  /** FLOW-04: 운동 경험 수준 */
  exerciseExperienceLevel?: ExerciseExperienceLevel | null;
  /** FLOW-04: 통증/불편감 유무 */
  painOrDiscomfortPresent?: boolean | null;
};

export async function applyTargetFrequency(
  supabase: SupabaseClient,
  userId: string,
  targetFrequency: TargetFrequency,
  options?: OnboardingProfileOptions
): Promise<ApplyTargetFrequencyResult> {
  const totalSessions = FREQUENCY_TO_TOTAL[targetFrequency];

  const { data: existingProgress } = await supabase
    .from('session_program_progress')
    .select('completed_sessions, active_session_number')
    .eq('user_id', userId)
    .maybeSingle();

  const completedSessions = existingProgress?.completed_sessions ?? 0;
  if (wouldPolicyLock(completedSessions, targetFrequency)) {
    return {
      ok: false,
      code: 'POLICY_LOCKED',
      message: `이미 ${completedSessions}회 완료되어 total_sessions를 ${totalSessions}로 줄일 수 없습니다.`,
    };
  }

  const upsertPayload: Record<string, unknown> = {
    user_id: userId,
    target_frequency: targetFrequency,
  };
  // PR-ONBOARDING-MIN-06: 키가 없으면 컬럼을 건드리지 않음(빈도만 저장하는 호출이 경험·통증을 지우지 않게)
  if (options?.lifestyleTag !== undefined) {
    upsertPayload.lifestyle_tag = options.lifestyleTag;
  }
  if (options?.exerciseExperienceLevel !== undefined) {
    upsertPayload.exercise_experience_level = options.exerciseExperienceLevel;
  }
  if (options?.painOrDiscomfortPresent !== undefined) {
    upsertPayload.pain_or_discomfort_present = options.painOrDiscomfortPresent;
  }

  const { data: profile, error: profileErr } = await supabase
    .from('session_user_profile')
    .upsert(upsertPayload, { onConflict: 'user_id' })
    .select()
    .single();

  if (profileErr || !profile) {
    console.error('[session/profile] profile upsert failed', profileErr);
    return {
      ok: false,
      code: 'DB_ERROR',
      message: '프로필 저장에 실패했습니다.',
    };
  }

  if (existingProgress) {
    const { error: progressErr } = await supabase
      .from('session_program_progress')
      .update({ total_sessions: totalSessions })
      .eq('user_id', userId);

    if (progressErr) {
      console.error('[session/profile] progress update failed', progressErr);
      return {
        ok: false,
        code: 'DB_ERROR',
        message: '진행 상태 업데이트에 실패했습니다.',
      };
    }
  } else {
    const { error: insertErr } = await supabase
      .from('session_program_progress')
      .insert({
        user_id: userId,
        total_sessions: totalSessions,
        completed_sessions: 0,
        active_session_number: null,
      });

    if (insertErr) {
      console.error('[session/profile] progress insert failed', insertErr);
      return {
        ok: false,
        code: 'DB_ERROR',
        message: '진행 상태 초기화에 실패했습니다.',
      };
    }
  }

  return { ok: true, totalSessions };
}

export type RailReadyResult = {
  ready: boolean;
  reason?: string;
  profile?: { target_frequency?: number };
  progress?: { total_sessions?: number };
};

/** PR-P0-2: Rail-ready check. total_sessions must match FREQUENCY_TO_TOTAL[target_frequency]. */
export async function checkRailReady(
  supabase: SupabaseClient,
  userId: string
): Promise<RailReadyResult> {
  const [profileRes, progressRes] = await Promise.all([
    supabase
      .from('session_user_profile')
      .select('target_frequency')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('session_program_progress')
      .select('total_sessions')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const profile = profileRes.data as { target_frequency?: number } | null;
  const progress = progressRes.data as { total_sessions?: number } | null;
  const freq = profile?.target_frequency;
  const total = progress?.total_sessions;
  if (typeof freq !== 'number' || !(freq in FREQUENCY_TO_TOTAL)) {
    return { ready: false, reason: 'profile_target_frequency_missing', profile: profile ?? undefined, progress: progress ?? undefined };
  }
  const expected = FREQUENCY_TO_TOTAL[freq];
  if (typeof total !== 'number') {
    return { ready: false, reason: 'progress_total_sessions_missing', profile: profile ?? undefined, progress: progress ?? undefined };
  }
  if (total !== expected) {
    return { ready: false, reason: 'total_sessions_mismatch', profile: profile ?? undefined, progress: progress ?? undefined };
  }
  return { ready: true, profile: profile ?? undefined, progress: progress ?? undefined };
}
