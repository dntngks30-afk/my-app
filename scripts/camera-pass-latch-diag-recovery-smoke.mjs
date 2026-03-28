/**
 * CAM-PASS-LATCH-DIAG-RECOVERY-01 — pass→latch 진단·관측·export 가시성 스모크
 *
 * 실행: npx tsx scripts/camera-pass-latch-diag-recovery-smoke.mjs
 *
 * 검증:
 * A. gate.status === 'pass' 이고 effective 래치 전(dev) → diag_pass_visible_not_latched 관측
 * B. sc/hm 없음 → diag_no_debug_attach 스로틀(연속 호출 1회)
 * C. stepId !== 'squat' → diag_stepid_mismatch 기록
 * D. export 페이로드 형태(실패 shallow + exportSummary) 정적 검증
 * E. buildSquatAttemptObservation 정상(csFull 정의) — 모션 게이트 미변경
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
};
/* camera-trace는 window 존재 시에만 localStorage 기록 */
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

const {
  buildSquatAttemptObservation,
  recordSquatPassVisibleNotLatchedObservation,
  recordSquatDiagNoDebugAttachThrottled,
  recordSquatDiagStepIdMismatchThrottled,
  getRecentSquatObservations,
  clearSquatObservations,
} = await import('../src/lib/camera/camera-trace.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { getRecentFailedShallowSnapshots } = await import('../src/lib/camera/camera-success-diagnostic.ts');

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

function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) =>
      mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.99)
    );
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  landmarks[23] = mockLandmark(0.45, hipY, 0.99);
  landmarks[24] = mockLandmark(0.55, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.99);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.99);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.99);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.99);
  return { landmarks, timestamp };
}

console.log('\nA. pass visible, not yet effective latched → diag observation (dev only)');
{
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  store.clear();
  clearSquatObservations();

  /** 실제 시퀀스 대신 스냅샷: PASS 표시 + 아직 페이지 래치 전 시나리오만 검증 */
  const gate = {
    status: 'pass',
    progressionState: 'passed',
    confidence: 0.88,
    guardrail: { captureQuality: 'valid', flags: [], completionStatus: 'complete' },
    flags: [],
    failureReasons: [],
    reasons: [],
    evaluatorResult: {
      stepId: 'squat',
      debug: { highlightedMetrics: { relativeDepthPeak: 0.08 } },
    },
    squatCycleDebug: { attemptStarted: true, descendConfirmed: true },
    completionSatisfied: true,
    passConfirmationSatisfied: true,
    retryRecommended: false,
    uiMessage: 'ok',
    finalPassBlockedReason: null,
    finalPassEligible: true,
  };

  ok('mock gate.status pass', gate.status === 'pass', gate.status);

  recordSquatPassVisibleNotLatchedObservation(gate, {
    finalPassLatched: false,
    passLatched: false,
    effectivePassLatched: false,
    cameraPhase: 'capturing',
    settled: false,
    sampledFrameCount: 42,
    currentStepKey: 'squat:test-preview-0',
    passLatchedStepKey: null,
  });

  const obs = getRecentSquatObservations();
  const diag = obs.filter((o) => o.eventType === 'diag_pass_visible_not_latched');
  ok('diag_pass_visible_not_latched recorded', diag.length >= 1, diag);
  ok('diagPassLatchGap present', diag[0]?.diagPassLatchGap?.cameraPhase === 'capturing', diag[0]);

  const lenBeforeProd = getRecentSquatObservations().length;
  process.env.NODE_ENV = 'production';
  recordSquatPassVisibleNotLatchedObservation(gate, {
    finalPassLatched: false,
    passLatched: false,
    effectivePassLatched: false,
    cameraPhase: 'capturing',
    settled: false,
    sampledFrameCount: 1,
    currentStepKey: 'squat:prod-skip',
    passLatchedStepKey: null,
  });
  const lenAfterProd = getRecentSquatObservations().length;
  ok('production skips pass-gap observation', lenAfterProd === lenBeforeProd, {
    lenBeforeProd,
    lenAfterProd,
  });

  process.env.NODE_ENV = prevEnv;
}

console.log('\nB. no sc/hm → diag_no_debug_attach throttled');
{
  store.delete('moveReCameraSquatObservation:v1');
  const minimalGate = {
    status: 'retry',
    progressionState: 'retry_required',
    confidence: 0.5,
    guardrail: { captureQuality: 'valid', flags: [], completionStatus: 'partial' },
    flags: [],
    failureReasons: [],
    reasons: [],
    evaluatorResult: { stepId: 'squat', debug: {} },
    squatCycleDebug: undefined,
    completionSatisfied: false,
    passConfirmationSatisfied: false,
    retryRecommended: true,
    uiMessage: 'retry',
    finalPassBlockedReason: null,
    finalPassEligible: false,
  };
  recordSquatDiagNoDebugAttachThrottled(minimalGate, 'session-b');
  recordSquatDiagNoDebugAttachThrottled(minimalGate, 'session-b');
  const n = getRecentSquatObservations().filter((o) => o.eventType === 'diag_no_debug_attach').length;
  ok('at most one no_debug per throttle window', n === 1, n);
}

console.log('\nC. stepId mismatch marker');
{
  const wrongStepGate = {
    status: 'pass',
    progressionState: 'passed',
    confidence: 0.9,
    guardrail: { captureQuality: 'valid', flags: [], completionStatus: 'complete' },
    flags: [],
    failureReasons: [],
    reasons: [],
    evaluatorResult: { stepId: 'overhead-reach', debug: { highlightedMetrics: {} } },
    squatCycleDebug: undefined,
    completionSatisfied: true,
    passConfirmationSatisfied: true,
    retryRecommended: false,
    uiMessage: 'ok',
    finalPassBlockedReason: null,
    finalPassEligible: true,
  };
  recordSquatDiagStepIdMismatchThrottled(wrongStepGate, 'session-c');
  const m = getRecentSquatObservations().filter((o) => o.eventType === 'diag_stepid_mismatch');
  ok('mismatch marker exists', m.length >= 1, m);
  ok('expected squat actual overhead-reach', m.some((o) => o.diagActualStepId === 'overhead-reach'), m);
}

console.log('\nD. export payload shape (failed shallow + summary)');
{
  const payloadKeys = [
    'attempts',
    'squatAttemptObservations',
    'successSnapshots',
    'failedShallowSnapshots',
    'exportSummary',
  ];
  const mockPayload = {
    attempts: [],
    squatAttemptObservations: [],
    successSnapshots: [],
    failedShallowSnapshots: getRecentFailedShallowSnapshots(),
    exportSummary: {
      attemptsCount: 0,
      squatObservationsCount: 0,
      successSnapshotsCount: 0,
      failedShallowCount: 0,
    },
  };
  ok('export has failedShallowSnapshots key', 'failedShallowSnapshots' in mockPayload, payloadKeys);
  ok(
    'exportSummary counts',
    mockPayload.exportSummary.failedShallowCount === mockPayload.failedShallowSnapshots.length,
    mockPayload.exportSummary
  );
}

console.log('\nE. buildSquatAttemptObservation does not throw (csFull bound)');
{
  const squatLandmarks = Array(8)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(100 + i * 80, 0.2 + i * 0.05));
  const stats = {
    sampledFrameCount: squatLandmarks.length,
    droppedFrameCount: 0,
    captureDurationMs: 800,
    timestampDiscontinuityCount: 0,
  };
  const g = evaluateExerciseAutoProgress('squat', squatLandmarks, stats);
  let threw = false;
  let built = null;
  try {
    built = buildSquatAttemptObservation(g, 'pre_attempt_candidate');
  } catch {
    threw = true;
  }
  ok('buildSquatAttemptObservation no ReferenceError', !threw, threw);
  ok('buildSquatAttemptObservation returns record when stepId squat', built != null, built);
}

console.log(`\nDone. passed=${passed} failed=${failed}`);
