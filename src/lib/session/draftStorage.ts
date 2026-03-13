/**
 * PR-PERSIST-01: Home session draft persistence (localStorage).
 * Prevents workout progress loss during session execution.
 * Key: moveRe:draft:{planId}
 * Client-side only — no server changes.
 *
 * PR-19: Distinct from src/lib/session/storage.ts (sessionStorage, routine-tab draft).
 * This module: home/reset-map session execution draft. storage.ts: different flow.
 */

import type { ExerciseLogItem } from './client';
import type { SessionPainArea } from './feedback-types';

const KEY_PREFIX = 'moveRe:draft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export type SessionDraftData = {
  session_number: number;
  plan_id: string;
  updated_at: number;
  exercises: Record<
    string,
    {
      sets_completed: number;
      reps: number;
      hold_seconds: number;
      completed: boolean;
      skipped: boolean;
      rpe: number | null;
      discomfort: number | null;
    }
  >;
  /** Session-level feedback (PR-DRAFT-01 compatibility) */
  sessionPerceivedDifficulty?: 'too_easy' | 'ok' | 'too_hard' | null;
  sessionPainAreas?: SessionPainArea[];
};

export type SessionDraftInput = {
  session_number: number;
  plan_id: string;
  logs: Record<string, ExerciseLogItem>;
  /** templateId -> holdSeconds (0 = rep exercise). Used to correctly store hold vs rep. */
  holdSecondsByTemplateId?: Record<string, number>;
  sessionPerceivedDifficulty?: 'too_easy' | 'ok' | 'too_hard' | null;
  sessionPainAreas?: SessionPainArea[];
};

function getKey(planId: string): string {
  return `${KEY_PREFIX}${planId}`;
}

function logToExercise(
  log: ExerciseLogItem,
  holdSeconds?: number
): SessionDraftData['exercises'][string] {
  const sets = log.sets ?? 0;
  const value = log.reps ?? 0;
  const isHold = holdSeconds != null && holdSeconds > 0;
  return {
    sets_completed: sets,
    reps: isHold ? 0 : value,
    hold_seconds: isHold ? value : 0,
    completed: !!log.templateId,
    skipped: false,
    rpe: log.rpe ?? null,
    discomfort: typeof log.discomfort === 'number' ? log.discomfort : null,
  };
}

/** plan_item_key 형식: segmentIndex:itemIndex:templateId. templateId 추출용 */
function parseTemplateIdFromKey(key: string): string {
  const parts = key.split(':');
  return parts.length >= 3 ? parts[2]! : key;
}

function exerciseToLog(
  key: string,
  templateId: string,
  name: string,
  ex: SessionDraftData['exercises'][string]
): ExerciseLogItem {
  const reps = ex.hold_seconds > 0 ? ex.hold_seconds : ex.reps;
  const log: ExerciseLogItem = {
    templateId,
    name,
    sets: ex.sets_completed > 0 ? ex.sets_completed : null,
    reps: reps > 0 ? reps : null,
    difficulty: null,
    rpe: ex.rpe ?? null,
    discomfort: ex.discomfort ?? null,
  };
  if (key.includes(':') && key.split(':').length >= 3) {
    log.plan_item_key = key;
  }
  return log;
}

function isValidExercise(obj: unknown): obj is SessionDraftData['exercises'][string] {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.sets_completed === 'number' &&
    typeof o.reps === 'number' &&
    typeof o.hold_seconds === 'number' &&
    typeof o.completed === 'boolean' &&
    typeof o.skipped === 'boolean'
  );
}

/**
 * Load session draft from localStorage.
 * Returns null if: not found, session_number mismatch, plan_id mismatch, or draft older than 24h.
 */
export function loadSessionDraft(planId: string): SessionDraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getKey(planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const d = parsed as Record<string, unknown>;

    const session_number = typeof d.session_number === 'number' ? d.session_number : 0;
    const plan_id = typeof d.plan_id === 'string' ? d.plan_id : '';
    const updated_at = typeof d.updated_at === 'number' ? d.updated_at : 0;

    if (plan_id !== planId) return null;
    if (Date.now() - updated_at > MAX_AGE_MS) return null;

    const exercises: SessionDraftData['exercises'] = {};
    const rawEx = d.exercises;
    if (rawEx && typeof rawEx === 'object') {
      for (const [k, v] of Object.entries(rawEx)) {
        if (isValidExercise(v)) exercises[k] = v;
      }
    }

    const validAreas: SessionPainArea[] = ['neck', 'lower_back', 'knee', 'wrist', 'shoulder'];
    const sessionPainAreas = Array.isArray(d.sessionPainAreas)
      ? (d.sessionPainAreas.filter(
          (a: unknown) => typeof a === 'string' && validAreas.includes(a as SessionPainArea)
        ) as SessionPainArea[])
      : undefined;

    let sessionPerceivedDifficulty: 'too_easy' | 'ok' | 'too_hard' | null | undefined;
    if (
      d.sessionPerceivedDifficulty === 'too_easy' ||
      d.sessionPerceivedDifficulty === 'ok' ||
      d.sessionPerceivedDifficulty === 'too_hard'
    ) {
      sessionPerceivedDifficulty = d.sessionPerceivedDifficulty;
    } else if (d.sessionPerceivedDifficulty === null) {
      sessionPerceivedDifficulty = null;
    }

    return {
      session_number,
      plan_id,
      updated_at,
      exercises,
      sessionPerceivedDifficulty,
      sessionPainAreas: sessionPainAreas?.length ? sessionPainAreas : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Save session draft to localStorage.
 * Uses planId for key; overwrites existing draft for same plan.
 */
export function saveSessionDraft(planId: string, data: SessionDraftInput): void {
  if (typeof window === 'undefined') return;
  try {
    const exercises: SessionDraftData['exercises'] = {};
    const holdMap = data.holdSecondsByTemplateId ?? {};
    for (const [templateId, log] of Object.entries(data.logs)) {
      exercises[templateId] = logToExercise(log, holdMap[templateId]);
    }
    const toSave: SessionDraftData = {
      session_number: data.session_number,
      plan_id: data.plan_id,
      updated_at: Date.now(),
      exercises,
      sessionPerceivedDifficulty: data.sessionPerceivedDifficulty,
      sessionPainAreas: data.sessionPainAreas?.length ? data.sessionPainAreas : undefined,
    };
    localStorage.setItem(getKey(planId), JSON.stringify(toSave));
  } catch {
    // quota etc — ignore
  }
}

/**
 * Clear session draft from localStorage.
 * Call when: session completed, plan_id changed, session_number mismatch.
 */
export function clearSessionDraft(planId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getKey(planId));
  } catch {
    // ignore
  }
}

/**
 * Convert SessionDraftData to logs Record for SessionPanelV2.
 * Key: plan_item_key when draft uses it, else templateId (backward compat).
 * nameByKey: Record<key, name> — build from exercises (plan_item_key or templateId).
 */
export function draftToLogs(
  draft: SessionDraftData,
  nameByKey: Record<string, string>
): Record<string, ExerciseLogItem> {
  const result: Record<string, ExerciseLogItem> = {};
  for (const [key, ex] of Object.entries(draft.exercises)) {
    const templateId = parseTemplateIdFromKey(key);
    const name = nameByKey[key] ?? nameByKey[templateId] ?? '운동';
    result[key] = exerciseToLog(key, templateId, name, ex);
  }
  return result;
}
