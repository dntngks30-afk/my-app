/**
 * PR-CAM-12 smoke test
 *
 * 검증 목표:
 * - easy progression이 strict 132° peak 라벨(phaseHint==='peak')에 의존하지 않음을 확인.
 * - 실기기 파이프라인은 128°에서 phaseHint==='raise'를 생성하므로, 해당 조건에서
 *   easyTopZoneFrames 기반 peakCountAtEasyFloor가 동작해야 함.
 *
 * 시나리오:
 * A. 128° + phaseHint='raise' (실 파이프라인 시뮬레이션) + 충분한 홀드 → easy 통과
 * B. 128° + phaseHint='raise' 하지만 홀드 부족 → easy 차단
 * C. 120° (easy floor 미만) + phaseHint='raise' → easy 차단
 * D. raise 없이 top-zone만 → easy 차단
 * E. strict 해석(132°·dwell)은 여전히 엄격 — easy pass에도 strict false 유지
 * F. 132° + 충분한 dwell → strict 통과 (기존 경로 회귀 확인)
 * G. 기존 cam11b E5 유닛 호환 확인 (peakCountAtEasyFloor 인터페이스 유지)
 *
 * 실행: node scripts/camera-cam12-overhead-easy-fix-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateOverheadReachFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/overhead-reach.ts'
);
const { computeOverheadEasyProgressionHold } = await import(
  '../src/lib/camera/overhead/overhead-easy-progression.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}${extra ? ` | ${extra}` : ''}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// PoseFeaturesFrame factory — phaseHint를 수동 지정해 실 파이프라인 동작 시뮬레이션
// ---------------------------------------------------------------------------
const GOOD_JOINT = { x: 0.5, y: 0.5, visibility: 0.95 };
const ALL_JOINTS = Object.fromEntries(
  [
    'nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee',
    'leftAnkle', 'rightAnkle', 'torsoCenter', 'shoulderCenter', 'hipCenter', 'ankleCenter',
  ].map((k) => [k, GOOD_JOINT])
);

function makeFrame(timestampMs, armElevation, phaseHint, qualityHints = []) {
  return {
    isValid: true,
    timestampMs,
    stepId: 'overhead-reach',
    frameValidity: 'valid',
    phaseHint,
    eventHints: [],
    qualityHints,
    timestampDeltaMs: 70,
    visibilitySummary: {
      visibleLandmarkRatio: 1,
      averageVisibility: 0.95,
      leftSideCompleteness: 1,
      rightSideCompleteness: 1,
      criticalJointsAvailability: 1,
    },
    bodyBox: { area: 0.13, width: 0.36, height: 0.84 },
    joints: ALL_JOINTS,
    derived: {
      kneeAngleLeft: null, kneeAngleRight: null, kneeAngleAvg: null, kneeAngleGap: null,
      squatDepthProxy: null, kneeTrackingRatio: null, trunkLeanDeg: null,
      torsoExtensionDeg: 90,
      weightShiftRatio: null,
      armElevationLeft: armElevation,
      armElevationRight: armElevation,
      armElevationAvg: armElevation,
      armElevationGap: 4,
      elbowAngleLeft: 162, elbowAngleRight: 162,
      wristElbowAlignmentLeft: null, wristElbowAlignmentRight: null,
      shoulderSymmetry: null, pelvicDrop: null, swayAmplitude: null, holdBalance: null,
      footHeightGap: null, footDownDetected: false, torsoCorrectionDetected: false,
    },
  };
}

// ---------------------------------------------------------------------------
// 시나리오 A: 128° + phaseHint='raise' — 실기기 파이프라인이 만드는 조합
// ---------------------------------------------------------------------------
console.log('\n[Scenario A] 128° top hold with phaseHint=\'raise\' (real pipeline simulation)');
{
  // 실기기에서 128°(< 132°)이면 phaseHint가 'peak'가 아니라 'raise' 또는 'unknown'이 됨.
  // PR-CAM-12 fix 전: peakCountAtEasyFloor = 0 (peak라벨 없음) → 차단.
  // PR-CAM-12 fix 후: peakCountAtEasyFloor = easyTopZoneFrames.length = 10 → 통과.
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    // 128° with 'raise' phaseHint — strict 132° 미달이므로 실 파이프라인에서 'peak' 아님
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'A1: 128° + raise phaseHint → easyCompletionSatisfied true',
    hm?.easyCompletionSatisfied === 1 || hm?.easyCompletionSatisfied === true,
    `easy=${hm?.easyCompletionSatisfied} blocked=${hm?.easyCompletionBlockedReason}`
  );
  ok(
    'A2: progressionCompletionSatisfied (completionSatisfied) true via easy path',
    hm?.completionSatisfied === true,
    `path=${hm?.completionPath}`
  );
  ok(
    'A3: completionPath is easy',
    hm?.completionPath === 'easy',
    `path=${hm?.completionPath}`
  );
  ok(
    'A4: strict motion still false (128° does not satisfy strict 132° dwell)',
    hm?.strictMotionCompletionSatisfied === 0 || hm?.strictMotionCompletionSatisfied === false,
    `strictMotion=${hm?.strictMotionCompletionSatisfied} holdMs=${hm?.holdDurationMs}`
  );
  ok(
    'A5: peakCountAtEasyFloor reflects easy top-zone frame count (>= 2)',
    typeof hm?.peakCountAtEasyFloor === 'number' && hm.peakCountAtEasyFloor >= 2,
    `peakCountAtEasyFloor=${hm?.peakCountAtEasyFloor}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 B: 128° + phaseHint='raise' 하지만 홀드 너무 짧음 (200ms)
// ---------------------------------------------------------------------------
console.log('\n[Scenario B] 128° raise phaseHint but hold too short');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    // 200ms 이하 홀드 (3프레임 × 70ms = 210ms span, < 520ms 필요)
    ...Array.from({ length: 3 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'B1: hold < 520ms → easy not satisfied',
    hm?.easyCompletionSatisfied === 0 || hm?.easyCompletionSatisfied === false,
    `easy=${hm?.easyCompletionSatisfied} easyBestRunMs=${hm?.easyBestRunMs}`
  );
  ok(
    'B2: completionSatisfied false',
    hm?.completionSatisfied === false,
    `path=${hm?.completionPath}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 C: 120° (easy floor 미만) → easy 차단
// ---------------------------------------------------------------------------
console.log('\n[Scenario C] 120° — below easy floor (126°)');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 60 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 120, 'raise')),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'C1: 120° → easyCompletionSatisfied false',
    hm?.easyCompletionSatisfied === 0 || hm?.easyCompletionSatisfied === false,
    `blocked=${hm?.easyCompletionBlockedReason}`
  );
  ok(
    'C2: peakCountAtEasyFloor = 0 (no frames above 126°)',
    hm?.peakCountAtEasyFloor === 0,
    `peakCountAtEasyFloor=${hm?.peakCountAtEasyFloor}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 D: raise 없이 top-zone만 (raiseCount=0) → easy 차단
// ---------------------------------------------------------------------------
console.log('\n[Scenario D] No raise phase, only top-zone frames');
{
  // raiseCount는 phaseHint==='raise'인 프레임 수 — 없으면 차단
  const frames = [
    ...Array.from({ length: 10 }, (_, i) => makeFrame(100 + i * 70, 128, 'unknown')),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'D1: raiseCount=0 → easy blocked (no raise evidence)',
    hm?.easyCompletionSatisfied === 0 || hm?.easyCompletionSatisfied === false,
    `raiseCount=${hm?.raiseCount} blocked=${hm?.easyCompletionBlockedReason}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 E: strict 해석은 여전히 엄격 — 132° + 충분한 안정 dwell 필요
// ---------------------------------------------------------------------------
console.log('\n[Scenario E] Strict interpretation still strict (132° + dwell required)');
{
  // 135° 하지만 jitter(delta=3° > 2.6)로 stable dwell이 없는 케이스
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 80 + i * 10, 'raise')),
    // 135° with alternating jitter — stable dwell won't form
    ...Array.from({ length: 14 }, (_, i) =>
      makeFrame(520 + i * 70, 135 + (i % 2 === 0 ? 3 : -3), 'raise')
    ),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'E1: jittery 135° → strict dwell not formed (strictMotionCompletionSatisfied false)',
    hm?.strictMotionCompletionSatisfied === 0 || hm?.strictMotionCompletionSatisfied === false,
    `strictMotion=${hm?.strictMotionCompletionSatisfied} holdMs=${hm?.holdDurationMs}`
  );
  // easy still works at 135° (>= 126°) if top-zone span is sufficient
  const easyPassed = hm?.easyCompletionSatisfied === 1 || hm?.easyCompletionSatisfied === true;
  ok(
    'E2: easy can pass at 135° even with jitter (separate from strict)',
    easyPassed,
    `easy=${hm?.easyCompletionSatisfied} easyBestRunMs=${hm?.easyBestRunMs}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 F: 132° + 충분한 안정 dwell → strict 통과 (기존 경로 회귀)
// ---------------------------------------------------------------------------
console.log('\n[Scenario F] Strict path regression — 132° + stable hold >= 1200ms');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 80 + i * 10, 'raise')),
    // 132° with peak phaseHint and stable hold (~1260ms span = 18 * 70ms)
    ...Array.from({ length: 20 }, (_, i) => makeFrame(520 + i * 70, 135, 'peak')),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'F1: 132°+ with stable hold → completionSatisfied true',
    hm?.completionSatisfied === true,
    `path=${hm?.completionPath}`
  );
  ok(
    'F2: strict path preferred when dwell formed',
    hm?.strictMotionCompletionSatisfied === 1 || hm?.strictMotionCompletionSatisfied === true,
    `strict=${hm?.strictMotionCompletionSatisfied}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 G: 기존 cam11b E5 유닛 — peakCountAtEasyFloor 인터페이스 호환
// ---------------------------------------------------------------------------
console.log('\n[Scenario G] Interface compatibility — direct unit call (cam11b E5 pattern)');
{
  const ez = computeOverheadEasyProgressionHold({
    easyTopZoneFrames: Array.from({ length: 10 }, (_, i) => ({ timestampMs: 100 + i * 60 })),
    raiseCount: 2,
    peakCountAtEasyFloor: 3,  // 직접 공급 시 여전히 동작해야 함
    effectiveArmDeg: 125,
    meanAsymmetryDeg: 5,
    maxAsymmetryDeg: 10,
  });
  ok(
    'G1: easy blocked when effectiveArmDeg < 126° (125°)',
    !ez.easyCompletionSatisfied,
    `blocked=${ez.easyCompletionBlockedReason}`
  );

  const ezPass = computeOverheadEasyProgressionHold({
    easyTopZoneFrames: Array.from({ length: 10 }, (_, i) => ({ timestampMs: 100 + i * 60 })),
    raiseCount: 2,
    peakCountAtEasyFloor: 10,  // easyTopZoneFrames.length 공급 시 동작
    effectiveArmDeg: 128,
    meanAsymmetryDeg: 5,
    maxAsymmetryDeg: 10,
  });
  ok(
    'G2: easy passes with easyTopZoneFrames.length-based peakCountAtEasyFloor',
    ezPass.easyCompletionSatisfied,
    `blocked=${ezPass.easyCompletionBlockedReason} bestRunMs=${ezPass.easyBestRunMs}`
  );
}

// ---------------------------------------------------------------------------
// 시나리오 H: peakCountAtEasyFloor 디버그 메트릭이 easyTopZoneFrames 길이와 일치
// ---------------------------------------------------------------------------
console.log('\n[Scenario H] peakCountAtEasyFloor debug metric == easyTopZoneFrames count');
{
  const frames = [
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + i * 70, 80 + i * 12, 'raise')),
    // 7프레임이 128° (= easy top zone)
    ...Array.from({ length: 7 }, (_, i) => makeFrame(380 + i * 70, 128, 'raise')),
    // 2프레임은 118° (easy floor 미만)
    ...Array.from({ length: 2 }, (_, i) => makeFrame(870 + i * 70, 118, 'lower')),
  ];

  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'H1: peakCountAtEasyFloor == 7 (frames >= 126°, not peak-labeled)',
    hm?.peakCountAtEasyFloor === 7,
    `peakCountAtEasyFloor=${hm?.peakCountAtEasyFloor} easyTopZoneFrameCount=${hm?.easyTopZoneFrameCount}`
  );
}

console.log(`\n=== PR-CAM-12 smoke complete: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
