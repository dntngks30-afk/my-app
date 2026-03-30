/**
 * PR-CAM-29B — ultra-shallow reversal guarded assist + anti-FP
 *
 * npx tsx scripts/camera-cam29b-ultra-shallow-reversal-guard-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { detectSquatReversalConfirmation } = await import(
  '../src/lib/camera/squat/squat-reversal-confirmation.ts'
);

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

function makeFrame(depth, timestampMs, phaseHint, blended = undefined) {
  const derived = { squatDepthProxy: depth };
  if (blended !== undefined) derived.squatDepthProxyBlended = blended;
  else derived.squatDepthProxyBlended = depth;
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

console.log('\n── A. meaningful ultra-shallow rep (0.02≤relPeak<0.08) → reversal true ──');
{
  const baseline = 0.04;
  const peak = 0.1;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const t0 = 1000;
  const frames = [];
  let t = t0;
  const push = (d, ph) => {
    frames.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 8; i++) push(baseline, 'start');
  const descentSteps = [0.05, 0.062, 0.074, 0.086, 0.095, peak, peak];
  for (const d of descentSteps) {
    push(d, d >= 0.07 ? 'descent' : 'start');
  }
  const post = [0.092, 0.084, 0.076, 0.068, 0.058, 0.05, 0.045, baseline + 0.01];
  for (const d of post) push(d, 'ascent');
  for (let i = 0; i < 6; i++) push(baseline, 'start');

  const peakIdx = frames.findIndex((f, i) => f.derived.squatDepthProxy === peak && i > 0);
  const lastPeak = frames.map((f) => f.derived.squatDepthProxy).lastIndexOf(peak);
  const peakValidIndex = lastPeak >= 0 ? lastPeak : peakIdx;

  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok(
    'A1: reversal confirmed (rule, guarded or strict)',
    rev.reversalConfirmed === true && rev.reversalSource === 'rule',
    rev
  );
  ok(
    'A2: notes include guarded assist when strict misses ultra-shallow band',
    rev.notes.some(
      (n) =>
        n === 'guarded_ultra_shallow_reversal_assist' ||
        n === 'strict_primary_hit' ||
        n === 'strict_blended_hit'
    ),
    rev.notes
  );
}

console.log('\n── B. standing jitter (relPeak < legacy attempt) → false ──');
{
  const baseline = 0.0415;
  const frames = [];
  let t = 2000;
  /** 전 구간 0.041~0.042 로 억제: relPeak < 0.02 이고 strict 2-frame 동시 hit 불가 */
  const depths = [
    ...Array(14).fill(baseline),
    0.0418,
    0.042,
    0.0419,
    0.0421,
    0.0417,
    ...Array(12).fill(baseline),
  ];
  for (const d of depths) {
    frames.push(makeFrame(d, t, 'start'));
    t += 40;
  }
  const peak = Math.max(...depths.map((d) => d));
  const peakIdx = depths.map((d) => d).lastIndexOf(peak);
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok('B1: no reversal (noise band)', rev.reversalConfirmed === false, rev);
}

console.log('\n── C. seated hold at bottom, no monotonic ascent → false ──');
{
  const baseline = 0.04;
  const peak = 0.095;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const frames = [];
  let t = 3000;
  const push = (d, ph) => {
    frames.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 8; i++) push(baseline, 'start');
  [0.06, 0.075, 0.088, peak, peak].forEach((d) => push(d, 'descent'));
  for (let i = 0; i < 12; i++) push(peak - 0.002 * (i % 2), 'bottom');
  const peakIdx = frames.map((f) => f.derived.squatDepthProxy).lastIndexOf(peak);
  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok('C1: seated hold → no reversal', rev.reversalConfirmed === false, rev);
}

console.log('\n── D. 1-frame spike then flat → false ──');
{
  const baseline = 0.04;
  /** rel < 0.08 구간: 피크 직후 한 프레임만 낮추고 다시 피크로 올라 strict 2연속·mono 모두 실패 */
  const peak = 0.07;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const frames = [];
  let t = 4000;
  const push = (d, ph) => {
    frames.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 10; i++) push(baseline, 'start');
  push(peak, 'bottom');
  push(baseline, 'start');
  push(peak, 'bottom');
  push(peak, 'bottom');
  for (let i = 0; i < 5; i++) push(peak, 'bottom');
  const peakIdx = frames.map((f) => f.derived.squatDepthProxy).indexOf(peak);
  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok('D1: spike without sustained post-peak path', rev.reversalConfirmed === false, rev);
}

console.log(`\n━━━ PR-CAM-29B reversal guard smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
