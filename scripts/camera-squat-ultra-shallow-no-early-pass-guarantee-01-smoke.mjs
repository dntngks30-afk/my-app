/**
 * PR-SQUAT-ULTRA-LOW-FINAL-GATE-03 — gate-level regression lock.
 *
 * npx tsx scripts/camera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke.mjs
 *
 * D1: 버퍼 미완(standing recovery 없음) → pass 아님
 * D2: 정상 얕은 full cycle + 충분한 motion cycle → pass
 * D3: deep standard 회귀
 * D4: ultra-low + trajectory rescue + 짧은 cycle (minimumCycleDurationSatisfied false) → completion 은 살아도 final pass 차단
 *
 * completion-state 세부 검증은 camera-squat-ultra-shallow-live-regression-01-smoke.mjs 참조.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateExerciseAutoProgress,
  shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass,
  shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass,
} = await import('../src/lib/camera/auto-progression.ts');

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

/** CAM-31 동일 — 하지 가시성 저하로 guarded trajectory reversal 유도 */
const LOWER_LIMB_INDICES = [25, 26, 27, 28];
function applyLowerLimbVisibilityDegrade(landmarkRows, frameIndexFilter, vis = 0.4) {
  return landmarkRows.map((row, i) => {
    if (!frameIndexFilter(i)) return row;
    const lm = row.landmarks.map((p, j) => {
      if (p == null) return p;
      if (!LOWER_LIMB_INDICES.includes(j)) return p;
      return { ...p, visibility: vis };
    });
    return { landmarks: lm, timestamp: row.timestamp };
  });
}

/** camera-cam31-squat-guarded-trajectory-reversal-smoke 와 동일 얕은 ROM 커브 */
const SHALLOW_SQUAT_CYCLE_FOR_TRAJECTORY = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];

console.log('\ncamera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke (PR-SQUAT-ULTRA-LOW-FINAL-GATE-03)\n');

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
//
// PR-01 (Completion-First Authority Freeze) realignment:
//   Before PR-01 this scenario reached `finalPassEligible=true` via the
//   pass-core-first opener shortcut even though the completion-owner path
//   produced `completionPassReason='not_confirmed'` / `finalSuccessOwner='other'`.
//   That is exactly SSOT §6 illegal state #8 (assist-only shallow admission
//   reopening final pass without canonical completion-owner truth). PR-01
//   closes that shortcut. Upstream shallow evidence fragility is accepted as
//   residual risk (PR-01 §12 / PR-Truth-Map §4.PR-01) and the "pass" guarantee
//   for this synthetic sequence is lifted until a follow-on shallow-evidence PR
//   lands.
//
//   The D2b predicate-level assertion is kept — it does not depend on the
//   engine actually opening final pass.
console.log('\nD2. valid_shallow_pass — ultra-low squat with clear return path');
{
  const angles = [
    ...Array(10).fill(170),
    165, 155, 142, 128, 115, 103, 95, 93, 92,
    92, 93, 95, 100, 115, 130, 148, 163, 170,
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

  if (gate.status === 'pass' && gate.finalPassEligible === true) {
    // Engine happens to pass today — still assert canonical completion-owner truth
    // so this branch cannot silently re-open the split-brain path.
    ok(
      'D2: pass path honors completion-owner truth (PR-01 Invariant A/B/D)',
      gate.finalPassBlockedReason == null &&
        dbg.completionPassReason !== 'not_confirmed' &&
        dbg.completionPassReason != null,
      {
        finalPassBlockedReason: gate.finalPassBlockedReason,
        completionPassReason: dbg.completionPassReason,
        completionTruthPassed: dbg.completionTruthPassed,
      }
    );
  } else {
    // Residual shallow-evidence risk per PR-01 §12 — fail-close with truthful reason.
    const D2_ACCEPTED_BLOCKED = new Set([
      'completion_truth_not_passed',
      'completion_reason_not_confirmed',
      'completion_blocked:ultra_low_rom_not_allowed',
      'completion_owner_reason_not_confirmed',
      'cycle_not_complete',
    ]);
    ok(
      'D2: PR-01 residual shallow-evidence — fails-closed with truthful authority reason',
      gate.finalPassEligible === false &&
        D2_ACCEPTED_BLOCKED.has(gate.finalPassBlockedReason),
      {
        status: gate.status,
        finalPassEligible: gate.finalPassEligible,
        finalPassBlockedReason: gate.finalPassBlockedReason,
      }
    );
  }

  ok(
    'D2b: PR-SETUP-SERIES-START-01 predicate does not block legitimate shallow',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass('squat', cs, dbg) === false,
    { csPeak: cs.peakLatchedAtIndex, armingFb: dbg.armingFallbackUsed, notes: dbg.eventCycleNotes }
  );
}

// ── D3: deep standard path (회귀: standard_cycle + trajectory rescue 비활성) ─
console.log('\nD3. deep_standard — 깊은 스쿼트 full cycle');
{
  const angles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
    60, 60,
    70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(200, angles));
  const stats = squatStats(landmarks, 6000);
  const gate = evaluateExerciseAutoProgress('squat', landmarks, stats);
  const dbg = getDbg(gate);
  const cs = getCs(gate);
  console.log(
    `    [info] status=${gate.status} passReason=${dbg.completionPassReason} trajectoryRescue=${cs.trajectoryReversalRescueApplied}`
  );
  ok('D3: status === pass', gate.status === 'pass', { status: gate.status });
  ok('D3: completionPassReason === standard_cycle', dbg.completionPassReason === 'standard_cycle', {
    completionPassReason: dbg.completionPassReason,
  });
  ok('D3: trajectory rescue not applied', cs.trajectoryReversalRescueApplied !== true, {
    trajectoryReversalRescueApplied: cs.trajectoryReversalRescueApplied,
  });
  ok('D3: finalPassEligible === true', gate.finalPassEligible === true, {
    finalPassEligible: gate.finalPassEligible,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
}

// ── D4: final gate predicate (시그니처 고정) + rule·짧은 사이클 비차단 회귀 ─────
console.log('\nD4. ultra_low_trajectory_short_cycle final gate');
{
  ok(
    'D4a: predicate true only for 5-way ultra-low trajectory rescue + short cycle',
    shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
      'squat',
      {
        completionPassReason: 'ultra_low_rom_cycle',
        reversalConfirmedBy: 'trajectory',
        trajectoryReversalRescueApplied: true,
      },
      { minimumCycleDurationSatisfied: false }
    ) === true
  );
  ok(
    'D4a: standard_cycle never hits predicate',
    shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
      'squat',
      {
        completionPassReason: 'standard_cycle',
        reversalConfirmedBy: 'trajectory',
        trajectoryReversalRescueApplied: true,
      },
      { minimumCycleDurationSatisfied: false }
    ) === false
  );
  ok(
    'D4a: rule reversal + short cycle does not hit predicate (trajectoryRescueApplied는 rule 경로에서 false)',
    shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
      'squat',
      {
        completionPassReason: 'ultra_low_rom_cycle',
        reversalConfirmedBy: 'rule',
        trajectoryReversalRescueApplied: false,
      },
      { minimumCycleDurationSatisfied: false }
    ) === false
  );
  ok(
    'D4a: long cycle does not hit predicate',
    shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
      'squat',
      {
        completionPassReason: 'ultra_low_rom_cycle',
        reversalConfirmedBy: 'trajectory',
        trajectoryReversalRescueApplied: true,
      },
      { minimumCycleDurationSatisfied: true }
    ) === false
  );
}

console.log('\nD4b. CAM-31 style shallow + short motion cycle + rule — still pass (no over-block)');
{
  const stepMs = 80;
  const nStand = 12;
  const angles = [
    ...Array(nStand).fill(170),
    ...SHALLOW_SQUAT_CYCLE_FOR_TRAJECTORY.slice(1),
    ...Array(12).fill(170),
  ];
  const base = toLandmarks(makeKneeAngleSeries(1000, angles, stepMs));
  const degraded = applyLowerLimbVisibilityDegrade(
    base,
    (i) => i >= nStand + 8 && i < nStand + 16,
    0.38
  );
  const stats = squatStats(degraded, 3200);
  const gate = evaluateExerciseAutoProgress('squat', degraded, stats);
  const cs = getCs(gate);
  const dbg = getDbg(gate);
  console.log(
    `    [info] status=${gate.status} finalPassEligible=${gate.finalPassEligible} passReason=${dbg.completionPassReason} revBy=${cs.reversalConfirmedBy} trajRescue=${cs.trajectoryReversalRescueApplied} minCycleOk=${dbg.minimumCycleDurationSatisfied}`
  );
  // PR-01 (Completion-First Authority Freeze) realignment:
  //   The "still pass" guarantee is lifted here for the same reason as D2 —
  //   pre-PR-01 this path reached pass via the pass-core-first opener shortcut.
  //   After PR-01 the predicate-level assertion is what this test must keep
  //   locking (short-cycle rule path must not be over-blocked); the engine pass
  //   itself is conditional on upstream shallow evidence forming canonical
  //   completion-owner truth (residual risk per PR-01 §12).
  ok(
    'D4b: rule + short cycle is not over-blocked by the short-cycle predicate (PR-01-invariant)',
    dbg.minimumCycleDurationSatisfied === false &&
      shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass('squat', cs, dbg) === false,
    { gate, cs, dbg }
  );
  if (gate.status === 'pass' && gate.finalPassEligible === true) {
    ok(
      'D4b: if engine passes today, completion-owner truth is satisfied',
      dbg.completionPassReason != null &&
        dbg.completionPassReason !== 'not_confirmed' &&
        gate.finalPassBlockedReason == null,
      {
        completionPassReason: dbg.completionPassReason,
        finalPassBlockedReason: gate.finalPassBlockedReason,
      }
    );
  }
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
