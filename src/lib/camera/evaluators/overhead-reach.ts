/**
 * 오버헤드 리치 evaluator
 * metrics: arm range, trunk compensation, asymmetry, top hold
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { buildPoseFeaturesFrames } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import { getOverheadPerStepDiagnostics } from '@/lib/camera/step-joint-spec';
import type { EvaluatorResult, EvaluatorMetric } from './types';

const MIN_VALID_FRAMES = 8;

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
  const peakCount = peakFrames.length;
  const holdDurationMs =
    peakFrames.length > 1
      ? peakFrames[peakFrames.length - 1]!.timestampMs - peakFrames[0]!.timestampMs
      : 0;

  if (raiseCount === 0 || peakCount === 0) {
    completionHints.push('raise_peak_incomplete');
  } else {
    interpretedSignals.push('raise-peak cycle detected');
  }

  if (holdDurationMs < 700) {
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
    trend: holdDurationMs >= 900 ? 'good' : holdDurationMs >= 700 ? 'neutral' : 'concern',
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
        peakArmElevation:
          armElevationAvgValues.length > 0 ? Math.round(Math.max(...armElevationAvgValues)) : null,
      },
      perStepDiagnostics: perStepRecord,
    },
  };
}

export function evaluateOverheadReach(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateOverheadReachFromPoseFrames(buildPoseFeaturesFrames('overhead-reach', landmarks));
}
