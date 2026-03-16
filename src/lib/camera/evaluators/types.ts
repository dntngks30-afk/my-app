/**
 * Evaluator 출력 타입
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseFeaturesFrame, PosePhaseHint } from '@/lib/camera/pose-features';

export interface EvaluatorMetric {
  name: string;
  value: number;
  unit?: string;
  trend?: 'good' | 'neutral' | 'concern';
}

export interface EvaluatorDebugSummary {
  frameCount: number;
  validFrameCount: number;
  phaseHints: PosePhaseHint[];
  highlightedMetrics: Record<string, number | string | boolean | null>;
}

export interface EvaluatorResult {
  stepId: string;
  metrics: EvaluatorMetric[];
  insufficientSignal: boolean;
  reason?: string;
  rawMetrics?: EvaluatorMetric[];
  interpretedSignals?: string[];
  qualityHints?: string[];
  completionHints?: string[];
  debug?: EvaluatorDebugSummary;
}

export type EvaluatorFn = (
  landmarks: PoseLandmarks[]
) => EvaluatorResult;

export type PoseFeatureEvaluatorFn = (frames: PoseFeaturesFrame[]) => EvaluatorResult;
