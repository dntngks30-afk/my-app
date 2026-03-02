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
