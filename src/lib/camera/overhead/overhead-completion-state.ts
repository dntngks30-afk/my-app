/**
 * OVERHEAD REACH — COMPLETION TRUTH LAYER (PR-01 vocabulary freeze)
 *
 * Reference: docs/ssot/OVERHEAD_REACH_SSOT_20260405_R2.md §3.1
 * Vocabulary: src/lib/camera/overhead/overhead-truth-vocabulary.ts
 *
 * This module is the COMPLETION TRUTH layer (Layer 1) for overhead reach.
 * It answers motion-only questions only:
 *   - did a meaningful rise happen?
 *   - did the user enter a valid top zone?
 *   - did the user hold at top long enough?
 *   - what path satisfied completion?
 *   - if blocked, what blocked it?
 *
 * This module must NOT include:
 *   - confidence threshold
 *   - capture quality invalid vs low
 *   - pass confirmation window
 *   - UI latch / auto-advance
 *   - retry vs fail routing
 *   - voice playback state
 *
 * Final pass decision (Layer 2) lives in isFinalPassLatched() in auto-progression.ts.
 * Interpretation truth (Layer 3) lives in computeOverheadInternalQuality().
 *
 * PR-COMP-04 — 오버헤드 리치 **completion 게이트** 단일 진실(모션 관점).
 *
 * - pass/latch/guardrail는 `auto-progression`이 `completionSatisfied`와 결합해 판단.
 * - 본 모듈은 포즈에서 파생된 입력만 사용; 스쿼트 completion과 무관.
 *
 * PR-CAM-11A: strict 경로 실패 시 fallback top-hold 경로 추가 (additive).
 *   - fallbackTopHold가 제공되고 fallbackSatisfied이면 completionSatisfied = true
 *   - completionPath 필드로 어느 경로로 통과했는지 기록
 */
import {
  OVERHEAD_TOP_FLOOR_DEG,
  OVERHEAD_REQUIRED_HOLD_MS,
  OVERHEAD_MIN_PEAK_FRAMES,
  OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG,
  OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG,
} from './overhead-constants';
import type { MotionCompletionResult } from '@/lib/camera/types/motion-completion';
import type { OverheadTopHoldFallbackResult } from './overhead-top-hold-fallback';

export type OverheadCompletionMachinePhase =
  | 'idle'
  | 'raising'
  | 'top_unstable'
  | 'stable_top'
  | 'holding'
  | 'completed';

export type OverheadCompletionPassReason = 'top_hold_met' | 'not_confirmed';

export interface OverheadCompletionInput {
  /**
   * Legacy raise-frame counter (phaseHint='raise' frames).
   * Still consumed by `derivePhase` for the 'raising' phase label.
   * For the completion gate, `meaningfulRiseSatisfied` is used instead.
   */
  raiseCount: number;
  peakCount: number;
  peakArmElevationDeg: number;
  armRangeAvgDeg: number;
  holdDurationMs: number;
  topDetectedAtMs?: number;
  stableTopEnteredAtMs?: number;
  holdArmedAtMs?: number;
  holdAccumulationStartedAtMs?: number;
  holdArmingBlockedReason: string | null;
  meanAsymmetryDeg: number | null;
  maxAsymmetryDeg: number | null;
  /**
   * PR-02: robust rise truth from overhead-rise-truth.ts.
   * When true, the user demonstrably raised their arm ≥ OVERHEAD_RISE_MIN_DELTA_DEG
   * above their starting (baseline) position.
   * Replaces fragile `raiseCount === 0` check in the completion gate.
   * See: src/lib/camera/overhead/overhead-rise-truth.ts
   */
  meaningfulRiseSatisfied: boolean;
  /**
   * PR-02: timestamp when meaningful rise first started (arm crossed baseline+5°).
   * Used for observability only — not a pass gate.
   */
  riseStartedAtMs?: number;
  /**
   * PR-CAM-11A: jitter-tolerant 폴백 결과 (evaluator가 주입).
   * strict 경로 실패 시 이 결과가 fallbackSatisfied이면 completion 인정.
   */
  fallbackTopHold?: OverheadTopHoldFallbackResult;
}

export interface OverheadCompletionState extends MotionCompletionResult {
  topDetected: boolean;
  stableTopEntry: boolean;
  holdStarted: boolean;
  holdDurationMs: number;
  holdSatisfied: boolean;
  /** 모션 기준 통과 후보 — 가드레일·신뢰도와 결합 전 */
  passLatchedCandidate: boolean;
  completionMachinePhase: OverheadCompletionMachinePhase;
  completionPassReason: OverheadCompletionPassReason;
  /** PR-CAM-11A: 폴백 경로 통과 여부 */
  fallbackTopHoldSatisfied: boolean;
  /**
   * PR-CAM-11A: 통과 경로 식별자.
   * 'strict' = stable-top dwell, 'fallback' = jitter-tolerant top-zone run, null = 미통과
   */
  completionPath: 'strict' | 'fallback' | null;
  /**
   * PR-02: reflected from input — whether the user made a meaningful rise.
   * True = arm traveled ≥ OVERHEAD_RISE_MIN_DELTA_DEG above starting position.
   * Used in debug/observability to distinguish "rise not detected" from other blocks.
   */
  meaningfulRiseSatisfied: boolean;
  /**
   * PR-02: timestamp when meaningful rise first started, or undefined if not detected.
   * Observability only — not a pass gate.
   */
  riseStartedAtMs: number | undefined;
}

function asymmetryFails(mean: number | null, peak: number | null): boolean {
  if (peak != null && peak > OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG) return true;
  if (mean != null && mean > OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG) return true;
  return false;
}

function derivePhase(s: {
  raiseCount: number;
  topDetected: boolean;
  stableTopEntry: boolean;
  holdStarted: boolean;
  holdSatisfied: boolean;
  completionSatisfied: boolean;
}): OverheadCompletionMachinePhase {
  if (s.completionSatisfied) return 'completed';
  if (s.holdStarted && !s.holdSatisfied) return 'holding';
  if (s.stableTopEntry) return 'stable_top';
  if (s.topDetected) return 'top_unstable';
  if (s.raiseCount > 0) return 'raising';
  return 'idle';
}

/**
 * 상단 감지 ≠ 통과 — dwell·홀드·대칭이 명시적으로 충족될 때만 completionSatisfied.
 */
export function evaluateOverheadCompletionState(
  input: OverheadCompletionInput
): OverheadCompletionState {
  const effectiveArm =
    input.peakArmElevationDeg > 0 ? input.peakArmElevationDeg : input.armRangeAvgDeg;

  const topDetected = input.topDetectedAtMs != null;
  const stableTopEntry = input.stableTopEnteredAtMs != null;
  const holdStarted =
    input.holdArmedAtMs != null && input.holdAccumulationStartedAtMs != null;
  const holdDurationMs = Math.max(0, input.holdDurationMs);
  const holdSatisfied = holdStarted && holdDurationMs >= OVERHEAD_REQUIRED_HOLD_MS;

  let completionBlockedReason: string | null = null;

  // PR-02: use meaningfulRiseSatisfied (baseline-relative travel) instead of fragile raiseCount===0.
  // raiseCount is kept above for derivePhase only.
  if (!input.meaningfulRiseSatisfied || input.peakCount < OVERHEAD_MIN_PEAK_FRAMES) {
    completionBlockedReason = 'raise_peak_incomplete';
  } else if (effectiveArm < OVERHEAD_TOP_FLOOR_DEG) {
    completionBlockedReason = 'insufficient_elevation';
  } else if (asymmetryFails(input.meanAsymmetryDeg, input.maxAsymmetryDeg)) {
    completionBlockedReason = 'asymmetry_unacceptable';
  } else if (!stableTopEntry) {
    completionBlockedReason = 'stable_top_not_reached';
  } else if (!holdSatisfied) {
    completionBlockedReason = 'hold_short';
  }

  // PR-CAM-11A: strict 경로 실패 시 fallback top-hold 경로 시도 (additive)
  const fallbackTopHoldSatisfied = input.fallbackTopHold?.fallbackSatisfied === true;
  let completionPath: 'strict' | 'fallback' | null = null;

  if (completionBlockedReason == null) {
    completionPath = 'strict';
  } else if (fallbackTopHoldSatisfied) {
    // strict가 실패했지만 jitter-tolerant 폴백이 통과 — completion 인정
    completionBlockedReason = null;
    completionPath = 'fallback';
  }

  const completionSatisfied = completionBlockedReason == null;
  const passLatchedCandidate = completionSatisfied;
  const completionPassReason: OverheadCompletionPassReason = completionSatisfied
    ? 'top_hold_met'
    : 'not_confirmed';

  const completionMachinePhase = derivePhase({
    raiseCount: input.raiseCount,
    topDetected,
    stableTopEntry,
    holdStarted,
    holdSatisfied,
    completionSatisfied,
  });

  return {
    topDetected,
    stableTopEntry,
    holdStarted,
    holdDurationMs,
    holdSatisfied,
    passLatchedCandidate,
    completionSatisfied,
    completionBlockedReason,
    completionMachinePhase,
    completionPassReason,
    fallbackTopHoldSatisfied,
    completionPath,
    meaningfulRiseSatisfied: input.meaningfulRiseSatisfied,
    riseStartedAtMs: input.riseStartedAtMs,
  };
}
