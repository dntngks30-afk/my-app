/**
 * PASS-AUTHORITY-RESET-01 스모크 테스트 (RESET-02 인터페이스로 업데이트)
 *
 * RESET-02: pass-core는 이제 depthFrames + baselineStandingDepth로 독립 판단.
 * completionSatisfied 의존 제거됨.
 *
 * npx tsx scripts/camera-pr-pass-authority-reset-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatPassCore } = await import(
  '../src/lib/camera/squat/pass-core.ts'
);

let passCount = 0;
let failCount = 0;
const results = [];

function assert(label, actual, expected) {
  if (actual === expected) {
    passCount++;
    results.push(`  ✓ ${label}`);
  } else {
    failCount++;
    results.push(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(label, actual) {
  if (actual) {
    passCount++;
    results.push(`  ✓ ${label}`);
  } else {
    failCount++;
    results.push(`  ✗ ${label} — expected truthy, got ${JSON.stringify(actual)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Depth-stream fixture helpers
// ─────────────────────────────────────────────────────────────────────

function makeFrames(specs) {
  return specs.map(([depth, ms]) => ({ depth, timestampMs: ms }));
}

/**
 * Shallow gold-path: baseline=0.05, peak=0.11 (relativePeak=0.06), clean cycle ~1200ms
 */
function makeShallowGoldPath() {
  return {
    depthFrames: makeFrames([
      [0.05, 0],    // baseline
      [0.05, 33],
      [0.06, 100],  // start descent
      [0.08, 200],
      [0.10, 400],
      [0.11, 600],  // peak
      [0.11, 633],  // peak hold
      [0.10, 700],  // reversal begins
      [0.08, 800],
      [0.06, 950],
      [0.052, 1100], // standing threshold = 0.05 + 0.40*0.06 = 0.074 → passes
      [0.050, 1200],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
    descendConfirmed: true,
    downwardCommitmentDelta: 0.06,
  };
}

/**
 * Deep gold-path: baseline=0.05, peak=0.40 (relativePeak=0.35), clean cycle ~2000ms
 */
function makeDeepGoldPath() {
  return {
    depthFrames: makeFrames([
      [0.05, 0],
      [0.05, 33],
      [0.10, 200],
      [0.20, 500],
      [0.35, 900],
      [0.40, 1100], // peak
      [0.40, 1133], // peak hold
      [0.35, 1300],
      [0.20, 1600],
      [0.08, 1900], // standing threshold = 0.05 + 0.40*0.35 = 0.19 → passes at 0.08
      [0.05, 2000],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
    descendConfirmed: true,
    downwardCommitmentDelta: 0.35,
  };
}

// ─────────────────────────────────────────────────────────────────────
// TEST 1 — 실제 shallow 렙 passes (RESET-02 핵심: completionSatisfied 없이 통과)
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore(makeShallowGoldPath());
  results.push('[TEST 1] shallow real rep passes (RESET-02: no completionSatisfied)');
  assert('1A: passDetected=true', r.passDetected, true);
  assert('1B: passBlockedReason=null', r.passBlockedReason, null);
  assert('1C: descentDetected=true', r.descentDetected, true);
  assert('1D: reversalDetected=true', r.reversalDetected, true);
  assert('1E: standingRecovered=true', r.standingRecovered, true);
  assert('1F: setupClear=true', r.setupClear, true);
  assert('1G: sameRepOwnershipClear=true', r.sameRepOwnershipClear, true);
  assert('1H: antiSpikeClear=true', r.antiSpikeClear, true);
  assert('1I: peakLatched=true', r.peakLatched, true);
  assert('1J: baselineEstablished=true', r.baselineEstablished, true);
  assertTruthy('1K: repId non-null', r.repId);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 2 — 실제 deep 렙 passes
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore(makeDeepGoldPath());
  results.push('[TEST 2] deep real rep passes');
  assert('2A: passDetected=true', r.passDetected, true);
  assert('2B: passBlockedReason=null', r.passBlockedReason, null);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 3 — standing only never passes (depth stays near baseline)
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66], [0.05, 100],
      [0.05, 133], [0.05, 166], [0.05, 200], [0.05, 233],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 3] standing only never passes');
  assert('3A: passDetected=false', r.passDetected, false);
  assert('3B: blocked by no_meaningful_descent', r.passBlockedReason, 'no_meaningful_descent');
}

// ─────────────────────────────────────────────────────────────────────
// TEST 4 — descent only never passes (sits and stays)
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.07, 200], [0.09, 400], [0.11, 600], [0.11, 800],
      [0.11, 1000], [0.11, 1200], // stays at bottom
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 4] descent only never passes');
  assert('4A: passDetected=false', r.passDetected, false);
  assert('4B: blocked by no_reversal_after_peak', r.passBlockedReason, 'no_reversal_after_peak');
  assert('4C: descentDetected=true', r.descentDetected, true);
  assert('4D: reversalDetected=false', r.reversalDetected, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 5 — mid-rise / partial return not standing → blocked
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore({
    // relativePeak = 0.06, standingThreshold = 0.05 + 0.40*0.06 = 0.074
    // Partial return stops at 0.085 → above threshold → blocked
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.08, 200], [0.11, 500], [0.11, 533], // peak (rel=0.06)
      [0.10, 700], [0.09, 900], [0.085, 1100], [0.085, 1300], // stays above 0.074
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 5] partial return (not fully standing) blocked');
  assert('5A: passDetected=false', r.passDetected, false);
  assert('5B: standingRecovered=false', r.standingRecovered, false);
  assert('5C: reversalDetected=true', r.reversalDetected, true);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 6 — setup motion blocked (no complete cycle to bypass)
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore({
    // Only 4 frames, all near-baseline: no clear cycle
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66], [0.05, 100],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: true,
    setupMotionBlockReason: 'large_framing_translation',
  });
  results.push('[TEST 6] setup motion blocked with no clear cycle');
  assert('6A: passDetected=false', r.passDetected, false);
  assert('6B: antiSetupClear=false', r.antiSetupClear, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 7 — jitter spike (1 frame at peak) blocked by peakLatched
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66],
      [0.11, 100], // single spike frame — peak
      [0.05, 133], [0.05, 166], [0.05, 200], [0.05, 233],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 7] single-frame jitter spike blocked');
  assert('7A: passDetected=false', r.passDetected, false);
  assert('7B: descentDetected=true (peak > threshold)', r.descentDetected, true);
  assert('7C: peakLatched=false (only 1 frame near peak)', r.peakLatched, false);
  assert('7D: blocked by peak_not_latched', r.passBlockedReason, 'peak_not_latched');
}

// ─────────────────────────────────────────────────────────────────────
// TEST 8 — micro-bounce (too-fast cycle) blocked
// ─────────────────────────────────────────────────────────────────────
{
  // Full cycle but under 350ms
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0],
      [0.08, 30],   // descent
      [0.11, 60],   // peak
      [0.11, 90],   // peak hold
      [0.08, 120],  // reversal
      [0.05, 160],  // standing — total cycle = 160ms < 350ms
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 8] micro-bounce (too fast) blocked');
  assert('8A: passDetected=false', r.passDetected, false);
  assert('8B: blocked by cycle_too_short', r.passBlockedReason, 'cycle_too_short');
  assert('8C: antiSpikeClear=false', r.antiSpikeClear, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 9 — setup motion blocks even with complete valid cycle (PASS-WINDOW-RESET-01)
// Bypass removed: setup contamination always blocks pass per SSOT §4.3
// ─────────────────────────────────────────────────────────────────────
{
  const input = { ...makeShallowGoldPath(), setupMotionBlocked: true, setupMotionBlockReason: 'step_back' };
  const r = evaluateSquatPassCore(input);
  results.push('[TEST 9] setup motion blocks even with complete valid cycle (no bypass)');
  assert('9A: passDetected=false (no bypass)', r.passDetected, false);
  assert('9B: setupClear=false (blocked)', r.setupClear, false);
  assert('9C: antiSetupClear=false (raw setup blocked)', r.antiSetupClear, false);
}

// ─────────────────────────────────────────────────────────────────────
// TEST 10 — cross-rep ownership blocked
// ─────────────────────────────────────────────────────────────────────
{
  // Reversal at t=200, standing at t=10500: 10300ms > 10000ms
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.08, 200], [0.11, 500], [0.11, 533], // peak
      [0.10, 700],
      [0.09, 1000],  // reversal starts here (drop ~0.02 = 33% of 0.06 ✓)
      [0.086, 1100], // threshold = 0.05 + 0.40*0.06 = 0.074 → above
      [0.074, 11000], // stands up 9900ms after reversal start (> 10000ms)
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 10] cross-rep ownership (too slow reversal-to-standing) blocked');
  assert('10A: passDetected=false', r.passDetected, false);
  assert('10B: sameRepOwnershipClear=false', r.sameRepOwnershipClear, false);
  assert('10C: blocked by same_rep_ownership_broken', r.passBlockedReason, 'same_rep_ownership_broken');
}

// ─────────────────────────────────────────────────────────────────────
// TEST 11 — RESET-02 independence: passes WITHOUT completionSatisfied
// ─────────────────────────────────────────────────────────────────────
{
  // Pass-core is called with depth stream only — no completionSatisfied field in input.
  // This is the core regression guard for RESET-02.
  const input = makeShallowGoldPath();
  // Confirm: input has NO completionSatisfied field
  assert('11A: input has no completionSatisfied field', 'completionSatisfied' in input, false);
  const r = evaluateSquatPassCore(input);
  assert('11B: passDetected=true without completionSatisfied', r.passDetected, true);
  results.push('[TEST 11] RESET-02 independence: passes without completionSatisfied');
}

// ─────────────────────────────────────────────────────────────────────
// TEST 12 — repId and trace fields present on pass
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore(makeShallowGoldPath());
  results.push('[TEST 12] repId and trace fields');
  assertTruthy('12A: repId non-null when passing', r.repId);
  assertTruthy('12B: trace contains pass=1', r.trace?.includes('pass=1'));
  assertTruthy('12C: trace contains peak_d', r.trace?.includes('peak_d='));
  assertTruthy('12D: trace contains cycle=', r.trace?.includes('cycle='));
}

// ─────────────────────────────────────────────────────────────────────
// TEST 13 — repId=null and trace contains pass=0 on block
// ─────────────────────────────────────────────────────────────────────
{
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([[0.05, 0], [0.05, 33], [0.05, 66], [0.05, 100]]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  results.push('[TEST 13] repId=null and trace=pass=0 on block');
  assert('13A: repId=null when blocked', r.repId, null);
  assertTruthy('13B: trace contains pass=0', r.trace?.includes('pass=0'));
}

// ─────────────────────────────────────────────────────────────────────
// Print results
// ─────────────────────────────────────────────────────────────────────
results.forEach((r) => console.log(r));
console.log('\n============================================================');
console.log(`PASS-AUTHORITY-RESET-01 smoke (updated to RESET-02 interface): ${passCount} passed, ${failCount} failed`);
if (failCount === 0) {
  console.log('ALL ASSERTIONS PASSED');
} else {
  console.log('SOME ASSERTIONS FAILED');
  process.exit(1);
}
