/**
 * PR-COMP-04: 오버헤드 리치 — evaluator / completion / 가드레일이 공유하는 숫자 상수.
 * (스쿼트 상수와 분리; 단일 소스로 드리프트 방지)
 */
export const OVERHEAD_TOP_FLOOR_DEG = 132;
export const OVERHEAD_REQUIRED_HOLD_MS = 1200;
export const OVERHEAD_MIN_PEAK_FRAMES = 3;
export const OVERHEAD_STABLE_TOP_DELTA_DEG = 2.6;
export const OVERHEAD_STABLE_TOP_CONSECUTIVE = 3;

/** completion 게이트: 양팔 대칭 허용 한도(평균·피크 gap) */
export const OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG = 22;
export const OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG = 36;
