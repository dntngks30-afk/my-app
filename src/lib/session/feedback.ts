/**
 * PR-P2-1: Session feedback validation, row building, persistence
 * Idempotent upsert. Soft failure on save (complete 핵심 흐름 보존).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FeedbackPayload,
  SessionFeedbackPayload,
  ExerciseFeedbackItem,
  SessionPainArea,
} from './feedback-types';

// ─── Validation ─────────────────────────────────────────────────────────────

const RPE_MIN = 1;
const RPE_MAX = 10;
const PAIN_MIN = 0;
const PAIN_MAX = 10;
const PERCEIVED_DIFF_MIN = 1;
const PERCEIVED_DIFF_MAX = 5;
const PAIN_DELTA_MIN = -5;
const PAIN_DELTA_MAX = 10;
const RATIO_MIN = 0;
const RATIO_MAX = 1;
const MAX_EXERCISE_FEEDBACK = 80;
const MAX_STR_LEN = 200;

/** Returns normalized payload or null if invalid. Empty/partial is valid. */
export function normalizeSessionFeedbackPayload(raw: unknown): FeedbackPayload | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;
  const result: FeedbackPayload = {};

  if (obj.sessionFeedback != null && typeof obj.sessionFeedback === 'object') {
    const sf = obj.sessionFeedback as Record<string, unknown>;
    const session: SessionFeedbackPayload = {};

    if (typeof sf.overallRpe === 'number' && Number.isFinite(sf.overallRpe)) {
      session.overallRpe = Math.min(RPE_MAX, Math.max(RPE_MIN, Math.floor(sf.overallRpe)));
    }
    if (typeof sf.painAfter === 'number' && Number.isFinite(sf.painAfter)) {
      session.painAfter = Math.min(PAIN_MAX, Math.max(PAIN_MIN, Math.floor(sf.painAfter)));
    }
    if (sf.difficultyFeedback === 'too_easy' || sf.difficultyFeedback === 'ok' || sf.difficultyFeedback === 'too_hard') {
      session.difficultyFeedback = sf.difficultyFeedback;
    }
    if (typeof sf.completionRatio === 'number' && Number.isFinite(sf.completionRatio)) {
      session.completionRatio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, sf.completionRatio));
    }
    if (Array.isArray(sf.painAreas) && sf.painAreas.length > 0) {
      const valid: SessionPainArea[] = ['neck', 'lower_back', 'knee', 'wrist', 'shoulder'];
      session.painAreas = sf.painAreas.filter((a): a is SessionPainArea => valid.includes(a));
    }
    if (typeof sf.timeOverrun === 'boolean') {
      session.timeOverrun = sf.timeOverrun;
    }
    if (typeof sf.note === 'string') {
      session.note = sf.note.trim().slice(0, MAX_STR_LEN) || undefined;
    }

    if (Object.keys(session).length > 0) {
      result.sessionFeedback = session;
    }
  }

  if (Array.isArray(obj.exerciseFeedback) && obj.exerciseFeedback.length <= MAX_EXERCISE_FEEDBACK) {
    const items: ExerciseFeedbackItem[] = [];
    const seenKeys = new Set<string>();

    for (const item of obj.exerciseFeedback) {
      if (!item || typeof item !== 'object') continue;
      const ei = item as Record<string, unknown>;

      const exerciseKey = typeof ei.exerciseKey === 'string'
        ? ei.exerciseKey.trim().slice(0, MAX_STR_LEN)
        : null;
      if (!exerciseKey || seenKeys.has(exerciseKey)) continue;
      seenKeys.add(exerciseKey);

      const entry: ExerciseFeedbackItem = { exerciseKey };

      if (typeof ei.completionRatio === 'number' && Number.isFinite(ei.completionRatio)) {
        entry.completionRatio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, ei.completionRatio));
      }
      if (typeof ei.perceivedDifficulty === 'number' && Number.isFinite(ei.perceivedDifficulty)) {
        entry.perceivedDifficulty = Math.min(
          PERCEIVED_DIFF_MAX,
          Math.max(PERCEIVED_DIFF_MIN, Math.floor(ei.perceivedDifficulty))
        );
      }
      if (typeof ei.painDelta === 'number' && Number.isFinite(ei.painDelta)) {
        entry.painDelta = Math.min(PAIN_DELTA_MAX, Math.max(PAIN_DELTA_MIN, Math.floor(ei.painDelta)));
      }
      if (typeof ei.wasReplaced === 'boolean') {
        entry.wasReplaced = ei.wasReplaced;
      }
      if (typeof ei.skipped === 'boolean') {
        entry.skipped = ei.skipped;
      }
      if (typeof ei.dislikedReason === 'string') {
        entry.dislikedReason = ei.dislikedReason.trim().slice(0, MAX_STR_LEN) || undefined;
      }

      items.push(entry);
    }

    if (items.length > 0) {
      result.exerciseFeedback = items;
    }
  }

  if (!result.sessionFeedback && !result.exerciseFeedback) return null;
  return result;
}

// ─── Row building ───────────────────────────────────────────────────────────

export type SessionFeedbackRow = {
  session_plan_id: string | null;
  user_id: string;
  session_number: number;
  overall_rpe: number | null;
  pain_after: number | null;
  difficulty_feedback: string | null;
  completion_ratio: number | null;
  time_overrun: boolean | null;
  note: string | null;
};

export type ExerciseFeedbackRow = {
  session_feedback_id: string | null;
  user_id: string;
  session_number: number;
  exercise_key: string;
  completion_ratio: number | null;
  perceived_difficulty: number | null;
  pain_delta: number | null;
  was_replaced: boolean | null;
  skipped: boolean | null;
  disliked_reason: string | null;
};

export function buildSessionFeedbackRow(
  payload: SessionFeedbackPayload,
  ctx: { userId: string; sessionNumber: number; sessionPlanId?: string | null }
): SessionFeedbackRow {
  return {
    session_plan_id: ctx.sessionPlanId ?? null,
    user_id: ctx.userId,
    session_number: ctx.sessionNumber,
    overall_rpe: payload.overallRpe ?? null,
    pain_after: payload.painAfter ?? null,
    difficulty_feedback: payload.difficultyFeedback ?? null,
    completion_ratio: payload.completionRatio ?? null,
    time_overrun: payload.timeOverrun ?? null,
    note: payload.note ?? null,
  };
}

export function buildExerciseFeedbackRows(
  items: ExerciseFeedbackItem[],
  ctx: {
    userId: string;
    sessionNumber: number;
    sessionFeedbackId: string | null;
  }
): ExerciseFeedbackRow[] {
  return items.map((item) => ({
    session_feedback_id: ctx.sessionFeedbackId,
    user_id: ctx.userId,
    session_number: ctx.sessionNumber,
    exercise_key: item.exerciseKey,
    completion_ratio: item.completionRatio ?? null,
    perceived_difficulty: item.perceivedDifficulty ?? null,
    pain_delta: item.painDelta ?? null,
    was_replaced: item.wasReplaced ?? null,
    skipped: item.skipped ?? null,
    disliked_reason: item.dislikedReason ?? null,
  }));
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export type SaveFeedbackResult = { saved: boolean; error?: string };

/**
 * Idempotent upsert. session_feedback: ON CONFLICT (user_id, session_number) DO UPDATE.
 * exercise_feedback: ON CONFLICT (user_id, session_number, exercise_key) DO UPDATE.
 * Soft failure: returns { saved: false } on error, does not throw.
 */
export async function saveSessionFeedback(
  supabase: SupabaseClient,
  payload: FeedbackPayload,
  ctx: {
    userId: string;
    sessionNumber: number;
    sessionPlanId?: string | null;
  }
): Promise<SaveFeedbackResult> {
  try {
    let sessionFeedbackId: string | null = null;

    if (payload.sessionFeedback) {
      const row = buildSessionFeedbackRow(payload.sessionFeedback, ctx);

      const { data: upserted, error } = await supabase
        .from('session_feedback')
        .upsert(row, {
          onConflict: 'user_id,session_number',
          ignoreDuplicates: false,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[session/feedback] session_feedback upsert failed', error);
        return { saved: false, error: error.message };
      }
      sessionFeedbackId = upserted?.id ?? null;
    }

    if (payload.exerciseFeedback && payload.exerciseFeedback.length > 0) {
      const rows = buildExerciseFeedbackRows(payload.exerciseFeedback, {
        userId: ctx.userId,
        sessionNumber: ctx.sessionNumber,
        sessionFeedbackId,
      });

      const { error } = await supabase
        .from('exercise_feedback')
        .upsert(rows, {
          onConflict: 'user_id,session_number,exercise_key',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[session/feedback] exercise_feedback upsert failed', error);
        return { saved: false, error: error.message };
      }
    }

    return { saved: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[session/feedback] save failed', err);
    return { saved: false, error: msg };
  }
}
