/**
 * 오버헤드 리치 evaluator
 * metrics: arm range, trunk compensation, asymmetry, top hold
 *
 * PR overhead-dwell: hold = 연속 stable-top dwell time (first~last peak span 아님).
 * reach-only 차단, 흔들림 시 hold reset.
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { buildPoseFeaturesFrames } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import { getOverheadPerStepDiagnostics } from '@/lib/camera/step-joint-spec';
import type { EvaluatorResult, EvaluatorMetric, OverheadProgressionState } from './types';
import {
  OVERHEAD_TOP_FLOOR_DEG,
  OVERHEAD_REQUIRED_HOLD_MS,
  OVERHEAD_STABLE_TOP_DELTA_DEG,
  OVERHEAD_STABLE_TOP_CONSECUTIVE,
  OVERHEAD_EASY_ELEVATION_FLOOR_DEG,
} from '@/lib/camera/overhead/overhead-constants';
import { evaluateOverheadCompletionState } from '@/lib/camera/overhead/overhead-completion-state';
import {
  computeOverheadInternalQuality,
  overheadInternalQualityInsufficientSignal,
} from '@/lib/camera/overhead/overhead-internal-quality';
import { computeOverheadTopHoldFallback } from '@/lib/camera/overhead/overhead-top-hold-fallback';
import { computeOverheadRiseTruth } from '@/lib/camera/overhead/overhead-rise-truth';
import {
  computeOverheadEasyProgressionHold,
  computeOverheadLowRomProgression,
  computeOverheadHumaneLowRomProgression,
  OVERHEAD_LOW_ROM_ABSOLUTE_FLOOR_DEG,
  OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG,
} from '@/lib/camera/overhead/overhead-easy-progression';

const MIN_VALID_FRAMES = 8;

/** 가드레일 등 레거시 import 경로 유지 — 값은 `overhead-constants` 단일 소스 */
export {
  OVERHEAD_TOP_FLOOR_DEG as OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG,
  OVERHEAD_STABLE_TOP_DELTA_DEG,
  OVERHEAD_STABLE_TOP_CONSECUTIVE,
} from '@/lib/camera/overhead/overhead-constants';

export interface OverheadStableTopDwellResult {
  holdDurationMs: number;
  /** first frame at top (e >= floor) — top 도달 신호 */
  topDetectedAtMs: number | undefined;
  /** first frame of settled segment — top에서 움직임 안정 후 */
  stableTopEnteredAtMs: number | undefined;
  holdArmedAtMs: number | undefined;
  holdAccumulationStartedAtMs: number | undefined;
  stableTopExitedAtMs: number | undefined;
  stableTopDwellMs: number;
  stableTopSegmentCount: number;
  holdComputationMode: 'dwell';
  /** trace: legacy first~last peak span (비교용) */
  holdDurationMsLegacySpan: number;
  holdArmingBlockedReason: string | null;
}

/** timestamp gap > 이 값이면 segment break — 프레임 누락 시 누적 불가 */
const MAX_DWELL_DELTA_MS = 120;
/** hold clock: ascent 제외 — delta >= 이 값이면 상승 중으로 간주, hold에 포함 안 함 */
const ASCENT_DELTA_THRESHOLD_DEG = 1.0;
/** dwell arming: arm이 settle된 후에만 hold clock 시작. |delta| < 이 값이어야 hold 누적 (완화: 0.8→1.5) */
const HOLD_ARMED_DELTA_MAX_DEG = 1.5;
/** segment 진입: top 도달 후 N연속 settled 필요 — topDetected와 holdArmed 분리 */
const STABLE_TOP_SETTLE_CONSECUTIVE = 2;
/** hold clock: segment 진입 후 즉시 armed (segment = settled run) */
const HOLD_ARMING_CONSECUTIVE = 1;
/** jitter grace: !isSettled 연속 이 프레임 수 이내면 holdArmed 유지 */
const HOLD_GRACE_FRAMES = 2;

/**
 * 연속 stable-top dwell time 계산.
 *
 * PR state-separation: topDetected ≠ holdArmed.
 * - topDetectedAtMs: first frame e >= floor (top 도달)
 * - stableTopEntryAtMs: first frame of N consecutive settled (움직임 안정 후)
 * - holdArmedAtMs: stableTopEntryAtMs (hold clock 시작)
 * - hold = armed 이후 연속 dwell만 누적
 */
export function computeOverheadStableTopDwell(
  frames: PoseFeaturesFrame[],
  floorDeg = OVERHEAD_TOP_FLOOR_DEG,
  deltaMax = OVERHEAD_STABLE_TOP_DELTA_DEG,
  consecutive = OVERHEAD_STABLE_TOP_CONSECUTIVE
): OverheadStableTopDwellResult {
  const valid = frames.filter((f) => f.isValid);
  const legacySpan = (() => {
    const peakFrames = valid.filter((f) => f.phaseHint === 'peak');
    let stableIdx = -1;
    for (let i = 0; i <= valid.length - consecutive; i++) {
      let ok = true;
      for (let k = 0; k < consecutive; k++) {
        const e = valid[i + k]!.derived.armElevationAvg;
        const prev = i + k > 0 ? valid[i + k - 1]!.derived.armElevationAvg : null;
        const d = typeof e === 'number' && typeof prev === 'number' ? e - prev : 0;
        if (typeof e !== 'number' || e < floorDeg || Math.abs(d) >= deltaMax) {
          ok = false;
          break;
        }
      }
      if (ok) {
        stableIdx = i;
        break;
      }
    }
    const confirmed = stableIdx >= 0 ? peakFrames.filter((f) => valid.indexOf(f) >= stableIdx) : [];
    return confirmed.length > 1
      ? (confirmed[confirmed.length - 1]!.timestampMs - confirmed[0]!.timestampMs)
      : 0;
  })();

  let topDetectedAtMs: number | undefined;
  let settledStreak = 0;
  let settledRunStartMs: number | null = null;
  let segmentStartMs: number | null = null;
  let segmentDwellMs = 0;
  let prevStableTimestampMs: number | null = null;
  let holdArmed = false;
  let armedStreak = 0;
  let graceFramesRemaining = HOLD_GRACE_FRAMES;
  let holdArmedAtMs: number | undefined;
  let holdAccumulationStartedAtMs: number | undefined;
  let bestDwellMs = 0;
  let bestEnteredMs: number | undefined;
  let bestExitedMs: number | undefined;
  let bestHoldArmedMs: number | undefined;
  let bestAccumulationStartedMs: number | undefined;
  let segmentCount = 0;
  let holdArmingBlockedReason: string | null = null;

  for (let i = 0; i < valid.length; i++) {
    const f = valid[i]!;
    const e = f.derived.armElevationAvg;
    const prev = i > 0 ? valid[i - 1]!.derived.armElevationAvg : null;
    const delta = typeof e === 'number' && typeof prev === 'number' ? e - prev : 0;
    const atTop = typeof e === 'number' && e >= floorDeg;
    const isStable = atTop && Math.abs(delta) < deltaMax;
    /** ascent 제외: delta >= 1.0 이면 상승 중 */
    const isNotAscent = delta < ASCENT_DELTA_THRESHOLD_DEG;
    /** arm settled: |delta| < 1.5 — hold clock 누적 조건 */
    const isSettled =
      atTop &&
      Math.abs(delta) < HOLD_ARMED_DELTA_MAX_DEG &&
      isNotAscent;

    if (atTop && topDetectedAtMs === undefined) {
      topDetectedAtMs = f.timestampMs;
    }

    const timestampDeltaMs =
      prevStableTimestampMs !== null ? f.timestampMs - prevStableTimestampMs : 0;

    if (isSettled) {
      if (settledStreak === 0) settledRunStartMs = f.timestampMs;
      settledStreak += 1;
      if (
        settledStreak >= STABLE_TOP_SETTLE_CONSECUTIVE &&
        topDetectedAtMs !== undefined &&
        segmentStartMs === null &&
        settledRunStartMs !== null
      ) {
        segmentStartMs = settledRunStartMs;
        holdArmed = true;
        holdArmedAtMs = settledRunStartMs;
        holdAccumulationStartedAtMs = settledRunStartMs;
        prevStableTimestampMs = f.timestampMs;
        segmentCount += 1;
        holdArmingBlockedReason = null;
      }
      if (segmentStartMs !== null) {
        if (timestampDeltaMs > MAX_DWELL_DELTA_MS) {
          segmentStartMs = null;
          segmentDwellMs = 0;
          prevStableTimestampMs = f.timestampMs;
          holdArmed = false;
          holdArmedAtMs = undefined;
          holdAccumulationStartedAtMs = undefined;
          graceFramesRemaining = HOLD_GRACE_FRAMES;
          armedStreak = 0;
        }
        if (
          segmentStartMs === null &&
          settledStreak >= STABLE_TOP_SETTLE_CONSECUTIVE &&
          topDetectedAtMs !== undefined &&
          settledRunStartMs !== null
        ) {
          segmentStartMs = settledRunStartMs;
          holdArmed = true;
          holdArmedAtMs = settledRunStartMs;
          holdAccumulationStartedAtMs = settledRunStartMs;
          prevStableTimestampMs = f.timestampMs;
          segmentCount += 1;
          holdArmingBlockedReason = null;
        }
        if (holdArmed) {
          graceFramesRemaining = HOLD_GRACE_FRAMES;
          armedStreak = 0;
          segmentDwellMs += timestampDeltaMs;
          prevStableTimestampMs = f.timestampMs;
          if (segmentDwellMs > bestDwellMs) {
            bestDwellMs = segmentDwellMs;
            bestEnteredMs = segmentStartMs;
            bestExitedMs = f.timestampMs;
            bestHoldArmedMs = holdArmedAtMs;
            bestAccumulationStartedMs = holdAccumulationStartedAtMs;
          }
        }
      }
    } else {
      settledStreak = 0;
      settledRunStartMs = null;
      if (segmentStartMs !== null) {
        armedStreak = 0;
        if (holdArmed) {
          graceFramesRemaining -= 1;
          if (graceFramesRemaining <= 0) {
            holdArmed = false;
            holdArmedAtMs = undefined;
            holdAccumulationStartedAtMs = undefined;
          }
        }
        if (atTop) prevStableTimestampMs = f.timestampMs;
      }
      if (!atTop) {
        segmentStartMs = null;
        segmentDwellMs = 0;
        prevStableTimestampMs = null;
        holdArmed = false;
        armedStreak = 0;
        graceFramesRemaining = HOLD_GRACE_FRAMES;
        holdArmedAtMs = undefined;
        holdAccumulationStartedAtMs = undefined;
      }
    }
  }

  if (holdArmingBlockedReason === null && bestDwellMs === 0 && topDetectedAtMs !== undefined) {
    holdArmingBlockedReason = 'settle_not_reached';
  } else if (topDetectedAtMs === undefined) {
    holdArmingBlockedReason = 'no_top_detected';
  }

  return {
    holdDurationMs: bestDwellMs,
    topDetectedAtMs,
    stableTopEnteredAtMs: bestEnteredMs,
    holdArmedAtMs: bestHoldArmedMs,
    holdAccumulationStartedAtMs: bestAccumulationStartedMs,
    stableTopExitedAtMs: bestExitedMs,
    stableTopDwellMs: bestDwellMs,
    stableTopSegmentCount: segmentCount,
    holdComputationMode: 'dwell',
    holdDurationMsLegacySpan: legacySpan,
    holdArmingBlockedReason,
  };
}

/** PR-CAM-03: 통과(1200ms 홀드)와 별개로 normalize·planning tier에 쓸 evidence 등급 */
export type OverheadPlanningEvidenceLevel =
  | 'strong_evidence'
  | 'shallow_evidence'
  | 'weak_evidence'
  | 'insufficient_signal';

/**
 * top-zone dwell + 짧은 안정 구간 + 홀드 길이·보상 메트릭으로 planning-safe 등급.
 * - 짧은 스침/단편 dwell → strong 금지
 * - 최소 통과 홀드(1200ms)만으로는 기본 shallow
 */
export function computeOverheadPlanningEvidenceLevel(input: {
  holdDurationMs: number;
  stableTopDwellMs: number;
  stableTopSegmentCount: number;
  peakArmElevation: number | null;
  raiseCount: number;
  peakCount: number;
  holdArmingBlockedReason: string | null;
  lumbarTrend?: 'good' | 'neutral' | 'concern';
  asymTrend?: 'good' | 'neutral' | 'concern';
}): {
  level: OverheadPlanningEvidenceLevel;
  reasons: string[];
  dwellCoherent: boolean;
} {
  const REQUIRED_PASS_HOLD_MS = OVERHEAD_REQUIRED_HOLD_MS;
  const STRONG_HOLD_MS = 1520;
  const PEAK_DEG_FOR_STRONG = 135;

  const {
    holdDurationMs,
    stableTopDwellMs,
    stableTopSegmentCount,
    peakArmElevation,
    raiseCount,
    peakCount,
    holdArmingBlockedReason,
    lumbarTrend,
    asymTrend,
  } = input;

  if (raiseCount === 0 || peakCount === 0 || holdDurationMs < REQUIRED_PASS_HOLD_MS) {
    return {
      level: 'insufficient_signal',
      reasons: ['cam03_top_hold_or_phases_incomplete'],
      dwellCoherent: false,
    };
  }

  const concernCount = [lumbarTrend === 'concern', asymTrend === 'concern'].filter(Boolean).length;
  const peak = peakArmElevation ?? 0;

  const dwellCoherent =
    stableTopSegmentCount >= 1 &&
    stableTopDwellMs >= Math.min(holdDurationMs * 0.85, holdDurationMs - 100);

  const canBeStrong =
    holdDurationMs >= STRONG_HOLD_MS &&
    dwellCoherent &&
    concernCount === 0 &&
    peak >= PEAK_DEG_FOR_STRONG &&
    holdArmingBlockedReason == null;

  if (canBeStrong) {
    return {
      level: 'strong_evidence',
      reasons: ['cam03_stable_top_hold_strong'],
      dwellCoherent,
    };
  }

  if (!dwellCoherent) {
    return {
      level: 'weak_evidence',
      reasons: ['cam03_dwell_fragmented_or_transient_top'],
      dwellCoherent,
    };
  }

  if (concernCount >= 2 || (holdDurationMs < 1320 && concernCount >= 1)) {
    return {
      level: 'weak_evidence',
      reasons:
        concernCount >= 2
          ? ['cam03_compensation_multi_concern']
          : ['cam03_borderline_hold_with_concern'],
      dwellCoherent,
    };
  }

  return {
    level: 'shallow_evidence',
    reasons: ['cam03_usable_hold_planning_limited'],
    dwellCoherent,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getNumbers(values: Array<number | null>): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

function countPhases(frames: PoseFeaturesFrame[], phase: PoseFeaturesFrame['phaseHint']): number {
  return frames.filter((frame) => frame.phaseHint === phase).length;
}

export function evaluateOverheadReachFromPoseFrames(
  frames: PoseFeaturesFrame[]
): EvaluatorResult {
  const valid = frames.filter((frame) => frame.isValid);
  if (valid.length < MIN_VALID_FRAMES) {
    const emptyDiag = {
      criticalJointAvailability: 0,
      missingCriticalJoints: [] as string[],
      leftSideCompleteness: 0,
      rightSideCompleteness: 0,
      leftRightAsymmetry: 0,
      metricSufficiency: 0,
      frameCount: 0,
      instabilityFlags: [] as string[],
    };
    return {
      stepId: 'overhead-reach',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['raise_peak_incomplete'],
      debug: {
        frameCount: frames.length,
        validFrameCount: valid.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        highlightedMetrics: {
          validFrameCount: valid.length,
          strictMotionCompletionSatisfied: 0,
          completionSatisfied: false,
          completionPath: 'not_confirmed' as const,
          strictMotionCompletionPath: null,
          easyCompletionSatisfied: 0,
          easyCompletionBlockedReason: 'raise_peak_incomplete',
          lowRomProgressionSatisfied: 0,
          lowRomBlockedReason: 'raise_peak_incomplete',
          humaneLowRomProgressionSatisfied: 0,
          humaneLowRomBlockedReason: 'raise_peak_incomplete',
          completionBlockedReason: 'raise_peak_incomplete',
          completionMachinePhase: 'idle',
          completionPassReason: 'not_confirmed',
          topDetected: 0,
          stableTopEntry: 0,
          holdStarted: 0,
          holdSatisfied: 0,
          passLatchedCandidate: 0,
          overheadTopDetected: 0,
        },
        perStepDiagnostics: { raise: emptyDiag, hold: emptyDiag },
        overheadEvidenceLevel: 'insufficient_signal',
        overheadEvidenceReasons: ['valid_frames_too_few'],
        overheadInternalQuality: overheadInternalQualityInsufficientSignal(),
      },
    };
  }

  const metrics: EvaluatorMetric[] = [];
  const rawMetrics: EvaluatorMetric[] = [];
  const interpretedSignals: string[] = [];
  const qualityHints = [...new Set(valid.flatMap((frame) => frame.qualityHints))];
  const completionHints: string[] = [];
  const armElevationAvgValues = getNumbers(valid.map((frame) => frame.derived.armElevationAvg));
  const armElevationGapValues = getNumbers(valid.map((frame) => frame.derived.armElevationGap));
  const torsoExtensionDeviation = getNumbers(valid.map((frame) => frame.derived.torsoExtensionDeg)).map((value) =>
    Math.abs(value - 90)
  );
  const elbowAngles = getNumbers(
    valid.flatMap((frame) => [frame.derived.elbowAngleLeft, frame.derived.elbowAngleRight])
  );
  const raiseCount = countPhases(valid, 'raise');
  const peakFrames = valid.filter((frame) => frame.phaseHint === 'peak');
  /** stable top entry index: peakCount 등에 사용 */
  let stableTopEntryIndex = -1;
  for (let i = 0; i <= valid.length - OVERHEAD_STABLE_TOP_CONSECUTIVE; i++) {
    let allStable = true;
    for (let k = 0; k < OVERHEAD_STABLE_TOP_CONSECUTIVE; k++) {
      const e = valid[i + k]!.derived.armElevationAvg;
      const prev = i + k > 0 ? valid[i + k - 1]!.derived.armElevationAvg : null;
      const delta = typeof e === 'number' && typeof prev === 'number' ? e - prev : 0;
      if (
        typeof e !== 'number' ||
        e < OVERHEAD_TOP_FLOOR_DEG ||
        Math.abs(delta) >= OVERHEAD_STABLE_TOP_DELTA_DEG
      ) {
        allStable = false;
        break;
      }
    }
    if (allStable) {
      stableTopEntryIndex = i;
      break;
    }
  }

  const topDetectedIdx = valid.findIndex(
    (f) =>
      typeof f.derived.armElevationAvg === 'number' &&
      f.derived.armElevationAvg >= OVERHEAD_TOP_FLOOR_DEG
  );
  const topConfirmedPeaks =
    topDetectedIdx >= 0
      ? peakFrames.filter((f) => valid.indexOf(f) >= topDetectedIdx)
      : stableTopEntryIndex >= 0
        ? peakFrames.filter((f) => valid.indexOf(f) >= stableTopEntryIndex)
        : [];
  const peakCount = topConfirmedPeaks.length;

  /** PR overhead-dwell: 연속 stable-top dwell time. peak span 아님. */
  const dwellResult = computeOverheadStableTopDwell(valid);
  const holdDurationMs = dwellResult.holdDurationMs;
  const topEntryAtMs = dwellResult.topDetectedAtMs;
  const stableTopEntryAtMs = dwellResult.stableTopEnteredAtMs;
  const holdSatisfiedAtMs =
    holdDurationMs >= OVERHEAD_REQUIRED_HOLD_MS && dwellResult.holdArmedAtMs !== undefined
      ? dwellResult.holdArmedAtMs + OVERHEAD_REQUIRED_HOLD_MS
      : undefined;

  const meanAsymmetryDeg =
    armElevationGapValues.length > 0 ? mean(armElevationGapValues) : null;
  const maxAsymmetryDeg =
    armElevationGapValues.length > 0 ? Math.max(...armElevationGapValues) : null;
  const peakArmForCompletion =
    armElevationAvgValues.length > 0 ? Math.max(...armElevationAvgValues) : 0;
  const armRangeAvgDeg =
    armElevationAvgValues.length > 0 ? mean(armElevationAvgValues) : 0;

  /**
   * PR-CAM-11A: top-zone 프레임 수집 (e >= floor 인 valid 프레임만).
   * fallback top-hold 계산에 사용; strict dwell 계산과 무관.
   */
  const topZoneFrames = valid
    .filter(
      (f) =>
        typeof f.derived.armElevationAvg === 'number' &&
        f.derived.armElevationAvg >= OVERHEAD_TOP_FLOOR_DEG
    )
    .map((f) => ({ timestampMs: f.timestampMs }));

  /** PR-CAM-11B: easy 진행용 top-zone (strict floor 132°보다 낮은 귀/머리 위 근처) */
  const easyTopZoneFrames = valid
    .filter(
      (f) =>
        typeof f.derived.armElevationAvg === 'number' &&
        f.derived.armElevationAvg >= OVERHEAD_EASY_ELEVATION_FLOOR_DEG
    )
    .map((f) => ({ timestampMs: f.timestampMs }));
  /**
   * PR-CAM-12: easy top-zone(e >= 126°) 내 유효 프레임 수로 정의.
   * 이전 구현은 phaseHint==='peak'(실기기에서 132°+저지터 필요)에 의존해
   * easy 전용 floor(126°)에서 항상 0을 반환하는 숨겨진 버그가 있었음.
   * easyTopZoneFrames는 이미 e >= OVERHEAD_EASY_ELEVATION_FLOOR_DEG 기준이므로
   * 해당 길이를 직접 사용한다.
   */
  const peakCountAtEasyFloor = easyTopZoneFrames.length;

  // PR-CAM-15: low-ROM 진행 경로 준비 — easy floor(126°) 미달 사용자용
  // baseline: 초기 6프레임 평균 (세션 시작 시 팔의 자연스러운 시작 위치)
  const LOW_ROM_BASELINE_WINDOW = 6;
  const baselineArmValues = valid
    .slice(0, LOW_ROM_BASELINE_WINDOW)
    .map((f) => f.derived.armElevationAvg)
    .filter((v): v is number => typeof v === 'number');
  const baselineArmDeg = baselineArmValues.length > 0 ? mean(baselineArmValues) : 0;

  // PR-02: compute rise truth (baseline-relative elevation travel) for this accumulated session.
  // Must come before evaluateOverheadCompletionState which now consumes meaningfulRiseSatisfied.
  const riseTruth = computeOverheadRiseTruth({ validFrames: valid, baselineArmDeg });
  // effectiveRaiseCount gates easy/lowRom/humane paths: if meaningful rise not established,
  // force raiseCount=0 so those paths' own `raiseCount===0` guard also blocks them.
  const effectiveRaiseCount = riseTruth.meaningfulRiseSatisfied ? Math.max(raiseCount, 1) : 0;

  const lowRomZoneFrames = valid
    .filter(
      (f) =>
        typeof f.derived.armElevationAvg === 'number' &&
        f.derived.armElevationAvg >= OVERHEAD_LOW_ROM_ABSOLUTE_FLOOR_DEG
    )
    .map((f) => ({ timestampMs: f.timestampMs }));
  const peakCountAtLowRomFloor = lowRomZoneFrames.length;

  // PR-CAM-16: humane low-ROM 준비 — low-ROM floor(110°) 미달 사용자용
  // baseline: 초기 16프레임의 최솟값 (lower-envelope) — 사용자가 약간 팔을 올린 채로
  // 시작해도 가장 낮은 초기 포지션을 baseline으로 사용해 delta 계산이 더 관대해진다.
  const HUMANE_BASELINE_WINDOW = 16;
  const humaneBaselineValues = valid
    .slice(0, HUMANE_BASELINE_WINDOW)
    .map((f) => f.derived.armElevationAvg)
    .filter((v): v is number => typeof v === 'number');
  const humaneBaselineArmDeg =
    humaneBaselineValues.length > 0 ? Math.min(...humaneBaselineValues) : 0;

  const humaneZoneFrames = valid
    .filter(
      (f) =>
        typeof f.derived.armElevationAvg === 'number' &&
        f.derived.armElevationAvg >= OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG
    )
    .map((f) => ({ timestampMs: f.timestampMs }));
  const peakCountAtHumaneFloor = humaneZoneFrames.length;

  // PR-CAM-11A: jitter-tolerant fallback 계산 (strict 경로 보완용)
  const fallbackTopHold = computeOverheadTopHoldFallback({
    topZoneFrames,
    raiseCount,
    peakCount,
    effectiveArmDeg: peakArmForCompletion,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  });

  const overheadCompletion = evaluateOverheadCompletionState({
    raiseCount,
    peakCount,
    peakArmElevationDeg: peakArmForCompletion,
    armRangeAvgDeg,
    holdDurationMs,
    topDetectedAtMs: dwellResult.topDetectedAtMs,
    stableTopEnteredAtMs: dwellResult.stableTopEnteredAtMs,
    holdArmedAtMs: dwellResult.holdArmedAtMs,
    holdAccumulationStartedAtMs: dwellResult.holdAccumulationStartedAtMs,
    holdArmingBlockedReason: dwellResult.holdArmingBlockedReason,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
    fallbackTopHold,
    meaningfulRiseSatisfied: riseTruth.meaningfulRiseSatisfied,
    riseStartedAtMs: riseTruth.riseStartedAtMs,
  });

  // PR-CAM-11B: 진행 전용 easy 홀드 (해석·overheadPlanning 은 strict dwell 기준 유지)
  const easyProgression = computeOverheadEasyProgressionHold({
    easyTopZoneFrames,
    raiseCount: effectiveRaiseCount,
    peakCountAtEasyFloor,
    effectiveArmDeg: peakArmForCompletion,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  });

  // PR-CAM-15: low-ROM 진행 경로 (easy floor 미달 사용자 — 개인 baseline 대비 실질적 거상 + 짧은 안정)
  const lowRomProgression = computeOverheadLowRomProgression({
    lowRomZoneFrames,
    raiseCount: effectiveRaiseCount,
    peakCountAtLowRomFloor,
    effectiveArmDeg: peakArmForCompletion,
    baselineArmDeg,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  });

  // PR-CAM-16: humane low-ROM 진행 경로 (low-ROM floor 미달 사용자 — lower-envelope baseline + 완화된 임계)
  const humaneLowRomProgression = computeOverheadHumaneLowRomProgression({
    humaneZoneFrames,
    raiseCount: effectiveRaiseCount,
    peakCountAtHumaneFloor,
    effectiveArmDeg: peakArmForCompletion,
    humaneBaselineArmDeg,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  });

  const strictMotionCompletionSatisfied = overheadCompletion.completionSatisfied;
  const progressionCompletionSatisfied =
    strictMotionCompletionSatisfied ||
    easyProgression.easyCompletionSatisfied ||
    lowRomProgression.lowRomProgressionSatisfied ||
    humaneLowRomProgression.humaneLowRomProgressionSatisfied;

  let progressionCompletionPath:
    | 'strict'
    | 'fallback'
    | 'easy'
    | 'low_rom'
    | 'humane_low_rom'
    | 'not_confirmed';
  if (strictMotionCompletionSatisfied) {
    progressionCompletionPath =
      overheadCompletion.completionPath === 'fallback' ? 'fallback' : 'strict';
  } else if (easyProgression.easyCompletionSatisfied) {
    progressionCompletionPath = 'easy';
  } else if (lowRomProgression.lowRomProgressionSatisfied) {
    progressionCompletionPath = 'low_rom';
  } else if (humaneLowRomProgression.humaneLowRomProgressionSatisfied) {
    progressionCompletionPath = 'humane_low_rom';
  } else {
    progressionCompletionPath = 'not_confirmed';
  }

  // PR-CAM-13/15/16: 진행 전용 blocked reason — raw 데이터 기반, 접근성 높은 경로 우선 결정.
  const progressionBlockedReason: string | null = (() => {
    if (progressionCompletionSatisfied) return null;
    // Level 1: raise 동작 자체가 없음
    if (raiseCount === 0) return 'easy_raise_incomplete';
    // Level 2: easy top zone(>= 126°) 미달
    if (easyTopZoneFrames.length === 0) {
      if (lowRomZoneFrames.length > 0) {
        // low-ROM zone(>= 110°)에 진입 — low-ROM 차단 이유 우선 보고
        const lowRomBlocked = lowRomProgression.lowRomBlockedReason;
        if (lowRomBlocked === 'low_rom_hold_short') return 'low_rom_hold_short';
        if (lowRomBlocked === 'low_rom_frames_too_few') return 'low_rom_hold_short';
        if (lowRomBlocked === 'asymmetry_unacceptable') return 'asymmetry_unacceptable';
        if (lowRomBlocked != null) return 'easy_top_not_reached';
      } else if (humaneZoneFrames.length > 0) {
        // PR-CAM-16: humane zone(>= 100°)에 진입 — humane 차단 이유 보고
        const humaneBlocked = humaneLowRomProgression.humaneLowRomBlockedReason;
        if (humaneBlocked === 'humane_hold_short') return 'humane_hold_short';
        if (humaneBlocked === 'humane_frames_too_few') return 'humane_hold_short';
        if (humaneBlocked === 'asymmetry_unacceptable') return 'asymmetry_unacceptable';
        if (humaneBlocked != null) return 'easy_top_not_reached';
      } else {
        // 100° 미만 — 높이 자체가 부족
        return 'easy_top_not_reached';
      }
    }
    // Level 3: easy top zone 진입 후 차단 사유
    const easyBlocked = easyProgression.easyCompletionBlockedReason;
    if (easyBlocked === 'easy_hold_short') return 'easy_hold_short';
    if (easyBlocked === 'asymmetry_unacceptable') return 'asymmetry_unacceptable';
    if (easyBlocked != null) return 'easy_top_not_reached';
    // strict 머신 차단 사유로 fallback
    return overheadCompletion.completionBlockedReason;
  })();

  // PR-CAM-13/15/16: 진행 전용 phase (접근성 높은 경로 우선, strict top-unstable fallback)
  const progressionPhase: OverheadProgressionState['progressionPhase'] = (() => {
    if (progressionCompletionSatisfied) return 'completed';
    if (raiseCount === 0) return 'idle';
    // PR-CAM-15: low-ROM zone 진입 (easy zone 미달) — low-ROM 단계 우선 보고
    if (easyTopZoneFrames.length === 0 && lowRomZoneFrames.length > 0) {
      if (
        lowRomProgression.lowRomBlockedReason === 'low_rom_hold_short' &&
        lowRomProgression.lowRomBestRunMs > 0
      ) {
        return 'low_rom_building_hold';
      }
      return 'low_rom_top';
    }
    // PR-CAM-16: humane zone 진입 (easy·low-ROM 미달) — humane 단계 보고
    if (
      easyTopZoneFrames.length === 0 &&
      lowRomZoneFrames.length === 0 &&
      humaneZoneFrames.length > 0
    ) {
      if (
        humaneLowRomProgression.humaneLowRomBlockedReason === 'humane_hold_short' &&
        humaneLowRomProgression.humaneLowRomBestRunMs > 0
      ) {
        return 'humane_building_hold';
      }
      return 'humane_top';
    }
    // Easy zone 진입
    if (easyTopZoneFrames.length > 0) {
      if (
        easyProgression.easyCompletionBlockedReason === 'easy_hold_short' &&
        easyProgression.easyBestRunMs > 0
      ) {
        return 'easy_building_hold';
      }
      return 'easy_top';
    }
    if (overheadCompletion.completionMachinePhase === 'top_unstable') return 'strict_top_unstable';
    return 'raising';
  })();

  // PR-CAM-13/15/16: typed progression state (squat-style 소유권 분리 + humane_low_rom 추가)
  const overheadProgressionState: OverheadProgressionState = {
    progressionSatisfied: progressionCompletionSatisfied,
    progressionPath: progressionCompletionPath === 'not_confirmed' ? 'none' : progressionCompletionPath,
    progressionBlockedReason,
    progressionPhase,
    easyCompletionSatisfied: easyProgression.easyCompletionSatisfied,
    easyCompletionBlockedReason: easyProgression.easyCompletionBlockedReason,
    easyBestRunMs: easyProgression.easyBestRunMs,
    easyPeakCountAtFloor: peakCountAtEasyFloor,
    /** PR-CAM-15: low-ROM 경로 */
    lowRomProgressionSatisfied: lowRomProgression.lowRomProgressionSatisfied,
    lowRomBlockedReason: lowRomProgression.lowRomBlockedReason,
    lowRomBestRunMs: lowRomProgression.lowRomBestRunMs,
    lowRomElevationDeltaFromBaseline: lowRomProgression.lowRomElevationDeltaFromBaseline,
    /** PR-CAM-16: humane low-ROM 경로 */
    humaneLowRomProgressionSatisfied: humaneLowRomProgression.humaneLowRomProgressionSatisfied,
    humaneLowRomBlockedReason: humaneLowRomProgression.humaneLowRomBlockedReason,
    humaneLowRomBestRunMs: humaneLowRomProgression.humaneLowRomBestRunMs,
    humaneLowRomPeakElevation: humaneLowRomProgression.humaneLowRomPeakElevation,
    humaneLowRomBaselineElevation: humaneLowRomProgression.humaneLowRomBaselineElevation,
    humaneLowRomElevationDeltaFromBaseline:
      humaneLowRomProgression.humaneLowRomElevationDeltaFromBaseline,
    strictMotionCompletionSatisfied,
    strictCompletionBlockedReason: overheadCompletion.completionBlockedReason,
    strictCompletionMachinePhase: overheadCompletion.completionMachinePhase,
    /**
     * PR-CAM-17: easy/low_rom/humane 중 하나만으로 progression이 충족됐고
     * strict 경로는 실패했을 때 true — isFinalPassLatched가 완화 임계(0.58)를 쓰도록 신호.
     */
    requiresEasyFinalPassThreshold:
      progressionCompletionSatisfied && !strictMotionCompletionSatisfied,
  };

  if (!progressionCompletionSatisfied) {
    if (overheadCompletion.completionBlockedReason === 'hold_short') {
      completionHints.push('top_hold_short');
    } else {
      completionHints.push('raise_peak_incomplete');
    }
  } else {
    interpretedSignals.push('raise-peak cycle detected');
  }

  if (armElevationAvgValues.length > 0) {
    const avg = mean(armElevationAvgValues);
    const peak = Math.max(...armElevationAvgValues);
    metrics.push({
      name: 'arm_range',
      value: Math.round(avg * 10) / 10,
      unit: 'deg',
      trend: peak >= 150 ? 'good' : peak >= 125 ? 'neutral' : 'concern',
    });
  }

  if (torsoExtensionDeviation.length > 0) {
    const avgDeviation = mean(torsoExtensionDeviation);
    metrics.push({
      name: 'lumbar_extension',
      value: Math.round(avgDeviation * 10) / 10,
      unit: 'deg',
      trend: avgDeviation < 16 ? 'good' : avgDeviation < 26 ? 'neutral' : 'concern',
    });
  }

  if (armElevationGapValues.length > 0) {
    const asym = mean(armElevationGapValues);
    metrics.push({
      name: 'asymmetry',
      value: Math.round(asym * 10) / 10,
      unit: 'deg',
      trend: asym < 14 ? 'good' : asym < 24 ? 'neutral' : 'concern',
    });
  }

  if (elbowAngles.length > 0) {
    rawMetrics.push({
      name: 'elbow_extension_proxy',
      value: Math.round(mean(elbowAngles) * 10) / 10,
      unit: 'deg',
      trend: mean(elbowAngles) >= 145 ? 'good' : mean(elbowAngles) >= 128 ? 'neutral' : 'concern',
    });
  }

  rawMetrics.push({
    name: 'hold_duration',
    value: holdDurationMs,
    unit: 'ms',
    trend:
      holdDurationMs >= OVERHEAD_REQUIRED_HOLD_MS
        ? 'good'
        : holdDurationMs >= 1000
          ? 'neutral'
          : 'concern',
  });

  const perStepDiagnostics = getOverheadPerStepDiagnostics(valid, metrics.length);
  const perStepRecord: Record<string, (typeof perStepDiagnostics)['raise']> = {
    raise: perStepDiagnostics.raise,
    hold: perStepDiagnostics.hold,
  };

  const lumbarTrend = metrics.find((m) => m.name === 'lumbar_extension')?.trend;
  const asymTrend = metrics.find((m) => m.name === 'asymmetry')?.trend;
  const peakArmForPlanning =
    armElevationAvgValues.length > 0 ? Math.max(...armElevationAvgValues) : null;

  const overheadPlanning = computeOverheadPlanningEvidenceLevel({
    holdDurationMs,
    stableTopDwellMs: dwellResult.stableTopDwellMs,
    stableTopSegmentCount: dwellResult.stableTopSegmentCount,
    peakArmElevation: peakArmForPlanning,
    raiseCount,
    peakCount,
    holdArmingBlockedReason: dwellResult.holdArmingBlockedReason,
    lumbarTrend,
    asymTrend,
  });

  const unstableHintHits = qualityHints.filter((h) =>
    ['unstable_bbox', 'unstable_landmarks', 'timestamp_gap'].includes(h)
  ).length;
  const signalIntegrityMultiplier = Math.max(0.55, 1 - unstableHintHits * 0.14);

  /** PR-COMP-04: completion과 무관한 strict 내부 해석 */
  const overheadInternalQuality = computeOverheadInternalQuality({
    peakArmElevationDeg: peakArmForCompletion,
    meanAsymmetryDeg,
    lumbarExtensionDeviationDeg:
      torsoExtensionDeviation.length > 0 ? mean(torsoExtensionDeviation) : null,
    holdDurationMs,
    stableTopDwellMs: dwellResult.stableTopDwellMs,
    stableTopSegmentCount: dwellResult.stableTopSegmentCount,
    dwellCoherent: overheadPlanning.dwellCoherent,
    validFrameRatio: frames.length > 0 ? valid.length / frames.length : 0,
    signalIntegrityMultiplier,
    raiseCount,
    peakCount,
  });

  return {
    stepId: 'overhead-reach',
    metrics,
    insufficientSignal: false,
    rawMetrics,
    interpretedSignals,
    qualityHints,
    completionHints,
    debug: {
      frameCount: frames.length,
      validFrameCount: valid.length,
      phaseHints: Array.from(new Set(valid.map((frame) => frame.phaseHint))),
      /** PR-CAM-03: normalize가 step별로 weakest 병합 */
      overheadEvidenceLevel: overheadPlanning.level,
      overheadEvidenceReasons: overheadPlanning.reasons,
      overheadInternalQuality,
      /** PR-CAM-13: typed progression state — retry·voice·UI가 progression truth를 타입 안전하게 읽는다 */
      overheadProgressionState,
      highlightedMetrics: {
        raiseCount,
        peakCount,
        holdDurationMs,
        topDetectedAtMs: dwellResult.topDetectedAtMs,
        topEntryAtMs: topEntryAtMs ?? undefined,
        stableTopEntryAtMs: stableTopEntryAtMs ?? undefined,
        holdArmedAtMs: dwellResult.holdArmedAtMs,
        holdAccumulationStartedAtMs: dwellResult.holdAccumulationStartedAtMs,
        holdAccumulationMs: holdDurationMs,
        holdSatisfiedAtMs,
        holdArmingBlockedReason: dwellResult.holdArmingBlockedReason,
        peakArmElevation:
          armElevationAvgValues.length > 0 ? Math.round(Math.max(...armElevationAvgValues)) : null,
        /** PR overhead-dwell: trace fields */
        stableTopEnteredAtMs: dwellResult.stableTopEnteredAtMs,
        stableTopExitedAtMs: dwellResult.stableTopExitedAtMs,
        stableTopDwellMs: dwellResult.stableTopDwellMs,
        stableTopSegmentCount: dwellResult.stableTopSegmentCount,
        holdComputationMode: dwellResult.holdComputationMode,
        holdDurationMsLegacySpan: dwellResult.holdDurationMsLegacySpan,
        dwellHoldDurationMs: dwellResult.holdDurationMs,
        legacyHoldDurationMs: dwellResult.holdDurationMsLegacySpan,
        /** PR-CAM-03: 기기 트레이스 — dwell 일관성·planning 등급 */
        cam03DwellCoherent: overheadPlanning.dwellCoherent ? 1 : 0,
        cam03OverheadPlanningLevel: overheadPlanning.level,
        /** PR-COMP-04: strict 모션 completion (strict+fallback) — 해석·플래닝 기준 */
        strictMotionCompletionSatisfied: strictMotionCompletionSatisfied ? 1 : 0,
        /** PR-CAM-11B: 진행 게이트 truth = strict | easy */
        completionSatisfied: progressionCompletionSatisfied,
        completionBlockedReason: overheadCompletion.completionBlockedReason,
        completionMachinePhase: overheadCompletion.completionMachinePhase,
        completionPassReason: overheadCompletion.completionPassReason,
        topDetected: overheadCompletion.topDetected ? 1 : 0,
        stableTopEntry: overheadCompletion.stableTopEntry ? 1 : 0,
        holdStarted: overheadCompletion.holdStarted ? 1 : 0,
        holdSatisfied: overheadCompletion.holdSatisfied ? 1 : 0,
        passLatchedCandidate: progressionCompletionSatisfied ? 1 : 0,
        overheadTopDetected: overheadCompletion.topDetected ? 1 : 0,
        /** PR-CAM-11B: 진행 경로 (strict|fallback|easy|not_confirmed) */
        completionPath: progressionCompletionPath,
        strictMotionCompletionPath: overheadCompletion.completionPath,
        /** PR-CAM-11B: easy 진행 전용 */
        easyCompletionSatisfied: easyProgression.easyCompletionSatisfied ? 1 : 0,
        easyCompletionBlockedReason: easyProgression.easyCompletionBlockedReason,
        easyBestRunMs: easyProgression.easyBestRunMs,
        easyBestRunFrameCount: easyProgression.easyBestRunFrameCount,
        peakCountAtEasyFloor,
        easyTopZoneFrameCount: easyTopZoneFrames.length,
        /** PR-CAM-15: low-ROM 진행 전용 */
        lowRomProgressionSatisfied: lowRomProgression.lowRomProgressionSatisfied ? 1 : 0,
        lowRomBlockedReason: lowRomProgression.lowRomBlockedReason,
        lowRomBestRunMs: lowRomProgression.lowRomBestRunMs,
        lowRomElevationDeltaFromBaseline: lowRomProgression.lowRomElevationDeltaFromBaseline,
        lowRomBestElevation: lowRomProgression.lowRomBestElevation,
        lowRomZoneFrameCount: lowRomZoneFrames.length,
        peakCountAtLowRomFloor,
        baselineArmDeg,
        /** PR-CAM-16: humane low-ROM 진행 전용 */
        humaneLowRomProgressionSatisfied:
          humaneLowRomProgression.humaneLowRomProgressionSatisfied ? 1 : 0,
        humaneLowRomBlockedReason: humaneLowRomProgression.humaneLowRomBlockedReason,
        humaneLowRomBestRunMs: humaneLowRomProgression.humaneLowRomBestRunMs,
        humaneLowRomPeakElevation: humaneLowRomProgression.humaneLowRomPeakElevation,
        humaneLowRomBaselineElevation: humaneLowRomProgression.humaneLowRomBaselineElevation,
        humaneLowRomElevationDeltaFromBaseline:
          humaneLowRomProgression.humaneLowRomElevationDeltaFromBaseline,
        humaneZoneFrameCount: humaneZoneFrames.length,
        peakCountAtHumaneFloor,
        humaneBaselineArmDeg,
        /** PR-CAM-11A: fallback top-hold 경로 트레이스 */
        fallbackTopHoldSatisfied: overheadCompletion.fallbackTopHoldSatisfied ? 1 : 0,
        fallbackTopHoldBestRunMs: fallbackTopHold.bestTopRunMs,
        fallbackTopHoldBestRunFrames: fallbackTopHold.bestTopRunFrameCount,
        fallbackTopHoldEligible: fallbackTopHold.fallbackEligible ? 1 : 0,
        fallbackTopHoldBlockedReason: fallbackTopHold.fallbackBlockedReason,
        topZoneFrameCount: topZoneFrames.length,
        /** PR-02: rise truth owner — baseline-relative arm travel */
        meaningfulRiseSatisfied: riseTruth.meaningfulRiseSatisfied ? 1 : 0,
        riseStartedAtMs: riseTruth.riseStartedAtMs,
        riseElevationDeltaFromBaseline: riseTruth.riseElevationDeltaFromBaseline,
        riseBaselineArmDeg: riseTruth.baselineArmDeg,
        risePeakArmElevation: riseTruth.peakArmElevation,
        riseBlockedReason: riseTruth.riseBlockedReason,
      },
      perStepDiagnostics: perStepRecord,
    },
  };
}

export function evaluateOverheadReach(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateOverheadReachFromPoseFrames(buildPoseFeaturesFrames('overhead-reach', landmarks));
}
