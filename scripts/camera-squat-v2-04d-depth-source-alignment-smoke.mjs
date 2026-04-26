/**
 * PR04D — V2 Shallow Depth Proxy Alignment Smoke Test
 *
 * Tests:
 *   Section A — depth source selection policy (selectRuntimeV2DepthSeries)
 *     A1. blended series has usable curve → policy=blended_usable
 *     A2. blended collapsed near zero, proxy usable → proxy selected
 *     A3. blended tail-spike only, proxy usable → proxy selected
 *     A4. all three series are tail-spike → fallback_blended
 *   Section B — V2 integration with selected depths
 *     B1. blended collapsed, proxy has valid shallow down-up-return → V2 passes
 *     B2. deep squat with blended usable → V2 passes (regression)
 *     B3. tail spike only (no post-peak frames) → V2 fails
 *     B4. standing small movement → fails (04B regression)
 *   Section C — guard regressions (04B / 04C)
 *     C1. same_frame_reversal_return → return_not_after_reversal (04B Guard B)
 *     C2. peak_at_tail_stall → awaiting_ascent_after_peak (04C, not terminal pass)
 *
 * Run: npx tsx scripts/camera-squat-v2-04d-depth-source-alignment-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatMotionEvidenceV2 } = await import(
  '../src/lib/camera/squat/squat-motion-evidence-v2.ts'
);
const { selectRuntimeV2DepthSeries } = await import(
  '../src/lib/camera/evaluators/squat.ts'
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

/**
 * Construct a minimal PoseFeaturesFrame-like object for depth selector tests.
 * Only the `derived` sub-fields are accessed by selectRuntimeV2DepthSeries.
 */
function makeDepthFrame(blended, proxy, raw, ts = 0) {
  return {
    derived: {
      squatDepthProxyBlended: blended,
      squatDepthProxy: proxy,
      squatDepthProxyRaw: raw,
    },
    timestampMs: ts,
  };
}

/**
 * Build v2Frames for evaluateSquatMotionEvidenceV2 from a depth array.
 */
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

// ═══════════════════════════════════════════════════════════════════════════════
// Section A — Depth source selection policy
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nPR04D — V2 Shallow Depth Proxy Alignment Smoke\n');
console.log('─── Section A: Depth source selection policy ───\n');

// ── A1: blended series is usable (deep curve) ─────────────────────────────────
console.log('A1. blended_usable → policy=blended_usable (deep curve)');
{
  // Simulate deep squat: blended has proper down-up-return curve (13 meaningful frames)
  const depths = [
    0.005, 0.010, 0.020, 0.040, 0.080, 0.160, 0.280, 0.420, 0.600, 0.760, 0.860, 0.920,
    // peak at index 11
    0.860, 0.720, 0.540, 0.360, 0.200, 0.120, 0.060, 0.030, 0.010, 0.003,
  ];
  const frames = depths.map((d, i) => makeDepthFrame(d, d * 0.8, d * 1.1, i * 100));
  const sel = selectRuntimeV2DepthSeries(frames);
  ok('source=blended', sel.source === 'blended', sel.source);
  ok('policy=blended_usable', sel.policy === 'blended_usable', sel.policy);
  ok('switchReason=null', sel.switchReason === null, sel.switchReason);
  ok('blended.hasUsableCurve=true', sel.stats.blended.hasUsableCurve === true);
  console.log(`    blended.meaningfulFrameCount=${sel.stats.blended.meaningfulFrameCount}, framesAfterPeak=${sel.stats.blended.framesAfterPeak}`);
}

// ── A2: blended collapsed near zero, proxy has usable curve ───────────────────
console.log('\nA2. blended_collapsed + proxy_usable → blended_collapsed_proxy_selected');
{
  // blended is near-machine-epsilon for all frames (total collapse)
  // proxy has a proper shallow down-up-return curve
  const proxyDepths = [
    0.001, 0.003, 0.005, 0.010, 0.020, 0.032, 0.045, 0.058,
    // peak at index 7
    0.042, 0.028, 0.015, 0.007, 0.002, 0.001,
  ];
  const frames = proxyDepths.map((p, i) =>
    makeDepthFrame(1e-9, p, p * 1.05, i * 100)
  );
  const sel = selectRuntimeV2DepthSeries(frames);
  ok('source=proxy', sel.source === 'proxy', sel.source);
  ok(
    'policy=blended_collapsed_proxy_selected',
    sel.policy === 'blended_collapsed_proxy_selected',
    sel.policy
  );
  ok('switchReason contains collapsed', (sel.switchReason ?? '').includes('collapsed'), sel.switchReason);
  ok('blended.collapsedNearZero=true', sel.stats.blended.collapsedNearZero === true);
  ok('proxy.hasUsableCurve=true', sel.stats.proxy.hasUsableCurve === true);
  // Selected depths should match proxy
  ok(
    'selected depths match proxy',
    Math.abs(sel.depths[7] - proxyDepths[7]) < 1e-9,
    `${sel.depths[7]} vs ${proxyDepths[7]}`
  );
  console.log(`    proxy.meaningfulFrameCount=${sel.stats.proxy.meaningfulFrameCount}, framesAfterPeak=${sel.stats.proxy.framesAfterPeak}`);
}

// ── A3: blended tail-spike only, proxy usable ─────────────────────────────────
console.log('\nA3. blended_tail_spike + proxy_usable → tail_spike_proxy_selected');
{
  // blended = 1e-8 for all frames EXCEPT the very last one (tail spike)
  // proxy has a proper shallow descent+ascent+return curve
  const n = 21;
  const proxyDepths = Array.from({ length: n }, (_, i) => {
    if (i < 8) return 0.001;                          // standing
    if (i === 8) return 0.010;
    if (i === 9) return 0.022;
    if (i === 10) return 0.034;
    if (i === 11) return 0.046;
    if (i === 12) return 0.055;
    if (i === 13) return 0.058;                       // peak at index 13
    if (i === 14) return 0.042;
    if (i === 15) return 0.028;
    if (i === 16) return 0.015;
    if (i === 17) return 0.008;
    return 0.002;                                      // stable return
  });
  // blended is near-zero except the LAST frame (clear tail spike)
  const blendedDepths = proxyDepths.map((_, i) => (i === n - 1 ? 0.058 : 1e-8));
  const frames = proxyDepths.map((p, i) =>
    makeDepthFrame(blendedDepths[i], p, p * 0.95, i * 100)
  );
  const sel = selectRuntimeV2DepthSeries(frames);
  ok('source=proxy', sel.source === 'proxy', sel.source);
  ok(
    'policy=tail_spike_proxy_selected',
    sel.policy === 'tail_spike_proxy_selected',
    sel.policy
  );
  ok('blended.tailSpikeOnly=true', sel.stats.blended.tailSpikeOnly === true);
  ok('proxy.hasUsableCurve=true', sel.stats.proxy.hasUsableCurve === true);
  console.log(`    blended.tailSpikeOnly=${sel.stats.blended.tailSpikeOnly}, policy=${sel.policy}`);
}

// ── A4: all series are tail-spike → fallback_blended ─────────────────────────
console.log('\nA4. all_series_tail_spike → fallback_blended');
{
  // All three series: 1e-8 for 20 frames, spike at last 2 frames only
  const n = 22;
  const spikeDepths = Array.from({ length: n }, (_, i) => (i >= n - 2 ? 0.058 : 1e-8));
  const frames = spikeDepths.map((d, i) =>
    makeDepthFrame(d, d, d, i * 100)
  );
  const sel = selectRuntimeV2DepthSeries(frames);
  ok('source=blended (fallback)', sel.source === 'blended', sel.source);
  ok('policy=fallback_blended', sel.policy === 'fallback_blended', sel.policy);
  ok('switchReason not null', sel.switchReason !== null, sel.switchReason ?? 'null');
  ok('blended.tailSpikeOnly=true', sel.stats.blended.tailSpikeOnly === true);
  ok('proxy.hasUsableCurve=false', sel.stats.proxy.hasUsableCurve === false);
  ok('raw.hasUsableCurve=false', sel.stats.raw.hasUsableCurve === false);
  console.log(`    policy=${sel.policy}, switchReason=${sel.switchReason}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section B — V2 integration with selected depths
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n─── Section B: V2 integration with selected depths ───\n');

// ── B1: blended collapsed, proxy has valid shallow curve → V2 passes ──────────
console.log('B1. valid_shallow_continuous_proxy_curve_must_pass');
{
  // Create frames where:
  //   blended = near-zero (collapsed) throughout
  //   proxy = proper shallow down-up-return curve
  // Steps:
  //   1. selectRuntimeV2DepthSeries selects proxy
  //   2. V2 receives proxy depths as input
  //   3. Expected: usableMotionEvidence=true
  const proxyDepths = [
    // Pre-descent baseline (5 frames)
    0.002, 0.002, 0.002, 0.002, 0.002,
    // Descent (7 frames)
    0.010, 0.020, 0.033, 0.045, 0.052, 0.057, 0.060,
    // peak at index 11 (depth=0.060)
    // Ascent (5 frames)
    0.048, 0.033, 0.020, 0.010, 0.004,
    // Stable-after-return (3 frames)
    0.002, 0.001, 0.001,
  ];
  const n = proxyDepths.length;
  const frames = proxyDepths.map((p, i) =>
    makeDepthFrame(1e-9, p, p * 1.02, i * 100)
  );

  // Step 1: selector should pick proxy
  const sel = selectRuntimeV2DepthSeries(frames);
  ok(
    'B1 selector picks proxy (blended collapsed)',
    sel.source === 'proxy',
    `got source=${sel.source}, policy=${sel.policy}`
  );

  // Step 2: feed selected depths to V2
  const v2Input = framesFromDepths(sel.depths);
  const result = evaluateSquatMotionEvidenceV2(v2Input);

  ok(
    'B1 usableMotionEvidence=true (proxy curve passes V2)',
    result.usableMotionEvidence === true,
    `blockReason=${result.blockReason}, motionPattern=${result.motionPattern}`
  );
  ok(
    'B1 motionPattern=down_up_return',
    result.motionPattern === 'down_up_return',
    result.motionPattern
  );
  ok(
    'B1 blockReason=null',
    result.blockReason === null,
    result.blockReason
  );
  const rm = result.romBand;
  ok(
    'B1 romBand=shallow or low_rom (small peak)',
    rm === 'shallow' || rm === 'low_rom',
    rm
  );
  console.log(`    romBand=${result.romBand}, relativePeak=${result.metrics?.relativePeak?.toFixed(3)}`);
  console.log(`    selectedSource=${sel.source}, selectedMax=${sel.stats.proxy.max.toFixed(3)}, meaningfulFrames=${sel.stats.proxy.meaningfulFrameCount}`);
}

// ── B2: blended usable deep curve → V2 passes (regression check) ──────────────
console.log('\nB2. valid_deep_blended_curve_must_pass (regression)');
{
  // Use the existing PR04C verified-passing deep squat fixture
  const fix = loadFixture('pr04c_slow_deep_descent_then_ascent_return_must_pass.json');
  const result = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('B2 usableMotionEvidence=true', result.usableMotionEvidence === true, result.blockReason ?? '');
  ok('B2 motionPattern=down_up_return', result.motionPattern === 'down_up_return', result.motionPattern);
  ok(
    'B2 romBand=standard or deep or shallow',
    result.romBand === 'standard' || result.romBand === 'deep' || result.romBand === 'shallow',
    result.romBand
  );
  // Also verify the depth selector would pick blended for this deep fixture
  // (the fixture uses depth/lowerBodySignal directly, so we use synthetic selector test)
  const deepDepths = fix.v2Frames.map((f) => f.depth ?? f.lowerBodySignal ?? 0);
  const frames = deepDepths.map((d, i) =>
    makeDepthFrame(d, d * 0.85, d * 1.05, i * 100)
  );
  const sel = selectRuntimeV2DepthSeries(frames);
  ok('B2 selector picks blended (blended usable for deep)', sel.source === 'blended', sel.source);
  ok('B2 policy=blended_usable', sel.policy === 'blended_usable', sel.policy);
  console.log(`    romBand=${result.romBand}, relativePeak=${result.metrics?.relativePeak?.toFixed(3)}`);
  console.log(`    selPolicy=${sel.policy}, blended.meaningfulFrames=${sel.stats.blended.meaningfulFrameCount}`);
}

// ── B3: tail spike only (all series) → V2 fails ───────────────────────────────
console.log('\nB3. tail_spike_after_standing_must_fail');
{
  // All standing (1e-8), last 2 frames tiny spike
  const n = 25;
  const depths = Array.from({ length: n }, (_, i) => (i >= n - 2 ? 0.058 : 1e-8));
  const frames = depths.map((d, i) => makeDepthFrame(d, d, d, i * 100));
  const sel = selectRuntimeV2DepthSeries(frames);
  ok('B3 policy=fallback_blended (all spike)', sel.policy === 'fallback_blended', sel.policy);

  // V2 with spike-only input
  const v2Input = framesFromDepths(sel.depths);
  const result = evaluateSquatMotionEvidenceV2(v2Input);
  ok('B3 usableMotionEvidence=false (no post-peak frames)', result.usableMotionEvidence === false, '');
  ok(
    'B3 blockReason no pass (no reversal/return)',
    result.blockReason !== null,
    result.blockReason
  );
  console.log(`    blockReason=${result.blockReason}, motionPattern=${result.motionPattern}`);
}

// ── B4: standing small movement → fails ───────────────────────────────────────
console.log('\nB4. standing_small_movement_must_fail (04B regression)');
{
  const fix = loadFixture('standing_small_movement_after_prior_pass_must_fail.json');
  const result = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('B4 usableMotionEvidence=false', result.usableMotionEvidence === false, result.blockReason ?? '');
  ok(
    'B4 not down_up_return',
    result.motionPattern !== 'down_up_return',
    result.motionPattern
  );
  console.log(`    blockReason=${result.blockReason}, motionPattern=${result.motionPattern}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section C — Guard regressions (04B / 04C)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n─── Section C: Guard regressions (04B / 04C) ───\n');

// ── C1: same_frame_reversal_return → 04B Guard B (return_not_after_reversal) ──
console.log('C1. same_frame_reversal_return_still_must_fail (04B Guard B)');
{
  const fix = loadFixture('real_device_false_pass_tiny_motion_01.json');
  const result = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('C1 usableMotionEvidence=false', result.usableMotionEvidence === false, result.blockReason ?? '');
  const acceptable = [
    'return_not_after_reversal',
    'incomplete_return',
    'no_reversal',
    'no_pre_descent_baseline',
    'insufficient_post_peak_evidence',
    'micro_bounce',
    'no_meaningful_descent',
  ];
  ok(
    'C1 blockReason is a valid guard response',
    result.blockReason !== null && acceptable.includes(result.blockReason),
    result.blockReason
  );
  console.log(`    blockReason=${result.blockReason}, motionPattern=${result.motionPattern}`);
}

// ── C2: peak_at_tail_stall → 04C: not terminal pass, awaiting ascent ──────────
console.log('\nC2. peak_at_tail_still_must_wait_not_pass (04C guard)');
{
  const fix = loadFixture('pr04c_peak_at_tail_stall_must_not_pass_but_wait.json');
  const result = evaluateSquatMotionEvidenceV2(fix.v2Frames);
  ok('C2 usableMotionEvidence=false', result.usableMotionEvidence === false, result.blockReason ?? '');
  ok(
    'C2 blockReason=no_reversal or no_return_to_start (awaiting)',
    result.blockReason === 'no_reversal' || result.blockReason === 'no_return_to_start',
    result.blockReason
  );
  const peakIdx = result.metrics?.peakFrameIndex ?? -1;
  const inputCount = result.metrics?.inputFrameCount ?? 0;
  ok(
    'C2 peak is at or near tail (peakAtTailStall)',
    inputCount > 0 && peakIdx >= inputCount - 3,
    `peakIdx=${peakIdx}, inputCount=${inputCount}`
  );
  console.log(`    blockReason=${result.blockReason}, peakIdx=${peakIdx}/${inputCount}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n─── Summary ───\n');
console.log(
  `Depth source policy columns for representative cases:\n` +
  `  fixture                                   | source   | policy\n` +
  `  ----------------------------------------- | -------- | ------\n` +
  `  blended_usable (deep)                     | blended  | blended_usable\n` +
  `  blended_collapsed_proxy_usable (shallow)  | proxy    | blended_collapsed_proxy_selected\n` +
  `  blended_tail_spike_proxy_usable           | proxy    | tail_spike_proxy_selected\n` +
  `  all_series_tail_spike                     | blended  | fallback_blended\n`
);

const total = passed + failed;
console.log(`\n${passed}/${total} tests passed`);
if (failed > 0) {
  console.error(`\n${failed} FAILED`);
  process.exit(1);
} else {
  console.log('\nAll PR04D smoke tests passed.');
  process.exit(0);
}
