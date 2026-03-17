import type { CameraGuideTone } from './auto-progression';
import type { StepGuardrailResult } from './guardrails';

export type LiveReadinessState = 'not_ready' | 'ready' | 'success';

export interface LiveReadinessInput {
  success: boolean;
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags' | 'debug'>;
}

const MIN_READY_VALID_FRAMES = 4;
const MIN_READY_VISIBLE_JOINTS_RATIO = 0.45;
const MIN_READY_CRITICAL_AVAILABILITY = 0.4;
const MIN_READY_SIDE_COMPLETENESS = 0.55;

export function getLiveReadinessState(input: LiveReadinessInput): LiveReadinessState {
  if (input.success) {
    return 'success';
  }

  const { guardrail } = input;
  const {
    validFrameCount,
    visibleJointsRatio,
    criticalJointsAvailability,
    leftSideCompleteness,
    rightSideCompleteness,
  } = guardrail.debug;

  const hasSevereFramingFailure =
    guardrail.captureQuality === 'invalid' ||
    guardrail.flags.includes('framing_invalid') ||
    guardrail.flags.includes('hard_partial') ||
    guardrail.flags.includes('left_side_missing') ||
    guardrail.flags.includes('right_side_missing');

  if (
    hasSevereFramingFailure ||
    validFrameCount < MIN_READY_VALID_FRAMES ||
    visibleJointsRatio < MIN_READY_VISIBLE_JOINTS_RATIO ||
    criticalJointsAvailability < MIN_READY_CRITICAL_AVAILABILITY ||
    leftSideCompleteness < MIN_READY_SIDE_COMPLETENESS ||
    rightSideCompleteness < MIN_READY_SIDE_COMPLETENESS
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
