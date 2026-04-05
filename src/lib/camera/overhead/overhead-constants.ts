/**
 * OVERHEAD REACH CONSTANTS — SSOT R2 §3 layer-annotated (PR-01 vocabulary freeze)
 *
 * Reference: docs/ssot/OVERHEAD_REACH_SSOT_20260405_R2.md
 * Vocabulary: src/lib/camera/overhead/overhead-truth-vocabulary.ts
 *
 * Constants below are grouped by which truth layer they serve:
 *
 *   [L1 COMPLETION] — Layer 1: Completion truth gates (motion-only)
 *     Used in: overhead-completion-state.ts, overhead-easy-progression.ts
 *
 *   [L2 FINAL PASS] — Layer 2: Final pass gates (runtime + UI)
 *     Used in: isFinalPassLatched() in auto-progression.ts
 *
 *   [L3 INTERP] — Layer 3: Interpretation quality gates (quality/planning)
 *     Used in: overhead-internal-quality.ts, overhead-planning.ts
 *
 * Do NOT promote Layer 3 thresholds to become Layer 1 or Layer 2 gates
 * without an explicit SSOT update.
 *
 * PR-COMP-04: 오버헤드 리치 — evaluator / completion / 가드레일이 공유하는 숫자 상수.
 * (스쿼트 상수와 분리; 단일 소스로 드리프트 방지)
 */
/** [L1 COMPLETION] Strict top-zone floor — arm must reach this elevation. */
export const OVERHEAD_TOP_FLOOR_DEG = 132;
/** [L1 COMPLETION] Required stable-top hold duration for strict path. */
export const OVERHEAD_REQUIRED_HOLD_MS = 1200;
/** [L1 COMPLETION] Minimum consecutive peak frames before top-zone is accepted. */
export const OVERHEAD_MIN_PEAK_FRAMES = 3;

/** [L1 COMPLETION] PR-CAM-11B: 진행 게이트 전용 — 귀 높이·머리 위 근처 (strict 132°보다 낮음) */
export const OVERHEAD_EASY_ELEVATION_FLOOR_DEG = 126;
/** [L1 COMPLETION] PR-CAM-11B: 짧은 top 홀드로 진행 통과 (해석/플래닝은 strict 유지) */
export const OVERHEAD_EASY_REQUIRED_HOLD_MS = 520;
/** [L1 COMPLETION] */
export const OVERHEAD_EASY_MIN_PEAK_FRAMES = 2;
/** [L1 COMPLETION] */
export const OVERHEAD_EASY_TOP_ZONE_MIN_FRAMES = 6;
/** [L1 COMPLETION] */
export const OVERHEAD_EASY_TOP_ZONE_GAP_TOLERANCE_MS = 200;
/** [L2 FINAL PASS] PR-CAM-11B: easy-only 진행 통과 시 confidence 완화 임계 (전역이 아닌 overhead 전용) */
export const OVERHEAD_EASY_PASS_CONFIDENCE = 0.58;
/** [L2 FINAL PASS] PR-CAM-11B: easy-only pass 확정 최소 연속 프레임 수 */
export const OVERHEAD_EASY_LATCH_STABLE_FRAMES = 2;
/** [L1 COMPLETION] stable-top 판정: 연속 프레임 간 최대 각도 변화 */
export const OVERHEAD_STABLE_TOP_DELTA_DEG = 2.6;
/** [L1 COMPLETION] stable-top 판정: 연속 안정 프레임 수 */
export const OVERHEAD_STABLE_TOP_CONSECUTIVE = 3;

/**
 * [L3 INTERP] completion 게이트: 양팔 대칭 허용 한도(평균·피크 gap)
 * NOTE: 현재 이 값은 L1 completion 경로에서도 체크된다.
 * 해석 기준이 통과 게이트 역할을 겸하는 상태 — PR-03/PR-05에서 분리 예정.
 */
export const OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG = 22;
/** [L3 INTERP] */
export const OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG = 36;
