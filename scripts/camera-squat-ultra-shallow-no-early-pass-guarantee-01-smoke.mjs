/**
 * PR-TRAJECTORY-RESCUE-INTEGRITY-01 — gate-level regression lock.
 * trajectory rescue alone이 shallow return proof 없이 ultra-low pass를 열면 안 된다.
 *
 * npx tsx scripts/camera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke.mjs
 *
 * D1 (early_rescue_false_positive): ultra-low 대역 + zig-zag at bottom (post-peak return proof 없음)
 *   → status !== pass, finalPassEligible !== true
 *
 * D2 (valid_shallow_pass): ultra-low 대역 + 명확한 full return cycle
 *   → status === pass, finalPassEligible === true, finalSuccessOwner !== completion_truth_standard
 *
 * completion-state 레벨 메커니즘 검증은 camera-squat-ultra-shallow-live-regression-01-smoke.mjs D1/D2 참조.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
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
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}

function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
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

function getCs(gate) {
  return gate?.evaluatorResult?.debug?.squatCompletionState ?? {};
}
function getDbg(gate) {
  return gate?.squatCycleDebug ?? {};
}

console.log('\ncamera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke (PR-TRAJECTORY-RESCUE-INTEGRITY-01)\n');

// ── D1: early rescue false positive (zig-zag at bottom, no return path) ──────
console.log('D1. early_rescue_false_positive — zig-zag at bottom without post-peak return');
{
  /**
   * Standing → ultra-low squat (angles ~92°) → zig-zag at bottom (no depth decrease after peak)
   * → buffer ends without standing recovery.
   *
   * This mirrors the symptom: descent reached but no post-peak drop proof,
   * so shallowClosureProofBundleFromStream / officialShallowPrimaryDropClosureFallback /
   * officialShallowStreamBridgeApplied remain false.
   * Post-fix: trajectory rescue alone cannot open the pass.
   */
  const angles = [
    ...Array(12).fill(170),
    // descent to ultra-shallow bottom
    165, 155, 140, 125, 110, 98, 93, 92,
    // zig-zag at bottom — no real depth return (stays at ~92°)
    93, 92, 93, 92, 93, 92, 93, 92, 93, 92, 93, 92,
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, angles));
  const stats = squatStats(landmarks, 3200);
  const gate = evaluateExerciseAutoProgress('squat', landmarks, stats);
  const cs = getCs(gate);
  const dbg = getDbg(gate);
  console.log(
    `    [info] status=${gate.status} finalPassEligible=${gate.finalPassEligible} blocked=${cs.completionBlockedReason} reversalBy=${cs.reversalConfirmedBy} trajectoryRescue=${cs.trajectoryReversalRescueApplied}`
  );

  ok('D1: status !== pass', gate.status !== 'pass', { status: gate.status });
  ok('D1: finalPassEligible !== true', gate.finalPassEligible !== true, { finalPassEligible: gate.finalPassEligible });
}

// ── D2: valid shallow pass (full return cycle with clear post-peak return) ────
console.log('\nD2. valid_shallow_pass — ultra-low squat with clear return path');
{
  /**
   * Standing → ultra-low squat (angles ~92°) → full return to standing.
   * post-peak return is sustained: shallowClosureProofBundleFromStream fires.
   * Post-fix: shallowReturnProofSatisfied = true → pass still opens.
   */
  const angles = [
    ...Array(10).fill(170),
    // descent to ultra-shallow bottom
    165, 155, 142, 128, 115, 103, 95, 93, 92,
    // clear return (angles increasing = depth decreasing = post-peak drop)
    92, 93, 95, 100, 115, 130, 148, 163, 170,
    // standing tail
    ...Array(10).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(100, angles));
  const stats = squatStats(landmarks, 3200);
  const gate = evaluateExerciseAutoProgress('squat', landmarks, stats);
  const cs = getCs(gate);
  const dbg = getDbg(gate);
  console.log(
    `    [info] status=${gate.status} finalPassEligible=${gate.finalPassEligible} passReason=${dbg.completionPassReason} owner=${dbg.finalSuccessOwner}`
  );

  ok('D2: status === pass', gate.status === 'pass', { status: gate.status });
  ok('D2: finalPassEligible === true', gate.finalPassEligible === true, { finalPassEligible: gate.finalPassEligible });
  ok('D2: finalPassBlockedReason == null', gate.finalPassBlockedReason == null, { finalPassBlockedReason: gate.finalPassBlockedReason });
  ok(
    'D2: finalSuccessOwner !== completion_truth_standard',
    dbg.finalSuccessOwner !== 'completion_truth_standard',
    { finalSuccessOwner: dbg.finalSuccessOwner }
  );
  ok(
    'D2: completionPassReason shallow cycle (ultra or low)',
    dbg.completionPassReason === 'ultra_low_rom_cycle' || dbg.completionPassReason === 'low_rom_cycle',
    { completionPassReason: dbg.completionPassReason }
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
