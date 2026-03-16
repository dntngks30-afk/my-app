/**
 * Evaluator 출력 타입
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';

export interface EvaluatorMetric {
  name: string;
  value: number;
  unit?: string;
  trend?: 'good' | 'neutral' | 'concern';
}

export interface EvaluatorResult {
  stepId: string;
  metrics: EvaluatorMetric[];
  insufficientSignal: boolean;
  reason?: string;
}

export type EvaluatorFn = (
  landmarks: PoseLandmarks[]
) => EvaluatorResult;
