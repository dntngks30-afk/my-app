/**
 * Setup false-pass lock — live readiness + setup motion + UI gate
 *
 * npx tsx scripts/camera-setup-false-pass-lock-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { computeSquatUiProgressionLatchGate, evaluateExerciseAutoProgress } = await import(
  '../src/lib/camera/auto-progression.ts'
);
const { computeSquatSetupMotionBlock } = await import('../src/lib/camera/squat-completion-state.ts');
const { getLiveReadinessSummary } = await import('../src/lib/camera/live-readiness.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
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
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}
function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * 80,
    timestampDiscontinuityCount: 0,
  };
}

function frameLike(ts, depth, phase, area) {
  return {
    timestampMs: ts,
    isValid: true,
    phaseHint: phase,
    derived: { squatDepthProxy: depth },
    visibilitySummary: {
      averageVisibility: 0.92,
      criticalJointsAvailability: 0.72,
      visibleLandmarkRatio: 0.75,
      leftSideCompleteness: 0.85,
      rightSideCompleteness: 0.85,
    },
    bodyBox: { area, width: 0.4, height: 0.75 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {
      ankleCenter: { x: 0.5, y: 0.62, visibility: 0.99 },
      hipCenter: { x: 0.5, y: 0.42, visibility: 0.99 },
    },
    eventHints: [],
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}

console.log('\nPR setup-lock camera-setup-false-pass-lock-smoke\n');

{
  const ui = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.72,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    liveReadinessNotReady: true,
  });
  ok('UI gate: not_ready blocks despite owner+confirm', ui.uiProgressionAllowed === false, ui);
  ok('UI gate: reason live_readiness_not_ready', ui.uiProgressionBlockedReason === 'live_readiness_not_ready', ui);
}

{
  const ui = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.72,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    readinessStableDwellSatisfied: false,
  });
  ok('UI gate: dwell false blocks', ui.uiProgressionAllowed === false, ui);
  ok(
    'UI gate: reason readiness_stable_dwell_not_met',
    ui.uiProgressionBlockedReason === 'readiness_stable_dwell_not_met',
    ui
  );
}

{
  const ui = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.72,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    setupMotionBlocked: true,
  });
  ok('UI gate: setup motion blocks', ui.uiProgressionAllowed === false, ui);
  ok('UI gate: reason setup_motion_blocked', ui.uiProgressionBlockedReason === 'setup_motion_blocked', ui);
}

{
  const depths = [
    ...Array(8).fill(0.02),
    0.05, 0.12, 0.22, 0.38, 0.48, 0.52, 0.48, 0.35, 0.22, 0.12, 0.05, 0.03,
    ...Array(10).fill(0.02),
  ];
  const phases = depths.map((_, i) => (i < 8 ? 'start' : i > depths.length - 10 ? 'start' : 'descent'));
  const areas = depths.map((_, i) => (i < 6 ? 0.42 : i >= depths.length - 6 ? 0.14 : 0.36));
  const frames = depths.map((d, i) => frameLike(1000 + i * 40, d, phases[i], areas[i]));
  const block = computeSquatSetupMotionBlock(frames);
  ok('setup motion: area shrink tail blocks', block.blocked === true, block);
  ok('setup motion: reason mentions step back', String(block.reason ?? '').includes('step_back'), block);
}

{
  const STANDING = Array(16).fill(170);
  const DEEP = [
    170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
    ...Array(12).fill(170),
  ];
  const lm = toLandmarks(makeKneeAngleSeries(2000, [...STANDING, ...DEEP]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  ok('integration: deep squat still passes', gate.status === 'pass', gate.status);
  ok('integration: not successSuppressed', gate.squatCycleDebug?.successSuppressedBySetupPhase !== true, gate.squatCycleDebug);
}

{
  const sum = getLiveReadinessSummary({
    success: false,
    guardrail: {
      captureQuality: 'invalid',
      flags: ['valid_frames_too_few'],
      debug: {
        validFrameCount: 2,
        visibleJointsRatio: 0.2,
        criticalJointsAvailability: 0.2,
        sampledFrameCount: 4,
        droppedFrameCount: 0,
        captureDurationMs: 400,
        metricSufficiency: 0,
      },
    },
    framingHint: null,
  });
  ok('live readiness: invalid debug → not_ready', sum.state === 'not_ready', sum);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
