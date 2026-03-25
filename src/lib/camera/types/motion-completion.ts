/**
 * PR-COMP-05 — 모션 간 **경량 공유 계약** (completion / 재시도 관측 / 내부 품질 상단 형태).
 *
 * - 계층 분리 유지: completion ≠ interpretation ≠ 페이지 orchestration.
 * - 스쿼트·오버헤드 **판정 로직·임계값은 각 모듈**에 둔다. 여기서는 타입·트레이스 형태만 맞춘다.
 */

/** evaluator `highlightedMetrics`·트레이스에 실리는 completion 요약(공통 키) */
export type MotionCompletionResult = {
  completionSatisfied: boolean;
  completionMachinePhase: string;
  completionPassReason?: string;
  completionBlockedReason?: string | null;
};

/**
 * 애매 재시도 1회 UX(페이지)에서 공통으로 남길 수 있는 관측 형태.
 * 실제 reason 유니온은 모션별 모듈이 유지한다.
 */
export type MotionAmbiguousRetryTrace = {
  eligible: boolean;
  /** 모션별 slug; null이면 재생/기록 없음 */
  reason: string | null;
};

/** squat / overhead internal quality 공통 머리글 — 점수 필드명은 모션별로 추가 */
export type MotionInternalQualityBase = {
  confidence: number;
  qualityTier: 'high' | 'medium' | 'low';
  limitations: string[];
};

/** 게이트·디버그에서 completion 부분만 추출할 때 (순수 매핑, 판정 없음) */
export function toMotionCompletionResult(x: {
  completionSatisfied: boolean;
  completionMachinePhase: string;
  completionPassReason?: string;
  completionBlockedReason?: string | null;
}): MotionCompletionResult {
  return {
    completionSatisfied: x.completionSatisfied,
    completionMachinePhase: x.completionMachinePhase,
    completionPassReason: x.completionPassReason,
    completionBlockedReason: x.completionBlockedReason ?? undefined,
  };
}
