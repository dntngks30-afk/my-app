/**
 * PR-RF-STRUCT-11B smoke guard: squat post-owner / pre-latch gate boundary.
 *
 * Run:
 *   npx tsx scripts/camera-rf-struct-11b-ui-gate-boundary-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatPostOwnerPreLatchGateLayer,
  getSquatPostOwnerFinalPassBlockedReason,
} = await import('../src/lib/camera/auto-progression.ts');

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
    confidence: 0.63,
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

function computeLayer({ owner = ownerTruth(), gate = uiGateInput(), cs, debug } = {}) {
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth: owner,
    uiGateInput: gate,
    squatCompletionState: cs,
    squatCycleDebug: debug,
  });
}

console.log('\nA. Structural boundary');
{
  const source = readFileSync('src/lib/camera/auto-progression.ts', 'utf8');
  const mainStart = source.indexOf('let squatPostOwnerGateLayer');
  const mainEnd = source.indexOf("if (squatCycleDebug && stepId === 'squat' && squatRawIntegrityBlock != null)");
  const mainBlock = mainStart >= 0 && mainEnd > mainStart ? source.slice(mainStart, mainEnd) : '';

  ok('A1: post-owner/pre-latch layer helper exists', source.includes('computeSquatPostOwnerPreLatchGateLayer'));
  ok('A2: final blocked reason exposure helper exists', source.includes('getSquatPostOwnerFinalPassBlockedReason'));
  ok('A3: main squat path computes the post-owner gate layer', mainBlock.includes('computeSquatPostOwnerPreLatchGateLayer'));
  ok('A4: main squat path no longer applies final blocker helpers inline', !mainBlock.includes('shouldBlockSquat'));
}

console.log('\nB. Representative standard cycle remains pass-open');
{
  const result = computeLayer();
  ok('B1: owner truth remains passed', result.ownerTruth.completionOwnerPassed === true, result);
  ok('B2: UI gate remains allowed', result.uiGate.uiProgressionAllowed === true, result);
  ok('B3: progressionPassed remains true', result.progressionPassed === true, result);
  ok('B4: finalPassBlockedReason remains null', result.finalPassBlockedReason === null, result);
}

console.log('\nC. Owner reason is not overwritten by gate reason');
{
  const owner = ownerTruth({
    completionOwnerPassed: false,
    completionOwnerReason: null,
    completionOwnerBlockedReason: 'no_reversal_after_peak',
  });
  const result = computeLayer({
    owner,
    gate: uiGateInput({ completionOwnerPassed: false }),
  });
  ok('C1: progression remains blocked', result.progressionPassed === false, result);
  ok('C2: final reason preserves owner blocked reason', result.finalPassBlockedReason === 'no_reversal_after_peak', result);
  ok(
    'C3: direct final reason helper matches layer exposure',
    getSquatPostOwnerFinalPassBlockedReason({ ownerTruth: owner, uiGate: result.uiGate }) ===
      result.finalPassBlockedReason,
    result
  );
}

console.log('\nD. Gate veto remains gate-layer exposure');
{
  const result = computeLayer({
    gate: uiGateInput({ confidence: 0.61 }),
  });
  ok('D1: owner truth is still passed', result.ownerTruth.completionOwnerPassed === true, result);
  ok('D2: progression is blocked by gate veto', result.progressionPassed === false, result);
  ok(
    'D3: final reason remains confidence gate reason',
    result.finalPassBlockedReason === 'confidence_too_low:0.61<0.62',
    result
  );
}

console.log('\nE. Final blocker chain remains veto-only');
{
  const toxicCs = {
    evidenceLabel: 'ultra_low_rom',
    reversalConfirmedBy: 'trajectory',
    trajectoryReversalRescueApplied: true,
    committedAtMs: 1000,
    reversalAtMs: 1000,
    descendStartAtMs: 1000,
    squatDescentToPeakMs: 0,
    peakLatchedAtIndex: 0,
    squatEventCycle: { notes: ['peak_anchor_at_series_start'] },
  };
  const result = computeLayer({
    cs: toxicCs,
    debug: { armingFallbackUsed: true },
  });
  ok('E1: owner truth is not rewritten by final blocker', result.ownerTruth.completionOwnerPassed === true, result);
  ok('E2: final blocker veto closes UI progression', result.uiGate.uiProgressionAllowed === false, result);
  ok('E3: final blocker reason is exposed as gate reason', result.finalPassBlockedReason === 'setup_series_start_false_pass', result);
}

console.log(`\nPR-RF-STRUCT-11B post-owner/pre-latch smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
