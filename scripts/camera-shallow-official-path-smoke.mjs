/**
 * PR-03 — 공식 shallow / ultra-low completion path (not rescue-only)
 *
 * npx tsx scripts/camera-shallow-official-path-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
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

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    stepId: 'squat',
  };
}
function buildFrames(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
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

console.log('\nPR-03 camera-shallow-official-path-smoke\n');

// 1 deep standard
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    60
  );
  const st = evaluateSquatCompletionState(fr);
  ok('1 deep: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('1 deep: not shallow official closed', st.officialShallowPathClosed !== true, st.officialShallowPathClosed);
  ok('1 deep: shallow candidate false', st.officialShallowPathCandidate === false, st.officialShallowPathCandidate);
  ok('1 deep: rule_finalized', st.completionFinalizeMode === 'rule_finalized', st.completionFinalizeMode);
  ok('1 deep: assist off', st.completionAssistApplied === false, st.completionAssistApplied);
}

// 2 shallow valid cycle → low_rom_cycle + official closed
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);
  ok('2 shallow: pass', st.completionSatisfied === true, st);
  ok('2 shallow: low_rom_cycle', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('2 shallow: official closed', st.officialShallowPathClosed === true, st);
  ok('2 shallow: official candidate', st.officialShallowPathCandidate === true, st);
  ok('2 shallow: official admitted', st.officialShallowPathAdmitted === true, st);
  ok('2 shallow: blocked clear', st.officialShallowPathBlockedReason == null, st.officialShallowPathBlockedReason);
  ok('2 shallow: lineage event', resolveSquatCompletionLineageOwner(st.completionPassReason) === 'completion_truth_event');
  ok('2 shallow: no event_cycle pass reason', !st.completionPassReason.endsWith('_event_cycle'), st.completionPassReason);
}

// 2b 실기기 유사: relativeDepthPeak ≈ 0.22, quality evidenceLabel = standard — 후보·공식 경로 열림
{
  const fr = buildFrames(
    [
      0.05, 0.05, 0.05, 0.05, 0.05, 0.05,
      0.08, 0.12, 0.16, 0.2, 0.24, 0.27, 0.27,
      0.22, 0.16, 0.1, 0.07, 0.05, 0.05, 0.05,
    ],
    [
      'start', 'start', 'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    70
  );
  const st = evaluateSquatCompletionState(fr);
  ok('2b device-mirror: evidence standard', st.evidenceLabel === 'standard', st.evidenceLabel);
  ok('2b device-mirror: rel peak ~0.22', st.relativeDepthPeak > 0.19 && st.relativeDepthPeak < 0.26, st.relativeDepthPeak);
  ok('2b device-mirror: official candidate', st.officialShallowPathCandidate === true, st);
  ok('2b device-mirror: pass + low_rom_cycle', st.completionSatisfied && st.completionPassReason === 'low_rom_cycle', st);
  ok('2b device-mirror: official closed', st.officialShallowPathClosed === true, st);
}

// 3 ultra-low CAM-24 style
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [
        0.0, 0.0, 0.0, 0.0,
        0.004, 0.008, 0.012, 0.018,
        0.017, 0.016, 0.0154, 0.006, 0.005, 0.004, 0.003, 0.003,
      ],
      [
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'ascent', 'ascent', 'start', 'start', 'start',
      ],
      40
    )
  );
  ok('3 ultra: pass', st.completionSatisfied === true, st);
  ok('3 ultra: ultra_low_rom_cycle', st.completionPassReason === 'ultra_low_rom_cycle', st.completionPassReason);
  ok('3 ultra: official candidate', st.officialShallowPathCandidate === true, st);
  ok('3 ultra: official closed', st.officialShallowPathClosed === true, st);
}

// 4 descend only — no full return
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.1, 0.1, 0.1, 0.1],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
      80
    )
  );
  ok('4 descend-only: not satisfied', st.completionSatisfied === false, st);
  ok('4 descend-only: no shallow close', st.officialShallowPathClosed !== true, st);
  ok('4 descend-only: reversal flags', st.reversalConfirmedAfterDescend === false, st);
}

// 5 reversal signal but no standing recovery (truncate before return)
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [0.01, 0.01, 0.01, 0.01, 0.05, 0.09, 0.09, 0.07, 0.05, 0.04],
      ['start', 'start', 'start', 'start', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent'],
      80
    )
  );
  ok('5 no recovery tail: not satisfied', st.completionSatisfied === false, st);
  ok('5: recoveryConfirmed false', st.recoveryConfirmedAfterReversal === false, st);
  ok('5: no shallow close', st.officialShallowPathClosed !== true, st);
}

// 6 standing jitter
{
  const lm = toLandmarks(
    makeKneeAngleSeries(1000, [...Array(20).fill(170), 171, 169, 170, 171, 170, ...Array(8).fill(170)])
  );
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  ok('6 standing jitter: not pass', gate.status !== 'pass', gate.status);
}

// 7 seated-style hold (minimal motion)
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [0.01, 0.01, 0.01, 0.01, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04],
      ['start', 'start', 'start', 'start', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
      100
    )
  );
  ok('7 seated-hold-like: not satisfied', st.completionSatisfied === false, st);
  ok('7: shallow candidate false or no close', st.officialShallowPathClosed !== true, st);
}

// 8 gate: shallow knee series + finalSuccessOwner
{
  const SHALLOW = [
    170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
    93, 95, 100, 110, 122, 136, 150, 163, 170,
  ];
  const lm = toLandmarks(makeKneeAngleSeries(2000, [...STANDING, ...SHALLOW, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  const d = gate.squatCycleDebug ?? {};
  ok('8 shallow gate: pass', gate.status === 'pass', gate.status);
  ok(
    '8 shallow: *_cycle not *_event_cycle',
    cs.completionPassReason === 'low_rom_cycle' || cs.completionPassReason === 'ultra_low_rom_cycle',
    cs.completionPassReason
  );
  ok('8 shallow: finalSuccessOwner event lineage', d.finalSuccessOwner === 'completion_truth_event', d.finalSuccessOwner);
  ok('8 shallow: official candidate', cs.officialShallowPathCandidate === true, cs.officialShallowPathCandidate);
  ok('8 shallow: official admitted', cs.officialShallowPathAdmitted === true, cs.officialShallowPathAdmitted);
  ok('8 shallow: official closed', cs.officialShallowPathClosed === true, cs.officialShallowPathClosed);
  ok('8 shallow: rule_finalized', cs.completionFinalizeMode === 'rule_finalized', cs.completionFinalizeMode);
}

// 9 deep gate unchanged
{
  const lm = toLandmarks(makeKneeAngleSeries(3000, [...STANDING, ...DEEP_STANDARD, ...Array(8).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('9 deep: standard_cycle', cs.completionPassReason === 'standard_cycle', cs.completionPassReason);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
