/**
 * Evaluator 출력 타입
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseFeaturesFrame, PosePhaseHint } from '@/lib/camera/pose-features';
import type { PerStepDiagnostic } from '@/lib/camera/step-joint-spec';

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
  /** PR-2: per-step 진단 (additive, backward-compatible) */
  perStepDiagnostics?: Record<string, PerStepDiagnostic>;
  /** PR evidence: squat completion과 분리된 evidence layer (result layer용) */
  squatEvidenceLevel?: string;
  squatEvidenceReasons?: string[];
  cycleProofPassed?: boolean;
  romBand?: string;
  confidenceDowngradeReason?: string | null;
  insufficientSignalReason?: string | null;
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
