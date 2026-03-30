/**
 * PR-CAM-29C — 0.02~0.08 ultra-shallow reversal unlock 전용 검증
 *
 * 목적: [LEGACY_ATTEMPT_FLOOR, ULTRA_SHALLOW_STRICT_ONLY_FLOOR) = [0.02, 0.08) 구간에서
 *       guardedUltraShallowReversalAssist 가 실제로 reversal 을 확인하고,
 *       standing jitter / seated hold / 1-frame spike 는 차단됨을 직접 검증한다.
 *
 * npx tsx scripts/camera-cam29c-ultra-shallow-0p02-0p08-reversal-smoke.mjs
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

/** 피크 위치 전후로 down-up 시퀀스를 생성 */
function buildReversalFrames({ baseline, peak, descentSteps, ascentSteps, startTs = 1000 }) {
  const frames = [];
  let t = startTs;
  const push = (d, ph) => { frames.push(makeFrame(d, t, ph)); t += 40; };
  // pre-standing
  for (let i = 0; i < 8; i++) push(baseline, 'start');
  // descent
  for (const d of descentSteps) push(d, d >= peak * 0.85 ? 'descent' : 'start');
  // peak hold 1 frame
  push(peak, 'bottom');
  // ascent (post-peak) — phaseHint 'ascent' 으로 강제, ascentStreakMax 조건 충족
  for (const d of ascentSteps) push(d, 'ascent');
  // recovery
  for (let i = 0; i < 6; i++) push(baseline, 'start');
  return frames;
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── A. 0.02≤relPeak<0.08 — 여러 피크 깊이에서 guarded assist 통과 ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const testCases = [
    { label: 'relPeak≈0.025 (very shallow)', baseline: 0.03, peak: 0.055 },
    { label: 'relPeak≈0.04 (mid ultra-shallow)', baseline: 0.03, peak: 0.07 },
    { label: 'relPeak≈0.065 (near upper bound)', baseline: 0.03, peak: 0.095 },
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
      `A-${tc.label}: reversalConfirmed (rule)`,
      rev.reversalConfirmed === true && rev.reversalSource === 'rule',
      { confirmed: rev.reversalConfirmed, src: rev.reversalSource, notes: rev.notes, rel: rel.toFixed(3) }
    );
    ok(
      `A-${tc.label}: guarded_ultra_shallow note present`,
      rev.notes.some((n) =>
        n === 'guarded_ultra_shallow_reversal_assist' ||
        n === 'strict_primary_hit' ||
        n === 'strict_blended_hit'
      ),
      rev.notes
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── B. relPeak < 0.02 (LEGACY_ATTEMPT_FLOOR 미만) → strict-only → false ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  // baseline=0.041, peak=0.0425 → rel ≈ 0.0015 < 0.02
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
  ok(
    'B1: jitter band (rel < 0.02) → no reversal',
    rev.reversalConfirmed === false,
    { confirmed: rev.reversalConfirmed, rel: rel.toFixed(4), notes: rev.notes }
  );
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── C. seated hold — peak 후 단조 상승 없음 → false ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const baseline = 0.03;
  const peak = 0.07;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const frames = [];
  let t = 6000;
  const push = (d, ph) => { frames.push(makeFrame(d, t, ph)); t += 40; };
  for (let i = 0; i < 8; i++) push(baseline, 'start');
  [0.045, 0.058, 0.068, peak, peak].forEach((d) => push(d, 'descent'));
  // flat oscillation — no monotonic drop after peak
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
  ok('C1: seated hold → no reversal', rev.reversalConfirmed === false, {
    confirmed: rev.reversalConfirmed,
    notes: rev.notes,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── D. 1-frame spike (peak→base→peak 패턴) → false ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const baseline = 0.03;
  const peak = 0.065;
  const rel = peak - baseline;
  const req = Math.max(0.007, rel * 0.13);
  const frames = [];
  let t = 7000;
  const push = (d, ph) => { frames.push(makeFrame(d, t, ph)); t += 40; };
  for (let i = 0; i < 10; i++) push(baseline, 'start');
  // spike: peak → baseline → peak (strict 2-frame 연속 hit 불가, mono 방향 불일치)
  push(peak, 'bottom');
  push(baseline, 'start');
  push(peak, 'bottom');
  push(peak, 'bottom');
  for (let i = 0; i < 6; i++) push(peak, 'bottom');
  // peakValidIndex 는 첫 번째 peak
  const peakIdx = frames.map((f) => f.derived.squatDepthProxy).indexOf(peak);

  const rev = detectSquatReversalConfirmation({
    validFrames: frames,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peak,
    relativeDepthPeak: rel,
    reversalDropRequired: req,
    hmm: null,
  });
  ok('D1: 1-frame spike → no reversal', rev.reversalConfirmed === false, {
    confirmed: rev.reversalConfirmed,
    notes: rev.notes,
  });
}

console.log(`\n━━━ PR-CAM-29C reversal [0.02,0.08) smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
