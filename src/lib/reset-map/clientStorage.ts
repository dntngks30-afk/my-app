/**
 * PR-RESET-05: Minimal client state for reset-map flow.
 * flow_id, start_key, apply_key. sessionStorage.
 */

const KEY = 'moveRe:resetMap:active';

export type ResetMapClientState = {
  flow_id: string;
  start_key: string;
  apply_key?: string;
  updated_at: number;
};

export function getResetMapClientState(): ResetMapClientState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const d = parsed as Record<string, unknown>;
    const flow_id = typeof d.flow_id === 'string' ? d.flow_id : '';
    const start_key = typeof d.start_key === 'string' ? d.start_key : '';
    const updated_at = typeof d.updated_at === 'number' ? d.updated_at : 0;
    if (!flow_id || !start_key) return null;
    const apply_key = typeof d.apply_key === 'string' ? d.apply_key : undefined;
    return { flow_id, start_key, apply_key, updated_at };
  } catch {
    return null;
  }
}

export function setResetMapClientState(state: ResetMapClientState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, updated_at: Date.now() }));
  } catch {
    // ignore
  }
}

export function clearResetMapClientState(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
