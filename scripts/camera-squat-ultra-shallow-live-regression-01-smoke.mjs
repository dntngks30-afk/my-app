/**
 * PR-SQUAT-ULTRA-SHALLOW-CLOSURE-01 / ALIGN-02 / FIX-02 — live ultra-low regression
 * npx tsx scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs
 *
 * A_truncated: zig-zag post-peak; CLOSURE-01 guarded stream integrity.
 * A_extended: A_trunc + standing tail — ultra_low_rom_cycle.
 * A_runtime_authoritative_fail: rel~0.06 + admitted + monotonic guarded miss + backloaded return (FIX-03 누적 fallback 게이트).
 * A_runtime_authoritative_fail_ext: 위 버퍼 + standing tail — ultra_low_rom_cycle (선호).
 * Fixture B: low_rom_cycle anchor.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass } = await import(
  '../src/lib/camera/auto-progression.ts'
);

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
 * FIX-03: 실기기 0.06대 — 피크 직후 12f 윈도우는 좁은 박스만 흔들리며 monotonic(slow) drop 바닥 미달,
 * 이후 backloaded 복귀는 strict 2f 동시 hit 없이(연속 두 프레임 ≤ peak−req 회피) 누적만 충분.
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
  const postZig = [
    0.0812, 0.0796, 0.0808, 0.0794, 0.0805, 0.0792, 0.0803, 0.0791, 0.0801, 0.0790, 0.0804, 0.0793,
  ];
  const postBackloaded = [
    0.0778, 0.0742, 0.0765, 0.0736, 0.0762, 0.0732, 0.076, 0.0728, 0.0758, 0.0725, 0.0755, 0.0738,
  ];
  const post = [...postZig, ...postBackloaded];
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

/**
 * Fixture C: PR-SQUAT-ULTRA-LOW-DOWNUP-TIMING-BYPASS-01 타겟 클래스.
 *
 * ultra-low ROM(rel~0.058) + descent-to-peak 타이밍이 극도로 짧아서
 * pre-fix 에서는 `descent_span_too_short` 로 차단된다.
 * reversal·recovery·finalize proof 는 충분 → bypass 조건 모두 충족 → post-fix 에서 shallow cycle.
 *
 * 타이밍 설계:
 *   - baseline 8f × 40ms (BASELINE_WINDOW=6 오염 방지)
 *   - 짧은 descent: effectiveDescentStart → peak 까지 40ms (1프레임 간격) << 120ms relaxed
 *   - peak hold 1f, 복귀 4f, standing tail 6f (continuity ≥ 3, dropRatio ≥ 0.45 확보)
 */
function buildFixtureCShortDescentTiming() {
  const base = 0.02;
  const peak = 0.078; // rel peak ~0.058 vs baseline 0.02 → ultra_low_rom 대역
  const depths = [
    // baseline 8f (BASELINE_WINDOW=6 이후에도 여유분 확보)
    base, base, base, base, base, base, base, base,
    // 짧은 descent: 단 1프레임 계단으로 peak 도달 (40ms << 120ms relaxed threshold)
    0.04, peak,
    // peak hold 1f
    peak,
    // 복귀 4f (점진적): recoveryDropRatio≥0.45, continuity≥3 확보
    0.062, 0.048, 0.032, 0.024,
    // standing tail 6f
    base, base, base, base, base, base,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'bottom',
    'bottom',
    'ascent', 'ascent', 'ascent', 'ascent',
    'start', 'start', 'start', 'start', 'start', 'start',
  ];
  let t = 100;
  return depths.map((d, i) => makeFrame(d, (t += 40), phases[i]));
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

// ─── Fixture C: PR-SQUAT-ULTRA-LOW-DOWNUP-TIMING-BYPASS-01 ───────────────────
console.log('\nFixture C — ultra-low ROM + short descent timing bypass\n');
{
  const st = evaluateSquatCompletionState(buildFixtureCShortDescentTiming());
  const rel = st.relativeDepthPeak;
  ok('C: relativeDepthPeak ultra-low band', rel >= 0.04 && rel < 0.09, { rel });
  ok('C: evidenceLabel ultra_low_rom', st.evidenceLabel === 'ultra_low_rom', { evidenceLabel: st.evidenceLabel });
  ok('C: officialShallowPathCandidate', st.officialShallowPathCandidate === true, st);
  ok('C: officialShallowPathAdmitted', st.officialShallowPathAdmitted === true, st);
  ok('C: attemptStarted', st.attemptStarted === true, st);
  ok('C: descendConfirmed', st.descendConfirmed === true, st);
  ok('C: completionBlockedReason !== descent_span_too_short (bypass 발동)',
    st.completionBlockedReason !== 'descent_span_too_short',
    { completionBlockedReason: st.completionBlockedReason });
  ok('C: completionSatisfied', st.completionSatisfied === true,
    { completionPassReason: st.completionPassReason, completionBlockedReason: st.completionBlockedReason });
  ok('C: completionPassReason ultra_low_rom_cycle or low_rom_cycle (shallow truth)',
    st.completionPassReason === 'ultra_low_rom_cycle' || st.completionPassReason === 'low_rom_cycle',
    { completionPassReason: st.completionPassReason });
  ok('C: officialShallowPathClosed', st.officialShallowPathClosed === true, st);
  ok('C: eventCyclePromoted false (rule path, not event promotion)',
    st.eventCyclePromoted !== true, st);
  ok('C: completionPassReason NOT standard_cycle', st.completionPassReason !== 'standard_cycle',
    { completionPassReason: st.completionPassReason });
}

// ─── PR-TRAJECTORY-RESCUE-INTEGRITY-01: early rescue false positive guard ────
console.log('\nPR-TRAJECTORY-RESCUE-INTEGRITY-01 — trajectory rescue alone must not close pass\n');

/**
 * Fixture D1: "early rescue false positive" 클래스.
 *
 * ultra-low shallow 대역(rel ~0.04) — 피크 이후 버퍼가 standing recovery 없이 끝남:
 *   - shallowClosureProofBundleFromStream = false (finalize 미충족 → bundle 조건 불충족)
 *   - officialShallowPrimaryDropClosureFallback = false (동일)
 *   - officialShallowStreamBridgeApplied = false (bundle 선행 요건 불충족)
 *   - trajectory rescue도 발동 불가 (finalize 미충족)
 *   - explicit ascent 없음
 *
 * PR-TRAJECTORY-RESCUE-INTEGRITY-01 계약:
 * "shallow return proof 없음 = pass 불가"를 end-to-end로 잠금.
 * 이 케이스는 fix 전후 모두 불통과 — 회귀 잠금 역할.
 */
function buildFixtureD1NoReturnProof() {
  const base = 0.02;
  const peak = 0.062; // rel peak ~0.042 vs baseline 0.02 → ultra_low_rom 대역
  const depths = [
    // baseline 8f
    base, base, base, base, base, base, base, base,
    // descent
    0.03, 0.045, peak,
    // bottom 1f
    peak,
    // post-peak: zig-zag (no return, no standing tail) — 버퍼 미완성
    0.061, 0.060, 0.061, 0.060, 0.061, 0.060,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom',
    'bottom',
    'start', 'start', 'start', 'start', 'start', 'start',
  ];
  let t = 100;
  return depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
}

/**
 * Fixture D2: "valid shallow pass 유지" 클래스.
 *
 * ultra-low shallow 대역(rel ~0.042) — explicit ascent는 약해도 되지만
 * shallowClosureProofBundleFromStream = true (post-peak return drop ≥ 0.88×required).
 *
 * 기대: shallow return proof가 있으므로 ultra_low_rom_cycle로 pass되어야 한다.
 */
function buildFixtureD2ValidShallowPass() {
  const base = 0.02;
  const peak = 0.062; // rel peak ~0.042 vs baseline 0.02 → ultra_low_rom 대역
  const depths = [
    // baseline 8f
    base, base, base, base, base, base, base, base,
    // descent
    0.03, 0.048, peak,
    // bottom 1f
    peak,
    // post-peak return: 점진적 복귀 (drop = 0.042 ≫ 0.88×required ≈ 0.006)
    0.055, 0.045, 0.035, 0.027,
    // standing tail 6f (recoveryReturnContinuityFrames, dropRatio 확보)
    base, base, base, base, base, base,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom',
    'bottom',
    'start', 'start', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start',
  ];
  let t = 100;
  return depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
}

{
  const st = evaluateSquatCompletionState(buildFixtureD1NoReturnProof());
  ok('D1 no_return_proof: completionPassReason !== ultra_low_rom_cycle',
    st.completionPassReason !== 'ultra_low_rom_cycle',
    { completionPassReason: st.completionPassReason, completionBlockedReason: st.completionBlockedReason });
  ok('D1 no_return_proof: officialShallowPathClosed !== true',
    st.officialShallowPathClosed !== true,
    { officialShallowPathClosed: st.officialShallowPathClosed });
  ok('D1 no_return_proof: eventCyclePromoted !== true',
    st.eventCyclePromoted !== true,
    { eventCyclePromoted: st.eventCyclePromoted });
  ok('D1 no_return_proof: completionSatisfied false (no standing recovery = no pass)',
    st.completionSatisfied !== true,
    { completionSatisfied: st.completionSatisfied,
      officialShallowStreamBridgeApplied: st.officialShallowStreamBridgeApplied,
      shallowClosureProofBundleFromStream: undefined });
}

{
  const st = evaluateSquatCompletionState(buildFixtureD2ValidShallowPass());
  const passReasonOk =
    st.completionPassReason === 'ultra_low_rom_cycle' ||
    st.completionPassReason === 'low_rom_cycle';
  ok('D2 valid_shallow_pass: completionPassReason === ultra_low_rom_cycle (또는 low_rom_cycle)',
    passReasonOk,
    { completionPassReason: st.completionPassReason, completionBlockedReason: st.completionBlockedReason });
  ok('D2 valid_shallow_pass: officialShallowPathClosed === true',
    st.officialShallowPathClosed === true,
    { officialShallowPathClosed: st.officialShallowPathClosed });
  ok('D2 valid_shallow_pass: eventCyclePromoted !== true',
    st.eventCyclePromoted !== true,
    { eventCyclePromoted: st.eventCyclePromoted });
  ok('D2 valid_shallow_pass: completionSatisfied true',
    st.completionSatisfied === true,
    { completionSatisfied: st.completionSatisfied });
}

// ─── PR-SETUP-SERIES-START-01: setup/arming series-start 오염 시그니처 → final gate predicate ─
console.log('\nFixture F — setup series-start false-pass signature (final gate only)\n');
{
  const toxicCs = {
    evidenceLabel: 'ultra_low_rom',
    reversalConfirmedBy: 'trajectory',
    trajectoryReversalRescueApplied: true,
    committedAtMs: 500,
    reversalAtMs: 500,
    descendStartAtMs: 500,
    squatDescentToPeakMs: 0,
    peakLatchedAtIndex: 0,
    squatEventCycle: { notes: ['peak_anchor_at_series_start'] },
  };
  const toxicDbg = { armingFallbackUsed: true };
  ok(
    'F1: full toxic signature → shouldBlock true',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass('squat', toxicCs, toxicDbg) === true
  );
  ok(
    'F2: descent_weak note only → shouldBlock true',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass('squat', {
      ...toxicCs,
      squatEventCycle: { notes: ['descent_weak'] },
    }, toxicDbg) === true
  );
  ok(
    'F3: legitimate — armingFallbackUsed false → shouldBlock false',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass('squat', toxicCs, { armingFallbackUsed: false }) ===
      false
  );
  ok(
    'F4: legitimate — peakLatchedAtIndex !== 0 → shouldBlock false',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass('squat', { ...toxicCs, peakLatchedAtIndex: 12 }, toxicDbg) ===
      false
  );
  ok(
    'F5: legitimate — squatDescentToPeakMs > 0 → shouldBlock false',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(
      'squat',
      { ...toxicCs, squatDescentToPeakMs: 120 },
      toxicDbg
    ) === false
  );
  ok(
    'F6: legitimate — timestamps differ → shouldBlock false',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(
      'squat',
      { ...toxicCs, committedAtMs: 500, reversalAtMs: 620, descendStartAtMs: 500 },
      toxicDbg
    ) === false
  );
  ok(
    'F7: no event-cycle contamination notes → shouldBlock false',
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(
      'squat',
      { ...toxicCs, squatEventCycle: { notes: ['other'] } },
      toxicDbg
    ) === false
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
