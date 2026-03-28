/**
 * PR-04E2 — squat reversal confirmation stabilization (completion-state rule + optional HMM bridge)
 *
 * npx tsx scripts/camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { detectSquatReversalConfirmation } = await import(
  '../src/lib/camera/squat/squat-reversal-confirmation.ts'
);
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

function makeFrame(depth, timestampMs, phaseHint, blended = null) {
  const derived = { squatDepthProxy: depth };
  if (blended != null) derived.squatDepthProxyBlended = blended;
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

function framesFrom(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

/** 깊은 표준 사이클 — cam20 스타일 완만 하강·상승·스탠딩 테일 */
function deepStandardCycle() {
  const baseline = 0.047;
  const peakDepth = baseline + 0.52;
  const out = [];
  let t = 100;
  const push = (d, ph) => {
    out.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 6; i++) push(baseline, 'start');
  const descentN = 14;
  for (let i = 0; i < descentN; i++) {
    const r = (i + 1) / descentN;
    const d = baseline + (peakDepth - baseline) * r;
    const hint = d >= 0.08 && r > 0.35 ? 'descent' : 'start';
    push(d, hint);
  }
  for (let i = 0; i < 5; i++) push(peakDepth, i < 2 ? 'bottom' : 'bottom');
  const ascentN = 16;
  for (let i = 0; i < ascentN; i++) {
    const r = (i + 1) / ascentN;
    const d = peakDepth - (peakDepth - baseline - 0.01) * r;
    push(d, 'ascent');
  }
  for (let i = 0; i < 10; i++) push(baseline + 0.008 * i, 'start');
  return out;
}

console.log('\n── A. deep standard: reversal confirmed, rule chain not no_reversal ──');
{
  const fr = deepStandardCycle();
  const st = evaluateSquatCompletionState(fr, {});
  ok(
    'A1: reversalConfirmedBy set (rule family)',
    st.reversalConfirmedBy === 'rule' || st.reversalConfirmedBy === 'rule_plus_hmm',
    st
  );
  ok('A2: ruleCompletionBlockedReason not no_reversal', st.ruleCompletionBlockedReason !== 'no_reversal', st);
  ok('A3: reversal observability populated', st.reversalDepthDrop != null && st.reversalFrameCount != null, st);
}

console.log('\n── B. moderate ROM: small but real ascent drop ──');
{
  const baseline = 0.05;
  const peak = 0.27;
  const depths = [
    ...Array(6).fill(baseline),
    0.08, 0.12, 0.18, 0.22, 0.25, peak, peak,
    0.22, 0.18, 0.14, 0.1, 0.08, 0.065, 0.055,
    ...Array(8).fill(baseline),
  ];
  const phases = [
    ...Array(6).fill('start'),
    'descent',
    'descent',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
    ...Array(7).fill('ascent'),
    ...Array(8).fill('start'),
  ];
  const fr = framesFrom(depths, phases, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('B: not blocked on no_reversal', st.ruleCompletionBlockedReason !== 'no_reversal', st);
  ok('B: reversal marked', Boolean(st.reversalConfirmedBy), st);
}

console.log('\n── C. bottom jitter only: no stable reversal ──');
{
  const baseline = 0.04;
  const depths = [
    ...Array(6).fill(baseline),
    0.15, 0.28, 0.42, 0.48, 0.48, 0.47, 0.48, 0.47, 0.48, 0.47, 0.48, 0.47, 0.48,
  ];
  const phases = [
    ...Array(6).fill('start'),
    'descent',
    'descent',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
    'bottom',
  ];
  const fr = framesFrom(depths, phases, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('C: stays no_reversal or no commitment', st.ruleCompletionBlockedReason === 'no_reversal' || st.ruleCompletionBlockedReason === 'no_commitment', st);
  ok('C: reversalConfirmedBy null', st.reversalConfirmedBy == null, st);
}

console.log('\n── D. shallow ambiguous: avoid early reversal FP ──');
{
  const baseline = 0.04;
  const peak = 0.11;
  const reqApprox = Math.max(0.007, (peak - baseline) * 0.13);
  const dip = peak - reqApprox * 0.5;
  const depths = [
    ...Array(6).fill(baseline),
    0.07,
    0.09,
    peak,
    peak,
    dip,
    peak,
    dip,
    peak,
    ...Array(4).fill(baseline),
  ];
  const phases = [
    ...Array(6).fill('start'),
    'descent',
    'descent',
    'bottom',
    'bottom',
    'ascent',
    'bottom',
    'ascent',
    'bottom',
    ...Array(4).fill('start'),
  ];
  const fr = framesFrom(depths, phases, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok(
    'D: shallow jitter does not yield clean pass',
    st.completionSatisfied === false || st.reversalConfirmedBy == null,
    st
  );
}

console.log('\n── E. HMM bridge: borderline drop + synthetic HMM → rule_plus_hmm ──');
{
  const baseline = 0.04;
  const peak = 0.75;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const depths = [
    ...Array(6).fill(baseline),
    0.12, 0.28, 0.52, 0.68, peak, peak,
    0.72, 0.71, 0.7, 0.69,
    0.68, 0.664, 0.68, 0.664, 0.68, 0.664,
  ];
  const phases = [
    ...Array(6).fill('start'),
    'descent',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
    ...Array(4).fill('bottom'),
    ...Array(6).fill('bottom'),
  ];
  const fr = framesFrom(depths, phases, 40);
  const peakIdx = depths.indexOf(peak);
  const hmmStub = {
    completionCandidate: true,
    confidence: 0.42,
    dominantStateCounts: { standing: 4, descent: 4, bottom: 3, ascent: 4 },
    transitionCount: 8,
    effectiveExcursion: rel,
    peakDepth: peak,
    sequence: [],
    states: [],
    confidenceBreakdown: {
      excursionScore: 0.5,
      sequenceScore: 0.5,
      coverageScore: 0.5,
      noisePenalty: 0.1,
    },
    notes: ['smoke-stub'],
  };
  const rev = detectSquatReversalConfirmation({
    validFrames: fr,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: hmmStub,
  });
  ok('E: HMM bridge confirms reversal', rev.reversalConfirmed === true && rev.reversalSource === 'rule_plus_hmm', rev);
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

function poseSeries(startTs, depthValues, stepMs = 80) {
  return depthValues.map((depthProxy, i) => squatPoseLandmarks(startTs + i * stepMs, depthProxy));
}

console.log('\n── F. evaluator observability shape ──');
{
  const frames = poseSeries(500, [
    ...Array(12).fill(0.012),
    0.02, 0.05, 0.12, 0.22, 0.38, 0.48, 0.52, 0.52, 0.45, 0.32, 0.18, 0.08, 0.03, 0.015, 0.012,
  ]);
  const pf = buildPoseFeaturesFrames(
    'squat',
    frames.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }))
  );
  const ev = evaluateSquatFromPoseFrames(pf);
  const cal = ev.debug?.squatReversalCalibration;
  const hm = ev.debug?.highlightedMetrics;
  ok('F1: squatReversalCalibration block', cal != null && typeof cal.peakDepth === 'number', cal);
  ok('F2: peakIndex nullable number', cal.peakIndex === null || typeof cal.peakIndex === 'number', cal);
  ok('F3: highlighted squatReversalSourceCode', typeof hm?.squatReversalSourceCode === 'number', hm);
  ok('F4: highlighted reversal drop/frame', 'squatReversalDepthDrop' in (hm ?? {}) && 'squatReversalFrameCount' in (hm ?? {}), hm);
}

console.log(`\n━━━ PR-04E2 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
