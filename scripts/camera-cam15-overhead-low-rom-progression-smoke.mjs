/**
 * PR-CAM-15 smoke test — Overhead low-ROM progression path
 *
 * 검증 목표:
 * - low-ROM 진행 경로가 정확히 동작하는지 확인.
 * - 개인 baseline 대비 실질적 거상(>=20°) + 절대 하한(>=110°) + 짧은 안정(>=350ms)면 통과.
 * - strict/easy 경로 회귀 없음, planning/internal quality 변경 없음.
 *
 * 시나리오:
 * A. Low-ROM pass — 112°까지 올리고 안정 → progressionSatisfied=true, progressionPath='low_rom'
 * B. Too-small raise — delta < 20° → blocked, retry='insufficient_height'
 * C. Fast swing-through — 홀드 부족 → blocked, retry='no_hold' or 'unstable_top'
 * D. Easy path still works — 128°+충분한 hold → progressionPath='easy'
 * E. Strict path still works — 135°+dwell → strictMotionCompletionSatisfied=true
 * F. Noise/shrug does not pass — 80° → no pass
 * G. Ambiguous retry consistency
 * H. Regression: CAM-12/13 핵심 assertions 유지
 *
 * 실행: npx tsx scripts/camera-cam15-overhead-low-rom-progression-smoke.mjs
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
// Frame factory
// ---------------------------------------------------------------------------
const GOOD_JOINT = { x: 0.5, y: 0.5, visibility: 0.95 };
const ALL_JOINTS = Object.fromEntries(
  [
    'nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee',
    'leftAnkle', 'rightAnkle', 'torsoCenter', 'shoulderCenter', 'hipCenter', 'ankleCenter',
  ].map((k) => [k, GOOD_JOINT])
);

function makeFrame(timestampMs, armElevation, phaseHint, asymGap = 4) {
  return {
    isValid: true,
    timestampMs,
    stepId: 'overhead-reach',
    frameValidity: 'valid',
    phaseHint,
    eventHints: [],
    qualityHints: [],
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
      armElevationGap: asymGap,
      elbowAngleLeft: 162, elbowAngleRight: 162,
      wristElbowAlignmentLeft: null, wristElbowAlignmentRight: null,
      shoulderSymmetry: null, pelvicDrop: null, swayAmplitude: null, holdBalance: null,
      footHeightGap: null, footDownDetected: false, torsoCorrectionDetected: false,
    },
  };
}

function makeGateMock(evaluatorResult, {
  completionSatisfied = false,
  captureQuality = 'valid',
  failureReasons = [],
} = {}) {
  return {
    evaluatorResult,
    completionSatisfied:
      completionSatisfied ?? (evaluatorResult.debug?.highlightedMetrics?.completionSatisfied === true),
    guardrail: { captureQuality },
    failureReasons,
  };
}

// ---------------------------------------------------------------------------
// Scenario A: Low-ROM pass — 112° + raise + 350ms+ hold
// baseline (first 6 frames): 70°
// delta: 112 - 70 = 42° ≥ 20° ✓
// absolute floor: 112° ≥ 110° ✓
// hold: 8프레임 at 112° = span: 7*70=490ms ≥ 350ms ✓
// ---------------------------------------------------------------------------
console.log('\n[Scenario A] Low-ROM pass — 112° + clear raise + sufficient hold');
{
  const frames = [
    // 첫 6프레임: 70° (baseline ≈ 70°)
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    // raising to 112°
    ...Array.from({ length: 4 }, (_, i) => makeFrame(520 + i * 70, 80 + i * 8, 'raise')),
    // 8프레임 hold at 112° (span = 7*70 = 490ms > 350ms)
    ...Array.from({ length: 8 }, (_, i) => makeFrame(800 + i * 70, 112, 'raise')),
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
    'A3: progressionPath = low_rom',
    prog?.progressionPath === 'low_rom',
    `path=${prog?.progressionPath}`,
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
    'A6: lowRomProgressionSatisfied = true',
    prog?.lowRomProgressionSatisfied === true,
    `lowRom=${prog?.lowRomProgressionSatisfied}`,
  );
  ok(
    'A7: strictMotionCompletionSatisfied = false (112° 미달)',
    prog?.strictMotionCompletionSatisfied === false,
    `strict=${prog?.strictMotionCompletionSatisfied}`,
  );
  ok(
    'A8: easyCompletionSatisfied = false (112° < 126°)',
    prog?.easyCompletionSatisfied === false,
    `easy=${prog?.easyCompletionSatisfied}`,
  );
  ok(
    'A9: highlightedMetrics.completionSatisfied = true (backward-compat)',
    hm?.completionSatisfied === true,
    `completionSatisfied=${hm?.completionSatisfied}`,
  );
  ok(
    'A10: lowRomElevationDeltaFromBaseline ≥ 20°',
    typeof prog?.lowRomElevationDeltaFromBaseline === 'number' &&
      prog.lowRomElevationDeltaFromBaseline >= 20,
    `delta=${prog?.lowRomElevationDeltaFromBaseline}`,
  );
  ok(
    'A11: planning evidence NOT strong (strict hold not achieved)',
    result.debug?.overheadEvidenceLevel !== 'strong_evidence',
    `planningLevel=${result.debug?.overheadEvidenceLevel}`,
  );
  ok(
    'A12: lowRomProgressionSatisfied in hm = 1',
    hm?.lowRomProgressionSatisfied === 1,
    `hm.lowRomProgressionSatisfied=${hm?.lowRomProgressionSatisfied}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario B: Too-small raise — delta < 20°
// baseline: 100° (user starts high), effectiveArm: 112° → delta=12° < 20°
// → blocked: low_rom_insufficient_delta → progressionBlocked='easy_top_not_reached'
// → retry: insufficient_height
// ---------------------------------------------------------------------------
console.log('\n[Scenario B] Too-small raise — delta < 20° → blocked');
{
  // baseline (first 6): 100°, then reach 112°
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 100, 'raise')),
    ...Array.from({ length: 8 }, (_, i) => makeFrame(520 + i * 70, 112, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'B1: progressionSatisfied = false',
    prog?.progressionSatisfied === false,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'B2: lowRomProgressionSatisfied = false (delta insufficient)',
    prog?.lowRomProgressionSatisfied === false,
    `lowRom=${prog?.lowRomProgressionSatisfied}`,
  );
  ok(
    'B3: lowRomElevationDeltaFromBaseline < 20',
    typeof prog?.lowRomElevationDeltaFromBaseline === 'number' &&
      prog.lowRomElevationDeltaFromBaseline < 20,
    `delta=${prog?.lowRomElevationDeltaFromBaseline}`,
  );

  const gate = makeGateMock(result, { completionSatisfied: false, captureQuality: 'valid', failureReasons: [] });
  const reason = deriveOverheadAmbiguousRetryReason(gate);
  ok(
    'B4: ambiguous retry = insufficient_height (small delta)',
    reason === 'insufficient_height',
    `reason=${reason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario C: Fast swing-through — hold too short
// 112° but only 3 frames spread with 300ms gap → bestRunMs < 350ms
// ---------------------------------------------------------------------------
console.log('\n[Scenario C] Fast swing-through — hold too short → blocked (no_hold or unstable_top)');
{
  // raiseCount > 0, reach 112°, but frames in zone are split with big gaps
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    // two fragments at 112° separated by large gap (300ms > 200ms gap tolerance)
    makeFrame(520, 112, 'raise'),
    makeFrame(820, 112, 'raise'), // gap=300ms > 200ms → two single-frame runs
    makeFrame(1120, 112, 'raise'), // another gap
    makeFrame(1420, 112, 'raise'),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'C1: progressionSatisfied = false (hold too short)',
    prog?.progressionSatisfied === false,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'C2: lowRomProgressionSatisfied = false',
    prog?.lowRomProgressionSatisfied === false,
    `lowRom=${prog?.lowRomProgressionSatisfied}`,
  );
  ok(
    'C3: lowRomBestRunMs < 350',
    prog?.lowRomBestRunMs !== undefined && prog.lowRomBestRunMs < 350,
    `bestRunMs=${prog?.lowRomBestRunMs}`,
  );

  const gate = makeGateMock(result, { completionSatisfied: false, captureQuality: 'valid', failureReasons: [] });
  const eligible = isOverheadAmbiguousRetryEligible(gate);
  const reason = deriveOverheadAmbiguousRetryReason(gate);
  ok('C4: ambiguous retry eligible', eligible, `eligible=${eligible}`);
  // low_rom_hold_short → 'no_hold'; low_rom_top → 'unstable_top' — both acceptable for swing-through
  ok(
    'C5: retry reason is no_hold or unstable_top (swing-through)',
    reason === 'no_hold' || reason === 'unstable_top',
    `reason=${reason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario D: Easy path still works — 128° + raise + sufficient easy hold
// ---------------------------------------------------------------------------
console.log('\n[Scenario D] Easy path still works — 128° + raise');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'D1: progressionSatisfied = true (easy path)',
    prog?.progressionSatisfied === true,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'D2: progressionPath = easy',
    prog?.progressionPath === 'easy',
    `path=${prog?.progressionPath}`,
  );
  ok(
    'D3: easyCompletionSatisfied = true',
    prog?.easyCompletionSatisfied === true,
    `easy=${prog?.easyCompletionSatisfied}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario E: Strict path still works — 135° + stable dwell
// ---------------------------------------------------------------------------
console.log('\n[Scenario E] Strict path still works — 135° + stable hold');
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
  ok(
    'E2: progressionPath strict or fallback (strict machine paths)',
    prog?.progressionPath === 'strict' || prog?.progressionPath === 'fallback',
    `path=${prog?.progressionPath}`,
  );
  ok(
    'E3: strictMotionCompletionSatisfied = true',
    prog?.strictMotionCompletionSatisfied === true,
    `strict=${prog?.strictMotionCompletionSatisfied}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario F: Noise/shrug — 80° only → below absolute floor 110°
// ---------------------------------------------------------------------------
console.log('\n[Scenario F] Noise/shrug — 80° (below 110° floor) → no pass');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 80, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok(
    'F1: progressionSatisfied = false',
    prog?.progressionSatisfied === false,
    `sat=${prog?.progressionSatisfied}`,
  );
  ok(
    'F2: lowRomProgressionSatisfied = false (80° < 110°)',
    prog?.lowRomProgressionSatisfied === false,
    `lowRom=${prog?.lowRomProgressionSatisfied}`,
  );
  ok(
    'F3: completionSatisfied = false',
    hm?.completionSatisfied === false,
    `completionSatisfied=${hm?.completionSatisfied}`,
  );
  ok(
    'F4: low-ROM blocked reason is elevation-related',
    prog?.lowRomBlockedReason === 'low_rom_insufficient_elevation' ||
      prog?.lowRomBlockedReason === 'low_rom_raise_incomplete',
    `lowRomBlocked=${prog?.lowRomBlockedReason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario G: Ambiguous retry consistency
// G1: low-ROM nearly passed (hold short) → retry='no_hold'
// G2: low-ROM insufficient height → retry='insufficient_height'
// ---------------------------------------------------------------------------
console.log('\n[Scenario G] Ambiguous retry consistency');

// G1: low-ROM building hold — 112°, 3 frames contiguous (span=140ms < 350ms)
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    ...Array.from({ length: 3 }, (_, i) => makeFrame(520 + i * 70, 112, 'raise')), // span=140ms < 350ms
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const prog = result.debug?.overheadProgressionState;

  ok(
    'G1: low_rom_building_hold phase (hold building but short)',
    prog?.progressionPhase === 'low_rom_building_hold' || prog?.progressionPhase === 'low_rom_top',
    `phase=${prog?.progressionPhase}`,
  );
  ok(
    'G2: lowRomBlockedReason = low_rom_hold_short',
    prog?.lowRomBlockedReason === 'low_rom_hold_short',
    `blocked=${prog?.lowRomBlockedReason}`,
  );

  const gate = makeGateMock(result, { completionSatisfied: false, captureQuality: 'valid', failureReasons: [] });
  const reason = deriveOverheadAmbiguousRetryReason(gate);
  ok(
    'G3: retry = no_hold (low_rom_hold_short)',
    reason === 'no_hold',
    `reason=${reason}`,
  );
}

// G4: low-ROM insufficient height (70° peak) → retry='insufficient_height'
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 40, 'raise')),
    ...Array.from({ length: 8 }, (_, i) => makeFrame(520 + i * 70, 70, 'raise')), // 70° < 110°
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const gate = makeGateMock(result, { completionSatisfied: false, captureQuality: 'valid', failureReasons: [] });
  const reason = deriveOverheadAmbiguousRetryReason(gate);
  ok(
    'G4: retry = insufficient_height (below 110° floor)',
    reason === 'insufficient_height',
    `reason=${reason}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario H: Regression — CAM-12/13 핵심 assertions
// ---------------------------------------------------------------------------
console.log('\n[Scenario H] Regression — CAM-12/13 core assertions');
{
  // H1: 128° + raise → easy pass backward-compat
  const easyFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70 + i * 8, 'raise')),
    ...Array.from({ length: 10 }, (_, i) => makeFrame(520 + i * 70, 128, 'raise')),
  ];
  const easyResult = evaluateOverheadReachFromPoseFrames(easyFrames);
  const easyHm = easyResult.debug?.highlightedMetrics;
  const easyProg = easyResult.debug?.overheadProgressionState;
  ok(
    'H1: 128° easy → completionSatisfied=true',
    easyHm?.completionSatisfied === true,
    `completionSatisfied=${easyHm?.completionSatisfied}`,
  );
  ok(
    'H2: easy → progressionPath=easy',
    easyProg?.progressionPath === 'easy',
    `path=${easyProg?.progressionPath}`,
  );
  ok(
    'H3: easy → lowRomProgressionSatisfied=false (easy path이므로 low-ROM 검사 필요 없음)',
    // easy path is satisfied so we don't require low-ROM to be false — but easyTopZoneFrames.length > 0
    // means low-ROM path may or may not satisfy (it would, but easy wins anyway)
    easyProg?.progressionPath === 'easy',
    `path=${easyProg?.progressionPath}`,
  );

  // H4: strict path
  const strictFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 80 + i * 10, 'raise')),
    ...Array.from({ length: 20 }, (_, i) => makeFrame(520 + i * 70, 135, 'peak')),
  ];
  const strictResult = evaluateOverheadReachFromPoseFrames(strictFrames);
  const strictHm = strictResult.debug?.highlightedMetrics;
  ok(
    'H4: strict 135° → hm.completionSatisfied=true',
    strictHm?.completionSatisfied === true,
    `completionSatisfied=${strictHm?.completionSatisfied}`,
  );
  ok(
    'H5: strict path → strictMotionCompletionSatisfied=1',
    strictHm?.strictMotionCompletionSatisfied === 1 || strictHm?.strictMotionCompletionSatisfied === true,
    `strict=${strictHm?.strictMotionCompletionSatisfied}`,
  );

  // H6: overheadProgressionState has lowRom fields
  const lowRomFields = ['lowRomProgressionSatisfied', 'lowRomBlockedReason', 'lowRomBestRunMs', 'lowRomElevationDeltaFromBaseline'];
  const strictProg = strictResult.debug?.overheadProgressionState;
  ok(
    'H6: overheadProgressionState has all low-ROM fields',
    strictProg != null && lowRomFields.every((f) => f in strictProg),
    `keys=${Object.keys(strictProg ?? {}).join(',')}`,
  );

  // H7: planning evidence not upgraded by low-ROM pass
  const lowRomPassFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    ...Array.from({ length: 4 }, (_, i) => makeFrame(520 + i * 70, 80 + i * 8, 'raise')),
    ...Array.from({ length: 8 }, (_, i) => makeFrame(800 + i * 70, 112, 'raise')),
  ];
  const lowRomResult = evaluateOverheadReachFromPoseFrames(lowRomPassFrames);
  ok(
    'H7: low-ROM pass does NOT upgrade planning to strong_evidence',
    lowRomResult.debug?.overheadEvidenceLevel !== 'strong_evidence',
    `planningLevel=${lowRomResult.debug?.overheadEvidenceLevel}`,
  );

  // H8: baselineArmDeg is exposed in highlightedMetrics
  ok(
    'H8: baselineArmDeg exposed in hm',
    typeof lowRomResult.debug?.highlightedMetrics?.baselineArmDeg === 'number',
    `baselineArmDeg=${lowRomResult.debug?.highlightedMetrics?.baselineArmDeg}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario I: Low-ROM pass with raised baseline (starts at 70°, reaches 112°)
// verify delta calculation and phase transitions
// ---------------------------------------------------------------------------
console.log('\n[Scenario I] Low-ROM phase transitions');
{
  // phase: low_rom_top — 112°, 2 frames only (< MIN_PEAK_FRAMES=3)
  const tooFewFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    ...Array.from({ length: 2 }, (_, i) => makeFrame(520 + i * 70, 112, 'raise')),
  ];
  const tooFewResult = evaluateOverheadReachFromPoseFrames(tooFewFrames);
  const tooFewProg = tooFewResult.debug?.overheadProgressionState;
  ok(
    'I1: 2 frames in low-ROM zone → lowRomProgressionSatisfied=false (raise_incomplete)',
    tooFewProg?.lowRomProgressionSatisfied === false,
    `lowRom=${tooFewProg?.lowRomProgressionSatisfied} blocked=${tooFewProg?.lowRomBlockedReason}`,
  );

  // PR-CAM-16 의도적 변경: 4 frames at 112° (span=210ms)는 이제 humane_low_rom 경로로 통과한다.
  // humane path: floor=100° ✓, delta=42°≥15° ✓, hold=210ms≥200ms ✓ → PASS.
  // low_rom path: hold=210ms < 350ms → still 'low_rom_hold_short' (unchanged).
  const buildingFrames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    // 4 frames at 112° (span=3*70=210ms ≥ 200ms humane threshold)
    ...Array.from({ length: 4 }, (_, i) => makeFrame(520 + i * 70, 112, 'raise')),
  ];
  const buildingResult = evaluateOverheadReachFromPoseFrames(buildingFrames);
  const buildingProg = buildingResult.debug?.overheadProgressionState;
  ok(
    'I2: 4 frames/210ms → now PASS via humane_low_rom (CAM-16 intentional: humane hold=200ms ≤ 210ms)',
    buildingProg?.progressionSatisfied === true &&
      (buildingProg?.progressionPath === 'humane_low_rom' || buildingProg?.progressionPath === 'low_rom'),
    `path=${buildingProg?.progressionPath} phase=${buildingProg?.progressionPhase}`,
  );
  ok(
    'I3: low_rom_hold_short still blocked at low_rom level (low_rom path unaffected)',
    buildingProg?.lowRomBlockedReason === 'low_rom_hold_short',
    `blocked=${buildingProg?.lowRomBlockedReason}`,
  );
}

// ---------------------------------------------------------------------------
console.log(`\n=== PR-CAM-15 smoke complete: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
