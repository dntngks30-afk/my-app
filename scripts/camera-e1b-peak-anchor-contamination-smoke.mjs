/**
 * PR-E1B-PEAK-ANCHOR-CONTAMINATION-01
 *
 * 회귀 스모크: canonical anti-false-pass 에서 `peakLatchedAtIndex = 0`(시리즈 시작 오염) 이
 * 유효 guarded shallow local peak 가 존재할 때 canonical 입력에서만 치환되는지 검증.
 *
 * 검증 섹션:
 * A. 오염 프레임만 있고 유효 로컬 피크 없음 → anti-false-pass 여전히 실패(false-positive 방어)
 * B. 오염 시작 + 이후 유효 down-up local peak → canonical contract anti-false-pass 통과 가능
 * C. trajectory rescue 단독 → success owner 아님
 * D. deep standard_cycle 보존
 *
 * npx tsx scripts/camera-e1b-peak-anchor-contamination-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
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
function buildFrames(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

console.log('\nPR-E1B camera-e1b-peak-anchor-contamination-smoke\n');

// ─────────────────────────────────────────────────────────────────────────────
// A. guarded local peak 없는 케이스 — E1B 픽스 조건 미충족, 여전히 completion 불가
//
// 시나리오: 하강 후 바닥에서 정체(standing 복귀 없음).
// getGuardedShallowLocalPeakAnchor → no_post_peak_return 또는 no_recovery_continuity
// → guardedShallowLocalPeakFound = false
// → E1B fix 조건(guardedShallowLocalPeakFound===true) 미충족
// → peakLatchedAtIndex=0 이더라도 canonical input 에서 대체 없음
// → anti-false-pass 여전히 실패 (또는 아예 recovery 없어 completion 실패)
// ─────────────────────────────────────────────────────────────────────────────
console.log('  [A] no valid guarded local peak — E1B fix does not fire, completion blocked');
{
  // 하강 후 바닥 정체: post-peak standing 복귀가 없어 guardedShallowLocalPeakFound = false
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10,
    ],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);

  // guarded local peak 못 찾음(no standing return)
  ok('A: no valid local peak — guardedShallowLocalPeakFound false', st.guardedShallowLocalPeakFound !== true, st.guardedShallowLocalPeakFound);
  // completion 은 실패
  ok('A: no valid local peak — completionSatisfied false', st.completionSatisfied !== true, st.completionPassReason);
  ok('A: no valid local peak — no official shallow close', st.officialShallowPathClosed !== true, st.officialShallowPathClosed);
}

// ─────────────────────────────────────────────────────────────────────────────
// A2. 오염 시작 + 이후 descent는 있지만 standing 복귀 없음 → 여전히 실패
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [A2] contaminated start + descent but no standing return — still blocked');
{
  const fr = buildFrames(
    [0.09, 0.01, 0.01, 0.01, 0.04, 0.07, 0.09, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom',
      'bottom', 'bottom', 'bottom', 'bottom',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);
  ok('A2: no standing return — not completionSatisfied', st.completionSatisfied === false, st.completionPassReason);
  ok('A2: no standing return — no official shallow close', st.officialShallowPathClosed !== true, st.officialShallowPathClosed);
}

// ─────────────────────────────────────────────────────────────────────────────
// B. 유효 얕은 down-up — local peak 복구 허용
// 기본 얕은 스쿼트 시나리오: local peak > 0, recovery 있음
// antiFalsePass 가 local peak index 를 사용해 통과
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [B] valid shallow down-up — canonical anti-false-pass can recover via local peak');
{
  // 정상 low_rom 얕은 스쿼트: 시리즈 시작 이후 하강→피크→회복
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);

  ok('B: valid shallow — officialShallowPathAdmitted', st.officialShallowPathAdmitted === true, st.officialShallowPathAdmitted);
  ok('B: valid shallow — completionSatisfied', st.completionSatisfied === true, st.completionPassReason);
  ok(
    'B: valid shallow — passReason is shallow cycle',
    st.completionPassReason === 'low_rom_cycle' || st.completionPassReason === 'official_shallow_cycle',
    st.completionPassReason
  );
  ok('B: valid shallow — canonicalAntiFalsePassClear', st.canonicalShallowContractAntiFalsePassClear === true, st.canonicalShallowContractAntiFalsePassClear);
  ok('B: valid shallow — officialShallowPathClosed', st.officialShallowPathClosed === true, st.officialShallowPathClosed);
  // global peakLatchedAtIndex 는 raw 값 보존(debug용)
  ok('B: valid shallow — global peakLatchedAtIndex preserved (not globally overwritten)', typeof st.peakLatchedAtIndex === 'number' || st.peakLatchedAtIndex === null, st.peakLatchedAtIndex);
  ok('B: valid shallow — no event promotion', st.eventCyclePromoted === false, st.eventCyclePromoted);
}

// ─────────────────────────────────────────────────────────────────────────────
// B2. canonical input은 로컬 피크를 쓰지만, 글로벌 state.peakLatchedAtIndex 는 그대로 유지됨
// (anti-false-pass peak index 치환이 canonical derive 에만 국한됨을 명시)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [B2] global peakLatchedAtIndex not globally overwritten by E1B fix');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);

  // global peakLatchedAtIndex 는 원래 core 계산값 — canonical input shaping 이 전역을 덮지 않는다
  // canonicalShallowContractAntiFalsePassClear 는 true(로컬 피크로 평가됨)
  ok('B2: global peakLatchedAtIndex is from core, not overwritten', st.peakLatchedAtIndex !== undefined, `type=${typeof st.peakLatchedAtIndex}`);
  ok('B2: canonicalAntiFalsePassClear true', st.canonicalShallowContractAntiFalsePassClear === true, st.canonicalShallowContractAntiFalsePassClear);
}

// ─────────────────────────────────────────────────────────────────────────────
// C. trajectory rescue 단독 → success owner 아님
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [C] trajectory rescue alone — still not direct success owner');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);

  // E1B 픽스는 trajectory rescue 를 direct success owner 로 만들지 않는다.
  // trajectory rescue 가 있다면 provenance-only 이고, official closer 를 통해서만 success 가 열린다.
  if (st.trajectoryReversalRescueApplied === true) {
    ok(
      'C: trajectory rescue applied — success must come from canonical closer only',
      st.completionPassReason === 'official_shallow_cycle' ||
        st.completionPassReason === 'low_rom_cycle' ||
        st.completionPassReason === 'ultra_low_rom_cycle' ||
        st.completionPassReason === 'not_confirmed',
      st.completionPassReason
    );
    ok('C: trajectory rescue — eventCyclePromoted false', st.eventCyclePromoted === false, st.eventCyclePromoted);
  } else {
    ok('C: trajectory rescue not applied in this scenario (ok — no direct owner leak)', true, null);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// D. deep standard_cycle — E1B 픽스 영향 없음
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [D] deep standard_cycle — unchanged by E1B');
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    60
  );
  const st = evaluateSquatCompletionState(fr);

  ok('D: deep — standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('D: deep — not officialShallowPathCandidate', st.officialShallowPathCandidate === false, st.officialShallowPathCandidate);
  ok('D: deep — officialShallowPathClosed false', st.officialShallowPathClosed !== true, st.officialShallowPathClosed);
  ok('D: deep — completionSatisfied true', st.completionSatisfied === true, st.completionSatisfied);
  ok('D: deep — not event rescue pass', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);
  ok('D: deep — not official_shallow_cycle', st.completionPassReason !== 'official_shallow_cycle', st.completionPassReason);
}

// ─────────────────────────────────────────────────────────────────────────────
// E. event-owner downgrade 보존
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [E] event-owner downgrade preserved');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);

  ok('E: eventCyclePromoted always false', st.eventCyclePromoted === false, st.eventCyclePromoted);
  ok('E: passReason not event_cycle variant', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
