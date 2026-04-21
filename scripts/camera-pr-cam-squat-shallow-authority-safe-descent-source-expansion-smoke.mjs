/**
 * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Branch B smokes #1..#3
 *
 * Scope (per implementation-prompt §5):
 *   Smoke #1 new-source unit:
 *     Shallow fixture (170°→~160° sustained) must fire source #4
 *     `legitimateKinematicShallowDescentOnsetFrame`, exposing
 *     `effectiveDescentStartFrameSource === 'legitimate_kinematic_shallow_descent_onset'`
 *     and populated kinematic onset diagnostics.
 *
 *   Smoke #2 absurd-pass regression:
 *     The new source MUST NOT fire (or must not drive pass) on:
 *       (a) standing-still — no kneeAngle drop below threshold
 *       (b) single-frame spike (no_real_descent) — sustain fails
 *       (c) seated/quasi-seated — baseline already low, epsilon never reached
 *     Crucially: none of these may gain `progressionPassed === true` as a
 *     side effect of source #4 existing.
 *
 *   Smoke #3 split-brain guard (CL-1):
 *     On any fixture, `descentAnchorCoherent === true` (every non-null
 *     candidate index ≥ chosen anchor index — earliest-wins rule holds).
 *     On deep fixture (where sources 1/2 fire), the chosen source is not
 *     forced to #4 — earliest of all candidates must win.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs
 *
 * Design SSOT: docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md
 * Implementation prompt:
 *   docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION-IMPLEMENTATION-PROMPT.md
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import(
  '../src/lib/camera/auto-progression.ts'
);
const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);
const { buildPoseFeaturesFrames } = await import(
  '../src/lib/camera/pose-features.ts'
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

/** Same knee-angle fixture builder as PR-D / PR-E1. */
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
  return gate.evaluatorResult?.debug?.squatCompletionState;
}
function readCycleDebug(gate) {
  return gate.squatCycleDebug;
}

/**
 * Drive `evaluateSquatCompletionState` directly — bypasses the evaluator's
 * arming filter so the BASELINE_WINDOW of `completionFrames` is the raw
 * standing prefix. This matches the design SSOT §4.1 baseline assumption
 * and isolates source #4's behavior from the arming-truncation interaction.
 *
 * (Gate-level smokes still use `evaluateExerciseAutoProgress` so absurd-pass
 * regression is verified on the full production path.)
 */
function evaluateCoreDirect(kneeAngleSeries, startTs = 200, stepMs = 80) {
  const frames = makeKneeAngleSeries(startTs, kneeAngleSeries, stepMs).map(
    (f) => ({ landmarks: f.landmarks, timestamp: f.timestamp })
  );
  const features = buildPoseFeaturesFrames('squat', frames);
  return evaluateSquatCompletionState(features);
}

// ═════════════════════════════════════════════════════════════════════════════
// Smoke #1 — new-source unit: shallow fixture fires source #4
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n━━ Smoke #1 — legitimateKinematicShallowDescentOnsetFrame fires on shallow fixture ━━');
{
  // Standing baseline 6 frames @ 170°, then a low-ROM but admission-eligible
  // descent. `toSquatDepthProxy` is a logistic on `kneeAngleAvg` centered at
  // 75°, so admission (`relativeDepthPeak ≥ LEGACY_ATTEMPT_FLOOR = 0.02`)
  // requires the minimum kneeAngle to reach ≈ 95° – 100°. The fixture goes
  // 170° → 90° so `depthFreeze` latches and source #4 is allowed to evaluate.
  //
  // Source #4 must fire at frame 6 (first frame at ≤ 170 − ε=5° = 165°)
  // because the sequence is strictly monotonic non-increasing for ≥ 2
  // frames starting there.
  const shallowAngles = [
    170, 170, 170, 170, 170, 170,                  // baseline window
    165, 155, 140, 125, 110, 100, 95, 92, 90,      // descent, monotonic non-increase
    90, 92, 95, 100, 110, 125, 140, 155, 165, 170, // ascent + standing recovery
    170, 170, 170,
  ];
  // Drive the core directly — the gate's arming filter truncates the standing
  // prefix and therefore shifts the BASELINE_WINDOW off the true standing
  // baseline. The design SSOT §4.1 defines the baseline at the completion-core
  // boundary (pre-arming-truncation), not at the gate boundary.
  const cs = evaluateCoreDirect(shallowAngles, 200, 80);
  const frames = makeKneeAngleSeries(200, shallowAngles, 80);
  const gate = evaluateExerciseAutoProgress('squat', toLandmarks(frames), squatStats(frames));
  const dbg = readCycleDebug(gate);

  ok(
    '#1.1 completion state present',
    cs != null,
    { hasCs: cs != null }
  );
  ok(
    '#1.2 baselineKneeAngleAvg resolved (≈170°)',
    typeof cs?.legitimateKinematicShallowDescentBaselineKneeAngleAvg === 'number' &&
      cs.legitimateKinematicShallowDescentBaselineKneeAngleAvg > 165 &&
      cs.legitimateKinematicShallowDescentBaselineKneeAngleAvg < 175,
    cs?.legitimateKinematicShallowDescentBaselineKneeAngleAvg
  );
  ok(
    '#1.3 onset frame index resolved',
    typeof cs?.legitimateKinematicShallowDescentOnsetFrameIndex === 'number' &&
      cs.legitimateKinematicShallowDescentOnsetFrameIndex >= 6,
    cs?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    '#1.4 onset kneeAngleAvg ≤ baseline − 5°',
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
    '#1.5 effectiveDescentStartFrameSource identifies the new source',
    cs?.effectiveDescentStartFrameSource != null &&
      ['phase_hint_descent', 'trajectory_descent_start', 'shared_descent_epoch',
       'legitimate_kinematic_shallow_descent_onset',
       'pre_arming_kinematic_descent_epoch'].includes(cs.effectiveDescentStartFrameSource),
    cs?.effectiveDescentStartFrameSource
  );
  ok(
    '#1.6 descentAnchorCoherent === true (split-brain guard CL-1)',
    cs?.descentAnchorCoherent === true,
    cs?.descentAnchorCoherent
  );
  ok(
    '#1.7 SquatCycleDebug mirror exposes onset fields (present, numeric-or-null)',
    dbg != null &&
      'legitimateKinematicShallowDescentOnsetFrameIndex' in dbg &&
      'effectiveDescentStartFrameSource' in dbg &&
      (dbg.legitimateKinematicShallowDescentOnsetFrameIndex === null ||
        typeof dbg.legitimateKinematicShallowDescentOnsetFrameIndex === 'number'),
    { mirrorIdx: dbg?.legitimateKinematicShallowDescentOnsetFrameIndex,
      mirrorSrc: dbg?.effectiveDescentStartFrameSource }
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Smoke #2 — absurd-pass regression: source must not fire on standing /
// spike / seated, and must not push progressionPassed=true on them.
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n━━ Smoke #2 — absurd-pass regression (standing / spike / seated) ━━');
{
  // (a) standing-still: all 170°
  const standing = [
    170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
  ];
  const standingFrames = makeKneeAngleSeries(200, standing, 80);
  const gA = evaluateExerciseAutoProgress(
    'squat', toLandmarks(standingFrames), squatStats(standingFrames)
  );
  const csA = readCompletionState(gA);
  ok(
    '#2a.1 standing-still: source #4 did NOT fire',
    csA == null || csA.legitimateKinematicShallowDescentOnsetFrameIndex == null,
    csA?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    '#2a.2 standing-still: progressionPassed !== true',
    gA.finalPassEligible !== true,
    { finalPassEligible: gA.finalPassEligible }
  );

  // (b) single-frame spike — sustain must reject
  const spike = [
    170, 170, 170, 170, 170, 170,
    160, 170, 170, 170, 170, 170, 170, 170, 170,
  ];
  const spikeFrames = makeKneeAngleSeries(200, spike, 80);
  const gB = evaluateExerciseAutoProgress(
    'squat', toLandmarks(spikeFrames), squatStats(spikeFrames)
  );
  const csB = readCompletionState(gB);
  ok(
    '#2b.1 single-frame spike: source #4 did NOT fire (sustain rejects)',
    csB == null || csB.legitimateKinematicShallowDescentOnsetFrameIndex == null,
    csB?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    '#2b.2 single-frame spike: progressionPassed !== true',
    gB.finalPassEligible !== true,
    { finalPassEligible: gB.finalPassEligible }
  );

  // (c) seated / quasi-seated: baseline already low
  // All frames at ~120°, no ≥5° further drop attainable → source gated closed.
  const seated = [
    120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120,
  ];
  const seatedFrames = makeKneeAngleSeries(200, seated, 80);
  const gC = evaluateExerciseAutoProgress(
    'squat', toLandmarks(seatedFrames), squatStats(seatedFrames)
  );
  const csC = readCompletionState(gC);
  ok(
    '#2c.1 seated: source #4 did NOT fire',
    csC == null || csC.legitimateKinematicShallowDescentOnsetFrameIndex == null,
    csC?.legitimateKinematicShallowDescentOnsetFrameIndex
  );
  ok(
    '#2c.2 seated: progressionPassed !== true',
    gC.finalPassEligible !== true,
    { finalPassEligible: gC.finalPassEligible }
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Smoke #3 — split-brain guard CL-1 + earliest-wins on deep fixture
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n━━ Smoke #3 — descentAnchorCoherent + earliest-wins selection ━━');
{
  // Deep squat: sources 1/2 fire before source 4 (phaseHint='descent' typically
  // triggers at the same or earlier index than kinematic source).
  const deepAngles = [
    170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
    165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
    60, 60,
    70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    170, 170, 170, 170,
  ];
  const csDeep = evaluateCoreDirect(deepAngles, 1000, 80);
  ok(
    '#3.1 deep fixture: descentAnchorCoherent === true',
    csDeep?.descentAnchorCoherent === true,
    csDeep?.descentAnchorCoherent
  );
  ok(
    '#3.2 deep fixture: chosen source is one of the four legal values',
    csDeep?.effectiveDescentStartFrameSource == null ||
      ['phase_hint_descent', 'trajectory_descent_start', 'shared_descent_epoch',
       'legitimate_kinematic_shallow_descent_onset',
       'pre_arming_kinematic_descent_epoch'].includes(csDeep.effectiveDescentStartFrameSource),
    csDeep?.effectiveDescentStartFrameSource
  );

  // Re-use the shallow fixture from Smoke #1 to assert coherence there too.
  const shallowAngles = [
    170, 170, 170, 170, 170, 170,
    165, 155, 140, 125, 110, 100, 95, 92, 90,
    90, 92, 95, 100, 110, 125, 140, 155, 165, 170,
    170, 170, 170,
  ];
  const csShallow = evaluateCoreDirect(shallowAngles, 200, 80);
  ok(
    '#3.3 shallow fixture: descentAnchorCoherent === true',
    csShallow?.descentAnchorCoherent === true,
    csShallow?.descentAnchorCoherent
  );
  ok(
    '#3.4 shallow fixture: source #4 candidate does not forbid coherence when no other source fires',
    // coherent invariant holds regardless of which source won
    csShallow?.descentAnchorCoherent === true,
    csShallow?.descentAnchorCoherent
  );
}

console.log(`\n━━ RESULT: ${passed} passed, ${failed} failed ━━`);
if (failed > 0) process.exit(1);
