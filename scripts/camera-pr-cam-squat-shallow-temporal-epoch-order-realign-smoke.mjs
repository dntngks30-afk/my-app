/**
 * PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN smoke.
 *
 * Pins the normalized same-rep valid-buffer ledger used by canonical shallow
 * close. The ledger is a close guard only; this smoke does not edit or promote
 * any E1 registry state.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-shallow-temporal-epoch-order-realign-smoke.mjs
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

function assertTemporalLedger(label, angles, startTs) {
  console.log(`\n-- ${label} --`);
  const gate = runGate(angles, startTs);
  const cs = readCs(gate);
  const hm = readHm(gate);
  const dbg = gate.squatCycleDebug;

  const d = cs?.selectedCanonicalDescentTimingEpochValidIndex;
  const p = cs?.selectedCanonicalPeakEpochValidIndex;
  const r = cs?.selectedCanonicalReversalEpochValidIndex;
  const rec = cs?.selectedCanonicalRecoveryEpochValidIndex;
  const dt = cs?.selectedCanonicalDescentTimingEpochAtMs;
  const pt = cs?.selectedCanonicalPeakEpochAtMs;
  const rt = cs?.selectedCanonicalReversalEpochAtMs;
  const rect = cs?.selectedCanonicalRecoveryEpochAtMs;

  ok(`${label}: completion state present`, cs != null, { hasCs: cs != null });
  ok(
    `${label}: selected descent remains pre-arming epoch`,
    cs?.preArmingKinematicDescentEpochAccepted === true &&
      cs?.selectedCanonicalDescentTimingEpochSource === 'pre_arming_kinematic_descent_epoch',
    {
      accepted: cs?.preArmingKinematicDescentEpochAccepted,
      source: cs?.selectedCanonicalDescentTimingEpochSource,
    }
  );
  ok(
    `${label}: peak is normalized into valid-buffer coordinates`,
    typeof p === 'number' &&
      typeof hm?.completionArmingSliceStart === 'number' &&
      p >= hm.completionArmingSliceStart &&
      cs?.selectedCanonicalPeakEpochSource === 'completion_core_peak',
    {
      peakIndex: p,
      source: cs?.selectedCanonicalPeakEpochSource,
      sliceStart: hm?.completionArmingSliceStart,
    }
  );
  ok(
    `${label}: reversal is an authoritative post-peak epoch`,
    typeof r === 'number' &&
      typeof p === 'number' &&
      r > p &&
      cs?.selectedCanonicalReversalEpochSource === 'rule_or_hmm_reversal_epoch',
    {
      peakIndex: p,
      reversalIndex: r,
      source: cs?.selectedCanonicalReversalEpochSource,
      reversalConfirmedByRuleOrHmm: cs?.reversalConfirmedByRuleOrHmm,
    }
  );
  ok(
    `${label}: recovery is normalized after reversal`,
    typeof rec === 'number' &&
      typeof r === 'number' &&
      rec > r &&
      cs?.selectedCanonicalRecoveryEpochSource === 'standing_recovery_finalize_epoch',
    {
      reversalIndex: r,
      recoveryIndex: rec,
      source: cs?.selectedCanonicalRecoveryEpochSource,
      finalizeReason: cs?.standingRecoveryFinalizeReason,
    }
  );
  ok(
    `${label}: valid-buffer ledger is strictly ordered`,
    typeof d === 'number' &&
      typeof p === 'number' &&
      typeof r === 'number' &&
      typeof rec === 'number' &&
      d < p &&
      p < r &&
      r < rec,
    { d, p, r, rec, trace: cs?.temporalEpochOrderTrace }
  );
  ok(
    `${label}: timestamps are strictly ordered`,
    typeof dt === 'number' &&
      typeof pt === 'number' &&
      typeof rt === 'number' &&
      typeof rect === 'number' &&
      dt < pt &&
      pt < rt &&
      rt < rect,
    { dt, pt, rt, rect, trace: cs?.temporalEpochOrderTrace }
  );
  ok(
    `${label}: canonical temporal order is satisfied`,
    cs?.canonicalTemporalEpochOrderSatisfied === true &&
      cs?.canonicalTemporalEpochOrderBlockedReason == null &&
      typeof cs?.temporalEpochOrderTrace === 'string' &&
      cs.temporalEpochOrderTrace.includes('blocked=none'),
    {
      satisfied: cs?.canonicalTemporalEpochOrderSatisfied,
      blockedReason: cs?.canonicalTemporalEpochOrderBlockedReason,
      trace: cs?.temporalEpochOrderTrace,
    }
  );
  ok(
    `${label}: canonical close is no longer temporal-order blocked`,
    cs?.canonicalShallowContractBlockedReason !== 'temporal_epoch_order_blocked',
    {
      blockedReason: cs?.canonicalShallowContractBlockedReason,
      stage: cs?.canonicalShallowContractStage,
    }
  );
  ok(
    `${label}: highlighted metrics mirror the ledger`,
    hm?.canonicalTemporalEpochOrderSatisfied === 1 &&
      hm?.selectedCanonicalPeakEpochValidIndex === p &&
      hm?.selectedCanonicalReversalEpochValidIndex === r &&
      hm?.selectedCanonicalRecoveryEpochValidIndex === rec,
    {
      satisfied: hm?.canonicalTemporalEpochOrderSatisfied,
      peak: hm?.selectedCanonicalPeakEpochValidIndex,
      reversal: hm?.selectedCanonicalReversalEpochValidIndex,
      recovery: hm?.selectedCanonicalRecoveryEpochValidIndex,
    }
  );
  ok(
    `${label}: auto-progression debug mirrors the ledger`,
    dbg?.canonicalTemporalEpochOrderSatisfied === true &&
      dbg?.selectedCanonicalPeakEpochValidIndex === p &&
      dbg?.selectedCanonicalReversalEpochValidIndex === r &&
      dbg?.selectedCanonicalRecoveryEpochValidIndex === rec,
    {
      satisfied: dbg?.canonicalTemporalEpochOrderSatisfied,
      peak: dbg?.selectedCanonicalPeakEpochValidIndex,
      reversal: dbg?.selectedCanonicalReversalEpochValidIndex,
      recovery: dbg?.selectedCanonicalRecoveryEpochValidIndex,
    }
  );
  ok(
    `${label}: final pass, when opened, is canonical-contract driven`,
    gate.finalPassEligible !== true ||
      (isFinalPassLatched('squat', gate) === true &&
        dbg?.canonicalShallowContractDrovePass === true &&
        cs?.canonicalShallowContractSatisfied === true),
    {
      finalPassEligible: gate.finalPassEligible,
      latch: isFinalPassLatched('squat', gate),
      drovePass: dbg?.canonicalShallowContractDrovePass,
      contractSatisfied: cs?.canonicalShallowContractSatisfied,
    }
  );
}

assertTemporalLedger('shallow_92deg', SHALLOW_92DEG_ANGLES, 200);
assertTemporalLedger('ultra_low_rom_92deg', ULTRA_LOW_ROM_92DEG_ANGLES, 300);

console.log('\n-- absurd-pass guards --');
for (const [label, angles] of Object.entries({
  standing_still: Array(15).fill(170),
  single_frame_spike: [170, 170, 170, 170, 170, 170, 160, 170, 170, 170, 170, 170, 170, 170, 170],
  seated_static: Array(15).fill(120),
})) {
  const gate = runGate(angles, 1000);
  const cs = readCs(gate);
  ok(
    `${label}: temporal ledger does not create a canonical pass`,
    gate.finalPassEligible !== true &&
      isFinalPassLatched('squat', gate) !== true &&
      cs?.canonicalTemporalEpochOrderSatisfied !== true,
    {
      finalPassEligible: gate.finalPassEligible,
      latch: isFinalPassLatched('squat', gate),
      temporalOrder: cs?.canonicalTemporalEpochOrderSatisfied,
      trace: cs?.temporalEpochOrderTrace,
    }
  );
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
