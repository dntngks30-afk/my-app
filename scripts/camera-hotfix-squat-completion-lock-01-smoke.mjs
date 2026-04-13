/**
 * HOTFIX smoke: completion false must never open squat final pass.
 *
 * Run:
 *   npx tsx scripts/camera-hotfix-squat-completion-lock-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { computeSquatPostOwnerPreLatchGateLayer } = await import('../src/lib/camera/auto-progression.ts');

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

function ownerTruth(overrides = {}) {
  return {
    completionOwnerPassed: true,
    completionOwnerReason: 'standard_cycle',
    completionOwnerBlockedReason: null,
    ...overrides,
  };
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
    cycleComplete: true,
    ...overrides,
  };
}

function runCase({ owner, gate, cs }) {
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth: owner ?? ownerTruth(),
    uiGateInput: gate ?? uiGateInput(),
    squatCompletionState: cs ?? completionState(),
    squatCycleDebug: undefined,
  });
}

console.log('\nA. Control case');
{
  const r = runCase({});
  ok('A1: control stays pass-open', r.progressionPassed === true && r.finalPassBlockedReason == null, r);
}

console.log('\nB. Locked contradiction cases');
{
  const b1 = runCase({
    cs: completionState({ completionSatisfied: false, completionPassReason: 'not_confirmed', cycleComplete: false }),
  });
  ok('B1: completionTruthPassed=false cannot open finalPassEligible', b1.progressionPassed === false, b1);

  const b2 = runCase({
    cs: completionState({ completionSatisfied: false, completionPassReason: 'not_confirmed' }),
  });
  ok('B2: completionTruthPassed=false cannot reach finalPassLatched path', b2.progressionPassed === false, b2);

  const b3 = runCase({
    owner: ownerTruth({ completionOwnerReason: 'not_confirmed' }),
  });
  ok('B3: completionOwnerReason=not_confirmed cannot open final pass', b3.progressionPassed === false, b3);

  const b4 = runCase({
    cs: completionState({ completionBlockedReason: 'descent_span_too_short' }),
  });
  ok('B4: completionBlockedReason!=null cannot open final pass', b4.progressionPassed === false, b4);

  const b5 = runCase({
    cs: completionState({ cycleComplete: false }),
  });
  ok('B5: cycleComplete=false cannot open final pass', b5.progressionPassed === false, b5);
}

console.log(`\nHOTFIX squat completion lock smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

