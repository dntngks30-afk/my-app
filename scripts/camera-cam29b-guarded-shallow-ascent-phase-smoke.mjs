/**
 * PR-CAM-29B — guarded shallow ascent phase labels (pose-features)
 *
 * npx tsx scripts/camera-cam29b-guarded-shallow-ascent-phase-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  buildPoseFeaturesFrames,
  hasGuardedShallowSquatAscent,
} = await import('../src/lib/camera/pose-features.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

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

function makeSquatPf(depth, ts, phaseHint = 'start') {
  return {
    timestampMs: ts,
    stepId: 'squat',
    frameValidity: 'valid',
    phaseHint,
    derived: { squatDepthProxy: depth, squatDepthProxyBlended: depth },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    isValid: true,
  };
}

console.log('\n── A. guarded shallow ascent predicate (합성 프레임) ──');
{
  const depths = [
    ...Array(6).fill(0.038),
    0.045,
    0.052,
    0.059,
    0.066,
    0.073,
    0.069,
    0.062,
    0.055,
    0.048,
    0.042,
    0.038,
  ];
  const frames = depths.map((d, i) => makeSquatPf(d, 5000 + i * 40, 'start'));
  let guardHit = false;
  for (let i = 0; i < frames.length; i++) {
    if (hasGuardedShallowSquatAscent(frames, i)) guardHit = true;
  }
  ok('A1: hasGuardedShallowSquatAscent true on descent-from-shallow-peak', guardHit, guardHit);
}

console.log('\n── A2. 파이프라인: 통합 얕은 시퀀스에서 ascent·가드 관측 ──');
{
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
  const SHALLOW_DOWN_UP = [
    170, 168, 160, 148, 130, 115, 105, 100, 98, 96,
    ...Array(16).fill(95),
    96, 100, 108, 120, 135, 150, 162, 168, 170,
  ];
  const stepMs = 120;
  const angles = [...Array(18).fill(170), ...SHALLOW_DOWN_UP, ...Array(20).fill(170)];
  const lm = angles.map((ang, i) =>
    squatPoseLandmarksFromKneeAngle(12_000 + i * stepMs, ang)
  );
  const pf = buildPoseFeaturesFrames(
    'squat',
    lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const ev = evaluateSquatFromPoseFrames(pf);
  const hm = ev.debug?.highlightedMetrics;
  const ascentFrames = pf.filter((f) => f.phaseHint === 'ascent').length;
  const st = evaluateSquatCompletionState(pf, {});
  ok(
    'A2: 얕은 통합 시퀀스 — ascent 라벨·가드·no_reversal 해소 중 하나 이상',
    ascentFrames >= 1 ||
      (hm?.ascentCount ?? 0) >= 1 ||
      (hm?.guardedShallowAscentDetected ?? 0) === 1 ||
      st.ruleCompletionBlockedReason !== 'no_reversal',
    {
      ascentFrames,
      ascentCount: hm?.ascentCount,
      guarded: hm?.guardedShallowAscentDetected,
      block: st.ruleCompletionBlockedReason,
    }
  );
}

console.log('\n── B. bottom hold flat (no guarded ascent) → no false ascent spam ──');
{
  const base = 0.05;
  const depths = [
    ...Array(12).fill(base),
    0.06,
    0.07,
    0.078,
    0.078,
    0.078,
    0.077,
    0.078,
    0.077,
    0.078,
    ...Array(10).fill(base),
  ];
  const lm = depths.map((d, i) => squatPoseLandmarks(8000 + i * 90, d));
  const frames = buildPoseFeaturesFrames(
    'squat',
    lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const ascentDuringHold = frames.slice(18, 26).filter((f) => f.phaseHint === 'ascent').length;
  ok('B1: flat bottom window not all mislabeled ascent', ascentDuringHold <= 2, {
    ascentDuringHold,
    slice: frames.slice(18, 26).map((f) => f.phaseHint),
  });
}

console.log('\n── C. standing sway (tiny depth) → hasGuardedShallowSquatAscent false ──');
{
  const depths = [...Array(24).fill(0.018), 0.022, 0.019, 0.021, ...Array(8).fill(0.018)];
  const lm = depths.map((d, i) => squatPoseLandmarks(9000 + i * 80, d));
  const frames = buildPoseFeaturesFrames(
    'squat',
    lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  let anyAscentGuard = false;
  for (let i = 0; i < frames.length; i++) {
    if (hasGuardedShallowSquatAscent(frames, i)) anyAscentGuard = true;
  }
  ok('C1: no guarded shallow ascent on noise standing', anyAscentGuard === false, anyAscentGuard);
}

console.log(`\n━━━ PR-CAM-29B ascent phase smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
