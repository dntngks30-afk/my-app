/**
 * PR-X2-A — Shallow Epoch Acquisition Repair smoke.
 *
 * Pins the narrow PR-X2-A contract (see `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`):
 * - shallow observation + downward commitment + setup clean -> the new shallow
 *   epoch acquisition diagnostic surface fires (either as `shallow_observation_to_epoch`
 *   or delegates to an existing arm with `existing_arm_owns`);
 * - static standing / seated hold / no-motion must NOT acquire;
 * - deep/standard reps remain outside acquisition (natural rule arm owns them);
 * - acquisition NEVER opens final pass on its own (completion remains sole owner).
 *
 * Run:
 *   npx tsx scripts/camera-pr-x2-a-shallow-epoch-acquisition-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { computeShallowEpochAcquisitionDecision } = await import(
  '../src/lib/camera/squat/squat-shallow-epoch-acquisition.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(
      `  FAIL ${name}`,
      extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''
    );
    process.exitCode = 1;
  }
}

function makeFrame(depth, index, phaseHint = 'start') {
  return {
    timestampMs: index * 80,
    isValid: true,
    phaseHint,
    derived: {
      squatDepthProxy: depth,
      squatDepthProxyBlended: depth,
    },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {
      ankleCenter: { x: 0.5, y: 0.8, visibility: 0.9 },
      hipCenter: { x: 0.5, y: 0.4, visibility: 0.9 },
    },
    eventHints: [],
    timestampDeltaMs: 80,
    stepId: 'squat',
  };
}

function runDepths(depths, phases = []) {
  return evaluateSquatFromPoseFrames(
    depths.map((depth, index) => makeFrame(depth, index, phases[index] ?? 'start'))
  );
}

function readHm(result) {
  return result?.debug?.highlightedMetrics ?? {};
}

function readCompletionArming(result) {
  return result?.debug?.squatCompletionArming ?? {};
}

function readPassCore(result) {
  return result?.debug?.squatPassCore ?? {};
}

console.log('\nPR-X2-A shallow epoch acquisition smoke\n');

// ──────────────────────────────────────────────────────────────────────────────
// A) Pure unit test — decision shape for the contract table.
// ──────────────────────────────────────────────────────────────────────────────

const baseDecisionInput = {
  valid: [],
  ruleArmed: false,
  hmmArmingAssistApplied: false,
  sharedDescentArmingStabilizationApplied: false,
  setupMotionBlocked: false,
  readinessStableDwellSatisfied: true,
  passWindow: {
    passWindowFrames: [],
    passWindowBaseline: 0,
    usable: true,
    blockedReason: null,
    baselineWindowFrameCount: 6,
    trace: '',
  },
  sharedDescentTruth: {
    descentDetected: true,
    descentStartAtMs: 0,
    peakAtMs: 400,
    peakIndex: 5,
    peakDepth: 0.04,
    relativePeak: 0.04,
    descentFrameCount: 5,
    descentExcursion: 0.04,
    descentToPeakSpanMs: 400,
    descentBlockedReason: null,
  },
};

const positive = computeShallowEpochAcquisitionDecision(baseDecisionInput);
ok('unit: shallow observation with descent truth acquires', (
  positive.acquisitionApplied === true &&
  positive.acquisitionEligible === true &&
  positive.acquisitionBlockedReason === null &&
  positive.observationStage === 'epoch_acquisition_candidate'
), positive);

const setupBlocked = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  setupMotionBlocked: true,
});
ok('unit: setup-blocked never acquires', (
  setupBlocked.acquisitionApplied === false &&
  setupBlocked.acquisitionBlockedReason === 'setup_blocked'
), setupBlocked);

const readinessUnstable = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  readinessStableDwellSatisfied: false,
});
ok('unit: readiness-unstable never acquires', (
  readinessUnstable.acquisitionApplied === false &&
  readinessUnstable.acquisitionBlockedReason === 'readiness_unstable'
), readinessUnstable);

const existingOwnsBase = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  ruleArmed: true,
});
ok('unit: natural rule-arm blocks duplicate acquisition', (
  existingOwnsBase.acquisitionApplied === false &&
  existingOwnsBase.acquisitionReason === 'existing_arm_owns' &&
  existingOwnsBase.acquisitionBlockedReason === 'existing_arm_owns'
), existingOwnsBase);

const existingOwnsShared = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  sharedDescentArmingStabilizationApplied: true,
});
ok('unit: shared-descent stabilization blocks duplicate acquisition', (
  existingOwnsShared.acquisitionApplied === false &&
  existingOwnsShared.acquisitionReason === 'existing_arm_owns' &&
  existingOwnsShared.acquisitionBlockedReason === 'existing_arm_owns'
), existingOwnsShared);

const standardBand = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  sharedDescentTruth: {
    ...baseDecisionInput.sharedDescentTruth,
    relativePeak: 0.45,
    descentExcursion: 0.45,
    peakDepth: 0.45,
  },
});
ok('unit: standard/deep band is not acquired here', (
  standardBand.acquisitionApplied === false &&
  standardBand.acquisitionBlockedReason === 'standard_or_deep_band'
), standardBand);

const oneFrameSpike = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  sharedDescentTruth: {
    ...baseDecisionInput.sharedDescentTruth,
    descentDetected: false,
    peakIndex: 0,
    descentFrameCount: 0,
    descentExcursion: 0.05,
    descentBlockedReason: null,
  },
});
ok('unit: first-frame / one-frame spike never acquires', (
  oneFrameSpike.acquisitionApplied === false &&
  (oneFrameSpike.acquisitionBlockedReason === 'first_frame_or_one_frame_peak' ||
    oneFrameSpike.acquisitionBlockedReason === 'static_standing_only')
), oneFrameSpike);

const floorReject = computeShallowEpochAcquisitionDecision({
  ...baseDecisionInput,
  sharedDescentTruth: {
    ...baseDecisionInput.sharedDescentTruth,
    relativePeak: 0.005,
    descentExcursion: 0.005,
    descentDetected: false,
  },
});
ok('unit: below acquisition floor is rejected', (
  floorReject.acquisitionApplied === false &&
  (floorReject.acquisitionBlockedReason === 'relative_peak_below_acquisition_floor' ||
    floorReject.acquisitionBlockedReason === 'static_standing_only')
), floorReject);

// ──────────────────────────────────────────────────────────────────────────────
// B) Runtime integration — acquisition fields flow to debug surfaces.
// ──────────────────────────────────────────────────────────────────────────────

// Reuse the PR-X1 shallow fixture: depths 0.01 -> 0.07. In this family the
// shared-descent arming already owns, so acquisition must report
// `existing_arm_owns` (no double-counting), but acquisitionEligible should
// still reflect that the observation truth is epoch-ready.
const shallowDepths = [
  0.01, 0.018, 0.026, 0.034, 0.042, 0.05,
  0.058, 0.066, 0.07, 0.07, 0.07, 0.07,
];
const shallowPhases = shallowDepths.map((d) => (d >= 0.05 ? 'descent' : 'start'));
const shallowResult = runDepths(shallowDepths, shallowPhases);
const shallowHm = readHm(shallowResult);
const shallowArming = readCompletionArming(shallowResult);

ok('runtime: shallow fixture surfaces acquisition trace in highlightedMetrics', (
  'shallowEpochAcquisitionApplied' in shallowHm &&
  'shallowEpochAcquisitionEligible' in shallowHm &&
  'shallowEpochAcquisitionBlockedReason' in shallowHm &&
  'shallowEpochObservationStage' in shallowHm
), {
  keys: Object.keys(shallowHm).filter((k) => k.startsWith('shallowEpoch')),
});

ok('runtime: shallow fixture surfaces acquisition trace in squatCompletionArming', (
  'shallowEpochAcquisitionApplied' in shallowArming &&
  'shallowEpochAcquisitionEligible' in shallowArming &&
  'shallowEpochObservationStage' in shallowArming
), {
  keys: Object.keys(shallowArming).filter((k) => k.startsWith('shallowEpoch')),
});

ok('runtime: shared-descent still owns the shallow fixture (no double-count)', (
  shallowHm.sharedDescentArmingStabilizationApplied === 1 &&
  shallowHm.shallowEpochAcquisitionApplied === 0 &&
  shallowHm.shallowEpochAcquisitionBlockedReason === 'existing_arm_owns'
), {
  shared: shallowHm.sharedDescentArmingStabilizationApplied,
  acqApplied: shallowHm.shallowEpochAcquisitionApplied,
  acqBlocked: shallowHm.shallowEpochAcquisitionBlockedReason,
  stage: shallowHm.shallowEpochObservationStage,
});

ok('runtime: shallow fixture observation stage reports epoch-acquisition-ready', (
  shallowHm.shallowEpochAcquisitionEligible === 1 &&
  shallowHm.shallowEpochObservationStage === 'epoch_acquisition_candidate'
), {
  eligible: shallowHm.shallowEpochAcquisitionEligible,
  stage: shallowHm.shallowEpochObservationStage,
});

// Standing-only must stay blocked and must NOT be acquired by PR-X2-A.
const standing = runDepths(Array(16).fill(0.01));
const standingHm = readHm(standing);
const standingPass = readPassCore(standing);
ok('runtime: standing-only is not acquired', (
  standingHm.shallowEpochAcquisitionApplied === 0 &&
  standingHm.contractA_officialShallowAdmitted !== 1 &&
  standingPass.passDetected !== true
), {
  acq: standingHm.shallowEpochAcquisitionApplied,
  acqBlocked: standingHm.shallowEpochAcquisitionBlockedReason,
  admitted: standingHm.contractA_officialShallowAdmitted,
  passDetected: standingPass.passDetected,
});

// Seated/static hold must stay blocked.
const seated = runDepths(Array(16).fill(0.12));
const seatedHm = readHm(seated);
const seatedPass = readPassCore(seated);
ok('runtime: seated/static hold is not acquired', (
  seatedHm.shallowEpochAcquisitionApplied === 0 &&
  seatedHm.contractA_officialShallowAdmitted !== 1 &&
  seatedPass.passDetected !== true
), {
  acq: seatedHm.shallowEpochAcquisitionApplied,
  acqBlocked: seatedHm.shallowEpochAcquisitionBlockedReason,
  admitted: seatedHm.contractA_officialShallowAdmitted,
  passDetected: seatedPass.passDetected,
});

// Deep / standard — natural rule-arm owns these. Acquisition must report
// `existing_arm_owns` (never swallow ownership from standard).
const deepDepths = [
  ...Array(12).fill(0.01),
  0.08, 0.18, 0.32, 0.48, 0.58, 0.58,
  0.46, 0.32, 0.18, 0.08, 0.02,
  0.01, 0.01, 0.01, 0.01,
];
const deepPhases = deepDepths.map((_, index) => {
  if (index < 12) return 'start';
  if (index < 17) return 'descent';
  if (index < 18) return 'bottom';
  if (index < 23) return 'ascent';
  return 'start';
});
const deep = runDepths(deepDepths, deepPhases);
const deepHm = readHm(deep);
const deepPass = readPassCore(deep);
ok('runtime: deep pass — acquisition never competes with natural arm', (
  deepPass.passDetected === true &&
  deepHm.shallowEpochAcquisitionApplied === 0 &&
  deepHm.shallowEpochAcquisitionBlockedReason === 'existing_arm_owns'
), {
  passDetected: deepPass.passDetected,
  acq: deepHm.shallowEpochAcquisitionApplied,
  acqBlocked: deepHm.shallowEpochAcquisitionBlockedReason,
});

// PR-X2-A invariant: completion remains the sole final owner even when
// acquisition is eligible.
ok('runtime: final pass owner is still completion only', (
  shallowResult?.debug?.completionPassSource === undefined ||
  shallowResult?.debug?.completionPassSource === null ||
  shallowResult?.debug?.completionPassSource === 'completion' ||
  typeof shallowHm.completionPassSource !== 'string' ||
  shallowHm.completionPassSource === 'completion'
), {
  completionPassSource:
    shallowResult?.debug?.completionPassSource ?? shallowHm.completionPassSource,
});

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
