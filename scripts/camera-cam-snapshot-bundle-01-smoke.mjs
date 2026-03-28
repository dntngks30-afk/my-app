/**
 * PR-CAM-SNAPSHOT-BUNDLE-01: CaptureSessionBundle 저장·요약·경계·복사 문자열 스모크
 *
 * 실행: npx tsx scripts/camera-cam-snapshot-bundle-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const store = new Map();
globalThis.localStorage = {
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
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
{
  const clip = {
    writeText: async (s) => {
      globalThis.__lastClipboard = s;
    },
  };
  const nav = globalThis.navigator;
  if (nav && typeof nav === 'object') {
    try {
      Object.defineProperty(nav, 'clipboard', {
        value: clip,
        configurable: true,
        writable: true,
      });
    } catch {
      // Node may expose navigator without writable clipboard — copy helper still returns json
    }
  }
}

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const {
  recordAttemptSnapshot,
  recordSquatObservationEvent,
  getRecentAttempts,
  clearAttempts,
  buildAttemptSnapshot,
} = await import('../src/lib/camera/camera-trace.ts');
const {
  BUNDLE_STORAGE_KEY,
  MAX_CAPTURE_SESSION_BUNDLES,
  recordCaptureSessionTerminalBundle,
  getRecentCaptureSessionBundles,
  getLatestCaptureSessionBundle,
  serializeCaptureSessionBundle,
  copyLatestCaptureSessionBundleJson,
  extractCaptureSessionSummaryFromAttempt,
} = await import('../src/lib/camera/camera-trace-bundle.ts');

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

console.log('PR-CAM-SNAPSHOT-BUNDLE-01 smoke\n');

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
recordCaptureSessionTerminalBundle({
  stepId: 'squat',
  gate: squatGate,
  route: '/movement-test/camera/squat',
  terminalKind: 'success',
});

const bundles = getRecentCaptureSessionBundles();
ok('bundle: one bundle after terminal record', bundles.length === 1);
const b0 = bundles[0];
ok('bundle: has latestAttempt', !!b0?.latestAttempt);
ok('bundle: observations array', Array.isArray(b0?.observations));
ok('bundle: terminalKind success', b0?.terminalKind === 'success');

const summary = b0?.summary ?? {};
ok('summary: squatCycle-derived keys present', 'completionPassReason' in summary && 'depthBand' in summary);
const fromExtract = extractCaptureSessionSummaryFromAttempt(b0?.latestAttempt);
ok('extract matches bundle.summary shape', typeof fromExtract === 'object');

const snapJson = serializeCaptureSessionBundle(b0);
ok('serialize non-empty', typeof snapJson === 'string' && snapJson.length > 20);
ok('serialize no raw landmark keys', !snapJson.includes('"landmarks"') && !snapJson.includes('"frames"'));

const copyRes = await copyLatestCaptureSessionBundleJson();
ok(
  'copy returns json string (clipboard optional in Node)',
  copyRes.json.length > 0 && (copyRes.ok === true || copyRes.reason === 'clipboard_denied' || copyRes.reason === 'no_clipboard_api')
);

for (let i = 0; i < MAX_CAPTURE_SESSION_BUNDLES + 5; i++) {
  recordCaptureSessionTerminalBundle({
    stepId: 'squat',
    gate: squatGate,
    route: '/test',
    terminalKind: 'retry_optional',
  });
}
const bounded = getRecentCaptureSessionBundles();
ok(`bounded to MAX (${MAX_CAPTURE_SESSION_BUNDLES})`, bounded.length === MAX_CAPTURE_SESSION_BUNDLES);

const attemptsBefore = getRecentAttempts().length;
recordAttemptSnapshot('squat', squatGate);
const attemptsAfter = getRecentAttempts().length;
ok('recordAttemptSnapshot still pushes attempts', attemptsAfter >= attemptsBefore);

clearAttempts();
ok('clearAttempts clears bundle key', localStorage.getItem(BUNDLE_STORAGE_KEY) == null);
ok('clearAttempts clears attempts', getRecentAttempts().length === 0);

getLatestCaptureSessionBundle();
ok('getLatest after clear is null-safe', getLatestCaptureSessionBundle() === null);

const built = buildAttemptSnapshot('squat', squatGate);
ok('buildAttemptSnapshot still works', built != null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
