/**
 * PR-HMM-04 — assist threshold calibration 회귀 (정책·observability 계약)
 *
 * npx tsx scripts/camera-pr-hmm-04-squat-threshold-calibration-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');
const {
  hmmMeetsAssistThresholdForBlockedReason,
  SQUAT_HMM_ASSIST_THRESHOLDS,
} = await import('../src/lib/camera/squat/squat-hmm-assist.ts');
const {
  buildSquatCalibrationTraceCompact,
  SQUAT_CALIBRATION_TRACE_COMPACT_KEYS,
} = await import('../src/lib/camera/squat/squat-calibration-trace.ts');

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

/** borderline HMM: 구 단일 0.45 바에서는 assist 탈락, descent_span 전용 완화로 통과 */
function framesBorderlineDescentSpan() {
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.024, 0.052, 0.062, 0.062, 0.043, 0.024, 0.017, 0.014, 0.012, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01, 0.01, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  return buildFrames(depths, phases, 40);
}

console.log('\n-- A. shallow meaningful cycle: assist 유지, completion true --');
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
  const st = evaluateSquatCompletionState(fr, { hmm });
  ok('A: rule was descent_span', st.ruleCompletionBlockedReason === 'descent_span_too_short', st);
  ok('A: assist applied', st.hmmAssistApplied === true, st);
  ok('A: completion true', st.completionSatisfied === true, st);
}

console.log('\n-- B. standing jitter / micro bend: assist 차단 --');
{
  const depths = Array(20).fill(0.005).map((_, i) => 0.004 + (i % 3) * 0.0008);
  const phases = Array(20).fill('start');
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  ok('B: assist eligible false', st.hmmAssistEligible === false, st);
  ok('B: assist applied false', st.hmmAssistApplied === false, st);
}

console.log('\n-- C. finalize blocked: assist 불가, rule === final --');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01,
    0.02, 0.035, 0.045, 0.048, 0.047,
    0.04, 0.03, 0.018, 0.014,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom', 'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'ascent',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  ok('C: assist not applied', st.hmmAssistApplied === false, st);
  ok('C: rule === postAssist blocked', st.ruleCompletionBlockedReason === st.postAssistCompletionBlockedReason, st);
}

console.log('\n-- D. borderline: descent_span 임계로 assist, no_reversal 임계는 더 빡세게 미충족 --');
{
  const fr = framesBorderlineDescentSpan();
  const hmm = decodeSquatHmm(fr);
  ok('D: borderline meets descent_span policy gate', hmmMeetsAssistThresholdForBlockedReason(hmm, 'descent_span_too_short'), hmm);
  ok(
    'D: same HMM fails stricter no_reversal gate',
    !hmmMeetsAssistThresholdForBlockedReason(hmm, 'no_reversal'),
    hmm
  );
  const st = evaluateSquatCompletionState(fr, { hmm });
  ok('D: rule descent_span', st.ruleCompletionBlockedReason === 'descent_span_too_short', st);
  ok('D: assist applied after threshold tune', st.hmmAssistApplied === true, st);
  ok('D: completion true', st.completionSatisfied === true, st);
}

console.log('\n-- E. observability: compact keys + threshold snapshot t --');
{
  const fr = framesBorderlineDescentSpan();
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  const compact = buildSquatCalibrationTraceCompact(st, hmm);
  for (const k of SQUAT_CALIBRATION_TRACE_COMPACT_KEYS) {
    ok(`E: key ${k}`, Object.prototype.hasOwnProperty.call(compact, k), compact);
  }
  ok('E: rb/fb/ae/aa contract', compact.rb === 'descent_span_too_short' && compact.fb === null, compact);
  ok('E: t matches SQUAT_HMM_ASSIST_THRESHOLDS.descent_span_too_short', compact.t != null, compact);
  const exp = SQUAT_HMM_ASSIST_THRESHOLDS.descent_span_too_short;
  ok(
    'E: t.c/e/d/a snapshot',
    compact.t.c === exp.minHmmConfidence &&
      compact.t.e === exp.minHmmExcursion &&
      compact.t.d === exp.minDescentCount &&
      compact.t.a === exp.minAscentCount,
    compact.t
  );
}

console.log(`\n== PR-HMM-04 threshold calibration smoke: ${passed} passed, ${failed} failed ==\n`);
