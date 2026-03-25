/**
 * Evaluator 출력 타입
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseFeaturesFrame, PosePhaseHint } from '@/lib/camera/pose-features';
import type { PerStepDiagnostic } from '@/lib/camera/step-joint-spec';
import type { SquatInternalQuality } from '@/lib/camera/squat/squat-internal-quality';
import type { OverheadInternalQuality } from '@/lib/camera/overhead/overhead-internal-quality';

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
  /** PR-CAM-03: 오버헤드 top-hold 품질 → normalize / planning tier 입력 */
  overheadEvidenceLevel?: string;
  overheadEvidenceReasons?: string[];
  cycleProofPassed?: boolean;
  romBand?: string;
  confidenceDowngradeReason?: string | null;
  insufficientSignalReason?: string | null;
  /** PR-COMP-03: completion과 무관한 strict 내부 해석 레이어 */
  squatInternalQuality?: SquatInternalQuality;
  /** PR-COMP-04: 오버헤드 내부 해석 레이어 */
  overheadInternalQuality?: OverheadInternalQuality;
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
