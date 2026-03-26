/**
 * Evaluator 출력 타입
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseFeaturesFrame, PosePhaseHint } from '@/lib/camera/pose-features';
import type { PerStepDiagnostic } from '@/lib/camera/step-joint-spec';
import type { SquatInternalQuality } from '@/lib/camera/squat/squat-internal-quality';
import type { OverheadInternalQuality } from '@/lib/camera/overhead/overhead-internal-quality';
import type { CompletionArmingState } from '@/lib/camera/squat/squat-completion-arming';
import type { SquatCompletionState } from '@/lib/camera/squat-completion-state';

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
  /** PR-HOTFIX-02: 스쿼트 completion 평가 무장(서 있기 안정 후에만 평가) */
  squatCompletionArming?: CompletionArmingState;
  /**
   * PR-CAM-09: 스쿼트 completion 상태 전체(typed).
   * highlightedMetrics 의 개별 필드와 동일 데이터를 타입 안전하게 노출한다.
   * auto-progression 이 highlightedMetrics 캐스팅 없이 직접 읽을 수 있다.
   */
  squatCompletionState?: SquatCompletionState;
  /**
   * PR-CAM-13: 오버헤드 진행 상태 전체(typed) — squat-style 소유권 분리.
   * - progressionSatisfied: 진행 gate truth (strict | fallback | easy 통합).
   * - progressionBlockedReason / progressionPhase: 사용자 대면 retry·hold cue 진입점.
   * - strict 필드는 별도 보존; planning / internal quality 는 strict dwell 기준 유지.
   * - highlightedMetrics.completionSatisfied 하위 호환 유지.
   */
  overheadProgressionState?: OverheadProgressionState;
}

/**
 * PR-CAM-13: 오버헤드 진행 상태 typed interface.
 * evaluators/types.ts 에 정의해 circular import 없이 overhead-reach.ts · consumers 가 공유.
 */
export interface OverheadProgressionState {
  progressionSatisfied: boolean;
  progressionPath: 'strict' | 'fallback' | 'easy' | 'none';
  /** 진행 관점 차단 사유 — easy-facing 우선, strict fallback. retry·hold cue 단일 진입점. */
  progressionBlockedReason: string | null;
  /** 진행 관점 단계 — 음성·retry·UI 상태 표현용. */
  progressionPhase: 'idle' | 'raising' | 'easy_top' | 'easy_building_hold' | 'strict_top_unstable' | 'completed';
  easyCompletionSatisfied: boolean;
  easyCompletionBlockedReason: string | null;
  easyBestRunMs: number;
  easyPeakCountAtFloor: number;
  /** strict completion 그대로 보존 — planning / internal quality 기준 유지 */
  strictMotionCompletionSatisfied: boolean;
  strictCompletionBlockedReason: string | null;
  strictCompletionMachinePhase: string | null;
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
