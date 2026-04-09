import type { ExerciseGateResult } from '../auto-progression';
import { isFinalPassLatched } from '../auto-progression';
import { CAMERA_DIAG_VERSION } from '../camera-success-diagnostic';
import { buildDiagnosisSummary } from './camera-trace-diagnosis-summary';
import {
  buildSquatCameraObservabilityExport,
  buildTopReasons,
} from './camera-trace-observation-builders';
import type { CameraStepId } from '@/lib/public/camera-test';
import type {
  AttemptSnapshot,
  RecordAttemptOptions,
  TraceMovementType,
  TraceOutcome,
} from '../camera-trace';

const DEBUG_VERSION = 'pr4-2';

function stepIdToMovementType(stepId: CameraStepId): TraceMovementType | null {
  if (stepId === 'squat') return 'squat';
  if (stepId === 'overhead-reach') return 'overhead_reach';
  return null;
}

function gateToOutcome(gate: ExerciseGateResult): TraceOutcome {
  if (gate.status === 'pass' && gate.progressionState === 'passed') return 'ok';
  if (gate.progressionState === 'failed') return 'failed';
  if (gate.progressionState === 'insufficient_signal') return 'invalid';
  if (gate.progressionState === 'retry_required') return 'retry_required';
  if (gate.status === 'retry' && gate.retryRecommended) return 'retry_optional';
  if (gate.guardrail.captureQuality === 'invalid') return 'invalid';
  if (gate.guardrail.captureQuality === 'low') return 'low';
  return 'retry_optional';
}

function extractStabilitySummary(gate: ExerciseGateResult): AttemptSnapshot['stabilitySummary'] {
  const d = gate.guardrail.debug;
  if (!d) return undefined;
  return {
    warmupExcludedFrameCount: d.warmupExcludedFrameCount,
    qualityFrameCount: d.qualityFrameCount,
    selectedWindowStartMs: d.selectedWindowStartMs ?? undefined,
    selectedWindowEndMs: d.selectedWindowEndMs ?? undefined,
    selectedWindowScore: d.selectedWindowScore ?? undefined,
  };
}

function extractPerStepSummary(gate: ExerciseGateResult): Record<string, unknown> | undefined {
  const diag = gate.evaluatorResult?.debug?.perStepDiagnostics;
  const guardrailDiag = gate.guardrail.debug?.perStepDiagnostics;
  if (!diag && !guardrailDiag) return undefined;
  return {
    ...(diag ?? {}),
    ...(guardrailDiag ?? {}),
  } as Record<string, unknown>;
}

export function buildTraceAttemptSnapshot(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context?: AttemptSnapshot['readinessSummary'],
  options?: RecordAttemptOptions
): AttemptSnapshot | null {
  const movementType = stepIdToMovementType(stepId);
  if (!movementType) return null;

  const outcome = gateToOutcome(gate);
  const finalPassLatched = isFinalPassLatched(stepId, gate);
  const progressionPassed =
    gate.status === 'pass' &&
    gate.completionSatisfied &&
    gate.guardrail.captureQuality !== 'invalid';

  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    movementType,
    outcome,
    captureQuality: gate.guardrail.captureQuality,
    confidence: gate.confidence,
    motionCompleteness: gate.guardrail.completionStatus ?? 'unknown',
    progressionPassed,
    finalPassLatched,
    fallbackType: gate.guardrail.fallbackMode,
    flags: [...(gate.flags ?? []), ...(gate.guardrail.flags ?? [])].filter(
      (f, i, arr) => arr.indexOf(f) === i
    ),
    topReasons: buildTopReasons(gate),
    perStepSummary: extractPerStepSummary(gate),
    readinessSummary: context,
    stabilitySummary: extractStabilitySummary(gate),
    diagnosisSummary: buildDiagnosisSummary(stepId, gate, context, options),
    squatCameraObservability: buildSquatCameraObservabilityExport(gate),
    debugVersion: `${DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}
