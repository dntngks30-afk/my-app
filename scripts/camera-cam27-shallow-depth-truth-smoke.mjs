/**
 * CAM-27 smoke — shallow squat depth/descent source-chain alignment
 *
 * 배경:
 *   squatDepthProxy 로지스틱 함수의 MID=75, SCALE=6.5 파라미터상
 *   depth ≥ 0.03 (guardedShallowDescent 최소 기준)은 무릎 각도 ≤97°에서만 달성된다.
 *   따라서 "얕은 스쿼트" fixture는 무릎 각도 ~92-97° 범위를 사용한다.
 *
 * 검증:
 * A. 정상 케이스: 10+ standing frame 선행 후 얕은 스쿼트 → primary arm, rawDepthPeak > 0
 * B. 단축 baseline: 4–8개 standing frame 후 얕은 스쿼트 → secondary arm 폴백, rawDepthPeak > 0
 * C. 폴백 arm 플래그가 highlightedMetrics.completionArmingFallbackUsed에 정확히 기록됨
 * D. Standing noise 전용 → arm 안 되거나 relativeDepthPeak ≈ 0 (오탐 방지 유지)
 * E. 깊은 스쿼트 정상 동작 보존
 *
 * 실행: npx tsx scripts/camera-cam27-shallow-depth-truth-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

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

function info(label, value) {
  console.log(`    [info] ${label}: ${JSON.stringify(value)}`);
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
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

function squatStats(len, captureDurationMs) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: captureDurationMs ?? len * 80,
    timestampDiscontinuityCount: 0,
  };
}

function getHm(gate) {
  return gate?.evaluatorResult?.debug?.highlightedMetrics ?? {};
}

function getCs(gate) {
  return gate?.evaluatorResult?.debug?.squatCompletionState ?? {};
}

/**
 * "얕은 스쿼트" 무릎 각도 시퀀스.
 * depth 범위 [0.03, 0.08] = 무릎 각도 91–97° (logistic MID=75, SCALE=6.5)
 * 기존 cam27 smoke test 기준 angles ~92–93°에서 실제 shallowCandidateObserved = true.
 */
const STANDING_ANGLES = Array(12).fill(170);
// 170 → 93 → 170: 얕은 스쿼트 (depth proxy ≈ 0.03–0.06)
const SHALLOW_SQUAT_CYCLE = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];
// 170 → 85 → 170: 깊은 스쿼트
const DEEP_SQUAT_CYCLE = [
  170, 165, 155, 140, 120, 100, 88, 85, 88, 96, 108, 122, 138, 153, 165, 170,
];

// ── A. 정상 케이스: 10+ standing frame 선행 ──
console.log('\nA. 정상 케이스: 12개 standing → 얕은 스쿼트 (primary arm)');
{
  const angles = [...STANDING_ANGLES, ...SHALLOW_SQUAT_CYCLE, ...Array(8).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(1000, angles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);
  const cs = getCs(gate);

  info('A arming/depth', {
    armed: hm.completionArmingArmed,
    rawPeak: hm.rawDepthPeak,
    relPeak: hm.relativeDepthPeak,
    fallback: hm.completionArmingFallbackUsed,
    evidenceLabel: hm.evidenceLabel,
    descendConfirmed: cs.descendConfirmed,
  });

  ok('A: arming = 1', hm.completionArmingArmed === 1, hm.completionArmingArmed);
  ok('A: rawDepthPeak > 0', hm.rawDepthPeak > 0, hm.rawDepthPeak);
  ok('A: relativeDepthPeak > 0', hm.relativeDepthPeak > 0, hm.relativeDepthPeak);
  ok('A: fallbackUsed = 0 (primary arm)', hm.completionArmingFallbackUsed === 0, hm.completionArmingFallbackUsed);
  // descendConfirmed or at least relativeDepthPeak > 0 proves depth-truth is non-zero
  ok('A: depth-truth non-zero (chain connected)', hm.relativeDepthPeak > 0, hm.relativeDepthPeak);
}

// ── B. secondary arm 단위 테스트: computeSquatCompletionArming 직접 호출 ──
//
// 실기기에서의 버그: primary arm의 10프레임 stable window가 스쿼트 이후 standing에 위치하면
// completionFrames가 비어 rawDepthPeak=0이 된다. secondary arm이 이를 복구한다.
//
// landmark→depth 체인의 이중 스무딩을 우회하여 depth 값을 직접 제어한다.
console.log('\nB. secondary arm 단위 테스트 (mock PoseFeaturesFrame)');
{
  const { computeSquatCompletionArming } = await import('../src/lib/camera/squat/squat-completion-arming.ts');

  function makeFrame(depth) {
    return {
      isValid: true,
      timestampMs: 0,
      phaseHint: 'unknown',
      derived: { squatDepthProxy: depth },
    };
  }

  // 시나리오: 4 standing → squat (peak 0.06) → 10 post-squat standing
  // primary arm은 post-squat standing(i=5)에서 발화 → completionFrames = [] (motion 없음)
  // → secondary arm이 i=0 (4 standing frames) 에서 발화 → completionFrames includes squat ✓
  const frames = [
    // 4 stable standing (depth 0.005)
    makeFrame(0.005), makeFrame(0.005), makeFrame(0.005), makeFrame(0.005),
    // squat descent (depth rises from 0.005 → 0.06 rapidly, deltas > 0.018)
    makeFrame(0.025), makeFrame(0.047), makeFrame(0.060),
    // recovery (depth drops back, large deltas)
    makeFrame(0.045), makeFrame(0.022),
    // post-squat standing (10 stable frames at depth 0.003)
    makeFrame(0.003), makeFrame(0.003), makeFrame(0.003), makeFrame(0.003), makeFrame(0.003),
    makeFrame(0.003), makeFrame(0.003), makeFrame(0.003), makeFrame(0.003), makeFrame(0.003),
  ];

  const result = computeSquatCompletionArming(frames);
  const arming = result.arming;

  info('B unit test arming', {
    armed: arming.armed,
    fallback: arming.armingFallbackUsed,
    peakAnchored: arming.armingPeakAnchored,
    stableFrames: arming.stableFrames,
    sliceStart: arming.completionSliceStartIndex,
  });

  ok('B: arming = true', arming.armed === true, arming.armed);
  // PR-CAM-28: peak-anchored가 secondary보다 먼저 잡을 수 있음(동일 버그 클래스 해결)
  ok(
    'B: peakAnchored OR fallbackUsed (slice aligned to squat, not post-squat tail)',
    arming.armingPeakAnchored === true || arming.armingFallbackUsed === true,
    { peakAnchored: arming.armingPeakAnchored, fallback: arming.armingFallbackUsed }
  );
  ok(
    'B: stableFrames = 4 (peak-anchor or secondary 4-frame baseline)',
    arming.stableFrames === 4,
    arming.stableFrames
  );
  ok('B: completionFrames includes squat', result.completionFrames.length > 0, result.completionFrames.length);
  const maxDepthInCompletion = Math.max(...result.completionFrames.map(f => f.derived.squatDepthProxy));
  ok('B: completionFrames max depth > 0 (squat captured)', maxDepthInCompletion > 0.04, maxDepthInCompletion);
}

// ── B2. primary arm이 motion 포함 시 그대로 사용 ──
console.log('\nB2. primary arm motion 검증 — completionFrames에 motion이 있으면 primary 유지');
{
  const { computeSquatCompletionArming } = await import('../src/lib/camera/squat/squat-completion-arming.ts');

  function makeFrame(depth) {
    return { isValid: true, timestampMs: 0, phaseHint: 'unknown', derived: { squatDepthProxy: depth } };
  }

  // 시나리오: 10 standing → squat (peak 0.07) → recovery
  // primary arm이 i=0에서 발화하고 completionFrames에 squat 포함 → motion check 통과 → primary 유지
  const frames = [
    ...Array(10).fill(0.002).map(d => makeFrame(d)),  // 10 stable standing
    makeFrame(0.010), makeFrame(0.025), makeFrame(0.040), makeFrame(0.060), makeFrame(0.070),
    makeFrame(0.055), makeFrame(0.035), makeFrame(0.015), makeFrame(0.003),
    ...Array(8).fill(0.002).map(d => makeFrame(d)),
  ];

  const result = computeSquatCompletionArming(frames);
  ok('B2: arming = true', result.arming.armed === true, result.arming.armed);
  ok('B2: fallback = false (primary arm used)', result.arming.armingFallbackUsed !== true, result.arming.armingFallbackUsed);
  ok('B2: stableFrames = 10', result.arming.stableFrames === 10, result.arming.stableFrames);
}

// ── C. standing sway가 secondary arm도 트리거하지 않음 ──
console.log('\nC. standing noise → secondary arm도 오탐 없음');
{
  const { computeSquatCompletionArming } = await import('../src/lib/camera/squat/squat-completion-arming.ts');

  function makeFrame(depth) {
    return { isValid: true, timestampMs: 0, phaseHint: 'unknown', derived: { squatDepthProxy: depth } };
  }

  // 4 standing + 노이즈(depth excursion < 0.018) → secondary arm 미발화
  const noiseFrames = [
    makeFrame(0.003), makeFrame(0.004), makeFrame(0.003), makeFrame(0.004),  // 4 stable standing
    makeFrame(0.005), makeFrame(0.006), makeFrame(0.007), makeFrame(0.006),  // sway excursion = 0.004 < 0.018
    makeFrame(0.005), makeFrame(0.004), makeFrame(0.003), makeFrame(0.004),
    makeFrame(0.005), makeFrame(0.004),
  ];

  const result = computeSquatCompletionArming(noiseFrames);
  ok('C: noise → arming = false (no false positive)', result.arming.armed === false, result.arming.armed);
}

// ── D. Standing noise 전용 — 오탐 방지 ──
console.log('\nD. Standing noise 전용 (각도 ±1°) — relativeDepthPeak ≈ 0, 오탐 없음');
{
  const noiseAngles = [
    ...Array(15).fill(170),
    171, 169, 170, 171, 170, 169, 170, 171, 170,
    ...Array(8).fill(170),
  ];
  const lm = toLandmarks(makeKneeAngleSeries(5000, noiseAngles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);

  info('D noise', { relPeak: hm.relativeDepthPeak, evidenceLabel: hm.evidenceLabel, satisfied: hm.completionSatisfied });

  ok('D: completionSatisfied = false', !hm.completionSatisfied, hm.completionSatisfied);
  ok('D: relativeDepthPeak near 0 (sway not admitted)', hm.relativeDepthPeak < 0.02, hm.relativeDepthPeak);
  ok('D: evidenceLabel = insufficient_signal', hm.evidenceLabel === 'insufficient_signal', hm.evidenceLabel);
}

// ── E. 깊은 스쿼트 정상 동작 보존 ──
console.log('\nE. 깊은 스쿼트 — 기존 동작 보존');
{
  const angles = [...STANDING_ANGLES, ...DEEP_SQUAT_CYCLE, ...Array(10).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(1000, angles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = getHm(gate);
  const cs = getCs(gate);

  info('E deep squat', {
    armed: hm.completionArmingArmed,
    rawPeak: hm.rawDepthPeak,
    relPeak: hm.relativeDepthPeak,
    fallback: hm.completionArmingFallbackUsed,
    evidenceLabel: hm.evidenceLabel,
    descendConfirmed: cs.descendConfirmed,
  });

  ok('E: arming = 1 (primary arm)', hm.completionArmingArmed === 1, hm.completionArmingArmed);
  ok('E: rawDepthPeak > 0 (deep squat depth)', hm.rawDepthPeak > 0, hm.rawDepthPeak);
  ok('E: fallbackUsed = 0 (no 4-frame secondary)', hm.completionArmingFallbackUsed === 0, hm.completionArmingFallbackUsed);
}

// ── Summary ──
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
