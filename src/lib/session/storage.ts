/**
 * Session draft 저장소 (sessionStorage, 탭/세션 내 복구용)
 *
 * 키: mr_session_active_${session_number}_v1
 * 내용: 진행 상태 + startTime (Recovery 모달 판단용)
 *
 * PR-19: Distinct from draftStorage.ts (localStorage, home session execution draft).
 * This module: routine-tab / sessionStorage. draftStorage: home reset-map flow.
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
  /** Key: plan_item_key (SSOT). Legacy segTitle_order_templateId is read-only fallback on load. */
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
