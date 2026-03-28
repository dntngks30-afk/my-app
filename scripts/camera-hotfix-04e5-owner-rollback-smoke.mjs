/**
 * HOTFIX-04E5-OWNER-ROLLBACK-01: completion owner 는 squatDepthProxy 만; stable 은 관측 전용.
 *
 * npx tsx scripts/camera-hotfix-04e5-owner-rollback-smoke.mjs
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
  const derived = {
    squatDepthProxy: depthPrimary,
    squatDepthPrimaryStable: depthPrimary,
    squatDepthPrimaryJumpSuppressed: false,
  };
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

console.log('\n── A. shallow blended low-ROM event-cycle (pre-04E5 owner 경로) ──');
{
  const fr = buildShallowBlendedCycle();
  const st = evaluateSquatCompletionState(fr, {});
  const prOk =
    st.completionPassReason === 'low_rom_event_cycle' ||
    st.completionPassReason === 'ultra_low_rom_event_cycle';
  ok('A1: low/ultra event cycle pass', prOk, st.completionPassReason);
}

console.log('\n── B. deep standard_cycle ──');
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
  ok('B1: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
}

console.log('\n── C. standing / micro dip 차단 ──');
{
  const dp = [];
  const phases = [];
  for (let i = 0; i < 30; i++) {
    const d = 0.025 + (i === 12 ? 0.015 : 0);
    dp.push(d);
    phases.push('start');
  }
  const fr = framesFrom(dp, phases, undefined, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('C1: completionSatisfied === false', st.completionSatisfied === false, st.completionSatisfied);
}

console.log('\n── D. PR-04E5 관측 필드 + HOTFIX stableObs ──');
{
  const fr = buildShallowBlendedCycle();
  const er = evaluateSquatFromPoseFrames(fr);
  const hm = er.debug?.highlightedMetrics ?? {};
  const st = er.debug?.squatCompletionState;
  ok('D1: squatPrimaryStablePeak', typeof hm.squatPrimaryStablePeak === 'number', hm.squatPrimaryStablePeak);
  ok('D2: squatPrimaryJumpSuppressedCount', typeof hm.squatPrimaryJumpSuppressedCount === 'number', hm.squatPrimaryJumpSuppressedCount);
  ok('D3: squatRawDepthPeakPrimaryStableObs in highlightedMetrics', hm.squatRawDepthPeakPrimaryStableObs != null, hm.squatRawDepthPeakPrimaryStableObs);
  ok(
    'D4: state.rawDepthPeakPrimaryStableObs',
    st != null && typeof st.rawDepthPeakPrimaryStableObs === 'number',
    st?.rawDepthPeakPrimaryStableObs
  );
  ok(
    'D5: calibration rawDepthPeakPrimaryStableObs',
    er.debug?.squatDepthCalibration?.rawDepthPeakPrimaryStableObs != null,
    er.debug?.squatDepthCalibration?.rawDepthPeakPrimaryStableObs
  );
}

console.log(`\n━━━ HOTFIX-04E5 owner rollback smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) console.log('✓ All acceptance criteria met');
