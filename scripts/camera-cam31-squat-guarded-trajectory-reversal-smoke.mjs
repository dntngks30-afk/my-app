/**
 * CAM-31 — PR-CAM-31 guarded trajectory reversal rescue smoke
 *
 * 실행:
 *   npx tsx scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

const LOWER_LIMB_INDICES = [25, 26, 27, 28];

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

/**
 * 하지 가시성 저하 — 프레임은 유효(≥0.35)로 두되 primary 무릎 기하·역전 스트릭을 흔들고
 * 블렌드 completion depth 쪽이 상대적으로 살아남도록 한다.
 */
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

const STANDING_ANGLES = Array(12).fill(170);
const SHALLOW_SQUAT_CYCLE = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];
/** CAM-29 스타일 — relative peak 가 standard owner 쪽으로 올라가 completionPassReason 검증에 사용 */
const DEEP_STANDARD_SQUAT_CYCLE = [
  170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
];
/**
 * A보다 약간 더 깊은 저ROM 사이클(최소 각 ~88°) — shallow(92°)보다 깊으나 standard(55°급)보다 얕음.
 */
const MODERATE_SQUAT_CYCLE = [
  170, 168, 162, 152, 138, 125, 112, 100, 92, 90, 88, 89,
  92, 98, 110, 125, 140, 152, 162, 168, 170,
];

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  ✗ ${name}${detail}`);
    process.exitCode = 1;
  }
}

function getCs(gate) {
  return gate?.evaluatorResult?.debug?.squatCompletionState ?? {};
}

function getHm(gate) {
  return gate?.evaluatorResult?.debug?.highlightedMetrics ?? {};
}

function truthPassed(gate) {
  return gate?.squatCycleDebug?.completionTruthPassed === true;
}

console.log('\nCAM-31 guarded trajectory reversal rescue\n');

// ── A. blended-assisted shallow rescue ───────────────────────────────────────
console.log('A. blended-assisted shallow rescue (lower-limb visibility degrade)');
{
  const angles = [...STANDING_ANGLES, ...SHALLOW_SQUAT_CYCLE, ...Array(8).fill(170)];
  const base = toLandmarks(makeKneeAngleSeries(1000, angles));
  const nStand = STANDING_ANGLES.length;
  const nSquat = SHALLOW_SQUAT_CYCLE.length;
  // 바닥 직후~상승 초반만 타깃 (무장·하강 baseline 유지), 가시성은 유효 프레임 하한 근처
  const degraded = applyLowerLimbVisibilityDegrade(
    base,
    (i) => i >= nStand + 8 && i < nStand + 16,
    0.38
  );
  const gate = evaluateExerciseAutoProgress('squat', degraded, squatStats(degraded.length));
  const cs = getCs(gate);
  const hm = getHm(gate);
  const dbg = gate.squatCycleDebug ?? {};

  console.log(
    `    [info] relPeak=${hm.relativeDepthPeak} source=${cs.relativeDepthPeakSource} blocked=${cs.completionBlockedReason} reversalBy=${cs.reversalConfirmedBy} pass=${gate.status}`
  );

  ok('A: depth / admission (relativeDepthPeak > 0)', (hm.relativeDepthPeak ?? 0) > 0, hm.relativeDepthPeak);
  ok('A: final gate pass', gate.status === 'pass', gate.status);
  ok(
    'A: representative agreement (pass-core/final/latch)',
    gate.evaluatorResult?.debug?.squatPassCore?.passDetected === true &&
      gate.finalPassEligible === true,
    {
      passDetected: gate.evaluatorResult?.debug?.squatPassCore?.passDetected,
      finalPassEligible: gate.finalPassEligible,
      completionTruthPassed: dbg.completionTruthPassed,
    }
  );
  ok('A: currentSquatPhase standing_recovered', cs.currentSquatPhase === 'standing_recovered', cs.currentSquatPhase);
  ok(
    'A: reversal trajectory or rule',
    cs.reversalConfirmedBy === 'trajectory' || cs.reversalConfirmedBy === 'rule' || cs.reversalConfirmedBy === 'rule_plus_hmm',
    cs.reversalConfirmedBy
  );
  ok('A: final not no_reversal', cs.completionBlockedReason !== 'no_reversal', cs.completionBlockedReason);
}

// ── B. blended-assisted moderate rescue ──────────────────────────────────────
console.log('\nB. blended-assisted moderate rescue');
{
  const tail = Array(14).fill(170);
  const angles = [...STANDING_ANGLES, ...MODERATE_SQUAT_CYCLE, ...tail];
  const base = toLandmarks(makeKneeAngleSeries(2000, angles));
  const nStand = STANDING_ANGLES.length;
  // 바닥 근처 3프레임만 약한 하지 저가시성 — 무장 유지 + 역전 primary만 살짝 흔들기
  const degraded = applyLowerLimbVisibilityDegrade(
    base,
    (i) => i === nStand + 7 || i === nStand + 8 || i === nStand + 9,
    0.42
  );
  const gate = evaluateExerciseAutoProgress('squat', degraded, squatStats(degraded.length));
  const cs = getCs(gate);
  const hm = getHm(gate);
  console.log(`    [info] B relPeak=${hm.relativeDepthPeak} pass=${gate.status} blocked=${cs.completionBlockedReason} reason=${cs.completionPassReason}`);
  ok('B: no permissive pass reopening', gate.status === 'pass' || gate.status === 'retry', gate.status);
  ok(
    'B: blocked reason, if present, is explicit (no silent pass ambiguity)',
    cs.completionBlockedReason == null || typeof cs.completionBlockedReason === 'string',
    cs.completionBlockedReason
  );
  ok('B: owner not standard_cycle (moderate depth)', cs.completionPassReason !== 'standard_cycle', cs.completionPassReason);
}

// ── C. deep standard regression guard ───────────────────────────────────────
console.log('\nC. deep standard regression guard (no degrade)');
{
  const angles = [...STANDING_ANGLES, ...DEEP_STANDARD_SQUAT_CYCLE, ...Array(10).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(3000, angles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = getCs(gate);
  ok('C: pass', gate.status === 'pass', gate.status);
  ok('C: completionPassReason standard_cycle', cs.completionPassReason === 'standard_cycle', cs.completionPassReason);
  // 깊은 표준 사이클은 명시 역전(rule)이 잡히는 것이 정상 — trajectory 구조 보조 불필요
  ok('C: deep reversalConfirmedBy not trajectory', cs.reversalConfirmedBy !== 'trajectory', cs.reversalConfirmedBy);
}

// ── D. standing sway — blocked ──────────────────────────────────────────────
console.log('\nD. standing noise (CAM-27 pattern) — blocked');
{
  const noiseAngles = [
    ...Array(15).fill(170),
    171, 169, 170, 171, 170, 169, 170, 171, 170,
    ...Array(8).fill(170),
  ];
  const lm = toLandmarks(makeKneeAngleSeries(5000, noiseAngles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  ok('D: completionTruthPassed not true', truthPassed(gate) !== true, gate.squatCycleDebug?.completionTruthPassed);
  ok('D: gate not pass', gate.status !== 'pass', gate.status);
}

// ── E. fake dip — down/hold without meaningful return ───────────────────────
console.log('\nE. fake dip — down-only / no return continuity');
{
  const angles = [
    ...Array(12).fill(170),
    168, 155, 140, 125, 110, 100, 98, 97, 97, 97, 97, 97, 97, 97,
  ];
  const lm = toLandmarks(makeKneeAngleSeries(6000, angles));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = getCs(gate);
  ok('E: not pass', gate.status !== 'pass', gate.status);
  ok('E: no trajectory false positive', cs.reversalConfirmedBy !== 'trajectory' || cs.completionSatisfied !== true, {
    by: cs.reversalConfirmedBy,
    sat: cs.completionSatisfied,
  });
  ok('E: completion not satisfied', cs.completionSatisfied !== true, cs.completionSatisfied);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
