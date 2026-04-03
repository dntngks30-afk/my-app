/**
 * PR-CAM-CANONICAL-SHALLOW-CONTRACT-01 / PR-CAM-CANONICAL-SHALLOW-CLOSER-02
 * PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04
 *
 * Canonical shallow completion contract — **primary shallow truth derivation** (debug/observability SSOT).
 *
 * - Resolver (`deriveCanonicalShallowCompletionContract`)는 completion state 를 **mutate 하지 않는다** (pure derivation).
 * - Downstream `applyCanonicalShallowClosureFromContract` 만이 그 결과를 유일 writer input 으로
 *   `official_shallow_cycle` 을 연 수 있다 (PR-B).
 * - Legacy shallow observability (`shallowAuthoritativeClosure*`, PR-2 trace 등)와 병렬일 때
 *   **새 디버그/대시보드는 canonicalShallowContract* 를 1차로 읽는다** (PR-D).
 *
 * PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03:
 * - product policy 는 이 모듈 밖(evaluator boundary)에서만 적용한다.
 */

/** Must stay aligned with `STANDARD_OWNER_FLOOR` in squat-completion-state.ts (0.4). */
export const CANONICAL_SHALLOW_OWNER_FLOOR = 0.4;

export type CanonicalShallowCompletionContractStage =
  | 'pre_attempt'
  | 'admission_blocked'
  | 'attempt_blocked'
  | 'reversal_blocked'
  | 'recovery_blocked'
  | 'anti_false_pass_blocked'
  | 'closed';

export type CanonicalShallowCompletionContractBlockedReason =
  | 'not_in_shallow_zone'
  | 'not_armed'
  | 'no_descend'
  | 'no_commitment'
  | 'attempt_not_meaningful'
  | 'authoritative_reversal_missing'
  /**
   * PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY:
   * Timing integrity gate failed — descent or ascent/recovery span is too short.
   * bridge / proof / ascent-equivalent signals do NOT override timing integrity.
   * This blocks `official_shallow_cycle` even when reversal evidence is otherwise present.
   */
  | 'timing_integrity_blocked'
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Minimum cycle duration not satisfied — total cycle (descent start → standing recovered)
   * is shorter than the required floor. Proof/bridge cannot substitute for cycle timing.
   */
  | 'minimum_cycle_timing_blocked'
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Fresh-rep epoch integrity missing — baseline not frozen, peak not latched, or
   * freeze_or_latch_missing was the current completion blocker.
   * Pre-attempt / pre-freeze / pre-latch history must not be laundered into official close.
   */
  | 'rep_epoch_integrity_blocked'
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Weak-event pattern detected (eventCycleDetected=false + descent_weak + descentFrames=0)
   * and only bridge/proof reversal signals are present — not ownerAuthoritativeReversalSatisfied.
   * Bridge/proof are secondary signals; they cannot substitute for authoritative reversal
   * when the event cycle shows no real descent was detected.
   */
  | 'weak_event_proof_substitution_blocked'
  | 'recovery_or_finalize_missing'
  | 'setup_motion_blocked'
  | 'peak_series_start_contamination'
  | 'insufficient_signal'
  | 'policy_or_unknown'
  | null;

/**
 * PR-2-SHALLOW-CONTRACT-NORMALIZATION: Canonical shallow contract input.
 *
 * Fields are grouped into the five contract sections defined by SQUAT_REFACTOR_SSOT.md.
 * standard / low_rom / ultra_low_rom are ROM bands within the same contract (via evidenceLabel).
 * They share identical admission, reversal, recovery, and anti-false-pass sections.
 * The only band-specific behavior is in downstream finalize gates (handled via finalizeReason/band).
 *
 * Section 1 – ROM BAND CONTEXT
 *   relativeDepthPeak, evidenceLabel
 *
 * Section 2 – ADMISSION
 *   officialShallowPathCandidate, officialShallowPathAdmitted
 *   attemptStarted, descendConfirmed, downwardCommitmentReached
 *
 * Section 3 – REVERSAL EVIDENCE (authoritative OR provenance-assisted)
 *   ownerAuthoritativeReversalSatisfied (strict authoritative)
 *   officialShallowStreamBridgeApplied, officialShallowAscentEquivalentSatisfied,
 *   officialShallowClosureProofSatisfied, officialShallowPrimaryDropClosureFallback,
 *   guardedShallowTrajectoryClosureProofSatisfied (assisted / bridge paths)
 *   provenanceReversalEvidencePresent, trajectoryReversalRescueApplied,
 *   reversalTailBackfillApplied, ultraShallowMeaningfulDownUpRescueApplied (provenance only)
 *
 * Section 4 – RECOVERY EVIDENCE
 *   ownerAuthoritativeRecoverySatisfied, standingFinalizeSatisfied, standingRecoveryFinalizeReason
 *
 * Section 5 – ANTI-FALSE-PASS GUARD
 *   setupMotionBlocked, peakLatchedAtIndex
 *   (evidenceLabel === 'insufficient_signal' also blocks, shared with section 1)
 *
 * Alignment / split-brain context (not contract gates; observability inputs):
 *   currentSquatPhase, completionBlockedReason, officialShallowPathClosed, completionPassReason
 */
export interface CanonicalShallowCompletionContractInput {
  // ── Section 1: ROM BAND CONTEXT ──
  relativeDepthPeak: number;
  /** SquatShallowContractBand or 'insufficient_signal'. Determines eligibility zone + anti-false-pass. */
  evidenceLabel?: string;

  // ── Section 2: ADMISSION ──
  officialShallowPathCandidate: boolean;
  officialShallowPathAdmitted: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  downwardCommitmentReached: boolean;

  // ── Section 3: REVERSAL EVIDENCE ──
  /** Authoritative reversal: strict rule / HMM-assisted / stream bridge. */
  ownerAuthoritativeReversalSatisfied: boolean;
  /** Stream bridge reversal evidence (distinct channel from ownerAuthoritativeReversalSatisfied). */
  officialShallowStreamBridgeApplied: boolean;
  officialShallowAscentEquivalentSatisfied: boolean;
  officialShallowClosureProofSatisfied: boolean;
  officialShallowPrimaryDropClosureFallback: boolean;
  /** Guarded trajectory proof: reversal evidence contribution (PR-B). */
  guardedShallowTrajectoryClosureProofSatisfied?: boolean;
  /** Provenance-only signals: do not satisfy reversal alone, but indicate signal presence. */
  provenanceReversalEvidencePresent: boolean;
  trajectoryReversalRescueApplied?: boolean;
  reversalTailBackfillApplied?: boolean;
  ultraShallowMeaningfulDownUpRescueApplied?: boolean;

  // ── Section 4: RECOVERY EVIDENCE ──
  ownerAuthoritativeRecoverySatisfied: boolean;
  standingFinalizeSatisfied?: boolean;
  standingRecoveryFinalizeReason?: string | null;

  // ── Section 5: ANTI-FALSE-PASS GUARD ──
  /** setup motion during capture blocked: rejects contract regardless of reversal evidence. */
  setupMotionBlocked?: boolean;
  /** peak latched at series start (index=0): contamination guard. */
  peakLatchedAtIndex?: number | null;

  // ── Section 6: TIMING INTEGRITY (PR-8) ──
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Total cycle (descent start → standing recovered) meets minimum duration.
   * false → official_shallow_cycle cannot open regardless of proof/bridge signals.
   * undefined → gate is bypassed (cycle not yet complete or duration not computed).
   */
  minimumCycleDurationSatisfied?: boolean;

  // ── Section 7: FRESH-REP EPOCH INTEGRITY (PR-8) ──
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Baseline was frozen for the current rep (depthFreeze applied).
   * false → pre-attempt / pre-freeze epoch — official close blocked.
   * undefined → gate is bypassed (conservative — only block when explicitly false).
   */
  baselineFrozen?: boolean;
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Depth peak was latched for the current rep.
   * false → pre-latch epoch — official close blocked.
   * undefined → gate is bypassed (conservative — only block when explicitly false).
   */
  peakLatched?: boolean;

  // ── Section 8: WEAK-EVENT GATE (PR-8) ──
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * Whether the event cycle was detected at all.
   * false + eventCycleHasDescentWeak=true + eventCycleDescentFrames=0 → proof/bridge
   * cannot substitute for ownerAuthoritativeReversalSatisfied.
   */
  eventCycleDetected?: boolean;
  /** PR-8: event cycle notes include 'descent_weak' — weak descent quality indicator. */
  eventCycleHasDescentWeak?: boolean;
  /** PR-8: number of descent frames detected in event cycle. 0 = no real descent frames. */
  eventCycleDescentFrames?: number;
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: event cycle notes include 'freeze_or_latch_missing'.
   * detectSquatEventCycle adds this note when baseline was not frozen or peak was not latched
   * at event cycle evaluation time. Indicates a rep epoch integrity violation at the event level.
   * Official close must not proceed when the event cycle itself observed this condition.
   */
  eventCycleHasFreezeOrLatchMissing?: boolean;

  // ── Alignment / split-brain context (observability inputs, not contract gates) ──
  currentSquatPhase?: string;
  completionBlockedReason?: string | null;
  /** Runtime shallow path closed flag — used for split-brain detection (contract vs closer). */
  officialShallowPathClosed?: boolean;
  /** Current completion pass reason — split-brain detection (PR-B). */
  completionPassReason?: string;
}

export interface CanonicalShallowCompletionContract {
  eligible: boolean;
  admissionSatisfied: boolean;
  attemptSatisfied: boolean;
  /**
   * PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY: false when core timing blockers are present.
   * descent_span_too_short / ascent_recovery_span_too_short block the contract even if
   * reversal evidence (bridge/proof) signals are present.
   */
  timingIntegrityClear: boolean;
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * false when total cycle duration is below minimum floor (minimumCycleDurationSatisfied=false).
   * Proof/bridge signals cannot override timing floor failures.
   */
  minimumCycleTimingClear: boolean;
  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
   * false when baseline or peak epoch integrity is missing (baselineFrozen=false, peakLatched=false,
   * or freeze_or_latch_missing was the current completion blocker).
   */
  repEpochIntegrityClear: boolean;
  reversalEvidenceSatisfied: boolean;
  recoveryEvidenceSatisfied: boolean;
  antiFalsePassClear: boolean;

  satisfied: boolean;
  stage: CanonicalShallowCompletionContractStage;
  blockedReason: CanonicalShallowCompletionContractBlockedReason;

  authoritativeClosureWouldBeSatisfied: boolean;
  provenanceOnlySignalPresent: boolean;
  splitBrainDetected: boolean;

  /**
   * PR-B: canonical contract 가 satisfied 일 때 어떤 경로로 닫혔는지.
   * 'canonical_guarded_trajectory' — guarded trajectory proof 가 reversal evidence 에 기여.
   * 'canonical_authoritative' — authoritative 경로.
   * 'none' — not satisfied.
   */
  closureSource: 'none' | 'canonical_authoritative' | 'canonical_guarded_trajectory';
  /** PR-B: satisfied === true 이면 true — canonical closer 가 official_shallow_cycle 을 열 수 있음. */
  closureWouldWriteOfficialShallowCycle: boolean;

  trace: string;
}

function reversalEvidenceFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.ownerAuthoritativeReversalSatisfied === true ||
    input.officialShallowStreamBridgeApplied === true ||
    input.officialShallowAscentEquivalentSatisfied === true ||
    input.officialShallowClosureProofSatisfied === true ||
    input.officialShallowPrimaryDropClosureFallback === true ||
    input.guardedShallowTrajectoryClosureProofSatisfied === true
  );
}

function recoveryEvidenceFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.ownerAuthoritativeRecoverySatisfied === true ||
    input.standingFinalizeSatisfied === true
  );
}

function antiFalsePassFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.setupMotionBlocked !== true &&
    input.peakLatchedAtIndex !== 0 &&
    input.evidenceLabel !== 'insufficient_signal'
  );
}

/**
 * PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY: Timing integrity gate.
 *
 * Returns false when the core already determined timing was insufficient:
 * `descent_span_too_short` — descent-to-peak span below minimum for shallow band.
 * `ascent_recovery_span_too_short` — reversal-to-standing span below minimum for shallow band.
 *
 * These core-level timing blockers in `completionBlockedReason` must prevent the canonical
 * contract from being satisfied even when bridge / proof / ascent-equivalent reversal
 * evidence is present. Proof signals are the last step of integrity, not an override for it.
 *
 * Existing signal reuse only — no new numeric thresholds.
 */
function timingIntegrityClearFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  const br = input.completionBlockedReason ?? null;
  return br !== 'descent_span_too_short' && br !== 'ascent_recovery_span_too_short';
}

/**
 * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: Minimum cycle duration gate.
 *
 * Returns false when the total cycle duration is explicitly below the minimum floor.
 * `minimumCycleDurationSatisfied = false` means the cycle was too short — proof/bridge
 * signals do NOT override this. Timing is a hard gate, not a soft suggestion.
 *
 * Note: undefined → gate bypassed (cycle not yet complete or duration not computed).
 * The 1500ms floor matches SQUAT_ARMING_MS in auto-progression (not a new threshold).
 */
function minimumCycleTimingClearFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return input.minimumCycleDurationSatisfied !== false;
}

/**
 * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: Fresh-rep epoch integrity gate.
 *
 * Returns false when the current rep epoch is missing baseline or peak integrity:
 * - `baselineFrozen = false`: baseline not established for current rep → pre-attempt close
 * - `peakLatched = false`: depth peak not latched for current rep → no real descent anchor
 * - `eventCycleHasFreezeOrLatchMissing = true`: event cycle itself observed missing freeze/latch
 *   (detectSquatEventCycle adds 'freeze_or_latch_missing' note when baseline/peak not ready)
 *
 * These pre-attempt / pre-freeze / pre-latch history patterns must not be laundered into
 * later official close through bridge/proof signals.
 *
 * Note: undefined → gate bypassed (conservative — only block when explicitly false/true).
 */
function repEpochIntegrityClearFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  if (input.baselineFrozen === false) return false;
  if (input.peakLatched === false) return false;
  if (input.eventCycleHasFreezeOrLatchMissing === true) return false;
  return true;
}

/**
 * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: Weak-event proof substitution gate.
 *
 * Returns true (= BLOCKED) when all three conditions hold simultaneously:
 * 1. event cycle was NOT detected (`eventCycleDetected = false`)
 * 2. event cycle notes include 'descent_weak' (no meaningful descent quality)
 * 3. event cycle had zero descent frames (`eventCycleDescentFrames = 0`)
 *
 * AND the only reversal evidence available is bridge/proof (not ownerAuthoritativeReversalSatisfied).
 *
 * In this pattern, bridge/proof signals are acting as a substitute for real cycle truth.
 * `official_shallow_cycle` must not open based on proof-only evidence when event cycle
 * shows no real descent was detected. Bridge/proof are secondary signals — not reversal proof.
 *
 * Returns false (= not blocked) when:
 * - event cycle was detected, OR
 * - no descent_weak note, OR
 * - descent frames > 0, OR
 * - ownerAuthoritativeReversalSatisfied is true (rule/HMM confirmed reversal independently)
 */
function weakEventProofSubstitutionBlockedFromInput(
  input: CanonicalShallowCompletionContractInput
): boolean {
  if (
    input.eventCycleDetected === false &&
    input.eventCycleHasDescentWeak === true &&
    (input.eventCycleDescentFrames ?? 1) === 0 &&
    input.ownerAuthoritativeReversalSatisfied !== true
  ) {
    return true;
  }
  return false;
}

function firstBlockedReason(input: CanonicalShallowCompletionContractInput): {
  reason: CanonicalShallowCompletionContractBlockedReason;
  stage: CanonicalShallowCompletionContractStage;
} {
  const inZone = input.relativeDepthPeak < CANONICAL_SHALLOW_OWNER_FLOOR;
  if (!inZone) {
    return { reason: 'not_in_shallow_zone', stage: 'admission_blocked' };
  }

  if (!input.officialShallowPathCandidate || !input.officialShallowPathAdmitted) {
    return { reason: 'policy_or_unknown', stage: 'admission_blocked' };
  }

  const br = input.completionBlockedReason ?? null;
  if (br === 'not_armed') {
    return { reason: 'not_armed', stage: 'attempt_blocked' };
  }

  /**
   * PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY: Timing integrity gate.
   *
   * `descent_span_too_short` and `ascent_recovery_span_too_short` in completionBlockedReason
   * mean the core already determined that timing is insufficient for a valid cycle.
   * These timing failures must block the canonical contract even when bridge / proof /
   * ascent-equivalent signals are present — those are reversal evidence contributors, not
   * timing integrity substitutes.
   *
   * Why here (before reversal evidence check): proof signals are the last step, not an
   * override for timing integrity. The contract integrity order is:
   *   1. admission → 2. epoch → 3. timing integrity → 4. reversal evidence → 5. recovery → 6. anti-false-pass
   *
   * Existing signal reuse only — no new numeric thresholds.
   */
  if (br === 'descent_span_too_short' || br === 'ascent_recovery_span_too_short') {
    return { reason: 'timing_integrity_blocked', stage: 'reversal_blocked' };
  }

  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: Minimum cycle duration gate.
   *
   * If total cycle duration is explicitly below the minimum floor, official close is blocked.
   * Placed here (before attempt checks) because timing is a hard gate that proof cannot override.
   * Any attempt-level or reversal-level evidence is moot if the cycle was too short.
   */
  if (!minimumCycleTimingClearFromInput(input)) {
    return { reason: 'minimum_cycle_timing_blocked', stage: 'reversal_blocked' };
  }

  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: Rep epoch integrity — baselineFrozen / peakLatched.
   *
   * If baseline was not frozen or peak not latched for the current rep, official close is blocked.
   * These indicate a pre-attempt or contaminated epoch. Placed before attempt checks because
   * even if `attemptStarted=true` via some assist path, the epoch integrity is still required.
   */
  if (!repEpochIntegrityClearFromInput(input)) {
    return { reason: 'rep_epoch_integrity_blocked', stage: 'attempt_blocked' };
  }

  if (!input.attemptStarted) {
    return { reason: 'attempt_not_meaningful', stage: 'attempt_blocked' };
  }
  if (!input.descendConfirmed) {
    return { reason: 'no_descend', stage: 'attempt_blocked' };
  }
  if (!input.downwardCommitmentReached) {
    return { reason: 'no_commitment', stage: 'attempt_blocked' };
  }

  if (!reversalEvidenceFromInput(input)) {
    return { reason: 'authoritative_reversal_missing', stage: 'reversal_blocked' };
  }

  /**
   * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: Weak-event proof substitution gate.
   *
   * Placed after reversal evidence check: reversal evidence (including bridge/proof) may be
   * present, but if the event cycle shows no real descent (not detected + descent_weak +
   * descentFrames=0) AND no authoritative reversal (rule/HMM), those bridge/proof signals
   * are acting as a substitute for real cycle truth, not as a post-integrity assist.
   *
   * Bridge/proof are allowed to assist AFTER integrity gates pass, not instead of them.
   */
  if (weakEventProofSubstitutionBlockedFromInput(input)) {
    return { reason: 'weak_event_proof_substitution_blocked', stage: 'reversal_blocked' };
  }

  if (!recoveryEvidenceFromInput(input)) {
    return { reason: 'recovery_or_finalize_missing', stage: 'recovery_blocked' };
  }

  if (input.setupMotionBlocked === true) {
    return { reason: 'setup_motion_blocked', stage: 'anti_false_pass_blocked' };
  }
  if (input.peakLatchedAtIndex === 0) {
    return { reason: 'peak_series_start_contamination', stage: 'anti_false_pass_blocked' };
  }
  if (input.evidenceLabel === 'insufficient_signal') {
    return { reason: 'insufficient_signal', stage: 'anti_false_pass_blocked' };
  }

  return { reason: null, stage: 'closed' };
}

/**
 * Squat completion state 에서 이미 계산된 fact 만으로 canonical shallow contract 를 정리한다.
 * completion 필드를 덮어쓰지 않는다(PR-A).
 */
export function deriveCanonicalShallowCompletionContract(
  input: CanonicalShallowCompletionContractInput
): CanonicalShallowCompletionContract {
  const inZone = input.relativeDepthPeak < CANONICAL_SHALLOW_OWNER_FLOOR;
  const eligible = inZone;

  const admissionSatisfied =
    input.officialShallowPathCandidate === true &&
    input.officialShallowPathAdmitted === true &&
    input.attemptStarted === true &&
    input.descendConfirmed === true &&
    input.downwardCommitmentReached === true;

  const attemptSatisfied = admissionSatisfied;

  const reversalEvidenceSatisfied = reversalEvidenceFromInput(input);
  const recoveryEvidenceSatisfied = recoveryEvidenceFromInput(input);
  const antiFalsePassClear = antiFalsePassFromInput(input);
  // PR-7: timing integrity gate — timing blockers from core must block the contract
  // even when bridge/proof reversal evidence signals are present.
  const timingIntegrityClear = timingIntegrityClearFromInput(input);
  // PR-8: minimum cycle duration gate — total cycle must meet the minimum floor.
  const minimumCycleTimingClear = minimumCycleTimingClearFromInput(input);
  // PR-8: fresh-rep epoch integrity gate — baseline and peak must be established.
  const repEpochIntegrityClear = repEpochIntegrityClearFromInput(input);
  // PR-8: weak-event proof substitution blocked — bridge/proof cannot substitute for
  // authoritative reversal when event cycle shows no real descent was detected.
  const weakEventProofSubstitutionBlocked = weakEventProofSubstitutionBlockedFromInput(input);

  const satisfied =
    eligible &&
    admissionSatisfied &&
    attemptSatisfied &&
    timingIntegrityClear &&
    minimumCycleTimingClear &&
    repEpochIntegrityClear &&
    reversalEvidenceSatisfied &&
    !weakEventProofSubstitutionBlocked &&
    recoveryEvidenceSatisfied &&
    antiFalsePassClear;

  const { reason: blockedReason, stage: stageFromWalk } = firstBlockedReason(input);
  const stage: CanonicalShallowCompletionContractStage = satisfied ? 'closed' : stageFromWalk;

  const provenanceOnlySignalPresent =
    input.provenanceReversalEvidencePresent === true && reversalEvidenceSatisfied !== true;

  const baseSplitBrain =
    (input.officialShallowPathAdmitted === true &&
      satisfied === false &&
      provenanceOnlySignalPresent === true) ||
    (input.officialShallowPathAdmitted === true &&
      input.currentSquatPhase === 'standing_recovered' &&
      input.completionBlockedReason === 'no_reversal');

  /** PR-B: runtime closer vs contract 불일치 + completionPassReason 단독 불일치 감지. */
  const closerCanonicalMismatch =
    input.officialShallowPathAdmitted === true &&
    inZone &&
    (input.officialShallowPathClosed === true) !== satisfied;

  const passReasonMismatch =
    (input.officialShallowPathClosed === true && satisfied === false) ||
    (input.officialShallowPathClosed !== true &&
      input.completionPassReason === 'official_shallow_cycle' &&
      satisfied === false);

  const splitBrainDetected = baseSplitBrain || closerCanonicalMismatch || passReasonMismatch;

  /**
   * PR-B: satisfied 이고 shallow owner zone 에 있으며 standard path 가 아닌 경우 true.
   * (PR-A 의 officialShallowPathClosed mirror 에서 계약 기반으로 승격)
   */
  const authoritativeClosureWouldBeSatisfied =
    satisfied === true &&
    inZone &&
    input.completionPassReason !== 'standard_cycle';

  /**
   * PR-B: guarded trajectory proof 가 reversal evidence 에 기여해 contract 를 만족시켰으면
   * 'canonical_guarded_trajectory', 그 외 authoritative 이면 'canonical_authoritative', 미충족이면 'none'.
   */
  const closureSource: 'none' | 'canonical_authoritative' | 'canonical_guarded_trajectory' =
    !satisfied
      ? 'none'
      : input.guardedShallowTrajectoryClosureProofSatisfied === true
        ? 'canonical_guarded_trajectory'
        : 'canonical_authoritative';

  const closureWouldWriteOfficialShallowCycle = satisfied;

  const trace = [
    `eligible=${eligible ? 1 : 0}`,
    `admission=${admissionSatisfied ? 1 : 0}`,
    `attempt=${attemptSatisfied ? 1 : 0}`,
    `timing=${timingIntegrityClear ? 1 : 0}`,
    `minCycle=${minimumCycleTimingClear ? 1 : 0}`,
    `epoch=${repEpochIntegrityClear ? 1 : 0}`,
    `reversal=${reversalEvidenceSatisfied ? 1 : 0}`,
    `weakEvtBlock=${weakEventProofSubstitutionBlocked ? 1 : 0}`,
    `recovery=${recoveryEvidenceSatisfied ? 1 : 0}`,
    `anti=${antiFalsePassClear ? 1 : 0}`,
    `split=${splitBrainDetected ? 1 : 0}`,
    `authClosure=${authoritativeClosureWouldBeSatisfied ? 1 : 0}`,
    `closureSrc=${closureSource}`,
    `stage=${stage}`,
    `blocked=${blockedReason ?? 'none'}`,
  ].join('|');

  return {
    eligible,
    admissionSatisfied,
    attemptSatisfied,
    timingIntegrityClear,
    minimumCycleTimingClear,
    repEpochIntegrityClear,
    reversalEvidenceSatisfied,
    recoveryEvidenceSatisfied,
    antiFalsePassClear,
    satisfied,
    stage,
    blockedReason: satisfied ? null : blockedReason,
    authoritativeClosureWouldBeSatisfied,
    provenanceOnlySignalPresent,
    splitBrainDetected,
    closureSource,
    closureWouldWriteOfficialShallowCycle,
    trace,
  };
}
