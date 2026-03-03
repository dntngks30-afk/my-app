/**
 * Session Phase 계산 (1~4)
 * total_sessions(기본 16)와 session_number로 Phase 결정.
 */

const TOTAL_SESSIONS_DEFAULT = 16;

export type Phase = 1 | 2 | 3 | 4;

/**
 * session_number → Phase (1~4)
 */
export function computePhase(
  totalSessions: number,
  sessionNumber: number
): Phase {
  if (sessionNumber < 1) return 1;
  const perPhase = Math.max(1, Math.floor(totalSessions / 4));
  const phase = Math.min(4, Math.ceil(sessionNumber / perPhase));
  return (phase as Phase) || 1;
}

/**
 * Phase → 0-based index (0~3)
 */
export function getPhaseIndex(phase: Phase): number {
  return phase - 1;
}
