/**
 * PR-A: session_exercise_events — truthful execution logging for drift/dropout/adaptive.
 * Populated on session complete from exercise_logs + plan_json.
 * AGGREGATE-ONLY: one row per exercise block. Do NOT fabricate per-set rows.
 */

export type ExerciseLogItem = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
  rpe?: number | null;
  discomfort?: number | null;
};

type PlanSegment = {
  title?: string;
  items?: Array<{
    templateId?: string;
    sets?: number;
    reps?: number;
    hold_seconds?: number;
    order?: number;
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
  segment_index: number | null;
  item_index: number | null;
  plan_item_key: string;
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
  execution_granularity: 'exercise' | 'set';
  data_quality: 'full' | 'partial';
};

export type EventLogResult = {
  attempted: number;
  written: number;
  failed: number;
};

/**
 * Build ordered plan items from plan_json: (segment_index, item_index, templateId, ...).
 * Used to match exercise_logs by position when same template appears multiple times.
 */
function buildPlanItemList(planJson: PlanJson | null | undefined): Array<{
  segmentIndex: number;
  itemIndex: number;
  templateId: string;
  segmentTitle: string;
  sets: number;
  reps: number | null;
  holdSeconds: number | null;
}> {
  const items: Array<{
    segmentIndex: number;
    itemIndex: number;
    templateId: string;
    segmentTitle: string;
    sets: number;
    reps: number | null;
    holdSeconds: number | null;
  }> = [];
  if (!planJson?.segments) return items;
  for (let segIdx = 0; segIdx < planJson.segments.length; segIdx++) {
    const seg = planJson.segments[segIdx];
    const title = seg.title ?? '';
    for (let itemIdx = 0; itemIdx < (seg.items ?? []).length; itemIdx++) {
      const it = seg.items![itemIdx];
      const tid = it?.templateId;
      if (tid) {
        items.push({
          segmentIndex: segIdx,
          itemIndex: itemIdx,
          templateId: tid,
          segmentTitle: title,
          sets: typeof it.sets === 'number' && it.sets >= 1 ? Math.min(20, Math.floor(it.sets)) : 1,
          reps: typeof it.reps === 'number' && Number.isFinite(it.reps) ? Math.floor(it.reps) : null,
          holdSeconds: typeof it.hold_seconds === 'number' && Number.isFinite(it.hold_seconds) ? Math.floor(it.hold_seconds) : null,
        });
      }
    }
  }
  return items;
}

/**
 * Build exercise-level event rows from exercise_logs + plan_json.
 * ONE row per exercise block. Never fabricate per-set rows from aggregate data.
 * plan_item_key: seg{N}-item{M} when plan available, log{N} when fallback.
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
  const planItems = buildPlanItemList(planJson);
  const hasPlan = planItems.length > 0;

  // Map templateId -> queue of (segmentIndex, itemIndex) for positional matching
  const templateQueue = new Map<string, Array<{ segmentIndex: number; itemIndex: number }>>();
  for (const p of planItems) {
    const q = templateQueue.get(p.templateId) ?? [];
    q.push({ segmentIndex: p.segmentIndex, itemIndex: p.itemIndex });
    templateQueue.set(p.templateId, q);
  }

  const planByKey = new Map<string, (typeof planItems)[0]>();
  for (const p of planItems) {
    planByKey.set(`seg${p.segmentIndex}-item${p.itemIndex}`, p);
  }

  for (let logIdx = 0; logIdx < exerciseLogs.length; logIdx++) {
    const log = exerciseLogs[logIdx];
    const q = templateQueue.get(log.templateId);
    const match = q?.shift();
    let planItem: (typeof planItems)[0] | null = null;
    let planItemKey: string;
    let segmentIndex: number | null = null;
    let itemIndex: number | null = null;
    let dataQuality: 'full' | 'partial' = 'partial';

    if (match && hasPlan) {
      planItemKey = `seg${match.segmentIndex}-item${match.itemIndex}`;
      planItem = planByKey.get(planItemKey) ?? null;
      segmentIndex = match.segmentIndex;
      itemIndex = match.itemIndex;
      dataQuality = 'full';
    } else {
      planItemKey = `log${logIdx}`;
      dataQuality = 'partial';
    }

    const prescribedSets = planItem?.sets ?? (typeof log.sets === 'number' && log.sets >= 1 ? Math.min(20, Math.floor(log.sets)) : 1);
    const prescribedReps = planItem?.reps ?? (typeof log.reps === 'number' && Number.isFinite(log.reps) ? Math.floor(log.reps) : null);
    const prescribedHoldSeconds = planItem?.holdSeconds ?? null;
    const segmentTitle = planItem?.segmentTitle ?? '';
    const actualSets = typeof log.sets === 'number' && log.sets >= 0 ? Math.min(20, Math.floor(log.sets)) : 0;
    const actualReps = typeof log.reps === 'number' && Number.isFinite(log.reps) ? Math.floor(log.reps) : null;
    const difficultyVariant = typeof log.difficulty === 'number' && log.difficulty >= 1 && log.difficulty <= 5 ? log.difficulty : null;
    const rpeVal = typeof log.rpe === 'number' && log.rpe >= 1 && log.rpe <= 10 ? Math.floor(log.rpe) : null;
    const discomfortVal = typeof log.discomfort === 'number' && log.discomfort >= 0 && log.discomfort <= 10 ? Math.floor(log.discomfort) : null;

    rows.push({
      user_id: ctx.userId,
      session_plan_id: ctx.sessionPlanId,
      session_number: ctx.sessionNumber,
      template_id: log.templateId,
      segment_title: segmentTitle,
      segment_index: segmentIndex,
      item_index: itemIndex,
      plan_item_key: planItemKey,
      set_index: 0,
      prescribed_sets: prescribedSets,
      prescribed_reps: prescribedReps,
      prescribed_hold_seconds: prescribedHoldSeconds,
      completed: actualSets > 0,
      skipped: actualSets === 0,
      actual_reps: actualReps,
      actual_hold_seconds: null,
      rpe: rpeVal,
      discomfort: discomfortVal,
      difficulty_variant: difficultyVariant,
      started_at: null,
      completed_at: ctx.completedAt,
      idle_seconds: null,
      event_source: 'complete',
      routine_id: ctx.routineId ?? null,
      execution_granularity: 'exercise',
      data_quality: dataQuality,
    });
  }

  return rows;
}

/**
 * Write event rows to DB. Upsert: on conflict, update enrichment fields.
 * Returns result for observability. Does not throw.
 */
export async function writeSessionExerciseEvents(
  supabase: { from: (table: string) => { upsert: (rows: unknown[], opts?: object) => Promise<{ data: unknown[] | null; error: unknown }> } },
  rows: SessionExerciseEventRow[]
): Promise<EventLogResult> {
  const attempted = rows.length;
  if (attempted === 0) {
    return { attempted: 0, written: 0, failed: 0 };
  }
  try {
    const { data, error } = await supabase
      .from('session_exercise_events')
      .upsert(rows, {
        onConflict: 'session_plan_id,plan_item_key,set_index,event_source',
      });
    if (error) {
      console.error('[session_exercise_events] upsert failed', error.message);
      return { attempted, written: 0, failed: attempted };
    }
    const written = Array.isArray(data) ? data.length : 0;
    return { attempted, written, failed: 0 };
  } catch (err) {
    console.error('[session_exercise_events] upsert error', err);
    return { attempted, written: 0, failed: attempted };
  }
}
