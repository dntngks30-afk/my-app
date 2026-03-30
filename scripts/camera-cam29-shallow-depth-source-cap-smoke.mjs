/**
 * PR-CAM-29 — shallow depth source cap + sway/jitter (blended 과상승·moderate 밴드 도약 방지)
 *
 * 기대값은 `src/lib/camera/evaluators/squat.ts` PR G6 depthBand(중간 밴드 ≥35% primary 피크)와
 * 동일한 스케일(퍼센트)만 사용 — 스크립트에 임의 threshold 금지.
 *
 * npx tsx scripts/camera-cam29-shallow-depth-source-cap-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { buildSquatDepthSignal } = await import('../src/lib/camera/squat/squat-depth-signal.ts');
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');

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

function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));

  const depthT = Math.min(1, Math.max(0, (170 - kneeAngleDeg) / 110));
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

function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * 80,
    timestampDiscontinuityCount: 0,
  };
}

function getHm(gate) {
  return gate?.evaluatorResult?.debug?.highlightedMetrics ?? {};
}

/** PR G6 moderate band: peak primary proxy ≥ 35% → depthBand 1 (squat evaluator) */
const MODERATE_BAND_MIN_PRIMARY_PEAK_PCT = 35;

console.log('\n── A. standing sway (cam27 D 계열) — blended 피크가 moderate 밴드로 과점프하지 않음 ──');
{
  const noiseAngles = [
    ...Array(15).fill(170),
    171, 169, 170, 171, 170, 169, 170, 171, 170,
    ...Array(8).fill(170),
  ];
  const lm = toLandmarks(makeKneeAngleSeries(5000, noiseAngles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);
  ok('A1: completionSatisfied = false', hm.completionSatisfied !== true, hm.completionSatisfied);
  ok('A2: relativeDepthPeak near 0', (hm.relativeDepthPeak ?? 1) < 0.02, hm.relativeDepthPeak);
  ok('A3: blended peak < moderate band (PR G6)', (hm.squatDepthPeakBlended ?? 0) < MODERATE_BAND_MIN_PRIMARY_PEAK_PCT, hm.squatDepthPeakBlended);
  ok('A4: eventCyclePromoted = 0', (hm.squatEventCyclePromoted ?? 0) === 0, hm.squatEventCyclePromoted);
}

console.log('\n── B. 단발 깊은 각도 스파이크 — 파이프라인에서 blended 시계열 max 가 moderate 미만 ──');
{
  const angles = [...Array(20).fill(170), 95, 170, 170, 170, 170];
  const lm = toLandmarks(makeKneeAngleSeries(8000, angles));
  const pf = buildPoseFeaturesFrames(
    'squat',
    lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const blendSeries = pf.map((f) =>
    typeof f.derived.squatDepthProxyBlended === 'number' ? f.derived.squatDepthProxyBlended : 0
  );
  const maxB = Math.max(...blendSeries);
  const maxPct = Math.round(maxB * 100);
  ok('B1: max blended < moderate band (PR G6)', maxPct < MODERATE_BAND_MIN_PRIMARY_PEAK_PCT, maxPct);
  const ev = evaluateSquatFromPoseFrames(pf);
  const hm = ev.debug?.highlightedMetrics ?? {};
  ok('B2: evaluator blended peak < moderate', (hm.squatDepthPeakBlended ?? 0) < MODERATE_BAND_MIN_PRIMARY_PEAK_PCT, hm.squatDepthPeakBlended);
}

console.log('\n── C. buildSquatDepthSignal 단일 프레임 — cap 메타가 과도 raw 를 눌렀는지 관측 ──');
{
  const lowPrimary = { squatDepthProxy: 0.008, kneeAngleLeft: 168, kneeAngleRight: 168, kneeAngleAvg: 168 };
  const joints = {
    leftHip: { x: 0.45, y: 0.35 },
    leftKnee: { x: 0.48, y: 0.52 },
    rightHip: { x: 0.55, y: 0.35 },
    rightKnee: { x: 0.52, y: 0.52 },
    shoulderCenter: { x: 0.5, y: 0.18 },
    hipCenter: { x: 0.5, y: 0.35 },
  };
  const prevJ = {
    leftHip: { x: 0.45, y: 0.35 },
    leftKnee: { x: 0.46, y: 0.4 },
    rightHip: { x: 0.55, y: 0.35 },
    rightKnee: { x: 0.54, y: 0.4 },
    shoulderCenter: { x: 0.5, y: 0.18 },
    hipCenter: { x: 0.5, y: 0.35 },
  };
  const frameLike = (derived, j) => ({ derived, joints: j });
  const sig = buildSquatDepthSignal(frameLike(lowPrimary, joints), frameLike(lowPrimary, prevJ));
  const raw = sig.blendCandidateRaw;
  const dv = sig.depthValue;
  ok('C1: depthValue ≤ raw when capped or equal', raw == null || dv <= raw + 1e-6, { dv, raw });
  ok('C2: output below moderate pct when blended', sig.source !== 'blended' || dv * 100 < MODERATE_BAND_MIN_PRIMARY_PEAK_PCT, sig);
}

console.log(`\n━━━ PR-CAM-29 cap smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed > 0) process.exit(1);
