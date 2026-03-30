/**
 * CAM-30 — squat terminal completionBlockedReason monotonic truth (PR-CAM-30).
 *
 * 동일 attempt(프리픽스 시퀀스) 안에서 reversal/standing 증거 이후
 * blocked reason 이 no_reversal 등 이전 단계로 역행하지 않음을 검증한다.
 *
 * 실행:
 *   npx tsx scripts/camera-cam30-squat-terminal-monotonic-truth-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

function mockLandmark(x, y, v = 0.99) {
  return { x, y, visibility: v };
}
function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

function squatPoseLandmarksFromKneeAngle(ts, kneeAngleDeg) {
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
  landmarks[11] = mockLandmark(0.42, shoulderY);
  landmarks[12] = mockLandmark(0.58, shoulderY);
  landmarks[23] = mockLandmark(0.44, hipY);
  landmarks[24] = mockLandmark(0.56, hipY);
  landmarks[25] = mockLandmark(0.45, kneeY);
  landmarks[26] = mockLandmark(0.55, kneeY);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02);
  return { landmarks, timestamp: ts };
}

function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}
function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * 80,
    timestampDiscontinuityCount: 0,
  };
}

let passed = 0;
let failed = 0;
function assert(label, val, msg) {
  if (val) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: ${msg ?? ''}`);
    failed++;
  }
}

/** 프리픽스마다 gate 평가 후 reversal 확정 이후 no_reversal 금지 + 선택적 최종 통과 검사 */
function runPrefixMonotonic(label, lmFull, expectFinalPass) {
  const results = [];
  for (let n = 12; n <= lmFull.length; n++) {
    const slice = lmFull.slice(0, n);
    const gate = evaluateExerciseAutoProgress('squat', slice, squatStats(slice.length));
    const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
    results.push({
      n,
      reversalAtMs: cs.reversalAtMs ?? null,
      blocked: cs.completionBlockedReason ?? null,
      satisfied: cs.completionSatisfied === true,
      passReason: cs.completionPassReason,
    });
  }

  for (const r of results) {
    if (r.reversalAtMs != null && !r.satisfied && r.blocked === 'no_reversal') {
      assert(
        `${label}: reversal prefix must not be no_reversal (n=${r.n})`,
        false,
        `blocked=${r.blocked}`
      );
      return null;
    }
  }

  const last = results[results.length - 1];
  if (expectFinalPass) {
    assert(`${label}: full cycle passes`, last.satisfied === true, `blocked=${last.blocked}`);
    assert(`${label}: gate pass`, gateLastOk(lmFull), 'status not pass');
  }
  return last;
}

function gateLastOk(lmFull) {
  const gate = evaluateExerciseAutoProgress('squat', lmFull, squatStats(lmFull.length));
  return gate.status === 'pass';
}

console.log('\nCAM-30 squat terminal monotonic truth\n');

// ── A. shallow prefix progression monotonic ─────────────────────────────────
{
  const standing = Array(10).fill(170);
  const squat = [
    170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92, 93, 95, 100, 110, 122, 136, 150, 163, 170,
  ];
  const tail = Array(10).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...squat, ...tail]));
  console.log('A. shallow prefix progression monotonic');
  const last = runPrefixMonotonic('A', lm, true);
  if (last) console.log(`  [info] final passReason=${last.passReason} blocked=${last.blocked}`);
}

// ── B. deep prefix progression monotonic ─────────────────────────────────────
{
  const standing = Array(10).fill(170);
  const desc = [
    170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165,
    170,
  ];
  const tail = Array(10).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...desc, ...tail]));
  console.log('\nB. deep prefix progression monotonic');
  const last = runPrefixMonotonic('B', lm, true);
  if (last) console.log(`  [info] final passReason=${last.passReason} blocked=${last.blocked}`);
}

// ── C. post-standing tail stability ( +20 frames ) ───────────────────────────
function assertTailStable(name, lmBase) {
  const extra = toLandmarks(makeKneeAngleSeries(lmBase[lmBase.length - 1].timestamp + 80, Array(20).fill(170)));
  const lmExtended = [...lmBase, ...extra];
  const gateBase = evaluateExerciseAutoProgress('squat', lmBase, squatStats(lmBase.length));
  const gateExt = evaluateExerciseAutoProgress('squat', lmExtended, squatStats(lmExtended.length));
  const csB = gateBase.evaluatorResult?.debug?.squatCompletionState ?? {};
  const csE = gateExt.evaluatorResult?.debug?.squatCompletionState ?? {};
  assert(
    `${name}: base shallow/deep cycle passes`,
    csB.completionSatisfied === true,
    `blocked=${csB.completionBlockedReason}`
  );
  assert(
    `${name}: +20 standing tail stays satisfied`,
    csE.completionSatisfied === true,
    `blocked=${csE.completionBlockedReason}`
  );
  assert(`${name}: extended gate still pass`, gateExt.status === 'pass', `got ${gateExt.status}`);
}

{
  const standing = Array(10).fill(170);
  const squat = [
    170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92, 93, 95, 100, 110, 122, 136, 150, 163, 170,
  ];
  const tail = Array(10).fill(170);
  const shallowLm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...squat, ...tail]));
  const desc = [
    170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165,
    170,
  ];
  const deepLm = toLandmarks(makeKneeAngleSeries(2000, [...standing, ...desc, ...tail]));
  console.log('\nC. post-standing tail stability (+20 frames)');
  assertTailStable('C-shallow', shallowLm);
  assertTailStable('C-deep', deepLm);
}

// ── D. micro-bend remains blocked ───────────────────────────────────────────
{
  const standing = Array(12).fill(170);
  const dip = [169, 168, 167, 168, 169, 170];
  const tail = Array(12).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...dip, ...tail]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  console.log('\nD. micro-bend remains blocked');
  assert('D: completionSatisfied false', cs.completionSatisfied !== true, 'false positive');
  assert('D: gate not pass', gate.status !== 'pass', `got ${gate.status}`);
}

// ── E. pass reason strings (owner family) unchanged ─────────────────────────
{
  const standing = Array(10).fill(170);
  const squat = [
    170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92, 93, 95, 100, 110, 122, 136, 150, 163, 170,
  ];
  const tail = Array(10).fill(170);
  const shallowLm = toLandmarks(makeKneeAngleSeries(3000, [...standing, ...squat, ...tail]));
  const desc = [
    170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165,
    170,
  ];
  const deepLm = toLandmarks(makeKneeAngleSeries(4000, [...standing, ...desc, ...tail]));
  const gShallow = evaluateExerciseAutoProgress('squat', shallowLm, squatStats(shallowLm.length));
  const gDeep = evaluateExerciseAutoProgress('squat', deepLm, squatStats(deepLm.length));
  const shallowPr = gShallow.evaluatorResult?.debug?.squatCompletionState?.completionPassReason;
  const deepPr = gDeep.evaluatorResult?.debug?.squatCompletionState?.completionPassReason;
  console.log('\nE. no contract regression (pass reason strings)');
  // PR-03: ultra_low_rom 밴드 → 공식 ultra_low_rom_cycle
  assert('E: shallow/ultra-shallow family pass reason', shallowPr === 'ultra_low_rom_cycle', `got ${shallowPr}`);
  assert('E: deep family pass reason', deepPr === 'standard_cycle', `got ${deepPr}`);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
