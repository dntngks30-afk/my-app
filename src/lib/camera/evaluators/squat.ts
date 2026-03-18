/**
 * 스쿼트 evaluator
 * metrics: depth, knee alignment trend, trunk lean, asymmetry
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { buildPoseFeaturesFrames, getSquatRecoverySignal } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import { getSquatPerStepDiagnostics } from '@/lib/camera/step-joint-spec';
import type { EvaluatorResult, EvaluatorMetric } from './types';

const MIN_VALID_FRAMES = 8;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function getNumbers(values: Array<number | null>): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

function countPhases(frames: PoseFeaturesFrame[], phase: PoseFeaturesFrame['phaseHint']): number {
  return frames.filter((frame) => frame.phaseHint === phase).length;
}

export function evaluateSquatFromPoseFrames(frames: PoseFeaturesFrame[]): EvaluatorResult {
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
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['rep_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: valid.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        highlightedMetrics: { validFrameCount: valid.length },
        perStepDiagnostics: { descent: emptyDiag, bottom: emptyDiag, ascent: emptyDiag },
      },
    };
  }

  const metrics: EvaluatorMetric[] = [];
  const rawMetrics: EvaluatorMetric[] = [];
  const interpretedSignals: string[] = [];
  const qualityHints = [...new Set(valid.flatMap((frame) => frame.qualityHints))];
  const completionHints: string[] = [];
  const depthValues = getNumbers(valid.map((frame) => frame.derived.squatDepthProxy));
  const kneeTracking = getNumbers(valid.map((frame) => frame.derived.kneeTrackingRatio));
  const trunkLeanValues = getNumbers(valid.map((frame) => frame.derived.trunkLeanDeg)).map((value) =>
    Math.abs(value)
  );
  const asymmetryValues = getNumbers(valid.map((frame) => frame.derived.kneeAngleGap));
  const weightShiftValues = getNumbers(valid.map((frame) => frame.derived.weightShiftRatio));
  const bottomFrames = valid.filter((frame) => frame.phaseHint === 'bottom');
  const bottomDepths = getNumbers(bottomFrames.map((frame) => frame.derived.squatDepthProxy));

  const bottomStability =
    bottomDepths.length > 1
      ? clamp(1 - (Math.max(...bottomDepths) - Math.min(...bottomDepths)) / 0.2)
      : 0;
  const startCount = countPhases(valid, 'start');
  const descentCount = countPhases(valid, 'descent');
  const bottomCount = countPhases(valid, 'bottom');
  const ascentCount = countPhases(valid, 'ascent');
  const recovery = getSquatRecoverySignal(valid);
  const ascentSatisfied = ascentCount > 0 || recovery.recovered;
  /** PR G3: full cycle = start → descend → bottom → ascend → recovery */
  const cycleComplete =
    startCount > 0 &&
    descentCount > 0 &&
    bottomCount > 0 &&
    (ascentCount > 0 || recovery.recovered) &&
    recovery.recovered;
  /** PR G5: bottom-from-start 차단 — start가 bottom보다 먼저 나와야 함 (설치 자세 false positive 방지) */
  const firstStartIdx = valid.findIndex((f) => f.phaseHint === 'start');
  const firstBottomIdx = valid.findIndex((f) => f.phaseHint === 'bottom');
  const startBeforeBottom = firstStartIdx >= 0 && (firstBottomIdx < 0 || firstStartIdx < firstBottomIdx);
  const repCountEstimate = cycleComplete ? 1 : 0;

  /** PR-A4: cycle timing for trace — descendStartAt, reversalAt, ascendStartAt, recoveryAt, cycleDurationMs */
  const firstDescentIdx = valid.findIndex((f) => f.phaseHint === 'descent');
  const firstAscentIdx = valid.findIndex((f) => f.phaseHint === 'ascent');
  const descendStartAtMs = firstDescentIdx >= 0 ? valid[firstDescentIdx]!.timestampMs : 0;
  const ascendStartAtMs = firstAscentIdx >= 0 ? valid[firstAscentIdx]!.timestampMs : 0;
  const reversalAtMs =
    firstBottomIdx >= 0
      ? valid[firstBottomIdx]!.timestampMs
      : firstAscentIdx >= 0
        ? ascendStartAtMs
        : 0;
  const peakIdx =
    depthValues.length > 0
      ? valid.reduce((bestIdx, f, i) => {
          const d = f.derived.squatDepthProxy;
          if (typeof d !== 'number') return bestIdx;
          if (bestIdx < 0) return i;
          const bestD = valid[bestIdx]!.derived.squatDepthProxy;
          return typeof bestD === 'number' && d > bestD ? i : bestIdx;
        }, -1)
      : -1;
  const peakAtMs = peakIdx >= 0 ? valid[peakIdx]!.timestampMs : 0;
  const lastFrameMs = valid.length > 0 ? valid[valid.length - 1]!.timestampMs : 0;
  const recoveryAtMs = peakIdx >= 0 && valid.length > peakIdx + 3 ? lastFrameMs : 0;
  const cycleDurationMs =
    descendStartAtMs > 0 && recoveryAtMs > 0 ? recoveryAtMs - descendStartAtMs : 0;
  const prePeakDepths =
    peakIdx > 0
      ? valid
          .slice(0, peakIdx)
          .map((f) => f.derived.squatDepthProxy)
          .filter((d): d is number => typeof d === 'number')
      : [];
  const minPrePeakDepth = prePeakDepths.length > 0 ? Math.min(...prePeakDepths) : 0;
  const peakDepthVal = depthValues.length > 0 ? Math.max(...depthValues) : 0;
  const downwardCommitmentDelta = peakDepthVal - minPrePeakDepth;

  if (descentCount === 0 || bottomCount === 0 || !ascentSatisfied) {
    completionHints.push('rep_phase_incomplete');
  } else if (!recovery.recovered) {
    completionHints.push('recovery_not_confirmed');
  } else {
    interpretedSignals.push('descent-bottom-ascent-recovery pattern detected');
  }

  /** PR G6: depthBand — completion과 분리된 quality 해석. shallow(<35%), moderate(35-55%), deep(>=55%) */
  const depthBand =
    depthValues.length > 0
      ? (() => {
          const peakPct = Math.max(...depthValues) * 100;
          return peakPct >= 55 ? 2 : peakPct >= 35 ? 1 : 0;
        })()
      : 0;

  if (depthValues.length > 0) {
    const avgDepth = mean(depthValues) * 100;
    const peakDepth = Math.max(...depthValues) * 100;
    metrics.push({
      name: 'depth',
      value: Math.round(avgDepth),
      unit: '%',
      trend: peakDepth >= 68 ? 'good' : peakDepth >= 48 ? 'neutral' : 'concern',
    });
    rawMetrics.push({
      name: 'bottom_stability_proxy',
      value: Math.round(bottomStability * 100),
      unit: '%',
      trend: bottomStability >= 0.65 ? 'good' : bottomStability >= 0.45 ? 'neutral' : 'concern',
    });
  }

  if (kneeTracking.length > 0) {
    const avg = mean(kneeTracking);
    metrics.push({
      name: 'knee_alignment_trend',
      value: Math.round(avg * 100) / 100,
      trend: avg > 0.88 && avg < 1.12 ? 'good' : avg > 0.8 && avg < 1.2 ? 'neutral' : 'concern',
    });
  }

  if (trunkLeanValues.length > 0) {
    const avg = mean(trunkLeanValues);
    metrics.push({
      name: 'trunk_lean',
      value: Math.round(avg * 10) / 10,
      unit: 'deg',
      trend: avg < 15 ? 'good' : avg < 24 ? 'neutral' : 'concern',
    });
  }

  if (asymmetryValues.length > 0) {
    const asym = mean(asymmetryValues);
    metrics.push({
      name: 'asymmetry',
      value: Math.round(asym * 10) / 10,
      unit: 'deg',
      trend: asym < 10 ? 'good' : asym < 18 ? 'neutral' : 'concern',
    });
  }

  if (weightShiftValues.length > 0) {
    rawMetrics.push({
      name: 'left_right_weight_shift_proxy',
      value: Math.round(mean(weightShiftValues) * 100),
      unit: '%',
      trend: mean(weightShiftValues) < 0.22 ? 'good' : mean(weightShiftValues) < 0.35 ? 'neutral' : 'concern',
    });
  }

  const perStepDiagnostics = getSquatPerStepDiagnostics(valid, metrics.length);
  const perStepRecord: Record<string, typeof perStepDiagnostics.descent> = {
    descent: perStepDiagnostics.descent,
    bottom: perStepDiagnostics.bottom,
    ascent: perStepDiagnostics.ascent,
  };

  return {
    stepId: 'squat',
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
        depthPeak: depthValues.length > 0 ? Math.round(Math.max(...depthValues) * 100) : null,
        depthBand,
        bottomStability: Math.round(bottomStability * 100),
        startCount,
        descentCount,
        bottomCount,
        ascentCount,
        ascentRecovered: recovery.recovered ? 1 : 0,
        ascentRecoveredLowRom: recovery.lowRomRecovered ? 1 : 0,
        ascentRecoveredUltraLowRom: recovery.ultraLowRomRecovered ? 1 : 0,
        ascentRecoveredUltraLowRomGuarded: recovery.ultraLowRomGuardedRecovered ? 1 : 0,
        recoveryDrop: Math.round(recovery.recoveryDrop * 100),
        repCount: repCountEstimate,
        cycleComplete: cycleComplete ? 1 : 0,
        startBeforeBottom: startBeforeBottom ? 1 : 0,
        descendStartAtMs: descendStartAtMs || undefined,
        peakAtMs: peakAtMs || undefined,
        reversalAtMs: reversalAtMs || undefined,
        ascendStartAtMs: ascendStartAtMs || undefined,
        recoveryAtMs: recoveryAtMs || undefined,
        cycleDurationMs: cycleDurationMs || undefined,
        downwardCommitmentDelta: Math.round(downwardCommitmentDelta * 100) / 100,
      },
      perStepDiagnostics: perStepRecord,
    },
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateSquatFromPoseFrames(buildPoseFeaturesFrames('squat', landmarks));
}
