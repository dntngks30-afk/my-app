/**
 * PR-HMM-04B — deep no_reversal HMM reversal assist
 *
 * npx tsx scripts/camera-pr-hmm-04b-squat-reversal-assist-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');
const { buildSquatReversalAssistTraceCompact } = await import('../src/lib/camera/squat/squat-reversal-assist.ts');

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

/**
 * 깊은 피크(상대 ~0.71) 후 피크−dropRequired 아래로 내려가지 않아 기하 역전 미탐(no_reversal).
 * 피크 이후 완만한 상승(깊이 감소)만 있어 getSquatRecoverySignal의 drop ratio로 복귀 증거는 유지.
 * (서기 테일이 있으면 기하 역전이 먼저 성립해 버려 스모크가 깨짐)
 */
function framesDeepNoGeomReversalButRecovery() {
  const postPeak = Array.from({ length: 16 }, (_, i) => 0.74 - i * 0.005);
  const depths = [
    0.04, 0.04, 0.04, 0.04, 0.04, 0.04,
    0.06, 0.12, 0.28, 0.48, 0.62, 0.72, 0.75, 0.75, 0.74,
    ...postPeak,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom',
    ...Array(16).fill('ascent'),
  ];
  return buildFrames(depths, phases, 40);
}

console.log('\n-- A. deep, rule no_reversal without assist, strong HMM → reversal assist applied --');
{
  const fr = framesDeepNoGeomReversalButRecovery();
  const hmm = decodeSquatHmm(fr);
  const without = evaluateSquatCompletionState(fr, {});
  const withHmm = evaluateSquatCompletionState(fr, { hmm });
  ok('A: without HMM rule is no_reversal', without.ruleCompletionBlockedReason === 'no_reversal', without);
  ok('A: relative peak deep', (withHmm.relativeDepthPeak ?? 0) >= 0.35, withHmm.relativeDepthPeak);
  ok('A: reversal assist applied', withHmm.hmmReversalAssistApplied === true, withHmm);
  ok('A: rule no longer no_reversal', withHmm.ruleCompletionBlockedReason !== 'no_reversal', withHmm);
}

console.log('\n-- B. shallow ambiguous: no_reversal, weak HMM → assist not applied --');
{
  const depths = [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
    0.03, 0.045, 0.055, 0.06, 0.058, 0.052, 0.048, 0.045, 0.042, 0.038, 0.034, 0.032,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'bottom', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start', 'start',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  ok('B: rule still no_reversal or earlier block', st.ruleCompletionBlockedReason === 'no_reversal' || st.ruleCompletionBlockedReason != null, st);
  ok('B: reversal assist not applied', st.hmmReversalAssistApplied !== true, st);
}

console.log('\n-- C. finalize blocked: still no spurious pass --');
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
  ok('C: completion false', st.completionSatisfied === false, st);
  const finFam =
    st.ruleCompletionBlockedReason === 'ultra_low_rom_standing_finalize_not_satisfied' ||
    st.ruleCompletionBlockedReason === 'recovery_hold_too_short' ||
    st.ruleCompletionBlockedReason === 'low_rom_standing_finalize_not_satisfied';
  ok('C: finalize family rule block', finFam, st.ruleCompletionBlockedReason);
}

console.log('\n-- D. jitter: reversal assist off --');
{
  const depths = Array(20).fill(0.005).map((_, i) => 0.004 + (i % 3) * 0.0008);
  const phases = Array(20).fill('start');
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const res = evaluateSquatFromPoseFrames(fr);
  const st = res.debug?.squatCompletionState;
  ok('D: no reversal assist applied', st?.hmmReversalAssistApplied !== true, st);
}

console.log('\n-- E. observability shape (evaluator path) --');
{
  const fr = framesDeepNoGeomReversalButRecovery();
  const res = evaluateSquatFromPoseFrames(fr);
  const hm = res.debug?.highlightedMetrics;
  const st = res.debug?.squatCompletionState;
  ok('E: highlighted reversal flags', hm?.hmmReversalAssistApplied === 1 || hm?.hmmReversalAssistApplied === 0, hm);
  const hra = buildSquatReversalAssistTraceCompact(
    st?.hmmReversalAssistEligible,
    st?.hmmReversalAssistApplied,
    st?.hmmReversalAssistReason ?? null
  );
  ok('E: hra keys', 'hrae' in hra && 'hraa' in hra && 'hrar' in hra, hra);
}

console.log(`\n== PR-HMM-04B reversal assist smoke: ${passed} passed, ${failed} failed ==\n`);
