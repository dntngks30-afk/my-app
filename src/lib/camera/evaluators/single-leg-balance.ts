/**
 * 한발 서기 evaluator
 * metrics: hold stability, sway, pelvic drop, left/right gap
 */
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult, EvaluatorMetric } from './types';

const MIN_VALID_FRAMES = 8;

export function evaluateSingleLegBalance(landmarks: PoseLandmarks[]): EvaluatorResult {
  const valid = landmarks.filter((l) => l.landmarks?.length >= 33);
  if (valid.length < MIN_VALID_FRAMES) {
    return {
      stepId: 'single-leg-balance',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
    };
  }

  const metrics: EvaluatorMetric[] = [];
  const hipHeights: number[] = [];
  const shoulderHeights: number[] = [];
  const noseX: number[] = [];
  const hipMidX: number[] = [];

  for (const frame of valid) {
    const lm = frame.landmarks;
    const lHip = lm[POSE_LANDMARKS.LEFT_HIP];
    const rHip = lm[POSE_LANDMARKS.RIGHT_HIP];
    const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
    const nose = lm[POSE_LANDMARKS.NOSE];

    if (lHip && rHip) {
      hipHeights.push((lHip.y + rHip.y) / 2);
      hipMidX.push((lHip.x + rHip.x) / 2);
    }
    if (lShoulder && rShoulder) {
      shoulderHeights.push((lShoulder.y + rShoulder.y) / 2);
    }
    if (nose) noseX.push(nose.x);
  }

  if (hipHeights.length >= 2) {
    const sway = Math.max(...hipHeights) - Math.min(...hipHeights);
    metrics.push({ name: 'sway', value: sway, trend: sway < 0.05 ? 'good' : sway < 0.1 ? 'neutral' : 'concern' });
  }
  if (noseX.length >= 2) {
    const swayX = Math.max(...noseX) - Math.min(...noseX);
    metrics.push({ name: 'hold_stability', value: 1 - swayX, trend: swayX < 0.03 ? 'good' : swayX < 0.08 ? 'neutral' : 'concern' });
  }
  if (hipHeights.length > 0 && shoulderHeights.length > 0) {
    const hipAvg = hipHeights.reduce((a, b) => a + b, 0) / hipHeights.length;
    const shoulderAvg = shoulderHeights.reduce((a, b) => a + b, 0) / shoulderHeights.length;
    const pelvicDrop = Math.abs(hipAvg - shoulderAvg);
    metrics.push({ name: 'pelvic_drop', value: pelvicDrop, trend: pelvicDrop < 0.05 ? 'good' : 'concern' });
  }
  if (hipMidX.length >= 2) {
    const leftFrames = valid.filter((_, i) => i < valid.length / 2);
    const rightFrames = valid.filter((_, i) => i >= valid.length / 2);
    const leftHipX = leftFrames.flatMap((f) => {
      const lm = f.landmarks;
      const lHip = lm[POSE_LANDMARKS.LEFT_HIP];
      return lHip ? [lHip.x] : [];
    });
    const rightHipX = rightFrames.flatMap((f) => {
      const lm = f.landmarks;
      const rHip = lm[POSE_LANDMARKS.RIGHT_HIP];
      return rHip ? [rHip.x] : [];
    });
    const leftAvg = leftHipX.length ? leftHipX.reduce((a, b) => a + b, 0) / leftHipX.length : 0;
    const rightAvg = rightHipX.length ? rightHipX.reduce((a, b) => a + b, 0) / rightHipX.length : 0;
    const gap = Math.abs(leftAvg - rightAvg);
    metrics.push({ name: 'left_right_gap', value: gap, trend: gap < 0.05 ? 'good' : 'neutral' });
  }

  return {
    stepId: 'single-leg-balance',
    metrics,
    insufficientSignal: false,
  };
}
