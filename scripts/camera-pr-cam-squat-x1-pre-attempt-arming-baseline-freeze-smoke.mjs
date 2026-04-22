/**
 * PR-X1 -- Pre-attempt arming and baseline-freeze timing stabilization.
 *
 * This smoke pins the narrow Wave X1 repair:
 * - existing shared descent truth may arm the same shallow epoch earlier;
 * - base rule arming and HMM arming remain observable separately;
 * - the repair does not directly open closure, opener, final sink, or fixture promotion.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-x1-pre-attempt-arming-baseline-freeze-smoke.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : '');
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

function readState(result) {
  return result?.debug?.squatCompletionState ?? {};
}

function readPassCore(result) {
  return result?.debug?.squatPassCore ?? {};
}

function firstIndex(items, pred) {
  const idx = items.findIndex(pred);
  return idx >= 0 ? idx : null;
}

function summarizeRuntimePrefixes(depths, phases = []) {
  const rows = [];
  for (let end = 1; end <= depths.length; end += 1) {
    const result = runDepths(depths.slice(0, end), phases.slice(0, end));
    const hm = readHm(result);
    const state = readState(result);
    const passCore = readPassCore(result);
    rows.push({
      tick: end - 1,
      insufficient: result.insufficientSignal === true,
      baseArmed: hm.completionArmingArmed === 1,
      hmmArmed: hm.hmmArmingAssistApplied === 1,
      sharedArmed: hm.sharedDescentArmingStabilizationApplied === 1,
      effectiveArmed: hm.effectiveArmed === 1,
      descentLike: passCore.descentDetected === true || hm.descendConfirmed === true,
      attemptStarted: hm.attemptStarted === true,
      descendConfirmed: hm.descendConfirmed === true,
      baselineFrozen: hm.squatBaselineFrozen === 1,
      peakLatched: hm.squatPeakLatched === 1,
      admitted: hm.contractA_officialShallowAdmitted === 1,
      closed: hm.contractC_officialShallowClosed === 1,
      completionBlockedReason: hm.completionBlockedReason ?? null,
      passBlockedReason: passCore.passBlockedReason ?? null,
      freezeOrLatchMissing:
        Array.isArray(state.squatEventCycle?.notes) &&
        state.squatEventCycle.notes.includes('freeze_or_latch_missing'),
    });
  }
  return {
    firstDescentLikeTick: firstIndex(rows, (r) => r.descentLike),
    firstBaseOrHmmArmedTick: firstIndex(rows, (r) => r.baseArmed || r.hmmArmed),
    firstSharedArmedTick: firstIndex(rows, (r) => r.sharedArmed),
    firstEffectiveArmedTick: firstIndex(rows, (r) => r.effectiveArmed),
    firstAttemptStartedTick: firstIndex(rows, (r) => r.attemptStarted),
    firstBaselineFrozenTick: firstIndex(rows, (r) => r.baselineFrozen),
    firstPeakLatchedTick: firstIndex(rows, (r) => r.peakLatched),
    firstAdmissionTick: firstIndex(rows, (r) => r.admitted),
    notArmedTicks: rows.filter((r) => r.completionBlockedReason === 'not_armed').length,
    peakNotLatchedTicks: rows.filter((r) => r.passBlockedReason === 'peak_not_latched').length,
    freezeOrLatchMissingTicks: rows.filter((r) => r.freezeOrLatchMissing).length,
    rows,
  };
}

function readFixtureOffsets(id) {
  const path = join(homedir(), 'Desktop', `${id}.txt`);
  if (!existsSync(path)) return { id, missing: true };
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const observations = parsed.squatAttemptObservations ?? [];
  return {
    id,
    observationCount: observations.length,
    firstDescentLikeTick: firstIndex(
      observations,
      (o) =>
        o.downwardCommitmentReached === true ||
        o.motionDescendDetected === true ||
        o.shallowCandidateObserved === true
    ),
    firstAttemptStartedTick: firstIndex(observations, (o) => o.attemptStarted === true),
    firstBaselineFrozenTick: firstIndex(observations, (o) => o.baselineFrozen === true),
    firstPeakLatchedTick: firstIndex(observations, (o) => o.peakLatched === true),
    firstAdmissionTick: firstIndex(observations, (o) => o.officialShallowPathAdmitted === true),
    notArmedTicks: observations.filter((o) => o.completionBlockedReason === 'not_armed').length,
    peakNotLatchedTicks: observations.filter(
      (o) =>
        o.squatCameraObservability?.pass_core_truth?.squatPassCore?.passBlockedReason ===
        'peak_not_latched'
    ).length,
    freezeOrLatchMissingTicks: observations.filter((o) =>
      o.squatCameraObservability?.eventCycle?.notes?.includes('freeze_or_latch_missing')
    ).length,
  };
}

console.log('\nPR-X1 pre-attempt arming/baseline-freeze smoke\n');

console.log('-- recorded primary fixture offsets (pre-patch observations) --');
for (const id of [
  'device_shallow_fail_01',
  'device_shallow_fail_05',
  'device_shallow_fail_07',
  'device_shallow_fail_11',
  'device_shallow_fail_13',
]) {
  console.log(`  ${id}`, JSON.stringify(readFixtureOffsets(id)));
}

const x1Depths = [
  0.01, 0.018, 0.026, 0.034, 0.042, 0.05,
  0.058, 0.066, 0.07, 0.07, 0.07, 0.07,
];
const x1Phases = x1Depths.map((d) => (d >= 0.05 ? 'descent' : 'start'));
const x1Result = runDepths(x1Depths, x1Phases);
const x1Hm = readHm(x1Result);
const x1State = readState(x1Result);
const x1PassCore = readPassCore(x1Result);
const x1Prefixes = summarizeRuntimePrefixes(x1Depths, x1Phases);

console.log('\n-- synthetic X1 same-epoch timing --');
console.log(`  ${JSON.stringify({
    firstDescentLikeTick: x1Prefixes.firstDescentLikeTick,
    firstBaseOrHmmArmedTick: x1Prefixes.firstBaseOrHmmArmedTick,
    firstSharedArmedTick: x1Prefixes.firstSharedArmedTick,
    firstEffectiveArmedTick: x1Prefixes.firstEffectiveArmedTick,
    firstAttemptStartedTick: x1Prefixes.firstAttemptStartedTick,
    firstBaselineFrozenTick: x1Prefixes.firstBaselineFrozenTick,
    firstPeakLatchedTick: x1Prefixes.firstPeakLatchedTick,
    firstAdmissionTick: x1Prefixes.firstAdmissionTick,
    notArmedTicks: x1Prefixes.notArmedTicks,
    peakNotLatchedTicks: x1Prefixes.peakNotLatchedTicks,
    freezeOrLatchMissingTicks: x1Prefixes.freezeOrLatchMissingTicks,
  })}`);

ok('X1 fixture is evaluated', x1Result.insufficientSignal !== true, {
  insufficient: x1Result.insufficientSignal,
  reason: x1Result.reason,
});
ok('base rule and HMM arming remain false at the X1 handoff', (
  x1Hm.completionArmingArmed === 0 &&
  x1Hm.hmmArmingAssistApplied === 0
), {
  base: x1Hm.completionArmingArmed,
  hmm: x1Hm.hmmArmingAssistApplied,
});
ok('shared descent timing stabilization is the only arming handoff', (
  x1Hm.sharedDescentArmingStabilizationApplied === 1 &&
  x1Hm.effectiveArmed === 1
), {
  shared: x1Hm.sharedDescentArmingStabilizationApplied,
  effective: x1Hm.effectiveArmed,
});
ok('same epoch now reaches attempt/descent/baseline/peak/admission', (
  x1Hm.attemptStarted === true &&
  x1Hm.descendConfirmed === true &&
  x1Hm.squatBaselineFrozen === 1 &&
  x1Hm.squatPeakLatched === 1 &&
  x1Hm.contractA_officialShallowAdmitted === 1
), {
  attemptStarted: x1Hm.attemptStarted,
  descendConfirmed: x1Hm.descendConfirmed,
  baselineFrozen: x1Hm.squatBaselineFrozen,
  peakLatched: x1Hm.squatPeakLatched,
  admitted: x1Hm.contractA_officialShallowAdmitted,
});
ok('not_armed and peak_not_latched are not the residual blockers', (
  x1Hm.completionBlockedReason !== 'not_armed' &&
  x1PassCore.passBlockedReason !== 'peak_not_latched' &&
  !x1State.squatEventCycle?.notes?.includes('freeze_or_latch_missing')
), {
  completionBlockedReason: x1Hm.completionBlockedReason,
  passBlockedReason: x1PassCore.passBlockedReason,
  notes: x1State.squatEventCycle?.notes,
});
ok('X1 does not force closure or final completion', (
  x1Hm.contractC_officialShallowClosed !== 1 &&
  x1Hm.completionSatisfied !== true &&
  x1PassCore.passDetected !== true
), {
  closed: x1Hm.contractC_officialShallowClosed,
  completionSatisfied: x1Hm.completionSatisfied,
  passDetected: x1PassCore.passDetected,
});

const standing = runDepths(Array(16).fill(0.01));
const standingHm = readHm(standing);
const standingPass = readPassCore(standing);
ok('standing still is not newly admitted', (
  standingHm.contractA_officialShallowAdmitted !== 1 &&
  standingHm.sharedDescentArmingStabilizationApplied !== 1 &&
  standingPass.passDetected !== true
), {
  admitted: standingHm.contractA_officialShallowAdmitted,
  shared: standingHm.sharedDescentArmingStabilizationApplied,
  passDetected: standingPass.passDetected,
});

const seated = runDepths(Array(16).fill(0.12));
const seatedHm = readHm(seated);
const seatedPass = readPassCore(seated);
ok('seated/static hold is not newly admitted', (
  seatedHm.contractA_officialShallowAdmitted !== 1 &&
  seatedHm.sharedDescentArmingStabilizationApplied !== 1 &&
  seatedPass.passDetected !== true
), {
  admitted: seatedHm.contractA_officialShallowAdmitted,
  shared: seatedHm.sharedDescentArmingStabilizationApplied,
  passDetected: seatedPass.passDetected,
});

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
ok('deep standard pass-core remains outside X1 stabilization', (
  deepPass.passDetected === true &&
  deepHm.sharedDescentArmingStabilizationApplied !== 1
), {
  passDetected: deepPass.passDetected,
  shared: deepHm.sharedDescentArmingStabilizationApplied,
  completionPassReason: deepHm.completionPassReason,
});

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
