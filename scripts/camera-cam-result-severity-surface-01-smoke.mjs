/**
 * PR-CAM-RESULT-SEVERITY-SURFACE-01: attempt diagnosis + success writer와 동일 helper 입력 형태 검증
 *
 * 실행: npx tsx scripts/camera-cam-result-severity-surface-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildSquatResultSeveritySummary } = await import('../src/lib/camera/squat-result-severity.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
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

function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}

console.log('PR-CAM-RESULT-SEVERITY-SURFACE-01 smoke\n');

// A. success writer와 동일 인자 형태 (low-quality pass)
const mobileObsShape = { captureQuality: 'low' };
const squatDebugShape = {
  completionTruthPassed: true,
  qualityOnlyWarnings: ['capture_quality_low'],
};
const siqShape = { qualityTier: 'low', limitations: ['asymmetry_elevated', 'shallow_time_in_depth'] };
const a = buildSquatResultSeveritySummary({
  completionTruthPassed: squatDebugShape.completionTruthPassed === true,
  captureQuality: String(mobileObsShape.captureQuality ?? ''),
  qualityOnlyWarnings: squatDebugShape.qualityOnlyWarnings,
  qualityTier: siqShape.qualityTier ?? null,
  limitations: siqShape.limitations,
});
ok('A: low_quality_pass', a.passSeverity === 'low_quality_pass');
ok('A: limitationCount matches limitations', a.limitationCount === 2);
ok('A: qualityWarningCount', a.qualityWarningCount === 1);

// B–D: 규칙 스모크 (surface PR은 helper 재사용만)
const b = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'high',
  limitations: [],
});
ok('B: clean_pass', b.passSeverity === 'clean_pass');

const c = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'high',
  limitations: ['x'],
});
ok('C: warning_pass', c.passSeverity === 'warning_pass');

const d = buildSquatResultSeveritySummary({
  completionTruthPassed: false,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'high',
  limitations: [],
});
ok('D: failed', d.passSeverity === 'failed');

// E. attempt snapshot diagnosis surface
const deepPoses = toLandmarks([
  ...Array(6).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.015)),
  ...[0.05, 0.1, 0.16, 0.22, 0.24, 0.2, 0.14, 0.08, 0.03, 0.01, 0.01, 0.01].map((d, i) =>
    squatPoseLandmarks(580 + i * 80, d)
  ),
]);
const stats = {
  sampledFrameCount: deepPoses.length,
  droppedFrameCount: 0,
  captureDurationMs: 3000,
  timestampDiscontinuityCount: 0,
};
const gate = evaluateExerciseAutoProgress('squat', deepPoses, stats);
const attempt = buildAttemptSnapshot('squat', gate, undefined, undefined);
const sq = attempt?.diagnosisSummary?.squatCycle;
ok('E: attempt squatCycle has passSeverity', typeof sq?.passSeverity === 'string');
ok('E: attempt squatCycle has resultInterpretation', typeof sq?.resultInterpretation === 'string');
ok('E: attempt squatCycle has qualityWarningCount', typeof sq?.qualityWarningCount === 'number');
ok('E: attempt squatCycle has limitationCount', typeof sq?.limitationCount === 'number');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
