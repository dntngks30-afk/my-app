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

const {
  applyCompletionOwnerShallowAdmissibilityReopen,
} = await import('../src/lib/camera/squat-completion-state.ts');
const {
  getShallowMeaningfulCycleBlockReason,
} = await import('../src/lib/camera/evaluators/squat-meaningful-shallow.ts');
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

function uiGateInput(ownerPassed) {
  return {
    completionOwnerPassed: ownerPassed,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.7,
    passThresholdEffective: 0.58,
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

function passCore(overrides = {}) {
  return {
    passDetected: true,
    passBlockedReason: null,
    ...overrides,
  };
}

function baseReopenCandidate(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'no_reversal',
    completionMachinePhase: 'recovered',
    cycleComplete: false,
    currentSquatPhase: 'standing_recovered',
    successPhaseAtOpen: undefined,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    recoveryConfirmedAfterReversal: true,
    standingRecoveredAtMs: 1600,
    eventCyclePromoted: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: 'no_reversal',
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowReversalSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    reversalConfirmedByRuleOrHmm: true,
    reversalConfirmedBy: 'rule',
    trajectoryReversalRescueApplied: false,
    setupMotionBlocked: false,
    relativeDepthPeak: 0.12,
    rawDepthPeakPrimary: 0.12,
    baselineStandingDepth: 0,
    evidenceLabel: 'low_rom',
    squatDescentToPeakMs: 240,
    squatReversalToStandingMs: 520,
    completionAssistSources: [],
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
      descentFrames: 4,
      reversalFrames: 3,
      recoveryFrames: 3,
      notes: [],
    },
    ...overrides,
  };
}

function applyDownstreamValidator(state) {
  const reason = getShallowMeaningfulCycleBlockReason(state);
  if (reason == null) return { state, reason };
  return {
    reason,
    state: {
      ...state,
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: reason,
      cycleComplete: false,
      officialShallowPathClosed: false,
      officialShallowPathBlockedReason: reason,
      officialShallowClosureProofSatisfied: false,
    },
  };
}

function runOwnerFinalChain(state, squatPassCore = passCore()) {
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: state,
    squatPassCore,
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

console.log('\nA. low_rom owner reopen aligns canonical closure state and survives');
{
  const reopened = applyCompletionOwnerShallowAdmissibilityReopen(baseReopenCandidate());
  const validated = applyDownstreamValidator(reopened);
  const chain = runOwnerFinalChain(validated.state);

  ok('A1: helper reopens low_rom owner truth', reopened.completionPassReason === 'low_rom_cycle', reopened);
  ok('A2: official shallow path is closed with blocker cleared', reopened.officialShallowPathClosed === true && reopened.officialShallowPathBlockedReason == null, reopened);
  ok('A3: closure metadata is aligned', reopened.ownerAuthoritativeShallowClosureSatisfied === true && reopened.shallowAuthoritativeClosureBlockedReason == null, reopened);
  ok('A4: downstream shallow validator does not demote', validated.reason == null, validated);
  ok('A5: owner read survives', chain.ownerTruth.completionOwnerPassed === true, chain.ownerTruth);
  ok('A6: final pass chain survives', chain.gate.progressionPassed === true && chain.gate.finalPassBlockedReason == null, chain.gate);
}

console.log('\nB. ultra_low owner reopen survives when existing policy proof is clear');
{
  const reopened = applyCompletionOwnerShallowAdmissibilityReopen(
    baseReopenCandidate({
      relativeDepthPeak: 0.05,
      rawDepthPeakPrimary: 0.05,
      evidenceLabel: 'ultra_low_rom',
      ultraLowPolicyScope: true,
      ultraLowPolicyDecisionReady: true,
      ultraLowPolicyBlocked: false,
      squatEventCycle: {
        detected: true,
        band: 'ultra_low_rom',
        descentDetected: true,
        reversalDetected: true,
        recoveryDetected: true,
        nearStandingRecovered: true,
        descentFrames: 4,
        reversalFrames: 3,
        recoveryFrames: 3,
        notes: [],
      },
    })
  );
  const validated = applyDownstreamValidator(reopened);
  const chain = runOwnerFinalChain(validated.state);

  ok('B1: helper reopens ultra_low owner truth', reopened.completionPassReason === 'ultra_low_rom_cycle', reopened);
  ok('B2: official shallow path is closed', reopened.officialShallowPathClosed === true, reopened);
  ok('B3: downstream shallow validator does not demote', validated.reason == null, validated);
  ok('B4: owner read to final pass survives', chain.ownerTruth.completionOwnerPassed === true && chain.gate.progressionPassed === true, { ownerTruth: chain.ownerTruth, gate: chain.gate });
}

console.log('\nC. false-positive guards remain closed');
{
  const candidateOnly = applyCompletionOwnerShallowAdmissibilityReopen(
    baseReopenCandidate({
      attemptStarted: false,
      descendConfirmed: false,
      downwardCommitmentReached: false,
      recoveryConfirmedAfterReversal: false,
    })
  );
  ok('C1: candidate-only flags do not reopen', candidateOnly.completionSatisfied !== true, candidateOnly);

  for (const phase of ['idle', 'descending', 'committed_bottom_or_downward_commitment']) {
    const reopened = applyCompletionOwnerShallowAdmissibilityReopen(
      baseReopenCandidate({ currentSquatPhase: phase })
    );
    ok(`C2: ${phase} phase does not reopen`, reopened.completionSatisfied !== true, reopened);
  }

  const delayed = applyCompletionOwnerShallowAdmissibilityReopen(
    baseReopenCandidate({ squatReversalToStandingMs: 8000 })
  );
  const delayedValidated = applyDownstreamValidator(delayed);
  const delayedChain = runOwnerFinalChain(delayedValidated.state);
  ok('C3: delayed shallow reopen is demoted by downstream validator', delayedValidated.reason === 'current_rep_ownership_blocked', delayedValidated);
  ok('C4: delayed shallow does not reach final pass after validator', delayedChain.gate.progressionPassed === false, delayedChain.gate);

  const notConfirmed = runOwnerFinalChain({
    ...baseReopenCandidate(),
    completionSatisfied: true,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: null,
    cycleComplete: true,
  });
  ok('C5: not_confirmed state cannot pass owner/final chain', notConfirmed.ownerTruth.completionOwnerPassed === false && notConfirmed.gate.progressionPassed === false, notConfirmed);
}

console.log('\nD. standard cycle remains unchanged');
{
  const standard = {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
  };
  const validated = applyDownstreamValidator(standard);
  const chain = runOwnerFinalChain(validated.state);
  ok('D1: standard cycle is not touched by shallow validator', validated.reason == null, validated);
  ok('D2: standard cycle still passes final chain', chain.gate.progressionPassed === true, chain);
}

console.log(`\ncanonical closure align smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
