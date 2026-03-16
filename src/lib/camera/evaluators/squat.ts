/**
 * 스쿼트 evaluator
 * metrics: depth, knee alignment trend, trunk lean, asymmetry
 */
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult, EvaluatorMetric } from './types';

const MIN_VALID_FRAMES = 8;

function angle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  return Math.abs((rad * 180) / Math.PI);
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  const valid = landmarks.filter((l) => l.landmarks?.length >= 33);
  if (valid.length < MIN_VALID_FRAMES) {
    return {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: valid.length < MIN_VALID_FRAMES ? '프레임 부족' : undefined,
    };
  }

  const metrics: EvaluatorMetric[] = [];
  const depths: number[] = [];
  const kneeAlignments: number[] = [];
  const trunkLeans: number[] = [];

  for (const frame of valid) {
    const lm = frame.landmarks;
    const lHip = lm[POSE_LANDMARKS.LEFT_HIP];
    const rHip = lm[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = lm[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = lm[POSE_LANDMARKS.RIGHT_ANKLE];
    const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];

    if (lHip && rHip && lKnee && rKnee && lAnkle && rAnkle) {
      const hipKneeAngleL = angle(lHip, lKnee, lAnkle);
      const hipKneeAngleR = angle(rHip, rKnee, rAnkle);
      depths.push((hipKneeAngleL + hipKneeAngleR) / 2);
    }
    if (lHip && rHip && lKnee && rKnee) {
      const kneeWidth = Math.abs(lKnee.x - rKnee.x);
      const hipWidth = Math.abs(lHip.x - rHip.x);
      kneeAlignments.push(hipWidth > 0 ? kneeWidth / hipWidth : 1);
    }
    if (lShoulder && rShoulder && lHip && rHip) {
      const shoulderMid = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
      const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
      trunkLeans.push(Math.atan2(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y) * (180 / Math.PI));
    }
  }

  if (depths.length > 0) {
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    const maxDepth = Math.max(...depths);
    metrics.push({ name: 'depth', value: avgDepth, unit: 'deg', trend: maxDepth >= 80 ? 'good' : maxDepth >= 60 ? 'neutral' : 'concern' });
  }
  if (kneeAlignments.length > 0) {
    const avg = kneeAlignments.reduce((a, b) => a + b, 0) / kneeAlignments.length;
    metrics.push({ name: 'knee_alignment_trend', value: avg, trend: avg > 0.9 && avg < 1.1 ? 'good' : 'concern' });
  }
  if (trunkLeans.length > 0) {
    const avg = trunkLeans.reduce((a, b) => a + b, 0) / trunkLeans.length;
    metrics.push({ name: 'trunk_lean', value: avg, unit: 'deg', trend: Math.abs(avg) < 15 ? 'good' : 'concern' });
  }
  if (depths.length >= 2) {
    const leftDepths = valid.map((f) => {
      const lm = f.landmarks;
      const lHip = lm[POSE_LANDMARKS.LEFT_HIP];
      const lKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
      const lAnkle = lm[POSE_LANDMARKS.LEFT_ANKLE];
      return lHip && lKnee && lAnkle ? angle(lHip, lKnee, lAnkle) : 0;
    }).filter(Boolean);
    const rightDepths = valid.map((f) => {
      const lm = f.landmarks;
      const rHip = lm[POSE_LANDMARKS.RIGHT_HIP];
      const rKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];
      const rAnkle = lm[POSE_LANDMARKS.RIGHT_ANKLE];
      return rHip && rKnee && rAnkle ? angle(rHip, rKnee, rAnkle) : 0;
    }).filter(Boolean);
    const asym = leftDepths.length && rightDepths.length
      ? Math.abs(leftDepths.reduce((a, b) => a + b, 0) / leftDepths.length - rightDepths.reduce((a, b) => a + b, 0) / rightDepths.length)
      : 0;
    metrics.push({ name: 'asymmetry', value: asym, unit: 'deg', trend: asym < 10 ? 'good' : asym < 20 ? 'neutral' : 'concern' });
  }

  return {
    stepId: 'squat',
    metrics,
    insufficientSignal: false,
  };
}
