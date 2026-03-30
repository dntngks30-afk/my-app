/**
 * PR-CAM-26 smoke test — shallow descent admission + standard-cycle hardening
 *
 * 검증 목표:
 * - old 0.08 band 아래의 visibly real shallow squat 이 guarded descent 로 관측된다.
 * - shallow real squat 은 completion/pass 로 진행된다.
 * - standard_cycle 만 low-quality + severe partial/instability 조합에서 final pass 차단된다.
 * - deep squat / low_rom / ultra_low_rom 기존 경로는 보존된다.
 *
 * 실행:
 *   npx tsx scripts/camera-cam26-shallow-admission-and-standing-hardening-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
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
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
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

function toLandmarks(sequence) {
  return sequence.map((frame) => ({ landmarks: frame.landmarks, timestamp: frame.timestamp }));
}

function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function squatStats(landmarks, captureDurationMs = 3200) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}

function makeSquatGate(opts) {
  return {
    completionSatisfied: opts.completionSatisfied ?? true,
    confidence: opts.confidence,
    passConfirmationSatisfied: opts.passConfirmationSatisfied ?? true,
    passConfirmationFrameCount: opts.passConfirmationFrameCount ?? 3,
    guardrail: {
      captureQuality: opts.captureQuality ?? 'ok',
      flags: opts.flags ?? [],
      retryRecommended: false,
      completionStatus: 'complete',
    },
    evaluatorResult: {
      debug: {
        squatCompletionState: opts.squatCompletionState ?? null,
      },
    },
  };
}

console.log('\nA. shallow descent under old 0.08 band is now observed and can pass');
{
  const shallowAngles = [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92,
    92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(6).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, shallowAngles, 80));
  const frames = buildPoseFeaturesFrames('squat', landmarks);
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks));
  const depthValues = frames
    .map((frame) => frame.derived.squatDepthProxy)
    .filter((value) => typeof value === 'number');
  const maxDepth = depthValues.length > 0 ? Math.max(...depthValues) : 0;
  const descentCount = frames.filter((frame) => frame.phaseHint === 'descent').length;

  ok('A1: shallow fixture stays below old 0.08 observation band', maxDepth < 0.08, {
    maxDepth,
  });
  ok('A2: guarded shallow descent produces descent frames', descentCount > 0, {
    descentCount,
    phaseHints: frames.map((frame) => frame.phaseHint),
  });
  ok('A3: shallow path is no longer blocked at no_descend', gate.squatCycleDebug?.completionBlockedReason !== 'no_descend', {
    completionBlockedReason: gate.squatCycleDebug?.completionBlockedReason,
    completionPassReason: gate.squatCycleDebug?.completionPassReason,
  });
  ok('A4: shallow real squat can pass', gate.status === 'pass' && gate.completionSatisfied === true, {
    status: gate.status,
    completionSatisfied: gate.completionSatisfied,
    completionPassReason: gate.squatCycleDebug?.completionPassReason,
  });
}

console.log('\nB. standard_cycle low-quality + decouple vs latch');
{
  const blockedGate = makeSquatGate({
    confidence: 0.64,
    captureQuality: 'low',
    flags: ['hard_partial', 'unstable_frame_timing'],
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  /**
   * PR-01 / low-quality decouple: integrity 는 progression latch 에서 null 이 되고
   * qualityOnlyWarnings 로만 남는다. mock gate 는 min-cycle·owner·passConfirm 충족.
   */
  ok(
    'B1: standard_cycle low-quality severe flags still latch under decouple',
    isFinalPassLatched('squat', blockedGate) === true,
    isFinalPassLatched('squat', blockedGate)
  );

  const allowedGate = makeSquatGate({
    confidence: 0.64,
    captureQuality: 'low',
    flags: [],
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'B2: standard_cycle low-quality without severe flags still passes',
    isFinalPassLatched('squat', allowedGate) === true,
    isFinalPassLatched('squat', allowedGate)
  );
}

console.log('\nC. deep squat preserved');
{
  const deepAngles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
    60, 60,
    70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, deepAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks));

  ok('C1: deep squat still passes', gate.status === 'pass' && gate.completionSatisfied === true, {
    status: gate.status,
    completionSatisfied: gate.completionSatisfied,
  });
  ok(
    'C2: deep squat remains standard_cycle',
    gate.squatCycleDebug?.completionPassReason === 'standard_cycle',
    gate.squatCycleDebug?.completionPassReason
  );
}

console.log('\nD. low_rom / ultra_low_rom paths are not hit by standard-only hardening');
{
  const lowRomGate = makeSquatGate({
    confidence: 0.58,
    captureQuality: 'low',
    flags: ['hard_partial', 'unstable_frame_timing'],
    passConfirmationFrameCount: 2,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'D1: low_rom_event_cycle remains latched by easy branch',
    isFinalPassLatched('squat', lowRomGate) === true,
    isFinalPassLatched('squat', lowRomGate)
  );

  const ultraLowRomGate = makeSquatGate({
    confidence: 0.57,
    captureQuality: 'low',
    flags: ['hard_partial', 'unilateral_joint_dropout'],
    passConfirmationFrameCount: 2,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'ultra_low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'D2: ultra_low_rom_event_cycle remains latched by easy branch',
    isFinalPassLatched('squat', ultraLowRomGate) === true,
    isFinalPassLatched('squat', ultraLowRomGate)
  );
}

console.log(`\n━━━ PR-CAM-26 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
