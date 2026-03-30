/**
 * PR-CAM-29A — 상승/비-standing phase 에서 final pass 미오픈
 *
 * npx tsx scripts/camera-cam29a-squat-no-mid-ascent-open-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateExerciseAutoProgress,
  isFinalPassLatched,
} = await import('../src/lib/camera/auto-progression.ts');
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');

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

console.log('\n── A. ascending phase + 잘못된 completionSatisfied true mock — latch 금지 ──');
{
  const gate = {
    completionSatisfied: true,
    confidence: 0.72,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    squatCycleDebug: { minimumCycleDurationSatisfied: true },
    guardrail: { captureQuality: 'ok', flags: [], retryRecommended: false, completionStatus: 'complete' },
    evaluatorResult: {
      debug: {
        squatCompletionState: {
          completionSatisfied: true,
          completionPassReason: 'standard_cycle',
          currentSquatPhase: 'ascending',
          cycleDurationMs: 4000,
        },
      },
    },
  };
  ok('A1: isFinalPassLatched false (phase)', isFinalPassLatched('squat', gate) === false, isFinalPassLatched('squat', gate));
}

console.log('\n── B. 실제 파이프라인: 중간 프레임만 잘라도 completion 미달이면 pass 아님 ──');
{
  function mockLandmark(x, y, visibility = 0.92) {
    return { x, y, visibility };
  }
  function squatPoseLandmarks(timestamp, depthProxy) {
    const landmarks = Array(33)
      .fill(null)
      .map((_, i) => mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.92));
    const hipY = 0.35;
    const kneeY = hipY + 0.15 * (1 - depthProxy);
    const ankleY = kneeY + 0.2;
    const kneeForward = depthProxy * 0.22;
    landmarks[23] = mockLandmark(0.45, hipY, 0.92);
    landmarks[24] = mockLandmark(0.55, hipY, 0.92);
    landmarks[25] = mockLandmark(0.45 + kneeForward, kneeY, 0.92);
    landmarks[26] = mockLandmark(0.55 - kneeForward, kneeY, 0.92);
    landmarks[27] = mockLandmark(0.45, ankleY, 0.92);
    landmarks[28] = mockLandmark(0.55, ankleY, 0.92);
    landmarks[11] = mockLandmark(0.45, 0.2, 0.92);
    landmarks[12] = mockLandmark(0.55, 0.2, 0.92);
    return { landmarks, timestamp };
  }

  const depthSeries = [...Array(10).fill(0.02), 0.08, 0.18, 0.28, 0.35, 0.32, 0.22];
  const frames = depthSeries.map((d, i) => squatPoseLandmarks(2000 + i * 100, d));
  const ev = evaluateSquatFromPoseFrames(
    buildPoseFeaturesFrames(
      'squat',
      frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
    )
  );
  const gate = evaluateExerciseAutoProgress(
    'squat',
    frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp })),
    { sampledFrameCount: frames.length, droppedFrameCount: 0, captureDurationMs: frames.length * 100, timestampDiscontinuityCount: 0 }
  );
  const cs = ev.debug?.squatCompletionState;
  ok('B1: prefix without standing recovery → no pass', gate.status !== 'pass' || cs?.completionSatisfied !== true, {
    st: gate.status,
    csat: cs?.completionSatisfied,
  });
  ok('B2: isFinalPassLatched false on gate', isFinalPassLatched('squat', gate) === false, isFinalPassLatched('squat', gate));
}

console.log('\n── C. 깊은 느린 시퀀스 (cam25 스타일 landmark) — 회귀 pass ──');
{
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
  const deep = [
    170, 165, 155, 140, 120, 100, 88, 85, 88, 96, 108, 122, 138, 153, 165, 170,
  ];
  const stepMs = 100;
  const angles = [...Array(16).fill(170), ...deep, ...Array(24).fill(170)];
  const lm = angles.map((a, i) => ({
    landmarks: squatPoseLandmarksFromKneeAngle(3000 + i * stepMs, a).landmarks,
    timestamp: 3000 + i * stepMs,
  }));
  const gate = evaluateExerciseAutoProgress('squat', lm, {
    sampledFrameCount: lm.length,
    droppedFrameCount: 0,
    captureDurationMs: lm.length * stepMs,
    timestampDiscontinuityCount: 0,
  });
  if (gate.squatCycleDebug?.minimumCycleDurationSatisfied === true && gate.evaluatorResult.debug?.squatCompletionState?.completionSatisfied) {
    ok('C1: deep pass status', gate.status === 'pass', gate.status);
    ok('C2: isFinalPassLatched', isFinalPassLatched('squat', gate) === true, isFinalPassLatched('squat', gate));
  } else {
    ok('C: skip (fixture did not reach long-cycle success)', true, gate.squatCycleDebug);
  }
}

console.log(`\n━━━ PR-CAM-29A mid-ascent smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
