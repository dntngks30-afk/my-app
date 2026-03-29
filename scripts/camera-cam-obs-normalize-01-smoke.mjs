/**
 * PR-CAM-OBS-NORMALIZE-01: squat truth 정규화·success 스냅샷 라벨 스모크
 *
 * 실행: npx tsx scripts/camera-cam-obs-normalize-01-smoke.mjs
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

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { recordSquatSuccessSnapshot, getRecentSuccessSnapshots } = await import(
  '../src/lib/camera/camera-success-diagnostic.ts'
);
const {
  extractCaptureSessionSummaryFromAttempt,
  buildSquatInterpretationHints,
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

console.log('PR-CAM-OBS-NORMALIZE-01 smoke\n');

const mockAttempt = {
  id: 'mock',
  ts: new Date().toISOString(),
  movementType: 'squat',
  outcome: 'ok',
  captureQuality: 'good',
  confidence: 0.85,
  motionCompleteness: 'complete',
  progressionPassed: true,
  finalPassLatched: true,
  fallbackType: 'none',
  flags: [],
  topReasons: [],
  diagnosisSummary: {
    stepId: 'squat',
    captureQuality: 'good',
    completionSatisfied: true,
    passConfirmed: true,
    passLatched: true,
    squatCycle: {
      descendDetected: true,
      bottomDetected: true,
      recoveryDetected: true,
      startBeforeBottom: false,
      cycleComplete: true,
      passBlockedReason: null,
      completionPassReason: 'low_rom_event_cycle',
      completionPathUsed: 'low_rom',
      passOwner: 'completion_truth_event',
      finalSuccessOwner: 'completion_truth_event',
      standardOwnerEligible: false,
      shadowEventOwnerEligible: true,
      peakDepth: 91,
      depthBand: 'deep',
      romBand: 'deep',
      relativeDepthPeak: 0.38,
      rawDepthPeak: 0.4,
      relativeDepthPeakSource: 'completion_state',
      eventCycleDetected: true,
      eventCyclePromoted: true,
      eventCycleBand: 'shallow',
      eventCycleSource: 'squat_event_cycle',
      displayDepthTruth: 'evaluator_peak_metric',
      ownerDepthTruth: 'completion_relative_depth',
      cycleDecisionTruth: 'completion_state',
      currentSquatPhase: 'recovery',
      descendConfirmed: true,
      ascendConfirmed: true,
      reversalConfirmedAfterDescend: true,
      recoveryConfirmedAfterReversal: true,
      completionBlockedReason: null,
      standardPathBlockedReason: null,
    },
  },
};

const extracted = extractCaptureSessionSummaryFromAttempt(mockAttempt);
ok(
  'mock: ownerTruth matches low_rom_event_cycle + completion_truth_event',
  extracted.normalized?.ownerTruth.completionPassReason === 'low_rom_event_cycle' &&
    extracted.normalized?.ownerTruth.finalSuccessOwner === 'completion_truth_event'
);
ok(
  'mock: peakDepthMetric vs relativeDepthPeak in separate buckets',
  extracted.normalized?.evaluatorDepthTruth.peakDepthMetric === 91 &&
    extracted.normalized?.completionDepthTruth.relativeDepthPeak === 0.38
);
const hints = buildSquatInterpretationHints(extracted);
ok('hints: 2~5 lines', hints.length >= 2 && hints.length <= 5);

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

store.delete('moveReCameraSuccessSnapshots:v1');
recordSquatSuccessSnapshot({
  gate: squatGate,
  successOpenedBy: 'effectivePassLatched',
  currentRoute: '/movement-test/camera/squat',
  passLatchedAtMs: Date.now(),
  effectivePassLatched: true,
  competingPaths: [],
});
const snaps = getRecentSuccessSnapshots();
const last = snaps[snaps.length - 1];
ok('success snapshot: truth label fields', last?.displayDepthTruth === 'evaluator_peak_metric');
ok('success snapshot: ownerDepthTruth', last?.ownerDepthTruth === 'completion_relative_depth');
ok('success snapshot: has finalSuccessOwner key', 'finalSuccessOwner' in (last ?? {}));
ok('success snapshot: has standardOwnerEligible key', 'standardOwnerEligible' in (last ?? {}));

const flatCompat = extracted.completionPassReason === 'low_rom_event_cycle' && extracted.depthBand === 'deep';
ok('flat summary backward compatible', flatCompat);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
