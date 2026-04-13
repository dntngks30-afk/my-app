/**
 * PR-SQUAT-SHALLOW-ADMISSIBILITY-REOPEN-01 smoke.
 *
 * Run:
 *   npx tsx scripts/camera-squat-shallow-admissibility-reopen-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatCompletionOwnerTruth,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const {
  computeSquatPostOwnerPreLatchGateLayer,
} = await import('../src/lib/camera/auto-progression.ts');

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

function uiGateInput(ownerPassed) {
  return {
    completionOwnerPassed: ownerPassed,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.7,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    liveReadinessNotReady: false,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
  };
}

function run(state) {
  const ownerTruth = computeSquatCompletionOwnerTruth({
    squatCompletionState: state,
  });
  const gate = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: uiGateInput(ownerTruth.completionOwnerPassed),
    squatCompletionState: state,
    squatCycleDebug: undefined,
  });
  return { ownerTruth, gate };
}

// SINGLE-WRITER-RESTORATION: The reopen no longer sets completionOwnerReason.
// owner truth is a reader: it returns the completionPassReason directly.
// A legit shallow close now uses 'official_shallow_cycle' (from canonical closer).
console.log('\nA. canonical closer path: owner truth reads completionPassReason directly');
{
  const state = {
    completionSatisfied: true,
    completionPassReason: 'official_shallow_cycle',
    completionOwnerReason: null,
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    officialShallowPathAdmitted: true,
  };
  const r = run(state);
  ok('A1: owner pass true', r.ownerTruth.completionOwnerPassed === true, r.ownerTruth);
  ok('A2: owner reason is completionPassReason (official_shallow_cycle)', r.ownerTruth.completionOwnerReason === 'official_shallow_cycle', r.ownerTruth);
  ok('A3: final pass open', r.gate.progressionPassed === true && r.gate.finalPassBlockedReason == null, r.gate);
}

console.log('\nB. false-positive lock: candidate-only shallow flags cannot reopen');
{
  const state = {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionOwnerReason: null,
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: false,
    officialShallowPathAdmitted: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    eventBasedDescentPath: true,
  };
  const r = run(state);
  ok('B1: owner remains blocked', r.ownerTruth.completionOwnerPassed === false, r.ownerTruth);
  ok('B2: final pass remains blocked', r.gate.progressionPassed === false, r.gate);
}

console.log('\nC. not_confirmed pass reason always blocks owner truth');
{
  const state = {
    completionSatisfied: true,
    completionPassReason: 'not_confirmed',
    completionOwnerReason: null,
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
  };
  const r = run(state);
  ok('C1: owner blocked when pass reason is not_confirmed', r.ownerTruth.completionOwnerPassed === false, r.ownerTruth);
  ok('C2: final pass blocked', r.gate.progressionPassed === false, r.gate);
}

console.log(`\nshallow admissibility reopen smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
