/**
 * PR-01 Pass Owner Freeze — completion owner truth vs UI progression gate
 *
 * npx tsx scripts/camera-pass-owner-freeze-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched, computeSquatUiProgressionLatchGate } =
  await import('../src/lib/camera/auto-progression.ts');
const {
  computeSquatCompletionOwnerTruth,
  resolveSquatCompletionLineageOwner,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
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
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}
function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * 80,
    timestampDiscontinuityCount: 0,
  };
}

const STANDING = Array(12).fill(170);
const DEEP_STANDARD = [
  170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
  ...Array(12).fill(170),
];
const SHALLOW = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92, 93, 95, 100, 110, 122, 136, 150, 163, 170,
];

console.log('\nPR-01 camera-pass-owner-freeze-smoke\n');

// 1) Deep squat success
{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  ok('1 deep: progressionPassed', gate.status === 'pass', gate.status);
  ok('1 deep: completionOwnerPassed', d.completionOwnerPassed === true, d);
  ok('1 deep: completionOwnerReason standard_cycle', d.completionOwnerReason === 'standard_cycle', d);
  ok('1 deep: uiProgressionAllowed', d.uiProgressionAllowed === true, d);
  ok('1 deep: finalSuccessOwner lineage standard', d.finalSuccessOwner === 'completion_truth_standard', d);
  ok('1 deep: finalPassBlockedReason null', gate.finalPassBlockedReason == null, gate.finalPassBlockedReason);
  ok('1 deep: latch', isFinalPassLatched('squat', gate) === true);
}

// 2) Shallow success (existing fixture)
{
  const lm = toLandmarks(makeKneeAngleSeries(2000, [...STANDING, ...SHALLOW, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const ev = gate.evaluatorResult?.debug?.squatCompletionState?.completionPassReason;
  const shallowOk =
    gate.status === 'pass' &&
    (ev === 'low_rom_event_cycle' ||
      ev === 'ultra_low_rom_event_cycle' ||
      ev === 'low_rom_cycle' ||
      ev === 'ultra_low_rom_cycle');
  ok('2 shallow: pass + shallow passReason', shallowOk, { status: gate.status, ev });
  ok('2 shallow: completionOwnerPassed', d.completionOwnerPassed === true, d);
  ok('2 shallow: uiProgressionAllowed', d.uiProgressionAllowed === true, d);
  ok('2 shallow: finalSuccessOwner event lineage', d.finalSuccessOwner === 'completion_truth_event', d);
  ok('2 shallow: finalPassBlockedReason null', gate.finalPassBlockedReason == null, gate.finalPassBlockedReason);
}

// 3) Owner true + UI gate blocked (synthetic — confidence floor)
{
  const owner = computeSquatCompletionOwnerTruth({
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      currentSquatPhase: 'standing_recovered',
      completionBlockedReason: null,
    },
  });
  ok('3 synthetic: owner passed', owner.completionOwnerPassed === true, owner);
  const ui = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.2,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: ['insufficient_signal', 'valid_frames_too_few', 'framing_invalid'],
  });
  ok('3 synthetic: UI blocked', ui.uiProgressionAllowed === false, ui);
  ok('3 synthetic: UI reason confidence', String(ui.uiProgressionBlockedReason ?? '').includes('confidence'), ui);
  ok(
    '3 lineage: standard_cycle → standard owner',
    resolveSquatCompletionLineageOwner('standard_cycle') === 'completion_truth_standard'
  );
  const uiArming = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.7,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: false,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
  });
  ok('3b owner true + capture arming UI block', uiArming.uiProgressionBlockedReason === 'minimum_cycle_duration_not_met');
}

// 4) Standing / jitter — no valid rep (owner false)
{
  const lm = toLandmarks(makeKneeAngleSeries(3000, [...STANDING, ...STANDING, ...STANDING]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  ok('4 standing: not pass', gate.status !== 'pass', gate.status);
  ok('4 standing: completionOwnerPassed false', d.completionOwnerPassed === false, d);
  ok('4 standing: completionOwnerBlockedReason set', (d.completionOwnerBlockedReason ?? '').length > 0, d);
}

// 5) Seated-hold — stuck deep, no standing_recovered owner
{
  const seated = [...Array(8).fill(170), ...Array(36).fill(92)];
  const lm = toLandmarks(makeKneeAngleSeries(4000, seated));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  ok('5 seated: not pass', gate.status !== 'pass', gate.status);
  ok('5 seated: completionOwnerPassed false', d.completionOwnerPassed === false, d);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
