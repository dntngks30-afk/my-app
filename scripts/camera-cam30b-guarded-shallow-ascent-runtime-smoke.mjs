/**
 * PR-CAM-30B — guarded shallow ascent (runtime pose-features)
 *
 * npx tsx scripts/camera-cam30b-guarded-shallow-ascent-runtime-smoke.mjs
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

function makeSquatPf(depth, ts) {
  return {
    timestampMs: ts,
    stepId: 'squat',
    frameValidity: 'valid',
    phaseHint: 'start',
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

function mockLandmark(x, y, visibility = 0.99) {
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

console.log('\n-- A. Synthetic PF: hasGuardedShallowSquatAscent --');
{
  const depths = [
    ...Array(6).fill(0.038),
    0.040, 0.046, 0.052, 0.059, 0.066, 0.073,
    0.068, 0.061, 0.054, 0.047, 0.040, 0.036,
    ...Array(6).fill(0.036),
  ];
  const frames = depths.map((d, i) => makeSquatPf(d, 1000 + i * 40));
  let guardHitCount = 0;
  for (let i = 0; i < frames.length; i++) {
    if (hasGuardedShallowSquatAscent(frames, i)) guardHitCount++;
  }
  ok(
    'A1: hasGuardedShallowSquatAscent hit >= 1',
    guardHitCount >= 1,
    { guardHitCount }
  );
}

console.log('\n-- A2. Pipeline: shallow sequence --');
{
  function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
    const lm = Array(33)
      .fill(null)
      .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
    const depthT = Math.min(1, Math.max(0, (170 - kneeAngleDeg) / 110));
    const shoulderY = 0.18 + depthT * 0.05;
    const hipY = 0.38 + depthT * 0.12;
    const kneeY = 0.58 + depthT * 0.04;
    const shinLen = 0.18;
    const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
    lm[11] = mockLandmark(0.42, shoulderY, 0.99);
    lm[12] = mockLandmark(0.58, shoulderY, 0.99);
    lm[23] = mockLandmark(0.44, hipY, 0.99);
    lm[24] = mockLandmark(0.56, hipY, 0.99);
    lm[25] = mockLandmark(0.45, kneeY, 0.99);
    lm[26] = mockLandmark(0.55, kneeY, 0.99);
    lm[27] = mockLandmark(0.45 + Math.sin(bendRad) * shinLen, kneeY + Math.cos(bendRad) * shinLen, 0.99);
    lm[28] = mockLandmark(0.55 + Math.sin(bendRad) * shinLen, kneeY + Math.cos(bendRad) * shinLen, 0.99);
    lm[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
    return { landmarks: lm, timestamp };
  }

  const SHALLOW_ANGLES = [
    170, 168, 162, 152, 145, 140, 138,
    ...Array(12).fill(137),
    138, 141, 148, 155, 162, 167, 170,
  ];
  const stepMs = 120;
  const angles = [...Array(18).fill(170), ...SHALLOW_ANGLES, ...Array(20).fill(170)];
  const lm = angles.map((ang, i) =>
    squatPoseLandmarksFromKneeAngle(8000 + i * stepMs, ang)
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
    'A2: ascent label or guardedShallowAscentDetected or not no_reversal',
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

console.log('\n-- B. Flat bottom hold --');
{
  const base = 0.03;
  const flatDepths = [
    ...Array(10).fill(base),
    0.04, 0.055, 0.068, 0.075,
    ...Array(14).fill(0.075),
    ...Array(8).fill(base),
  ];
  const lm = flatDepths.map((d, i) => squatPoseLandmarks(12000 + i * 80, d));
  const pf = buildPoseFeaturesFrames(
    'squat',
    lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const holdSlice = pf.slice(14, 28);
  const ascentInHold = holdSlice.filter((f) => f.phaseHint === 'ascent').length;
  ok('B1: flat hold ascent label <= 2', ascentInHold <= 2, { ascentInHold });
}

console.log('\n-- C. Standing sway --');
{
  const depths = [...Array(24).fill(0.018), 0.022, 0.019, 0.021, 0.020, ...Array(8).fill(0.018)];
  const lm = depths.map((d, i) => squatPoseLandmarks(15000 + i * 80, d));
  const pf = buildPoseFeaturesFrames(
    'squat',
    lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  let anyGuard = false;
  for (let i = 0; i < pf.length; i++) {
    if (hasGuardedShallowSquatAscent(pf, i)) anyGuard = true;
  }
  ok('C1: no guarded ascent on sub-0.03 sway', anyGuard === false, { anyGuard });
}

console.log(`\n=== PR-CAM-30B guarded ascent runtime smoke: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
