/**
 * PR-COMP-04 — 오버헤드 리치 **completion 게이트** 단일 진실(모션 관점).
 *
 * - pass/latch/guardrail는 `auto-progression`이 `completionSatisfied`와 결합해 판단.
 * - 본 모듈은 포즈에서 파생된 입력만 사용; 스쿼트 completion과 무관.
 */
import {
  OVERHEAD_TOP_FLOOR_DEG,
  OVERHEAD_REQUIRED_HOLD_MS,
  OVERHEAD_MIN_PEAK_FRAMES,
  OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG,
  OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG,
} from './overhead-constants';
import type { MotionCompletionResult } from '@/lib/camera/types/motion-completion';

export type OverheadCompletionMachinePhase =
  | 'idle'
  | 'raising'
  | 'top_unstable'
  | 'stable_top'
  | 'holding'
  | 'completed';

export type OverheadCompletionPassReason = 'top_hold_met' | 'not_confirmed';

export interface OverheadCompletionInput {
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

  if (input.raiseCount === 0 || input.peakCount < OVERHEAD_MIN_PEAK_FRAMES) {
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
  };
}
