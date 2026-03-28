/**
 * PR-04E1 smoke — squat depth blend + arming input stabilization
 *
 * npx tsx scripts/camera-pr-04e1-squat-depth-arming-stabilization-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

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
    console.error(`  FAIL: ${name}${extra != null ? ` | ${JSON.stringify(extra)}` : ''}`);
    process.exitCode = 1;
  }
}

function frameLike(derived, joints) {
  return { derived, joints };
}

console.log('\n── A. flat primary + hip-knee flex evidence → blended lifts ──');
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
  const sig = buildSquatDepthSignal(frameLike(lowPrimary, joints), frameLike(lowPrimary, prevJ));
  ok('A1: blended or fallback path', sig.source === 'blended' || sig.source === 'fallback', sig);
  ok('A2: depth above tiny primary', sig.depthValue > 0.018, sig);
}

console.log('\n── B. standing jitter: no runaway blended ──');
{
  const tiny = { squatDepthProxy: 0.006, kneeAngleLeft: 172, kneeAngleRight: 172, kneeAngleAvg: 172 };
  const j = {
    leftHip: { x: 0.45, y: 0.35 },
    leftKnee: { x: 0.455, y: 0.38 },
    rightHip: { x: 0.55, y: 0.35 },
    rightKnee: { x: 0.545, y: 0.38 },
    shoulderCenter: { x: 0.5, y: 0.18 },
    hipCenter: { x: 0.5, y: 0.35 },
  };
  const prev = {
    leftHip: { x: 0.451, y: 0.35 },
    leftKnee: { x: 0.454, y: 0.379 },
    rightHip: { x: 0.549, y: 0.35 },
    rightKnee: { x: 0.546, y: 0.379 },
    shoulderCenter: { x: 0.5, y: 0.18 },
    hipCenter: { x: 0.5, y: 0.35 },
  };
  const sig = buildSquatDepthSignal(frameLike(tiny, j), frameLike(tiny, prev));
  ok('B1: stays primary or low blended', sig.depthValue < 0.04, sig);
  ok('B2: not aggressive blended spike', sig.source !== 'blended' || sig.depthValue < 0.025, sig);
}

console.log('\n── C. deep motion: primary strong unchanged ──');
{
  const deep = { squatDepthProxy: 0.42, kneeAngleLeft: 95, kneeAngleRight: 95, kneeAngleAvg: 95 };
  const j = {
    leftHip: { x: 0.45, y: 0.4 },
    leftKnee: { x: 0.5, y: 0.55 },
    rightHip: { x: 0.55, y: 0.4 },
    rightKnee: { x: 0.5, y: 0.55 },
    shoulderCenter: { x: 0.5, y: 0.2 },
    hipCenter: { x: 0.5, y: 0.4 },
  };
  const sig = buildSquatDepthSignal(frameLike(deep, j), null);
  ok('C1: source primary', sig.source === 'primary', sig);
  ok('C2: depth near primary', Math.abs(sig.depthValue - 0.42) < 0.05, sig);
}

function mockLandmark(x, y, visibility = 0.92) {
  return { x, y, visibility };
}

function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.92));
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  const kneeForward = depthProxy * 0.22;
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

function poseSeries(startTs, depthValues, stepMs = 80) {
  return depthValues.map((depthProxy, i) => squatPoseLandmarks(startTs + i * stepMs, depthProxy));
}

console.log('\n── D. evaluator debug contract fields ──');
{
  const frames = poseSeries(100, [
    ...Array(12).fill(0.012),
    0.02, 0.04, 0.08, 0.14, 0.2, 0.22, 0.2, 0.14, 0.08, 0.04, 0.02, 0.014, 0.012,
  ]);
  const pf = buildPoseFeaturesFrames(
    'squat',
    frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const ev = evaluateSquatFromPoseFrames(pf);
  ok('D1: squatDepthCalibration present', ev.debug?.squatDepthCalibration != null);
  ok('D2: maxBlended >= maxPrimary - 0.02 (deep fixture)', ev.debug.squatDepthCalibration.maxBlendedDepth >= ev.debug.squatDepthCalibration.maxPrimaryDepth - 0.02);
  ok('D3: highlighted peaks', typeof ev.debug.highlightedMetrics?.squatDepthPeakPrimary === 'number');
  ok('D4: highlighted blended', typeof ev.debug.highlightedMetrics?.squatDepthPeakBlended === 'number');
  ok('D5: arming meta', typeof ev.debug.squatCompletionArming?.armingDepthPeak === 'number');
}

console.log('\n── E. completion ownership keys still present ──');
{
  const frames = poseSeries(200, [...Array(14).fill(0.015), 0.05, 0.12, 0.2, 0.12, 0.05, 0.015]);
  const pf = buildPoseFeaturesFrames(
    'squat',
    frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const ev = evaluateSquatFromPoseFrames(pf);
  const st = ev.debug?.squatCompletionState;
  ok('E1: completionPassReason string', typeof st?.completionPassReason === 'string');
  ok('E2: completionBlockedReason typed', st?.completionBlockedReason === null || typeof st?.completionBlockedReason === 'string');
}

console.log(`\n━━━ PR-04E1 smoke: ${passed} passed, ${failed} failed ━━━`);
