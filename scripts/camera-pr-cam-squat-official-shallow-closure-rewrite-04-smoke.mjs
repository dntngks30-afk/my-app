/**
 * PR-4 -- Official Shallow Closure Rewrite.
 *
 * Smoke coverage for SSOT §4.3 closure rules:
 *   - Family A (Strict Shallow Cycle) requires real descend/reversal/recovery
 *     + meaningful standing recovery proof
 *   - Family B (Shallow Ascent Equivalent) requires descend + directional
 *     reversal + ascent-equivalent + recovery proof
 *   - Once a family is satisfied, the listed standard vetos no longer kill
 *     official shallow closure (`descent_span_too_short`,
 *     `ascent_recovery_span_too_short`, `recovery_hold_too_short`,
 *     `not_standing_recovered`, `low_rom_standing_finalize_not_satisfied`,
 *     `ultra_low_rom_standing_finalize_not_satisfied`, `no_reversal`)
 *   - Closure remains non-permissive: setup-motion / standing-still /
 *     seated-hold do NOT satisfy any closure family
 *   - PR-2 false-pass guard remains independent
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-official-shallow-closure-rewrite-04-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  resolveOfficialShallowClosureContract,
  isStandardVetoSuppressibleByOfficialShallowClosure,
} = await import('../src/lib/camera/squat/squat-completion-core.ts');

const {
  readOfficialShallowClosureSnapshot,
  readOfficialShallowFalsePassGuardSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  console.error(`  FAIL: ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  process.exitCode = 1;
}

function strictCycleInput(overrides = {}) {
  return {
    descendConfirmed: true,
    reversalConfirmedAfterDescend: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1320,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
    ...overrides,
  };
}

function ascentEquivalentInput(overrides = {}) {
  return {
    descendConfirmed: true,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1320,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    provenanceReversalEvidencePresent: true,
    shallowClosureProofBundleFromStream: true,
    ...overrides,
  };
}

console.log('\nPR-4 official shallow closure rewrite smoke\n');

// =============================================================================
// Family A — Strict Shallow Cycle
// =============================================================================
{
  const r = resolveOfficialShallowClosureContract(strictCycleInput());
  ok('A1: strict shallow cycle satisfied', r.satisfied === true, r);
  ok('A1: family=strict_shallow_cycle', r.family === 'strict_shallow_cycle', r);
  ok('A1: strict flag true', r.strictShallowCycleSatisfied === true, r);
}

// Family A requires REAL reversal — stream-bridge alone does NOT satisfy A.
{
  const r = resolveOfficialShallowClosureContract(
    strictCycleInput({
      reversalConfirmedAfterDescend: false,
      officialShallowStreamBridgeApplied: true,
      provenanceReversalEvidencePresent: true,
      officialShallowAscentEquivalentSatisfied: false,
    })
  );
  ok('A2: stream-bridge alone does not satisfy strict cycle', r.strictShallowCycleSatisfied === false, r);
  ok('A2: also does not satisfy ascent equivalent (no ascent)', r.shallowAscentEquivalentSatisfied === false, r);
  ok('A2: family null', r.family === null, r);
}

// Family A requires recovery confirmed.
{
  const r = resolveOfficialShallowClosureContract(
    strictCycleInput({ ownerAuthoritativeRecoverySatisfied: false })
  );
  ok('A3: missing recovery -> strict not satisfied', r.strictShallowCycleSatisfied === false, r);
}

// Family A requires standing recovery proof (finalize + timestamp).
{
  const r = resolveOfficialShallowClosureContract(
    strictCycleInput({ standingFinalizeSatisfied: false })
  );
  ok('A4: missing standing finalize -> strict not satisfied', r.strictShallowCycleSatisfied === false, r);
}

{
  const r = resolveOfficialShallowClosureContract(
    strictCycleInput({ standingRecoveredAtMs: null })
  );
  ok('A5: missing standing timestamp -> strict not satisfied', r.strictShallowCycleSatisfied === false, r);
}

// Family A requires descend.
{
  const r = resolveOfficialShallowClosureContract(strictCycleInput({ descendConfirmed: false }));
  ok('A6: no descend -> strict not satisfied', r.strictShallowCycleSatisfied === false, r);
}

// =============================================================================
// Family B — Shallow Ascent Equivalent
// =============================================================================
{
  const r = resolveOfficialShallowClosureContract(ascentEquivalentInput());
  ok('B1: shallow ascent equivalent satisfied', r.satisfied === true, r);
  ok('B1: family=shallow_ascent_equivalent', r.family === 'shallow_ascent_equivalent', r);
}

// Family B accepts rule reversal too (not only stream-bridge).
{
  const r = resolveOfficialShallowClosureContract(
    ascentEquivalentInput({
      reversalConfirmedAfterDescend: true,
      officialShallowStreamBridgeApplied: false,
      provenanceReversalEvidencePresent: false,
    })
  );
  ok('B2: rule reversal also satisfies family B', r.shallowAscentEquivalentSatisfied === true, r);
}

// Family B requires directional reversal — stream-bridge without provenance is NOT enough.
{
  const r = resolveOfficialShallowClosureContract(
    ascentEquivalentInput({
      reversalConfirmedAfterDescend: false,
      officialShallowStreamBridgeApplied: true,
      provenanceReversalEvidencePresent: false,
    })
  );
  ok('B3: stream-bridge without provenance -> B not satisfied', r.shallowAscentEquivalentSatisfied === false, r);
}

// Family B requires ascent equivalent (the upward-return magnitude leg).
{
  const r = resolveOfficialShallowClosureContract(
    ascentEquivalentInput({ officialShallowAscentEquivalentSatisfied: false })
  );
  ok('B4: no ascent-equivalent -> B not satisfied', r.shallowAscentEquivalentSatisfied === false, r);
}

// Family B requires recovery proof — neither timestamp nor stream bundle => fail.
{
  const r = resolveOfficialShallowClosureContract(
    ascentEquivalentInput({
      standingRecoveredAtMs: null,
      shallowClosureProofBundleFromStream: false,
    })
  );
  ok('B5: no recovery proof -> B not satisfied', r.shallowAscentEquivalentSatisfied === false, r);
}

// Family B requires descend.
{
  const r = resolveOfficialShallowClosureContract(
    ascentEquivalentInput({ descendConfirmed: false })
  );
  ok('B6: no descend -> B not satisfied', r.shallowAscentEquivalentSatisfied === false, r);
}

// =============================================================================
// Anti-permissive: weird-pass inputs never satisfy any family
// =============================================================================
{
  // Setup-motion / standing-still: no descend
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: false,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok('C1: standing-still inputs -> no closure', r.satisfied === false, r);
  ok('C1: family null', r.family === null, r);
}

{
  // Seated-hold: descend may be confirmed but no real reversal/recovery
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok('C2: seated-hold (no reversal, no recovery) -> no closure', r.satisfied === false, r);
}

// =============================================================================
// Standard veto suppressibility
// =============================================================================
const SUPPRESSIBLE = [
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
  'recovery_hold_too_short',
  'not_standing_recovered',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'no_reversal',
];
for (const reason of SUPPRESSIBLE) {
  ok(
    `D: '${reason}' is suppressible by shallow closure`,
    isStandardVetoSuppressibleByOfficialShallowClosure(reason) === true
  );
}

const NON_SUPPRESSIBLE = [
  'not_armed',
  'no_descend',
  'insufficient_relative_depth',
  'no_commitment',
  'no_downward_commitment',
  null,
  undefined,
  '',
];
for (const reason of NON_SUPPRESSIBLE) {
  ok(
    `D: '${String(reason)}' is NOT suppressible (admission/non-cycle blocker)`,
    isStandardVetoSuppressibleByOfficialShallowClosure(reason) === false
  );
}

// =============================================================================
// Closure snapshot mirrors completion state
// =============================================================================
{
  const snap = readOfficialShallowClosureSnapshot({
    squatCompletionState: {
      officialShallowPathClosed: true,
      officialShallowClosureFamily: 'strict_shallow_cycle',
      officialShallowClosureRewriteApplied: true,
      officialShallowClosureRewriteSuppressedReason: 'descent_span_too_short',
    },
  });
  ok('E1: snapshot.closed', snap.officialShallowClosed === true, snap);
  ok('E1: snapshot.family', snap.officialShallowClosureFamily === 'strict_shallow_cycle', snap);
  ok('E1: snapshot.rewriteApplied', snap.officialShallowClosureRewriteApplied === true, snap);
  ok(
    'E1: snapshot.suppressedReason',
    snap.officialShallowClosureRewriteSuppressedReason === 'descent_span_too_short',
    snap
  );
}

{
  const snap = readOfficialShallowClosureSnapshot({
    squatCompletionState: {
      officialShallowPathClosed: false,
      officialShallowClosureFamily: null,
      officialShallowClosureRewriteApplied: false,
      officialShallowClosureRewriteSuppressedReason: null,
    },
  });
  ok('E2: snapshot defaults clean', snap.officialShallowClosed === false && snap.officialShallowClosureFamily === null, snap);
}

{
  const snap = readOfficialShallowClosureSnapshot({ squatCompletionState: undefined });
  ok('E3: snapshot from undefined state', snap.officialShallowClosed === false, snap);
}

// =============================================================================
// Layered safety: PR-2 false-pass guard remains independent of PR-4 closure
// =============================================================================
{
  // Even if PR-4 makes closure satisfied, PR-2 still gates pass via signals
  // like setupMotionBlocked / stillSeatedAtPass / canonical epoch ledger.
  const guard = readOfficialShallowFalsePassGuardSnapshot({
    squatCompletionState: {
      officialShallowPathClosed: true,
      officialShallowClosureFamily: 'shallow_ascent_equivalent',
      officialShallowClosureRewriteApplied: true,
      setupMotionBlocked: true,
      currentSquatPhase: 'standing_recovered',
      cycleComplete: true,
      attemptStarted: true,
      descendConfirmed: true,
      downwardCommitmentReached: true,
      downwardCommitmentDelta: 0.04,
      reversalConfirmedAfterDescend: true,
      recoveryConfirmedAfterReversal: true,
      officialShallowReversalSatisfied: true,
      ownerAuthoritativeRecoverySatisfied: true,
      standingFinalizeSatisfied: true,
      standingRecoveredAtMs: 1320,
      attemptStartedAfterReady: true,
      readinessStableDwellSatisfied: true,
      evidenceLabel: 'low_rom',
      peakLatchedAtIndex: 4,
      officialShallowClosureProofSatisfied: true,
      canonicalShallowContractAntiFalsePassClear: true,
      canonicalTemporalEpochOrderSatisfied: true,
      squatEventCycle: { detected: true, descentFrames: 3, notes: [] },
    },
  });
  ok(
    'F1: PR-4 closure does not bypass PR-2 setup_motion_blocked',
    guard.officialShallowFalsePassGuardClear === false &&
      guard.officialShallowFalsePassGuardFamily === 'setup_motion_blocked',
    guard
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
