/**
 * PR-SQUAT-SHALLOW-REOPEN-CANONICAL-CLOSURE-ALIGN-01 smoke.
 *
 * Run:
 *   npx tsx scripts/camera-squat-shallow-reopen-canonical-closure-align-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
);
const { computeSquatCompletionOwnerTruth } = await import(
  '../src/lib/camera/squat/squat-progression-contract.ts'
);
const { computeSquatPostOwnerPreLatchGateLayer } = await import(
  '../src/lib/camera/auto-progression.ts'
);

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

function runFinalGate(state) {
  const ownerTruth = computeSquatCompletionOwnerTruth({
    squatCompletionState: state,
  });
  const gate = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: {
      completionOwnerPassed: ownerTruth.completionOwnerPassed,
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
    },
    squatCompletionState: state,
    squatCycleDebug: undefined,
  });
  return { ownerTruth, gate };
}

console.log('\nA. reopen-aligned low_rom survives validator + final gate');
{
  const state = {
    completionSatisfied: true,
    completionPassReason: 'low_rom_cycle',
    completionOwnerReason: 'shallow_complete_rule',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    relativeDepthPeak: 0.12,
    officialShallowPathClosed: true,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowClosureProofSatisfied: true,
    trajectoryReversalRescueApplied: false,
    eventCyclePromoted: false,
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 320,
    squatReversalToStandingMs: 420,
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
      notes: [],
    },
  };
  ok('A1: meaningful validator allows aligned low_rom', getShallowMeaningfulCycleBlockReason(state) == null);
  const r = runFinalGate(state);
  ok('A2: owner pass true', r.ownerTruth.completionOwnerPassed === true, r.ownerTruth);
  ok('A3: final pass open', r.gate.progressionPassed === true && r.gate.finalPassBlockedReason == null, r.gate);
}

console.log('\nB. reopen-aligned ultra_low survives policy validator + final gate');
{
  const state = {
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionOwnerReason: 'ultra_low_rom_complete_rule',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 280,
    squatReversalToStandingMs: 360,
    officialShallowPathClosed: true,
    officialShallowPathAdmitted: true,
    officialShallowClosureProofSatisfied: true,
  };
  ok('B1: meaningful validator allows aligned ultra_low', getShallowMeaningfulCycleBlockReason(state) == null);
  const r = runFinalGate(state);
  ok('B2: owner pass true', r.ownerTruth.completionOwnerPassed === true, r.ownerTruth);
  ok('B3: final pass open', r.gate.progressionPassed === true && r.gate.finalPassBlockedReason == null, r.gate);
}

console.log('\nC. candidate-only metadata still blocked');
{
  const state = {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: false,
    officialShallowPathAdmitted: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPathClosed: true,
  };
  const r = runFinalGate(state);
  ok('C1: owner blocked', r.ownerTruth.completionOwnerPassed === false, r.ownerTruth);
  ok('C2: final pass blocked', r.gate.progressionPassed === false, r.gate);
}

console.log(`\ncanonical-closure-align smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
