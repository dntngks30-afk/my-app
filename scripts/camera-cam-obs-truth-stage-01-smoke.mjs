/**
 * PR-CAM-OBS-TRUTH-STAGE-01: observation truth stage / blocked reason authoritative 스모크
 *
 * 실행: npx tsx scripts/camera-cam-obs-truth-stage-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const store = new Map();
const mockLs = {
  getItem(k) {
    return store.has(k) ? store.get(k) : null;
  },
  setItem(k, v) {
    store.set(k, String(v));
  },
  removeItem(k) {
    store.delete(k);
  },
};
try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLs,
    configurable: true,
    writable: true,
    enumerable: true,
  });
} catch {
  globalThis.localStorage = mockLs;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

const {
  computeObservationTruthFields,
  recordSquatObservationEvent,
  clearAttempts,
  buildAttemptSnapshot,
} = await import('../src/lib/camera/camera-trace.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { buildCaptureSessionBundle } = await import('../src/lib/camera/camera-trace-bundle.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const d = extra !== undefined ? ` | ${JSON.stringify(extra)}` : '';
    console.error(`  ✗ ${name}${d}`);
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.9));
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  const kneeForward = depthProxy * 0.2;
  landmarks[23] = mockLandmark(0.45, hipY, 0.9);
  landmarks[24] = mockLandmark(0.55, hipY, 0.9);
  landmarks[25] = mockLandmark(0.45 + kneeForward, kneeY, 0.9);
  landmarks[26] = mockLandmark(0.55 - kneeForward, kneeY, 0.9);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.9);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.9);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.9);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.9);
  return { landmarks, timestamp };
}

console.log('PR-CAM-OBS-TRUTH-STAGE-01 smoke\n');

// ── A. pre-attempt: attemptStarted=false → authoritative false ──
const preA = computeObservationTruthFields({
  eventType: 'descent_detected',
  attemptStarted: false,
  baselineFrozen: false,
});
ok('A1: pre-attempt → pre_attempt_hint', preA.observationTruthStage === 'pre_attempt_hint');
ok('A2: pre-attempt → completionBlockedReasonAuthoritative=false', preA.completionBlockedReasonAuthoritative === false);

const preMid = computeObservationTruthFields({
  eventType: 'descent_detected',
  attemptStarted: true,
  baselineFrozen: false,
});
ok('A3: attemptStarted without baselineFrozen → pre_attempt_hint', preMid.observationTruthStage === 'pre_attempt_hint');
ok('A4: attemptStarted without baselineFrozen → authoritative=false', preMid.completionBlockedReasonAuthoritative === false);

// ── B. attempt truth: attemptStarted + baselineFrozen ──
const attB = computeObservationTruthFields({
  eventType: 'attempt_started',
  attemptStarted: true,
  baselineFrozen: true,
});
ok('B1: attempt+baselineFrozen → attempt_truth', attB.observationTruthStage === 'attempt_truth');
ok('B2: attempt+baselineFrozen → authoritative=true', attB.completionBlockedReasonAuthoritative === true);

// ── C. terminal overrides stage ──
const termC = computeObservationTruthFields({
  eventType: 'capture_session_terminal',
  attemptStarted: true,
  baselineFrozen: true,
});
ok('C1: capture_session_terminal → terminal_truth', termC.observationTruthStage === 'terminal_truth');
ok('C2: terminal + frozen → authoritative=true', termC.completionBlockedReasonAuthoritative === true);

const termWeak = computeObservationTruthFields({
  eventType: 'capture_session_terminal',
  attemptStarted: false,
  baselineFrozen: false,
});
ok('C3: terminal but no attempt → still terminal_truth stage', termWeak.observationTruthStage === 'terminal_truth');
ok('C4: terminal no attempt → authoritative=false', termWeak.completionBlockedReasonAuthoritative === false);

// ── Integration: real gate observation + bundle summary ──
clearAttempts();
store.clear();

const squatLandmarks = [
  ...Array(4)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(100 + i * 80, 0.1 + i * 0.15)),
  ...Array(5)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(420 + i * 80, 0.55 + i * 0.02)),
  ...Array(5)
    .fill(0)
    .map((_, i) => squatPoseLandmarks(820 + i * 80, 0.5 - i * 0.1)),
];
const squatStats = {
  sampledFrameCount: squatLandmarks.length,
  droppedFrameCount: 1,
  captureDurationMs: 2000,
  timestampDiscontinuityCount: 0,
};
const squatGate = evaluateExerciseAutoProgress('squat', squatLandmarks, squatStats);

recordSquatObservationEvent(squatGate, 'attempt_started');
const rawObs = store.get('moveReCameraSquatObservation:v1');
const obsList = rawObs ? JSON.parse(rawObs) : [];
const obs0 = obsList[0];
ok('I1: recorded observation has observationTruthStage', typeof obs0?.observationTruthStage === 'string');
ok(
  'I2: recorded observation has completionBlockedReasonAuthoritative boolean',
  typeof obs0?.completionBlockedReasonAuthoritative === 'boolean'
);
// completionBlockedReason must remain present as string or null (not stripped)
ok(
  'I3: completionBlockedReason key preserved (null|string)',
  obs0 && ('completionBlockedReason' in obs0)
);

recordSquatObservationEvent(squatGate, 'capture_session_terminal', { captureTerminalKind: 'smoke' });
const rawObs2 = store.get('moveReCameraSquatObservation:v1');
const obsList2 = rawObs2 ? JSON.parse(rawObs2) : [];
const termObs = obsList2.find((o) => o.eventType === 'capture_session_terminal');
ok('I4: terminal observation → terminal_truth', termObs?.observationTruthStage === 'terminal_truth');

const attempt = buildAttemptSnapshot('squat', squatGate, undefined, undefined);
const bundle = buildCaptureSessionBundle({
  latestAttempt: attempt ?? undefined,
  observations: obsList2,
  route: '/smoke',
  motionType: 'squat',
  terminalKind: 'retry_optional',
});
ok('I5: bundle.summary.observationTruthStage present', bundle.summary.observationTruthStage === 'terminal_truth');
ok(
  'I6: bundle.summary.completionBlockedReasonAuthoritative is boolean',
  typeof bundle.summary.completionBlockedReasonAuthoritative === 'boolean'
);
ok(
  'I7: last bundle observation matches summary truth stage',
  bundle.observations[bundle.observations.length - 1]?.observationTruthStage === bundle.summary.observationTruthStage
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
