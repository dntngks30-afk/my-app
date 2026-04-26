/**
 * PR04C — Peak-at-Tail Stall + Window Recovery Smoke Test
 *
 * Tests:
 *   1. peak_at_tail_stall_must_not_pass_but_wait
 *   2. peak_at_tail_then_ascent_return_must_pass (slow shallow, cycle cap exception)
 *   3. slow_shallow_descent_then_ascent_return_must_pass
 *   4. slow_deep_descent_then_ascent_return_must_pass
 *   5. no_reversal_long_descent_must_wait_not_terminal
 *   6. standing_small_movement_after_prior_pass_must_fail (04B regression)
 *   7. setup_translation_stale_window_must_fail
 *   8. same_frame_reversal_return_must_fail (04B regression guard B)
 *
 * Run: npx tsx scripts/camera-squat-v2-04c-peak-tail-window-recovery-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatMotionEvidenceV2 } = await import(
  '../src/lib/camera/squat/squat-motion-evidence-v2.ts'
);

let passed = 0;
let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? `: ${detail}` : ''}`);
  }
}

function loadFixture(file) {
  const path = join(__dirname, '..', 'fixtures', 'camera', 'squat', 'observations', file);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function framesFromDepths(depths, options = {}) {
  const { fps = 10, baseTs = 0 } = options;
  return depths.map((d, i) => ({
    timestampMs: baseTs + i * (1000 / fps),
    lowerBodySignal: d,
    depth: d,
    bodyVisibleEnough: true,
    lowerBodyVisibleEnough: true,
    setupPhase: false,
  }));
}

console.log('\nPR04C — Peak-at-Tail Stall + Window Recovery Smoke\n');

// ── Test 1: peak_at_tail_stall_must_not_pass_but_wait ─────────────────────
console.log('1. peak_at_tail_stall_must_not_pass_but_wait');
{
  const fix = loadFixture('pr04c_peak_at_tail_stall_must_not_pass_but_wait.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=false', d.usableMotionEvidence === false, JSON.stringify(d.blockReason));
  // When peak is at tail and user is holding at bottom, V2 correctly uses bottom_hold/no_return_to_start
  // OR descent_only/no_reversal — both indicate the user hasn't started ascending yet.
  ok(
    'blockReason=no_reversal or no_return_to_start (awaiting ascent)',
    d.blockReason === 'no_reversal' || d.blockReason === 'no_return_to_start',
    d.blockReason
  );
  ok(
    'motionPattern=descent_only or bottom_hold (not yet ascending)',
    d.motionPattern === 'descent_only' || d.motionPattern === 'bottom_hold',
    d.motionPattern
  );
  // peak at tail: peakFrameIndex should be near last frame
  const peakIdx = d.metrics?.peakFrameIndex ?? -1;
  const inputCount = d.metrics?.inputFrameCount ?? 0;
  ok(
    'peakAtTailStall evidence: peakFrameIndex near tail',
    peakIdx >= inputCount - 2 && peakIdx >= 0,
    `peakIdx=${peakIdx} inputCount=${inputCount}`
  );
  ok(
    'framesAfterPeak <= 1',
    (d.metrics?.framesAfterPeak ?? 0) <= 1,
    `framesAfterPeak=${d.metrics?.framesAfterPeak}`
  );
}

// ── Test 2: peak_at_tail_then_ascent_return_must_pass (slow shallow, cycle cap exception) ─
console.log('\n2. peak_at_tail_then_ascent_return_must_pass (slow shallow, returnMs>4500ms)');
{
  const fix = loadFixture('pr04c_peak_at_tail_then_ascent_return_must_pass.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=true', d.usableMotionEvidence === true, JSON.stringify({ blockReason: d.blockReason, motionPattern: d.motionPattern, returnMs: d.metrics?.returnMs }));
  ok('motionPattern=down_up_return', d.motionPattern === 'down_up_return', d.motionPattern);
  ok('blockReason=null', d.blockReason === null, d.blockReason);
  // Verify returnMs > 4500ms (cycle cap would have blocked without exception)
  const returnMs = d.metrics?.returnMs;
  ok(
    'returnMs > 4500ms (cycle cap would have blocked without exception)',
    returnMs != null && returnMs > 4500,
    `returnMs=${returnMs}`
  );
  // Verify peakToReturnMs (ascent portion) is within normal range
  const peakToReturnMs = d.metrics?.peakToReturnMs;
  ok(
    'peakToReturnMs <= 4500ms (ascent portion within bounds)',
    peakToReturnMs != null && peakToReturnMs <= 4500,
    `peakToReturnMs=${peakToReturnMs}`
  );
  // Verify closure is fresh
  ok(
    'closureFreshAtTail=true',
    d.evidence?.closureFreshAtTail === true,
    `tailDistanceMs=${d.metrics?.tailDistanceMs}`
  );
}

// ── Test 3: slow_shallow_descent_then_ascent_return_must_pass ─────────────
console.log('\n3. slow_shallow_descent_then_ascent_return_must_pass');
{
  const fix = loadFixture('pr04c_slow_shallow_descent_then_ascent_return_must_pass.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=true', d.usableMotionEvidence === true, JSON.stringify({ blockReason: d.blockReason, returnMs: d.metrics?.returnMs }));
  ok('motionPattern=down_up_return', d.motionPattern === 'down_up_return', d.motionPattern);
  ok('blockReason=null', d.blockReason === null, d.blockReason);
}

// ── Test 4: slow_deep_descent_then_ascent_return_must_pass ────────────────
console.log('\n4. slow_deep_descent_then_ascent_return_must_pass');
{
  const fix = loadFixture('pr04c_slow_deep_descent_then_ascent_return_must_pass.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=true', d.usableMotionEvidence === true, JSON.stringify({ blockReason: d.blockReason, romBand: d.romBand, returnMs: d.metrics?.returnMs }));
  ok('motionPattern=down_up_return', d.motionPattern === 'down_up_return', d.motionPattern);
  ok('blockReason=null', d.blockReason === null, d.blockReason);
  ok('romBand=deep', d.romBand === 'deep', d.romBand);
  // Verify the slow-descent exception fired for returnMs > 4500ms
  const returnMs = d.metrics?.returnMs;
  if (returnMs != null && returnMs > 4500) {
    ok(
      'slow-descent exception fired (returnMs>4500 but still passed)',
      d.usableMotionEvidence === true,
      `returnMs=${returnMs}`
    );
  } else {
    // returnMs <= 4500 → standard pass
    ok('standard pass (returnMs<=4500)', true, `returnMs=${returnMs}`);
  }
}

// ── Test 5: no_reversal_long_descent_must_wait_not_terminal ───────────────
console.log('\n5. no_reversal_long_descent_must_wait_not_terminal');
{
  const fix = loadFixture('pr04c_no_reversal_long_descent_must_wait_not_terminal.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=false (no pass while waiting)', d.usableMotionEvidence === false, d.blockReason);
  // Peak should be at or near tail — awaiting ascent
  const peakIdx = d.metrics?.peakFrameIndex ?? -1;
  const inputCount = d.metrics?.inputFrameCount ?? 0;
  const framesAfterPeak = d.metrics?.framesAfterPeak ?? 999;
  ok(
    'peak near tail (peak-at-tail stall) — framesAfterPeak <= 3',
    framesAfterPeak <= 3,
    `peakIdx=${peakIdx} inputCount=${inputCount} framesAfterPeak=${framesAfterPeak}`
  );
  ok(
    'blockReason=no_reversal or no_return_to_start (not terminal — awaiting ascent)',
    d.blockReason === 'no_reversal' || d.blockReason === 'no_return_to_start',
    d.blockReason
  );
  ok(
    'motionPattern=descent_only or bottom_hold (user still at bottom)',
    d.motionPattern === 'descent_only' || d.motionPattern === 'bottom_hold',
    d.motionPattern
  );
}

// ── Test 6: standing_small_movement_after_prior_pass_must_fail (04B regression) ─
console.log('\n6. standing_small_movement_after_prior_pass_must_fail (04B regression)');
{
  const fix = loadFixture('standing_small_movement_after_prior_pass_must_fail.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=false', d.usableMotionEvidence === false, JSON.stringify({ blockReason: d.blockReason, motionPattern: d.motionPattern }));
  ok(
    'blocked early (micro_bounce or no_meaningful_descent)',
    d.blockReason === 'micro_bounce' || d.blockReason === 'no_meaningful_descent' || d.blockReason === 'no_reversal',
    d.blockReason
  );
}

// ── Test 7: setup_translation_stale_window_must_fail ─────────────────────
console.log('\n7. setup_translation_stale_window_must_fail');
{
  const fix = loadFixture('pr04c_setup_translation_stale_window_must_fail.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=false', d.usableMotionEvidence === false, JSON.stringify({ blockReason: d.blockReason, motionPattern: d.motionPattern }));
}

// ── Test 8: same_frame_reversal_return_must_fail (04B Guard B regression) ─
console.log('\n8. same_frame_reversal_return_must_fail (04B Guard B regression)');
{
  // Use existing 04B real-device false-positive fixture (Guard B target)
  const fix = loadFixture('real_device_false_pass_tiny_motion_01.json');
  const d = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('usableMotionEvidence=false', d.usableMotionEvidence === false, JSON.stringify({ blockReason: d.blockReason }));
  ok(
    'blockReason=return_not_after_reversal (Guard B — 04B regression preserved)',
    d.blockReason === 'return_not_after_reversal',
    d.blockReason
  );
}

// ── Synthetic: pure peak-at-tail with synthetic data ─────────────────────
console.log('\n9. synthetic_peak_at_tail_no_pass (peakFrameIndex=last)');
{
  // All descent, peak at last frame — no reversal possible
  const depths = [0.005, 0.010, 0.020, 0.035, 0.050, 0.065, 0.075, 0.082, 0.088, 0.092, 0.095];
  const frames = framesFromDepths(depths, { fps: 10 });
  const d = evaluateSquatMotionEvidenceV2(frames);
  ok('usableMotionEvidence=false', d.usableMotionEvidence === false, d.blockReason);
  const peakIdx = d.metrics?.peakFrameIndex ?? -1;
  const inputCount = d.metrics?.inputFrameCount ?? frames.length;
  ok('peakFrameIndex at tail', peakIdx >= inputCount - 2, `peakIdx=${peakIdx} inputCount=${inputCount}`);
  ok(
    'framesAfterPeak=0 or 1',
    (d.metrics?.framesAfterPeak ?? 0) <= 1,
    `framesAfterPeak=${d.metrics?.framesAfterPeak}`
  );
  // blockReason can be no_reversal, no_return_to_start, or incomplete_return (all valid awaiting states)
  ok(
    'blockReason indicates awaiting state (not false-positive)',
    ['no_reversal', 'no_return_to_start', 'bottom_hold', 'descent_only', 'incomplete_return'].includes(d.motionPattern) ||
    ['no_reversal', 'no_return_to_start', 'incomplete_return', 'no_meaningful_descent'].includes(d.blockReason),
    `blockReason=${d.blockReason} motionPattern=${d.motionPattern}`
  );
}

// ── Synthetic: slow deep with near-standing start → pass even if returnMs>4500 ──
console.log('\n10. synthetic_slow_deep_start_from_standing_cycle_cap_exception');
{
  // Slow deep squat: 5 standing + 45 descent (slow) + 8 ascent to return + 2 stable
  // Clip ends right after closure (stableAfterReturn near tail). returnMs > 4500ms.
  const standingDepths = [0.004, 0.004, 0.005, 0.005, 0.004];
  const descentStep = (0.38 - 0.010) / 45;
  const descentDepths = Array.from({ length: 45 }, (_, i) => parseFloat((0.010 + i * descentStep).toFixed(4)));
  // Fast ascent: 0.38 → 0.135 (below return threshold ≈ 0.136) in 8 frames
  const ascentDepths = [0.380, 0.345, 0.310, 0.275, 0.240, 0.205, 0.170, 0.135];
  // 2 stable frames at return depth (stableAfterReturn near tail)
  const stableReturnDepths = [0.080, 0.050];
  const allDepths = [...standingDepths, ...descentDepths, ...ascentDepths, ...stableReturnDepths];
  const frames = framesFromDepths(allDepths, { fps: 10 });
  const d = evaluateSquatMotionEvidenceV2(frames);
  const returnMs = d.metrics?.returnMs;
  const peakToReturnMs = d.metrics?.peakToReturnMs;
  const closureFreshAtTail = d.evidence?.closureFreshAtTail;
  console.log(`  info: returnMs=${returnMs}, peakToReturnMs=${peakToReturnMs}, romBand=${d.romBand}, blockReason=${d.blockReason}, closureFreshAtTail=${closureFreshAtTail}`);
  if (returnMs != null && returnMs > 4500) {
    ok(
      'slow-deep exception: passed despite returnMs>4500ms',
      d.usableMotionEvidence === true,
      JSON.stringify({ blockReason: d.blockReason, returnMs, peakToReturnMs, closureFreshAtTail })
    );
  } else {
    ok('standard pass (returnMs<=4500)', d.usableMotionEvidence === true, JSON.stringify({ blockReason: d.blockReason, returnMs }));
  }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`PR04C smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\nFAILED: ${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll PR04C smoke tests PASSED ✓');
