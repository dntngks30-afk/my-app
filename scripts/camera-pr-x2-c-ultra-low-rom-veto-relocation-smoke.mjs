/**
 * PR-X2-C — Ultra-Low-ROM Late Veto Relocation smoke.
 *
 * Pins the narrow PR-X2-C contract (see
 * `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md` and
 * `PR-X2-C-implementation-prompt.md`):
 *
 * A) Allow (newly unblocked / advances to next blocker):
 *    dynamic cycle-proven ultra-shallow reps MUST no longer die at
 *    `ultra_low_rom_not_allowed`.  Either the evaluator returns null
 *    (admitted to completion flow) or it returns a different blocker
 *    downstream of the ultra-low late veto.
 * B) Must stay blocked:
 *    static / noise / setup-blocked / no-reversal / no-recovery /
 *    trajectory-rescue / event-cycle-only families continue to be rejected
 *    with `ultra_low_rom_not_allowed` (or an earlier, more specific
 *    reason).  The ultra-low lane is classified as an `early_reject`.
 * C) Regression:
 *    deep / standard pass unaffected; PR-X2-A acquisition fields remain
 *    orthogonal; PR-X2-B shallow-close-proof fields still govern their own
 *    bypass; final pass owner remains completion.
 *
 * Run:
 *   npx tsx scripts/camera-pr-x2-c-ultra-low-rom-veto-relocation-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
);
const { computeUltraLowRomVetoRelocationDecision } = await import(
  '../src/lib/camera/squat/squat-ultra-low-rom-veto-relocation.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(
      `  FAIL ${name}`,
      extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''
    );
    process.exitCode = 1;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Ultra-low cycle-proven base factory.
// Encodes the PR-X2-C §5.A invariants verbatim.  Every field a downstream
// evaluator gate may inspect is set to a safe "gold-path" value so the only
// reason the rep would otherwise die is `ultra_low_rom_not_allowed`.
// ──────────────────────────────────────────────────────────────────────────────

function makeUltraLowCycleProven(overrides = {}) {
  return {
    completionPassReason: 'ultra_low_rom_cycle',
    completionSatisfied: true,
    completionBlockedReason: null,

    // Ultra-shallow band (well below STANDARD_OWNER_FLOOR=0.4)
    relativeDepthPeak: 0.06,
    rawDepthPeakPrimary: 0.06,
    baselineStandingDepth: 0,
    baselineFrozenDepth: 0,
    currentSquatPhase: 'standing_recovered',

    // Timing — reversalToStanding in safe window; descent bypass not required
    squatDescentToPeakMs: 220, // deliberately >= MIN_DESCENT_TO_PEAK_MS_SHALLOW
    squatReversalToStandingMs: 2000,

    // Prompt §5.A invariants — all true
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowPathAdmitted: true,
    officialShallowReversalSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    trajectoryReversalRescueApplied: false,
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    eventCyclePromoted: false,

    // Reversal provenance: rule-based by default (so rule_based_reversal_required
    // gate passes).  The X2-C predicate itself does NOT require rule/HMM.
    reversalConfirmedBy: 'rule',
    reversalConfirmedByRuleOrHmm: true,

    // Ultra-low policy layer: DELIBERATELY blocked, to exercise the X2-C
    // relocation — the rep must pass via the cycle-proven bypass, not via
    // the legacy policy/provisional branches.
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: true,

    // Close/bridge surface
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    canonicalTemporalEpochOrderSatisfied: true,

    squatEventCycle: {
      detected: true,
      band: 'ultra_low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
    },

    ...overrides,
  };
}

console.log('\nPR-X2-C ultra-low-rom veto relocation smoke\n');

// ──────────────────────────────────────────────────────────────────────────────
// A) Unit: computeUltraLowRomVetoRelocationDecision contract table
// ──────────────────────────────────────────────────────────────────────────────

{
  const d = computeUltraLowRomVetoRelocationDecision(makeUltraLowCycleProven());
  ok(
    'unit: cycle-proven base → cycle_proven_allow',
    d.mode === 'cycle_proven_allow' &&
      d.lateVetoBypass === true &&
      d.rejectedEarly === false &&
      d.rejectReason === null &&
      d.inScope === true,
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(undefined);
  ok(
    'unit: undefined state → not_scoped',
    d.mode === 'not_scoped' && d.inScope === false && d.lateVetoBypass === false,
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision({
    completionPassReason: 'standard_cycle',
  });
  ok(
    'unit: standard_cycle → not_scoped (no veto relocation needed)',
    d.mode === 'not_scoped' && d.inScope === false,
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ setupMotionBlocked: true })
  );
  ok(
    'unit: setup-blocked → early_reject(setup_motion_blocked)',
    d.mode === 'early_reject' &&
      d.lateVetoBypass === false &&
      d.rejectedEarly === true &&
      d.rejectReason === 'setup_motion_blocked',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ readinessStableDwellSatisfied: false })
  );
  ok(
    'unit: readiness-unstable → early_reject(readiness_unstable)',
    d.mode === 'early_reject' && d.rejectReason === 'readiness_unstable',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ attemptStarted: false })
  );
  ok(
    'unit: no attempt → early_reject(attempt_not_started)',
    d.mode === 'early_reject' && d.rejectReason === 'attempt_not_started',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ descendConfirmed: false })
  );
  ok(
    'unit: no descent → early_reject(descend_not_confirmed)',
    d.mode === 'early_reject' && d.rejectReason === 'descend_not_confirmed',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ reversalConfirmedAfterDescend: false })
  );
  ok(
    'unit: no reversal → early_reject(reversal_not_confirmed)',
    d.mode === 'early_reject' && d.rejectReason === 'reversal_not_confirmed',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ recoveryConfirmedAfterReversal: false })
  );
  ok(
    'unit: no recovery → early_reject(recovery_not_confirmed)',
    d.mode === 'early_reject' && d.rejectReason === 'recovery_not_confirmed',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ officialShallowPathAdmitted: false })
  );
  ok(
    'unit: not admitted → early_reject(shallow_not_admitted)',
    d.mode === 'early_reject' && d.rejectReason === 'shallow_not_admitted',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ officialShallowReversalSatisfied: false })
  );
  ok(
    'unit: shallow reversal not satisfied → early_reject',
    d.mode === 'early_reject' &&
      d.rejectReason === 'shallow_reversal_not_satisfied',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ officialShallowAscentEquivalentSatisfied: false })
  );
  ok(
    'unit: ascent-equivalent not satisfied → early_reject',
    d.mode === 'early_reject' &&
      d.rejectReason === 'ascent_equivalent_not_satisfied',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ trajectoryReversalRescueApplied: true })
  );
  ok(
    'unit: trajectory-rescue → early_reject(trajectory_rescue_applied)',
    d.mode === 'early_reject' &&
      d.rejectReason === 'trajectory_rescue_applied',
    d
  );
}

{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({ eventCyclePromoted: true })
  );
  ok(
    'unit: event-cycle-only short-circuit → early_reject(event_cycle_short_circuit)',
    d.mode === 'early_reject' &&
      d.rejectReason === 'event_cycle_short_circuit',
    d
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// B) Evaluator gate — allow lane:
// Cycle-proven ultra-shallow reps MUST NOT die at `ultra_low_rom_not_allowed`.
// ──────────────────────────────────────────────────────────────────────────────

{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowCycleProven());
  ok(
    'allow: cycle-proven ultra-shallow (policy blocked, provisional would fail) → late veto bypassed',
    reason == null || reason !== 'ultra_low_rom_not_allowed',
    { reason }
  );
}

// Parent-SSOT Case B trace pattern verbatim: relativeDepthPeak≈0.06, policy
// blocked, provisional unavailable, but §5.A invariants all true.
{
  const state = makeUltraLowCycleProven({
    relativeDepthPeak: 0.06,
    rawDepthPeakPrimary: 0.06,
    ultraLowPolicyBlocked: true,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'allow: Case B trace pattern (relativeDepthPeak=0.06) → no ultra_low_rom_not_allowed',
    reason !== 'ultra_low_rom_not_allowed',
    { reason }
  );
}

// Cycle-proven + short descent (PR-X2-B bypass + PR-X2-C bypass combined).
// Should still not die at ultra_low_rom_not_allowed.  The PR-X2-B close proof
// additionally handles the short descent.
{
  const state = makeUltraLowCycleProven({ squatDescentToPeakMs: 120 });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'allow: cycle-proven ultra-shallow + short descent → neither X2-B nor X2-C veto fires',
    reason !== 'ultra_low_rom_not_allowed' &&
      reason !== 'shallow_descent_too_short',
    { reason }
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// C) Evaluator gate — must stay blocked:
// Static / noise / setup-blocked / no-dynamic-cycle families.
// ──────────────────────────────────────────────────────────────────────────────

{
  const state = makeUltraLowCycleProven({
    attemptStarted: false,
    descendConfirmed: false,
    reversalConfirmedAfterDescend: false,
    recoveryConfirmedAfterReversal: false,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: standing-only / no cycle → still ultra_low_rom_not_allowed',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({
    descendConfirmed: false,
    reversalConfirmedAfterDescend: false,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: seated-hold-like (no descent, no reversal) → still ultra_low_rom_not_allowed',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({
    reversalConfirmedAfterDescend: false,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: descent without reversal (jitter-like) → still ultra_low_rom_not_allowed',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({
    recoveryConfirmedAfterReversal: false,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: no recovery (fake recovery) → still ultra_low_rom_not_allowed',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({ setupMotionBlocked: true });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: setup-blocked → still ultra_low_rom_not_allowed (setup suppression preserved)',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({ trajectoryReversalRescueApplied: true });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: trajectory-rescue only → still ultra_low_rom_not_allowed (no pass-core re-authority)',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({ eventCyclePromoted: true });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: event-cycle-only promotion → still ultra_low_rom_not_allowed (no event-owner short-circuit)',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({ officialShallowPathAdmitted: false });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'blocked: not admitted → still ultra_low_rom_not_allowed (admission-tier gate preserved)',
    reason === 'ultra_low_rom_not_allowed',
    { reason }
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// D) Evaluator gate — downstream invariants remain enforced even when the
// PR-X2-C bypass fires (the bypass only disables `ultra_low_rom_not_allowed`).
// ──────────────────────────────────────────────────────────────────────────────

{
  const state = makeUltraLowCycleProven({ currentSquatPhase: 'ascending' });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'downstream: cycle-proven + non-standing phase → standing_recovered_required (not bypassed)',
    reason === 'standing_recovered_required',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({
    reversalConfirmedBy: 'trajectory',
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'downstream: cycle-proven + trajectory-only reversal provenance → rule_based_reversal_required',
    reason === 'rule_based_reversal_required',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({ squatReversalToStandingMs: 100 });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'downstream: cycle-proven + short reversal-to-standing → shallow_reversal_to_standing_too_short',
    reason === 'shallow_reversal_to_standing_too_short',
    { reason }
  );
}

{
  const state = makeUltraLowCycleProven({ squatReversalToStandingMs: 9000 });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'downstream: cycle-proven + aggregation span → current_rep_ownership_blocked',
    reason === 'current_rep_ownership_blocked',
    { reason }
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// E) Regression: other pass reasons + PR-X2-A/B surface untouched.
// ──────────────────────────────────────────────────────────────────────────────

{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    completionSatisfied: true,
  });
  ok(
    'regression: standard_cycle is not governed by this gate',
    reason == null,
    { reason }
  );
}

// Legacy legitimate ultra-low via policy layer (ultraLowPolicyBlocked=false)
// → still passes without the X2-C bypass being needed.
{
  const state = makeUltraLowCycleProven({
    ultraLowPolicyBlocked: false,
    // Even without the §5.A invariants fully satisfied, the policy-legitimate
    // branch retains its pre-X2-C behavior.  Here we keep them satisfied to
    // be conservative.
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'regression: policy-legitimate ultra-low still passes (no X2-C interference)',
    reason == null,
    { reason }
  );
}

// PR-X2-A acquisition surface: cycle-proven bypass does not require any new
// acquisition field to be present.
{
  const state = makeUltraLowCycleProven({
    shallowEpochAcquisitionApplied: undefined,
    shallowEpochAcquisitionEligible: undefined,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok(
    'regression: PR-X2-A acquisition fields remain optional for PR-X2-C bypass',
    reason !== 'ultra_low_rom_not_allowed',
    { reason }
  );
}

// PR-X2-B shallow-close-proof surface: the PR-X2-C predicate is deliberately
// distinct (does NOT require rule/HMM reversal or canonical temporal epoch
// order).  Verify it still yields `cycle_proven_allow` when those fields are
// unset.
{
  const d = computeUltraLowRomVetoRelocationDecision(
    makeUltraLowCycleProven({
      reversalConfirmedByRuleOrHmm: undefined,
      canonicalTemporalEpochOrderSatisfied: undefined,
    })
  );
  ok(
    'regression: X2-C predicate is independent of X2-B strict guards',
    d.mode === 'cycle_proven_allow',
    d
  );
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
