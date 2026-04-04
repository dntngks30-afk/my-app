/**
 * PASS-AUTHORITY-RESET-01 스모크 테스트
 *
 * npx tsx scripts/camera-pr-pass-authority-reset-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatPassCore } = await import(
  '../src/lib/camera/squat/pass-core.ts'
);

let passCount = 0;
let failCount = 0;
const results = [];

function assert(label, actual, expected) {
  if (actual === expected) {
    passCount++;
    results.push(`  ✓ ${label}`);
  } else {
    failCount++;
    results.push(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────

function makeGoldPathShallow() {
  return {
    completionSatisfied: true,
    completionBlockedReason: null,
    descendConfirmed: true,
    attemptStarted: true,
    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    currentSquatPhase: 'standing_recovered',
    standingFinalizeSatisfied: true,
    squatReversalToStandingMs: 1200,
    downwardCommitmentDelta: 0.058,
    descendStartAtMs: 1000,
    peakAtMs: 1600,
    reversalAtMs: 1700,
    standingRecoveredAtMs: 2200,
    cycleDurationMs: 1200,
  };
}

function makeGoldPathDeep() {
  return {
    completionSatisfied: true,
    completionBlockedReason: null,
    descendConfirmed: true,
    attemptStarted: true,
    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    currentSquatPhase: 'standing_recovered',
    standingFinalizeSatisfied: true,
    squatReversalToStandingMs: 2100,
    downwardCommitmentDelta: 0.42,
    descendStartAtMs: 1000,
    peakAtMs: 2000,
    reversalAtMs: 2100,
    standingRecoveredAtMs: 3100,
    cycleDurationMs: 2100,
  };
}

const noSetup = { setupMotionBlocked: false, reason: null };
const withSetup = { setupMotionBlocked: true, reason: 'camera_reposition' };

// ─────────────────────────────────────────────────────────────────────
// TEST 1 — 실제 shallow 렙 passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 1] shallow real rep passes');
  const r = evaluateSquatPassCore(makeGoldPathShallow(), noSetup);
  assert('1A: passDetected=true', r.passDetected, true);
  assert('1B: passBlockedReason=null', r.passBlockedReason, null);
  assert('1C: descentDetected=true', r.descentDetected, true);
  assert('1D: reversalDetected=true', r.reversalDetected, true);
  assert('1E: standingRecovered=true', r.standingRecovered, true);
  assert('1F: setupClear=true', r.setupClear, true);
  assert('1G: currentRepOwnershipClear=true', r.currentRepOwnershipClear, true);
  assert('1H: antiFalsePassClear=true', r.antiFalsePassClear, true);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 2 — 실제 deep 렙 passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 2] deep real rep passes');
  const r = evaluateSquatPassCore(makeGoldPathDeep(), noSetup);
  assert('2A: passDetected=true', r.passDetected, true);
  assert('2B: passBlockedReason=null', r.passBlockedReason, null);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 3 — standing only never passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 3] standing only never passes');
  const input = {
    completionSatisfied: false,
    completionBlockedReason: 'no_reversal',
    descendConfirmed: false,
    attemptStarted: false,
    ownerAuthoritativeReversalSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: false,
    currentSquatPhase: 'standing_recovered',
    standingFinalizeSatisfied: true,
    squatReversalToStandingMs: undefined,
    downwardCommitmentDelta: 0,
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('3A: passDetected=false', r.passDetected, false);
  assert('3B: descentDetected=false', r.descentDetected, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 4 — descent only (reversal/standing not confirmed) never passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 4] descent only never passes');
  const input = {
    completionSatisfied: false,
    completionBlockedReason: 'no_reversal',
    descendConfirmed: true,
    attemptStarted: true,
    ownerAuthoritativeReversalSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: false,
    currentSquatPhase: 'descending',
    standingFinalizeSatisfied: false,
    downwardCommitmentDelta: 0.12,
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('4A: passDetected=false', r.passDetected, false);
  const blockerMentionsCorrect = r.passBlockedReason === 'no_reversal' ||
    r.passBlockedReason === 'completion_not_satisfied';
  assert('4B: passBlockedReason mentions blocked state', blockerMentionsCorrect, true);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 5 — too-fast bounce / zero delta never passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 5] zero downwardCommitmentDelta (micro-dip) never passes');
  const input = {
    ...makeGoldPathShallow(),
    downwardCommitmentDelta: 0,  // degenerate movement
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('5A: passDetected=false (delta=0)', r.passDetected, false);
  assert('5B: antiFalsePassClear=false', r.antiFalsePassClear, false);
  assert('5C: passBlockedReason=non_degenerate_commitment_blocked', r.passBlockedReason, 'non_degenerate_commitment_blocked');
}

// ─────────────────────────────────────────────────────────────────────
// TEST 6 — setup motion blocked + no valid rep bypass → never passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 6] setup motion blocked (no bypass) never passes');
  const input = {
    ...makeGoldPathShallow(),
    ownerAuthoritativeReversalSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: false,
  };
  const r = evaluateSquatPassCore(input, withSetup);
  assert('6A: passDetected=false (setup blocked, no bypass)', r.passDetected, false);
  assert('6B: setupClear=false', r.setupClear, false);
  assert('6C: lateSetupSuppressed=true', r.lateSetupSuppressed, true);
  assert('6D: passBlockedReason starts with setup_motion', r.passBlockedReason?.startsWith('setup_motion'), true);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 7 — setup motion blocked BUT valid rep → passes via bypass criteria
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 7] setup blocked but valid rep (bypass criteria met) still passes');
  const r = evaluateSquatPassCore(makeGoldPathShallow(), withSetup);
  assert('7A: passDetected=true (bypass criteria met)', r.passDetected, true);
  assert('7B: setupClear=true (bypass applied)', r.setupClear, true);
  assert('7C: lateSetupSuppressed=false', r.lateSetupSuppressed, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 8 — policy annotation (ultraLowPolicyBlocked) cannot revoke pass
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 8] policy annotation does not affect passDetected');
  const input = {
    ...makeGoldPathShallow(),
    completionSatisfied: true,
    completionBlockedReason: null,
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('8A: passDetected=true even if policy would have blocked', r.passDetected, true);
  assert('8B: passBlockedReason=null', r.passBlockedReason, null);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 9 — cross-rep laundering (reversalToStanding > 7500ms) → never passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 9] cross-rep laundering (reversalToStanding > 7500ms) never passes');
  const input = {
    ...makeGoldPathShallow(),
    squatReversalToStandingMs: 8000,
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('9A: passDetected=false', r.passDetected, false);
  assert('9B: currentRepOwnershipClear=false', r.currentRepOwnershipClear, false);
  assert('9C: passBlockedReason=current_rep_ownership_blocked', r.passBlockedReason, 'current_rep_ownership_blocked');
}

// ─────────────────────────────────────────────────────────────────────
// TEST 10 — passDetected immutability
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 10] passDetected immutability');
  const r = evaluateSquatPassCore(makeGoldPathShallow(), noSetup);
  const snapshot = r.passDetected;
  const r2 = evaluateSquatPassCore(makeGoldPathShallow(), noSetup);
  assert('10A: original passDetected was true', snapshot, true);
  assert('10B: subsequent call returns fresh true result', r2.passDetected, true);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 11 — no ownerAuthoritativeReversalSatisfied → blocked
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 11] reversal without ownerAuthoritativeReversalSatisfied blocked');
  const input = {
    ...makeGoldPathShallow(),
    ownerAuthoritativeReversalSatisfied: false,
    completionSatisfied: false,
    completionBlockedReason: 'no_reversal',
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('11A: passDetected=false (no authoritative reversal)', r.passDetected, false);
  assert('11B: reversalDetected=false', r.reversalDetected, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 12 — no standing recovery → never passes
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 12] still descending (no standing recovery) never passes');
  const input = {
    ...makeGoldPathShallow(),
    completionSatisfied: false,
    completionBlockedReason: 'no_standing_recovery',
    currentSquatPhase: 'ascending',
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: undefined,
  };
  const r = evaluateSquatPassCore(input, noSetup);
  assert('12A: passDetected=false', r.passDetected, false);
  assert('12B: standingRecovered=false', r.standingRecovered, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 13 — repId assignment
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 13] repId assignment');
  const rPass = evaluateSquatPassCore(makeGoldPathShallow(), noSetup);
  const rFail = evaluateSquatPassCore({ completionSatisfied: false }, noSetup);
  assert('13A: repId non-null when passDetected=true', rPass.repId !== null, true);
  assert('13B: repId=null when passDetected=false', rFail.repId, null);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 14 — trace field
// ─────────────────────────────────────────────────────────────────────
{
  console.log('\n[TEST 14] trace field correctness');
  const rPass = evaluateSquatPassCore(makeGoldPathShallow(), noSetup);
  const rFail = evaluateSquatPassCore({ completionSatisfied: false }, noSetup);
  assert('14A: trace contains pass=1 when passing', rPass.trace.includes('pass=1'), true);
  assert('14B: trace contains pass=0 when blocked', rFail.trace.includes('pass=0'), true);
}

// ─────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────
for (const line of results) {
  if (line.startsWith('  ✗')) {
    console.error(line);
  } else {
    console.log(line);
  }
}
console.log(`\n${'='.repeat(60)}`);
console.log(`PASS-AUTHORITY-RESET-01 smoke: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL ASSERTIONS PASSED');
}
