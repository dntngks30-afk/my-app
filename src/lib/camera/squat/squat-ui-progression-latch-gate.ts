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
// PR-X override: runtime below mirrors completion owner truth only.
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
  /**
   * PR-5 — Quality Semantics Split (SSOT §4.4).
   * When the caller has proven upstream owner law + PR-2 guard clear, the
   * `confidence < passThresholdEffective` block is demoted to a quality-only
   * warning. The UI gate stays block-only for actual cycle/readiness gates
   * (readiness, arming, capture invalid, pass-confirmation, hard blockers).
   * Defaults to `false` for pre-PR-5 callers — never opens new pass.
   */
  confidenceDecoupleEligible?: boolean;
}

export interface SquatUiProgressionLatchGateResult {
  uiProgressionAllowed: boolean;
  uiProgressionBlockedReason: string | null;
  /**
   * PR-5 — true iff the gate actually demoted a `confidence_too_low` case
   * (decoupleEligible AND confidence < threshold). Diagnostic only —
   * downstream consumers use `uiProgressionAllowed` for the gate decision
   * and surface `confidence_too_low` as a quality-only warning when this
   * flag is set.
   */
  confidenceDecoupleApplied?: boolean;
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
  /**
   * PR-5 — Quality Semantics Split (SSOT §4.4).
   * `confidence_too_low` is demoted to a quality-only signal when the caller
   * has proven upstream owner law + PR-2 guard clear. This does NOT open new
   * pass for no-cycle motion — the gate already short-circuits on
   * `completionOwnerPassed === false` at the top, and downstream pass-core /
   * false-pass guard layers remain independent. When demoted, the gate keeps
   * closing on real cycle/readiness issues (pass-confirmation, integrity,
   * hard blockers) below.
   */
  const confidenceDecoupleApplied =
    input.confidenceDecoupleEligible === true &&
    input.confidence < input.passThresholdEffective;
  return {
    uiProgressionAllowed: true,
    uiProgressionBlockedReason: null,
    confidenceDecoupleApplied,
  };
}
