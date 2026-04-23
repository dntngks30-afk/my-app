/**
 * PR-X2-B — Shallow Close Proof Repair smoke.
 *
 * Pins the narrow PR-X2-B contract (see
 * `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md` and
 * `docs/pr/PR-X2-B-implementation-prompt.md`):
 *
 * - when the shallow-cycle-order close proof is satisfied (admitted +
 *   descend + rule/HMM reversal + recovery + ascent-equivalent + temporal
 *   order + setup clean), the evaluator-level `shallow_descent_too_short`
 *   gate MUST be bypassed for all three shallow pass reasons
 *   (low_rom_cycle, ultra_low_rom_cycle, official_shallow_cycle).
 * - when the proof is NOT satisfied, the existing `shallow_descent_too_short`
 *   gate MUST still fire (must-stay-blocked families).
 * - other evaluator gates (phase, reversal-to-standing span, current-rep
 *   ownership, rule-reversal, event-cycle) remain enforced.
 * - no threshold was relaxed: descent-span bypass requires the structural
 *   proof, not a shorter time constant.
 *
 * Run:
 *   npx tsx scripts/camera-pr-x2-b-shallow-close-proof-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
);
const { computeShallowCycleCloseProofDecision } = await import(
  '../src/lib/camera/squat/squat-shallow-close-proof.ts'
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
// Shallow-cycle-order proof base factory.
// Every boolean required by computeShallowCycleCloseProofDecision is set true,
// plus the minimum extra fields the evaluator-level gates expect for each
// completion pass reason.
// ──────────────────────────────────────────────────────────────────────────────

function makeCycleProofBase(overrides = {}) {
  return {
    // Base completion truth
    completionSatisfied: true,
    completionBlockedReason: null,
    relativeDepthPeak: 0.15,
    currentSquatPhase: 'standing_recovered',
    baselineStandingDepth: 0,
    baselineFrozenDepth: 0,
    rawDepthPeakPrimary: 0.15,

    // Timing — descentToPeak intentionally short (< 200ms) to exercise
    // the PR-X2-B bypass; reversalToStanding in safe window.
    squatDescentToPeakMs: 120,
    squatReversalToStandingMs: 2000,

    // Shallow cycle order truth (all satisfied)
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    reversalConfirmedAfterDescend: true,
    reversalConfirmedByRuleOrHmm: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    canonicalTemporalEpochOrderSatisfied: true,
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    eventCyclePromoted: false,
    trajectoryReversalRescueApplied: false,

    // Close/gate dependencies
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    reversalConfirmedBy: 'rule',
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
    },

    ...overrides,
  };
}

function makeLowRomGoldPath(overrides = {}) {
  return makeCycleProofBase({
    completionPassReason: 'low_rom_cycle',
    relativeDepthPeak: 0.19,
    rawDepthPeakPrimary: 0.19,
    ...overrides,
  });
}

function makeOfficialShallowGoldPath(overrides = {}) {
  return makeCycleProofBase({
    completionPassReason: 'official_shallow_cycle',
    ...overrides,
  });
}

function makeUltraLowGoldPath(overrides = {}) {
  return makeCycleProofBase({
    completionPassReason: 'ultra_low_rom_cycle',
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
    relativeDepthPeak: 0.05,
    rawDepthPeakPrimary: 0.05,
    ...overrides,
  });
}

console.log('\nPR-X2-B shallow close proof smoke\n');

// ──────────────────────────────────────────────────────────────────────────────
// A) Unit: computeShallowCycleCloseProofDecision contract table
// ──────────────────────────────────────────────────────────────────────────────

const positive = computeShallowCycleCloseProofDecision(makeCycleProofBase());
ok('unit: cycle-order proof satisfied on the base factory', (
  positive.cycleCloseProofSatisfied === true &&
  positive.cycleCloseProofReason === 'shallow_cycle_order_proved' &&
  positive.cycleCloseProofBlockedReason === null &&
  positive.observationStage === 'shallow_cycle_close_proof_candidate'
), positive);

const setupBlocked = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ setupMotionBlocked: true })
);
ok('unit: setup-blocked never proves', (
  setupBlocked.cycleCloseProofSatisfied === false &&
  setupBlocked.cycleCloseProofBlockedReason === 'setup_blocked'
), setupBlocked);

const readinessBlocked = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ readinessStableDwellSatisfied: false })
);
ok('unit: readiness-unstable never proves', (
  readinessBlocked.cycleCloseProofSatisfied === false &&
  readinessBlocked.cycleCloseProofBlockedReason === 'readiness_unstable'
), readinessBlocked);

const notAdmitted = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ officialShallowPathAdmitted: false })
);
ok('unit: not-admitted never proves', (
  notAdmitted.cycleCloseProofSatisfied === false &&
  notAdmitted.cycleCloseProofBlockedReason === 'not_admitted'
), notAdmitted);

const standardBand = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ relativeDepthPeak: 0.5 })
);
ok('unit: standard/deep band never proves', (
  standardBand.cycleCloseProofSatisfied === false &&
  standardBand.cycleCloseProofBlockedReason === 'standard_or_deep_band'
), standardBand);

const noReversal = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ reversalConfirmedAfterDescend: false })
);
ok('unit: no-reversal never proves', (
  noReversal.cycleCloseProofSatisfied === false &&
  noReversal.cycleCloseProofBlockedReason === 'reversal_not_confirmed'
), noReversal);

const trajectoryOnlyReversal = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ reversalConfirmedByRuleOrHmm: false })
);
ok('unit: trajectory-only reversal never proves (jitter guard)', (
  trajectoryOnlyReversal.cycleCloseProofSatisfied === false &&
  trajectoryOnlyReversal.cycleCloseProofBlockedReason === 'reversal_provenance_insufficient'
), trajectoryOnlyReversal);

const noRecovery = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ recoveryConfirmedAfterReversal: false })
);
ok('unit: no-recovery never proves', (
  noRecovery.cycleCloseProofSatisfied === false &&
  noRecovery.cycleCloseProofBlockedReason === 'recovery_not_confirmed'
), noRecovery);

const temporalDisorder = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ canonicalTemporalEpochOrderSatisfied: false })
);
ok('unit: temporal-order disorder never proves', (
  temporalDisorder.cycleCloseProofSatisfied === false &&
  temporalDisorder.cycleCloseProofBlockedReason === 'temporal_order_not_satisfied'
), temporalDisorder);

const trajectoryRescue = computeShallowCycleCloseProofDecision(
  makeCycleProofBase({ trajectoryReversalRescueApplied: true })
);
ok('unit: trajectory-rescue never proves', (
  trajectoryRescue.cycleCloseProofSatisfied === false &&
  trajectoryRescue.cycleCloseProofBlockedReason === 'trajectory_rescue_applied'
), trajectoryRescue);

// ──────────────────────────────────────────────────────────────────────────────
// B) Evaluator gate — PR-X2-B MUST: bypass shallow_descent_too_short when proof
// ──────────────────────────────────────────────────────────────────────────────

// official_shallow_cycle: descentToPeak=120ms, proof satisfied → no block.
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 120 })
  );
  ok('evaluator: official_shallow_cycle w/ proof + short descent → no block', reason == null, { reason });
}

// ultra_low_rom_cycle: descentToPeak=120ms, proof satisfied → no block.
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeUltraLowGoldPath({ squatDescentToPeakMs: 120 })
  );
  ok('evaluator: ultra_low_rom_cycle w/ proof + short descent → no block', reason == null, { reason });
}

// low_rom_cycle: descentToPeak=120ms, proof satisfied → no block.
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({ squatDescentToPeakMs: 120 })
  );
  ok('evaluator: low_rom_cycle w/ proof + short descent → no block', reason == null, { reason });
}

// Parent-SSOT Case A exact pattern: short descent, full cycle order → no block.
{
  const caseA = makeOfficialShallowGoldPath({
    squatDescentToPeakMs: 80, // typical for ultra-shallow at low fps
  });
  const reason = getShallowMeaningfulCycleBlockReason(caseA);
  ok('evaluator: Case A (short-span + full shallow cycle) → bypass', reason == null, { reason });
}

// ──────────────────────────────────────────────────────────────────────────────
// C) Evaluator gate — must stay blocked: proof NOT satisfied + short descent
// ──────────────────────────────────────────────────────────────────────────────

// No reversal → proof blocked, descent gate must fire.
{
  const state = makeOfficialShallowGoldPath({
    squatDescentToPeakMs: 120,
    reversalConfirmedAfterDescend: false,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok('evaluator: official_shallow + no reversal + short descent → shallow_descent_too_short',
    reason === 'shallow_descent_too_short', { reason });
}

// Trajectory-only reversal → proof blocked, descent gate fires.
{
  const state = makeLowRomGoldPath({
    squatDescentToPeakMs: 120,
    reversalConfirmedByRuleOrHmm: false,
    // low_rom_cycle branch first rejects 'rule_based_reversal_required' via
    // reversalConfirmedBy; keep rule so we can reach the descent gate.
    reversalConfirmedBy: 'rule',
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok('evaluator: low_rom + trajectory-only reversal + short descent → shallow_descent_too_short',
    reason === 'shallow_descent_too_short', { reason });
}

// Setup-blocked → proof blocked, descent gate fires.
{
  const state = makeLowRomGoldPath({
    squatDescentToPeakMs: 120,
    setupMotionBlocked: true,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok('evaluator: low_rom + setup-blocked + short descent → shallow_descent_too_short',
    reason === 'shallow_descent_too_short', { reason });
}

// Missing canonical temporal order → proof blocked, descent gate fires.
{
  const state = makeOfficialShallowGoldPath({
    squatDescentToPeakMs: 120,
    canonicalTemporalEpochOrderSatisfied: false,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok('evaluator: official_shallow + disordered temporal epoch + short descent → shallow_descent_too_short',
    reason === 'shallow_descent_too_short', { reason });
}

// ──────────────────────────────────────────────────────────────────────────────
// D) Other gates must remain enforced even when proof is satisfied.
// Proof bypasses ONLY `shallow_descent_too_short`.
// ──────────────────────────────────────────────────────────────────────────────

// Phase ≠ standing_recovered → still blocked.
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ currentSquatPhase: 'ascending' })
  );
  ok('evaluator: proof + wrong phase → standing_recovered_required (not bypassed)',
    reason === 'standing_recovered_required', { reason });
}

// Short reversal-to-standing → still blocked (proof does NOT bypass this).
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 100 })
  );
  ok('evaluator: proof + short reversal-to-standing → shallow_reversal_to_standing_too_short (not bypassed)',
    reason === 'shallow_reversal_to_standing_too_short', { reason });
}

// Excessive reversal-to-standing → still blocked.
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 9000 })
  );
  ok('evaluator: proof + aggregation span → current_rep_ownership_blocked (not bypassed)',
    reason === 'current_rep_ownership_blocked', { reason });
}

// ──────────────────────────────────────────────────────────────────────────────
// E) Regression: deep / standard pass (not a shallow pass reason) → always null
// ──────────────────────────────────────────────────────────────────────────────

{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    completionSatisfied: true,
    squatDescentToPeakMs: 80,
  });
  ok('regression: standard_cycle is never touched by this gate', reason == null, { reason });
}

// Legacy: already-gold official shallow with long descent → still null (no regress).
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 650 })
  );
  ok('regression: official_shallow gold path (descent=650ms) → no block', reason == null, { reason });
}

// ──────────────────────────────────────────────────────────────────────────────
// F) Invariants — no new veto layer introduced; missing fields do not break
// ──────────────────────────────────────────────────────────────────────────────

const emptyDecision = computeShallowCycleCloseProofDecision(undefined);
ok('invariant: undefined state returns not-evaluated decision', (
  emptyDecision.cycleCloseProofSatisfied === false &&
  emptyDecision.cycleCloseProofBlockedReason === 'not_admitted' &&
  emptyDecision.observationStage === 'not_evaluated'
), emptyDecision);

// PR-X2-A preservation: cycle proof decision is independent of acquisition
// fields — missing acquisition fields do not affect the close proof.
{
  const state = makeOfficialShallowGoldPath({
    shallowEpochAcquisitionApplied: undefined,
    shallowEpochAcquisitionEligible: undefined,
  });
  const reason = getShallowMeaningfulCycleBlockReason(state);
  ok('invariant: PR-X2-A acquisition fields not required for close proof',
    reason == null, { reason });
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
