/**
 * PR-CAM-OVERLAY-RENDER-SMOOTHING-01 smoke
 * Run: npx tsx scripts/camera-pr-overlay-render-smoothing-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  smoothPoseOverlayLandmarks,
  meanLandmarkL1DeltaBetweenFrames,
  POSE_OVERLAY_LANDMARK_COUNT,
} = await import('../src/lib/motion/pose-overlay-smoothing.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${d}`);
    process.exitCode = 1;
  }
}

function baseLandmarks() {
  const lm = [];
  for (let i = 0; i < POSE_OVERLAY_LANDMARK_COUNT; i++) {
    lm.push({ x: 0.5, y: 0.5, visibility: 0.9 });
  }
  return lm;
}

// ─── A. jitter → smoothed 평균 델타 감소 ───────────────────────────────────

console.log('\n── A. alternating jitter → lower mean frame delta ──');
{
  const rawFrames = [];
  for (let t = 0; t < 24; t++) {
    const noseX = t % 2 === 0 ? 0.48 : 0.56;
    const f = baseLandmarks();
    f[0] = { x: noseX, y: 0.45, visibility: 0.95 };
    rawFrames.push(f);
  }

  const smoothedFrames = [];
  let state = null;
  for (const raw of rawFrames) {
    const { landmarks, nextState } = smoothPoseOverlayLandmarks(raw, state);
    state = nextState;
    smoothedFrames.push(landmarks);
  }

  const dRaw = meanLandmarkL1DeltaBetweenFrames(rawFrames);
  const dSm = meanLandmarkL1DeltaBetweenFrames(smoothedFrames);

  ok('A1: smoothed mean delta < raw mean delta', dSm < dRaw, { dRaw, dSm });
  ok('A2: smoothed delta > 0 (still moves)', dSm > 0, dSm);
}

// ─── B. 단조 방향 유지 ──────────────────────────────────────────────────────

console.log('\n── B. monotonic motion intent preserved ──');
{
  const smoothedNoseX = [];
  let state = null;
  for (let t = 0; t < 20; t++) {
    const f = baseLandmarks();
    const x = 0.3 + (0.5 - 0.3) * (t / 19);
    f[0] = { x, y: 0.45, visibility: 0.95 };
    const { landmarks, nextState } = smoothPoseOverlayLandmarks(f, state);
    state = nextState;
    smoothedNoseX.push(landmarks[0].x);
  }

  ok(
    'B1: smoothed nose x increases overall',
    smoothedNoseX[smoothedNoseX.length - 1] > smoothedNoseX[0],
    { first: smoothedNoseX[0], last: smoothedNoseX[smoothedNoseX.length - 1] }
  );
}

// ─── C. 짧은 missing gap → carry 후 복구 ───────────────────────────────────

console.log('\n── C. short missing-landmark gap → brief carry ──');
{
  let state = null;
  const seq = [];

  const good = () => {
    const f = baseLandmarks();
    f[0] = { x: 0.55, y: 0.44, visibility: 0.9 };
    return f;
  };

  const badNose = () => {
    const f = good();
    f[0] = { x: Number.NaN, y: Number.NaN, visibility: 0 };
    return f;
  };

  seq.push(smoothPoseOverlayLandmarks(good(), state));
  state = seq[seq.length - 1].nextState;
  seq.push(smoothPoseOverlayLandmarks(badNose(), state));
  state = seq[seq.length - 1].nextState;
  seq.push(smoothPoseOverlayLandmarks(badNose(), state));
  state = seq[seq.length - 1].nextState;
  const afterGap = smoothPoseOverlayLandmarks(good(), state);

  ok(
    'C1: during gap nose still finite (carried)',
    Number.isFinite(seq[1].landmarks[0].x) && Number.isFinite(seq[1].landmarks[0].y),
    seq[1].landmarks[0]
  );
  ok(
    'C2: after gap nose returns near target',
    Math.abs(afterGap.landmarks[0].x - 0.55) < 0.08,
    afterGap.landmarks[0].x
  );
}

// ─── D. empty / reset ─────────────────────────────────────────────────────

console.log('\n── D. empty frame → state null, no infinite ghost ──');
{
  let state = null;
  const first = smoothPoseOverlayLandmarks(baseLandmarks(), state);
  state = first.nextState;
  const empty = smoothPoseOverlayLandmarks(null, state);
  ok('D1: empty → nextState null', empty.nextState === null, empty.nextState);
  const fresh = smoothPoseOverlayLandmarks(baseLandmarks(), empty.nextState);
  ok(
    'D2: after reset first frame uses raw (no stale carry from before empty)',
    Math.abs(fresh.landmarks[0].x - 0.5) < 0.02,
    fresh.landmarks[0].x
  );
}

console.log(`\n━━━ overlay render smoothing smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
}
