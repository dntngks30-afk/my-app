import { getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import { logSessionEvent } from '@/lib/session-events';
import type { PersistenceCommitResult, PlanMaterializeResult, SessionCreatePlanRow, SessionCreateProgressRow } from './types';

export async function runPersistenceCommit(
  input: PlanMaterializeResult
): Promise<PersistenceCommitResult> {
  const {
    userId,
    supabase,
    timings,
    progress,
    nextSessionNumber,
    todayCompleted,
    nextUnlockAt,
    planPayload,
  } = input;

  const { data: existingPlan } = await supabase
    .from('session_plans')
    .select('session_number, status, theme, plan_json, condition')
    .eq('user_id', userId)
    .eq('session_number', nextSessionNumber)
    .maybeSingle();

  if ((existingPlan as SessionCreatePlanRow | null)?.status === 'completed') {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_idempotent',
      status: 'ok',
      sessionNumber: nextSessionNumber,
      meta: { reason: 'conflict_return' },
    });
    return {
      kind: 'completed_conflict',
      progress,
      existingPlan: existingPlan as SessionCreatePlanRow,
      todayCompleted,
      nextUnlockAt,
    };
  }

  const tPlanWrite = performance.now();
  let plan: SessionCreatePlanRow | null = null;

  if (
    existingPlan &&
    ((existingPlan as SessionCreatePlanRow).status === 'draft' ||
      (existingPlan as SessionCreatePlanRow).status === 'started')
  ) {
    const { data: updated, error: updateErr } = await supabase
      .from('session_plans')
      .update({
        theme: planPayload.theme,
        plan_json: planPayload.plan_json,
        condition: planPayload.condition,
        generation_trace_json: planPayload.generation_trace_json,
      })
      .eq('user_id', userId)
      .eq('session_number', nextSessionNumber)
      .in('status', ['draft', 'started'])
      .select('session_number, status, theme, plan_json, condition')
      .maybeSingle();

    if (updateErr) {
      console.error('[session/create] plan update failed', updateErr);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'error',
        code: 'DB_ERROR',
        meta: { message_short: 'plan update failed' },
      });
      return { kind: 'plan_update_failed' };
    }

    plan = (updated as SessionCreatePlanRow | null) ?? (existingPlan as SessionCreatePlanRow);
    timings.plan_write_ms = Math.round(performance.now() - tPlanWrite);
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('session_plans')
      .insert(planPayload)
      .select('session_number, status, theme, plan_json, condition')
      .maybeSingle();

    if (insertErr) {
      if (insertErr.code === '23505') {
        const [{ data: raced }, { data: prog }] = await Promise.all([
          supabase
            .from('session_plans')
            .select('session_number, status, theme, plan_json, condition')
            .eq('user_id', userId)
            .eq('session_number', nextSessionNumber)
            .maybeSingle(),
          supabase
            .from('session_program_progress')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        if (raced) {
          void logSessionEvent(supabase, {
            userId,
            eventType: 'session_create_idempotent',
            status: 'ok',
            sessionNumber: nextSessionNumber,
            meta: { reason: 'conflict_return' },
          });
          return {
            kind: 'race_conflict',
            progress,
            racedPlan: raced as SessionCreatePlanRow,
            finalProgress:
              (prog as SessionCreateProgressRow | null) ??
              ({ ...progress, active_session_number: nextSessionNumber } as SessionCreateProgressRow),
          };
        }
      }

      console.error('[session/create] plan insert failed', insertErr);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'error',
        code: 'DB_ERROR',
        meta: { message_short: 'plan insert failed' },
      });
      return { kind: 'plan_insert_failed' };
    }

    plan = inserted as SessionCreatePlanRow | null;
    timings.plan_write_ms = Math.round(performance.now() - tPlanWrite);
  }

  if (!plan) {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_blocked',
      status: 'error',
      code: 'DB_ERROR',
      meta: { message_short: 'plan not found after insert' },
    });
    return { kind: 'plan_missing' };
  }

  const { data: updatedProgress, error: progressErr } = await supabase
    .from('session_program_progress')
    .update({ active_session_number: nextSessionNumber })
    .eq('user_id', userId)
    .select()
    .single();

  if (progressErr) {
    console.error('[session/create] progress update failed', progressErr);
  }

  const finalProgress =
    (updatedProgress as SessionCreateProgressRow | null) ??
    ({ ...progress, active_session_number: nextSessionNumber } as SessionCreateProgressRow);

  return {
    kind: 'success',
    progress,
    plan,
    finalProgress,
    todayCompleted: getTodayCompletedAndNextUnlock(finalProgress).todayCompleted,
    nextUnlockAt: getTodayCompletedAndNextUnlock(finalProgress).nextUnlockAt,
  };
}
