/**
 * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP — source #4 plumbing smoke
 *
 * Purpose:
 *   The source-expansion smoke #1 only verifies source #4 fires through the
 *   `evaluateSquatCompletionState` boundary (via `evaluateCoreDirect`), which
 *   bypasses the evaluator's arming truncation. Through the full gate path
 *   (`evaluateExerciseAutoProgress`), arming truncates standing prefix frames
 *   and the slice-local BASELINE_WINDOW of `completionFrames` ends up sampling
 *   descent frames — historically this made source #4 silently return `null`
 *   for representative shallow fixtures (`shallow_92deg`, `ultra_low_rom_92deg`).
 *
 *   This smoke pins the follow-up plumbing fix: the evaluator seeds the
 *   **pre-arming** standing-window kneeAngleAvg median through
 *   `seedBaselineKneeAngleAvg`, and the completion core aligns
 *   `baselineFreezeFrameIndex` to the slice start when the seed is present.
 *   With that plumbing, source #4 MUST fire on both representative shallow
 *   fixtures WHEN driven through the full auto-progression gate — the same
 *   path used by the E1 promotion registry smoke and the product runtime.
 *
 * Boundary:
 *   - No threshold relaxation. `KNEE_DESCENT_ONSET_EPSILON_DEG` stays 5.0 and
 *     `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` stays 2. Fixture data unchanged.
 *   - No authority-law change. Source #4 remains additive to
 *     `effectiveDescentStartFrame`; PR-01 completion-owner truth is still the
 *     only opener of final pass.
 *   - No promotion edit. E1 registry states are NOT touched by this session.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import(
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
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${d}`);
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

/** Same knee-angle fixture builder as PR-D / PR-E1 / source-expansion smoke. */
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
function squatStats(landmarks, captureDurationMs = 3200) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}
function readCompletionState(gate) {
  return gate?.evaluatorResult?.debug?.squatCompletionState;
}

/**
 * Representative shallow fixtures — intentionally aligned with the E1 promotion
 * registry's `shallow_92deg` / `ultra_low_rom_92deg` shapes (standing → shallow
 * bottom → recovery). These are the fixtures the follow-up review/fix mission
 * targeted after the P4 blocked-promotion session.
 */
const SHALLOW_92DEG_ANGLES = [
  170, 170, 170, 170, 170, 170, 170, 170,
  165, 155, 145, 130, 115, 100, 95, 93, 92,
  92, 93, 95, 100, 115, 130, 145, 160,
  170, 170, 170, 170, 170, 170,
];

const ULTRA_LOW_ROM_92DEG_ANGLES = [
  170, 170, 170, 170, 170, 170, 170, 170,
  165, 155, 145, 130, 115, 100, 95, 93, 92,
  92, 93, 95, 100, 115, 130, 145, 160,
  170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
];

function assertSourceFiresThroughGate(label, angles, startTs) {
  console.log(`\n━━ ${label} ━━`);
  const frames = makeKneeAngleSeries(startTs, angles, 80);
  const gate = evaluateExerciseAutoProgress('squat', toLandmarks(frames), squatStats(frames));
  const cs = readCompletionState(gate);

  ok(
    `${label}: squatCompletionState present on gate`,
    cs != null,
    { hasCs: cs != null }
  );

  ok(
    `${label}: legitimateKinematicShallowDescentOnsetFrameIndex !== null through gate`,
    typeof cs?.legitimateKinematicShallowDescentOnsetFrameIndex === 'number',
    cs?.legitimateKinematicShallowDescentOnsetFrameIndex
  );

  ok(
    `${label}: baseline kneeAngleAvg seeded from true standing (>= 165°, <= 175°)`,
    typeof cs?.legitimateKinematicShallowDescentBaselineKneeAngleAvg === 'number' &&
      cs.legitimateKinematicShallowDescentBaselineKneeAngleAvg >= 165 &&
      cs.legitimateKinematicShallowDescentBaselineKneeAngleAvg <= 175,
    cs?.legitimateKinematicShallowDescentBaselineKneeAngleAvg
  );

  ok(
    `${label}: onset kneeAngleAvg at/below baseline − 5°`,
    typeof cs?.legitimateKinematicShallowDescentOnsetKneeAngleAvg === 'number' &&
      typeof cs?.legitimateKinematicShallowDescentBaselineKneeAngleAvg === 'number' &&
      cs.legitimateKinematicShallowDescentOnsetKneeAngleAvg <=
        cs.legitimateKinematicShallowDescentBaselineKneeAngleAvg - 5,
    {
      onset: cs?.legitimateKinematicShallowDescentOnsetKneeAngleAvg,
      baseline: cs?.legitimateKinematicShallowDescentBaselineKneeAngleAvg,
    }
  );

  ok(
    `${label}: descentAnchorCoherent === true (split-brain guard CL-1 unchanged)`,
    cs?.descentAnchorCoherent === true,
    cs?.descentAnchorCoherent
  );

  ok(
    `${label}: effectiveDescentStartFrameSource is a legal family label`,
    cs?.effectiveDescentStartFrameSource != null &&
      ['phase_hint_descent', 'trajectory_descent_start', 'shared_descent_epoch',
       'legitimate_kinematic_shallow_descent_onset',
       'pre_arming_kinematic_descent_epoch'].includes(cs.effectiveDescentStartFrameSource),
    cs?.effectiveDescentStartFrameSource
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Smoke #1 — source #4 fires through the full gate path on representative
//            shallow fixtures after the baseline-sourcing plumbing fix
// ═════════════════════════════════════════════════════════════════════════════
assertSourceFiresThroughGate('shallow_92deg',        SHALLOW_92DEG_ANGLES,        200);
assertSourceFiresThroughGate('ultra_low_rom_92deg',  ULTRA_LOW_ROM_92DEG_ANGLES,  300);

// ═════════════════════════════════════════════════════════════════════════════
// Smoke #2 — absurd-pass protection remains (the seed must NOT resurrect
//            source #4 on standing / spike / seated, and must NOT grant pass)
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n━━ Absurd-pass regression guard (gate path) ━━');
{
  const standing = [170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170];
  const g = evaluateExerciseAutoProgress(
    'squat', toLandmarks(makeKneeAngleSeries(200, standing, 80)), squatStats(standing)
  );
  const cs = readCompletionState(g);
  ok(
    'standing-still: source #4 still does NOT fire',
    cs == null || cs.legitimateKinematicShallowDescentOnsetFrameIndex == null,
    cs?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    'standing-still: finalPassEligible !== true',
    g.finalPassEligible !== true,
    { finalPassEligible: g.finalPassEligible }
  );
}
{
  const spike = [170, 170, 170, 170, 170, 170, 160, 170, 170, 170, 170, 170, 170, 170, 170];
  const g = evaluateExerciseAutoProgress(
    'squat', toLandmarks(makeKneeAngleSeries(200, spike, 80)), squatStats(spike)
  );
  const cs = readCompletionState(g);
  ok(
    'single-frame spike: source #4 still does NOT fire (sustain rejects)',
    cs == null || cs.legitimateKinematicShallowDescentOnsetFrameIndex == null,
    cs?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    'single-frame spike: finalPassEligible !== true',
    g.finalPassEligible !== true,
    { finalPassEligible: g.finalPassEligible }
  );
}
{
  const seated = [120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120];
  const g = evaluateExerciseAutoProgress(
    'squat', toLandmarks(makeKneeAngleSeries(200, seated, 80)), squatStats(seated)
  );
  const cs = readCompletionState(g);
  ok(
    'seated: source #4 still does NOT fire (no ≥5° further drop)',
    cs == null || cs.legitimateKinematicShallowDescentOnsetFrameIndex == null,
    cs?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    'seated: finalPassEligible !== true',
    g.finalPassEligible !== true,
    { finalPassEligible: g.finalPassEligible }
  );
}

console.log(`\n━━ RESULT: ${passed} passed, ${failed} failed ━━`);
if (failed > 0) process.exit(1);
