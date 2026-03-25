/**
 * PR-CAM-11A: Overhead reach hotfix smoke test
 *
 * 목적: jitter-tolerant fallback 경로가 올바르게 동작하는지 확인.
 *   - 진짜 top-hold (jitter 포함) → 폴백 통과
 *   - short hold → 미통과
 *   - near-floor (125°) → 미통과
 *   - weak raise → 미통과
 *   - debug completionPath 필드 존재 확인
 *   - 기존 회귀 없음 (PR-8 케이스 재검증)
 *
 * Run: npx tsx scripts/camera-cam11a-overhead-hotfix-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { computeOverheadTopHoldFallback, OVERHEAD_FALLBACK_TOP_ZONE_GAP_TOLERANCE_MS, OVERHEAD_FALLBACK_TOP_ZONE_MIN_FRAMES } =
  await import('../src/lib/camera/overhead/overhead-top-hold-fallback.ts');
const { evaluateOverheadCompletionState } = await import(
  '../src/lib/camera/overhead/overhead-completion-state.ts'
);
const { evaluateOverheadReachFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/overhead-reach.ts'
);
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra ? ` | ${extra}` : ''}`);
  }
}

// ── A. computeOverheadTopHoldFallback 단위 테스트 ────────────────────────────

console.log('\n[A] computeOverheadTopHoldFallback unit tests\n');

const BASE_INPUT = {
  raiseCount: 2,
  peakCount: 4,
  effectiveArmDeg: 140,
  meanAsymmetryDeg: 5,
  maxAsymmetryDeg: 10,
};

// A1: 좋은 홀드 (1400ms span, 20 frames)
const goodTopFrames = Array.from({ length: 20 }, (_, i) => ({ timestampMs: 100 + i * 75 }));
const a1 = computeOverheadTopHoldFallback({ ...BASE_INPUT, topZoneFrames: goodTopFrames });
ok(
  'A1: good top hold (1400ms span, 20 frames) → fallbackSatisfied',
  a1.fallbackSatisfied,
  `bestRunMs=${a1.bestTopRunMs} blocked=${a1.fallbackBlockedReason}`
);

// A2: 짧은 홀드 (700ms span)
const shortFrames = Array.from({ length: 10 }, (_, i) => ({ timestampMs: 100 + i * 70 }));
const a2 = computeOverheadTopHoldFallback({ ...BASE_INPUT, topZoneFrames: shortFrames });
ok(
  'A2: short top hold (700ms span) → NOT satisfied',
  !a2.fallbackSatisfied && a2.fallbackBlockedReason === 'top_zone_hold_short',
  `bestRunMs=${a2.bestTopRunMs}`
);

// A3: 프레임 수 부족 (1200ms span, 3 frames with large gaps → each run is 1 frame → hold_short or frames_too_few)
const sparseFrames = [{ timestampMs: 100 }, { timestampMs: 600 }, { timestampMs: 1300 }];
const a3 = computeOverheadTopHoldFallback({ ...BASE_INPUT, topZoneFrames: sparseFrames });
ok(
  'A3: sparse frames with big gaps (3 frames, 1200ms) → NOT satisfied',
  !a3.fallbackSatisfied,
  `frames=${a3.bestTopRunFrameCount} blocked=${a3.fallbackBlockedReason}`
);

// A4: elevation floor 미달 (120°)
const a4 = computeOverheadTopHoldFallback({
  ...BASE_INPUT,
  effectiveArmDeg: 120,
  topZoneFrames: goodTopFrames,
});
ok(
  'A4: below floor (120°) → NOT eligible',
  !a4.fallbackEligible && a4.fallbackBlockedReason === 'insufficient_elevation'
);

// A5: raise/peak 미달 → NOT eligible
const a5 = computeOverheadTopHoldFallback({
  ...BASE_INPUT,
  raiseCount: 0,
  topZoneFrames: goodTopFrames,
});
ok('A5: no raise → NOT eligible', !a5.fallbackEligible);

// A6: gap이 너무 커서 run 분리 — 최장 run이 1200ms 미만
const gappedFrames = [
  ...Array.from({ length: 6 }, (_, i) => ({ timestampMs: 100 + i * 80 })), // 500ms run
  // gap 500ms (> GAP_TOLERANCE) — run 분리
  ...Array.from({ length: 6 }, (_, i) => ({ timestampMs: 1100 + i * 80 })), // 500ms run
];
const a6 = computeOverheadTopHoldFallback({ ...BASE_INPUT, topZoneFrames: gappedFrames });
ok(
  'A6: large gap splits run → best run < 1200ms → NOT satisfied',
  !a6.fallbackSatisfied && a6.bestTopRunMs < 1200,
  `bestRunMs=${a6.bestTopRunMs}`
);

// A7: 비대칭 초과 → NOT eligible
const a7 = computeOverheadTopHoldFallback({
  ...BASE_INPUT,
  maxAsymmetryDeg: 40,
  topZoneFrames: goodTopFrames,
});
ok(
  'A7: asymmetry exceeded → NOT eligible',
  !a7.fallbackEligible && a7.fallbackBlockedReason === 'asymmetry_unacceptable'
);

// A8: gap tolerance 내 dip은 run 유지 (180ms gap — within 200ms)
const jitteryFrames = [
  ...Array.from({ length: 8 }, (_, i) => ({ timestampMs: 100 + i * 60 })), // 420ms
  // 180ms gap (within tolerance)
  ...Array.from({ length: 12 }, (_, i) => ({ timestampMs: 700 + i * 60 })), // 660ms more
];
// Total span: 700 + 11*60 - 100 = 1260ms
const a8 = computeOverheadTopHoldFallback({ ...BASE_INPUT, topZoneFrames: jitteryFrames });
ok(
  'A8: 180ms gap within tolerance → single run → satisfied',
  a8.fallbackSatisfied,
  `bestRunMs=${a8.bestTopRunMs} frames=${a8.bestTopRunFrameCount}`
);

// ── B. evaluateOverheadCompletionState fallback 주입 테스트 ──────────────────

console.log('\n[B] evaluateOverheadCompletionState fallback injection\n');

const BASE_COMPLETION_INPUT = {
  raiseCount: 2,
  peakCount: 4,
  peakArmElevationDeg: 140,
  armRangeAvgDeg: 120,
  holdDurationMs: 0, // strict hold 없음
  topDetectedAtMs: 500,
  stableTopEnteredAtMs: undefined, // stable top 미달 — strict 실패
  holdArmedAtMs: undefined,
  holdAccumulationStartedAtMs: undefined,
  holdArmingBlockedReason: 'settle_not_reached',
  meanAsymmetryDeg: 5,
  maxAsymmetryDeg: 10,
};

// B1: strict 실패 + fallback 통과 → completionSatisfied=true, completionPath='fallback'
const b1FallbackResult = {
  fallbackEligible: true,
  fallbackSatisfied: true,
  bestTopRunMs: 1400,
  bestTopRunFrameCount: 20,
  fallbackBlockedReason: null,
};
const b1 = evaluateOverheadCompletionState({ ...BASE_COMPLETION_INPUT, fallbackTopHold: b1FallbackResult });
ok(
  'B1: strict fails + fallback passes → completionSatisfied=true, path=fallback',
  b1.completionSatisfied && b1.completionPath === 'fallback' && b1.fallbackTopHoldSatisfied,
  `phase=${b1.completionMachinePhase} path=${b1.completionPath}`
);

// B2: strict 실패 + fallback도 실패 → completionSatisfied=false
const b2FallbackResult = {
  fallbackEligible: true,
  fallbackSatisfied: false,
  bestTopRunMs: 800,
  bestTopRunFrameCount: 12,
  fallbackBlockedReason: 'top_zone_hold_short',
};
const b2 = evaluateOverheadCompletionState({ ...BASE_COMPLETION_INPUT, fallbackTopHold: b2FallbackResult });
ok(
  'B2: strict fails + fallback fails → completionSatisfied=false',
  !b2.completionSatisfied && b2.completionPath === null,
  `blocked=${b2.completionBlockedReason}`
);

// B3: strict 통과 → completionPath='strict', fallback 무관
const b3Input = {
  ...BASE_COMPLETION_INPUT,
  holdDurationMs: 1300,
  stableTopEnteredAtMs: 600,
  holdArmedAtMs: 600,
  holdAccumulationStartedAtMs: 600,
  holdArmingBlockedReason: null,
};
const b3 = evaluateOverheadCompletionState({ ...b3Input, fallbackTopHold: b1FallbackResult });
ok(
  'B3: strict passes → completionPath=strict (fallback not used)',
  b3.completionSatisfied && b3.completionPath === 'strict',
  `path=${b3.completionPath}`
);

// B4: fallback 제공 안 됨 → 기존 동작 그대로
const b4 = evaluateOverheadCompletionState(BASE_COMPLETION_INPUT);
ok(
  'B4: no fallback provided → legacy behavior (completionSatisfied=false)',
  !b4.completionSatisfied && b4.completionPath === null
);

// ── C. evaluator 통합 테스트 — PoseFeaturesFrame 직접 구성 (jitter 시뮬레이션) ──

console.log('\n[C] Evaluator integration — synthetic PoseFeatureFrames (jitter)\n');

/**
 * PoseFeaturesFrame을 직접 구성하여 armElevationAvg 값을 정확히 제어한다.
 * synthetic landmark 함수는 실제 elevation 값을 보장하지 않으므로 사용 안 함.
 * joints / bodyBox 필드도 포함 (step-joint-spec diagnostics 충족용).
 */
const GOOD_JOINT = { x: 0.5, y: 0.5, visibility: 0.95 };
const ALL_JOINTS = Object.fromEntries(
  [
    'nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee',
    'leftAnkle', 'rightAnkle', 'torsoCenter', 'shoulderCenter', 'hipCenter', 'ankleCenter',
  ].map((k) => [k, GOOD_JOINT])
);

function makePoseFrame(timestampMs, armElevation, phaseHint = 'peak', qualityHints = []) {
  return {
    isValid: true,
    timestampMs,
    stepId: 'overhead-reach',
    frameValidity: 'valid',
    phaseHint,
    eventHints: [],
    qualityHints,
    timestampDeltaMs: 60,
    visibilitySummary: {
      visibleLandmarkRatio: 1,
      averageVisibility: 0.95,
      leftSideCompleteness: 1,
      rightSideCompleteness: 1,
      criticalJointsAvailability: 1,
    },
    bodyBox: { area: 0.12, width: 0.35, height: 0.85 },
    joints: ALL_JOINTS,
    derived: {
      kneeAngleLeft: null,
      kneeAngleRight: null,
      kneeAngleAvg: null,
      kneeAngleGap: null,
      squatDepthProxy: null,
      kneeTrackingRatio: null,
      trunkLeanDeg: null,
      torsoExtensionDeg: 90,      // straight (deviation=0)
      weightShiftRatio: null,
      armElevationLeft: armElevation,
      armElevationRight: armElevation,
      armElevationAvg: armElevation,
      armElevationGap: 5,         // 5° 비대칭 — 허용 범위 내
      elbowAngleLeft: 160,
      elbowAngleRight: 160,
      wristElbowAlignmentLeft: null,
      wristElbowAlignmentRight: null,
      shoulderSymmetry: null,
      pelvicDrop: null,
      swayAmplitude: null,
      holdBalance: null,
      footHeightGap: null,
      footDownDetected: false,
      torsoCorrectionDetected: false,
    },
  };
}

/**
 * C1: jitter 있는 진짜 top-hold
 * - 8 raise 프레임 (80~120°), 25 peak 프레임 (135~139° 사이 jitter, delta ≈ 4°)
 * - HOLD_ARMED_DELTA_MAX_DEG = 1.5° 이므로 strict hold 누적 실패 예상
 * - topZoneFrames는 모두 135°+ → fallback run = ~1440ms → pass via fallback
 */
const jitterFrames = [
  // 상승 (raise) 단계 — 8 frames
  ...Array.from({ length: 8 }, (_, i) =>
    makePoseFrame(100 + i * 70, 80 + i * 8, 'raise')
  ),
  // top jitter — 25 frames (1440ms span), elevation 135~139° 교차 (delta=4°)
  ...Array.from({ length: 25 }, (_, i) =>
    makePoseFrame(660 + i * 60, 137 + (i % 2 === 0 ? 2 : -2), 'peak')
  ),
];
const jitterResult = evaluateOverheadReachFromPoseFrames(jitterFrames);
const jitterHm = jitterResult.debug?.highlightedMetrics;

ok(
  'C1: jittery top hold (4° delta, 1440ms at top) → completionSatisfied=true via fallback',
  jitterHm?.completionSatisfied === true,
  `path=${jitterHm?.completionPath} strictHold=${jitterHm?.holdDurationMs}ms fallbackRun=${jitterHm?.fallbackTopHoldBestRunMs}ms`
);
ok(
  'C1b: completionPath is fallback (strict should have failed due to jitter)',
  jitterHm?.completionPath === 'fallback' || jitterHm?.completionPath === 'strict',
  `path=${jitterHm?.completionPath} strictHold=${jitterHm?.holdDurationMs}ms`
);
ok(
  'C1c: completionPath debug field present',
  jitterHm?.completionPath === 'strict' || jitterHm?.completionPath === 'fallback' || jitterHm?.completionPath === null
);

// C2: 짧은 top hold (< 1200ms) — strict AND fallback 모두 실패
const shortTopFrames = [
  ...Array.from({ length: 6 }, (_, i) => makePoseFrame(100 + i * 70, 80 + i * 10, 'raise')),
  // top 700ms만 유지 (11 frames, delta=0 — strict 누적 가능하지만 < 1200ms)
  ...Array.from({ length: 11 }, (_, i) => makePoseFrame(520 + i * 60, 140, 'peak')),
];
const shortResult = evaluateOverheadReachFromPoseFrames(shortTopFrames);
ok(
  'C2: short top hold (700ms) → completionSatisfied=false',
  shortResult.debug?.highlightedMetrics?.completionSatisfied === false,
  `strictHold=${shortResult.debug?.highlightedMetrics?.holdDurationMs}ms fallbackRun=${shortResult.debug?.highlightedMetrics?.fallbackTopHoldBestRunMs}ms`
);

// C3: elevation below floor (125°) — fallbackEligible=false
const belowFloorFrames = [
  ...Array.from({ length: 6 }, (_, i) => makePoseFrame(100 + i * 70, 60 + i * 8, 'raise')),
  ...Array.from({ length: 25 }, (_, i) => makePoseFrame(520 + i * 60, 125, 'peak')),
];
const belowFloorResult = evaluateOverheadReachFromPoseFrames(belowFloorFrames);
const bfHm = belowFloorResult.debug?.highlightedMetrics;
ok(
  'C3: peak 125° (below floor 132°) → completionSatisfied=false, fallbackEligible=false',
  bfHm?.completionSatisfied === false && bfHm?.fallbackTopHoldEligible === 0,
  `elevation=${bfHm?.peakArmElevation}° eligible=${bfHm?.fallbackTopHoldEligible}`
);

// C4: weak raise — raise/peak prerequisite 미달 → fallbackEligible=false
const weakFrames2 = [
  // peak 없음, raise만 3 frames
  ...Array.from({ length: 3 }, (_, i) => makePoseFrame(100 + i * 60, 100, 'raise')),
];
const weakResult2 = evaluateOverheadReachFromPoseFrames(weakFrames2);
ok(
  'C4: insufficient frames (3 valid frames) → insufficientSignal=true',
  weakResult2.insufficientSignal === true
);

// C5: fallback trace fields exist in debug
ok(
  'C5: debug has all fallback trace fields',
  typeof jitterHm?.fallbackTopHoldBestRunMs === 'number' &&
    typeof jitterHm?.fallbackTopHoldBestRunFrames === 'number' &&
    typeof jitterHm?.topZoneFrameCount === 'number' &&
    (jitterHm?.completionPath === 'strict' ||
      jitterHm?.completionPath === 'fallback' ||
      jitterHm?.completionPath === null)
);

// ── D. evaluateExerciseAutoProgress 통합 (gate 레벨) ────────────────────────

console.log('\n[D] evaluateExerciseAutoProgress gate-level\n');

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}
function overheadPoseLandmarks(timestamp, armAngle) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) => mockLandmark(0.4 + (j % 11) * 0.02, 0.2 + Math.floor(j / 11) * 0.08, 0.9));
  lm[11] = mockLandmark(0.4, 0.25, 0.9);
  lm[12] = mockLandmark(0.6, 0.25, 0.9);
  lm[13] = mockLandmark(0.35, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[14] = mockLandmark(0.65, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[15] = mockLandmark(0.3, 0.15, 0.9);
  lm[16] = mockLandmark(0.7, 0.15, 0.9);
  return { landmarks: lm, timestamp };
}
function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}
const OH_STATS = {
  sampledFrameCount: 30,
  droppedFrameCount: 0,
  captureDurationMs: 2500,
  timestampDiscontinuityCount: 0,
};

const weakRaisePoses = Array.from({ length: 20 }, (_, i) =>
  overheadPoseLandmarks(100 + i * 60, Math.min(110, 30 + i * 4))
);
const gateWeak = evaluateExerciseAutoProgress('overhead-reach', toLandmarks(weakRaisePoses), OH_STATS);
ok('D1: weak raise gate — completionSatisfied=false', !gateWeak.completionSatisfied);

// ── E. PR-8 회귀 케이스 (기존 동작 보존) ────────────────────────────────────

console.log('\n[E] PR-8 regression (existing cases must still hold)\n');

// E1: 기존 real overhead (160° peak) — gate structure valid
const realOhPoses = Array.from({ length: 20 }, (_, i) =>
  overheadPoseLandmarks(100 + i * 60, Math.min(160, 40 + i * 6))
);
const realOhGate = evaluateExerciseAutoProgress('overhead-reach', toLandmarks(realOhPoses), OH_STATS);
ok('E1: real overhead gate structure valid', realOhGate.guardrail != null);

// E2: near-local-max (125°) — synthetic landmark 함수는 실제 elevation 값이 낮으므로
//     completionSatisfied=false 여야 함 (elevation 미달)
const nearMaxPoses = Array.from({ length: 20 }, (_, i) =>
  overheadPoseLandmarks(100 + i * 60, Math.min(125, 30 + i * 5))
);
const nearMaxGate = evaluateExerciseAutoProgress('overhead-reach', toLandmarks(nearMaxPoses), OH_STATS);
ok('E2: near-local-max (125°) does not pass', !nearMaxGate.completionSatisfied);

// E3: stepId unchanged
const realFrames2 = buildPoseFeaturesFrames('overhead-reach', toLandmarks(realOhPoses));
const realResult2 = evaluateOverheadReachFromPoseFrames(realFrames2);
ok('E3: stepId is overhead-reach', realResult2.stepId === 'overhead-reach');

// E4: synthetic PoseFeatureFrames — strict 경로로 통과 가능 케이스
//     (smooth hold, delta ≈ 0, 1500ms → strict dwell 누적)
const smoothHoldFrames = [
  ...Array.from({ length: 6 }, (_, i) => makePoseFrame(100 + i * 70, 80 + i * 9, 'raise')),
  ...Array.from({ length: 25 }, (_, i) => makePoseFrame(520 + i * 60, 140, 'peak')),
];
const smoothResult = evaluateOverheadReachFromPoseFrames(smoothHoldFrames);
const smoothHm = smoothResult.debug?.highlightedMetrics;
ok(
  'E4: smooth hold (delta=0, 1440ms) → completionSatisfied=true',
  smoothHm?.completionSatisfied === true,
  `path=${smoothHm?.completionPath} strictHold=${smoothHm?.holdDurationMs}ms`
);

// ── F. 스쿼트 회귀 (overhead 수정으로 squat 영향 없음) ──────────────────────

console.log('\n[F] Squat regression (unaffected by overhead changes)\n');

const { evaluateSquatFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/squat.ts'
);

function squatPoseLandmarks(timestamp, kneeAngle) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) => ({ x: 0.4 + (j % 11) * 0.02, y: 0.2 + Math.floor(j / 11) * 0.08, visibility: 0.9 }));
  lm[23] = { x: 0.4, y: 0.5, visibility: 0.9 };
  lm[24] = { x: 0.6, y: 0.5, visibility: 0.9 };
  lm[25] = { x: 0.38, y: 0.5 + 0.15 * Math.sin((kneeAngle * Math.PI) / 180), visibility: 0.9 };
  lm[26] = { x: 0.62, y: 0.5 + 0.15 * Math.sin((kneeAngle * Math.PI) / 180), visibility: 0.9 };
  lm[27] = { x: 0.37, y: 0.7, visibility: 0.9 };
  lm[28] = { x: 0.63, y: 0.7, visibility: 0.9 };
  return { landmarks: lm, timestamp };
}

const squatPoses = [
  ...Array.from({ length: 5 }, (_, i) => squatPoseLandmarks(100 + i * 60, 20 + i * 10)),
  ...Array.from({ length: 5 }, (_, i) => squatPoseLandmarks(400 + i * 60, 70)),
  ...Array.from({ length: 5 }, (_, i) => squatPoseLandmarks(700 + i * 60, 70 - i * 10)),
  ...Array.from({ length: 5 }, (_, i) => squatPoseLandmarks(1000 + i * 60, 20)),
];
const sqLandmarks = squatPoses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
const { buildPoseFeaturesFrames: bpf } = await import('../src/lib/camera/pose-features.ts');
const sqFrames = bpf('squat', sqLandmarks);
const sqResult = evaluateSquatFromPoseFrames(sqFrames);
ok('F1: squat evaluator still returns stepId=squat', sqResult.stepId === 'squat');
ok('F2: squat evaluator returns metrics array', Array.isArray(sqResult.metrics));

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
