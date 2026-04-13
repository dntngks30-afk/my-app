/**
 * PR-SQUAT-PASS-OWNER-REALIGN-01 smoke:
 * final pass authority must be completion-owner centered.
 *
 * Run:
 *   npx tsx scripts/camera-squat-pass-owner-realign-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  readSquatPassOwnerTruth,
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

function uiGateInput(overrides = {}) {
  return {
    completionOwnerPassed: true,
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
    ...overrides,
  };
}

function completionState(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    ...overrides,
  };
}

function passCore(overrides = {}) {
  return {
    passDetected: true,
    passBlockedReason: null,
    ...overrides,
  };
}

function finalGateFrom(ownerTruth, cs) {
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: uiGateInput({ completionOwnerPassed: ownerTruth.completionOwnerPassed }),
    squatCompletionState: cs,
    squatCycleDebug: undefined,
  });
}

console.log('\nA. pass-core true only cannot open owner');
{
  const cs = completionState({ completionSatisfied: false, completionPassReason: 'not_confirmed' });
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: cs,
    squatPassCore: passCore({ passDetected: true }),
  });
  const gate = finalGateFrom(ownerTruth, cs);
  ok('A1: owner pass remains false', ownerTruth.completionOwnerPassed === false, ownerTruth);
  ok('A2: final pass remains blocked', gate.progressionPassed === false, gate);
}

console.log('\nB. completion owner true but pass-core false must fail-close');
{
  const cs = completionState();
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: cs,
    squatPassCore: passCore({ passDetected: false, passBlockedReason: 'no_reversal_after_peak' }),
  });
  const gate = finalGateFrom(ownerTruth, cs);
  ok('B1: owner pass revoked by pass-core contradiction', ownerTruth.completionOwnerPassed === false, ownerTruth);
  ok('B2: final pass blocked', gate.progressionPassed === false, gate);
}

console.log('\nC. completion owner true + pass-core true can stay open');
{
  const cs = completionState();
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: cs,
    squatPassCore: passCore(),
  });
  const gate = finalGateFrom(ownerTruth, cs);
  ok('C1: owner pass true', ownerTruth.completionOwnerPassed === true, ownerTruth);
  ok('C2: final pass open', gate.progressionPassed === true && gate.finalPassBlockedReason == null, gate);
}

console.log('\nD. officialShallowPathAdmitted only cannot open pass');
{
  const cs = completionState({
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    officialShallowPathAdmitted: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    eventBasedDescentPath: true,
  });
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: cs,
    squatPassCore: passCore({ passDetected: true }),
  });
  const gate = finalGateFrom(ownerTruth, cs);
  ok('D1: owner pass false despite shallow admission/proof flags', ownerTruth.completionOwnerPassed === false, ownerTruth);
  ok('D2: final pass blocked', gate.progressionPassed === false, gate);
}

console.log(`\npass-owner realign smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

