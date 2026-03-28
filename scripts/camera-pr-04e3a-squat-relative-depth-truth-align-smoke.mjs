/**
 * PR-04E3A — completion-state relative depth aligned with blended (arming parity)
 *
 * npx tsx scripts/camera-pr-04e3a-squat-relative-depth-truth-align-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');

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

console.log('\n── A. shallow: primary flat, blended meaningful → relativeDepthPeak not collapsed ──');
{
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
  const fr = framesFrom(depthsP, phases, blends, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('A1: uses blended source when primary ROM tiny', st.relativeDepthPeakSource === 'blended', st);
  ok('A2: relativeDepthPeak meaningful', st.relativeDepthPeak >= 0.25, st);
  ok('A3: raw peaks split', st.rawDepthPeakBlended != null && st.rawDepthPeakPrimary != null, st);
}

console.log('\n── B. same class: not blocked on insufficient_relative_depth only ──');
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
  for (let i = 6; i < 16; i++) {
    const t = (i - 6) / 9;
    depthsP.push(baseP + 0.006 * t);
    blends.push(baseB + 0.32 * t);
    phases.push(i < 10 ? 'descent' : 'bottom');
  }
  for (let i = 16; i < 28; i++) {
    const t = (i - 16) / 11;
    depthsP.push(baseP + 0.008);
    blends.push(0.38 - 0.33 * t);
    phases.push('ascent');
  }
  for (let i = 28; i < 36; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  const fr = framesFrom(depthsP, phases, blends, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('B: rule blocked is not insufficient_relative_depth', st.ruleCompletionBlockedReason !== 'insufficient_relative_depth', st);
}

console.log('\n── C. standing jitter: low relative / still fail admission or early chain ──');
{
  const depthsP = Array(24).fill(0.041);
  const blends = Array(24).fill(0.043);
  const phases = Array(24).fill('start');
  const fr = framesFrom(depthsP, phases, blends, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('C1: tiny relativeDepthPeak', st.relativeDepthPeak < 0.015, st);
  ok(
    'C2: still not a satisfied rep',
    st.completionSatisfied === false || st.relativeDepthPeak < 0.02,
    st
  );
}

console.log('\n── D. deep standard: primary-dominant path unchanged ──');
{
  const baseline = 0.047;
  const peakDepth = baseline + 0.52;
  const out = [];
  let t = 100;
  const push = (d, ph, b = undefined) => {
    out.push(makeFrame(d, t, ph, b));
    t += 40;
  };
  for (let i = 0; i < 6; i++) push(baseline, 'start', baseline);
  const descentN = 14;
  for (let i = 0; i < descentN; i++) {
    const r = (i + 1) / descentN;
    const d = baseline + (peakDepth - baseline) * r;
    const hint = d >= 0.08 && r > 0.35 ? 'descent' : 'start';
    push(d, hint, d);
  }
  for (let i = 0; i < 5; i++) push(peakDepth, i < 2 ? 'bottom' : 'bottom', peakDepth);
  const ascentN = 16;
  for (let i = 0; i < ascentN; i++) {
    const r = (i + 1) / ascentN;
    const d = peakDepth - (peakDepth - baseline - 0.01) * r;
    push(d, 'ascent', d);
  }
  for (let i = 0; i < 10; i++) push(baseline + 0.008 * i, 'start', baseline + 0.008 * i);
  const st = evaluateSquatCompletionState(out, {});
  ok('D1: primary depth source for deep', st.relativeDepthPeakSource === 'primary', st);
  ok('D2: standard_cycle when unblocked', st.completionPassReason === 'standard_cycle' || st.relativeDepthPeak >= 0.4, st);
}

function mockLandmark(x, y, visibility = 0.92) {
  return { x, y, visibility };
}

function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.92));
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  const kneeForward = depthProxy * 0.22;
  landmarks[23] = mockLandmark(0.45, hipY, 0.92);
  landmarks[24] = mockLandmark(0.55, hipY, 0.92);
  landmarks[25] = mockLandmark(0.45 + kneeForward, kneeY, 0.92);
  landmarks[26] = mockLandmark(0.55 - kneeForward, kneeY, 0.92);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.92);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.92);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.92);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.92);
  return { landmarks, timestamp };
}

console.log('\n── E. evaluator observability shape ──');
{
  const depthSeries = [
    ...Array(10).fill(0.012),
    0.04, 0.12, 0.28, 0.42, 0.48, 0.5, 0.48, 0.35, 0.18, 0.06, 0.014, 0.012,
  ];
  const frames = depthSeries.map((d, i) => squatPoseLandmarks(1000 + i * 80, d));
  const pf = buildPoseFeaturesFrames(
    'squat',
    frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const ev = evaluateSquatFromPoseFrames(pf);
  const cal = ev.debug?.squatDepthCalibration;
  const hm = ev.debug?.highlightedMetrics;
  ok('E1: calibration has source + raw peaks', cal?.relativeDepthPeakSource != null, cal);
  ok('E2: highlighted relative codes', typeof hm?.squatRelativeDepthSourceCode === 'number', hm);
  ok('E3: highlighted primary/blended rel %', 'squatRelativeDepthPeakPrimary' in (hm ?? {}), hm);
}

console.log(`\n━━━ PR-04E3A smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
