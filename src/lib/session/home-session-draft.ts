/**
 * PR-DRAFT-01: Home session draft persistence (localStorage)
 * Survives refresh, app close, navigation.
 * Key: sessionDraft_home:{sessionNumber}
 * Separate from routine-tab draft (sessionStorage, checked state).
 */

import type { ExerciseLogItem } from './client';
import type { SessionPainArea } from './feedback-types';

const KEY_PREFIX = 'sessionDraft_home:';

export type HomeSessionDraft = {
  sessionNumber: number;
  logs: Record<string, ExerciseLogItem>;
  sessionPerceivedDifficulty?: 'too_easy' | 'ok' | 'too_hard' | null;
  sessionPainAreas?: SessionPainArea[];
  lastUpdatedAtMs: number;
};

function getKey(sessionNumber: number): string {
  return `${KEY_PREFIX}${sessionNumber}`;
}

function isValidLog(obj: unknown): obj is ExerciseLogItem {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.templateId === 'string' &&
    o.templateId.length > 0 &&
    typeof o.name === 'string'
  );
}

function parseLogs(raw: unknown): Record<string, ExerciseLogItem> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const result: Record<string, ExerciseLogItem> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isValidLog(v)) {
      result[k] = v as ExerciseLogItem;
    }
  }
  return result;
}

export function loadHomeSessionDraft(sessionNumber: number): HomeSessionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getKey(sessionNumber));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const d = parsed as Record<string, unknown>;
    const sn = typeof d.sessionNumber === 'number' ? d.sessionNumber : 0;
    if (sn !== sessionNumber) return null;
    const lastAt = typeof d.lastUpdatedAtMs === 'number' ? d.lastUpdatedAtMs : 0;
    const logs = parseLogs(d.logs);
    let sessionPerceivedDifficulty: 'too_easy' | 'ok' | 'too_hard' | null | undefined;
    if (d.sessionPerceivedDifficulty === 'too_easy' || d.sessionPerceivedDifficulty === 'ok' || d.sessionPerceivedDifficulty === 'too_hard') {
      sessionPerceivedDifficulty = d.sessionPerceivedDifficulty;
    } else if (d.sessionPerceivedDifficulty === null) {
      sessionPerceivedDifficulty = null;
    }
    const validAreas: SessionPainArea[] = ['neck', 'lower_back', 'knee', 'wrist', 'shoulder'];
    const sessionPainAreas = Array.isArray(d.sessionPainAreas)
      ? (d.sessionPainAreas.filter((a: unknown) => typeof a === 'string' && validAreas.includes(a as SessionPainArea)) as SessionPainArea[])
      : undefined;

    return {
      sessionNumber: sn,
      logs,
      sessionPerceivedDifficulty,
      sessionPainAreas: sessionPainAreas?.length ? sessionPainAreas : undefined,
      lastUpdatedAtMs: lastAt,
    };
  } catch {
    return null;
  }
}

export function saveHomeSessionDraft(draft: HomeSessionDraft): void {
  if (typeof window === 'undefined') return;
  try {
    const toSave = {
      ...draft,
      lastUpdatedAtMs: Date.now(),
    };
    localStorage.setItem(getKey(draft.sessionNumber), JSON.stringify(toSave));
  } catch {
    // quota etc — ignore
  }
}

export function deleteHomeSessionDraft(sessionNumber: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getKey(sessionNumber));
  } catch {
    // ignore
  }
}
