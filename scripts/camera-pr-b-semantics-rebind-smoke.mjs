/**
 * PR-B — Result Semantics Rebind smoke guard.
 *
 * Verifies that:
 *  1. finalPassGranted=true never produces passSeverity='failed' regardless of completionTruthPassed.
 *  2. finalPassGranted=false always produces passSeverity='failed'.
 *  3. Quality signals may downgrade a successful pass but never turn it into 'failed'.
 *  4. diagnosisSummary.squatCycle.passSeverity aligns with gate.finalPassEligible, not completionTruthPassed.
 *
 * Run: npx tsx scripts/camera-pr-b-semantics-rebind-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildSquatResultSeveritySummary } = await import('../src/lib/camera/squat-result-severity.ts');
const { buildDiagnosisSummary } = await import('../src/lib/camera/trace/camera-trace-diagnosis-summary.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

// ── A. buildSquatResultSeveritySummary invariants ────────────────────────────
console.log('\nA. finalPassGranted=true never produces failed (even if completionTruthPassed=false)');
{
  const r = buildSquatResultSeveritySummary({
    finalPassGranted: true,
    completionTruthPassed: false,  // legacy mismatch — finalPassGranted must win
    captureQuality: 'ok',
  });
  ok('A1: passSeverity is not failed', r.passSeverity !== 'failed', r.passSeverity);
  ok('A1: resultInterpretation is not movement_not_completed',
     r.resultInterpretation !== 'movement_not_completed', r.resultInterpretation);
  ok('A1: is clean_pass', r.passSeverity === 'clean_pass', r.passSeverity);
}

console.log('\nB. Quality signals downgrade clean→low_quality but never to failed');
{
  const r = buildSquatResultSeveritySummary({
    finalPassGranted: true,
    completionTruthPassed: false,  // mismatch — must be ignored
    captureQuality: 'low',
    qualityOnlyWarnings: ['capture_quality_low'],
    qualityTier: 'low',
    limitations: ['asymmetry_elevated'],
  });
  ok('B1: is low_quality_pass not failed', r.passSeverity === 'low_quality_pass', r.passSeverity);
  ok('B2: resultInterpretation is quality_limited', r.resultInterpretation === 'movement_completed_but_quality_limited', r.resultInterpretation);
}

console.log('\nC. finalPassGranted=false always produces failed');
{
  const r = buildSquatResultSeveritySummary({
    finalPassGranted: false,
    completionTruthPassed: true,  // mismatch — finalPassGranted must win
    captureQuality: 'ok',
  });
  ok('C1: passSeverity is failed', r.passSeverity === 'failed', r.passSeverity);
  ok('C2: resultInterpretation is movement_not_completed', r.resultInterpretation === 'movement_not_completed', r.resultInterpretation);
}

console.log('\nD. Legacy path: only completionTruthPassed present — no regression');
{
  const pass = buildSquatResultSeveritySummary({ completionTruthPassed: true, captureQuality: 'ok' });
  ok('D1: legacy pass → clean_pass', pass.passSeverity === 'clean_pass', pass.passSeverity);
  const fail = buildSquatResultSeveritySummary({ completionTruthPassed: false, captureQuality: 'ok' });
  ok('D2: legacy fail → failed', fail.passSeverity === 'failed', fail.passSeverity);
}

// ── E. buildDiagnosisSummary: finalPassEligible=true with completionTruthPassed=false ─
console.log('\nE. buildDiagnosisSummary: finalPassEligible=true + completionTruthPassed=false → not failed');
{
  const gate = {
    finalPassEligible: true,
    finalPassBlockedReason: null,
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
          completionTruthPassed: false,  // intentional mismatch to test rebind
        },
      },
    },
    squatCycleDebug: {
      // Minimal squatCycleDebug so the squat branch runs
      cycleComplete: true,
      depthBand: 'standard',
      completionStatus: 'complete',
      passBlockedReason: null,
      descendDetected: true,
      bottomDetected: true,
      recoveryDetected: true,
      startBeforeBottom: true,
      captureArmingSatisfied: true,
      completionTruthPassed: false,  // intentional mismatch
      // PR-A frozen surface
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
  ok('E1: squatCycle exists', sq != null);
  ok('E2: canonical finalPassGranted=true', sq?.finalPassGranted === true, sq?.finalPassGranted);
  ok('E2b: semantics source is gate', sq?.finalPassSemanticsSource === 'gate_final_pass_eligible', sq?.finalPassSemanticsSource);
  ok('E2c: no mismatch', sq?.finalPassSemanticsMismatchDetected === false, sq?.finalPassSemanticsMismatchDetected);
  ok('E2d: deprecated alias still true', sq?.finalPassGrantedForSemantics === true, sq?.finalPassGrantedForSemantics);
  ok('E2e: passSemanticsTruth set', sq?.passSemanticsTruth === 'final_pass_surface', sq?.passSemanticsTruth);
  ok('E3: passSeverity is not failed', sq?.passSeverity !== 'failed', sq?.passSeverity);
  ok('E4: resultInterpretation is not movement_not_completed',
     sq?.resultInterpretation !== 'movement_not_completed', sq?.resultInterpretation);
}

console.log(`\n━━━ PR-B semantics rebind smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
