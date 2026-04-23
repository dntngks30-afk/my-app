/**
 * PR-X2-A — Shallow Epoch Acquisition Contract.
 *
 * This module is the single owner of the "observation truth -> shallow epoch
 * acquisition -> admitted attempt truth" step for ultra-shallow / true-shallow
 * squats. Parent SSOT: `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`.
 *
 * ## Scope
 * - Close the gap between `shallowCandidateObserved + downwardCommitmentReached`
 *   and a valid completion-owned attempt epoch (the `not_armed` family in the
 *   parent SSOT's Repeated-failure family 1).
 * - Do NOT own final pass. Final pass owner remains `completion`.
 * - Do NOT redesign shallow close proof. `shallow_descent_too_short` repair is
 *   PR-X2-B scope.
 *
 * ## Ownership contract
 * - Input: existing observability signals (setup/readiness/shared descent truth/
 *   pass-window/HMM arming assist/natural rule arm).
 * - Output: a structured decision with ONE authoritative acquisition verdict
 *   plus a machine-readable `acquisitionBlockedReason` breakdown of the
 *   historical `not_armed` family.
 * - Side effect: when `acquisitionApplied === true`, `evaluators/squat.ts`
 *   treats this as an additional `effectiveArmed` source (parallel to the
 *   existing `sharedDescentArmingStabilizationApplied` path). It does NOT open
 *   final pass on its own and does NOT bypass setup/framing guards.
 *
 * ## Hard-reject band (never acquire)
 * - setupMotionBlocked / successSuppressedBySetupPhase
 * - readiness dwell unsatisfied
 * - standing-only / seated-hold-only / jitter-only (no real descent excursion)
 * - fake peak (max depth at first frame / one-frame spike)
 * - framing-translation-suppressed family
 *
 * ## Positive acquisition band (acquire into epoch)
 * All of the following must hold:
 * - readiness stable
 * - setup clean
 * - shared descent truth shows a real pre-peak window (peakIndex > 0)
 *   with non-trivial excursion, OR pass-window evidence equivalent
 * - relativePeak within shallow band (above static-floor, below standard-owner floor)
 * - attempt-like motion observed (either the local descentFrameCount or the shared truth
 *   excursion confirms monotone-ish directional motion)
 *
 * This contract is additive. When any of the existing arming paths (natural,
 * HMM assist, shared-descent stabilization) already fires, this module records
 * `acquisitionReason = existing_arm_owns` and reports `acquisitionApplied=false`
 * so there is no double-count in traces.
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { SquatDescentTruthResult } from '@/lib/camera/squat/squat-descent-truth';
import type { SquatPassWindowResult } from '@/lib/camera/squat/pass-window';
import { STANDARD_OWNER_FLOOR } from '@/lib/camera/squat/squat-completion-core';

/** Minimum shallow-band relative peak for epoch acquisition. Aligned with
 *  completion `GUARDED_ULTRA_LOW_ROM_FLOOR` so acquisition does not admit
 *  frames below the static / jitter floor. Completion-state retains its own
 *  `attemptAdmissionSatisfied` gate — this floor only ensures we don't even
 *  try to acquire on micro-sway. */
export const SHALLOW_EPOCH_ACQUISITION_MIN_RELATIVE_PEAK = 0.02;

/** Minimum shared-descent excursion to consider "real directional motion".
 *  Slightly below shared-descent truth's own `MIN_SHARED_DESCENT_RELATIVE_PEAK`
 *  (0.025) intentionally: the shared truth gate already rejects micro-motion,
 *  so when it fires we trust it. For pass-window-equivalent evidence we use a
 *  conservative floor below that. */
const REAL_MOTION_EXCURSION_MIN = 0.02;

/** Minimum pre-peak window size (frames) — rejects first-frame / one-frame spikes. */
const MIN_PRE_PEAK_FRAMES = 2;

/** Minimum attempt-like motion signal. At least this many "descent-like" frames
 *  (either local descent hint OR shared descent truth pre-peak frames). */
const MIN_ATTEMPT_LIKE_DESCENT_FRAMES = 2;

/**
 * Observation-truth stages surfaced for diagnostic visibility.
 * This mirrors `camera-trace-observation-builders.ObservationTruthStage` intent
 * but is scoped to acquisition (pre-admission) rather than attempt-truth.
 */
export type ShallowEpochObservationStage =
  | 'pre_observation'
  | 'shallow_observed_only'
  | 'attempt_like_without_commitment'
  | 'observation_complete_but_rejected'
  | 'epoch_acquisition_candidate';

export type ShallowEpochAcquisitionBlockedReason =
  | null
  | 'existing_arm_owns'
  | 'setup_blocked'
  | 'readiness_unstable'
  | 'pass_window_unusable'
  | 'no_shallow_observation'
  | 'no_downward_commitment'
  | 'no_attempt_like_motion'
  | 'no_real_descent_evidence'
  | 'first_frame_or_one_frame_peak'
  | 'static_standing_only'
  | 'standard_or_deep_band'
  | 'relative_peak_below_acquisition_floor';

export type ShallowEpochAcquisitionReason =
  | null
  | 'existing_arm_owns'
  | 'shallow_observation_to_epoch'
  | 'shared_descent_shallow_epoch_acquisition';

export interface ShallowEpochAcquisitionGates {
  readinessStable: boolean;
  setupClean: boolean;
  shallowCandidateObserved: boolean;
  attemptLikeMotionObserved: boolean;
  downwardCommitmentReached: boolean;
  realDescentEvidence: boolean;
  staticOrJitterOnly: boolean;
  firstFrameOrOneFramePeak: boolean;
}

export interface ShallowEpochAcquisitionDecision {
  /** True only when this module may contribute a new arming path (pre-existing
   *  arming paths take precedence and report `existing_arm_owns`). */
  acquisitionApplied: boolean;
  /** True when the observation/readiness gates suggest acquisition is possible
   *  regardless of whether another arming path already owns it. Useful for
   *  understanding how often the observation truth is "ready" even when
   *  another acquirer got there first. */
  acquisitionEligible: boolean;
  /** Non-null when `acquisitionApplied` is true OR an existing path owns it. */
  acquisitionReason: ShallowEpochAcquisitionReason;
  /** Null when applied; otherwise identifies the single earliest blocking gate. */
  acquisitionBlockedReason: ShallowEpochAcquisitionBlockedReason;
  /** Observation-truth stage summary for traces. */
  observationStage: ShallowEpochObservationStage;
  /** Gate-by-gate breakdown for diagnostic visibility. */
  gates: ShallowEpochAcquisitionGates;
  /** Small free-form notes — kept short for trace compactness. */
  notes: string[];
}

export interface ShallowEpochAcquisitionInput {
  valid: PoseFeaturesFrame[];
  /** rule-armed from `computeSquatCompletionArming`. */
  ruleArmed: boolean;
  /** HMM arming assist applied. */
  hmmArmingAssistApplied: boolean;
  /** Shared-descent arming stabilization (pre-existing path in evaluators/squat.ts). */
  sharedDescentArmingStabilizationApplied: boolean;
  /** Setup lock outputs. */
  setupMotionBlocked: boolean;
  /** Readiness dwell outcome. */
  readinessStableDwellSatisfied: boolean;
  /** Pass window build result. */
  passWindow: SquatPassWindowResult;
  /** Shared descent truth (may be null when pass window is unusable). */
  sharedDescentTruth: SquatDescentTruthResult | null;
}

function anyExistingArmOwns(input: ShallowEpochAcquisitionInput): boolean {
  return (
    input.ruleArmed ||
    input.hmmArmingAssistApplied ||
    input.sharedDescentArmingStabilizationApplied
  );
}

function readCompletionDepth(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

function countDescentHintFrames(valid: PoseFeaturesFrame[]): number {
  let n = 0;
  for (const f of valid) if (f.phaseHint === 'descent') n += 1;
  return n;
}

/**
 * Quickly detect "no real motion" families that must never be acquired even if
 * relativePeak happens to cross the acquisition floor by one frame.
 */
function isStaticOrJitterOnly(
  valid: PoseFeaturesFrame[],
  sharedDescentTruth: SquatDescentTruthResult | null
): boolean {
  if (sharedDescentTruth != null && sharedDescentTruth.descentDetected) return false;
  if (valid.length === 0) return true;
  let min = Infinity;
  let max = -Infinity;
  for (const f of valid) {
    const d = readCompletionDepth(f);
    if (d == null) continue;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return true;
  const range = max - min;
  return range < REAL_MOTION_EXCURSION_MIN;
}

/**
 * PR-X2-A — main entry.
 *
 * Returns a fully-resolved decision. Caller is `evaluators/squat.ts`; this
 * module is side-effect-free.
 */
export function computeShallowEpochAcquisitionDecision(
  input: ShallowEpochAcquisitionInput
): ShallowEpochAcquisitionDecision {
  const notes: string[] = [];
  const readinessStable = input.readinessStableDwellSatisfied === true;
  const setupClean = input.setupMotionBlocked !== true;

  const sdt = input.sharedDescentTruth;
  const passWindowUsable = input.passWindow.usable === true;
  const relativePeak = sdt != null ? sdt.relativePeak : 0;
  const descentFrameCount = sdt != null ? sdt.descentFrameCount : 0;
  const descentExcursion = sdt != null ? sdt.descentExcursion : 0;
  const localDescentHints = countDescentHintFrames(input.valid);

  /** A — "shallow candidate observed" contract (acquisition-local).
   *  relativePeak is in the shallow band and strictly below the standard-owner
   *  floor. Deep/standard band motion is not our concern — completion's rule-
   *  arm owns those. */
  const shallowCandidateObserved =
    relativePeak >= SHALLOW_EPOCH_ACQUISITION_MIN_RELATIVE_PEAK &&
    relativePeak < STANDARD_OWNER_FLOOR;

  /** B — attempt-like motion observed. We count both the local phase-hint
   *  descent frames AND the shared-descent pre-peak window; ultra-shallow reps
   *  typically have zero local hints but a non-trivial shared pre-peak window,
   *  and noisy reps have local hints without shared truth — either is enough
   *  evidence for attempt-like motion. */
  const attemptLikeMotionObserved =
    localDescentHints >= MIN_ATTEMPT_LIKE_DESCENT_FRAMES ||
    descentFrameCount >= MIN_PRE_PEAK_FRAMES;

  /** C — downward commitment reached (shared-descent truth or pass-window
   *  equivalent excursion). We use the shared truth result directly because
   *  `downwardCommitmentReached` in completion-state is computed from the same
   *  depth stream. */
  const downwardCommitmentReached =
    (sdt?.descentDetected === true) ||
    descentExcursion >= REAL_MOTION_EXCURSION_MIN;

  /** D — real descent evidence: either the shared truth confirmed descent, or
   *  the pass-window excursion and the pre-peak window are both non-trivial.
   *  This rejects one-frame spikes where descentExcursion is > floor only
   *  because of a single-sample peak. */
  const realDescentEvidence =
    (sdt?.descentDetected === true) ||
    (descentExcursion >= REAL_MOTION_EXCURSION_MIN && descentFrameCount >= MIN_PRE_PEAK_FRAMES);

  /** E — reject first-frame / one-frame peak. */
  const firstFrameOrOneFramePeak =
    sdt != null &&
    (sdt.peakIndex == null ||
      sdt.peakIndex <= 0 ||
      sdt.descentFrameCount < MIN_PRE_PEAK_FRAMES);

  /** F — static / jitter-only rejection (independent of sdt). */
  const staticOrJitterOnly = isStaticOrJitterOnly(input.valid, sdt);

  const gates: ShallowEpochAcquisitionGates = {
    readinessStable,
    setupClean,
    shallowCandidateObserved,
    attemptLikeMotionObserved,
    downwardCommitmentReached,
    realDescentEvidence,
    staticOrJitterOnly,
    firstFrameOrOneFramePeak,
  };

  const existingOwns = anyExistingArmOwns(input);

  /**
   * Resolve the earliest blocking reason. Order matters — gates listed first
   * are the "hardest" rejects (setup/readiness), then the observation gates,
   * then the band-shape gates. This gives traces a single canonical blocker
   * instead of the fan of causes `not_armed` currently collapses together.
   */
  let blockedReason: ShallowEpochAcquisitionBlockedReason = null;
  if (!setupClean) blockedReason = 'setup_blocked';
  else if (!readinessStable) blockedReason = 'readiness_unstable';
  else if (!passWindowUsable) blockedReason = 'pass_window_unusable';
  else if (staticOrJitterOnly) blockedReason = 'static_standing_only';
  else if (firstFrameOrOneFramePeak) blockedReason = 'first_frame_or_one_frame_peak';
  else if (relativePeak >= STANDARD_OWNER_FLOOR) blockedReason = 'standard_or_deep_band';
  else if (relativePeak < SHALLOW_EPOCH_ACQUISITION_MIN_RELATIVE_PEAK) {
    blockedReason = 'relative_peak_below_acquisition_floor';
  } else if (!shallowCandidateObserved) blockedReason = 'no_shallow_observation';
  else if (!downwardCommitmentReached) blockedReason = 'no_downward_commitment';
  else if (!attemptLikeMotionObserved) blockedReason = 'no_attempt_like_motion';
  else if (!realDescentEvidence) blockedReason = 'no_real_descent_evidence';

  const observationStage: ShallowEpochObservationStage =
    !readinessStable || !setupClean
      ? 'pre_observation'
      : shallowCandidateObserved && !attemptLikeMotionObserved
        ? 'shallow_observed_only'
        : attemptLikeMotionObserved && !downwardCommitmentReached
          ? 'attempt_like_without_commitment'
          : blockedReason != null
            ? 'observation_complete_but_rejected'
            : 'epoch_acquisition_candidate';

  const acquisitionEligible = blockedReason == null;

  if (existingOwns) {
    notes.push('existing_arm_owns_skipped_acquisition');
    return {
      acquisitionApplied: false,
      acquisitionEligible,
      acquisitionReason: 'existing_arm_owns',
      acquisitionBlockedReason: 'existing_arm_owns',
      observationStage,
      gates,
      notes,
    };
  }

  if (!acquisitionEligible) {
    return {
      acquisitionApplied: false,
      acquisitionEligible: false,
      acquisitionReason: null,
      acquisitionBlockedReason: blockedReason,
      observationStage,
      gates,
      notes,
    };
  }

  const reason: ShallowEpochAcquisitionReason =
    sdt?.descentDetected === true
      ? 'shared_descent_shallow_epoch_acquisition'
      : 'shallow_observation_to_epoch';
  notes.push(reason);

  return {
    acquisitionApplied: true,
    acquisitionEligible: true,
    acquisitionReason: reason,
    acquisitionBlockedReason: null,
    observationStage: 'epoch_acquisition_candidate',
    gates,
    notes,
  };
}

/** Short trace-compact form for camera-trace bundle. */
export interface ShallowEpochAcquisitionTraceCompact {
  ap: boolean;
  el: boolean;
  r: ShallowEpochAcquisitionReason;
  br: ShallowEpochAcquisitionBlockedReason;
  stage: ShallowEpochObservationStage;
  g: ShallowEpochAcquisitionGates;
}

export function buildShallowEpochAcquisitionTraceCompact(
  decision: ShallowEpochAcquisitionDecision | undefined
): ShallowEpochAcquisitionTraceCompact | null {
  if (decision == null) return null;
  return {
    ap: decision.acquisitionApplied,
    el: decision.acquisitionEligible,
    r: decision.acquisitionReason,
    br: decision.acquisitionBlockedReason,
    stage: decision.observationStage,
    g: decision.gates,
  };
}
