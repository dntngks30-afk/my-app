/**
 * PR-02 — Diagnosis / snapshot assist provenance surface
 *
 * npx tsx scripts/camera-assist-provenance-trace-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');
const { resolveSquatCompletionLineageOwner } = await import(
  '../src/lib/camera/squat/squat-progression-contract.ts'
);

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
function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
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

const STANDING = Array(12).fill(170);
const DEEP_STANDARD = [
  170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
  ...Array(12).fill(170),
];

console.log('\nPR-02 camera-assist-provenance-trace-smoke\n');

{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const snap = buildAttemptSnapshot('squat', gate, undefined, {});
  ok('snap exists', snap != null, snap);
  const c = snap?.diagnosisSummary?.squatCycle;
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('diag: completionFinalizeMode matches state', c?.completionFinalizeMode === cs.completionFinalizeMode, {
    c: c?.completionFinalizeMode,
    cs: cs.completionFinalizeMode,
  });
  ok('diag: completionAssistApplied matches', c?.completionAssistApplied === cs.completionAssistApplied, {
    c: c?.completionAssistApplied,
    cs: cs.completionAssistApplied,
  });
  ok('diag: assist sources length match', (c?.completionAssistSources?.length ?? 0) === (cs.completionAssistSources?.length ?? 0), {
    c: c?.completionAssistSources,
    cs: cs.completionAssistSources,
  });
  ok('diag: finalSuccessOwner + lineage readable', c?.finalSuccessOwner === resolveSquatCompletionLineageOwner(cs.completionPassReason), {
    fs: c?.finalSuccessOwner,
    lin: resolveSquatCompletionLineageOwner(cs.completionPassReason),
  });
  ok('diag: rule blocked in calib', typeof c?.calib?.rb === 'string' || c?.calib?.rb === null, c?.calib);
  ok('diag: completionFinalizeMode present', c?.completionFinalizeMode != null, c?.completionFinalizeMode);
  ok('diag: completionAssistApplied is boolean', typeof c?.completionAssistApplied === 'boolean', c?.completionAssistApplied);
  ok('diag: completionAssistSources is array', Array.isArray(c?.completionAssistSources), c?.completionAssistSources);
  ok('diag: reversalEvidenceProvenance matches state', c?.reversalEvidenceProvenance === cs.reversalEvidenceProvenance, {
    c: c?.reversalEvidenceProvenance,
    cs: cs.reversalEvidenceProvenance,
  });
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
