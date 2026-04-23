/**
 * PR-X2-C — Ultra-Low-ROM Late Veto Relocation.
 *
 * Parent SSOT: `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`.
 *
 * ## Scope
 * Relocate the `ultra_low_rom_not_allowed` reason from a **late close veto**
 * into an **early reject policy**.  The blocker itself is still emitted by the
 * existing evaluator site (`getShallowMeaningfulCycleBlockReason` ->
 * `ultra_low_rom_cycle` branch) for the static / noise / seated-hold /
 * standing-only family, but on dynamic cycle-proven ultra-shallow reps it
 * must no longer be returned as the final close blocker.
 *
 * This helper does not mutate state, does not change any threshold, and is
 * never the final pass owner.  The final pass owner remains `completion`.
 *
 * ## Policy-mode contract
 * - `cycle_proven_allow` — dynamic shallow cycle is proven on the current
 *   rep.  The late `ultra_low_rom_not_allowed` veto must be bypassed.
 * - `early_reject` — any of the listed invariants are violated.  The veto is
 *   classified as an early reject (admission-tier or completion pre-close
 *   policy-tier reject).
 * - `not_scoped` — the rep is not in the ultra-low-rom scope (e.g. pass
 *   reason is not `ultra_low_rom_cycle`), so the policy is not applicable
 *   on this frame.
 *
 * ## Cycle-proven invariants (from PR-X2-C prompt §5.A verbatim)
 * All of the following must be true for `cycle_proven_allow` to be emitted:
 * - `attemptStarted === true`
 * - `descendConfirmed === true`
 * - `reversalConfirmedAfterDescend === true`
 * - `recoveryConfirmedAfterReversal === true`
 * - `officialShallowPathAdmitted === true`
 * - `officialShallowReversalSatisfied === true`
 * - `officialShallowAscentEquivalentSatisfied === true`
 * - `trajectoryReversalRescueApplied !== true`
 * - `setupMotionBlocked !== true`
 * - `readinessStableDwellSatisfied !== false`
 * - `eventCyclePromoted !== true`  (no pass-core short-circuit)
 *
 * The `eventCyclePromoted` and `trajectoryReversalRescueApplied` guards are
 * required by §3 invariants ("no pass from trajectory rescue / event-cycle
 * promotion alone") and §6 ("no reintroduction of pass-core authority").
 *
 * ## Hard-reject band (never flip to `cycle_proven_allow`)
 * - no descent, no reversal, no recovery, fake recovery
 * - seated hold, standing only, 1-frame jitter
 * - setup blocked, readiness unstable
 * - trajectory rescue applied, event-cycle short-circuit only
 *
 * ## Why this helper is distinct from the X2-B close proof helper
 * X2-B (`squat-shallow-close-proof.ts`) carries a stricter predicate that
 * additionally requires `reversalConfirmedByRuleOrHmm === true` and
 * `canonicalTemporalEpochOrderSatisfied === true`.  Those extra guards are
 * correct for the descent-span veto (X2-B's scope) but are explicitly OUT
 * of scope here — X2-C is narrowly about relocating the ultra-low late
 * veto and must not inherit X2-D temporal-alignment problems.  Keeping
 * the two predicates separate preserves the prompt's rule that X2-C and
 * X2-B bypasses "must not be merged into one exception cluster" (§11).
 */

import type { SquatCompletionState } from '@/lib/camera/squat-completion-state';

export type UltraLowRomPolicyMode =
  | 'not_scoped'
  | 'early_reject'
  | 'cycle_proven_allow';

export type UltraLowRomPolicyRejectReason =
  | null
  | 'attempt_not_started'
  | 'descend_not_confirmed'
  | 'reversal_not_confirmed'
  | 'recovery_not_confirmed'
  | 'shallow_not_admitted'
  | 'shallow_reversal_not_satisfied'
  | 'ascent_equivalent_not_satisfied'
  | 'trajectory_rescue_applied'
  | 'event_cycle_short_circuit'
  | 'setup_motion_blocked'
  | 'readiness_unstable';

export interface UltraLowRomVetoRelocationGates {
  attemptStarted: boolean;
  descendConfirmed: boolean;
  reversalConfirmed: boolean;
  recoveryConfirmed: boolean;
  shallowAdmitted: boolean;
  shallowReversalSatisfied: boolean;
  ascentEquivalentSatisfied: boolean;
  noTrajectoryRescue: boolean;
  noEventCycleShortCircuit: boolean;
  setupClean: boolean;
  readinessStable: boolean;
}

export interface UltraLowRomVetoRelocationDecision {
  /** Whether the `ultra_low_rom_cycle` branch is in scope at all on this
   *  frame.  False when `completionPassReason !== 'ultra_low_rom_cycle'`. */
  inScope: boolean;
  /** Policy mode — `cycle_proven_allow`, `early_reject`, or `not_scoped`. */
  mode: UltraLowRomPolicyMode;
  /** When `cycle_proven_allow`, the late veto MUST be bypassed by the caller. */
  lateVetoBypass: boolean;
  /** When `early_reject`, identifies which invariant caused the rejection. */
  rejectedEarly: boolean;
  rejectReason: UltraLowRomPolicyRejectReason;
  gates: UltraLowRomVetoRelocationGates;
  notes: string[];
}

const ULTRA_LOW_ROM_IN_SCOPE_PASS_REASON = 'ultra_low_rom_cycle' as const;

/**
 * Pure function.  Does not mutate state.  Does not look at thresholds or
 * descent spans.  Only encodes the prompt's §5.A invariants.
 */
export function computeUltraLowRomVetoRelocationDecision(
  state: SquatCompletionState | null | undefined
): UltraLowRomVetoRelocationDecision {
  if (state == null) {
    return makeNotScopedDecision('state_missing');
  }

  if (state.completionPassReason !== ULTRA_LOW_ROM_IN_SCOPE_PASS_REASON) {
    return makeNotScopedDecision('pass_reason_not_ultra_low_rom_cycle');
  }

  const attemptStarted = state.attemptStarted === true;
  const descendConfirmed = state.descendConfirmed === true;
  const reversalConfirmed = state.reversalConfirmedAfterDescend === true;
  const recoveryConfirmed = state.recoveryConfirmedAfterReversal === true;
  const shallowAdmitted = state.officialShallowPathAdmitted === true;
  const shallowReversalSatisfied = state.officialShallowReversalSatisfied === true;
  const ascentEquivalentSatisfied = state.officialShallowAscentEquivalentSatisfied === true;
  const noTrajectoryRescue = state.trajectoryReversalRescueApplied !== true;
  const noEventCycleShortCircuit = state.eventCyclePromoted !== true;
  const setupClean = state.setupMotionBlocked !== true;
  const readinessStable = state.readinessStableDwellSatisfied !== false;

  const gates: UltraLowRomVetoRelocationGates = {
    attemptStarted,
    descendConfirmed,
    reversalConfirmed,
    recoveryConfirmed,
    shallowAdmitted,
    shallowReversalSatisfied,
    ascentEquivalentSatisfied,
    noTrajectoryRescue,
    noEventCycleShortCircuit,
    setupClean,
    readinessStable,
  };

  /**
   * Earliest-canonical-blocker selection.  Order prioritises early-lane
   * concerns (setup / readiness / admission) before dynamic-cycle checks so
   * that traces surface the closest-to-root cause of the rejection.
   */
  let rejectReason: UltraLowRomPolicyRejectReason = null;
  if (!setupClean) rejectReason = 'setup_motion_blocked';
  else if (!readinessStable) rejectReason = 'readiness_unstable';
  else if (!shallowAdmitted) rejectReason = 'shallow_not_admitted';
  else if (!attemptStarted) rejectReason = 'attempt_not_started';
  else if (!descendConfirmed) rejectReason = 'descend_not_confirmed';
  else if (!reversalConfirmed) rejectReason = 'reversal_not_confirmed';
  else if (!recoveryConfirmed) rejectReason = 'recovery_not_confirmed';
  else if (!shallowReversalSatisfied) rejectReason = 'shallow_reversal_not_satisfied';
  else if (!ascentEquivalentSatisfied) rejectReason = 'ascent_equivalent_not_satisfied';
  else if (!noTrajectoryRescue) rejectReason = 'trajectory_rescue_applied';
  else if (!noEventCycleShortCircuit) rejectReason = 'event_cycle_short_circuit';

  if (rejectReason != null) {
    return {
      inScope: true,
      mode: 'early_reject',
      lateVetoBypass: false,
      rejectedEarly: true,
      rejectReason,
      gates,
      notes: [`ultra_low_rom_early_reject:${rejectReason}`],
    };
  }

  return {
    inScope: true,
    mode: 'cycle_proven_allow',
    lateVetoBypass: true,
    rejectedEarly: false,
    rejectReason: null,
    gates,
    notes: ['ultra_low_rom_cycle_proven_allow'],
  };
}

function makeNotScopedDecision(note: string): UltraLowRomVetoRelocationDecision {
  return {
    inScope: false,
    mode: 'not_scoped',
    lateVetoBypass: false,
    rejectedEarly: false,
    rejectReason: null,
    gates: {
      attemptStarted: false,
      descendConfirmed: false,
      reversalConfirmed: false,
      recoveryConfirmed: false,
      shallowAdmitted: false,
      shallowReversalSatisfied: false,
      ascentEquivalentSatisfied: false,
      noTrajectoryRescue: true,
      noEventCycleShortCircuit: true,
      setupClean: true,
      readinessStable: true,
    },
    notes: [note],
  };
}

/** Short trace-compact form for camera-trace bundle. */
export interface UltraLowRomVetoRelocationTraceCompact {
  mode: UltraLowRomPolicyMode;
  bypass: boolean;
  early: boolean;
  rr: UltraLowRomPolicyRejectReason;
  g: UltraLowRomVetoRelocationGates;
}

export function buildUltraLowRomVetoRelocationTraceCompact(
  decision: UltraLowRomVetoRelocationDecision | undefined | null
): UltraLowRomVetoRelocationTraceCompact | null {
  if (decision == null) return null;
  return {
    mode: decision.mode,
    bypass: decision.lateVetoBypass,
    early: decision.rejectedEarly,
    rr: decision.rejectReason,
    g: decision.gates,
  };
}
