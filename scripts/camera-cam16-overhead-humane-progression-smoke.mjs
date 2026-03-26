/**
 * PR-CAM-16 smoke test — Overhead humane low-ROM progression path
 *
 * 검증 목표:
 * - humane_low_rom 경로: 절대 하한 100°, baseline 대비 15°+ 거상, 200ms+ 안정이면 통과.
 * - Lower-envelope baseline (min of first 16 frames): 부분 거상 상태로 시작해도 robust.
 * - strict/easy/low_rom 경로 회귀 없음, planning/internal quality 변경 없음.
 *
 * 시나리오:
 * A. Humane low-ROM pass — 103° (easy/low-ROM floor 미달) + 실질적 거상 + 안정
 * B. Started-partially-raised baseline test — 80° 시작, 102° 도달 → baseline robustness
 * C. Too-small delta blocked — delta < 15° → insufficient_height
 * D. Fast swing-through blocked — 2프레임만(span=70ms) → no_hold or humane_top
 * E. Existing low_rom still works — 112° 도달
 * F. Existing easy still works — 128°+ hold
 * G. Strict path still works — 135°+ dwell
 * H. Noise/shrug does not pass — 80° (< 100° floor) → no pass
 * I. Voice eligibility sanity — humane_building_hold 구간 큐 판단
 * J. Regression safety — CAM-11A / 11B / 12 / 13 / 15 핵심 assertion
 *
 * 실행: npx tsx scripts/camera-cam16-overhead-humane-progression-smoke.mjs
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
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
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
  completionSatisfied = null,
  captureQuality = 'valid',
  failureReasons = [],
} = {}) {
  const cs = completionSatisfied ?? (evaluatorResult.debug?.highlightedMetrics?.completionSatisfied === true);
  return {
    evaluatorResult,
    completionSatisfied: cs,
    guardrail: { captureQuality },
    failureReasons,
  };
}

// ---------------------------------------------------------------------------
// Scenario A: Humane low-ROM pass
//
// humane baseline: min of first 16 frames = 60° (lower-envelope)
// effectiveArmDeg = 103°
// delta = 103 - 60 = 43° ≥ 15° ✓
// 103° ≥ 100° (humane floor) ✓, 103° < 110° (low_rom floor) → low_rom fails ✓
// 4프레임 at 103°: span = 3*70 = 210ms ≥ 200ms ✓ → PASS
// ---------------------------------------------------------------------------
console.log('\n[Scenario A] Humane low-ROM pass — 103° (below low_rom floor), real raise, 210ms hold');
{
  const frames = [
    // 첫 16프레임: 60° (lower-envelope baseline = 60°)
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    // raise 이벤트
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 4프레임 at 103°: span = 3*70 = 210ms ≥ 200ms
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + 17 * 70 + i * 70, 103, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const hm = result.debug?.highlightedMetrics;
  const ps = result.debug?.overheadProgressionState;

  ok('A1: completionSatisfied=true', hm?.completionSatisfied === true, hm?.completionSatisfied);
  ok('A2: progressionPath=humane_low_rom', ps?.progressionPath === 'humane_low_rom', ps?.progressionPath);
  ok('A3: strictMotionCompletionSatisfied=false', ps?.strictMotionCompletionSatisfied === false, ps?.strictMotionCompletionSatisfied);
  ok('A4: easyCompletionSatisfied=false', ps?.easyCompletionSatisfied === false, ps?.easyCompletionSatisfied);
  ok('A5: lowRomProgressionSatisfied=false (103° < 110°)', ps?.lowRomProgressionSatisfied === false, ps?.lowRomProgressionSatisfied);
  ok('A6: humaneLowRomProgressionSatisfied=true', ps?.humaneLowRomProgressionSatisfied === true, ps?.humaneLowRomProgressionSatisfied);
  ok('A7: progressionPhase=completed', ps?.progressionPhase === 'completed', ps?.progressionPhase);
  ok('A8: progressionBlockedReason=null', ps?.progressionBlockedReason === null, ps?.progressionBlockedReason);
  ok('A9: humaneBaselineElevation≈60 (lower-envelope)', Math.abs((ps?.humaneLowRomBaselineElevation ?? 999) - 60) < 5, ps?.humaneLowRomBaselineElevation);
  ok('A10: humaneLowRomElevationDeltaFromBaseline≥15°', (ps?.humaneLowRomElevationDeltaFromBaseline ?? 0) >= 15, ps?.humaneLowRomElevationDeltaFromBaseline);
  ok('A11: humaneLowRomBestRunMs≥200', (ps?.humaneLowRomBestRunMs ?? 0) >= 200, ps?.humaneLowRomBestRunMs);
}

// ---------------------------------------------------------------------------
// Scenario B: Started-partially-raised baseline test
//
// 사용자가 80° 상태로 시작 (팔이 이미 약간 올라있음).
// CAM-15의 first-6-mean baseline이라면 baseline ≈ 80° → 102°-80°=22° ≥ 20° (borderline).
// CAM-16 humane baseline: min of first 16 frames = 80° → delta = 102-80 = 22° ≥ 15° ✓
// 102° ≥ 100° ✓, 102° < 110° → low_rom fails.
// 4프레임 at 102°: span=210ms ≥ 200ms ✓ → PASS via humane_low_rom
// ---------------------------------------------------------------------------
console.log('\n[Scenario B] Started-partially-raised baseline — 80° start, 102° peak');
{
  const frames = [
    // 첫 16프레임: 80° (user starts arms partially raised)
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 80, 'raise')),
    // raise to 102°
    makeFrame(100 + 16 * 70, 90, 'raise'),
    // 4프레임 at 102°: span=210ms
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + 17 * 70 + i * 70, 102, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('B1: completionSatisfied=true', hm?.completionSatisfied === true, hm?.completionSatisfied);
  ok('B2: progressionPath=humane_low_rom (not blocked by partial-raise start)', ps?.progressionPath === 'humane_low_rom', ps?.progressionPath);
  ok('B3: humaneLowRomProgressionSatisfied=true', ps?.humaneLowRomProgressionSatisfied === true, ps?.humaneLowRomProgressionSatisfied);
  ok('B4: humaneBaselineElevation≈80 (lower-envelope of partial start)', Math.abs((ps?.humaneLowRomBaselineElevation ?? 999) - 80) < 5, ps?.humaneLowRomBaselineElevation);
  ok('B5: delta≥15° from lower-envelope baseline', (ps?.humaneLowRomElevationDeltaFromBaseline ?? 0) >= 15, ps?.humaneLowRomElevationDeltaFromBaseline);
}

// ---------------------------------------------------------------------------
// Scenario C: Too-small delta blocked
//
// 사용자가 90° 시작, 100°까지만 올림 → delta = 10° < 15° → blocked
// ---------------------------------------------------------------------------
console.log('\n[Scenario C] Too-small delta blocked — 90° baseline, 100° peak (delta=10° < 15°)');
{
  const frames = [
    // 첫 16프레임: 90° (상대적으로 높은 baseline)
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 90, 'raise')),
    // raise to exactly 100° (just at the floor)
    makeFrame(100 + 16 * 70, 95, 'raise'),
    // 4프레임 at 100°
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + 17 * 70 + i * 70, 100, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('C1: completionSatisfied=false (delta too small)', hm?.completionSatisfied !== true, hm?.completionSatisfied);
  ok('C2: humaneLowRomProgressionSatisfied=false', ps?.humaneLowRomProgressionSatisfied === false, ps?.humaneLowRomProgressionSatisfied);
  ok('C3: humane blocked by insufficient_delta', ps?.humaneLowRomBlockedReason === 'humane_insufficient_delta', ps?.humaneLowRomBlockedReason);

  const gate = makeGateMock(result, { completionSatisfied: false, failureReasons: [] });
  const retry = deriveOverheadAmbiguousRetryReason(gate);
  ok('C4: retry=insufficient_height (maps from easy_top_not_reached)', retry === 'insufficient_height', retry);
}

// ---------------------------------------------------------------------------
// Scenario D: Fast swing-through blocked
//
// 사용자가 103°에 2프레임(span=70ms) 진입 후 내려옴 → hold < 200ms → humane_hold_short
// phase = humane_building_hold (blocked_reason = humane_hold_short AND bestRunMs > 0)
// retry = no_hold
// ---------------------------------------------------------------------------
console.log('\n[Scenario D] Fast swing-through blocked — 2 frames at 103° (span=70ms < 200ms)');
{
  const frames = [
    // 첫 16프레임: 60°
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    // raise event
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 2프레임만 at 103° (span = 70ms < 200ms)
    makeFrame(100 + 17 * 70, 103, 'raise'),
    makeFrame(100 + 18 * 70, 103, 'raise'),
    // drop
    makeFrame(100 + 19 * 70, 75, 'raise'),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('D1: completionSatisfied=false', hm?.completionSatisfied !== true, hm?.completionSatisfied);
  ok('D2: humaneLowRomProgressionSatisfied=false', ps?.humaneLowRomProgressionSatisfied === false, ps?.humaneLowRomProgressionSatisfied);
  ok('D3: humane blocked by humane_hold_short', ps?.humaneLowRomBlockedReason === 'humane_hold_short', ps?.humaneLowRomBlockedReason);
  ok('D4: progressionBlockedReason=humane_hold_short', ps?.progressionBlockedReason === 'humane_hold_short', ps?.progressionBlockedReason);
  ok('D5: progressionPhase=humane_building_hold (some buildup)', ps?.progressionPhase === 'humane_building_hold', ps?.progressionPhase);

  const gate = makeGateMock(result, { completionSatisfied: false, failureReasons: [] });
  const retry = deriveOverheadAmbiguousRetryReason(gate);
  ok('D6: retry=no_hold', retry === 'no_hold', retry);
}

// ---------------------------------------------------------------------------
// Scenario E: Existing low_rom still works
//
// CAM-15의 low-ROM pass 케이스: 112° + 350ms+ 안정
// → progressionPath = 'low_rom' (low_rom은 humane보다 우선)
// ---------------------------------------------------------------------------
console.log('\n[Scenario E] Existing low_rom still works — 112° + 490ms hold');
{
  const frames = [
    // 첫 6프레임: 70° (low-ROM baseline ≈ 70°)
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    // raise to 112°
    ...Array.from({ length: 4 }, (_, i) => makeFrame(520 + i * 70, 80 + i * 8, 'raise')),
    // 8프레임 at 112°: span = 7*70 = 490ms ≥ 350ms ✓
    ...Array.from({ length: 8 }, (_, i) => makeFrame(800 + i * 70, 112, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('E1: completionSatisfied=true', hm?.completionSatisfied === true, hm?.completionSatisfied);
  ok('E2: progressionPath=low_rom', ps?.progressionPath === 'low_rom', ps?.progressionPath);
  ok('E3: lowRomProgressionSatisfied=true', ps?.lowRomProgressionSatisfied === true, ps?.lowRomProgressionSatisfied);
  ok('E4: strictMotionCompletionSatisfied=false', ps?.strictMotionCompletionSatisfied === false, ps?.strictMotionCompletionSatisfied);
}

// ---------------------------------------------------------------------------
// Scenario F: Existing easy still works
//
// 128° + easyBestRunMs ≥ 520ms → progressionPath = 'easy'
// ---------------------------------------------------------------------------
console.log('\n[Scenario F] Existing easy still works — 128° + sufficient hold');
{
  const frames = [
    ...Array.from({ length: 10 }, (_, i) => makeFrame(100 + i * 70, 128, 'raise')),
    // 10프레임 at 128°: span = 9*70 = 630ms ≥ 520ms ✓
    ...Array.from({ length: 10 }, (_, i) => makeFrame(800 + i * 70, 128, 'peak')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('F1: completionSatisfied=true', hm?.completionSatisfied === true, hm?.completionSatisfied);
  ok('F2: progressionPath=easy (or higher)', ['easy', 'strict', 'fallback'].includes(ps?.progressionPath ?? ''), ps?.progressionPath);
  ok('F3: easyCompletionSatisfied=true', ps?.easyCompletionSatisfied === true, ps?.easyCompletionSatisfied);
}

// ---------------------------------------------------------------------------
// Scenario G: Strict path still works
//
// 135° + stable dwell → strictMotionCompletionSatisfied=true
// ---------------------------------------------------------------------------
console.log('\n[Scenario G] Strict path still works — 135° + stable dwell');
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 120, 'raise')),
    ...Array.from({ length: 20 }, (_, i) => makeFrame(520 + i * 70, 135, 'peak')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('G1: completionSatisfied=true', hm?.completionSatisfied === true, hm?.completionSatisfied);
  ok('G2: strictMotionCompletionSatisfied=true', ps?.strictMotionCompletionSatisfied === true, ps?.strictMotionCompletionSatisfied);
  ok('G3: progressionPath=strict or fallback', ['strict', 'fallback'].includes(ps?.progressionPath ?? ''), ps?.progressionPath);
}

// ---------------------------------------------------------------------------
// Scenario H: Noise / shrug does not pass
//
// 80° peak — 100° (humane floor) 미달 → 모든 경로 차단
// ---------------------------------------------------------------------------
console.log('\n[Scenario H] Noise/shrug does not pass — 80° peak (< 100° humane floor)');
{
  const frames = [
    ...Array.from({ length: 10 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    ...Array.from({ length: 8 }, (_, i) => makeFrame(800 + i * 70, 80, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('H1: completionSatisfied=false', hm?.completionSatisfied !== true, hm?.completionSatisfied);
  ok('H2: humaneLowRomProgressionSatisfied=false', ps?.humaneLowRomProgressionSatisfied === false, ps?.humaneLowRomProgressionSatisfied);
  ok('H3: lowRomProgressionSatisfied=false', ps?.lowRomProgressionSatisfied === false, ps?.lowRomProgressionSatisfied);
  ok('H4: easyCompletionSatisfied=false', ps?.easyCompletionSatisfied === false, ps?.easyCompletionSatisfied);
  ok('H5: progressionBlockedReason=easy_top_not_reached', ps?.progressionBlockedReason === 'easy_top_not_reached', ps?.progressionBlockedReason);
}

// ---------------------------------------------------------------------------
// Scenario I: Voice eligibility sanity
//
// I-1: humane_building_hold phase, bestRunMs=140ms ≥ 100ms CUE_MIN,
//      remaining=60ms > 50ms CUE_SUPPRESS → voice cue eligible (진행상태 확인)
// I-2: 1-frame touch (peakCount=1 < 2) → phase=humane_top (not building_hold) → no cue
// I-3: Near-success suppress: span=160ms, remaining=40ms ≤ 50ms → suppress
// I-4: Already complete → progressionSatisfied=true → no hold cue needed
// ---------------------------------------------------------------------------
console.log('\n[Scenario I] Voice eligibility sanity');

// I-1: 3프레임 at 103° (span=140ms) → humane_building_hold, bestRunMs=140ms
{
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 3프레임 at 103°: span = 2*70 = 140ms
    makeFrame(100 + 17 * 70, 103, 'raise'),
    makeFrame(100 + 18 * 70, 103, 'raise'),
    makeFrame(100 + 19 * 70, 103, 'raise'),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;

  ok('I-1a: progressionPhase=humane_building_hold', ps?.progressionPhase === 'humane_building_hold', ps?.progressionPhase);
  ok('I-1b: humaneLowRomBestRunMs≥100ms (CUE_MIN eligible)', (ps?.humaneLowRomBestRunMs ?? 0) >= 100, ps?.humaneLowRomBestRunMs);
  // remaining = 200 - bestRunMs = 200 - 140 = 60ms > 50ms CUE_SUPPRESS → eligible
  ok('I-1c: remaining>50ms CUE_SUPPRESS (cue would play)', (200 - (ps?.humaneLowRomBestRunMs ?? 200)) > 50, ps?.humaneLowRomBestRunMs);
  ok('I-1d: progressionSatisfied=false (not complete yet)', ps?.progressionSatisfied === false, ps?.progressionSatisfied);
}

// I-2: 1-frame touch → phase=humane_top (NOT building_hold → no cue logic triggered)
{
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 1프레임만 at 103° (peakCount=1 < 2 → raise_incomplete → not building_hold)
    makeFrame(100 + 17 * 70, 103, 'raise'),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;

  ok('I-2a: 1-frame touch → phase=humane_top (not humane_building_hold)', ps?.progressionPhase === 'humane_top', ps?.progressionPhase);
  ok('I-2b: humaneLowRomBlockedReason=humane_raise_incomplete (not hold_short)', ps?.humaneLowRomBlockedReason === 'humane_raise_incomplete', ps?.humaneLowRomBlockedReason);
}

// I-3: Near-success suppress — 3프레임 at 80ms apart → span=160ms, remaining=40ms ≤ 50ms
{
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 3프레임 at 80ms cadence: span=160ms
    makeFrame(2000, 103, 'raise'),
    makeFrame(2080, 103, 'raise'),
    makeFrame(2160, 103, 'raise'),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;

  ok('I-3a: phase=humane_building_hold (building hold)', ps?.progressionPhase === 'humane_building_hold', ps?.progressionPhase);
  ok('I-3b: bestRunMs≥150ms (near success)', (ps?.humaneLowRomBestRunMs ?? 0) >= 150, ps?.humaneLowRomBestRunMs);
  // remaining = 200 - bestRunMs ≤ 50ms CUE_SUPPRESS → suppress
  ok('I-3c: remaining≤50ms (suppress cue near success)', (200 - (ps?.humaneLowRomBestRunMs ?? 0)) <= 50, ps?.humaneLowRomBestRunMs);
}

// I-4: Already complete → progressionSatisfied=true → phase=completed
{
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 4프레임 at 103°: span=210ms ≥ 200ms → complete
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + 17 * 70 + i * 70, 103, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;

  ok('I-4a: complete → phase=completed', ps?.progressionPhase === 'completed', ps?.progressionPhase);
  ok('I-4b: complete → progressionSatisfied=true', ps?.progressionSatisfied === true, ps?.progressionSatisfied);
}

// ---------------------------------------------------------------------------
// Scenario J: Regression safety
//
// J-1: CAM-15 low_rom path 회귀 없음 (112°)
// J-2: CAM-11B easy path 회귀 없음 (128°+)
// J-3: strict planning/internal quality는 humane pass로 강화되지 않음
// J-4: humane pass에서 progressionPath 필드 타입이 올바름
// J-5: ambiguous retry에서 humane zone evidence 인정
// ---------------------------------------------------------------------------
console.log('\n[Scenario J] Regression safety');

// J-1: CAM-15 low_rom 회귀
{
  const frames = [
    ...Array.from({ length: 6 }, (_, i) => makeFrame(100 + i * 70, 70, 'raise')),
    ...Array.from({ length: 4 }, (_, i) => makeFrame(520 + i * 70, 80 + i * 8, 'raise')),
    ...Array.from({ length: 8 }, (_, i) => makeFrame(800 + i * 70, 112, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('J-1: CAM-15 low_rom 회귀 없음 — 112° → low_rom pass', hm?.completionSatisfied === true && ps?.progressionPath === 'low_rom', ps?.progressionPath);
}

// J-2: CAM-11B easy path 회귀
{
  const frames = [
    ...Array.from({ length: 8 }, (_, i) => makeFrame(100 + i * 70, 100, 'raise')),
    ...Array.from({ length: 12 }, (_, i) => makeFrame(660 + i * 70, 128, 'peak')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;
  const hm = result.debug?.highlightedMetrics;

  ok('J-2: CAM-11B easy 회귀 없음 — 128°+ → easy pass', hm?.completionSatisfied === true && ['easy', 'strict', 'fallback'].includes(ps?.progressionPath ?? ''), ps?.progressionPath);
}

// J-3: humane pass → planning/internal quality 업그레이드 없음
{
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + 17 * 70 + i * 70, 103, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const iQ = result.debug?.overheadInternalQuality;
  const planning = result.debug?.overheadEvidenceLevel;

  // humane pass에서는 planning level이 'good'이 아님 (103° < 132° strict threshold)
  ok('J-3a: humane pass → planning NOT forced to good', planning !== 'good', planning);
  // internal quality tier는 strict 기준이므로 excellent/good이 아님
  ok('J-3b: humane pass → internalQuality qualityTier not excellent/good', iQ?.qualityTier !== 'excellent' && iQ?.qualityTier !== 'good', iQ?.qualityTier);
}

// J-4: progressionPath type 정합성
{
  const validPaths = new Set(['strict', 'fallback', 'easy', 'low_rom', 'humane_low_rom', 'none']);
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    ...Array.from({ length: 4 }, (_, i) => makeFrame(100 + 17 * 70 + i * 70, 103, 'raise')),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const ps = result.debug?.overheadProgressionState;

  ok('J-4: progressionPath value is valid union member', validPaths.has(ps?.progressionPath ?? ''), ps?.progressionPath);
}

// J-5: ambiguous retry에서 humane zone frame evidence 인정
{
  // raiseCount > 0, humaneZoneFrames > 0 → isEligible = true (even if not topDetected)
  const frames = [
    ...Array.from({ length: 16 }, (_, i) => makeFrame(100 + i * 70, 60, 'raise')),
    makeFrame(100 + 16 * 70, 80, 'raise'),
    // 2프레임 at 103° (hold too short → not complete, but humane zone entered)
    makeFrame(100 + 17 * 70, 103, 'raise'),
    makeFrame(100 + 18 * 70, 103, 'raise'),
    // drop
    makeFrame(100 + 19 * 70, 65, 'raise'),
  ];
  const result = evaluateOverheadReachFromPoseFrames(frames);
  const gate = makeGateMock(result, { completionSatisfied: false, failureReasons: [] });
  const eligible = isOverheadAmbiguousRetryEligible(gate);

  ok('J-5: humane zone entry → ambiguous retry eligible', eligible === true, eligible);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log(`PR-CAM-16 smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME ASSERTIONS FAILED — see above for details');
}
console.log('='.repeat(60));
