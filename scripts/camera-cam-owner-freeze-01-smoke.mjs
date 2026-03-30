/**
 * PR-CAM-OWNER-FREEZE-01 — squat finalSuccessOwner / shadow event eligibility 회귀 잠금
 *
 * npx tsx scripts/camera-cam-owner-freeze-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);
const { resolveSquatPassOwner } = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');

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
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
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
];
const SHALLOW = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92, 93, 95, 100, 110, 122, 136, 150, 163, 170,
];

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

console.log('\nPR-CAM-OWNER-FREEZE-01 smoke\n');

// ── Resolver 단위: invalid / severe 경로 (gate 산식과 분리) ──
ok(
  'resolve: invalid capture → blocked_by_invalid_capture',
  resolveSquatPassOwner({
    guardrail: { captureQuality: 'invalid' },
    severeInvalid: false,
    decoupleEligible: true,
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
  }) === 'blocked_by_invalid_capture'
);
ok(
  'resolve: severeInvalid → blocked_by_invalid_capture',
  resolveSquatPassOwner({
    guardrail: { captureQuality: 'ok' },
    severeInvalid: true,
    decoupleEligible: true,
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
  }) === 'blocked_by_invalid_capture'
);
ok(
  'resolve: decouple + standard_cycle → completion_truth_standard',
  resolveSquatPassOwner({
    guardrail: { captureQuality: 'ok' },
    severeInvalid: false,
    decoupleEligible: true,
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
  }) === 'completion_truth_standard'
);
ok(
  'resolve: decouple + ultra_low_rom_event_cycle → completion_truth_event',
  resolveSquatPassOwner({
    guardrail: { captureQuality: 'ok' },
    severeInvalid: false,
    decoupleEligible: true,
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_event_cycle',
  }) === 'completion_truth_event'
);

// ── 통합: deep standard — final owner / eligibility / latch 회귀 ──
{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('deep: completionPassReason standard_cycle', cs.completionPassReason === 'standard_cycle', cs.completionPassReason);
  ok('deep: standardOwnerEligible', d.standardOwnerEligible === true, d);
  ok('deep: shadowEventOwnerEligible false', d.shadowEventOwnerEligible === false, d);
  ok('deep: finalSuccessOwner completion_truth_standard', d.finalSuccessOwner === 'completion_truth_standard', d);
  ok('deep: passOwner matches finalSuccessOwner', d.passOwner === d.finalSuccessOwner, d);
  ok('deep: ownerFreezeVersion', d.ownerFreezeVersion === 'cam-pass-owner-freeze-01', d);
  ok('deep: gate pass', gate.status === 'pass', gate.status);
  ok('deep: isFinalPassLatched unchanged for standard path', isFinalPassLatched('squat', gate) === true);
  const snap = buildAttemptSnapshot('squat', gate, undefined, {});
  const sq = snap?.diagnosisSummary?.squatCycle;
  ok('deep: snapshot carries finalSuccessOwner + eventCycle + relPeak', sq != null);
  ok('deep: snap finalSuccessOwner', sq?.finalSuccessOwner === 'completion_truth_standard', sq);
  ok('deep: snap completionPassReason', sq?.completionPassReason === 'standard_cycle', sq);
  ok('deep: snap standardOwnerEligible', sq?.standardOwnerEligible === true, sq);
  ok('deep: snap shadowEventOwnerEligible', sq?.shadowEventOwnerEligible === false, sq);
  ok('deep: snap relativeDepthPeak number', typeof sq?.relativeDepthPeak === 'number', sq);
  ok('deep: snap eventCycle fields present', typeof sq?.eventCycleDetected === 'boolean', sq);
}

// ── 통합: shallow ultra-low event — completion_truth_event ──
{
  const lm = toLandmarks(makeKneeAngleSeries(2000, [...STANDING, ...SHALLOW, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  const isShallowRom =
    cs.completionPassReason === 'low_rom_event_cycle' ||
    cs.completionPassReason === 'ultra_low_rom_event_cycle' ||
    cs.completionPassReason === 'low_rom_cycle' ||
    cs.completionPassReason === 'ultra_low_rom_cycle';
  const isEventPath =
    cs.completionPassReason === 'low_rom_event_cycle' ||
    cs.completionPassReason === 'ultra_low_rom_event_cycle';
  ok('shallow: shallow rom completionPassReason', isShallowRom, cs.completionPassReason);
  ok('shallow: shadowEventOwnerEligible matches event-only rule', d.shadowEventOwnerEligible === isEventPath, d);
  ok('shallow: standardOwnerEligible false', d.standardOwnerEligible === false, d);
  ok('shallow: finalSuccessOwner completion_truth_event', d.finalSuccessOwner === 'completion_truth_event', d);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
