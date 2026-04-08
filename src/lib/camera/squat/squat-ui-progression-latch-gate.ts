export interface SquatUiProgressionLatchGateInput {
  completionOwnerPassed: boolean;
  guardrailCompletionComplete: boolean;
  captureQualityInvalid: boolean;
  confidence: number;
  passThresholdEffective: number;
  effectivePassConfirmation: boolean;
  passConfirmationFrameCount: number;
  framesReq: number;
  /** PR-CAM-29A + PR-01: 캡처 최소 시간(arming) 충족 — latch/UI 전용 */
  captureArmingSatisfied: boolean;
  squatIntegrityBlockForPass: string | null;
  reasons: string[];
  hardBlockerReasons: string[];
  /** Setup false-pass lock: live readiness RED 이면 latch 금지 */
  liveReadinessNotReady?: boolean;
  /** evaluator 가 명시 false 일 때만 차단(undefined 는 레거시 스킵) */
  readinessStableDwellSatisfied?: boolean;
  /** completion state 가 setupMotionBlocked true 일 때 차단 */
  setupMotionBlocked?: boolean;
}

export interface SquatUiProgressionLatchGateResult {
  uiProgressionAllowed: boolean;
  uiProgressionBlockedReason: string | null;
}

/**
 * PR-01: UI progression / final latch gate — completion owner 와 분리.
 * captureQuality·confidence·passConfirmation·integrity·hard blockers 만 사용한다.
 * 스모크에서 owner 통과 + UI 차단 조합을 검증할 때 export 사용.
 */
export function computeSquatUiProgressionLatchGate(
  input: SquatUiProgressionLatchGateInput
): SquatUiProgressionLatchGateResult {
  if (!input.completionOwnerPassed) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'completion_owner_not_satisfied' };
  }
  if (input.liveReadinessNotReady === true) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'live_readiness_not_ready' };
  }
  if (input.readinessStableDwellSatisfied === false) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'readiness_stable_dwell_not_met' };
  }
  if (input.setupMotionBlocked === true) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'setup_motion_blocked' };
  }
  if (input.captureArmingSatisfied !== true) {
    return {
      uiProgressionAllowed: false,
      uiProgressionBlockedReason: 'minimum_cycle_duration_not_met',
    };
  }
  if (input.guardrailCompletionComplete !== true) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'guardrail_not_complete' };
  }
  if (input.captureQualityInvalid) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'capture_quality_invalid' };
  }
  if (input.confidence < input.passThresholdEffective) {
    return {
      uiProgressionAllowed: false,
      uiProgressionBlockedReason: `confidence_too_low:${input.confidence.toFixed(2)}<${input.passThresholdEffective.toFixed(2)}`,
    };
  }
  if (!input.effectivePassConfirmation) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'pass_confirmation_not_ready' };
  }
  if (input.passConfirmationFrameCount < input.framesReq) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'pass_confirmation_frames_not_met' };
  }
  if (input.squatIntegrityBlockForPass != null) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: input.squatIntegrityBlockForPass };
  }
  const blocker = input.hardBlockerReasons.find((r) => input.reasons.includes(r));
  if (blocker) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: `hard_blocker:${blocker}` };
  }
  return { uiProgressionAllowed: true, uiProgressionBlockedReason: null };
}
