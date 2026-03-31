/**
 * PR-CAM-ASCENT-INTEGRITY-RESCUE-01: trajectory rescue ascent integrity (no `|| true` bypass)
 * Run: npx tsx scripts/camera-pr-ascent-integrity-rescue-01-smoke.mjs
 *
 * Regression: also rerun `npx tsx scripts/camera-pr-cam31-trajectory-rescue-smoke.mjs` if present,
 * or other CAM-31 / shallow finalize smokes in CI.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateSquatCompletionState,
  trajectoryRescueMeetsAscentIntegrity,
} = await import('../src/lib/camera/squat-completion-state.ts');

const MIN_SHALLOW_REVERSAL_TO_STANDING_MS = 200;

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
}

console.log('PR-CAM-ASCENT-INTEGRITY-RESCUE-01 smoke\n');

// ── A–F: pure helper ──
ok(
  'A: no standing recovery → false even if finalize true',
  trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: false,
    standingRecoveryFinalizeSatisfied: true,
    minReversalToStandingMs: MIN_SHALLOW_REVERSAL_TO_STANDING_MS,
    /** PR-TRAJECTORY-RESCUE-INTEGRITY-01: shallow return proof 없으면 즉시 false */
    shallowReturnProofSatisfied: false,
  }) === false
);

ok(
  'B: finalize false → false',
  trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: false,
    standingRecoveredAtMs: 500,
    standingRecoveryFinalizeSatisfied: false,
    recoveryReturnContinuityFrames: 4,
    recoveryDropRatio: 0.5,
    reversalAtMs: 100,
    minReversalToStandingMs: MIN_SHALLOW_REVERSAL_TO_STANDING_MS,
    shallowReturnProofSatisfied: true,
  }) === false
);

ok(
  'C: recovery proof below low-ROM finalize proof → false',
  trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: false,
    standingRecoveredAtMs: 900,
    standingRecoveryFinalizeSatisfied: true,
    recoveryReturnContinuityFrames: 2,
    recoveryDropRatio: 0.2,
    reversalAtMs: 100,
    minReversalToStandingMs: MIN_SHALLOW_REVERSAL_TO_STANDING_MS,
    shallowReturnProofSatisfied: true,
  }) === false
);

ok(
  'D: timing too short → false',
  trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: false,
    standingRecoveredAtMs: 250,
    standingRecoveryFinalizeSatisfied: true,
    recoveryReturnContinuityFrames: 3,
    recoveryDropRatio: 0.45,
    reversalAtMs: 100,
    minReversalToStandingMs: MIN_SHALLOW_REVERSAL_TO_STANDING_MS,
    shallowReturnProofSatisfied: true,
  }) === false
);

ok(
  'E: proof + timing OK → true',
  trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: false,
    standingRecoveredAtMs: 500,
    standingRecoveryFinalizeSatisfied: true,
    recoveryReturnContinuityFrames: 3,
    recoveryDropRatio: 0.45,
    reversalAtMs: 100,
    minReversalToStandingMs: MIN_SHALLOW_REVERSAL_TO_STANDING_MS,
    shallowReturnProofSatisfied: true,
  }) === true
);

ok(
  'F: explicit ascend wins (other fields weak)',
  trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: true,
    standingRecoveryFinalizeSatisfied: false,
    minReversalToStandingMs: MIN_SHALLOW_REVERSAL_TO_STANDING_MS,
    shallowReturnProofSatisfied: false,
  }) === true
);

// ── G: deep standard ──
const depthsG = [
  0.02, 0.02, 0.02, 0.02, 0.08, 0.18, 0.32, 0.46, 0.46, 0.4, 0.28, 0.14, 0.06, 0.03, 0.02,
  ...Array(12).fill(0.02),
];
const phasesG = [
  'start',
  'start',
  'start',
  'start',
  'descent',
  'descent',
  'descent',
  'bottom',
  'bottom',
  'ascent',
  'ascent',
  'ascent',
  'start',
  'start',
  'start',
  ...Array(12).fill('start'),
];
const stateG = evaluateSquatCompletionState(syntheticStateFrames(depthsG, phasesG));
ok(
  'G: deep standard_cycle + completion satisfied',
  stateG.completionSatisfied === true && stateG.completionPassReason === 'standard_cycle'
);

// ── H: standing only ──
const stateH = evaluateSquatCompletionState(
  syntheticStateFrames(Array(20).fill(0.015), Array(20).fill('start'))
);
ok('H: standing still not complete', stateH.completionSatisfied === false);

// ── I: meaningful shallow (trajectory rescue may apply; must still complete) ──
const stateI = evaluateSquatCompletionState(
  syntheticStateFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
    ],
    [
      'start',
      'start',
      'start',
      'start',
      'descent',
      'descent',
      'descent',
      'bottom',
      'bottom',
      'ascent',
      'ascent',
      'ascent',
      'start',
      'start',
      'start',
    ]
  )
);
ok(
  'I: meaningful shallow still completes (explicit ascend or integrity path)',
  stateI.completionSatisfied === true
);
ok(
  'I: if trajectory reversal, pass must not rely on free ascend (completion still true)',
  stateI.reversalConfirmedBy !== 'trajectory' || stateI.completionSatisfied === true
);

// ── J: fake dip — quick return, stepMs short so reversal→standing < shallow min if trajectory fires ──
const stepJ = 30;
const depthsJ = [
  ...Array(6).fill(0.02),
  0.06,
  0.08,
  0.09,
  0.09,
  0.08,
  0.05,
  0.03,
  0.02,
  0.02,
  0.02,
  0.02,
  0.02,
  0.02,
  0.02,
  0.02,
];
const phasesJ = [
  ...Array(6).fill('start'),
  'descent',
  'descent',
  'bottom',
  'bottom',
  'ascent',
  'start',
  'start',
  'start',
  'start',
  'start',
  'start',
  'start',
  'start',
  'start',
];
const stateJ = evaluateSquatCompletionState(syntheticStateFrames(depthsJ, phasesJ, stepJ));
/** 시도가 열렸는데 통과하지 못한 경우 — 무료 ascent/가짜 완료가 아닌 하드 가드에 걸려야 함 */
const jHardGuards = new Set([
  'no_ascend',
  'no_reversal',
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'ascent_recovery_span_too_short',
  'not_standing_recovered',
  'descent_span_too_short',
  'insufficient_relative_depth',
  'no_commitment',
]);
ok('J: fake dip / weak return — does not complete', stateJ.completionSatisfied !== true);
ok(
  'J: if attempt started and blocked, reason is a hard guard (no spurious pass)',
  !stateJ.attemptStarted ||
    stateJ.completionSatisfied ||
    (stateJ.ruleCompletionBlockedReason != null && jHardGuards.has(stateJ.ruleCompletionBlockedReason))
);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
