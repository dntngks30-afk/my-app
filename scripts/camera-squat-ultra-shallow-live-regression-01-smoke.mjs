/**
 * PR-SQUAT-ULTRA-SHALLOW-CLOSURE-01 — live ultra-low authoritative regression
 * npx tsx scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs
 *
 * A_truncated: pre-fix canonical = no_reversal + reversal false (guarded missed ascent streak).
 * Post-fix: reversal true, blocked moves off no_reversal (typically not_standing_recovered) on same buffer.
 * A_extended: same prefix + standing tail — end-to-end ultra_low_rom_cycle (fix + completion).
 * Fixture B: deeper low_rom success — regression anchor, not the PR primary target.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra ?? '');
    process.exitCode = 1;
  }
}

/** Trace-equivalent: camera-trace uses attemptStarted && baselineFrozen */
function completionBlockedReasonAuthoritative(st) {
  return st.attemptStarted === true && st.baselineFrozen === true;
}

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: {
      squatDepthProxy: depth,
      squatDepthProxyBlended: depth,
    },
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

console.log('\ncamera-squat-ultra-shallow-live-regression-01-smoke\n');

/** A truncated: zig-zag post-peak, ends before standing (canonical no_reversal pre-fix). */
function buildFixtureATruncated() {
  const base = 0.02;
  const peak = 0.08; // rel peak ~0.06 vs baseline 0.02
  const pre = [
    ...Array(4).fill(base), // baseline standing
    0.03, 0.05, 0.07, // descent
    peak,
    peak, // bottom
  ];
  const prePhases = [
    'start',
    'start',
    'start',
    'start',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
  ];
  /**
   * Zig-zag only (no tail into deep standing): avoids any later pair both <= peak−req; monotonic passes first window;
   * guarded fails (no ascent streak). Buffer ends before standing recovery so rule stays `no_reversal`.
   */
  const post = [0.079, 0.072, 0.079, 0.072, 0.079, 0.072];
  const postPhases = Array(post.length).fill('start');
  const depths = [...pre, ...post];
  const phases = [...prePhases, ...postPhases];
  let t = 100;
  return depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
}

/** A extended: truncated prefix + alternating return + standing hold (no two sub-threshold frames until final hold). */
function buildFixtureAExtended() {
  const inner = buildFixtureATruncated();
  const tailDepths = [0.079, 0.068, 0.079, 0.055, 0.079, 0.042, 0.079, 0.03, 0.079, 0.022, 0.02, 0.02, 0.02];
  const tailPhases = tailDepths.map((_, i) => (i >= tailDepths.length - 6 ? 'ascent' : 'start'));
  let t = inner[inner.length - 1].timestampMs;
  const tail = tailDepths.map((d, i) => makeFrame(d, (t += 80), tailPhases[i]));
  return [...inner, ...tail];
}

/** Fixture B: relativeDepthPeak well above ~0.08 ultra band; low_rom_cycle regression anchor. */
function buildFixtureB() {
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.05, 0.12, 0.22, 0.36, 0.36, 0.22, 0.12, 0.06, 0.03, 0.015, 0.01,
  ];
  const phases = [
    'start',
    'start',
    'start',
    'start',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
    'ascent',
    'ascent',
    'ascent',
    'start',
    'start',
    'start',
  ];
  let t = 300;
  return depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
}

{
  const st = evaluateSquatCompletionState(buildFixtureATruncated());
  const rel = st.relativeDepthPeak;
  ok('A_trunc: relativeDepthPeak ultra-shallow band (~0.06)', rel >= 0.045 && rel <= 0.09, { rel });
  ok('A_trunc: officialShallowPathCandidate', st.officialShallowPathCandidate === true, st);
  ok('A_trunc: officialShallowPathAdmitted', st.officialShallowPathAdmitted === true, st);
  ok('A_trunc: attemptStarted + baselineFrozen authoritative', completionBlockedReasonAuthoritative(st), st);
  ok('A_trunc: officialShallowPathClosed false (incomplete buffer)', st.officialShallowPathClosed === false, st);
  ok('A_trunc: no longer stuck on no_reversal (reversal lane opens)', st.officialShallowPathBlockedReason !== 'no_reversal', st);
  ok('A_trunc: officialShallowReversalSatisfied true', st.officialShallowReversalSatisfied === true, st);
  ok('A_trunc: officialShallowClosureProofSatisfied false', st.officialShallowClosureProofSatisfied === false, st);
  ok('A_trunc: eventCyclePromoted false', st.eventCyclePromoted !== true, st);
}

{
  const st = evaluateSquatCompletionState(buildFixtureAExtended());
  ok('A_ext: ultra_low_rom_cycle', st.completionPassReason === 'ultra_low_rom_cycle', st.completionPassReason);
  ok('A_ext: officialShallowPathClosed', st.officialShallowPathClosed === true, st);
  ok('A_ext: officialShallowReversalSatisfied', st.officialShallowReversalSatisfied === true, st);
  ok('A_ext: officialShallowClosureProofSatisfied', st.officialShallowClosureProofSatisfied === true, st);
  ok('A_ext: eventCyclePromoted false', st.eventCyclePromoted !== true, st);
  ok('A_ext: relativeDepthPeak still ultra-shallow', st.relativeDepthPeak < 0.09, { rel: st.relativeDepthPeak });
}

{
  const st = evaluateSquatCompletionState(buildFixtureB());
  ok('B: relativeDepthPeak above ultra-shallow class', st.relativeDepthPeak >= 0.12, {
    rel: st.relativeDepthPeak,
  });
  ok('B: completionPassReason low_rom_cycle', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('B: officialShallowPathClosed', st.officialShallowPathClosed === true, st);
  ok('B: eventCyclePromoted false', st.eventCyclePromoted !== true, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
