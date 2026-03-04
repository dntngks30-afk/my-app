/**
 * Session draft 저장소 (로컬, 탭/세션 내 복구용)
 *
 * 키: mr_session_active_${session_number}_v1
 * 내용: 진행 상태 + startTime (Recovery 모달 판단용)
 *
 * sessionStorage 우선(탭 닫으면 초기화). 필요 시 localStorage 확장 가능.
 */

const KEY_PREFIX = 'mr_session_active_';
const KEY_SUFFIX = '_v1';

export type SessionDraftNote = {
  mood?: 'good' | 'ok' | 'bad';
  time_budget?: 'short' | 'normal';
};

export type SessionDraft = {
  sessionNumber: number;
  startedAtMs: number;
  lastUpdatedAtMs: number;
  checked: Record<string, boolean>;
  note?: SessionDraftNote;
};

function getKey(sessionNumber: number): string {
  return `${KEY_PREFIX}${sessionNumber}${KEY_SUFFIX}`;
}

export function loadSessionDraft(
  sessionNumber: number
): SessionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(getKey(sessionNumber));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const d = parsed as Record<string, unknown>;
    const sn = typeof d.sessionNumber === 'number' ? d.sessionNumber : 0;
    const startedAt = typeof d.startedAtMs === 'number' ? d.startedAtMs : 0;
    const lastAt = typeof d.lastUpdatedAtMs === 'number' ? d.lastUpdatedAtMs : startedAt;
    const checked = d.checked && typeof d.checked === 'object' ? (d.checked as Record<string, boolean>) : {};
    return {
      sessionNumber: sn,
      startedAtMs: startedAt,
      lastUpdatedAtMs: lastAt,
      checked,
      note: d.note as SessionDraftNote | undefined,
    };
  } catch {
    return null;
  }
}

export function saveSessionDraft(draft: SessionDraft): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(getKey(draft.sessionNumber), JSON.stringify(draft));
  } catch {
    // quota 등 무시
  }
}

export function deleteSessionDraft(sessionNumber: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(getKey(sessionNumber));
  } catch {
    // ignore
  }
}

export function hasSessionDraft(sessionNumber: number): boolean {
  return loadSessionDraft(sessionNumber) !== null;
}

// ─── Exercise logs draft (localStorage, planId 기반) ───────────────────────────

const EX_LOG_PREFIX = 'movere:exerciseLogsDraft:v1:';

export type ExerciseLogsDraft = {
  version: 1;
  updatedAt: number;
  planId: string;
  sessionNumber: number;
  logsByTemplateId: Record<string, import('./client').ExerciseLogItem>;
};

const MAX_DRAFT_SIZE = 100_000; // ~100KB, 과다 저장 방지

function getExLogKey(planId: string): string {
  return `${EX_LOG_PREFIX}${planId}`;
}

export function loadExerciseLogsDraft(planId: string): ExerciseLogsDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getExLogKey(planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(getExLogKey(planId));
      return null;
    }
    const d = parsed as Record<string, unknown>;
    if (d.version !== 1 || typeof d.planId !== 'string' || typeof d.sessionNumber !== 'number') {
      localStorage.removeItem(getExLogKey(planId));
      return null;
    }
    const logs = d.logsByTemplateId && typeof d.logsByTemplateId === 'object'
      ? (d.logsByTemplateId as Record<string, import('./client').ExerciseLogItem>)
      : {};
    return {
      version: 1,
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
      planId: d.planId,
      sessionNumber: d.sessionNumber,
      logsByTemplateId: logs,
    };
  } catch {
    try {
      localStorage.removeItem(getExLogKey(planId));
    } catch { /* noop */ }
    return null;
  }
}

export function saveExerciseLogsDraft(planId: string, draft: ExerciseLogsDraft): void {
  if (typeof window === 'undefined') return;
  try {
    const str = JSON.stringify(draft);
    if (str.length > MAX_DRAFT_SIZE) return;
    localStorage.setItem(getExLogKey(planId), str);
  } catch {
    /* quota 등 무시 */
  }
}

export function deleteExerciseLogsDraft(planId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getExLogKey(planId));
  } catch {
    /* ignore */
  }
}
