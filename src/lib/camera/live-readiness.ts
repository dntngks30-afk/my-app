import type { CameraGuideTone } from './auto-progression';
import type { StepGuardrailResult } from './guardrails';

export type LiveReadinessState = 'not_ready' | 'ready' | 'success';

export interface LiveReadinessInput {
  success: boolean;
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags' | 'debug'>;
  framingHint?: string | null;
}

const MIN_READY_VALID_FRAMES = 2;
const MIN_READY_VISIBLE_JOINTS_RATIO = 0.35;
const MIN_READY_CRITICAL_AVAILABILITY = 0.3;

export function getLiveReadinessState(input: LiveReadinessInput): LiveReadinessState {
  if (input.success) {
    return 'success';
  }

  const { guardrail, framingHint } = input;
  const {
    validFrameCount,
    visibleJointsRatio,
    criticalJointsAvailability,
  } = guardrail.debug;

  if (
    framingHint ||
    validFrameCount < MIN_READY_VALID_FRAMES ||
    visibleJointsRatio < MIN_READY_VISIBLE_JOINTS_RATIO ||
    criticalJointsAvailability < MIN_READY_CRITICAL_AVAILABILITY
  ) {
    return 'not_ready';
  }

  return 'ready';
}

export function getGuideToneFromLiveReadiness(
  readiness: LiveReadinessState
): CameraGuideTone {
  if (readiness === 'success') return 'success';
  if (readiness === 'ready') return 'neutral';
  return 'warning';
}
