/**
 * PR-HMM-04A — HMM arming assist (shallow, not final pass)
 *
 * npx tsx scripts/camera-pr-hmm-04a-squat-arming-assist-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { buildSquatArmingAssistTraceCompact } = await import('../src/lib/camera/squat/squat-arming-assist.ts');

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
 * 버퍼가 하강으로 시작해 전역 피크 앞 10프레임 standing 런을 만들기 어렵게 하고,
 * 끝에서만 짧게 평탄화 — rule arming 실패 + HMM은 사이클 후보로 남기기 위한 합성.
 */
function framesShallowNoRuleArmStrongHmm() {
  const depths = [];
  const phases = [];
  for (let i = 0; i < 16; i++) {
    depths.push(0.036 + (i / 15) * 0.072);
    phases.push(i < 2 ? 'start' : i < 10 ? 'descent' : 'bottom');
  }
  for (let i = 0; i < 14; i++) {
    depths.push(0.108 - (i / 13) * 0.067);
    phases.push(i < 6 ? 'ascent' : 'start');
  }
  return buildFrames(depths, phases, 40);
}

console.log('\n-- A. rule armed=false, strong HMM → effectiveArmed true --');
{
  const fr = framesShallowNoRuleArmStrongHmm();
  const res = evaluateSquatFromPoseFrames(fr);
  const ca = res.debug?.squatCompletionArming;
  ok('A: enough frames', fr.length >= 8, fr.length);
  ok('A: rule not armed', ca?.armed === false, ca);
  ok('A: HMM arming assist applied', ca?.hmmArmingAssistApplied === true, ca);
  ok('A: effectiveArmed true', ca?.effectiveArmed === true, ca);
  ok('A: ruleBlocked not not_armed when assist', res.debug?.squatCompletionState?.ruleCompletionBlockedReason !== 'not_armed', res.debug?.squatCompletionState);
}

console.log('\n-- B. standing jitter → effectiveArmed false --');
{
  const depths = Array(20).fill(0.005).map((_, i) => 0.004 + (i % 3) * 0.0008);
  const phases = Array(20).fill('start');
  const fr = buildFrames(depths, phases, 40);
  const res = evaluateSquatFromPoseFrames(fr);
  const ca = res.debug?.squatCompletionArming;
  ok('B: effectiveArmed false', ca?.effectiveArmed === false, ca);
  ok('B: assist not applied', ca?.hmmArmingAssistApplied === false, ca);
}

console.log('\n-- C. deep normal cycle: rule armed, no arming assist --');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.01,
    0.04, 0.08, 0.14, 0.16, 0.16, 0.14, 0.1, 0.06, 0.03, 0.015, 0.012, 0.01,
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const fr = buildFrames(depths, phases, 40);
  const res = evaluateSquatFromPoseFrames(fr);
  const ca = res.debug?.squatCompletionArming;
  ok('C: rule armed', ca?.armed === true, ca);
  ok('C: hmm arming assist not applied', ca?.hmmArmingAssistApplied === false, ca);
  ok('C: effectiveArmed true', ca?.effectiveArmed === true, ca);
}

console.log('\n-- D. arming assist + finalize/recovery 미충족 → no final pass --');
{
  const fr = framesShallowNoRuleArmStrongHmm();
  const res = evaluateSquatFromPoseFrames(fr);
  const ca = res.debug?.squatCompletionArming;
  const st = res.debug?.squatCompletionState;
  ok('D: synthetic arming applied', ca?.hmmArmingAssistApplied === true, ca);
  ok('D: completion not satisfied (finalize/recovery still rule)', st?.completionSatisfied === false, st);
  ok('D: not standing_recovered', st?.currentSquatPhase !== 'standing_recovered', st);
  const finFam =
    st?.ruleCompletionBlockedReason === 'recovery_hold_too_short' ||
    st?.ruleCompletionBlockedReason === 'low_rom_standing_finalize_not_satisfied' ||
    st?.ruleCompletionBlockedReason === 'ultra_low_rom_standing_finalize_not_satisfied' ||
    st?.ruleCompletionBlockedReason === 'not_standing_recovered';
  ok('D: blocked on recovery/finalize family (not spurious pass)', finFam === true, st?.ruleCompletionBlockedReason);
}

console.log('\n-- E. observability: highlighted + arm compact --');
{
  const fr = framesShallowNoRuleArmStrongHmm();
  const res = evaluateSquatFromPoseFrames(fr);
  const hm = res.debug?.highlightedMetrics;
  ok('E: highlighted effectiveArmed', hm?.effectiveArmed === 1, hm);
  ok('E: highlighted hmmArmingAssistApplied', hm?.hmmArmingAssistApplied === 1, hm);
  const arm = buildSquatArmingAssistTraceCompact(res.debug?.squatCompletionArming);
  ok('E: arm.ea', arm.ea === true, arm);
  ok('E: arm.haa', arm.haa === true, arm);
  ok('E: arm keys hae,har', 'hae' in arm && 'har' in arm, arm);
}

console.log(`\n== PR-HMM-04A arming assist smoke: ${passed} passed, ${failed} failed ==\n`);
