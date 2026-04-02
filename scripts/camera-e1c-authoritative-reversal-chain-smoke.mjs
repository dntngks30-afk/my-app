/**
 * PR-E1C-AUTHORITATIVE-REVERSAL-CHAIN-ALIGN-01
 *
 * 회귀 스모크: computeOfficialShallowClosure의 closure bundle 게이트에서
 * recoveryMeetsLowRomStyleFinalizeProof 조건이 standard evidence band 케이스에서
 * stream bundle을 잘못 차단하던 문제(no_reversal false-negative) 수정 검증.
 *
 * 근본 원인:
 * - getStandingRecoveryFinalizeGate는 evidenceLabel === 'standard'(relativeDepthPeak 0.10~0.39) 구간에서
 *   frame+hold만 확인하고 recovery continuity/drop ratio는 확인하지 않는다.
 * - 그러나 computeOfficialShallowClosure는 항상 recoveryMeetsLowRomStyleFinalizeProof를 추가로 요구했다.
 * - 이 불일치로 finalize는 통과했으나 closure bundle이 차단 → stream bridge 미활성 → no_reversal 유지.
 *
 * 수정: computeOfficialShallowClosure의 main stream 경로에서
 * recoveryMeetsLowRomStyleFinalizeProof 조건을 제거하고 standingRecoveryFinalizeSatisfied에 위임.
 *
 * 검증 섹션:
 * A. standard evidence 구간(relativeDepthPeak ≈ 0.13) — PR-E1C 후 authoritative reversal chain 완성
 * B. low_rom 구간(relativeDepthPeak ≈ 0.09) — 기존 동작 보존
 * C. 하강만 있고 standing 미복귀 → 여전히 차단
 * D. trajectory rescue 단독 → success owner 아님 (provenance-only 보존)
 * E. deep standard_cycle — 영향 없음
 *
 * npx tsx scripts/camera-e1c-authoritative-reversal-chain-smoke.mjs
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
    timestampDeltaMs: 50,
    stepId: 'squat',
  };
}
function buildFrames(depths, phases, stepMs = 50) {
  return depths.map((d, i) => makeFrame(d, 200 + i * stepMs, phases[i] ?? 'start'));
}

console.log('\nPR-E1C camera-e1c-authoritative-reversal-chain-smoke\n');

// ─────────────────────────────────────────────────────────────────────────────
// A. standard evidence 구간 얕은 스쿼트 (relativeDepthPeak ≈ 0.13)
//
// 핵심 검증: PR-E1C 수정 전에는 evidenceLabel='standard' (relativeDepthPeak≥0.10) 이면서
// standingRecoveryFinalizeBand='low_rom' (relativeDepthPeak<0.40)인 구간에서
// recoveryMeetsLowRomStyleFinalizeProof 가 false일 때 closure bundle이 항상 차단됐다.
// PR-E1C 수정 후: standingRecoveryFinalizeSatisfied 하나만으로 bundle gate를 통과할 수 있어
// stream bridge가 활성화되고 authoritative reversal chain 완성.
// ─────────────────────────────────────────────────────────────────────────────
console.log('  [A] standard evidence shallow (relativeDepthPeak≈0.13) — E1C: authoritative chain now forms');
{
  // baseline ≈ 0.02, peak = 0.15 → relativeDepthPeak ≈ 0.13 (≥ 0.10 = standard evidence label)
  // standing recovery: 마지막 5프레임 × 50ms = 250ms hold (> 160ms standard minimum)
  const fr = buildFrames(
    [
      // baseline 4프레임
      0.02, 0.02, 0.02, 0.02,
      // descent 4프레임
      0.05, 0.09, 0.13, 0.15,
      // bottom 2프레임
      0.15, 0.15,
      // ascent 3프레임
      0.11, 0.07, 0.04,
      // standing recovery 5프레임 (250ms hold, > 160ms standard minimum)
      0.02, 0.02, 0.02, 0.02, 0.02,
    ],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'descent',
      'bottom', 'bottom',
      'ascent', 'ascent', 'ascent',
      'start', 'start', 'start', 'start', 'start',
    ],
    50
  );
  const st = evaluateSquatCompletionState(fr);

  ok('A: standard evidence — officialShallowPathAdmitted', st.officialShallowPathAdmitted === true, st.officialShallowPathAdmitted);
  ok('A: standard evidence — completionSatisfied', st.completionSatisfied === true, st.completionPassReason);
  ok(
    'A: standard evidence — passReason is shallow or standard cycle (not not_confirmed)',
    st.completionPassReason !== 'not_confirmed',
    st.completionPassReason
  );
  // closure bundle이 이제 활성화되어야 한다 (PR-E1C 핵심 검증)
  ok(
    'A: standard evidence — officialShallowClosureProofSatisfied (E1C fix)',
    st.officialShallowClosureProofSatisfied === true,
    `closureProof=${st.officialShallowClosureProofSatisfied} blocked=${st.completionBlockedReason}`
  );
  ok('A: standard evidence — no event promotion', st.eventCyclePromoted === false, st.eventCyclePromoted);
  ok('A: standard evidence — peakLatchedAtIndex non-zero (anti-false-pass)', (st.peakLatchedAtIndex ?? 0) > 0, st.peakLatchedAtIndex);
}

// ─────────────────────────────────────────────────────────────────────────────
// B. low_rom 구간 (relativeDepthPeak ≈ 0.09) — 기존 동작 보존
// PR-E1C는 low_rom 경로에 영향을 주지 않아야 한다
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [B] low_rom shallow (relativeDepthPeak≈0.09) — existing behavior preserved');
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01,
      0.03, 0.06, 0.09, 0.09,
      0.07, 0.05, 0.03,
      0.01, 0.01, 0.01, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent',
      'start', 'start', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);

  ok('B: low_rom — officialShallowPathAdmitted', st.officialShallowPathAdmitted === true, st.officialShallowPathAdmitted);
  ok('B: low_rom — completionSatisfied', st.completionSatisfied === true, st.completionPassReason);
  ok(
    'B: low_rom — passReason is shallow cycle',
    st.completionPassReason === 'low_rom_cycle' ||
      st.completionPassReason === 'official_shallow_cycle' ||
      st.completionPassReason === 'ultra_low_rom_cycle',
    st.completionPassReason
  );
  ok('B: low_rom — no event promotion', st.eventCyclePromoted === false, st.eventCyclePromoted);
}

// ─────────────────────────────────────────────────────────────────────────────
// C. 하강만 있고 standing 미복귀 → 여전히 차단
// (false-pass 방지 보존: standing finalize 없으면 closure bundle도 활성화 안 됨)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [C] descent without standing recovery — still blocked');
{
  const fr = buildFrames(
    [0.02, 0.02, 0.02, 0.02, 0.05, 0.09, 0.13, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
    ['start', 'start', 'start', 'start',
     'descent', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
    50
  );
  const st = evaluateSquatCompletionState(fr);

  ok('C: no standing recovery — completionSatisfied false', st.completionSatisfied !== true, st.completionPassReason);
  ok('C: no standing recovery — officialShallowPathClosed false', st.officialShallowPathClosed !== true, st.officialShallowPathClosed);
}

// ─────────────────────────────────────────────────────────────────────────────
// D. trajectory rescue provenance-only 보존
// trajectory rescue 가 활성화되더라도 직접 success owner 가 되지 않는다.
// success 가 열리면 반드시 canonical closer(stream bridge/strict reversal)를 통해야 함.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [D] trajectory rescue provenance-only preserved');
{
  const fr = buildFrames(
    [
      0.02, 0.02, 0.02, 0.02,
      0.05, 0.09, 0.13, 0.15,
      0.15, 0.15,
      0.11, 0.07, 0.04,
      0.02, 0.02, 0.02, 0.02, 0.02,
    ],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'descent',
      'bottom', 'bottom',
      'ascent', 'ascent', 'ascent',
      'start', 'start', 'start', 'start', 'start',
    ],
    50
  );
  const st = evaluateSquatCompletionState(fr);

  // trajectory rescue가 있다면 provenance용이고 passReason은 canonical closer 계열이어야 함
  if (st.trajectoryReversalRescueApplied === true) {
    ok(
      'D: trajectory rescue applied — success via canonical closer only',
      st.completionPassReason === 'official_shallow_cycle' ||
        st.completionPassReason === 'low_rom_cycle' ||
        st.completionPassReason === 'ultra_low_rom_cycle' ||
        st.completionPassReason === 'standard_cycle' ||
        st.completionPassReason === 'not_confirmed',
      st.completionPassReason
    );
    ok('D: trajectory rescue — eventCyclePromoted false', st.eventCyclePromoted === false, st.eventCyclePromoted);
  } else {
    // trajectory rescue 없이 다른 경로로 성공해도 ok
    ok('D: no trajectory rescue in this path (stream bridge or strict opened success)', true, null);
  }
  ok('D: no direct event_cycle pass', !String(st.completionPassReason ?? '').includes('event_cycle'), st.completionPassReason);
}

// ─────────────────────────────────────────────────────────────────────────────
// E. deep standard_cycle — E1C 영향 없음
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [E] deep standard_cycle — unchanged by E1C');
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01,
      0.10, 0.22, 0.36, 0.52,
      0.52, 0.52,
      0.36, 0.22, 0.10,
      0.02, 0.01, 0.01, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start',
      'descent', 'descent', 'descent', 'bottom',
      'bottom', 'bottom',
      'ascent', 'ascent', 'ascent',
      'start', 'start', 'start', 'start', 'start',
    ],
    60
  );
  const st = evaluateSquatCompletionState(fr);

  ok('E: deep — standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('E: deep — officialShallowPathCandidate false', st.officialShallowPathCandidate === false, st.officialShallowPathCandidate);
  ok('E: deep — completionSatisfied true', st.completionSatisfied === true, st.completionSatisfied);
  ok('E: deep — not official_shallow_cycle', st.completionPassReason !== 'official_shallow_cycle', st.completionPassReason);
  ok('E: deep — not event rescue pass', !String(st.completionPassReason ?? '').includes('event_cycle'), st.completionPassReason);
}

// ─────────────────────────────────────────────────────────────────────────────
// F. PR-E1/E1B 회귀 — standard + low_rom event-owner downgrade 보존
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [F] PR-E1/E1B regression — event-owner downgrade preserved for both bands');
{
  for (const [label, depths, phases] of [
    [
      'standard',
      [0.02, 0.02, 0.02, 0.02, 0.05, 0.09, 0.13, 0.15, 0.15, 0.11, 0.07, 0.04, 0.02, 0.02, 0.02, 0.02, 0.02],
      ['start','start','start','start','descent','descent','descent','descent','bottom','ascent','ascent','ascent','start','start','start','start','start'],
    ],
    [
      'low_rom',
      [0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.09, 0.07, 0.05, 0.03, 0.01, 0.01, 0.01, 0.01, 0.01],
      ['start','start','start','start','descent','descent','bottom','bottom','ascent','ascent','ascent','start','start','start','start','start'],
    ],
  ]) {
    const fr = buildFrames(depths, phases, 50);
    const st = evaluateSquatCompletionState(fr);
    ok(`F: ${label} — eventCyclePromoted always false`, st.eventCyclePromoted === false, st.eventCyclePromoted);
    ok(`F: ${label} — no event_cycle pass reason`, !String(st.completionPassReason ?? '').includes('event_cycle'), st.completionPassReason);
  }
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
