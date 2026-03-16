/**
 * 한발 서기 evaluator
 * metrics: hold stability, sway, pelvic drop, left/right gap
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

export function evaluateSingleLegBalanceFromPoseFrames(
  frames: PoseFeaturesFrame[]
): EvaluatorResult {
  const valid = frames.filter((frame) => frame.isValid);
  if (valid.length < MIN_VALID_FRAMES) {
    return {
      stepId: 'single-leg-balance',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['hold_missing'],
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

  const holdFrames = valid.filter(
    (frame) => frame.phaseHint === 'hold_start' || frame.phaseHint === 'hold_ongoing'
  );
  const swayValues = getNumbers(valid.map((frame) => frame.derived.swayAmplitude));
  const holdBalanceValues = getNumbers(valid.map((frame) => frame.derived.holdBalance));
  const pelvicDropValues = getNumbers(valid.map((frame) => frame.derived.pelvicDrop));
  const footHeightGapValues = getNumbers(valid.map((frame) => frame.derived.footHeightGap));
  const torsoCorrectionCount = valid.filter((frame) => frame.derived.torsoCorrectionDetected).length;
  const holdStartCount = countPhases(valid, 'hold_start');
  const holdOngoingCount = countPhases(valid, 'hold_ongoing');
  const breakCount = countPhases(valid, 'break');

  if (holdFrames.length === 0) {
    completionHints.push('hold_not_detected');
  } else {
    interpretedSignals.push('hold segment detected');
  }

  if (swayValues.length > 0) {
    const sway = Math.max(...swayValues);
    metrics.push({
      name: 'sway',
      value: Math.round(sway * 1000) / 1000,
      trend: sway < 0.03 ? 'good' : sway < 0.06 ? 'neutral' : 'concern',
    });
  }

  if (holdBalanceValues.length > 0) {
    const avgHoldBalance = mean(holdBalanceValues);
    metrics.push({
      name: 'hold_stability',
      value: Math.round(avgHoldBalance * 100),
      unit: '%',
      trend: avgHoldBalance >= 0.8 ? 'good' : avgHoldBalance >= 0.65 ? 'neutral' : 'concern',
    });
  }

  if (pelvicDropValues.length > 0) {
    const pelvicDrop = mean(pelvicDropValues);
    metrics.push({
      name: 'pelvic_drop',
      value: Math.round(pelvicDrop * 1000) / 1000,
      trend: pelvicDrop < 0.03 ? 'good' : pelvicDrop < 0.055 ? 'neutral' : 'concern',
    });
  }

  if (footHeightGapValues.length > 0) {
    const firstHalf = footHeightGapValues.slice(0, Math.floor(footHeightGapValues.length / 2));
    const secondHalf = footHeightGapValues.slice(Math.floor(footHeightGapValues.length / 2));
    const leftRightGap = Math.abs(mean(firstHalf) - mean(secondHalf));
    metrics.push({
      name: 'left_right_gap',
      value: Math.round(leftRightGap * 1000) / 1000,
      trend: leftRightGap < 0.03 ? 'good' : leftRightGap < 0.06 ? 'neutral' : 'concern',
    });
  }

  if (holdFrames.length > 1) {
    const holdDurationMs =
      holdFrames[holdFrames.length - 1]!.timestampMs - holdFrames[0]!.timestampMs;
    rawMetrics.push({
      name: 'hold_duration',
      value: Math.round(holdDurationMs),
      unit: 'ms',
      trend: holdDurationMs >= 8000 ? 'good' : holdDurationMs >= 5000 ? 'neutral' : 'concern',
    });
  }

  rawMetrics.push({
    name: 'torso_correction_frequency',
    value: torsoCorrectionCount,
    trend: torsoCorrectionCount <= 3 ? 'good' : torsoCorrectionCount <= 7 ? 'neutral' : 'concern',
  });

  if (breakCount > 0) {
    completionHints.push('hold_break_detected');
  }

  return {
    stepId: 'single-leg-balance',
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
        holdStartCount,
        holdOngoingCount,
        breakCount,
        torsoCorrectionCount,
      },
    },
  };
}

export function evaluateSingleLegBalance(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateSingleLegBalanceFromPoseFrames(
    buildPoseFeaturesFrames('single-leg-balance', landmarks)
  );
}
