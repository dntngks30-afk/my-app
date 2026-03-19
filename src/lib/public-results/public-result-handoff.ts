/**
 * FLOW-02 — Public Result Handoff Identity Contract
 *
 * 저장된 public result id를 localStorage에 보관하는 최소 handoff contract.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - "이 stage의 public result id가 DB에 저장되어 있다"는 사실만 기록
 * - refresh/재진입 시 DB에서 결과를 복구하기 위한 최소 단서
 * - 보안 토큰이 아님 — UUID 식별자만
 *
 * ─── localStorage 키 ──────────────────────────────────────────────────────────
 * - moveRePublicResultId:v1:baseline  → baseline 결과 id
 * - moveRePublicResultId:v1:refined   → refined 결과 id
 *
 * ─── 호환성 ───────────────────────────────────────────────────────────────────
 * - FLOW-01의 anon-id 키(moveReAnonId:v1)와 독립 (덮어쓰지 않음)
 * - FLOW-03/05에서 이 id를 login/pay bridge와 claim에 사용 예정
 *
 * ⚠️ 이 id는 보안 토큰이 아니다. UUID obscurity 기반 접근.
 *    진짜 소유권 잠금은 FLOW-05 claim에서 user_id로 처리됨.
 *
 * @see src/lib/public-results/anon-id.ts (FLOW-01)
 * @see src/lib/public-results/persistPublicResult.ts (FLOW-01 write, FLOW-02 핸드오프 저장)
 */

// ─── 키 상수 ─────────────────────────────────────────────────────────────────

export const HANDOFF_KEY_PREFIX = 'moveRePublicResultId:v1';
export const HANDOFF_KEY_BASELINE = `${HANDOFF_KEY_PREFIX}:baseline` as const;
export const HANDOFF_KEY_REFINED  = `${HANDOFF_KEY_PREFIX}:refined`  as const;

type HandoffStage = 'baseline' | 'refined';

function keyFor(stage: HandoffStage): string {
  return stage === 'baseline' ? HANDOFF_KEY_BASELINE : HANDOFF_KEY_REFINED;
}

// ─── Handoff 헬퍼 ─────────────────────────────────────────────────────────────

/**
 * FLOW-01 저장 성공 후 id를 localStorage에 기록한다.
 * 이미 같은 stage의 id가 있으면 덮어쓴다(최신 결과가 우선).
 */
export function savePublicResultHandoff(stage: HandoffStage, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(stage), id);
  } catch {
    // localStorage 쓰기 실패 시 조용히 무시
  }
}

/**
 * 저장된 public result id를 읽는다.
 * 없거나 접근 불가 시 null 반환.
 */
export function loadPublicResultHandoff(stage: HandoffStage): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(keyFor(stage)) || null;
  } catch {
    return null;
  }
}

/**
 * 특정 stage의 핸드오프 id를 삭제한다.
 * (선택적 사용 — claim 완료 후 cleanup 등)
 */
export function clearPublicResultHandoff(stage: HandoffStage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(keyFor(stage));
  } catch {
    // 무시
  }
}
