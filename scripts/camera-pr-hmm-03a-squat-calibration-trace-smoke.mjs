/**
 * PR-HMM-03A — calibration observability contract (threshold 변경 없음)
 *
 * npx tsx scripts/camera-pr-hmm-03a-squat-calibration-trace-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');
const {
  buildSquatCalibrationTraceCompact,
  SQUAT_CALIBRATION_TRACE_COMPACT_KEYS,
} = await import('../src/lib/camera/squat/squat-calibration-trace.ts');
const { SQUAT_HMM_ASSIST_THRESHOLDS } = await import('../src/lib/camera/squat/squat-hmm-assist.ts');

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

console.log('\n-- A. descent_span assist: ruleBlocked !== finalBlocked, assistApplied --');
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
  ok('A: rule blocked was descent_span', st.ruleCompletionBlockedReason === 'descent_span_too_short', st);
  ok('A: final blocked null', st.postAssistCompletionBlockedReason === null, st);
  ok('A: rule !== final', st.ruleCompletionBlockedReason !== st.postAssistCompletionBlockedReason, st);
  ok('A: assist applied', st.hmmAssistApplied === true, st);
  ok('A: completion true', st.completionSatisfied === true, st);
  ok('A: not suppressed by finalize', st.assistSuppressedByFinalize === false, st);
}

console.log('\n-- B. strong HMM + finalize family rule block -> assistSuppressedByFinalize --');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01,
    0.03, 0.05, 0.07, 0.09, 0.09,
    0.07, 0.05, 0.03, 0.02, 0.015,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'ascent', 'ascent',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  const fin =
    st.ruleCompletionBlockedReason === 'recovery_hold_too_short' ||
    st.ruleCompletionBlockedReason === 'low_rom_standing_finalize_not_satisfied' ||
    st.ruleCompletionBlockedReason === 'ultra_low_rom_standing_finalize_not_satisfied';
  ok('B: rule is finalize family', fin, st);
  ok('B: assistSuppressedByFinalize', st.assistSuppressedByFinalize === true, st);
  ok('B: assist not applied', st.hmmAssistApplied === false, st);
  ok('B: rule === final blocked', st.ruleCompletionBlockedReason === st.postAssistCompletionBlockedReason, st);
}

console.log('\n-- C. finalize blocked: assist does not open (rule === final) --');
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
  ok('C: rule === postAssist', st.ruleCompletionBlockedReason === st.postAssistCompletionBlockedReason, st);
}

console.log('\n-- D. jitter / weak HMM -> assist off --');
{
  const depths = Array(20).fill(0.005).map((_, i) => 0.004 + (i % 3) * 0.0008);
  const phases = Array(20).fill('start');
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  ok('D: assist eligible false', st.hmmAssistEligible === false, st);
  ok('D: assist applied false', st.hmmAssistApplied === false, st);
}

console.log('\n-- E. compact trace shape --');
{
  // A와 동일한 descent_span + assist 케이스로 rb가 assistable일 때 t 스냅샷을 검증한다.
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
  const compact = buildSquatCalibrationTraceCompact(st, hmm);
  for (const k of SQUAT_CALIBRATION_TRACE_COMPACT_KEYS) {
    ok(`E: key ${k}`, Object.prototype.hasOwnProperty.call(compact, k), compact);
  }
  ok('E: hcnts has s,d,b,a', 's' in compact.hcnts && 'd' in compact.hcnts, compact.hcnts);
  ok('E: assistable rb has threshold snapshot t', compact.t != null, compact.t);
  ok(
    'E: descent_span threshold confidence',
    compact.t.c === SQUAT_HMM_ASSIST_THRESHOLDS.descent_span_too_short.minHmmConfidence,
    compact.t
  );
  ok('E: t has c,e,d,a', 'c' in compact.t && 'e' in compact.t && 'd' in compact.t && 'a' in compact.t, compact.t);
  ok(
    'E: hcb confidence breakdown',
    compact.hcb != null && 'x' in compact.hcb && 's' in compact.hcb && 'c' in compact.hcb && 'n' in compact.hcb,
    compact.hcb
  );
}

console.log(`\n== PR-HMM-03A calibration smoke: ${passed} passed, ${failed} failed ==\n`);
