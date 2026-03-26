/**
 * PR-CAM-13 smoke test
 *
 * 검증 목표:
 * - overheadProgressionState typed object가 debug에 올바르게 생성되는지 확인.
 * - progressionBlockedReason이 easy-facing 우선, strict fallback으로 동작하는지.
 * - progressionPhase가 실제 진행 상태를 반영하는지.
 * - ambiguous retry가 progressionBlockedReason 우선으로 reason을 결정하는지.
 * - voice hold cue가 easy_building_hold 구간에서 활성화 가능한지.
 * - 기존 CAM-12 pass 경로 및 strict path 회귀가 없는지.
 *
 * 시나리오:
 * A. Easy pass preserved
 *    — 128° + raise + 충분한 easy hold → progressionSatisfied=true, progressionPath='easy'
 * B. Easy short hold blocked → progressionBlockedReason='easy_hold_short', retry='no_hold'
 * C. Below easy floor → progressionBlockedReason='easy_top_not_reached'
 * D. Weak/no raise → progressionBlockedReason='easy_raise_incomplete'
 * E. Strict success → progressionSatisfied=true, strictMotionCompletionSatisfied=true
 * F. Strict interpretation remains strict (easy pass ≠ strict upgraded)
 * G. Voice eligibility sanity — easy_building_hold 구간에서 hold cue 조건 충족
 * H. Regression: 기존 CAM-12 핵심 assertions 유지
 *
 * 실행: npx tsx scripts/camera-cam13-overhead-progression-state-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateOverheadReachFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/overhead-reach.ts'
);
const { isOverheadAmbiguousRetryEligible, deriveOverheadAmbiguousRetryReason } = await import(
  '../src/lib/camera/overhead/overhead-ambiguous-retry.ts'
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
// Frame factory (CAM-12와 동일 포맷)
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

/** ExerciseGateResult 최소 mock — ambiguous retry 테스트용 */
function makeGateMock(evaluatorResult, {
  completionSatisfied = false,
  captureQuality = 'valid',
  failureReasons = [],
} = {}) {
  return {
    evaluatorResult,
    completionSatisfied:
      completionSatisfied ??
      (evaluatorResult.debug?.highlightedMetrics?.completionSatisfied === true),
    guardrail: { captureQuality },
    failureReasons,
  };
}

// ---------------------------------------------------------------------------
// Scenario A: Easy pass — progressionSatisfied=true, progressionPath='easy'
// ---------------------------------------------------------------------------
console.log('\n[Scenario A] Easy pass preserved — 128° + raise + sufficient easy hold');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;
  const prog = result.debug?.overheadProgressionState;

  ok('A1: overheadProgressionState exists', prog != null, `prog=${JSON.stringify(prog)}`);
  ok(
    'A2: progressionSatisfied = true',
    prog?.progressionSatisfied === true,
    `progressionSatisfied=${prog?.progressionSatisfied}`,
  );
  ok(
    'A3: progressionPath = easy',
    prog?.progressionPath === 'easy',
    `progressionPath=${prog?.progressionPath}`,
  );
  ok(
    'A4: progressionBlockedReason = null',
    prog?.progressionBlockedReason === null,
    `blocked=${prog?.progressionBlockedReason}`,
  );
  ok(
    'A5: progressionPhase = completed',
    prog?.progressionPhase === 'completed',
    `phase=${prog?.progressionPhase}`,
  );
  ok(
    'A6: easyCompletionSatisfied = true',
    prog?.easyCompletionSatisfied === true,
    `easy=${prog?.easyCompletionSatisfied}`,
  );
  ok(
    'A7: strictMotionCompletionSatisfied = false (128° strict 미달)',
    prog?.strictMotionCompletionSatisfied === false,
    `strict=${prog?.strictMotionCompletionSatisfied}`,
  );
  ok(
    'A8: highlightedMetrics.completionSatisfied backward-compat true',
    hm?.completionSatisfied === true,
    `hm.completionSatisfied=${hm?.completionSatisfied}`,
  );
  ok(
    'A9: strict fields preserved (strictCompletionBlockedReason present)',
    'strictCompletionBlockedReason' in (prog ?? {}),
    `keys=${Object.keys(prog ?? {}).join(',')}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario B: Easy short hold
// PR-CAM-16 의도적 변경: 상승 중 프레임(102°, 110°)이 humane zone(≥100°)에 포함돼
// humane zone run = [380, 450, 520, 590, 660ms] → span=280ms ≥ 200ms → humane_low_rom PASS.
// B1-B5 assertions를 새로운 PASS 동작을 반영하도록 업데이트.
// ---------------------------------------------------------------------------
console.log('\n[Scenario B] Easy short hold — now PASS via humane_low_rom (CAM-16 intentional change)');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    // 3프레임(span=140ms) at 128° — easy hold 미달이지만 상승 중 humane zone 포함으로 280ms+ → 통과
    ...Array.from({ length: 3 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'B1: progressionSatisfied = true (CAM-16: humane_low_rom passes via rise+hold span)',
    prog?.progressionSatisfied === true,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'B2: progressionBlockedReason = null (satisfied)',
    prog?.progressionBlockedReason === null,
    `blocked=${prog?.progressionBlockedReason}`,
  );
  ok(
    'B3: progressionPhase = completed',
    prog?.progressionPhase === 'completed',
    `phase=${prog?.progressionPhase}`,
  );

  // ambiguous retry: already complete → not eligible
  const gate = makeGateMock(result, {
    completionSatisfied: true,
    captureQuality: 'valid',
    failureReasons: [],
  });
  const eligible = isOverheadAmbiguousRetryEligible(gate);
  const reason = deriveOverheadAmbiguousRetryReason(gate);

  ok('B4: ambiguous retry NOT eligible (already complete via humane)', eligible === false, `eligible=${eligible}`);
  ok(
    'B5: ambiguous retry reason = null (complete → no retry needed)',
    reason === null,
    `reason=${reason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario C: Below easy floor (120°) — PR-CAM-15 후 low-ROM 경로로 통과 (의도된 변경)
// 120° ≥ low-ROM floor(110°), baseline(80°) 대비 40° 개선, 10프레임 at 120° = 630ms ≥ 350ms
// ---------------------------------------------------------------------------
console.log('\n[Scenario C] Below easy floor (120°) — now passes via low-ROM (PR-CAM-15)');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 60 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 120, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  // PR-CAM-15: 120° + 630ms hold → low-ROM 통과 (제한적 ROM 사용자 의도된 접근성 개선)
  ok(
    'C1: progressionSatisfied = true (low-ROM path — PR-CAM-15 intended change)',
    prog?.progressionSatisfied === true,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'C2: progressionPath = low_rom',
    prog?.progressionPath === 'low_rom',
    `path=${prog?.progressionPath}`,
  );
  ok(
    'C3: progressionPhase = completed',
    prog?.progressionPhase === 'completed',
    `phase=${prog?.progressionPhase}`,
  );
  // strict quality 기준 변경 없음 — 120° < 132° → strict remains false
  ok(
    'C4: strictMotionCompletionSatisfied = false (strict unchanged)',
    prog?.strictMotionCompletionSatisfied === false,
    `strict=${prog?.strictMotionCompletionSatisfied}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario D: No/weak raise → easy_raise_incomplete
// ---------------------------------------------------------------------------
console.log('\n[Scenario D] No raise phase — easy_raise_incomplete');
{
  // phaseHint='unknown' → raiseCount=0 → easy 차단
  const frames = Array.from({ length: 12 }, (_, i) => makeFrame(100 + i * 70, 128, 'unknown'));
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'D1: progressionSatisfied = false',
    prog?.progressionSatisfied === false,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'D2: progressionBlockedReason = easy_raise_incomplete',
    prog?.progressionBlockedReason === 'easy_raise_incomplete',
    `blocked=${prog?.progressionBlockedReason}`,
  );
  ok(
    'D3: progressionPhase = idle',
    prog?.progressionPhase === 'idle',
    `phase=${prog?.progressionPhase}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario E: Strict success — progressionPath='strict', strictMotionCompletionSatisfied=true
// ---------------------------------------------------------------------------
console.log('\n[Scenario E] Strict success — 135° + stable dwell >= 1200ms');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 80 + i * 10, 'raise')),
    ...Array.from({ length: 20 }, (_, i) => makeFrame(520 + i * 70, 135, 'peak')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'E1: progressionSatisfied = true',
    prog?.progressionSatisfied === true,
    `sat=${prog?.progressionSatisfied}`,
  );
  // CAM-11A fallback은 strict-machine의 jitter-tolerant 경로이므로 'strict'|'fallback' 모두 허용
  ok(
    'E2: progressionPath = strict or fallback (both are strict-machine paths)',
    prog?.progressionPath === 'strict' || prog?.progressionPath === 'fallback',
    `path=${prog?.progressionPath}`,
  );
  ok(
    'E3: strictMotionCompletionSatisfied = true',
    prog?.strictMotionCompletionSatisfied === true,
    `strict=${prog?.strictMotionCompletionSatisfied}`,
  );
  ok(
    'E4: progressionPhase = completed',
    prog?.progressionPhase === 'completed',
    `phase=${prog?.progressionPhase}`,
  );
  ok(
    'E5: progressionBlockedReason = null',
    prog?.progressionBlockedReason === null,
    `blocked=${prog?.progressionBlockedReason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario F: Strict interpretation stays strict even when easy passes
// ---------------------------------------------------------------------------
console.log('\n[Scenario F] Strict interpretation — easy pass does NOT inflate planning evidence');
{
  // 128° easy pass — planning evidence는 holdDurationMs < OVERHEAD_REQUIRED_HOLD_MS=1200이므로 'insufficient_signal'
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;
  const planningLevel = result.debug?.overheadEvidenceLevel;

  ok(
    'F1: easy pass does not touch strictMotionCompletionSatisfied (still false)',
    prog?.strictMotionCompletionSatisfied === false,
    `strict=${prog?.strictMotionCompletionSatisfied}`,
  );
  ok(
    'F2: planning evidence NOT strong when only easy path passed',
    planningLevel !== 'strong_evidence',
    `planningLevel=${planningLevel}`,
  );
  // strict completion machine phase is still strict-facing
  ok(
    'F3: strictCompletionMachinePhase reflects strict machine (not completed)',
    prog?.strictCompletionMachinePhase !== 'completed',
    `strictPhase=${prog?.strictCompletionMachinePhase}`,
  );
  ok(
    'F4: strictCompletionBlockedReason is non-null (strict never completed)',
    prog?.strictCompletionBlockedReason !== null,
    `strictBlocked=${prog?.strictCompletionBlockedReason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario G: Voice eligibility sanity — progressionPhase signals
// ---------------------------------------------------------------------------
console.log('\n[Scenario G] Voice eligibility — progressionPhase signals for hold cue');
{
  // G1: easy_building_hold 구간 — 4프레임(span=3*70=210ms) > 150ms → cue eligible
  const buildingFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 4 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')), // 210ms span
  ];
  const buildingResult = evaluateOverheadReachFromPoseFrames(buildingFrames);
  const buildingProg = buildingResult.debug?.overheadProgressionState;

  ok(
    // PR-CAM-16 의도적 변경: humane zone run이 rise+hold을 포함해 280ms+ → completed
    'G1: phase = completed (CAM-16: humane_low_rom passes via rise+hold span)',
    buildingProg?.progressionPhase === 'completed',
    `phase=${buildingProg?.progressionPhase}`,
  );
  ok(
    'G2: easyBestRunMs >= 150 (voice cue eligible)',
    (buildingProg?.easyBestRunMs ?? 0) >= 150,
    `easyBestRunMs=${buildingProg?.easyBestRunMs}`,
  );
  ok(
    'G3: progressionSatisfied = true (CAM-16: humane_low_rom passes)',
    buildingProg?.progressionSatisfied === true,
    `sat=${buildingProg?.progressionSatisfied}`,
  );

  // G4: completed → cue should not fire (progressionSatisfied=true suppresses)
  const completeFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')), // 630ms span > 520
  ];
  const completeResult = evaluateOverheadReachFromPoseFrames(completeFrames);
  const completeProg = completeResult.debug?.overheadProgressionState;

  ok(
    'G4: completed state → progressionSatisfied=true (hold cue suppressed at caller)',
    completeProg?.progressionSatisfied === true,
    `sat=${completeProg?.progressionSatisfied}`,
  );

  // G5: 1프레임(70ms) accidental touch — easyBestRunMs < 150 → cue not eligible
  const touchFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    makeFrame(520, 128, 'raise'),  // 단 1프레임
  ];
  const touchResult = evaluateOverheadReachFromPoseFrames(touchFrames);
  const touchProg = touchResult.debug?.overheadProgressionState;

  ok(
    'G5: 1-frame touch → easyBestRunMs < 150 (cue not eligible)',
    (touchProg?.easyBestRunMs ?? 0) < 150,
    `easyBestRunMs=${touchProg?.easyBestRunMs} phase=${touchProg?.progressionPhase}`,
  );

  // G6: near-success — 6프레임(span=5*70=350ms). remaining=520-350=170ms<=200ms → suppress
  const nearSuccessFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 6 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')), // 350ms span
  ];
  const nearSuccessResult = evaluateOverheadReachFromPoseFrames(nearSuccessFrames);
  const nearSuccessProg = nearSuccessResult.debug?.overheadProgressionState;

  // near-success는 progressionSatisfied=false이지만 easyBestRunMs >= 320 → remaining <= 200
  const nearSuccessBestRunMs = nearSuccessProg?.easyBestRunMs ?? 0;
  const EASY_REQ = 520;
  const nearSuccessRemaining = EASY_REQ - nearSuccessBestRunMs;
  const nearSuccessEligibleForCue = nearSuccessBestRunMs >= 150 && nearSuccessRemaining > 200;
  ok(
    'G6: near-success (easyBestRunMs ~ 350ms) → remaining <= 200 → NOT eligible for cue',
    !nearSuccessEligibleForCue,
    `bestRunMs=${nearSuccessBestRunMs} remaining=${nearSuccessRemaining}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario H: Regression — CAM-12 핵심 assertions 재확인
// ---------------------------------------------------------------------------
console.log('\n[Scenario H] Regression — CAM-12 core assertions');
{
  // H1: 128° + raise → easy pass 유지 (hm.completionSatisfied=true)
  const easyFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];
  const easyResult = evaluateOverheadReachFromPoseFrames(easyFrames);
  const easyHm = easyResult.debug?.highlightedMetrics;
  ok(
    'H1: 128° raise → hm.completionSatisfied=true (CAM-12 backward-compat)',
    easyHm?.completionSatisfied === true,
    `completionSatisfied=${easyHm?.completionSatisfied}`,
  );
  ok(
    'H2: hm.completionPath=easy',
    easyHm?.completionPath === 'easy',
    `completionPath=${easyHm?.completionPath}`,
  );
  ok(
    'H3: hm.peakCountAtEasyFloor = easyTopZoneFrameCount',
    easyHm?.peakCountAtEasyFloor === easyHm?.easyTopZoneFrameCount,
    `peakCountAtEasyFloor=${easyHm?.peakCountAtEasyFloor} easyTopZoneFrameCount=${easyHm?.easyTopZoneFrameCount}`,
  );
  ok(
    'H4: hm.strictMotionCompletionSatisfied=0 (128° strict false)',
    easyHm?.strictMotionCompletionSatisfied === 0 || easyHm?.strictMotionCompletionSatisfied === false,
    `strict=${easyHm?.strictMotionCompletionSatisfied}`,
  );

  // H5: strict path regression
  const strictFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 80 + i * 10, 'raise')),
    ...Array.from({ length: 20 }, (_, i) => makeFrame(520 + i * 70, 135, 'peak')),
  ];
  const strictResult = evaluateOverheadReachFromPoseFrames(strictFrames);
  const strictHm = strictResult.debug?.highlightedMetrics;
  ok(
    'H5: strict 135° dwell → hm.completionSatisfied=true (strict path)',
    strictHm?.completionSatisfied === true,
    `completionSatisfied=${strictHm?.completionSatisfied}`,
  );
  ok(
    'H6: strict path → hm.strictMotionCompletionSatisfied=1',
    strictHm?.strictMotionCompletionSatisfied === 1 || strictHm?.strictMotionCompletionSatisfied === true,
    `strict=${strictHm?.strictMotionCompletionSatisfied}`,
  );
}

// ---------------------------------------------------------------------------
// 최종 요약
// ---------------------------------------------------------------------------
console.log(`\n=== PR-CAM-13 smoke complete: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
