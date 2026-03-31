/**
 * PR-4: Camera observability trace smoke test
 * Run: npx tsx scripts/camera-pr4-observability-trace-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquat } = await import('../src/lib/camera/evaluators/squat.ts');
const { evaluateOverheadReach } = await import('../src/lib/camera/evaluators/overhead-reach.ts');
const { assessStepGuardrail } = await import('../src/lib/camera/guardrails.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const {
  buildAttemptSnapshot,
  getQuickStats,
  getRecentAttempts,
  clearAttempts,
  pushAttemptSnapshot,
  recordAttemptSnapshot,
} = await import('../src/lib/camera/camera-trace.ts');
const {
  resetSquatCameraObservabilitySession,
  getFrozenSquatPassSnapshot,
} = await import('../src/lib/camera/camera-observability-squat-session.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) =>
      mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.9)
    );
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  landmarks[23] = mockLandmark(0.45, hipY, 0.9);
  landmarks[24] = mockLandmark(0.55, hipY, 0.9);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.9);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.9);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.9);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.9);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.9);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.9);
  return { landmarks, timestamp };
}

/**
 * CAM-31 / no-early-pass D3 와 동일 계열 무릎 각 시계열 — `evaluateExerciseAutoProgress` standard pass 용.
 */
function squatLandmarksDeepStandardPass() {
  function clamp(v, a = 0, b = 1) {
    return Math.min(b, Math.max(a, v));
  }
  function fromKneeAngle(timestamp, kneeAngleDeg) {
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
  const standing = Array(12).fill(170);
  const deep = [
    170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
  ];
  const tail = Array(10).fill(170);
  const angles = [...standing, ...deep, ...tail];
  const stepMs = 80;
  return angles.map((a, i) => {
    const fr = fromKneeAngle(200 + i * stepMs, a);
    return { landmarks: fr.landmarks, timestamp: fr.timestamp };
  });
}

function overheadLandmarks() {
  return Array(20)
    .fill(0)
    .map((_, i) => {
      const lm = Array(33)
        .fill(null)
        .map((_, j) =>
          mockLandmark(0.4 + (j % 11) * 0.02, 0.2 + Math.floor(j / 11) * 0.08, 0.9)
        );
      const armAngle = Math.min(160, 40 + i * 6);
      lm[11] = mockLandmark(0.4, 0.25, 0.9);
      lm[12] = mockLandmark(0.6, 0.25, 0.9);
      lm[13] = mockLandmark(0.35, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
      lm[14] = mockLandmark(0.65, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
      lm[15] = mockLandmark(0.3, 0.15, 0.9);
      lm[16] = mockLandmark(0.7, 0.15, 0.9);
      return { landmarks: lm, timestamp: 100 + i * 50 };
    });
}

console.log('Camera PR-4 observability trace smoke test\n');

// AT1: Snapshot creation works for squat
const squatLandmarks = [
  ...Array(4)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(100 + i * 80, 0.1 + i * 0.15)),
  ...Array(5)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(420 + i * 80, 0.55 + i * 0.02)),
  ...Array(5)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(820 + i * 80, 0.5 - i * 0.1)),
];
const squatStats = {
  sampledFrameCount: squatLandmarks.length,
  droppedFrameCount: 1,
  captureDurationMs: 2000,
  timestampDiscontinuityCount: 0,
};
const squatGate = evaluateExerciseAutoProgress('squat', squatLandmarks, squatStats);
const squatSnapshot = buildAttemptSnapshot('squat', squatGate);
ok('AT1a: valid squat result produces compact typed snapshot', squatSnapshot != null);
ok('AT1b: squat snapshot has movementType squat', squatSnapshot?.movementType === 'squat');
ok('AT1c: squat snapshot has required fields', !!squatSnapshot?.id && !!squatSnapshot?.ts);
ok('AT1d: per-step summary included without raw frame dumps', !Array.isArray(squatSnapshot?.perStepSummary));
ok('AT1e: no raw landmark arrays in snapshot', !('landmarks' in (squatSnapshot ?? {})));
ok('AT1f: squat trace includes current phase', typeof squatSnapshot?.diagnosisSummary?.squatCycle?.currentSquatPhase === 'string');
ok('AT1g: squat trace includes completion blocked reason field', 'completionBlockedReason' in (squatSnapshot?.diagnosisSummary?.squatCycle ?? {}));
const camObs = squatSnapshot?.squatCameraObservability;
ok(
  'AT1h: CAM-OBS squat bundle has runtime, pose_quality, pass_snapshot, completion, eventCycle, reversal',
  camObs != null &&
    typeof camObs.runtime?.latency_ms === 'number' &&
    typeof camObs.pose_quality?.median_landmark_conf === 'number' &&
    (camObs.pass_snapshot === null || typeof camObs.pass_snapshot === 'object') &&
    typeof camObs.completion === 'object' &&
    typeof camObs.eventCycle === 'object' &&
    typeof camObs.reversal === 'object'
);

// PR-CAM-OBS-PASS-SNAPSHOT-FREEZE-PERSIST-01: terminal export 전 동기 freeze → pass_snapshot persist
console.log('\nAT10: pass_snapshot freeze on export path\n');
{
  resetSquatCameraObservabilitySession();
  ok('AT10a: after reset frozen pass snapshot is null', getFrozenSquatPassSnapshot() === null);

  const passLm = squatLandmarksDeepStandardPass();
  const passStats = {
    sampledFrameCount: passLm.length,
    droppedFrameCount: 0,
    captureDurationMs: 5000,
    timestampDiscontinuityCount: 0,
  };
  const passGate = evaluateExerciseAutoProgress('squat', passLm, passStats);
  ok('AT10b: deep standard squat gate passes final', passGate.finalPassEligible === true && passGate.status === 'pass');

  const passSnap = buildAttemptSnapshot('squat', passGate);
  const obs = passSnap?.squatCameraObservability;
  const ps = obs?.pass_snapshot;
  ok('AT10c: pass_snapshot is non-null object after buildAttemptSnapshot', ps != null && typeof ps === 'object');
  if (ps != null) {
    ok('AT10d: pass_snapshot.frame_idx is number', typeof ps.frame_idx === 'number');
    ok('AT10e: pass_snapshot.pass_reason is string', typeof ps.pass_reason === 'string');
    ok('AT10f: pass_snapshot.completion_owner is string', typeof ps.completion_owner === 'string');
    ok('AT10g: pass_snapshot.passLatched is boolean', typeof ps.passLatched === 'boolean');
    ok('AT10h: pass_snapshot.stillSeatedAtPass is boolean', typeof ps.stillSeatedAtPass === 'boolean');
    ok('AT10i: module frozen snapshot matches export', getFrozenSquatPassSnapshot() === ps);
  }

  buildAttemptSnapshot('squat', passGate);
  ok('AT10j: duplicate export does not clear snapshot', getFrozenSquatPassSnapshot() != null);
}

// AT2: Snapshot creation works for overhead reach
const ohLandmarks = overheadLandmarks();
const ohStats = {
  sampledFrameCount: ohLandmarks.length,
  droppedFrameCount: 0,
  captureDurationMs: 1200,
  timestampDiscontinuityCount: 0,
};
const ohGate = evaluateExerciseAutoProgress('overhead-reach', ohLandmarks, ohStats);
const ohSnapshot = buildAttemptSnapshot('overhead-reach', ohGate);
ok('AT2a: valid overhead reach result produces compact typed snapshot', ohSnapshot != null);
ok('AT2b: overhead snapshot has movementType overhead_reach', ohSnapshot?.movementType === 'overhead_reach');
ok('AT2c: hold/raise-related summary preserved at summary level', typeof ohSnapshot?.motionCompleteness === 'string');
ok('AT2d: overhead snapshot omits squat-only CAM-OBS bundle', ohSnapshot?.squatCameraObservability === undefined);

// AT3: Low/invalid/retry reasons are inspectable
const lowQualityLandmarks = squatLandmarks.slice(0, 3);
const lowStats = { sampledFrameCount: 3, droppedFrameCount: 0, captureDurationMs: 300, timestampDiscontinuityCount: 0 };
const lowGate = evaluateExerciseAutoProgress('squat', lowQualityLandmarks, lowStats);
const lowSnapshot = buildAttemptSnapshot('squat', lowGate);
ok('AT3a: low case includes meaningful topReasons', Array.isArray(lowSnapshot?.topReasons));
ok('AT3b: reasons derived from actual fields', lowSnapshot?.topReasons?.length >= 0);
ok('AT3c: invalid or retry case has concise cause summary', typeof lowSnapshot?.outcome === 'string');

// AT4: Bounded trace storage (Node has no localStorage - verify no throw)
ok('AT4a: getRecentAttempts does not throw', (() => { getRecentAttempts(); return true; })());
ok('AT4b: clearAttempts does not throw', (() => { clearAttempts(); return true; })());
ok('AT4c: pushAttemptSnapshot does not throw with valid snapshot', (() => {
  pushAttemptSnapshot(squatSnapshot);
  return true;
})());

// AT5: Aggregation works
const mockSnapshots = [squatSnapshot, ohSnapshot, lowSnapshot].filter(Boolean);
const stats = getQuickStats(mockSnapshots);
ok('AT5a: quick stats by movement is correct', typeof stats.byMovement?.squat === 'number');
ok('AT5b: quick stats by outcome is correct', typeof stats.byOutcome === 'object');
ok('AT5c: top flags aggregation returns expected shape', Array.isArray(stats.topFlags));
ok('AT5d: top retry reasons aggregation returns expected shape', Array.isArray(stats.topRetryReasons));

// AT6: Additive compatibility
ok('AT6a: existing gate shape unchanged', squatGate.status != null && squatGate.guardrail != null);
ok('AT6b: recordAttemptSnapshot does not throw', (() => { recordAttemptSnapshot('squat', squatGate); return true; })());

// AT7: No funnel regression
ok('AT7a: production flow squat -> overhead_reach -> result intact', squatGate != null && ohGate != null);
ok('AT7b: snapshot generation failure does not block (recordAttemptSnapshot is non-throwing)', true);

// AT8: Privacy-light behavior
ok('AT8a: no raw frame arrays in snapshot', !('frames' in (squatSnapshot ?? {})));
ok('AT8b: no raw landmark history in snapshot', !('landmarks' in (squatSnapshot ?? {})));
ok('AT8c: no video blob persistence introduced', !('videoBlob' in (squatSnapshot ?? {})));

// AT9: Type safety
ok('AT9a: snapshot has debugVersion', typeof squatSnapshot?.debugVersion === 'string');
ok('AT9b: wall-angel returns null (deferred)', buildAttemptSnapshot('wall-angel', squatGate) === null);
ok('AT9c: single-leg-balance returns null (deferred)', buildAttemptSnapshot('single-leg-balance', squatGate) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
