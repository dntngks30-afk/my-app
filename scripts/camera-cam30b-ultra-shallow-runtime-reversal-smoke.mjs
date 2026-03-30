/**
 * PR-CAM-30B — 0.02~0.08 ultra-shallow **런타임** reversal (`detectSquatReversalConfirmation`)
 *
 * npx tsx scripts/camera-cam30b-ultra-shallow-runtime-reversal-smoke.mjs
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
  derived.squatDepthProxyBlended = blended !== undefined ? blended : depth;
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

function buildReversalFrames({ baseline, peak, descentSteps, ascentSteps, startTs = 1000 }) {
  const frames = [];
  let t = startTs;
  const push = (d, ph) => {
    frames.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 8; i++) push(baseline, 'start');
  for (const d of descentSteps) push(d, d >= peak * 0.85 ? 'descent' : 'start');
  push(peak, 'bottom');
  for (const d of ascentSteps) push(d, 'ascent');
  for (let i = 0; i < 6; i++) push(baseline, 'start');
  return frames;
}

console.log('\n── A. 0.02≤relPeak<0.08 meaningful rep → reversal true ──');
{
  const testCases = [
    { label: 'relPeak≈0.025', baseline: 0.03, peak: 0.055 },
    { label: 'relPeak≈0.04', baseline: 0.03, peak: 0.07 },
    { label: 'relPeak≈0.065', baseline: 0.03, peak: 0.095 },
  ];

  for (const tc of testCases) {
    const { baseline, peak } = tc;
    const rel = peak - baseline;
    const req = Math.max(0.007, rel * 0.13);
    const descentSteps = [];
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      descentSteps.push(baseline + (peak - baseline) * (i / (steps + 1)));
    }
    const ascentSteps = [
      peak - rel * 0.18,
      peak - rel * 0.36,
      peak - rel * 0.54,
      peak - rel * 0.72,
      peak - rel * 0.88,
    ];
    const frames = buildReversalFrames({ baseline, peak, descentSteps, ascentSteps });
    const peakIdx = frames.map((f) => f.derived.squatDepthProxy).lastIndexOf(peak);
    const rev = detectSquatReversalConfirmation({
      validFrames: frames,
      peakValidIndex: peakIdx,
      peakPrimaryDepth: peak,
      relativeDepthPeak: rel,
      reversalDropRequired: req,
      hmm: null,
    });
    ok(
      `A-${tc.label}: reversalConfirmed rule`,
      rev.reversalConfirmed === true && rev.reversalSource === 'rule',
      rev
    );
    ok(
      `A-${tc.label}: guarded or strict path note`,
      rev.notes.some(
        (n) =>
          n === 'guarded_ultra_shallow_reversal_assist' ||
          n === 'strict_primary_hit' ||
          n === 'strict_blended_hit'
      ),
      rev.notes
    );
  }
}

console.log('\n── B. standing jitter (rel < 0.02) → false ──');
{
  const baseline = 0.041;
  const depths = [
    ...Array(14).fill(baseline),
    0.0415, 0.0418, 0.0421, 0.0425, 0.042, 0.0416,
    ...Array(10).fill(baseline),
  ];
  const frames = depths.map((d, i) => makeFrame(d, 5000 + i * 40, 'start'));
  const peak = Math.max(...depths);
  const peakIdx = depths.lastIndexOf(peak);
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
  ok('B1: no reversal', rev.reversalConfirmed === false, rev);
  ok('B2: strict-only band note', rev.notes.includes('ultra_shallow_strict_only_no_hit'), rev.notes);
}

console.log('\n── C. seated hold → false + guarded_ultra_shallow_no_hit ──');
{
  const baseline = 0.03;
  const peak = 0.07;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const frames = [];
  let t = 6000;
  const push = (d, ph) => {
    frames.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 8; i++) push(baseline, 'start');
  [0.045, 0.058, 0.068, peak, peak].forEach((d) => push(d, 'descent'));
  for (let i = 0; i < 14; i++) push(peak - 0.002 * (i % 2), 'bottom');
  const peakIdx = frames.map((f) => f.derived.squatDepthProxy).lastIndexOf(peak);
  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok('C1: no reversal', rev.reversalConfirmed === false, rev);
  ok('C2: fail note guarded_ultra_shallow_no_hit', rev.notes.includes('guarded_ultra_shallow_no_hit'), rev.notes);
}

console.log('\n── D. 1-frame spike → false + guarded_ultra_shallow_no_hit ──');
{
  const baseline = 0.03;
  const peak = 0.065;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const frames = [];
  let t = 7000;
  const push = (d, ph) => {
    frames.push(makeFrame(d, t, ph));
    t += 40;
  };
  for (let i = 0; i < 10; i++) push(baseline, 'start');
  push(peak, 'bottom');
  push(baseline, 'start');
  push(peak, 'bottom');
  push(peak, 'bottom');
  for (let i = 0; i < 6; i++) push(peak, 'bottom');
  const peakIdx = frames.map((f) => f.derived.squatDepthProxy).indexOf(peak);
  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok('D1: no reversal', rev.reversalConfirmed === false, rev);
  ok('D2: fail note guarded_ultra_shallow_no_hit', rev.notes.includes('guarded_ultra_shallow_no_hit'), rev.notes);
}

console.log(`\n━━━ PR-CAM-30B runtime reversal smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
