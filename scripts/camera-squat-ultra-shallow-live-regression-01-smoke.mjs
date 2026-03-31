/**
 * PR-SQUAT-ULTRA-SHALLOW-CLOSURE-01 / ALIGN-02 / FIX-02 — live ultra-low regression
 * npx tsx scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs
 *
 * A_truncated: zig-zag post-peak; CLOSURE-01 guarded stream integrity.
 * A_extended: A_trunc + standing tail — ultra_low_rom_cycle.
 * A_runtime_authoritative_fail: canonical real-device authoritative fail shape (rel~0.06, slow −0.001/frame post-peak);
 *   **이 PR(FIX-02) 릴리스 게이트** — post-fix 에서 no_reversal 탈출·reversal truth.
 * A_runtime_authoritative_fail_ext: 위 버퍼 + standing tail — ultra_low_rom_cycle (선호).
 * Fixture B: low_rom_cycle anchor.
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

/**
 * Canonical authoritative runtime fail → post-fix: guarded slow-recovery monotonic (FIX-02 / ALIGN-02).
 * 피크 직후 reversal depth 가 프레임당 ~0.001 만 감소해 primary postPeakMonotonic(6f, ε=0.002) 는 실패하던 클래스.
 */
function buildFixtureARuntimeAuthoritativeFail() {
  const base = 0.02;
  const peak = 0.082;
  const pre = [...Array(6).fill(base), 0.032, 0.055, 0.07, 0.078, peak, peak];
  const prePhases = [
    ...Array(6).fill('start'),
    'descent',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
  ];
  const postLen = 14;
  const post = [];
  let d = peak - 0.001;
  for (let i = 0; i < postLen; i++) {
    post.push(d);
    d -= 0.001;
  }
  const postPhases = Array(post.length).fill('start');
  const depths = [...pre, ...post];
  const phases = [...prePhases, ...postPhases];
  let t = 200;
  return depths.map((dp, i) => makeFrame(dp, (t += 80), phases[i]));
}

/** A_runtime_authoritative_fail + standing tail — ultra_low_rom_cycle 선호 검증 */
function buildFixtureARuntimeAuthoritativeFailExtended() {
  const inner = buildFixtureARuntimeAuthoritativeFail();
  const tailDepths = [0.065, 0.052, 0.04, 0.028, 0.022, 0.02, 0.02, 0.02, 0.02];
  const tailPhases = tailDepths.map((_, i) => (i >= tailDepths.length - 5 ? 'ascent' : 'start'));
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

/*
 * A_runtime_authoritative_fail — 문서화된 canonical real-device authoritative fail (pre-fix 코드 기준):
 * relativeDepthPeak ≈ 0.06 대역, attemptStarted/baselineFrozen true, completionBlockedReasonAuthoritative,
 * officialShallowPathCandidate/Admitted true, officialShallowPathClosed false,
 * officialShallowPathBlockedReason === no_reversal, officialShallowReversalSatisfied false,
 * officialShallowClosureProofSatisfied false, eventCyclePromoted === false.
 * 머지 기준: 아래 post-fix assert 만 통과하면 됨(추가 실기기 success export 불필요).
 */
{
  const st = evaluateSquatCompletionState(buildFixtureARuntimeAuthoritativeFail());
  const rel = st.relativeDepthPeak;
  ok('A_runtime_authoritative_fail: relativeDepthPeak ultra-shallow band (~0.06)', rel >= 0.045 && rel <= 0.09, { rel });
  ok('A_runtime_authoritative_fail: officialShallowPathCandidate', st.officialShallowPathCandidate === true, st);
  ok('A_runtime_authoritative_fail: officialShallowPathAdmitted', st.officialShallowPathAdmitted === true, st);
  ok('A_runtime_authoritative_fail: attemptStarted true', st.attemptStarted === true, st);
  ok('A_runtime_authoritative_fail: baselineFrozen true', st.baselineFrozen === true, st);
  ok('A_runtime_authoritative_fail: completionBlockedReasonAuthoritative', completionBlockedReasonAuthoritative(st), st);
  ok('A_runtime_authoritative_fail: officialShallowPathClosed false (incomplete buffer)', st.officialShallowPathClosed === false, st);
  ok('A_runtime_authoritative_fail: not stuck on no_reversal (post-fix)', st.officialShallowPathBlockedReason !== 'no_reversal', st);
  ok('A_runtime_authoritative_fail: officialShallowReversalSatisfied true (post-fix)', st.officialShallowReversalSatisfied === true, st);
  ok('A_runtime_authoritative_fail: officialShallowClosureProofSatisfied false (no standing tail)', st.officialShallowClosureProofSatisfied === false, st);
  ok('A_runtime_authoritative_fail: eventCyclePromoted false', st.eventCyclePromoted !== true, st);
}

{
  const st = evaluateSquatCompletionState(buildFixtureARuntimeAuthoritativeFailExtended());
  ok('A_runtime_authoritative_fail_ext: ultra_low_rom_cycle', st.completionPassReason === 'ultra_low_rom_cycle', st.completionPassReason);
  ok('A_runtime_authoritative_fail_ext: officialShallowPathClosed', st.officialShallowPathClosed === true, st);
  ok('A_runtime_authoritative_fail_ext: officialShallowReversalSatisfied', st.officialShallowReversalSatisfied === true, st);
  ok('A_runtime_authoritative_fail_ext: officialShallowClosureProofSatisfied', st.officialShallowClosureProofSatisfied === true, st);
  ok('A_runtime_authoritative_fail_ext: eventCyclePromoted false', st.eventCyclePromoted !== true, st);
  ok('A_runtime_authoritative_fail_ext: relativeDepthPeak ultra-shallow', st.relativeDepthPeak < 0.09, { rel: st.relativeDepthPeak });
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
