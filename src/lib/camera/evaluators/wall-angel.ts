/**
 * 벽 천사 evaluator
 * metrics: arm range, compensation, lumbar extension, asymmetry
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { buildPoseFeaturesFrames } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
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

export function evaluateWallAngelFromPoseFrames(frames: PoseFeaturesFrame[]): EvaluatorResult {
  const valid = frames.filter((frame) => frame.isValid);
  if (valid.length < MIN_VALID_FRAMES) {
    return {
      stepId: 'wall-angel',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['raise_lower_cycle_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: valid.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        highlightedMetrics: {
          validFrameCount: valid.length,
        },
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
  const elbowAngles = getNumbers(
    valid.flatMap((frame) => [frame.derived.elbowAngleLeft, frame.derived.elbowAngleRight])
  );
  const torsoExtensionDeviation = getNumbers(valid.map((frame) => frame.derived.torsoExtensionDeg)).map((value) =>
    Math.abs(value - 90)
  );
  const wristElbowAlignmentValues = getNumbers(
    valid.flatMap((frame) => [
      frame.derived.wristElbowAlignmentLeft,
      frame.derived.wristElbowAlignmentRight,
    ])
  );
  const raiseCount = countPhases(valid, 'raise');
  const peakCount = countPhases(valid, 'peak');
  const lowerCount = countPhases(valid, 'lower');

  if (raiseCount === 0 || peakCount === 0 || lowerCount === 0) {
    completionHints.push('raise_peak_lower_incomplete');
  } else {
    interpretedSignals.push('raise-peak-lower cycle detected');
  }

  if (armElevationAvgValues.length > 0) {
    const avg = mean(armElevationAvgValues);
    const peak = Math.max(...armElevationAvgValues);
    metrics.push({
      name: 'arm_range',
      value: Math.round(avg * 10) / 10,
      unit: 'deg',
      trend: peak >= 145 ? 'good' : peak >= 120 ? 'neutral' : 'concern',
    });
  }

  if (torsoExtensionDeviation.length > 0) {
    const avgDeviation = mean(torsoExtensionDeviation);
    metrics.push({
      name: 'lumbar_extension',
      value: Math.round(avgDeviation * 10) / 10,
      unit: 'deg',
      trend: avgDeviation < 14 ? 'good' : avgDeviation < 24 ? 'neutral' : 'concern',
    });
  }

  if (armElevationGapValues.length > 0) {
    const asym = mean(armElevationGapValues);
    metrics.push({
      name: 'asymmetry',
      value: Math.round(asym * 10) / 10,
      unit: 'deg',
      trend: asym < 15 ? 'good' : asym < 28 ? 'neutral' : 'concern',
    });
  }

  if (elbowAngles.length > 0) {
    rawMetrics.push({
      name: 'elbow_extension_proxy',
      value: Math.round(mean(elbowAngles) * 10) / 10,
      unit: 'deg',
      trend: mean(elbowAngles) >= 145 ? 'good' : mean(elbowAngles) >= 125 ? 'neutral' : 'concern',
    });
  }

  if (wristElbowAlignmentValues.length > 0) {
    rawMetrics.push({
      name: 'wrist_elbow_alignment',
      value: Math.round(mean(wristElbowAlignmentValues) * 1000) / 1000,
      trend:
        mean(wristElbowAlignmentValues) < 0.04
          ? 'good'
          : mean(wristElbowAlignmentValues) < 0.07
            ? 'neutral'
            : 'concern',
    });
  }

  return {
    stepId: 'wall-angel',
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
        lowerCount,
        peakArmElevation:
          armElevationAvgValues.length > 0 ? Math.round(Math.max(...armElevationAvgValues)) : null,
      },
    },
  };
}

export function evaluateWallAngel(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateWallAngelFromPoseFrames(buildPoseFeaturesFrames('wall-angel', landmarks));
}
