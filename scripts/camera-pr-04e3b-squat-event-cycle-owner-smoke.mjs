/**
 * PR-04E3B — baseline freeze, peak latch, shallow event-cycle owner
 *
 * npx tsx scripts/camera-pr-04e3b-squat-event-cycle-owner-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { detectSquatEventCycle } = await import('../src/lib/camera/squat/squat-event-cycle.ts');

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

/**
 * PR-04E3A-style shallow blended meaningful cycle.
 * primary 깊이를 bottom 구간에서 충분히 올려 reversal(주로 primary 기하)이 잡히게 하고,
 * tail 을 길게 두어 recovery finalize 가 성립하도록 한다 (PR-03 공식 path / 이벤트 승격 검증용).
 */
function buildShallowBlendedCycle() {
  const baseP = 0.04;
  const baseB = 0.045;
  const peakP = baseP + 0.06;
  const n = 52;
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
    depthsP.push(baseP + (peakP - baseP) * t);
    blends.push(baseB + 0.35 * t);
    phases.push(t > 0.35 ? 'descent' : 'start');
  }
  for (let i = 14; i < 20; i++) {
    depthsP.push(peakP);
    blends.push(0.42);
    phases.push('bottom');
  }
  for (let i = 20; i < 32; i++) {
    const t = (i - 20) / 11;
    depthsP.push(peakP - (peakP - baseP) * t);
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

console.log('\n── A. shallow meaningful cycle + blended relative peak ──');
{
  const fr = buildShallowBlendedCycle();
  const st = evaluateSquatCompletionState(fr, {});
  ok('A1: baselineFrozen', st.baselineFrozen === true, st);
  ok('A2: peakLatched', st.peakLatched === true, st);
  ok('A3: event cycle detected', st.squatEventCycle?.detected === true, st.squatEventCycle);
  const prOk =
    st.completionPassReason === 'low_rom_cycle' ||
    st.completionPassReason === 'ultra_low_rom_cycle' ||
    st.completionPassReason === 'low_rom_event_cycle' ||
    st.completionPassReason === 'ultra_low_rom_event_cycle';
  ok('A4: completion official low/ultra cycle (PR-03)', prOk, st.completionPassReason);
}

console.log('\n── B. prefix blocked-reason set stabilizes (no churn class) ──');
{
  const fr = buildShallowBlendedCycle();
  const churn = new Set();
  for (let n = 8; n <= fr.length; n++) {
    const sub = evaluateSquatCompletionState(fr.slice(0, n), {});
    if (sub.ruleCompletionBlockedReason) churn.add(sub.ruleCompletionBlockedReason);
  }
  const bad = ['insufficient_relative_depth', 'no_descend', 'no_reversal'];
  const hasAllChurn = bad.every((b) => churn.has(b));
  ok('B: not all three churn reasons appear across prefixes', !hasAllChurn, [...churn]);
}

console.log('\n── C. bottom jitter only ──');
{
  const base = 0.05;
  const phases = [];
  const dp = [];
  const bl = [];
  for (let i = 0; i < 8; i++) {
    dp.push(base);
    bl.push(base + 0.002);
    phases.push('start');
  }
  for (let i = 8; i < 14; i++) {
    dp.push(base + 0.012);
    bl.push(base + 0.05);
    phases.push('bottom');
  }
  for (let i = 14; i < 22; i++) {
    dp.push(base);
    bl.push(base + 0.002);
    phases.push('start');
  }
  const fr = framesFrom(dp, phases, bl, 50);
  const st = evaluateSquatCompletionState(fr, {});
  ok('C: event cycle not detected for jitter', st.squatEventCycle?.detected !== true, st.squatEventCycle);
}

console.log('\n── D. deep standard stays standard_cycle ──');
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
  ok('D: standard_cycle when deep unblocked', st.completionPassReason === 'standard_cycle', st);
}

console.log('\n── E. incomplete shallow (no tail recovery) ──');
{
  const baseP = 0.04;
  const baseB = 0.045;
  const n = 22;
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
    depthsP.push(baseP + 0.006 * t);
    blends.push(baseB + 0.2 * t);
    phases.push('descent');
  }
  for (let i = 14; i < n; i++) {
    depthsP.push(baseP + 0.04);
    blends.push(0.28);
    phases.push('bottom');
  }
  const fr = framesFrom(depthsP, phases, blends, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('E: event cycle false without recovery tail', st.squatEventCycle?.detected !== true, st.squatEventCycle);
}

console.log('\n── F. evaluator + highlighted shape ──');
{
  const fr = buildShallowBlendedCycle();
  const er = evaluateSquatFromPoseFrames(fr);
  const hm = er.debug?.highlightedMetrics ?? {};
  ok('F1: squatEventCycle on debug', er.debug?.squatEventCycle != null, er.debug);
  ok('F2: squatBaselineFrozen code', typeof hm.squatBaselineFrozen === 'number', hm);
  ok('F3: squatEventCycleBandCode', typeof hm.squatEventCycleBandCode === 'number', hm);
  ok('F4: squatEventCyclePromoted', typeof hm.squatEventCyclePromoted === 'number', hm);
}

console.log('\n── G. detectSquatEventCycle export sanity ──');
{
  const fr = buildShallowBlendedCycle();
  const ec = detectSquatEventCycle(fr.filter((f) => f.isValid), {
    baselineFrozen: true,
    peakLatched: true,
    baselineFrozenDepth: 0.045,
    lockedSource: 'blended',
    peakLatchedAtIndex: 12,
  });
  ok('G: helper returns shape', typeof ec.detected === 'boolean' && Array.isArray(ec.notes), ec);
}

console.log(`\n━━━ PR-04E3B smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) console.log('✓ All acceptance criteria met');
