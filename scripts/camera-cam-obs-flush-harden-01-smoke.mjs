/**
 * PR-CAM-OBS-FLUSH-HARDEN-01: observation flush → terminal bundle·캐시 fallback 스모크
 *
 * 실행: npx tsx scripts/camera-cam-obs-flush-harden-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const store = new Map();
let setItemThrows = false;
const mockLs = {
  getItem(k) {
    return store.has(k) ? store.get(k) : null;
  },
  setItem(k, v) {
    if (setItemThrows) throw new Error('quota');
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

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const {
  recordSquatObservationEvent,
  getRecentSquatObservations,
  getRecentSquatObservationsSnapshot,
  clearAttempts,
} = await import('../src/lib/camera/camera-trace.ts');
const {
  recordCaptureSessionTerminalBundle,
  getRecentCaptureSessionBundles,
  BUNDLE_STORAGE_KEY,
} = await import('../src/lib/camera/camera-trace-bundle.ts');

const OBS_KEY = 'moveReCameraSquatObservation:v1';

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
  landmarks[23] = mockLandmark(0.45, hipY, 0.9);
  landmarks[24] = mockLandmark(0.55, hipY, 0.9);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.9);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.9);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.9);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.9);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.9);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.9);
  return { landmarks, timestamp };
}

console.log('PR-CAM-OBS-FLUSH-HARDEN-01 smoke\n');

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
ok('LS has observation after event', getRecentSquatObservations().length >= 1);

recordSquatObservationEvent(squatGate, 'capture_session_terminal', {
  captureTerminalKind: 'smoke_terminal',
  shallowObservationContract: false,
});
recordCaptureSessionTerminalBundle({
  stepId: 'squat',
  gate: squatGate,
  route: '/movement-test/camera/squat',
  terminalKind: 'success',
});

const bundles = getRecentCaptureSessionBundles();
const b0 = bundles[bundles.length - 1];
ok('bundle.observations length >= 1', (b0?.observations?.length ?? 0) >= 1);
ok(
  'summary.observationCount matches observations',
  b0?.summary?.observationCount === b0?.observations?.length
);

clearAttempts();
store.clear();
recordSquatObservationEvent(squatGate, 'pre_attempt_candidate');
const nAfterFirst = getRecentSquatObservations().length;
ok('first push persisted', nAfterFirst >= 1);

setItemThrows = true;
recordSquatObservationEvent(squatGate, 'attempt_started');
ok('LS stale shorter after setItem failure', getRecentSquatObservations().length <= nAfterFirst);
const snap = getRecentSquatObservationsSnapshot();
ok('snapshot uses cache when longer than LS', snap.length > getRecentSquatObservations().length);

setItemThrows = false;
store.delete(OBS_KEY);
ok('empty LS falls back to cache', getRecentSquatObservations().length === 0 && getRecentSquatObservationsSnapshot().length > 0);

store.delete(BUNDLE_STORAGE_KEY);
recordCaptureSessionTerminalBundle({
  stepId: 'squat',
  gate: squatGate,
  route: '/test',
  terminalKind: 'retry_optional',
});
const b1 = getRecentCaptureSessionBundles().at(-1);
ok('bundle after cache path still has observations', (b1?.observations?.length ?? 0) >= 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
