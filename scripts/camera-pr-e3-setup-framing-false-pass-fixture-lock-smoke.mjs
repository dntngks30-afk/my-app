/**
 * PR-E3 — Setup / Framing False-Pass Fixture Lock
 *
 * Scope: close the blind spot where four high-risk framing-instability families had no
 *        dedicated fixture contract asserting that canonical success cannot open without
 *        a genuine squat rep.
 *
 * Four fixture families (each independently owned):
 *   Family A — setup step-back
 *   Family B — frame jump (timestamp discontinuity)
 *   Family C — unstable bbox / landmark framing jitter
 *   Family D — camera tilt / framing drift
 *
 * What this script does:
 *   - Calls the real `evaluateExerciseAutoProgress('squat', ...)` with deterministic
 *     synthetic landmark sequences that express each instability family.
 *   - Calls `isFinalPassLatched('squat', gate)` to assert final-latch state.
 *   - Asserts per §7 priority order: no-success-opening first, then status≠pass,
 *     then finalPassEligible=false, then latch=false.
 *   - Does NOT modify engine logic, thresholds, or evaluator behavior.
 *
 * What this script must NOT do:
 *   - Change pass policy, thresholds, or evaluator semantics.
 *   - Mix E1 (shallow promotion) or E2 (storage harness) logic.
 *   - Use random/non-deterministic sequences.
 *   - Collapse four families into one generic block.
 *
 * Run:
 *   npx tsx scripts/camera-pr-e3-setup-framing-false-pass-fixture-lock-smoke.mjs
 *
 * SSOT reference: docs/pr/PR-E3-setup-framing-false-pass-fixture-lock.md
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// ── Production imports (read-only) ───────────────────────────────────────────
const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);

// ── Harness helpers (same style as PR-D) ────────────────────────────────────
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

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Synthetic squat pose from knee angle — same approach as PR-D / PR-CAM-26.
 * Larger knee angle = more standing (170° = upright, 60° = deep squat).
 */
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

/**
 * Build frame series: each entry is { landmarks, timestamp }.
 */
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function toLandmarks(sequence) {
  return sequence.map((frame) => ({ landmarks: frame.landmarks, timestamp: frame.timestamp }));
}

function squatStats(landmarks, captureDurationMs) {
  const dur = captureDurationMs ?? landmarks.length * 80;
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs: dur,
    timestampDiscontinuityCount: 0,
  };
}

/**
 * §7 priority assertion group for a gate result that must NOT open success.
 * Priority 1: no canonical success opening (finalPassEligible=false, latch=false).
 * Priority 2: status !== 'pass'.
 * Blocked reason is intentionally NOT checked as the primary assertion.
 */
function assertNoSuccessOpening(gate, label) {
  // Priority 1 — canonical no-success opening (most important)
  ok(
    `${label}: finalPassEligible === false`,
    gate.finalPassEligible === false,
    { finalPassEligible: gate.finalPassEligible, finalPassBlockedReason: gate.finalPassBlockedReason }
  );
  ok(
    `${label}: isFinalPassLatched === false`,
    isFinalPassLatched('squat', gate) === false,
    isFinalPassLatched('squat', gate)
  );
  ok(
    `${label}: squatFinalPassTruth.finalPassGranted !== true`,
    gate.squatCycleDebug?.squatFinalPassTruth?.finalPassGranted !== true,
    gate.squatCycleDebug?.squatFinalPassTruth?.finalPassGranted
  );
  // Priority 2 — status non-pass
  ok(
    `${label}: status !== 'pass'`,
    gate.status !== 'pass',
    { status: gate.status, completionSatisfied: gate.completionSatisfied }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix A — Family A: setup step-back
//
// Risk: subject steps back / changes distance during setup or very early
//       movement before any genuine descend→reversal→recovery cycle.
//
// Fixture design:
//   The subject starts upright (170°), then body shifts further upright or
//   drifts slightly (simulating stepping back and re-framing), then returns.
//   No real descend event occurs. Knee angle stays near 170° throughout.
//   Hip Y position shifts abruptly (encoded via the shift in the global landmark
//   baseline from frame 8 onward — simulated by an abrupt angle step from 170
//   to 162 and back without completing a squat cycle).
//
// Why this is not a real rep:
//   Peak knee flexion never reaches a squat bottom depth. There is no reversal
//   confirmation cycle. The engine should never grant finalPassEligible=true.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix A — Family A: setup step-back ━━');

{
  // Standing upright, a brief small dip that looks like position adjustment,
  // then return to standing. No genuine squat depth.
  const stepBackAngles = [
    ...Array(8).fill(170),      // initial standing setup
    167, 164, 162, 163,         // slight forward tilt (subject steps back / re-frames)
    164, 167, 170,              // return to standing — never a real descent
    ...Array(8).fill(170),      // stable standing
  ];
  const stepBackFrames = makeKneeAngleSeries(1000, stepBackAngles, 80);
  const stepBackLandmarks = toLandmarks(stepBackFrames);
  const gateStepBack = evaluateExerciseAutoProgress(
    'squat',
    stepBackLandmarks,
    squatStats(stepBackLandmarks)
  );

  assertNoSuccessOpening(gateStepBack, 'FamilyA step-back');
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix B — Family B: frame jump (timestamp discontinuity)
//
// Risk: body position or timestamps shift abruptly, creating the appearance
//       of motion without a genuine descend→reversal→recovery cycle.
//
// Fixture design:
//   Two frames at very different timestamps but adjacent indices.
//   Frame 0: standing (170°), timestamp=0
//   Frame 1: appears to be "deep" (60°), timestamp=5000ms later (big gap)
//   Frame 2: standing again (170°), timestamp=5080ms
//   This mimics a frame jump that could look like a squat rep to a naive detector.
//
// Why this is not a real rep:
//   There is no continuous descend path. The engine requires a validated cycle
//   (descent confirmation + reversal + recovery). A single jump frame cannot
//   satisfy the squat completion state machine.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix B — Family B: frame jump (timestamp discontinuity) ━━');

{
  // Large timestamp gap between frames 4 and 5 simulates a frame jump.
  // squatStats reports timestampDiscontinuityCount > 0.
  const jumpFrames = [
    squatPoseLandmarksFromKneeAngle(2000, 170),
    squatPoseLandmarksFromKneeAngle(2080, 170),
    squatPoseLandmarksFromKneeAngle(2160, 170),
    squatPoseLandmarksFromKneeAngle(2240, 170),
    // big jump: timestamp leaps 4 seconds, angle jumps to squat depth
    squatPoseLandmarksFromKneeAngle(6400, 60),
    squatPoseLandmarksFromKneeAngle(6480, 60),
    // immediately returns to standing
    squatPoseLandmarksFromKneeAngle(6560, 170),
    squatPoseLandmarksFromKneeAngle(6640, 170),
    squatPoseLandmarksFromKneeAngle(6720, 170),
  ];
  const jumpLandmarks = toLandmarks(jumpFrames);

  // Report the discontinuity so the engine can use it as a quality signal.
  const jumpStats = {
    sampledFrameCount: jumpLandmarks.length,
    droppedFrameCount: 0,
    captureDurationMs: 4720,
    timestampDiscontinuityCount: 1,  // flag the jump explicitly
  };

  const gateJump = evaluateExerciseAutoProgress('squat', jumpLandmarks, jumpStats);

  assertNoSuccessOpening(gateJump, 'FamilyB frame-jump');
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix C — Family C: unstable bbox / landmark framing jitter
//
// Risk: tracking instability creates apparent oscillating depth cues that
//       could mimic a squat rep but have no genuine movement.
//
// Fixture design:
//   The subject stands still (170°) but landmark positions oscillate ±8°
//   noise throughout the sequence. No actual descend pattern exists — just
//   high-frequency noise around the standing position.
//
// Why this is not a real rep:
//   The noise pattern does not produce a confirmed descent phase.
//   Peak noise excursion (170-8=162°) is far above real squat depth.
//   The engine's descend-confirmation logic requires sustained motion below
//   threshold. Short oscillating noise should not trigger it.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix C — Family C: unstable bbox / landmark jitter ━━');

{
  // Deterministic oscillating noise: ±8° around standing position.
  // Pattern repeats every 4 frames so it is fully reproducible.
  const noisePattern = [0, -4, -8, -4];
  const jitterAngles = Array(32)
    .fill(0)
    .map((_, i) => 170 + noisePattern[i % noisePattern.length]);

  const jitterFrames = makeKneeAngleSeries(3000, jitterAngles, 50);
  const jitterLandmarks = toLandmarks(jitterFrames);
  const gateJitter = evaluateExerciseAutoProgress(
    'squat',
    jitterLandmarks,
    squatStats(jitterLandmarks, 1600)
  );

  assertNoSuccessOpening(gateJitter, 'FamilyC landmark-jitter');
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix D — Family D: camera tilt / framing drift
//
// Risk: camera view angle shifts systematically, changing the body's apparent
//       projected depth without any real squat motion.
//
// Fixture design:
//   Simulate a camera tilt by progressively shifting ALL landmark Y positions
//   downward by a ramp offset (as if the camera tilts toward the floor), then
//   back up. This creates a monotonic apparent "descent" in Y coordinates
//   across all body landmarks — but no actual knee-angle squat cycle occurs.
//
//   We achieve this by wrapping squatPoseLandmarksFromKneeAngle with an
//   additional Y offset applied to all landmarks, simulating viewpoint shift.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix D — Family D: camera tilt / framing drift ━━');

{
  /**
   * Build a frame where all landmarks are uniformly shifted by yOffset.
   * This simulates camera tilt: the body appears to move down/up due to
   * viewpoint change, not actual motion.
   * Knee angle stays at 170° (standing) throughout.
   */
  function squatPoseWithTiltOffset(timestamp, kneeAngleDeg, yOffset) {
    const base = squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg);
    const shiftedLandmarks = base.landmarks.map((lm) =>
      lm ? mockLandmark(lm.x, clamp(lm.y + yOffset), lm.visibility) : lm
    );
    return { landmarks: shiftedLandmarks, timestamp };
  }

  // Camera tilts down gradually (yOffset 0 → +0.15), then tilts back.
  // Appears as if body is descending (Y increases) but knee angle never changes.
  const tiltFrames = [];
  const totalFrames = 30;
  for (let i = 0; i < totalFrames; i++) {
    const ts = 4000 + i * 80;
    let yOffset;
    if (i < 15) {
      // Tilt down: Y offset increases from 0 to 0.15
      yOffset = (i / 14) * 0.15;
    } else {
      // Tilt back: Y offset decreases from 0.15 to 0
      yOffset = ((totalFrames - 1 - i) / 14) * 0.15;
    }
    tiltFrames.push(squatPoseWithTiltOffset(ts, 170, yOffset));
  }

  const tiltLandmarks = toLandmarks(tiltFrames);
  const gateTilt = evaluateExerciseAutoProgress(
    'squat',
    tiltLandmarks,
    squatStats(tiltLandmarks, 2400)
  );

  assertNoSuccessOpening(gateTilt, 'FamilyD camera-tilt');
}

// ═══════════════════════════════════════════════════════════════════════════
// Scope discipline confirmation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Scope discipline ━━');
console.log('  INFO: E1 (shallow promotion state) — not implemented in this script');
console.log('  INFO: E2 (localStorage/snapshot storage) — not implemented in this script');
console.log('  INFO: No production files modified');
console.log('  INFO: evaluateExerciseAutoProgress and isFinalPassLatched used read-only');

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n━━━ PR-E3 setup/framing false-pass fixture lock: ${passed} passed, ${failed} failed ━━━`
);
process.exit(failed > 0 ? 1 : 0);
