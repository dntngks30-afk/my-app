/**
 * PR-CAM-21 smoke test — squat proxy recalibration + owner decoupling
 *
 * 검증 목표:
 * - moderate knee flexion이 더 이상 relativeDepthPeak ~= 1 로 포화되지 않는다.
 * - completionPassReason은 evidenceLabel이 아닌 실제 성공 경로에서 결정된다.
 * - completionPathUsed는 completionPassReason과 일치한다.
 *
 * 실행:
 *   npx tsx scripts/camera-cam21-squat-proxy-owner-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquat } = await import('../src/lib/camera/evaluators/squat.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
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

/**
 * knee-angle 기반 squat landmark 생성.
 *
 * 핵심:
 * - pose-features.ts 는 kneeAngleAvg -> squatDepthProxy 로 depth를 계산한다.
 * - 따라서 실기기와 가까운 "angle-driven" fixture 로 proxy saturation을 본다.
 */
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
  /**
   * 주의: pose-features.ts 의 angle() 는 180 초과 차이를 interior-angle 로 재정규화하지 않는다.
   * 테스트 픽스처에서는 좌우 무릎이 동일 각도로 읽히도록 양쪽 모두 같은 방향(오른쪽)으로
   * 하퇴 벡터를 둔다.
   */
  landmarks[27] = mockLandmark(leftKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(rightKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.50, 0.08 + depthT * 0.02, 0.99);

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

function makeCompletionStateFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
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
    joints: {},
    eventHints: [],
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}

function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) =>
    makeCompletionStateFrame(depth, 100 + i * stepMs, phases[i] ?? 'unknown')
  );
}

console.log('\nA. moderate fixture — proxy saturation no longer deep');
{
  const moderateAngles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 95, 90,
    90, 90,
    95, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const result = evaluateSquat(toLandmarks(makeKneeAngleSeries(100, moderateAngles, 80)));
  const hm = result.debug?.highlightedMetrics ?? {};

  ok(
    'A1: moderate relativeDepthPeak is not near 1',
    typeof hm.relativeDepthPeak === 'number' && hm.relativeDepthPeak < 0.2,
    { relativeDepthPeak: hm.relativeDepthPeak, evidenceLabel: hm.evidenceLabel }
  );
  ok(
    'A2: moderate evidenceLabel is not standard',
    hm.evidenceLabel !== 'standard',
    { relativeDepthPeak: hm.relativeDepthPeak, evidenceLabel: hm.evidenceLabel }
  );
}

console.log('\nB. moderate valid cycle — non-standard owner + debug path');
{
  const moderateAngles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 95, 90,
    90, 90,
    95, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, moderateAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks));

  ok('B1: completionSatisfied = true', gate.completionSatisfied === true, gate.squatCycleDebug);
  ok(
    'B2: completionPassReason is non-standard owner',
    ['low_rom_cycle', 'ultra_low_rom_cycle', 'low_rom_event_cycle', 'ultra_low_rom_event_cycle'].includes(
      gate.squatCycleDebug?.completionPassReason
    ),
    {
      completionPassReason: gate.squatCycleDebug?.completionPassReason,
      evidenceLabel: gate.squatCycleDebug?.evidenceLabel,
    }
  );
  ok(
    'B3: completionPathUsed != standard',
    gate.squatCycleDebug?.completionPathUsed != null &&
      gate.squatCycleDebug?.completionPathUsed !== 'standard',
    {
      completionPathUsed: gate.squatCycleDebug?.completionPathUsed,
      completionPassReason: gate.squatCycleDebug?.completionPassReason,
    }
  );
  ok('B4: gate status = pass', gate.status === 'pass', gate.status);
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

  ok('C1: completionSatisfied = true', gate.completionSatisfied === true, gate.squatCycleDebug);
  ok(
    'C2: completionPassReason = standard_cycle',
    gate.squatCycleDebug?.completionPassReason === 'standard_cycle',
    gate.squatCycleDebug?.completionPassReason
  );
  ok(
    'C3: completionPathUsed = standard',
    gate.squatCycleDebug?.completionPathUsed === 'standard',
    gate.squatCycleDebug?.completionPathUsed
  );
}

console.log('\nD. standing still blocked');
{
  const standingAngles = Array(24).fill(170);
  const landmarks = toLandmarks(makeKneeAngleSeries(100, standingAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks));

  ok('D1: no false pass', gate.completionSatisfied === false, gate.squatCycleDebug);
}

console.log('\nE. micro dip blocked');
{
  const tinyDipAngles = [
    ...Array(10).fill(170),
    168, 166, 165, 164,
    165, 166, 168, 170,
    ...Array(4).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, tinyDipAngles, 40));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 1800));

  ok('E1: micro dip does not complete', gate.completionSatisfied === false, gate.squatCycleDebug);
}

console.log('\nF. quality remains strict on moderate pass');
{
  const moderateAngles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 95, 90,
    90, 90,
    95, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, moderateAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks));

  ok(
    'F1: moderate pass is not promoted to strong_evidence',
    gate.squatCycleDebug?.squatEvidenceLevel !== 'strong_evidence',
    {
      squatEvidenceLevel: gate.squatCycleDebug?.squatEvidenceLevel,
      evidenceLabel: gate.squatCycleDebug?.evidenceLabel,
    }
  );
}

console.log('\nG. owner decouples from evidenceLabel');
{
  const state = evaluateSquatCompletionState(
    syntheticStateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.08, 0.11, 0.11, 0.08, 0.05, 0.03, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start']
    )
  );

  ok(
    'G1: evidenceLabel can stay standard while owner is non-standard',
    state.evidenceLabel === 'standard' &&
      ['low_rom_cycle', 'ultra_low_rom_cycle', 'low_rom_event_cycle', 'ultra_low_rom_event_cycle'].includes(
        state.completionPassReason
      ),
    {
      evidenceLabel: state.evidenceLabel,
      completionPassReason: state.completionPassReason,
      relativeDepthPeak: state.relativeDepthPeak,
    }
  );
}

console.log('\nH. debug path matches pass reason');
{
  const deepAngles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
    60, 60,
    70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const deepGate = evaluateExerciseAutoProgress(
    'squat',
    toLandmarks(makeKneeAngleSeries(100, deepAngles, 80)),
    squatStats(toLandmarks(makeKneeAngleSeries(100, deepAngles, 80)))
  );

  ok(
    'H1: standard_cycle -> standard',
    deepGate.squatCycleDebug?.completionPassReason === 'standard_cycle' &&
      deepGate.squatCycleDebug?.completionPathUsed === 'standard',
    {
      completionPassReason: deepGate.squatCycleDebug?.completionPassReason,
      completionPathUsed: deepGate.squatCycleDebug?.completionPathUsed,
    }
  );
}

console.log(`\n━━━ PR-CAM-21 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
