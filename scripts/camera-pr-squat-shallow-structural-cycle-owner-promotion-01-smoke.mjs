/**
 * PR-CAM-SQUAT-SHALLOW-STRUCTURAL-CYCLE-OWNER-PROMOTION-01
 *
 * 얕은 정상 down-up structural cycle만 bounded fallback으로 승격되는지 검증.
 *
 * Run:
 *   npx tsx scripts/camera-pr-squat-shallow-structural-cycle-owner-promotion-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  shouldPromoteShallowStructuralCycleResult,
  promoteSquatResultWithShallowStructuralCycle,
} = await import('../src/lib/camera/evaluators/squat-shallow-structural-owner.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

function makeState(overrides = {}) {
  return {
    relativeDepthPeak: 0.0586,
    evidenceLabel: 'ultra_low_rom',
    standingRecoveryBand: 'ultra_low_rom',
    recoveryReturnContinuityFrames: 4,
    recoveryDropRatio: 0.5,
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    ruleCompletionBlockedReason: 'no_reversal',
    completionBlockedReason: 'no_reversal',
    officialShallowPathAdmitted: true,
    officialShallowPathCandidate: true,
    officialShallowPathClosed: false,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    trajectoryReversalRescueApplied: true,
    currentSquatPhase: 'standing_recovered',
    descendStartAtMs: 21000,
    peakAtMs: 21592.4,
    reversalAtMs: 22017.5,
    standingRecoveredAtMs: 24654.6,
    recoveryConfirmedAfterReversal: true,
    standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
    peakLatched: true,
    peakLatchedAtIndex: 6,
    squatDescentToPeakMs: 592.4,
    squatReversalToStandingMs: 3637.1,
    squatEventCycle: {
      detected: false,
      band: null,
      source: 'rule',
      notes: ['descent_weak'],
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
      reversalFrames: 32,
      recoveryFrames: 3,
    },
    ...overrides,
  };
}

function makeResult(stateOverrides = {}) {
  const state = makeState(stateOverrides);
  return {
    stepId: 'squat',
    metrics: [],
    rawMetrics: [],
    interpretedSignals: [],
    qualityHints: [],
    completionHints: ['rep_phase_incomplete', 'no_reversal'],
    debug: {
      squatCompletionState: state,
      squatEventCycle: state.squatEventCycle,
      highlightedMetrics: {
        completionMachinePhase: 'recovered',
        completionPassReason: 'not_confirmed',
        completionSatisfied: false,
        completionBlockedReason: 'no_reversal',
        squatEventCycleDetected: 0,
        squatEventCycleBandCode: 0,
        squatEventCyclePromoted: 0,
        squatEventCycleSourceCode: 1,
      },
    },
  };
}

console.log('\nP1. Too-fast shallow quick return should NOT promote');
{
  const d = shouldPromoteShallowStructuralCycleResult(
    makeState({
      peakLatchedAtIndex: 1,
      squatDescentToPeakMs: 102,
      squatReversalToStandingMs: 120,
    })
  );
  ok('P1: not promoted', d.ok === false);
}

console.log('\nP2. Missing trajectory rescue should NOT promote');
{
  const d = shouldPromoteShallowStructuralCycleResult(
    makeState({ trajectoryReversalRescueApplied: false })
  );
  ok('P2: not promoted', d.ok === false);
}

console.log('\nP3. Finalize missing should NOT promote');
{
  const d = shouldPromoteShallowStructuralCycleResult(
    makeState({ standingRecoveryFinalizeReason: 'tail_hold_below_min' })
  );
  ok('P3: not promoted', d.ok === false);
}

console.log('\nP4. Valid ultra-low structural cycle SHOULD promote');
{
  const d = shouldPromoteShallowStructuralCycleResult(makeState());
  ok('P4: promoted', d.ok === true);
  ok('P4: ultra_low_rom band', d.band === 'ultra_low_rom');
}

console.log('\nP5. Valid low-rom structural cycle SHOULD rewrite result');
{
  const result = makeResult({
    relativeDepthPeak: 0.09,
    evidenceLabel: 'low_rom',
    standingRecoveryBand: 'low_rom',
    standingRecoveryFinalizeReason: 'low_rom_guarded_finalize',
  });
  const next = promoteSquatResultWithShallowStructuralCycle(result);
  ok('P5: completionSatisfied true', next.debug.squatCompletionState.completionSatisfied === true);
  ok('P5: low_rom_cycle', next.debug.squatCompletionState.completionPassReason === 'low_rom_cycle');
  ok('P5: event cycle detected', next.debug.squatEventCycle.detected === true);
  ok('P5: no_reversal hint removed', !next.completionHints.includes('no_reversal'));
}

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
