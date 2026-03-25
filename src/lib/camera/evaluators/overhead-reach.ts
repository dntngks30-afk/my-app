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
import type { EvaluatorResult, EvaluatorMetric } from './types';

const MIN_VALID_FRAMES = 8;

/** evaluator/guardrails 공용 상수 — delta/degree는 이번 PR에서 변경하지 않음 */
export const OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG = 132;
export const OVERHEAD_STABLE_TOP_DELTA_DEG = 2.6;
export const OVERHEAD_STABLE_TOP_CONSECUTIVE = 3;

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
  floorDeg = OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG,
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
  const REQUIRED_PASS_HOLD_MS = 1200;
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
        highlightedMetrics: { validFrameCount: valid.length },
        perStepDiagnostics: { raise: emptyDiag, hold: emptyDiag },
        overheadEvidenceLevel: 'insufficient_signal',
        overheadEvidenceReasons: ['valid_frames_too_few'],
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
        e < OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG ||
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
      f.derived.armElevationAvg >= OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG
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
    holdDurationMs >= 1200 && dwellResult.holdArmedAtMs !== undefined
      ? dwellResult.holdArmedAtMs + 1200
      : undefined;

  if (raiseCount === 0 || peakCount === 0) {
    completionHints.push('raise_peak_incomplete');
  } else {
    interpretedSignals.push('raise-peak cycle detected');
  }

  /** Product: explicit top-hold window ~1–2s. Hold starts only after true top entry. */
  const REQUIRED_TOP_HOLD_MS = 1200;
  if (holdDurationMs < REQUIRED_TOP_HOLD_MS) {
    completionHints.push('top_hold_short');
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
    trend: holdDurationMs >= 1200 ? 'good' : holdDurationMs >= 1000 ? 'neutral' : 'concern',
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
      },
      perStepDiagnostics: perStepRecord,
    },
  };
}

export function evaluateOverheadReach(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateOverheadReachFromPoseFrames(buildPoseFeaturesFrames('overhead-reach', landmarks));
}
