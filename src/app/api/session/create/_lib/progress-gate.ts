import { getKstDayKeyUTC, getNextKstMidnightUtcIso, getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import { logSessionEvent } from '@/lib/session-events';
import { isValidExerciseExperienceLevel } from '@/lib/session/profile';
import type {
  ProgressGateResult,
  RequestGateContinue,
  ResolvedTotalSessions,
  SessionCreatePlanRow,
  SessionCreateProgressRow,
} from './types';

const DEFAULT_TOTAL_SESSIONS = 16;
const FREQUENCY_TO_TOTAL: Record<number, number> = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

async function resolveTotalSessions(
  supabase: RequestGateContinue['supabase'],
  userId: string
): Promise<ResolvedTotalSessions> {
  const { data } = await supabase
    .from('session_user_profile')
    .select('target_frequency, exercise_experience_level')
    .eq('user_id', userId)
    .maybeSingle();

  const freq = data?.target_frequency;
  if (typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL) {
    return {
      totalSessions: FREQUENCY_TO_TOTAL[freq],
      source: 'profile',
      profile: data,
    };
  }

  return {
    totalSessions: DEFAULT_TOTAL_SESSIONS,
    source: 'default',
    profile: data,
  };
}

function isEmptyDraftPlan(existingPlan: SessionCreatePlanRow | null): boolean {
  const pj = existingPlan?.plan_json as { segments?: unknown[] } | null | undefined;
  return (
    existingPlan?.status === 'draft' &&
    (!Array.isArray(pj?.segments) || (pj?.segments as unknown[]).length === 0)
  );
}

type ProfileGenerationSnapshot = {
  exercise_experience_level?: unknown;
};

function readProfileGenerationSnapshot(planJson: unknown): ProfileGenerationSnapshot | null {
  const pj = planJson as { meta?: { profile_generation_snapshot?: unknown } } | null | undefined;
  const raw = pj?.meta?.profile_generation_snapshot;
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as ProfileGenerationSnapshot;
}

function normalizedExerciseExperienceLevel(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (isValidExerciseExperienceLevel(value)) return value;
  return null;
}

/** True only when a persisted snapshot exists and reliably differs from current profile truth. */
function isMaterialExerciseExperienceMismatch(
  currentLevel: unknown,
  snapshotWrap: ProfileGenerationSnapshot | null
): boolean {
  if (!snapshotWrap) return false;
  if (!Object.prototype.hasOwnProperty.call(snapshotWrap, 'exercise_experience_level')) {
    return false;
  }
  const rawSnap = snapshotWrap.exercise_experience_level;
  const snapNorm = normalizedExerciseExperienceLevel(rawSnap);
  if (rawSnap != null && rawSnap !== '' && snapNorm === null) {
    return false;
  }
  const curNorm = normalizedExerciseExperienceLevel(currentLevel);
  return snapNorm !== curNorm;
}

function isSafeSession1ProfileMismatchRegen(plan: SessionCreatePlanRow): boolean {
  if (plan.session_number !== 1) return false;
  if (plan.status !== 'draft') return false;
  const logs = plan.exercise_logs;
  if (Array.isArray(logs) && logs.length > 0) return false;
  return true;
}

export async function runProgressGate(input: RequestGateContinue): Promise<ProgressGateResult> {
  const { userId, supabase, timings } = input;
  const tProgress = performance.now();

  let { data: progress } = await supabase
    .from('session_program_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  timings.progress_read_ms = Math.round(performance.now() - tProgress);

  if (!progress) {
    const resolved = await resolveTotalSessions(supabase, userId);
    if (resolved.source === 'default') {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'blocked',
        code: 'FREQUENCY_REQUIRED',
        meta: {
          profile_present: !!resolved.profile,
          target_frequency: resolved.profile?.target_frequency ?? null,
          fallback_blocked: true,
        },
      });
      return { kind: 'frequency_required' };
    }

    const { data: created, error: insertErr } = await supabase
      .from('session_program_progress')
      .insert({
        user_id: userId,
        total_sessions: resolved.totalSessions,
        completed_sessions: 0,
        active_session_number: null,
      })
      .select()
      .single();

    if (insertErr || !created) {
      console.error('[session/create] progress init failed', insertErr);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'error',
        code: 'DB_ERROR',
        meta: { message_short: 'progress init failed' },
      });
      return { kind: 'progress_init_failed' };
    }

    progress = created;
  }

  timings.progress_db_ms = Math.round(performance.now() - tProgress);

  let effectiveProgress = progress as SessionCreateProgressRow;
  const totalSessions = effectiveProgress.total_sessions ?? DEFAULT_TOTAL_SESSIONS;
  const completedCount = effectiveProgress.completed_sessions ?? 0;

  if (completedCount >= totalSessions) {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_blocked',
      status: 'blocked',
      code: 'PROGRAM_FINISHED',
      meta: { total_sessions: totalSessions, completed_sessions: completedCount },
    });
    return { kind: 'program_finished' };
  }

  const activeNum = effectiveProgress.active_session_number;
  if (activeNum != null && activeNum > totalSessions) {
    await supabase
      .from('session_program_progress')
      .update({ active_session_number: null })
      .eq('user_id', userId);
    effectiveProgress = { ...effectiveProgress, active_session_number: null };
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_blocked',
      status: 'blocked',
      code: 'PROGRAM_FINISHED',
      meta: { total_sessions: totalSessions, active_session_number: activeNum },
    });
    return { kind: 'program_finished' };
  }

  const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(effectiveProgress);
  if (todayCompleted) {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_blocked',
      status: 'blocked',
      code: 'DAILY_LIMIT_REACHED',
      meta: { day_key: getKstDayKeyUTC() },
    });
    return {
      kind: 'daily_limit_reached',
      nextUnlockAt: nextUnlockAt ?? getNextKstMidnightUtcIso(),
    };
  }

  if (effectiveProgress.active_session_number) {
    const { data: existingPlan } = await supabase
      .from('session_plans')
      .select('session_number, status, theme, plan_json, condition, exercise_logs')
      .eq('user_id', userId)
      .eq('session_number', effectiveProgress.active_session_number)
      .maybeSingle();

    if (!isEmptyDraftPlan(existingPlan as SessionCreatePlanRow | null)) {
      const planRow = (existingPlan as SessionCreatePlanRow | null) ?? null;
      const activeNum = effectiveProgress.active_session_number;

      if (planRow && activeNum === 1) {
        const resolvedProfile = await resolveTotalSessions(supabase, userId);
        const currentLevel = resolvedProfile.profile?.exercise_experience_level ?? null;
        const snapshot = readProfileGenerationSnapshot(planRow.plan_json);
        const mismatch = isMaterialExerciseExperienceMismatch(currentLevel, snapshot);
        const snapshotAbsent = snapshot == null || !Object.prototype.hasOwnProperty.call(snapshot, 'exercise_experience_level');

        if (mismatch && isSafeSession1ProfileMismatchRegen(planRow)) {
          const snapNorm = normalizedExerciseExperienceLevel(snapshot?.exercise_experience_level);
          const curNorm = normalizedExerciseExperienceLevel(currentLevel);
          void logSessionEvent(supabase, {
            userId,
            eventType: 'session_create',
            status: 'ok',
            sessionNumber: 1,
            meta: {
              reason: 'regen_due_to_profile_mismatch',
              active_plan_profile_mismatch: true,
              profile_exercise_experience_level: curNorm,
              snapshot_exercise_experience_level: snapNorm,
            },
          });
          effectiveProgress = { ...effectiveProgress, active_session_number: null };
        } else {
          let guard: 'match' | 'snapshot_absent_reuse' | 'mismatch_reuse_unsafe';
          const meta: Record<string, unknown> = { reason: 'active_exists' };

          if (mismatch) {
            guard = 'mismatch_reuse_unsafe';
            meta.active_plan_profile_mismatch = true;
            meta.reuse_despite_profile_mismatch_unsafe = true;
            const snapNorm = normalizedExerciseExperienceLevel(snapshot?.exercise_experience_level);
            const curNorm = normalizedExerciseExperienceLevel(currentLevel);
            meta.profile_exercise_experience_level = curNorm;
            meta.snapshot_exercise_experience_level = snapNorm;
          } else if (snapshotAbsent) {
            guard = 'snapshot_absent_reuse';
            meta.snapshot_absent = true;
          } else {
            guard = 'match';
            meta.active_plan_profile_match = true;
          }

          void logSessionEvent(supabase, {
            userId,
            eventType: 'session_create_idempotent',
            status: 'ok',
            sessionNumber: activeNum,
            meta,
          });
          return {
            kind: 'active_idempotent',
            progress: effectiveProgress,
            existingPlan: planRow,
            todayCompleted,
            nextUnlockAt,
            activePlanProfileGuard: guard,
          };
        }
      } else {
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_idempotent',
          status: 'ok',
          sessionNumber: activeNum,
          meta: { reason: 'active_exists' },
        });
        return {
          kind: 'active_idempotent',
          progress: effectiveProgress,
          existingPlan: planRow,
          todayCompleted,
          nextUnlockAt,
        };
      }
    }

    if (effectiveProgress.active_session_number != null) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create',
        status: 'ok',
        sessionNumber: effectiveProgress.active_session_number,
        meta: { reason: 'empty_draft_recovery' },
      });
      effectiveProgress = { ...effectiveProgress, active_session_number: null };
    }
  }

  const resolved = await resolveTotalSessions(supabase, userId);
  const completed = effectiveProgress.completed_sessions ?? 0;
  const safeToSync =
    resolved.totalSessions >= completed &&
    effectiveProgress.total_sessions !== resolved.totalSessions;

  if (safeToSync) {
    const { data: synced, error: syncErr } = await supabase
      .from('session_program_progress')
      .update({ total_sessions: resolved.totalSessions })
      .eq('user_id', userId)
      .select()
      .single();
    if (!syncErr && synced) {
      effectiveProgress = synced as SessionCreateProgressRow;
    }
  } else if (resolved.totalSessions < completed) {
    console.warn('[session/create] sync skipped: resolved < completed_sessions', {
      resolved_total: resolved.totalSessions,
      completed_sessions: completed,
      profile_present: !!resolved.profile,
    });
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create',
      status: 'ok',
      meta: {
        sync_skipped: true,
        reason: 'resolved_total_sessions_lt_completed',
        resolved_total: resolved.totalSessions,
        completed_sessions: completed,
      },
    });
  }

  const nextSessionNumber = (effectiveProgress.completed_sessions ?? 0) + 1;
  if (nextSessionNumber > effectiveProgress.total_sessions) {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_blocked',
      status: 'blocked',
      code: 'PROGRAM_FINISHED',
      meta: {
        total_sessions: effectiveProgress.total_sessions,
        completed_sessions: effectiveProgress.completed_sessions,
      },
    });
    return { kind: 'program_finished' };
  }

  return {
    ...input,
    kind: 'continue',
    progress: effectiveProgress,
    resolved,
    nextSessionNumber,
    todayCompleted,
    nextUnlockAt,
  };
}
