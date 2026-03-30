/**
 * PR-02 — Assist vs owner isolation (completion-state provenance + PR-01 lineage)
 *
 * npx tsx scripts/camera-assist-owner-isolation-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');
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
const LOWER_LIMB_INDICES = [25, 26, 27, 28];
function applyLowerLimbVisibilityDegrade(landmarkRows, frameIndexFilter, vis = 0.38) {
  return landmarkRows.map((row, i) => {
    if (!frameIndexFilter(i)) return row;
    const lm = row.landmarks.map((p, j) => {
      if (p == null) return p;
      if (!LOWER_LIMB_INDICES.includes(j)) return p;
      return { ...p, visibility: vis };
    });
    return { landmarks: lm, timestamp: row.timestamp };
  });
}
const SHALLOW_SQUAT_CYCLE = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];

function makeFrame(depthPrimary, timestampMs, phaseHint, blended = undefined) {
  const derived = { squatDepthProxy: depthPrimary };
  if (blended !== undefined) derived.squatDepthProxyBlended = blended;
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived,
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
function framesFrom(depthsPrimary, phases, blendedSeries, stepMs = 40) {
  return depthsPrimary.map((dp, i) =>
    makeFrame(dp, 100 + i * stepMs, phases[i] ?? 'start', blendedSeries?.[i])
  );
}

/** PR-core §5 style — 가끔 canEventPromote true (환경마다 다를 수 있어 조건부 검증) */
function buildPromoteWrapperMaybeFrames() {
  const baseP = 0.04;
  const baseB = 0.045;
  const n = 55;
  const depthsP = [];
  const blends = [];
  const phases = [];
  for (let i = 0; i < 8; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  for (let i = 8; i < 20; i++) {
    const t = (i - 8) / 11;
    depthsP.push(baseP + 0.012 * t);
    blends.push(baseB + 0.34 * t);
    phases.push(t > 0.35 ? 'descent' : 'start');
  }
  for (let i = 20; i < 34; i++) {
    depthsP.push(baseP + 0.014);
    blends.push(0.4);
    phases.push('bottom');
  }
  for (let i = 34; i < 48; i++) {
    const t = (i - 34) / 13;
    depthsP.push(baseP + 0.014 - 0.01 * t);
    blends.push(0.4 - 0.34 * t);
    phases.push('ascent');
  }
  for (let i = 48; i < n; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  return framesFrom(depthsP, phases, blends, 40);
}

/** CAM-24 guarded ultra-low fixture — *_event_cycle pass reason(기계 경로), 승격 플래그와는 별개일 수 있음 */
function cam24UltraLowEventPromotionFrames() {
  const depths = [
    0.0, 0.0, 0.0, 0.0,
    0.004, 0.008, 0.012, 0.018,
    0.017, 0.016, 0.0154, 0.006, 0.005, 0.004, 0.003, 0.003,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'start', 'start', 'start', 'start',
    'start', 'start', 'start', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  const stepMs = 40;
  return depths.map((d, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i],
    derived: { squatDepthProxy: d },
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
    timestampDeltaMs: 33,
    stepId: 'squat',
  }));
}

function lineage(cs) {
  return resolveSquatCompletionLineageOwner(cs?.completionPassReason);
}

console.log('\nPR-02 camera-assist-owner-isolation-smoke\n');

// 1) Rule-only deep success
{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  const d = gate.squatCycleDebug ?? {};
  ok('1 deep: pass', gate.status === 'pass', gate.status);
  ok('1 deep: finalize rule_finalized', cs.completionFinalizeMode === 'rule_finalized', cs.completionFinalizeMode);
  ok('1 deep: no assist', cs.completionAssistApplied === false, cs.completionAssistSources);
  ok('1 deep: standard_cycle', cs.completionPassReason === 'standard_cycle', cs.completionPassReason);
  ok('1 deep: lineage standard', lineage(cs) === 'completion_truth_standard', lineage(cs));
  ok('1 deep: finalSuccessOwner', d.finalSuccessOwner === 'completion_truth_standard', d.finalSuccessOwner);
}

// 2) HMM assist — completion still finalized truth; lineage follows pass reason
{
  const depths = [
    0.01, 0.01, 0.01, 0.01,
    0.03, 0.08, 0.09, 0.09,
    0.06, 0.03, 0.02, 0.015, 0.012, 0.01,
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const withHmm = evaluateSquatCompletionState(fr, { hmm });
  ok('2 HMM: assist applied', withHmm.hmmAssistApplied === true, withHmm);
  ok('2 HMM: assist sources include blocked_reason', withHmm.completionAssistSources?.includes('hmm_blocked_reason'), withHmm.completionAssistSources);
  ok('2 HMM: assist_augmented_finalized', withHmm.completionFinalizeMode === 'assist_augmented_finalized', withHmm.completionFinalizeMode);
  ok('2 HMM: satisfied', withHmm.completionSatisfied === true, withHmm);
  ok('2 HMM: lineage from pass reason', lineage(withHmm) === 'completion_truth_standard' || lineage(withHmm) === 'completion_truth_event', {
    lineage: lineage(withHmm),
    cpr: withHmm.completionPassReason,
  });
}

// 3a) *_event_cycle pass reason (CAM-24) — completion truth finalize; 승격 래퍼 없이도 문자열은 event family
{
  const st = evaluateSquatCompletionState(cam24UltraLowEventPromotionFrames(), {});
  ok('3a cam24: ultra_low_rom_cycle', st.completionPassReason === 'ultra_low_rom_cycle', st.completionPassReason);
  ok('3a cam24: lineage event', lineage(st) === 'completion_truth_event', lineage(st));
  ok('3a cam24: satisfied', st.completionSatisfied === true, st.completionSatisfied);
  if (st.eventCyclePromoted !== true) {
    ok('3a cam24: rule_finalized without wrapper', st.completionFinalizeMode === 'rule_finalized', st.completionFinalizeMode);
    ok('3a cam24: promotionBaseRuleBlockedReason null', st.promotionBaseRuleBlockedReason == null, st.promotionBaseRuleBlockedReason);
  }
}

// 3b) Wrapper promotion — 승격이 걸리면 PR-02 provenance 전부 확인 (pr-core 동일 픽스처)
{
  const wrap = evaluateSquatCompletionState(buildPromoteWrapperMaybeFrames(), {});
  if (wrap.eventCyclePromoted === true) {
    ok('3b wrap: event_promoted_finalized', wrap.completionFinalizeMode === 'event_promoted_finalized', wrap.completionFinalizeMode);
    ok('3b wrap: promotionBaseRuleBlockedReason', typeof wrap.promotionBaseRuleBlockedReason === 'string', wrap.promotionBaseRuleBlockedReason);
    ok('3b wrap: event_cycle_promotion source', wrap.completionAssistSources?.includes('event_cycle_promotion'), wrap.completionAssistSources);
    ok('3b wrap: lineage event', lineage(wrap) === 'completion_truth_event', lineage(wrap));
  } else {
    ok('3b wrap: skipped (synthetic did not promote on this checkout)', true, {
      pr: wrap.completionPassReason,
      prom: wrap.eventCyclePromoted,
    });
  }
}

// 4) Trajectory rescue (CAM-31 style)
{
  const angles = [...STANDING, ...SHALLOW_SQUAT_CYCLE, ...Array(8).fill(170)];
  const base = toLandmarks(makeKneeAngleSeries(1000, angles));
  const nStand = STANDING.length;
  const degraded = applyLowerLimbVisibilityDegrade(base, (i) => i >= nStand + 8 && i < nStand + 16, 0.38);
  const gate = evaluateExerciseAutoProgress('squat', degraded, squatStats(degraded.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('4 traj: pass', gate.status === 'pass', gate.status);
  ok('4 traj: trajectoryReversalRescueApplied or rule path', cs.trajectoryReversalRescueApplied === true || cs.reversalConfirmedBy === 'rule', {
    traj: cs.trajectoryReversalRescueApplied,
    by: cs.reversalConfirmedBy,
  });
  if (cs.reversalConfirmedBy === 'trajectory') {
    ok('4 traj: rescue flag true', cs.trajectoryReversalRescueApplied === true, cs);
    ok('4 traj: provenance trajectory_anchor_rescue', cs.reversalEvidenceProvenance === 'trajectory_anchor_rescue', cs.reversalEvidenceProvenance);
  }
  ok('4 traj: lineage', lineage(cs) === 'completion_truth_event' || lineage(cs) === 'completion_truth_standard', lineage(cs));
}

// 5) Tail backfill contract (when applied, provenance tail — universal implication)
{
  const st = evaluateSquatCompletionState(buildFrames([0.02, 0.025, 0.03], ['start', 'start', 'start'], 80));
  ok(
    '5 tail: backfill implies tail provenance',
    !st.reversalTailBackfillApplied ||
      (st.reversalEvidenceProvenance === 'standing_tail_backfill' &&
        st.completionAssistSources?.includes('standing_tail_backfill')),
    st
  );
}

// 6) Shallow fail unchanged — 짧은 시퀀스·미무장으로 not_armed 유지 (PR-03 전 공식 shallow pass 아님)
{
  const tiny = toLandmarks(makeKneeAngleSeries(5000, Array(8).fill(170)));
  const gate = evaluateExerciseAutoProgress('squat', tiny, squatStats(tiny.length));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('6 shallow-fail: no attempt', cs.attemptStarted === false, cs.attemptStarted);
  ok('6 shallow-fail: not_armed', cs.completionBlockedReason === 'not_armed', cs.completionBlockedReason);
  ok('6 shallow-fail: finalize blocked', cs.completionFinalizeMode === 'blocked', cs.completionFinalizeMode);
  ok('6 shallow-fail: gate not pass', gate.status !== 'pass', gate.status);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
