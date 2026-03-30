/**
 * PR-CAM-22 smoke test — squat owner cutoff only
 *
 * 목표:
 * - evidenceLabel cutoff는 그대로 두고
 * - standard owner cutoff만 더 깊게 둬
 * - relativeDepthPeak ~= 0.30 성공 사이클이 standard_cycle이 아니라
 *   low_rom_cycle(PR-03 공식 shallow 오너 밴드)이 되도록 확인한다.
 *
 * 실행:
 *   npx tsx scripts/camera-cam22-squat-owner-cutoff-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

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

function makeStateFrame(depth, timestampMs, phaseHint) {
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

function stateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) =>
    makeStateFrame(depth, 100 + i * stepMs, phases[i] ?? 'unknown')
  );
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

console.log('\nA. observed-like shallow success (~0.30) is no longer standard');
{
  const state = evaluateSquatCompletionState(
    stateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.08, 0.16, 0.24, 0.312, 0.312, 0.24, 0.16, 0.08, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start']
    )
  );

  ok('A1: completionBlockedReason = null', state.completionBlockedReason === null, state);
  ok(
    'A2: evidenceLabel can remain standard',
    state.evidenceLabel === 'standard',
    { evidenceLabel: state.evidenceLabel, relativeDepthPeak: state.relativeDepthPeak }
  );
  ok(
    'A3: completionPassReason = low_rom_cycle (PR-03)',
    state.completionPassReason === 'low_rom_cycle',
    { completionPassReason: state.completionPassReason, relativeDepthPeak: state.relativeDepthPeak }
  );
}

console.log('\nB. deep squat preserved');
{
  const state = evaluateSquatCompletionState(
    stateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.10, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.10, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start']
    )
  );

  ok('B1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'B2: completionPassReason = standard_cycle',
    state.completionPassReason === 'standard_cycle',
    { completionPassReason: state.completionPassReason, relativeDepthPeak: state.relativeDepthPeak }
  );
}

console.log('\nC. ultra-low valid cycle preserved');
{
  const state = evaluateSquatCompletionState(
    stateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'ascent', 'ascent', 'start', 'start', 'start'],
      100
    )
  );

  ok('C1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'C2: completionPassReason = ultra_low_rom_cycle (PR-03)',
    state.completionPassReason === 'ultra_low_rom_cycle',
    { completionPassReason: state.completionPassReason, relativeDepthPeak: state.relativeDepthPeak }
  );
}

console.log('\nD. standing still blocked');
{
  const state = evaluateSquatCompletionState(
    stateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.015, 0.014, 0.013, 0.012, 0.011, 0.01],
      ['start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start']
    )
  );

  ok('D1: completionSatisfied = false', state.completionSatisfied === false, state);
}

console.log('\nE. micro dip blocked');
{
  const state = evaluateSquatCompletionState(
    stateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.025, 0.045, 0.05, 0.03, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'start', 'start', 'start', 'ascent', 'start', 'start', 'start'],
      40
    )
  );

  ok('E1: completionSatisfied = false', state.completionSatisfied === false, state);
}

console.log('\nF. quality semantics unchanged');
{
  const state = evaluateSquatCompletionState(
    stateFrames(
      [0.01, 0.01, 0.01, 0.01, 0.08, 0.16, 0.24, 0.312, 0.312, 0.24, 0.16, 0.08, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start']
    )
  );

  ok(
    'F1: evidenceLabel remains standard while pass is low_rom_cycle',
    state.evidenceLabel === 'standard' && state.completionPassReason === 'low_rom_cycle',
    { evidenceLabel: state.evidenceLabel, completionPassReason: state.completionPassReason }
  );
}

console.log('\nG. debug mapping remains coherent');
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
    'G1: completionPathUsed matches completionPassReason mapping',
    (gate.squatCycleDebug?.completionPassReason === 'standard_cycle' &&
      gate.squatCycleDebug?.completionPathUsed === 'standard') ||
      (gate.squatCycleDebug?.completionPassReason === 'low_rom_cycle' &&
        gate.squatCycleDebug?.completionPathUsed === 'low_rom') ||
      (gate.squatCycleDebug?.completionPassReason === 'ultra_low_rom_cycle' &&
        gate.squatCycleDebug?.completionPathUsed === 'ultra_low_rom'),
    {
      completionPassReason: gate.squatCycleDebug?.completionPassReason,
      completionPathUsed: gate.squatCycleDebug?.completionPathUsed,
    }
  );
}

console.log(`\n━━━ PR-CAM-22 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
