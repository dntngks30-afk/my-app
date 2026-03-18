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
  stableTopEnteredAtMs: number | undefined;
  stableTopExitedAtMs: number | undefined;
  stableTopDwellMs: number;
  stableTopSegmentCount: number;
  holdComputationMode: 'dwell';
  /** trace: legacy first~last peak span (비교용) */
  holdDurationMsLegacySpan: number;
}

/** timestamp gap > 이 값이면 segment break — 프레임 누락 시 누적 불가 */
const MAX_DWELL_DELTA_MS = 120;

/**
 * 연속 stable-top dwell time 계산.
 * stable top: elevation >= floor, |delta| < deltaMax.
 * 3연속 진입 후 구간 시작, 깨지면 reset. 최장 구간 dwell = hold.
 *
 * PR fix: hold = frame-to-frame delta 누적만. segment span 대신 실제 연속 프레임 시간만 합산.
 * timestamp gap > MAX_DWELL_DELTA_MS 이면 segment break.
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

  let stableStreak = 0;
  let segmentStartMs: number | null = null;
  let segmentDwellMs = 0;
  let prevStableTimestampMs: number | null = null;
  let bestDwellMs = 0;
  let bestEnteredMs: number | undefined;
  let bestExitedMs: number | undefined;
  let segmentCount = 0;

  for (let i = 0; i < valid.length; i++) {
    const f = valid[i]!;
    const e = f.derived.armElevationAvg;
    const prev = i > 0 ? valid[i - 1]!.derived.armElevationAvg : null;
    const delta = typeof e === 'number' && typeof prev === 'number' ? e - prev : 0;
    const isStable =
      typeof e === 'number' && e >= floorDeg && Math.abs(delta) < deltaMax;

    const timestampDeltaMs =
      prevStableTimestampMs !== null ? f.timestampMs - prevStableTimestampMs : 0;

    if (isStable) {
      stableStreak += 1;
      if (stableStreak >= consecutive && segmentStartMs === null) {
        segmentStartMs = f.timestampMs;
        segmentDwellMs = 0;
        prevStableTimestampMs = f.timestampMs;
        segmentCount += 1;
      }
      if (segmentStartMs !== null) {
        if (timestampDeltaMs > MAX_DWELL_DELTA_MS) {
          segmentStartMs = f.timestampMs;
          segmentDwellMs = 0;
          prevStableTimestampMs = f.timestampMs;
          segmentCount += 1;
        } else {
          segmentDwellMs += timestampDeltaMs;
          prevStableTimestampMs = f.timestampMs;
          if (segmentDwellMs > bestDwellMs) {
            bestDwellMs = segmentDwellMs;
            bestEnteredMs = segmentStartMs;
            bestExitedMs = f.timestampMs;
          }
        }
      }
    } else {
      stableStreak = 0;
      segmentStartMs = null;
      segmentDwellMs = 0;
      prevStableTimestampMs = null;
    }
  }

  return {
    holdDurationMs: bestDwellMs,
    stableTopEnteredAtMs: bestEnteredMs,
    stableTopExitedAtMs: bestExitedMs,
    stableTopDwellMs: bestDwellMs,
    stableTopSegmentCount: segmentCount,
    holdComputationMode: 'dwell',
    holdDurationMsLegacySpan: legacySpan,
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

  const topConfirmedPeaks =
    stableTopEntryIndex >= 0
      ? peakFrames.filter((f) => valid.indexOf(f) >= stableTopEntryIndex)
      : [];
  const peakCount = topConfirmedPeaks.length;

  /** PR overhead-dwell: 연속 stable-top dwell time. peak span 아님. */
  const dwellResult = computeOverheadStableTopDwell(valid);
  const holdDurationMs = dwellResult.holdDurationMs;
  const stableTopEntryAtMs =
    stableTopEntryIndex >= 0 && valid[stableTopEntryIndex]
      ? valid[stableTopEntryIndex]!.timestampMs
      : 0;
  const topEntryAtMs = stableTopEntryAtMs;
  const holdSatisfiedAtMs =
    holdDurationMs >= 1200 && dwellResult.stableTopEnteredAtMs !== undefined
      ? dwellResult.stableTopEnteredAtMs + 1200
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
      highlightedMetrics: {
        raiseCount,
        peakCount,
        holdDurationMs,
        topEntryAtMs,
        stableTopEntryAtMs: stableTopEntryAtMs || undefined,
        holdAccumulationMs: holdDurationMs,
        holdSatisfiedAtMs,
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
      },
      perStepDiagnostics: perStepRecord,
    },
  };
}

export function evaluateOverheadReach(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateOverheadReachFromPoseFrames(buildPoseFeaturesFrames('overhead-reach', landmarks));
}
