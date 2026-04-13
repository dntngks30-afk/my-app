/**
 * LEGIT-SHALLOW-DOWN-UP-PASS-01 smoke.
 *
 * Verifies that a legitimate shallow rep (meaningful descent → reversal → recovery)
 * passes the canonical contract — both low_rom and ultra_low_rom bands.
 *
 * Run:
 *   npx tsx scripts/camera-squat-legit-shallow-down-up-pass-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  deriveCanonicalShallowCompletionContract,
} = await import('../src/lib/camera/squat/shallow-completion-contract.ts');
const {
  buildCanonicalShallowContractInputFromState,
} = await import('../src/lib/camera/squat/squat-completion-canonical.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
  console.error(`  FAIL: ${name}${detail}`);
  process.exitCode = 1;
}

function legitShallowState(overrides = {}) {
  return {
    relativeDepthPeak: 0.22,
    evidenceLabel: 'low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.08,
    currentSquatPhase: 'standing_recovered',
    completionBlockedReason: null,
    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    provenanceReversalEvidencePresent: false,
    trajectoryReversalRescueApplied: false,
    reversalTailBackfillApplied: false,
    ultraShallowMeaningfulDownUpRescueApplied: false,
    standingFinalizeSatisfied: true,
    standingRecoveryFinalizeReason: 'standing_hold_met',
    setupMotionBlocked: false,
    peakLatchedAtIndex: 4,
    guardedShallowLocalPeakFound: false,
    guardedShallowLocalPeakIndex: null,
    officialShallowPathClosed: false,
    completionPassReason: 'not_confirmed',
    completionSatisfied: false,
    cycleDurationMs: 1400,
    baselineFrozen: true,
    peakLatched: true,
    reversalConfirmedByRuleOrHmm: true,
    squatReversalToStandingMs: 900,
    squatEventCycle: { detected: true, notes: [], descentFrames: 6 },
    ...overrides,
  };
}

console.log('\nA. legit low_rom shallow rep passes canonical contract');
{
  const state = legitShallowState();
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('A1: contract satisfied', contract.satisfied === true, contract);
  ok('A2: antiFalsePassClear true', contract.antiFalsePassClear === true, contract);
  ok('A3: reversalEvidenceSatisfied true', contract.reversalEvidenceSatisfied === true, contract);
  ok('A4: recoveryEvidenceSatisfied true', contract.recoveryEvidenceSatisfied === true, contract);
  ok('A5: blockedReason null', contract.blockedReason === null, contract);
}

console.log('\nB. legit ultra_low_rom shallow rep passes canonical contract');
{
  const state = legitShallowState({
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    peakLatchedAtIndex: 3,
    cycleDurationMs: 900,
  });
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('B1: ultra_low_rom contract satisfied', contract.satisfied === true, contract);
  ok('B2: blockedReason null', contract.blockedReason === null, contract);
}

console.log('\nC. fast but valid shallow rep (cycleDurationMs=850) passes minimum cycle gate');
{
  const state = legitShallowState({
    cycleDurationMs: 850,
  });
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('C1: 850ms cycle passes minimum cycle timing', contract.minimumCycleTimingClear === true, contract);
  ok('C2: contract satisfied', contract.satisfied === true, contract);
}

console.log('\nD. standing/seated false-pass scenarios blocked');
{
  // D1: no descent — standing only
  const d1 = legitShallowState({ descendConfirmed: false, downwardCommitmentDelta: 0 });
  const c1 = deriveCanonicalShallowCompletionContract(buildCanonicalShallowContractInputFromState(d1));
  ok('D1: standing-only blocked (no descent)', c1.satisfied === false, c1);

  // D2: no commitment — midway down
  const d2 = legitShallowState({ downwardCommitmentReached: false });
  const c2 = deriveCanonicalShallowCompletionContract(buildCanonicalShallowContractInputFromState(d2));
  ok('D2: mid-descent blocked (no commitment)', c2.satisfied === false, c2);

  // D3: no authoritative reversal — ascending but no confirmed reversal
  const d3 = legitShallowState({
    ownerAuthoritativeReversalSatisfied: false,
    reversalConfirmedByRuleOrHmm: false,
  });
  const c3 = deriveCanonicalShallowCompletionContract(buildCanonicalShallowContractInputFromState(d3));
  ok('D3: no reversal blocked', c3.satisfied === false, c3);

  // D4: no recovery
  const d4 = legitShallowState({
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
  });
  const c4 = deriveCanonicalShallowCompletionContract(buildCanonicalShallowContractInputFromState(d4));
  ok('D4: no recovery blocked', c4.satisfied === false, c4);
}

console.log(`\nlegit shallow down-up pass smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
