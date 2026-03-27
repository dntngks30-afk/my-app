/**
 * CAM-29 smoke — PR-B shallow squat phase & completion truth after PR-A slice alignment.
 *
 * 검증 목표:
 * A. ultra-shallow 실제 사이클(170°→92°→170°)이 completion을 통과한다
 * B. arming이 진짜 standing 윈도우를 선택한다 (windowRange 낮음)
 * C. standing sway / jitter는 여전히 false positive 없음
 * D. 타이밍 게이트가 arming 수정 후 올바르게 평가된다 (descent_span_too_short 미발생)
 * E. 표준/깊은 스쿼트 경로는 변경 없이 보존된다
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { computeSquatCompletionArming } = await import('../src/lib/camera/squat/squat-completion-arming.ts');

function mockLandmark(x, y, v = 0.99) { return { x, y, visibility: v }; }
function clamp(v, a = 0, b = 1) { return Math.min(b, Math.max(a, v)); }

function squatPoseLandmarksFromKneeAngle(ts, kneeAngleDeg) {
  const landmarks = Array(33).fill(null).map((_, i) => mockLandmark(0.3+(i%11)*0.04, 0.1+Math.floor(i/11)*0.2, 0.99));
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
function toLandmarks(seq) { return seq.map(f => ({ landmarks: f.landmarks, timestamp: f.timestamp })); }
function squatStats(len) { return { sampledFrameCount: len, droppedFrameCount: 0, captureDurationMs: len * 80, timestampDiscontinuityCount: 0 }; }

let passed = 0;
let failed = 0;
function assert(label, val, msg) {
  if (val) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}: ${msg ?? ''}`); failed++; }
}

console.log('\nCAM-29 shallow phase/completion truth after PR-B arming fix\n');

// ── A. Ultra-shallow real cycle (170→92→170) ────────────────────────────────
{
  const standing = Array(10).fill(170);
  const squat = [170,168,162,152,140,130,118,105,98,95,93,92,93,95,100,110,122,136,150,163,170];
  const tail = Array(10).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...squat, ...tail]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};

  console.log('A. Ultra-shallow real cycle → should pass');
  console.log(`  [info] arming: sliceStart=${hm.completionArmingSliceStart} windowRange=${hm.completionArmingStandingWindowRange} rel=${hm.relativeDepthPeak}`);
  console.log(`  [info] completion: blocked=${cs.completionBlockedReason} satisfied=${cs.completionSatisfied} descentToPeakMs=${hm.squatDescentToPeakMs}`);

  assert('A: completion passes', cs.completionSatisfied === true, `blocked=${cs.completionBlockedReason}`);
  assert('A: not blocked by descent_span_too_short', cs.completionBlockedReason !== 'descent_span_too_short', `got ${cs.completionBlockedReason}`);
  assert('A: relativeDepthPeak > 0', (hm.relativeDepthPeak ?? 0) > 0, `got ${hm.relativeDepthPeak}`);
  assert('A: arming windowRange low (true standing selected)', (hm.completionArmingStandingWindowRange ?? 999) < 0.012, `got ${hm.completionArmingStandingWindowRange}`);
  assert('A: no depth-truth mismatch', hm.depthTruthWindowMismatch === 0, `got ${hm.depthTruthWindowMismatch}`);
  assert('A: gate = pass', gate.status === 'pass', `got ${gate.status}`);
}

// ── B. Arming standing window range unit test (mock PoseFeaturesFrame) ───────
{
  // 직접 depth 값을 주입해 isStableStandingRun 범위 체크를 검증한다.
  // 시나리오: 10 flat standing → ultra-shallow squat (peak 0.04) → 10 post-squat standing
  function makeFrame(depth) {
    return { isValid: true, timestampMs: 0, phaseHint: 'unknown', derived: { squatDepthProxy: depth } };
  }
  // 10 standing (≈0) + squat ramp (0→0.04 slowly, all < 0.085, delta ≈ 0.004/frame) + 10 tail
  const standingFrames = Array(10).fill(null).map(() => makeFrame(0.001));
  const squatRamp = [0.001, 0.004, 0.008, 0.013, 0.019, 0.025, 0.031, 0.037, 0.040, 0.038, 0.033, 0.026, 0.018, 0.011, 0.005];
  const squatFrames = squatRamp.map(d => makeFrame(d));
  const tailFrames = Array(10).fill(null).map(() => makeFrame(0.001));
  const allFrames = [...standingFrames, ...squatFrames, ...tailFrames];

  const { arming } = computeSquatCompletionArming(allFrames);

  console.log('\nB. Arming standing window range — PR-B range check (mock frames)');
  console.log(`  [info] armed=${arming.armed} sliceStart=${arming.completionSliceStartIndex} windowRange=${arming.armingStandingWindowRange} peakAnchored=${arming.armingPeakAnchored}`);

  assert('B: arming armed', arming.armed === true, 'not armed');
  assert('B: windowRange ≤ 0.010 (genuine standing selected, not descent ramp)',
    (arming.armingStandingWindowRange ?? 999) <= 0.010,
    `range=${arming.armingStandingWindowRange} > 0.010 — descent ramp was mistakenly selected`);
  // 슬라이스 시작이 스쿼트 피크 이전이어야 한다 (피크는 index 17 = 10+7)
  const peakIdx = 17; // standingFrames(10) + ramp peak index(7)
  assert('B: sliceStart ≤ peakIdx (slice includes squat)',
    arming.completionSliceStartIndex <= peakIdx,
    `sliceStart=${arming.completionSliceStartIndex} > peakIdx=${peakIdx}`);
}

// ── C. Standing sway — no false positive ────────────────────────────────────
{
  const sway = Array(40).fill(null).map((_, i) => 168 + (i % 3 === 0 ? 1 : -1));
  const lm = toLandmarks(makeKneeAngleSeries(1000, sway));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};

  console.log('\nC. Standing sway — must NOT pass');
  assert('C: sway completionSatisfied = false', cs.completionSatisfied !== true, 'false positive!');
  assert('C: sway relativeDepthPeak near 0', (hm.relativeDepthPeak ?? 0) < 0.015, `got ${hm.relativeDepthPeak}`);
  assert('C: gate ≠ pass', gate.status !== 'pass', `got ${gate.status}`);
}

// ── D. Timing gate: descent_span_too_short should NOT fire for real shallow squat ─
//
// 핵심: PR-A arming 수정 이후 ultra-shallow 사이클의 완료는 더 이상 timing gate에 막히지 않아야 한다.
// test A (170→92→170, 10+21+10)와 같은 기준 시퀀스로 타이밍 게이트 비차단을 확인한다.
// 80ms/frame 합성 픽스처에서 double smoothing 후 descent-to-peak span이 ≥120ms(relaxed)면 통과.
{
  // A 시나리오와 동일 (이미 통과) — 타이밍 게이트 비차단 확인
  const standing = Array(10).fill(170);
  const squat = [170,168,162,152,140,130,118,105,98,95,93,92,93,95,100,110,122,136,150,163,170];
  const tail = Array(10).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...squat, ...tail]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};

  console.log('\nD. Timing gate — PR-B arming fix must not produce descent_span_too_short for real shallow cycle');
  console.log(`  [info] descentToPeakMs=${hm.squatDescentToPeakMs} blocked=${cs.completionBlockedReason} passes=${cs.completionSatisfied}`);

  assert('D: not blocked by descent_span_too_short', cs.completionBlockedReason !== 'descent_span_too_short',
    `squatDescentToPeakMs=${hm.squatDescentToPeakMs}`);
  assert('D: completion passes', cs.completionSatisfied === true, `blocked=${cs.completionBlockedReason}`);
  // descentToPeakMs ≥ 120ms (relaxed low-ROM threshold) — 진짜 하강 구조가 포착됨
  assert('D: descentToPeakMs ≥ 120ms', (hm.squatDescentToPeakMs ?? 0) >= 120,
    `got ${hm.squatDescentToPeakMs}ms`);
}

// ── E. Deep squat — standard path preserved ──────────────────────────────────
{
  const standing = Array(10).fill(170);
  const desc = [170,165,155,142,128,112,95,82,70,62,58,55,57,62,70,82,95,112,128,142,155,165,170];
  const tail = Array(10).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...desc, ...tail]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};

  console.log('\nE. Deep squat — standard cycle path intact');
  assert('E: gate = pass', gate.status === 'pass', `got ${gate.status}`);
  assert('E: completionSatisfied', cs.completionSatisfied === true, `blocked=${cs.completionBlockedReason}`);
  assert('E: evidenceLabel not insufficient_signal', cs.evidenceLabel !== 'insufficient_signal', `got ${cs.evidenceLabel}`);
}

// ── F. Micro-bend (tiny dip, no real cycle) — should fail ───────────────────
{
  const standing = Array(12).fill(170);
  const dip = [169,168,167,168,169,170]; // < 2° excursion
  const tail = Array(12).fill(170);
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...standing, ...dip, ...tail]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};

  console.log('\nF. Micro-bend — must NOT pass');
  assert('F: micro-bend completionSatisfied = false', cs.completionSatisfied !== true, 'false positive!');
  assert('F: gate ≠ pass', gate.status !== 'pass', `got ${gate.status}`);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
