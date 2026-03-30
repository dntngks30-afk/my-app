/**
 * PR-CAM-29 — 연속 shallow motion 에서 blended stabilization 이 shallow truth 를 보조
 *
 * npx tsx scripts/camera-cam29-shallow-depth-source-persistence-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
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

const STANDING_ANGLES = Array(12).fill(170);
const SHALLOW_SQUAT_CYCLE = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];

/** PR G6: standard owner 는 primary 피크 ≥ 55% — shallow fixture 는 여기 미만이어야 함 */
const STANDARD_BAND_MIN_PRIMARY_PEAK_PCT = 55;

console.log('\n── A. cam27 얕은 스쿼트 — event 승격 없음, depthBand shallow ──');
{
  const angles = [...STANDING_ANGLES, ...SHALLOW_SQUAT_CYCLE, ...Array(8).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(1000, angles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);
  ok('A1: eventCyclePromoted = 0', (hm.squatEventCyclePromoted ?? 0) === 0, hm.squatEventCyclePromoted);
  ok('A2: primary peak < standard band', (hm.squatDepthPeakPrimary ?? 100) < STANDARD_BAND_MIN_PRIMARY_PEAK_PCT, hm.squatDepthPeakPrimary);
  ok('A3: relativeDepthPeak > 0', (hm.relativeDepthPeak ?? 0) > 0, hm.relativeDepthPeak);
  ok('A4: depthBand shallow (0)', hm.depthBand === 0, hm.depthBand);
}

/**
 * 무릎 전방 오프셋을 프레임마다 늘려 knee travel 증거를 쌓되,
 * depthProxy 파라미터는 낮게 유지해 primary 가 flat 구간에 머무르게 한다(PR-04E1 squat-depth 신호와 동일 목적).
 */
function squatPoseLandmarksShallowMotion(timestamp, depthProxy, extraKneeForward) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.92));
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  const kneeForward = depthProxy * 0.22 + extraKneeForward;
  landmarks[23] = mockLandmark(0.45, hipY, 0.92);
  landmarks[24] = mockLandmark(0.55, hipY, 0.92);
  landmarks[25] = mockLandmark(0.45 + kneeForward, kneeY, 0.92);
  landmarks[26] = mockLandmark(0.55 - kneeForward, kneeY, 0.92);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.92);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.92);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.92);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.92);
  return { landmarks, timestamp };
}

console.log('\n── B. 연속 얕은 depth + 전방 오프셋 누적 — temporal 후 blend active ──');
{
  const n = 18;
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push(squatPoseLandmarksShallowMotion(4000 + i * 80, 0.01, i * 0.012));
  }
  const pf = buildPoseFeaturesFrames(
    'squat',
    frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const activeCount = pf.filter((f) => f.derived.squatDepthBlendActive === true).length;
  const offeredCount = pf.filter((f) => f.derived.squatDepthBlendOffered === true).length;
  ok('B1: some blend-offered frames', offeredCount > 0, offeredCount);
  ok('B2: some blend-active after temporal gate', activeCount > 0, activeCount);

  const ev = evaluateSquatFromPoseFrames(pf);
  const hm = ev.debug?.highlightedMetrics ?? {};
  ok('B3: observability: active frame count', (hm.squatDepthBlendActiveFrameCount ?? 0) > 0, hm.squatDepthBlendActiveFrameCount);
  ok('B4: observability: flip count finite', typeof hm.squatDepthSourceFlipCount === 'number', hm);
}

console.log(`\n━━━ PR-CAM-29 persistence smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed > 0) process.exit(1);
