/**
 * PR-C — Final-pass semantics read boundary smoke.
 *
 * Run: npx tsx scripts/camera-pr-c-final-pass-semantics-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { readSquatFinalPassSemanticsTruth } = await import(
  '../src/lib/camera/squat/squat-final-pass-semantics.ts'
);
const { buildDiagnosisSummary } = await import('../src/lib/camera/trace/camera-trace-diagnosis-summary.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${d}`);
    process.exitCode = 1;
  }
}

console.log('\nA. readSquatFinalPassSemanticsTruth — gate wins, no mismatch when aligned');
{
  const r = readSquatFinalPassSemanticsTruth({
    finalPassEligible: true,
    squatFinalPassTruth: { finalPassGranted: true },
  });
  ok('A1: granted true', r.finalPassGranted === true, r);
  ok('A2: source gate', r.source === 'gate_final_pass_eligible', r);
  ok('A3: no mismatch', r.mismatchDetected === false, r);
}

console.log('\nB. Gate boolean false + truth true → mismatch, value is gate (no OR success)');
{
  const r = readSquatFinalPassSemanticsTruth({
    finalPassEligible: false,
    squatFinalPassTruth: { finalPassGranted: true },
  });
  ok('B1: granted false (gate)', r.finalPassGranted === false, r);
  ok('B2: mismatch true', r.mismatchDetected === true, r);
  ok('B3: source gate', r.source === 'gate_final_pass_eligible', r);
}

console.log('\nC. No gate boolean — falls through to truth');
{
  const r = readSquatFinalPassSemanticsTruth({
    squatFinalPassTruth: { finalPassGranted: true },
  });
  ok('C1: granted true', r.finalPassGranted === true, r);
  ok('C2: source truth', r.source === 'squat_final_pass_truth', r);
  ok('C3: no mismatch', r.mismatchDetected === false, r);
}

console.log('\nD. Diagnosis surfaces mismatch on disagreeing gate + truth');
{
  const gate = {
    finalPassEligible: false,
    finalPassBlockedReason: 'ui_progression_blocked',
    completionSatisfied: true,
    confidence: 0.65,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    guardrail: {
      captureQuality: 'ok',
      flags: [],
      retryRecommended: false,
      completionStatus: 'complete',
    },
    evaluatorResult: {
      metrics: [],
      qualityHints: [],
      completionHints: [],
      interpretedSignals: [],
      debug: {
        squatCompletionState: {
          completionSatisfied: true,
          completionPassReason: 'standard_cycle',
          currentSquatPhase: 'standing_recovered',
          cycleComplete: true,
        },
      },
    },
    squatCycleDebug: {
      cycleComplete: true,
      depthBand: 'standard',
      completionStatus: 'complete',
      passBlockedReason: null,
      descendDetected: true,
      bottomDetected: true,
      recoveryDetected: true,
      startBeforeBottom: true,
      captureArmingSatisfied: true,
      squatFinalPassTruth: {
        finalPassGranted: true,
        finalPassBlockedReason: null,
        finalPassTruthSource: 'post_owner_ui_gate',
        motionOwnerSource: 'pass_core',
        finalPassGrantedReason: 'post_owner_final_pass_clear',
      },
    },
  };
  const diag = buildDiagnosisSummary('squat', gate, undefined);
  const sq = diag?.squatCycle;
  ok('D1: mismatch flagged', sq?.finalPassSemanticsMismatchDetected === true, sq);
  ok('D2: canonical granted is gate false', sq?.finalPassGranted === false, sq);
  ok('D3: severity is failed (not OR-widened to success)', sq?.passSeverity === 'failed', sq?.passSeverity);
}

console.log(`\n━━━ PR-C final-pass semantics smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
