/**
 * PR-CAM-SQUAT-MEANINGFUL-SHALLOW-GATE-01
 *
 * Run:
 *   npx tsx scripts/camera-pr-squat-meaningful-shallow-gate-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  getShallowMeaningfulCycleBlockReason,
  demoteMeaninglessShallowPass,
} = await import('../src/lib/camera/evaluators/squat-meaningful-shallow.ts');

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
    completionSatisfied: true,
    completionPassReason: 'low_rom_cycle',
    completionBlockedReason: null,
    relativeDepthPeak: 0.19,
    currentSquatPhase: 'standing_recovered',
    trajectoryReversalRescueApplied: false,
    eventCyclePromoted: false,
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 650,
    squatReversalToStandingMs: 384,
    baselineStandingDepth: 0,
    baselineFrozenDepth: 0,
    rawDepthPeakPrimary: 0.188,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
      source: 'rule_plus_hmm',
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
    completionHints: [],
    debug: {
      squatCompletionState: state,
      highlightedMetrics: {
        completionSatisfied: true,
        completionPassReason: 'low_rom_cycle',
        completionBlockedReason: null,
      },
    },
  };
}

console.log('\nP1. valid low-rom rule cycle should survive');
{
  const reason = getShallowMeaningfulCycleBlockReason(makeState());
  ok('P1: reason null', reason === null);
}

console.log('\nP2. ultra-low should be rejected');
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeState({ completionPassReason: 'ultra_low_rom_cycle', relativeDepthPeak: 0.058 })
  );
  ok('P2: blocked', reason === 'ultra_low_rom_not_allowed');
}

console.log('\nP3. trajectory rescue shallow should be rejected');
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeState({ trajectoryReversalRescueApplied: true, reversalConfirmedBy: 'trajectory' })
  );
  ok('P3: blocked', reason === 'trajectory_rescue_not_allowed');
}

console.log('\nP4. event promotion shallow should be rejected');
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeState({ eventCyclePromoted: true })
  );
  ok('P4: blocked', reason === 'event_promotion_not_allowed');
}

console.log('\nP5. demotion should zero-out shallow pass');
{
  const result = makeResult();
  const next = demoteMeaninglessShallowPass(result, 'event_promotion_not_allowed');
  ok('P5: completionSatisfied false', next.debug.squatCompletionState.completionSatisfied === false);
  ok('P5: pass reason reset', next.debug.squatCompletionState.completionPassReason === 'not_confirmed');
  ok('P5: blocked reason set', next.debug.squatCompletionState.completionBlockedReason === 'event_promotion_not_allowed');
}

console.log('\nP6. standard cycle should not be touched by shallow gate');
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeState({ completionPassReason: 'standard_cycle', relativeDepthPeak: 0.8 })
  );
  ok('P6: reason null', reason === null);
}

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
