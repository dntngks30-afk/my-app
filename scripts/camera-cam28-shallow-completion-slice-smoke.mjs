/**
 * CAM-28 — completion 슬라이스가 전역 shallow motion과 정렬되는지 검증
 *
 * 시나리오: 초기 standing이 짧고(4프레임 각도만), 얕은 스쿼트 후 긴 사후 standing.
 * 구버전은 버퍼 앞쪽의 첫 10-frame stable이 사후 tail에만 걸려 completion이 tail-only가 될 수 있음.
 * PR-CAM-28 피크 앵커는 글로벌 depth 피크 직전 standing을 써서 슬라이스에 스쿼트를 포함해야 함.
 *
 * 실행: npx tsx scripts/camera-cam28-shallow-completion-slice-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  ✗ ${name}${detail}`);
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

function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function toLandmarks(sequence) {
  return sequence.map((frame) => ({ landmarks: frame.landmarks, timestamp: frame.timestamp }));
}

function squatStats(len, captureDurationMs) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: captureDurationMs ?? len * 80,
    timestampDiscontinuityCount: 0,
  };
}

function getHm(gate) {
  return gate?.evaluatorResult?.debug?.highlightedMetrics ?? {};
}

const SHALLOW_SQUAT_CYCLE = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];

console.log('CAM-28 shallow completion slice alignment smoke\n');

// 4프레임만 standing → 얕은 스쿼트 → 28프레임 standing (사후 tail 길게)
const TAIL_HEAVY_ANGLES = [
  ...Array(4).fill(170),
  ...SHALLOW_SQUAT_CYCLE,
  ...Array(28).fill(170),
];

{
  const lm = toLandmarks(makeKneeAngleSeries(10_000, TAIL_HEAVY_ANGLES));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);

  ok('tail-heavy: armed', hm.completionArmingArmed === 1, hm.completionArmingArmed);
  ok('tail-heavy: rawDepthPeak > 0', hm.rawDepthPeak > 0, hm.rawDepthPeak);
  ok('tail-heavy: relativeDepthPeak > 0', hm.relativeDepthPeak > 0, hm.relativeDepthPeak);
  ok('tail-heavy: depthTruthWindowMismatch = 0', hm.depthTruthWindowMismatch === 0, hm.depthTruthWindowMismatch);
  ok('tail-heavy: sliceMissedMotionCode = 0', hm.sliceMissedMotionCode === 0, hm.sliceMissedMotionCode);
  ok(
    'tail-heavy: completionSliceDepthPeak tracks global (≈ shallow peak)',
    hm.completionSliceDepthPeak > 0.02 && hm.globalDepthPeak > 0.02,
    { slice: hm.completionSliceDepthPeak, global: hm.globalDepthPeak }
  );
  ok(
    'tail-heavy: peak anchor or valid slice start before tail-only region',
    hm.completionArmingPeakAnchored === 1 || hm.completionArmingSliceStart < lm.length - 15,
    { sliceStart: hm.completionArmingSliceStart, peak: hm.completionArmingPeakAnchored }
  );
}

// Standing-only sway — 슬라이스 miss가 아니라 미무장/무의미 피크
{
  const noiseAngles = [...Array(30).fill(170), 171, 169, 170, 171, 170, ...Array(12).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(20_000, noiseAngles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);
  ok('noise: no false high relativeDepthPeak', hm.relativeDepthPeak < 0.03, hm.relativeDepthPeak);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
