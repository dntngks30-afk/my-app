/**
 * Squat UI progression latch gate — **non-opener consumer layer**.
 *
 * Authority-law position (PR-01 + PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION):
 * this gate is one of the block-only consumer layers in the single
 * opener law
 *   `completionTruthPassed && completionOwnerPassed && UI gate clear
 *    && P3 block-only registry clear => finalPassGranted`.
 *
 * The sole opener is `completionOwnerPassed`, computed upstream by
 * `readSquatPassOwnerTruth` and passed in here as
 * `SquatUiProgressionLatchGateInput.completionOwnerPassed`. This gate:
 *   - can only close the UI progression surface (block-only);
 *   - never opens pass, never rewrites any completion-state field, and
 *     never acts as an alternate owner;
 *   - surfaces class-specific blocked reasons for UI-layer concerns
 *     (live readiness, setup motion, arming, confidence, guardrail,
 *     pass confirmation, integrity, hard blockers).
 *
 * Final-pass latch (`isFinalPassLatched`) and the post-owner final-pass
 * veto (`applySquatFinalBlockerVetoLayer` → `evaluateSquatAbsurdPassRegistry`)
 * are downstream consumers of this gate and are likewise non-openers.
 */
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
  /** Official shallow owner freeze: downstream UI/final surfaces are sink-only readers. */
  officialShallowOwnerFrozen?: boolean;
}

export interface SquatUiProgressionLatchGateResult {
  uiProgressionAllowed: boolean;
  uiProgressionBlockedReason: string | null;
}

/**
 * PR-01 + PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION: UI progression / final
 * latch gate — **block-only consumer**, decoupled from completion-owner
 * truth. Reads `completionOwnerPassed` as a precondition only (the
 * opener is computed upstream by `readSquatPassOwnerTruth`) and then
 * applies pure UI-layer closers: live readiness, setup motion, arming,
 * guardrail completeness, captureQuality, confidence, passConfirmation,
 * squat integrity, hard blockers.
 *
 * Exported so smokes can exercise the (owner-passed + UI-blocked)
 * combinations directly. This function cannot open final pass.
 */
export function computeSquatUiProgressionLatchGate(
  input: SquatUiProgressionLatchGateInput
): SquatUiProgressionLatchGateResult {
  if (!input.completionOwnerPassed) {
    return { uiProgressionAllowed: false, uiProgressionBlockedReason: 'completion_owner_not_satisfied' };
  }
  if (input.officialShallowOwnerFrozen === true) {
    return { uiProgressionAllowed: true, uiProgressionBlockedReason: null };
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
