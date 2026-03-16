/**
 * 벽 천사 evaluator
 * metrics: arm range, compensation, lumbar extension, asymmetry
 */
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult, EvaluatorMetric } from './types';

const MIN_VALID_FRAMES = 8;

function angle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  return Math.abs((rad * 180) / Math.PI);
}

export function evaluateWallAngel(landmarks: PoseLandmarks[]): EvaluatorResult {
  const valid = landmarks.filter((l) => l.landmarks?.length >= 33);
  if (valid.length < MIN_VALID_FRAMES) {
    return {
      stepId: 'wall-angel',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
    };
  }

  const metrics: EvaluatorMetric[] = [];
  const armRanges: number[] = [];
  const lumbarExtensions: number[] = [];
  const leftRanges: number[] = [];
  const rightRanges: number[] = [];

  for (const frame of valid) {
    const lm = frame.landmarks;
    const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lElbow = lm[POSE_LANDMARKS.LEFT_ELBOW];
    const rElbow = lm[POSE_LANDMARKS.RIGHT_ELBOW];
    const lWrist = lm[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist = lm[POSE_LANDMARKS.RIGHT_WRIST];
    const lHip = lm[POSE_LANDMARKS.LEFT_HIP];
    const rHip = lm[POSE_LANDMARKS.RIGHT_HIP];

    if (lShoulder && lElbow && lWrist) {
      const range = angle(lShoulder, lElbow, lWrist);
      leftRanges.push(range);
      armRanges.push(range);
    }
    if (rShoulder && rElbow && rWrist) {
      const range = angle(rShoulder, rElbow, rWrist);
      rightRanges.push(range);
      armRanges.push(range);
    }
    if (lShoulder && rShoulder && lHip && rHip) {
      const shoulderMid = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
      const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
      lumbarExtensions.push(Math.atan2(hipMid.y - shoulderMid.y, hipMid.x - shoulderMid.x) * (180 / Math.PI));
    }
  }

  if (armRanges.length > 0) {
    const avg = armRanges.reduce((a, b) => a + b, 0) / armRanges.length;
    metrics.push({ name: 'arm_range', value: avg, unit: 'deg', trend: avg >= 150 ? 'good' : avg >= 120 ? 'neutral' : 'concern' });
  }
  if (lumbarExtensions.length > 0) {
    const avg = lumbarExtensions.reduce((a, b) => a + b, 0) / lumbarExtensions.length;
    metrics.push({ name: 'lumbar_extension', value: avg, unit: 'deg', trend: Math.abs(avg - 90) < 20 ? 'good' : 'concern' });
  }
  if (leftRanges.length > 0 && rightRanges.length > 0) {
    const leftAvg = leftRanges.reduce((a, b) => a + b, 0) / leftRanges.length;
    const rightAvg = rightRanges.reduce((a, b) => a + b, 0) / rightRanges.length;
    const asym = Math.abs(leftAvg - rightAvg);
    metrics.push({ name: 'asymmetry', value: asym, unit: 'deg', trend: asym < 15 ? 'good' : asym < 30 ? 'neutral' : 'concern' });
  }

  return {
    stepId: 'wall-angel',
    metrics,
    insufficientSignal: false,
  };
}
