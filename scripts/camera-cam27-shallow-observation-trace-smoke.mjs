/**
 * CAM-27 smoke — shallow squat pre-attempt observation trace (camera-trace)
 *
 * 검증:
 * A. 얕은 미완 시퀀스에서 관측 신호·observation 빌드 가능, pass 불필요
 * B. 하강→역전 단계가 gate 스냅샷에 반영되면 observation 필드로 읽힘
 * C. 스탠딩/노이즈 시 shallow 후보 과다 기록 없음(신호 false)
 * D. buildAttemptSnapshot 계약 유지
 * E. observation JSON에 landmark·frames·blob 키 없음
 * F. traceKind === 'attempt_observation'
 *
 * 실행: npx tsx scripts/camera-cam27-shallow-observation-trace-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  buildSquatAttemptObservation,
  buildAttemptSnapshot,
  deriveSquatObservabilitySignals,
  relativeDepthPeakBucket,
} = await import('../src/lib/camera/camera-trace.ts');
const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
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

function squatStats(len, captureDurationMs = 3200) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}

function forbiddenKeys(obj) {
  const s = JSON.stringify(obj);
  const bad = ['landmarks', '"frames"', 'videoBlob', 'imageData'];
  return bad.filter((k) => s.includes(k));
}

console.log('\nA. shallow incomplete motion → observability + observation record shape');
{
  /* cam26 스타일 얕은 하강 일부만 재생 후 중단(완전 standing 복귀 없음) → relativeDepthPeak 관측 */
  const shallowAngles = [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92,
    93, 95,
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(1000, shallowAngles));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks.length));

  const sig = deriveSquatObservabilitySignals(gate);
  ok('shallow candidate or attempt-like seen for real shallow trend', sig.shallowCandidateObserved || sig.attemptLikeMotionObserved, sig);

  const obs = buildSquatAttemptObservation(gate, 'pre_attempt_candidate');
  ok('buildSquatAttemptObservation returns record', obs != null, obs);
  ok('traceKind attempt_observation', obs?.traceKind === 'attempt_observation', obs?.traceKind);
  ok('eventType preserved', obs?.eventType === 'pre_attempt_candidate', obs?.eventType);
  ok('no forbidden payload keys', forbiddenKeys(obs).length === 0, forbiddenKeys(obs));

  const latched = isFinalPassLatched('squat', gate);
  ok('shallow incomplete does not require final pass', !latched, { latched });
}

console.log('\nB. descent then partial return — progression fields inspectable on observation');
{
  const anglesDownUp = [
    ...Array(8).fill(170),
    168, 155, 140, 135, 138, 150, 160, 168,
    ...Array(8).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(2000, anglesDownUp));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks.length));
  const obsDesc = buildSquatAttemptObservation(gate, 'descent_detected');
  ok('descent observation builds', obsDesc != null, obsDesc);
  const obsRev = buildSquatAttemptObservation(gate, 'reversal_detected');
  ok('reversal observation builds', obsRev != null, obsRev);
  const hasProgress =
    obsDesc?.descendConfirmed === true ||
    obsDesc?.reversalConfirmedAfterDescend === true ||
    (obsDesc?.relativeDepthPeak != null && obsDesc.relativeDepthPeak >= 0.02);
  ok('blocked/completion reason or depth visible', hasProgress || obsDesc?.completionBlockedReason != null, {
    descend: obsDesc?.descendConfirmed,
    rev: obsDesc?.reversalConfirmedAfterDescend,
    blocked: obsDesc?.completionBlockedReason,
    rel: obsDesc?.relativeDepthPeak,
  });
}

console.log('\nC. standing-like sequence — no shallow candidate (full window, no per-frame spam simulation)');
{
  const standingLandmarks = toLandmarks(makeKneeAngleSeries(5000, Array(40).fill(169)));
  const g = evaluateExerciseAutoProgress(
    'squat',
    standingLandmarks,
    squatStats(standingLandmarks.length, standingLandmarks.length * 80)
  );
  const sig = deriveSquatObservabilitySignals(g);
  ok('standing: shallowCandidateObserved false', !sig.shallowCandidateObserved, sig);
  ok('standing: attemptLikeMotionObserved false', !sig.attemptLikeMotionObserved, sig);
}

console.log('\nD. buildAttemptSnapshot still works for squat gate');
{
  const seq = [
    ...Array(8).fill(170),
    168, 150, 135, 140, 155, 168,
    ...Array(8).fill(170),
  ];
  const landmarks = toLandmarks(makeKneeAngleSeries(3000, seq));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks.length));
  const snap = buildAttemptSnapshot('squat', gate, { state: 'ready', blocker: null, framingHint: null, smoothingApplied: false });
  ok('attempt snapshot exists', snap != null, snap);
  ok('snapshot movement squat', snap?.movementType === 'squat', snap?.movementType);
}

console.log('\nE. privacy: observation JSON has no raw landmark arrays');
{
  const landmarks = toLandmarks(
    makeKneeAngleSeries(4000, [...Array(6).fill(170), 168, 150, 145, 150, 165, ...Array(6).fill(170)])
  );
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks.length));
  const obs = buildSquatAttemptObservation(gate, 'pre_attempt_candidate');
  const fk = forbiddenKeys(obs);
  ok('no forbidden keys in observation', fk.length === 0, fk);
}

console.log('\nF. relativeDepthPeakBucket buckets');
{
  ok('lt_0.02', relativeDepthPeakBucket(0.01) === 'lt_0.02');
  ok('0.02_0.04', relativeDepthPeakBucket(0.03) === '0.02_0.04');
  ok('ge_0.10', relativeDepthPeakBucket(0.11) === 'ge_0.10');
}

console.log(`\nDone. passed=${passed} failed=${failed}`);
