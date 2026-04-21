/**
 * PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN smoke.
 *
 * Pins the structured pre-arming epoch handoff used only for canonical
 * shallow cycle timing. This smoke must not promote E1 fixtures, relax
 * thresholds, or revive pass-core as a final-pass opener.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);

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

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}
function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));

  const depthT = clamp((170 - kneeAngleDeg) / 110);
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;

  const leftHipX = 0.44;
  const rightHipX = 0.56;
  const leftKneeX = 0.45;
  const rightKneeX = 0.55;
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;

  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(leftHipX, hipY, 0.99);
  landmarks[24] = mockLandmark(rightHipX, hipY, 0.99);
  landmarks[25] = mockLandmark(leftKneeX, kneeY, 0.99);
  landmarks[26] = mockLandmark(rightKneeX, kneeY, 0.99);
  landmarks[27] = mockLandmark(leftKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(rightKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);

  return { landmarks, timestamp };
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function toLandmarks(sequence) {
  return sequence.map((frame) => ({ landmarks: frame.landmarks, timestamp: frame.timestamp }));
}
function squatStats(frames, captureDurationMs = 3200) {
  return {
    sampledFrameCount: frames.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}
function runGate(angles, startTs) {
  const frames = makeKneeAngleSeries(startTs, angles, 80);
  return evaluateExerciseAutoProgress('squat', toLandmarks(frames), squatStats(frames));
}
function readCs(gate) {
  return gate?.evaluatorResult?.debug?.squatCompletionState;
}
function readHm(gate) {
  return gate?.evaluatorResult?.debug?.highlightedMetrics;
}

const SHALLOW_92DEG_ANGLES = [
  170, 170, 170, 170, 170, 170, 170, 170,
  165, 155, 145, 130, 115, 100, 95, 93, 92,
  92, 93, 95, 100, 115, 130, 145, 160,
  170, 170, 170, 170, 170, 170,
];

const ULTRA_LOW_ROM_92DEG_ANGLES = [
  170, 170, 170, 170, 170, 170, 170, 170,
  165, 155, 145, 130, 115, 100, 95, 93, 92,
  92, 93, 95, 100, 115, 130, 145, 160,
  170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
];

function assertRepresentativeTiming(label, angles, startTs) {
  console.log(`\n-- ${label} --`);
  const gate = runGate(angles, startTs);
  const cs = readCs(gate);
  const hm = readHm(gate);
  const dbg = gate.squatCycleDebug;
  const sliceStart = hm?.completionArmingSliceStart;

  ok(`${label}: completion state present`, cs != null, { hasCs: cs != null });
  ok(
    `${label}: structured pre-arming epoch accepted`,
    cs?.preArmingKinematicDescentEpochAccepted === true &&
      cs?.preArmingKinematicDescentEpochRejectedReason == null,
    {
      accepted: cs?.preArmingKinematicDescentEpochAccepted,
      rejectedReason: cs?.preArmingKinematicDescentEpochRejectedReason,
    }
  );
  ok(
    `${label}: same-rep proof bits are all true`,
    cs?.preArmingKinematicDescentEpochProof?.monotonicSustainSatisfied === true &&
      cs.preArmingKinematicDescentEpochProof.baselineBeforeOnset === true &&
      cs.preArmingKinematicDescentEpochProof.onsetBeforeCompletionSlicePeak === true &&
      cs.preArmingKinematicDescentEpochProof.noStandingRecoveryBetweenOnsetAndSlice === true,
    cs?.preArmingKinematicDescentEpochProof
  );
  ok(
    `${label}: pre-arming onset is before completion slice start`,
    typeof cs?.preArmingKinematicDescentEpochValidIndex === 'number' &&
      typeof sliceStart === 'number' &&
      cs.preArmingKinematicDescentEpochValidIndex < sliceStart,
    { preIdx: cs?.preArmingKinematicDescentEpochValidIndex, sliceStart }
  );
  ok(
    `${label}: same-rep peak guard is inside the completion slice`,
    typeof cs?.preArmingKinematicDescentEpochPeakGuardValidIndex === 'number' &&
      typeof sliceStart === 'number' &&
      cs.preArmingKinematicDescentEpochPeakGuardValidIndex >= sliceStart,
    { peakGuard: cs?.preArmingKinematicDescentEpochPeakGuardValidIndex, sliceStart }
  );
  ok(
    `${label}: normalized timing selected the pre-arming epoch`,
    cs?.selectedCanonicalDescentTimingEpochSource === 'pre_arming_kinematic_descent_epoch' &&
      cs?.effectiveDescentStartFrameSource === 'pre_arming_kinematic_descent_epoch',
    {
      selected: cs?.selectedCanonicalDescentTimingEpochSource,
      effective: cs?.effectiveDescentStartFrameSource,
    }
  );
  ok(
    `${label}: selected timing epoch is earlier than slice-local source #4`,
    typeof cs?.selectedCanonicalDescentTimingEpochAtMs === 'number' &&
      typeof cs?.legitimateKinematicShallowDescentOnsetAtMs === 'number' &&
      cs.selectedCanonicalDescentTimingEpochAtMs < cs.legitimateKinematicShallowDescentOnsetAtMs,
    {
      selectedAt: cs?.selectedCanonicalDescentTimingEpochAtMs,
      sliceLocalAt: cs?.legitimateKinematicShallowDescentOnsetAtMs,
    }
  );
  ok(
    `${label}: canonical cycle timing is no longer minimum-cycle blocked`,
    typeof cs?.cycleDurationMs === 'number' &&
      cs.cycleDurationMs >= 800 &&
      cs.canonicalShallowContractBlockedReason !== 'minimum_cycle_timing_blocked',
    {
      cycleDurationMs: cs?.cycleDurationMs,
      blockedReason: cs?.canonicalShallowContractBlockedReason,
    }
  );
  ok(
    `${label}: normalized descent anchor is coherent`,
    cs?.normalizedDescentAnchorCoherent === true,
    cs?.normalizedDescentAnchorCoherent
  );
  ok(
    `${label}: auto-progression debug mirrors timing handoff`,
    dbg?.preArmingKinematicDescentEpochAccepted === true &&
      dbg?.selectedCanonicalDescentTimingEpochSource === 'pre_arming_kinematic_descent_epoch',
    {
      accepted: dbg?.preArmingKinematicDescentEpochAccepted,
      selected: dbg?.selectedCanonicalDescentTimingEpochSource,
    }
  );
  ok(
    `${label}: canonical final pass does not imply E1 registry promotion`,
    cs?.canonicalShallowContractBlockedReason !== 'minimum_cycle_timing_blocked' &&
      (gate.finalPassEligible !== true ||
        (isFinalPassLatched('squat', gate) === true &&
          dbg?.canonicalShallowContractDrovePass === true &&
          cs?.canonicalTemporalEpochOrderSatisfied === true)),
    {
      finalPassEligible: gate.finalPassEligible,
      latch: isFinalPassLatched('squat', gate),
      drovePass: dbg?.canonicalShallowContractDrovePass,
      temporalOrder: cs?.canonicalTemporalEpochOrderSatisfied,
      blockedReason: cs?.canonicalShallowContractBlockedReason,
    }
  );
}

assertRepresentativeTiming('shallow_92deg', SHALLOW_92DEG_ANGLES, 200);
assertRepresentativeTiming('ultra_low_rom_92deg', ULTRA_LOW_ROM_92DEG_ANGLES, 300);

console.log('\n-- absurd-pass guards --');
for (const [label, angles] of Object.entries({
  standing_still: Array(15).fill(170),
  single_frame_spike: [170, 170, 170, 170, 170, 170, 160, 170, 170, 170, 170, 170, 170, 170, 170],
  seated_static: Array(15).fill(120),
})) {
  const gate = runGate(angles, 1000);
  const cs = readCs(gate);
  ok(
    `${label}: structured pre-arming epoch does not accept absurd input`,
    cs == null || cs.preArmingKinematicDescentEpochAccepted !== true,
    {
      accepted: cs?.preArmingKinematicDescentEpochAccepted,
      selected: cs?.selectedCanonicalDescentTimingEpochSource,
    }
  );
  ok(
    `${label}: final pass still does not open`,
    gate.finalPassEligible !== true && isFinalPassLatched('squat', gate) !== true,
    { finalPassEligible: gate.finalPassEligible, latch: isFinalPassLatched('squat', gate) }
  );
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
