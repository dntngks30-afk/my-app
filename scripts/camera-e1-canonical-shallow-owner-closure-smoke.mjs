/**
 * PR-E1-CANONICAL-SHALLOW-OWNER-CLOSURE-01
 *
 * 회귀 스모크: canonical shallow contract 가 satisfied 될 때
 * `computeSquatCompletionOwnerTruth()` 도 통과해야 한다.
 *
 * 핵심 검증:
 * A. owner truth 정렬 — 어떤 shallow 성공 경로든 computeSquatCompletionOwnerTruth 가 통과
 * B. official_shallow_cycle 필드 alignment — closer 가 쓰는 모든 필드가 owner truth gate 와 정합
 * C. deep standard_cycle 은 영향 없음
 * D. event-cycle 은 여전히 observability-only
 *
 * npx tsx scripts/camera-e1-canonical-shallow-owner-closure-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);
const { computeSquatCompletionOwnerTruth } = await import(
  '../src/lib/camera/squat/squat-progression-contract.ts'
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

console.log('\nPR-E1 camera-e1-canonical-shallow-owner-closure-smoke\n');

// ─────────────────────────────────────────────────────────────────────────────
// A. owner truth 정렬: low_rom_cycle 성공 시 computeSquatCompletionOwnerTruth 통과
// ─────────────────────────────────────────────────────────────────────────────
console.log('  [A] owner truth alignment — low_rom_cycle path');
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
  const ownerResult = computeSquatCompletionOwnerTruth({ squatCompletionState: st });

  ok('A: low_rom path — completionSatisfied', st.completionSatisfied === true, st.completionSatisfied);
  ok(
    'A: low_rom path — passReason is shallow cycle',
    st.completionPassReason === 'low_rom_cycle' || st.completionPassReason === 'official_shallow_cycle',
    st.completionPassReason
  );
  ok('A: low_rom path — currentSquatPhase standing_recovered', st.currentSquatPhase === 'standing_recovered', st.currentSquatPhase);
  ok('A: low_rom path — completionBlockedReason null', st.completionBlockedReason == null, st.completionBlockedReason);
  ok('A: low_rom path — owner truth PASSES', ownerResult.completionOwnerPassed === true, ownerResult);
  ok('A: low_rom path — owner reason set', ownerResult.completionOwnerReason != null, ownerResult);
  ok('A: low_rom path — owner blockedReason null', ownerResult.completionOwnerBlockedReason == null, ownerResult);
}

// ─────────────────────────────────────────────────────────────────────────────
// B. official_shallow_cycle 필드 alignment — closer 출력이 owner truth gate 전부 충족
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [B] official_shallow_cycle field alignment');
{
  // official_shallow_cycle 결과를 직접 시뮬레이션:
  // computeSquatCompletionOwnerTruth 가 읽는 네 필드를 PR-E1 픽스 기준으로 검증한다.
  const closerOutput = {
    completionBlockedReason: null,        // gate 1
    completionSatisfied: true,            // gate 2
    currentSquatPhase: 'standing_recovered', // gate 3 — PR-E1 픽스 추가
    completionPassReason: 'official_shallow_cycle', // gate 4
    cycleComplete: true,
  };

  const ownerResult = computeSquatCompletionOwnerTruth({ squatCompletionState: closerOutput });

  ok('B: official_shallow_cycle — owner truth PASSES', ownerResult.completionOwnerPassed === true, ownerResult);
  ok('B: official_shallow_cycle — reason is official_shallow_cycle', ownerResult.completionOwnerReason === 'official_shallow_cycle', ownerResult);
  ok('B: official_shallow_cycle — blockedReason null', ownerResult.completionOwnerBlockedReason == null, ownerResult);
}

// ─────────────────────────────────────────────────────────────────────────────
// B2. stale no_reversal 이 남아 있는 경우 owner truth 는 반드시 실패해야 한다 (음성 가드)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [B2] stale no_reversal must still block owner truth');
{
  const staleState = {
    completionBlockedReason: 'no_reversal', // 제거되지 않은 경우
    completionSatisfied: false,
    currentSquatPhase: 'ascending',
    completionPassReason: 'not_confirmed',
  };

  const ownerResult = computeSquatCompletionOwnerTruth({ squatCompletionState: staleState });

  ok('B2: stale no_reversal — owner truth BLOCKED', ownerResult.completionOwnerPassed === false, ownerResult);
  ok('B2: stale no_reversal — blockedReason is no_reversal', ownerResult.completionOwnerBlockedReason === 'no_reversal', ownerResult);
}

// ─────────────────────────────────────────────────────────────────────────────
// C. deep standard_cycle — 영향 없음
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [C] deep standard_cycle — unchanged');
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    60
  );
  const st = evaluateSquatCompletionState(fr);
  const ownerResult = computeSquatCompletionOwnerTruth({ squatCompletionState: st });

  ok('C: deep — standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('C: deep — not officialShallowPathCandidate', st.officialShallowPathCandidate === false, st.officialShallowPathCandidate);
  ok('C: deep — currentSquatPhase standing_recovered', st.currentSquatPhase === 'standing_recovered', st.currentSquatPhase);
  ok('C: deep — owner truth PASSES', ownerResult.completionOwnerPassed === true, ownerResult);
  ok('C: deep — owner reason standard_cycle', ownerResult.completionOwnerReason === 'standard_cycle', ownerResult);
  ok('C: deep — not official_shallow_cycle', st.completionPassReason !== 'official_shallow_cycle', st.completionPassReason);
}

// ─────────────────────────────────────────────────────────────────────────────
// D. event-cycle 은 observability-only — 성공 owner 로 복귀 금지
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [D] event-cycle observability-only');
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

  ok('D: event — eventCyclePromoted is false', st.eventCyclePromoted === false, st.eventCyclePromoted);
  ok('D: event — passReason does not contain event_cycle', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);
}

// ─────────────────────────────────────────────────────────────────────────────
// E. ultra_low_rom_cycle owner truth 정렬
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [E] ultra_low_rom_cycle owner truth alignment');
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [
        0.0, 0.0, 0.0, 0.0,
        0.004, 0.008, 0.012, 0.018,
        0.017, 0.016, 0.0154, 0.006, 0.005, 0.004, 0.003, 0.003,
      ],
      [
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'ascent', 'ascent', 'start', 'start', 'start',
      ],
      40
    )
  );
  const ownerResult = computeSquatCompletionOwnerTruth({ squatCompletionState: st });

  ok(
    'E: ultra — passReason is shallow cycle',
    st.completionPassReason === 'ultra_low_rom_cycle' || st.completionPassReason === 'official_shallow_cycle',
    st.completionPassReason
  );
  ok('E: ultra — currentSquatPhase standing_recovered', st.currentSquatPhase === 'standing_recovered', st.currentSquatPhase);
  ok('E: ultra — owner truth PASSES', ownerResult.completionOwnerPassed === true, ownerResult);
}

// ─────────────────────────────────────────────────────────────────────────────
// F. 미완성 사이클 — owner truth 는 실패해야 함
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  [F] incomplete cycle — owner truth must not pass');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.1, 0.1, 0.1, 0.1],
    ['start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
    80
  );
  const st = evaluateSquatCompletionState(fr);
  const ownerResult = computeSquatCompletionOwnerTruth({ squatCompletionState: st });

  ok('F: incomplete — completionSatisfied false', st.completionSatisfied === false, st.completionSatisfied);
  ok('F: incomplete — owner truth BLOCKED', ownerResult.completionOwnerPassed === false, ownerResult);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
