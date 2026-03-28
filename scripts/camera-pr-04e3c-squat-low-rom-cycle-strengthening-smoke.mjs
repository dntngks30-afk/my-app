/**
 * PR-04E3C — reversal-lite / recovery-lite + promotion gate
 *
 * npx tsx scripts/camera-pr-04e3c-squat-low-rom-cycle-strengthening-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');

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

function framesFrom(depthsPrimary, phases, blendedSeries, stepMs = 40) {
  return depthsPrimary.map((dp, i) =>
    makeFrame(dp, 100 + i * stepMs, phases[i] ?? 'start', blendedSeries?.[i])
  );
}

function buildShallowBlendedCycle() {
  const baseP = 0.04;
  const baseB = 0.045;
  const n = 40;
  const depthsP = [];
  const blends = [];
  const phases = [];
  for (let i = 0; i < 6; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  for (let i = 6; i < 14; i++) {
    const t = (i - 6) / 7;
    depthsP.push(baseP + 0.008 * t);
    blends.push(baseB + 0.35 * t);
    phases.push(t > 0.35 ? 'descent' : 'start');
  }
  for (let i = 14; i < 20; i++) {
    depthsP.push(baseP + 0.01);
    blends.push(0.42);
    phases.push('bottom');
  }
  for (let i = 20; i < 32; i++) {
    const t = (i - 20) / 11;
    depthsP.push(baseP + 0.01 - 0.005 * t);
    blends.push(0.42 - 0.36 * t);
    phases.push('ascent');
  }
  for (let i = 32; i < n; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  return framesFrom(depthsP, phases, blends, 40);
}

console.log('\n── A. shallow meaningful cycle + real return ──');
{
  const fr = buildShallowBlendedCycle();
  const st = evaluateSquatCompletionState(fr, {});
  ok('A1: eventCycleDetected', st.squatEventCycle?.detected === true, st.squatEventCycle);
  ok('A2: reversalLiteConfirmed', st.reversalLiteConfirmed === true, st);
  ok('A3: recoveryLiteConfirmed', st.recoveryLiteConfirmed === true, st);
  const prOk =
    st.completionPassReason === 'low_rom_event_cycle' ||
    st.completionPassReason === 'ultra_low_rom_event_cycle';
  ok('A4: low/ultra event cycle owner', prOk, st.completionPassReason);
}

console.log('\n── B. shallow downward-only (no standing return) ──');
{
  const baseP = 0.04;
  const baseB = 0.045;
  const depthsP = [];
  const blends = [];
  const phases = [];
  for (let i = 0; i < 6; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  for (let i = 6; i < 26; i++) {
    const t = (i - 6) / 19;
    depthsP.push(baseP + 0.006 * t);
    blends.push(baseB + 0.22 * t);
    phases.push('descent');
  }
  for (let i = 26; i < 36; i++) {
    depthsP.push(baseP + 0.05);
    blends.push(0.3);
    phases.push('bottom');
  }
  const fr = framesFrom(depthsP, phases, blends, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('B: eventCyclePromoted false without return/finalize path', st.eventCyclePromoted !== true, st);
}

console.log('\n── C. bottom jitter / wobble (peak at tail, no post-peak return) ──');
{
  /** 단조 상승만 있고 피크 이후 하락·복귀 구간 없음 → lite·detected 거절 */
  const dp = [];
  const bl = [];
  const phases = [];
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    dp.push(0.05 + 0.025 * t);
    bl.push(0.052 + 0.026 * t);
    phases.push(i < 6 ? 'start' : 'descent');
  }
  const fr = framesFrom(dp, phases, bl, 45);
  const st = evaluateSquatCompletionState(fr, {});
  ok('C1: reversalLite false', st.reversalLiteConfirmed !== true, st);
  ok('C2: recoveryLite false', st.recoveryLiteConfirmed !== true, st);
  ok('C3: event cycle not a completed shallow candidate', st.squatEventCycle?.detected !== true, st.squatEventCycle);
}

console.log('\n── D. deep standard_cycle ──');
{
  const dp = [];
  const phases = [];
  for (let i = 0; i < 6; i++) {
    dp.push(0.05);
    phases.push('start');
  }
  for (let i = 6; i < 14; i++) {
    const t = (i - 6) / 8;
    dp.push(0.05 + 0.5 * t);
    phases.push('descent');
  }
  for (let i = 14; i < 20; i++) {
    dp.push(0.58);
    phases.push('bottom');
  }
  for (let i = 20; i < 34; i++) {
    const t = (i - 20) / 13;
    dp.push(0.58 - 0.53 * t);
    phases.push('ascent');
  }
  for (let i = 34; i < 42; i++) {
    dp.push(0.05);
    phases.push('start');
  }
  const fr = framesFrom(dp, phases, undefined, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('D: standard_cycle preserved', st.completionPassReason === 'standard_cycle', st);
}

console.log('\n── E. observability shape ──');
{
  const fr = buildShallowBlendedCycle();
  const er = evaluateSquatFromPoseFrames(fr);
  const hm = er.debug?.highlightedMetrics ?? {};
  ok('E1: squatReversalLiteConfirmed', typeof hm.squatReversalLiteConfirmed === 'number', hm);
  ok('E2: squatRecoveryLiteConfirmed', typeof hm.squatRecoveryLiteConfirmed === 'number', hm);
  ok('E3: squatReversalLiteFrames', hm.squatReversalLiteFrames != null, hm);
  ok('E4: squatReversalLiteDrop', hm.squatReversalLiteDrop != null, hm);
  const ec = er.debug?.squatEventCycle;
  ok('E5: squatEventCycle has lite fields', ec?.reversalLiteConfirmed === true && ec?.recoveryLiteConfirmed === true, ec);
}

console.log(`\n━━━ PR-04E3C smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) console.log('✓ All acceptance criteria met');
