/**
 * PR-COMP-04: 오버헤드 리치 — evaluator / completion / 가드레일이 공유하는 숫자 상수.
 * (스쿼트 상수와 분리; 단일 소스로 드리프트 방지)
 */
export const OVERHEAD_TOP_FLOOR_DEG = 132;
export const OVERHEAD_REQUIRED_HOLD_MS = 1200;
export const OVERHEAD_MIN_PEAK_FRAMES = 3;

/** PR-CAM-11B: 진행 게이트 전용 — 귀 높이·머리 위 근처 (strict 132°보다 낮음) */
export const OVERHEAD_EASY_ELEVATION_FLOOR_DEG = 126;
/** PR-CAM-11B: 짧은 top 홀드로 진행 통과 (해석/플래닝은 strict 유지) */
export const OVERHEAD_EASY_REQUIRED_HOLD_MS = 520;
export const OVERHEAD_EASY_MIN_PEAK_FRAMES = 2;
export const OVERHEAD_EASY_TOP_ZONE_MIN_FRAMES = 6;
export const OVERHEAD_EASY_TOP_ZONE_GAP_TOLERANCE_MS = 200;
/** PR-CAM-11B: easy-only 진행 통과 시 confidence·래치 완화 (전역이 아닌 overhead 전용) */
export const OVERHEAD_EASY_PASS_CONFIDENCE = 0.58;
export const OVERHEAD_EASY_LATCH_STABLE_FRAMES = 2;
export const OVERHEAD_STABLE_TOP_DELTA_DEG = 2.6;
export const OVERHEAD_STABLE_TOP_CONSECUTIVE = 3;

/** completion 게이트: 양팔 대칭 허용 한도(평균·피크 gap) */
export const OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG = 22;
export const OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG = 36;
