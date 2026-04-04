/**
 * PR-10B: Meaningful Shallow Default Pass + Terminal Finalization Ownership Re-lock
 *
 * 검증 대상:
 *   1. low_rom_cycle 경로에서 current-rep ownership 상한 체크 (PR-10B 신규)
 *      — squatReversalToStandingMs > 7500ms → current_rep_ownership_blocked
 *      — squatReversalToStandingMs <= 7500ms → gold path 통과
 *      — squatReversalToStandingMs = null → 하한 차단 (shallow_reversal_to_standing_too_short)
 *   2. terminal finalization laundering 차단
 *      — stale reversal + terminal standing (> 7500ms) → 차단
 *   3. repeated shallow aggregation 차단
 *      — 3~5회 반복 후 slow rise (> 7500ms) → 차단
 *   4. gold-path low_rom_cycle 반복 통과 유지 (repeatability)
 *      — 다양한 reversal-to-standing 범위 (200ms ~ 7500ms) → 통과
 *   5. standing micro-motion 및 jitter 차단 (이벤트 사이클 요구로 인한 차단)
 *   6. anti-laundering: bridge/proof 보조 신호만으로는 ownership 우회 불가
 *   7. deep standard 회귀 없음 (shallow gate가 standard_cycle에 무관)
 *   8. ultra_low_rom_cycle 회귀 없음 (PR-10B 범위 외 경로)
 *   9. PR-10 canonical contract gate 회귀 없음 (official_shallow_cycle 경로)
 *
 * npx tsx scripts/camera-pr10b-meaningful-shallow-terminal-ownership-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
);

const { deriveCanonicalShallowCompletionContract } = await import(
  '../src/lib/camera/squat/shallow-completion-contract.ts'
);

// ──────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNull(label, actual) {
  if (actual == null) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected null/undefined, got ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(label, actual) {
  if (actual != null) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected non-null, got null/undefined`);
  }
}

function section(name) {
  results.push(`\n[${name}]`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Gold-path low_rom_cycle state factory (모든 게이트 통과 — meaningful descent→ascent)
// squatReversalToStandingMs = 2000ms (2초 자연스러운 상승 — single rep)
// ──────────────────────────────────────────────────────────────────────────────
function makeLowRomGoldPath(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'low_rom_cycle',
    completionBlockedReason: null,
    relativeDepthPeak: 0.19,
    currentSquatPhase: 'standing_recovered',
    trajectoryReversalRescueApplied: false,
    eventCyclePromoted: false,
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 650,
    squatReversalToStandingMs: 2000,  // 2초 상승 — 자연스러운 single rep
    baselineStandingDepth: 0,
    baselineFrozenDepth: 0,
    rawDepthPeakPrimary: 0.19,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
      source: 'rule_plus_hmm',
    },
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 1: PR-10B 핵심 — current-rep ownership 상한 체크 (low_rom_cycle 경로)
// ──────────────────────────────────────────────────────────────────────────────
section('Section 1: PR-10B current-rep ownership 상한 체크 (low_rom_cycle)');

// 1A: gold path (2000ms) → 통과
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 2000 }));
  assertNull('1A: gold path (reversalToStanding=2000ms) → no block', reason);
}

// 1B: 경계값 정확히 7500ms → 통과 (boundary inclusive)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 7500 }));
  assertNull('1B: reversalToStanding=7500ms (boundary) → no block', reason);
}

// 1C: 경계 초과 7501ms → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 7501 }));
  assert('1C: reversalToStanding=7501ms → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 1D: 명확한 stale span 10000ms → blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 10000 }));
  assert('1D: reversalToStanding=10000ms → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 1E: 하한 미달 null → shallow_reversal_to_standing_too_short (기존 하한 체크 유지)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: null }));
  assert('1E: reversalToStanding=null → shallow_reversal_to_standing_too_short (하한 유지)', reason, 'shallow_reversal_to_standing_too_short');
}

// 1F: 하한 미달 100ms → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 100 }));
  assert('1F: reversalToStanding=100ms → shallow_reversal_to_standing_too_short (하한 유지)', reason, 'shallow_reversal_to_standing_too_short');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 2: Terminal finalization laundering 차단
// 세션 종료 standing + stale reversal → 차단
// ──────────────────────────────────────────────────────────────────────────────
section('Section 2: Terminal finalization laundering 차단');

// 2A: terminal 시점 standing + 과거 reversal (8초 전) → 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 8000 }));
  assert('2A: terminal standing + stale reversal 8s → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 2B: terminal standing + 매우 오래된 reversal (20초 전) → 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 20000 }));
  assert('2B: terminal standing + stale reversal 20s → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 2C: terminal finalization — rule confirmed reversal이 있어도 stale이면 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 9000,
      reversalConfirmedBy: 'rule_plus_hmm',  // 강한 reversal 확인이지만 stale
    })
  );
  assert('2C: rule_plus_hmm reversal + terminal stale (9000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 3: Repeated shallow aggregation 차단
// 3~5회 반복 후 slow rise 시나리오
// ──────────────────────────────────────────────────────────────────────────────
section('Section 3: Repeated shallow aggregation 차단');

// 3A: 3회 반복 × 3초 + 느린 상승 → span ≈ 9000ms → 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 9000 }));
  assert('3A: 3 repeats × 3s + slow rise (9000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 3B: 5회 반복 + slow rise → span ≈ 12000ms → 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 12000 }));
  assert('3B: 5 repeats + slow rise (12000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 3C: 경계 직전 7499ms — 여전히 통과 (1ms 여유)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 7499 }));
  assertNull('3C: 7499ms (1ms under limit) → no block (legitimate slow rise)', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 4: Gold-path repeatability — 의미 있는 shallow rep 반복 통과
// 동등 품질 얕은 스쿼트를 다양한 reversal-to-standing span으로 반복 시도
// ──────────────────────────────────────────────────────────────────────────────
section('Section 4: Gold-path repeatability (low_rom_cycle)');

const goldPathSpans = [
  ['200ms', 200],
  ['500ms', 500],
  ['1000ms', 1000],
  ['2000ms', 2000],
  ['3500ms', 3500],
  ['5000ms', 5000],
  ['7000ms', 7000],
  ['7500ms', 7500],
];

for (const [label, ms] of goldPathSpans) {
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: ms }));
  assertNull(`4-${label}: gold path (span=${label}) → no block`, reason);
}

// 4X: 동일 입력 5회 반복 호출 → 일관된 결과 (deterministic)
{
  const input = makeLowRomGoldPath({ squatReversalToStandingMs: 3000 });
  let allPass = true;
  for (let i = 0; i < 5; i++) {
    if (getShallowMeaningfulCycleBlockReason({ ...input }) !== null) allPass = false;
  }
  assert('4X: 5× gold path 반복 호출 → 일관된 null (deterministic)', allPass, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 5: Standing micro-motion / jitter 차단 (이벤트 사이클 요구로 인한 차단)
// 하강→상승이 아닌 움직임은 event cycle이 정상 감지되지 않음 → 기존 게이트로 차단
// ──────────────────────────────────────────────────────────────────────────────
section('Section 5: Standing micro-motion / jitter 차단');

// 5A: event cycle 없음 → event_cycle_not_detected 차단 (standing still)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatEventCycle: { detected: false, band: 'low_rom' },
      squatReversalToStandingMs: 500,
    })
  );
  assert('5A: event cycle not detected (standing still) → event_cycle_not_detected', reason, 'event_cycle_not_detected');
}

// 5B: descent 없음 (frame jitter) → event_cycle_descent_missing
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatEventCycle: {
        detected: true,
        band: 'low_rom',
        descentDetected: false,
        reversalDetected: true,
        recoveryDetected: true,
        nearStandingRecovered: true,
      },
      squatReversalToStandingMs: 500,
    })
  );
  assert('5B: descentDetected=false (jitter) → event_cycle_descent_missing', reason, 'event_cycle_descent_missing');
}

// 5C: reversal 없음 → event_cycle_reversal_missing
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatEventCycle: {
        detected: true,
        band: 'low_rom',
        descentDetected: true,
        reversalDetected: false,
        recoveryDetected: true,
        nearStandingRecovered: true,
      },
      squatReversalToStandingMs: 500,
    })
  );
  assert('5C: reversalDetected=false → event_cycle_reversal_missing', reason, 'event_cycle_reversal_missing');
}

// 5D: nearStandingRecovered=false → event_cycle_near_standing_missing (서 있는 체 아닌 상태)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatEventCycle: {
        detected: true,
        band: 'low_rom',
        descentDetected: true,
        reversalDetected: true,
        recoveryDetected: true,
        nearStandingRecovered: false,
      },
      squatReversalToStandingMs: 500,
    })
  );
  assert('5D: nearStandingRecovered=false → event_cycle_near_standing_missing', reason, 'event_cycle_near_standing_missing');
}

// 5E: trajectory rescue (general motion) → trajectory_rescue_not_allowed
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      trajectoryReversalRescueApplied: true,
      reversalConfirmedBy: 'trajectory',
      squatReversalToStandingMs: 500,
    })
  );
  assert('5E: trajectoryReversalRescueApplied → trajectory_rescue_not_allowed', reason, 'trajectory_rescue_not_allowed');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 6: Anti-laundering — bridge/proof는 ownership 우회 불가
// ──────────────────────────────────────────────────────────────────────────────
section('Section 6: Anti-laundering (bridge/proof는 ownership 우회 불가)');

// 6A: ownership 위반 + rule reversal → 여전히 차단 (rule이 있어도 stale span 우선)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 9000,
      reversalConfirmedBy: 'rule',
    })
  );
  assert('6A: rule reversal + stale span (9000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 6B: ownership 위반 + officialShallowClosureProofSatisfied → 여전히 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 8000,
      officialShallowClosureProofSatisfied: true,
      officialShallowPathClosed: true,
    })
  );
  assert('6B: closure proof + stale span (8000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 6C: ownership ok + closure proof ok → 통과
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 3000,
      officialShallowClosureProofSatisfied: true,
    })
  );
  assertNull('6C: ownership ok + closure proof ok → no block', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 7: Deep standard 회귀 없음 — shallow gate가 standard_cycle 건드리지 않음
// ──────────────────────────────────────────────────────────────────────────────
section('Section 7: Deep standard 회귀 없음');

// 7A: standard_cycle → null (shallow gate 비관여)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    relativeDepthPeak: 0.55,
    squatReversalToStandingMs: 20000,  // 아무리 stale해도
  });
  assertNull('7A: standard_cycle → null (shallow gate 건드리지 않음)', reason);
}

// 7B: standard_cycle + 모든 shallow 게이트가 실패할 조건 → 여전히 null
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    relativeDepthPeak: 0.50,
    squatReversalToStandingMs: null,
    squatEventCycle: { detected: false },
  });
  assertNull('7B: standard_cycle (even with null squatReversalToStandingMs) → null', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 8: ultra_low_rom_cycle 경로 회귀 없음
// (PR-10B 범위 밖 — applyUltraLowPolicyLock → canonicalContract 경로로 이미 보호)
// ──────────────────────────────────────────────────────────────────────────────
section('Section 8: ultra_low_rom_cycle 경로 회귀 없음');

// 8A: ultra_low_rom_cycle + ultraLowPolicyBlocked=false → null (policy가 legitimate로 판정)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'ultra_low_rom_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
    squatReversalToStandingMs: 3000,
  });
  assertNull('8A: ultra_low_rom_cycle + policy=legitimate → null (PR-10B가 ultra_low 건드리지 않음)', reason);
}

// 8B: ultra_low_rom_cycle + policy 미결정 (decisionReady=false) → ultra_low_rom_not_allowed
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'ultra_low_rom_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: false,
    ultraLowPolicyBlocked: false,
  });
  assert('8B: ultra_low_rom_cycle + policy not ready → ultra_low_rom_not_allowed', reason, 'ultra_low_rom_not_allowed');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 9: canonical contract 경로 회귀 없음 (official_shallow_cycle은 별도 경로)
// canonical contract의 currentRepOwnershipClear는 PR-10에서 이미 잠김
// PR-10B는 이 경로를 건드리지 않음
// ──────────────────────────────────────────────────────────────────────────────
section('Section 9: canonical contract 경로 회귀 없음 (official_shallow_cycle)');

function makeCanonicalGoldPath() {
  return {
    relativeDepthPeak: 0.08,
    evidenceLabel: 'ultra_low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.07,
    completionBlockedReason: null,
    minimumCycleDurationSatisfied: true,
    baselineFrozen: true,
    peakLatched: true,
    eventCycleHasFreezeOrLatchMissing: false,
    ownerAuthoritativeReversalSatisfied: true,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    provenanceReversalEvidencePresent: false,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    squatReversalToStandingMs: 3000,  // within ownership limit
    setupMotionBlocked: false,
    peakLatchedAtIndex: 5,
    eventCycleDetected: true,
    eventCycleHasDescentWeak: false,
    eventCycleDescentFrames: 5,
  };
}

// 9A: canonical gold path (3000ms) → satisfied (PR-10B 변경이 canonical contract에 영향 없음)
{
  const result = deriveCanonicalShallowCompletionContract(makeCanonicalGoldPath());
  assert('9A: canonical gold path → satisfied (PR-10B 무영향)', result.satisfied, true);
  assert('9A: currentRepOwnershipClear=true', result.currentRepOwnershipClear, true);
}

// 9B: canonical path + stale span (9000ms) → current_rep_ownership_blocked (PR-10 유지)
{
  const result = deriveCanonicalShallowCompletionContract({ ...makeCanonicalGoldPath(), squatReversalToStandingMs: 9000 });
  assert('9B: canonical + stale span → still blocked (PR-10 유지)', result.blockedReason, 'current_rep_ownership_blocked');
  assert('9B: satisfied=false', result.satisfied, false);
}

// 9C: canonical gold path 반복 5회 → 일관된 결과
{
  let allPass = true;
  for (let i = 0; i < 5; i++) {
    if (!deriveCanonicalShallowCompletionContract({ ...makeCanonicalGoldPath() }).satisfied) allPass = false;
  }
  assert('9C: canonical gold path 5× 반복 → 일관된 satisfied', allPass, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 10: 복합 위험 패턴 — 실기기 시나리오 재현
// ──────────────────────────────────────────────────────────────────────────────
section('Section 10: 복합 위험 패턴 (실기기 시나리오)');

// 10A: 끝까지 통과 안 되다가 standing에서 잠깐 움직여 통과 시도
//       reversal이 오래 전 → ownership blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 15000,  // 15초 전 reversal
      currentSquatPhase: 'standing_recovered',
    })
  );
  assert('10A: standing + reversal 15s ago → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 10B: 여러 번 반복 후 아주 천천히 일어나며 통과 시도 (slow-rise laundering)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 11000,  // reversal 11초 전, slow rise
    })
  );
  assert('10B: slow-rise laundering (11000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// 10C: 얕은 스쿼트 한 번만, 빠른 상승 (정상 gold path) → 통과
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 400,  // 빠른 상승
    })
  );
  assertNull('10C: single rep fast rise (400ms) → no block (easy pass)', reason);
}

// 10D: 얕은 스쿼트 한 번, 자연스러운 속도 (gold path) → 통과
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeLowRomGoldPath({
      squatReversalToStandingMs: 2500,  // 자연스러운 상승
    })
  );
  assertNull('10D: single rep natural rise (2500ms) → no block (easy pass)', reason);
}

// 10E: 의미 있는 shallow rep 10회 동등 품질 → 모두 통과 (repeatability 검증)
{
  let allPass = true;
  for (let i = 0; i < 10; i++) {
    // 각 rep는 독립적인 1500~4000ms 상승 시간
    const ms = 1500 + (i * 250);  // 1500, 1750, ..., 3750
    const reason = getShallowMeaningfulCycleBlockReason(
      makeLowRomGoldPath({ squatReversalToStandingMs: ms })
    );
    if (reason !== null) allPass = false;
  }
  assert('10E: 10회 동등 shallow rep (1500~3750ms) → 모두 통과 (repeatability)', allPass, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────
for (const line of results) {
  console.log(line);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`PR-10B smoke: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('PR-10B smoke FAILED');
  process.exit(1);
} else {
  console.log('PR-10B smoke PASSED');
}
