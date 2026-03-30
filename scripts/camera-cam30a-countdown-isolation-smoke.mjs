/**
 * PR-CAM-30A — capturing 전 pose 누적이 gate/pass를 열지 않음 (페이지 정책 + evaluator 분리)
 *
 * npx tsx scripts/camera-cam30a-countdown-isolation-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { squatPageExerciseEvaluationActive } = await import(
  '../src/app/movement-test/camera/squat/page.tsx'
);
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
    console.error(`  FAIL: ${name}${extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : ''}`);
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}

function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
  const depthT = Math.min(1, Math.max(0, (170 - kneeAngleDeg) / 110));
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + Math.sin(bendRad) * shinLen, kneeY + Math.cos(bendRad) * shinLen, 0.99);
  landmarks[28] = mockLandmark(0.55 + Math.sin(bendRad) * shinLen, kneeY + Math.cos(bendRad) * shinLen, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}

const downUp = [
  170, 168, 160, 148, 132, 115, 100, 90, 86,
  ...Array(18).fill(85),
  86, 90, 100, 114, 130, 147, 160, 167, 170,
];
const stepMs = 120;
const lm = downUp.map((ang, i) =>
  squatPoseLandmarksFromKneeAngle(10_000 + i * stepMs, ang)
);
const series = lm.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
const stats = {
  sampledFrameCount: series.length,
  droppedFrameCount: 0,
  captureDurationMs: series.length * stepMs,
  timestampDiscontinuityCount: 0,
};

console.log('\n── A. 동일 landmark 로 “전체 평가” 시 pass 가능 (evaluator 자체는 정상) ──');
const gateFull = evaluateExerciseAutoProgress('squat', series, stats);
ok('A1: full sequence can reach pass', gateFull.status === 'pass', gateFull.status);
ok('A2: finalPassLatched when evaluated', isFinalPassLatched('squat', gateFull) === true);

console.log('\n── B. 페이지 정책: setup/countdown 에서는 gate 입력 비활성 → 빈 입력과 동일 ──');
const gateEmpty = evaluateExerciseAutoProgress('squat', [], {
  sampledFrameCount: 0,
  droppedFrameCount: 0,
  captureDurationMs: 0,
  timestampDiscontinuityCount: 0,
});
ok('B1: policy says no eval before capturing', squatPageExerciseEvaluationActive('setup') === false);
ok('B2: empty landmarks gate not pass', gateEmpty.status !== 'pass', gateEmpty.status);
ok('B3: empty finalPassLatched false', isFinalPassLatched('squat', gateEmpty) === false);

console.log('\n── C. “가짜 카운트다운” 단계에서 풀 landmark 를 넣어도 페이지는 소비 안 함 ──');
// 페이지는 phase !== capturing 이면 [] + zero stats 로만 gate 계산
ok('C1: countdown policy blocks consumption', squatPageExerciseEvaluationActive('countdown') === false);

console.log(`\n━━━ PR-CAM-30A countdown isolation: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
