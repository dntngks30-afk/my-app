/**
 * PR-A: session_exercise_events — per-set logging for drift/dropout/adaptive.
 * Populated on session complete from exercise_logs + plan_json.
 * Fire-and-forget: insert failure does not block complete response.
 */

export type ExerciseLogItem = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
};

type PlanSegment = {
  title?: string;
  items?: Array<{
    templateId?: string;
    sets?: number;
    reps?: number;
    hold_seconds?: number;
  }>;
};

type PlanJson = {
  segments?: PlanSegment[];
};

export type SessionExerciseEventRow = {
  user_id: string;
  session_plan_id: string;
  session_number: number;
  template_id: string;
  segment_title: string;
  set_index: number;
  prescribed_sets: number;
  prescribed_reps: number | null;
  prescribed_hold_seconds: number | null;
  completed: boolean;
  skipped: boolean;
  actual_reps: number | null;
  actual_hold_seconds: number | null;
  rpe: number | null;
  discomfort: number | null;
  difficulty_variant: number | null;
  started_at: string | null;
  completed_at: string | null;
  idle_seconds: number | null;
  event_source: 'player' | 'complete';
  routine_id: string | null;
};

/**
 * Build per-set event rows from exercise_logs + plan_json.
 * Each exercise with sets=N produces N rows (set_index 0..N-1).
 */
export function buildSessionExerciseEvents(
  exerciseLogs: ExerciseLogItem[],
  planJson: PlanJson | null | undefined,
  ctx: {
    userId: string;
    sessionPlanId: string;
    sessionNumber: number;
    completedAt: string;
    routineId?: string | null;
  }
): SessionExerciseEventRow[] {
  const rows: SessionExerciseEventRow[] = [];
  const planItems = new Map<string, { segmentTitle: string; sets: number; reps: number | null; holdSeconds: number | null }>();

  if (planJson?.segments) {
    for (const seg of planJson.segments) {
      const title = seg.title ?? '';
      for (const item of seg.items ?? []) {
        const tid = item.templateId;
        if (tid) {
          planItems.set(tid, {
            segmentTitle: title,
            sets: typeof item.sets === 'number' && item.sets >= 1 ? Math.min(20, Math.floor(item.sets)) : 1,
            reps: typeof item.reps === 'number' && Number.isFinite(item.reps) ? Math.floor(item.reps) : null,
            holdSeconds: typeof item.hold_seconds === 'number' && Number.isFinite(item.hold_seconds) ? Math.floor(item.hold_seconds) : null,
          });
        }
      }
    }
  }

  for (const log of exerciseLogs) {
    const plan = planItems.get(log.templateId);
    const prescribedSets = plan?.sets ?? (typeof log.sets === 'number' && log.sets >= 1 ? Math.min(20, Math.floor(log.sets)) : 1);
    const prescribedReps = plan?.reps ?? (typeof log.reps === 'number' && Number.isFinite(log.reps) ? Math.floor(log.reps) : null);
    const prescribedHoldSeconds = plan?.holdSeconds ?? null;
    const segmentTitle = plan?.segmentTitle ?? '';
    const actualSets = typeof log.sets === 'number' && log.sets >= 0 ? Math.min(20, Math.floor(log.sets)) : 0;
    const actualReps = typeof log.reps === 'number' && Number.isFinite(log.reps) ? Math.floor(log.reps) : null;
    const difficultyVariant = typeof log.difficulty === 'number' && log.difficulty >= 1 && log.difficulty <= 5 ? log.difficulty : null;

    const numRows = actualSets > 0 ? actualSets : 1;
    for (let setIndex = 0; setIndex < numRows; setIndex++) {
      rows.push({
        user_id: ctx.userId,
        session_plan_id: ctx.sessionPlanId,
        session_number: ctx.sessionNumber,
        template_id: log.templateId,
        segment_title: segmentTitle,
        set_index: setIndex,
        prescribed_sets: prescribedSets,
        prescribed_reps: prescribedReps,
        prescribed_hold_seconds: prescribedHoldSeconds,
        completed: setIndex < actualSets,
        skipped: actualSets === 0,
        actual_reps: actualReps,
        actual_hold_seconds: null,
        rpe: null,
        discomfort: null,
        difficulty_variant: difficultyVariant,
        started_at: null,
        completed_at: ctx.completedAt,
        idle_seconds: null,
        event_source: 'complete',
        routine_id: ctx.routineId ?? null,
      });
    }
  }

  return rows;
}
