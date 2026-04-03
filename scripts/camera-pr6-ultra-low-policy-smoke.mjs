/**
 * PR-6-ULTRA-LOW-POLICY-RESCOPE smoke test
 *
 * 검증 대상:
 *   1. applyUltraLowPolicyLock — legitimate ultra-low cycle 허용 (新), illegitimate는 차단 유지
 *   2. getShallowMeaningfulCycleBlockReason — policy 통과 시 추가 차단 없음
 *   3. 기존 false-positive 방어 (standing still, descent-only, trajectory rescue, setup 오염) 유지
 *   4. deep standard squat 회귀 없음
 *
 * 테스트 전략: applyUltraLowPolicyLock 을 직접 호출 (constructed state),
 *   getShallowMeaningfulCycleBlockReason 도 직접 호출.
 *   이 함수들이 실제 evaluator 파이프라인에서 사용되는 경로를 포함.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { applyUltraLowPolicyLock } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
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

function assertTruthy(label, actual) {
  if (actual) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected truthy, got ${JSON.stringify(actual)}`);
  }
}

function assertFalsy(label, actual) {
  if (!actual) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected falsy, got ${JSON.stringify(actual)}`);
  }
}

function section(name) {
  results.push(`\n[${name}]`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 공통 베이스 state 팩토리
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ultra-low policy scope에 진입한 상태의 공통 필드.
 * isUltraLowPolicyDecisionReady 가 true 가 되려면 모두 만족해야 함.
 */
function makeUltraLowDecisionReadyBase() {
  return {
    evidenceLabel: 'ultra_low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
    // 아래 두 필드는 completionSatisfied에 따라 다름
    completionBlockedReason: null,
    completionSatisfied: false,
    // observability
    relativeDepthPeak: 0.04,
    currentSquatPhase: 'standing_recovered',
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
  };
}

/**
 * Legitimate ultra-low cycle 상태:
 * core가 pass했고 canonical contract도 satisfied.
 */
function makeLegitimateUltraLowState() {
  return {
    ...makeUltraLowDecisionReadyBase(),
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionBlockedReason: null,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractSatisfied: true,
    trajectoryReversalRescueApplied: false,
    setupMotionBlocked: false,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'completed',
    completionFinalizeMode: 'rule_finalized',
  };
}

/**
 * Trajectory-rescued ultra-low cycle:
 * core가 pass했지만 trajectory rescue를 썼고 canonical contract 실패.
 */
function makeTrajectoryRescuedUltraLowState() {
  return {
    ...makeUltraLowDecisionReadyBase(),
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionBlockedReason: null,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractSatisfied: false, // trajectory rescue → contract 실패
    trajectoryReversalRescueApplied: true,    // trajectory rescue 적용됨
    setupMotionBlocked: false,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'completed',
  };
}

/**
 * Setup-contaminated ultra-low cycle:
 * core가 pass했지만 setup motion 있음 → canonical contract 실패.
 */
function makeSetupContaminatedUltraLowState() {
  return {
    ...makeUltraLowDecisionReadyBase(),
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionBlockedReason: null,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractSatisfied: false, // setup 오염 → contract 실패
    trajectoryReversalRescueApplied: false,
    setupMotionBlocked: true,                 // setup 오염
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'completed',
  };
}

/**
 * Incomplete ultra-low cycle:
 * policy decision ready이지만 core가 pass하지 않음.
 */
function makeIncompleteUltraLowState() {
  return {
    ...makeUltraLowDecisionReadyBase(),
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'low_rom_standing_finalize_not_satisfied',
    officialShallowPathClosed: false,
    officialShallowClosureProofSatisfied: false,
    canonicalShallowContractSatisfied: false,
    trajectoryReversalRescueApplied: false,
    setupMotionBlocked: false,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Section A: applyUltraLowPolicyLock — legitimate cycle bypass
// ──────────────────────────────────────────────────────────────────────────────

section('A-1: legitimate ultra-low cycle → policy ALLOWS (PR-6 핵심)');
{
  const state = makeLegitimateUltraLowState();
  const result = applyUltraLowPolicyLock(state);

  assert('A-1 ultraLowPolicyScope=true', result.ultraLowPolicyScope, true);
  assert('A-1 ultraLowPolicyDecisionReady=true', result.ultraLowPolicyDecisionReady, true);
  assert('A-1 ultraLowPolicyBlocked=false (NEW: legitimate cycle passes)', result.ultraLowPolicyBlocked, false);
  // 핵심: completion truth가 보존되어야 함
  assert('A-1 completionSatisfied=true (보존)', result.completionSatisfied, true);
  assert('A-1 completionPassReason=ultra_low_rom_cycle (보존)', result.completionPassReason, 'ultra_low_rom_cycle');
  assertFalsy('A-1 completionBlockedReason=null (보존)', result.completionBlockedReason);
  assertTruthy('A-1 trace contains legitimate_canonical=1', result.ultraLowPolicyTrace?.includes('legitimate_canonical=1'));
}

section('A-2: trajectory-rescued ultra-low → policy BLOCKS (기존 방어 유지)');
{
  const state = makeTrajectoryRescuedUltraLowState();
  const result = applyUltraLowPolicyLock(state);

  assert('A-2 ultraLowPolicyBlocked=true', result.ultraLowPolicyBlocked, true);
  assert('A-2 completionSatisfied=false (차단됨)', result.completionSatisfied, false);
  assert('A-2 completionBlockedReason=ultra_low_rom_not_allowed', result.completionBlockedReason, 'ultra_low_rom_not_allowed');
  assertTruthy('A-2 trace contains blocked=policy_illegitimate', result.ultraLowPolicyTrace?.includes('blocked=policy_illegitimate'));
}

section('A-3: setup-contaminated ultra-low → policy BLOCKS (기존 방어 유지)');
{
  const state = makeSetupContaminatedUltraLowState();
  const result = applyUltraLowPolicyLock(state);

  assert('A-3 ultraLowPolicyBlocked=true', result.ultraLowPolicyBlocked, true);
  assert('A-3 completionSatisfied=false (차단됨)', result.completionSatisfied, false);
  assert('A-3 completionBlockedReason=ultra_low_rom_not_allowed', result.completionBlockedReason, 'ultra_low_rom_not_allowed');
}

section('A-4: incomplete ultra-low (core not passed) → policy BLOCKS');
{
  const state = makeIncompleteUltraLowState();
  const result = applyUltraLowPolicyLock(state);

  // decisionReady=true지만 completionSatisfied=false → isUltraLowCycleLegitimateByCanonicalProof=false
  assert('A-4 ultraLowPolicyBlocked=true', result.ultraLowPolicyBlocked, true);
  assert('A-4 completionSatisfied=false', result.completionSatisfied, false);
}

section('A-5: ultra-low but decision NOT ready → policy pass-through (no block)');
{
  const state = {
    ...makeUltraLowDecisionReadyBase(),
    // decision not ready: recovery not confirmed
    recoveryConfirmedAfterReversal: false,
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'not_standing_recovered',
    officialShallowPathClosed: false,
    officialShallowClosureProofSatisfied: false,
    canonicalShallowContractSatisfied: false,
  };
  const result = applyUltraLowPolicyLock(state);

  assert('A-5 ultraLowPolicyDecisionReady=false', result.ultraLowPolicyDecisionReady, false);
  assert('A-5 ultraLowPolicyBlocked=false (not ready → pass-through)', result.ultraLowPolicyBlocked, false);
}

section('A-6: non-ultra-low (evidenceLabel=low_rom) → policy 스코프 밖');
{
  const state = {
    ...makeUltraLowDecisionReadyBase(),
    evidenceLabel: 'low_rom',
    completionSatisfied: true,
    completionPassReason: 'low_rom_cycle',
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractSatisfied: true,
  };
  const result = applyUltraLowPolicyLock(state);

  // ultra_low_rom이 아니므로 scope=false → decisionReady=false → pass-through
  assert('A-6 ultraLowPolicyScope=false', result.ultraLowPolicyScope, false);
  assert('A-6 ultraLowPolicyBlocked=false (스코프 밖)', result.ultraLowPolicyBlocked, false);
  assert('A-6 completionSatisfied=true (보존)', result.completionSatisfied, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section B: getShallowMeaningfulCycleBlockReason — ultra_low_rom_cycle gate
// ──────────────────────────────────────────────────────────────────────────────

section('B-1: ultra_low_rom_cycle + policy ALLOWED → gate null (추가 차단 없음)');
{
  // applyUltraLowPolicyLock 통과 후 상태를 시뮬레이션
  const postPolicyState = {
    ...makeLegitimateUltraLowState(),
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
  };

  const reason = getShallowMeaningfulCycleBlockReason(postPolicyState);
  assert('B-1 gate returns null (policy 통과 → 추가 차단 없음)', reason, null);
}

section('B-2: ultra_low_rom_cycle + policy BLOCKED → gate returns ultra_low_rom_not_allowed');
{
  // applyUltraLowPolicyLock이 차단한 후 상태 → completionPassReason이 이미 not_confirmed 일 것
  // 하지만 만약 어떤 이유로 ultra_low_rom_cycle이 남아있고 policy가 blocked라면
  const state = {
    ...makeLegitimateUltraLowState(),
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: true, // 차단됨
  };

  const reason = getShallowMeaningfulCycleBlockReason(state);
  assert('B-2 gate returns ultra_low_rom_not_allowed (policy 차단 → gate도 차단)', reason, 'ultra_low_rom_not_allowed');
}

section('B-3: ultra_low_rom_cycle + policy scope/ready 없음 → gate returns ultra_low_rom_not_allowed');
{
  // 정책 필드가 없는 상태 (구 상태 compat)
  const state = {
    ...makeLegitimateUltraLowState(),
    ultraLowPolicyScope: undefined,
    ultraLowPolicyDecisionReady: undefined,
    ultraLowPolicyBlocked: undefined,
  };

  const reason = getShallowMeaningfulCycleBlockReason(state);
  assert('B-3 gate returns ultra_low_rom_not_allowed (policy 필드 없음 → 차단)', reason, 'ultra_low_rom_not_allowed');
}

section('B-4: low_rom_cycle (policy gate 비관여) → gate 로직 정상 진행');
{
  // low_rom_cycle은 ultra_low 정책과 무관, 다른 gate 검사를 거침
  const state = {
    completionPassReason: 'low_rom_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.12, // low_rom band
    currentSquatPhase: 'standing_recovered',
    trajectoryReversalRescueApplied: false,
    eventCyclePromoted: false,
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
    },
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 500,
    squatReversalToStandingMs: 500,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    // rawDepthPeakPrimary 없으면 null→ 해당 check pass
  };

  const reason = getShallowMeaningfulCycleBlockReason(state);
  // low_rom_cycle 경로 — null이어야 함 (모든 체크 통과)
  assert('B-4 low_rom_cycle gate returns null (정상 통과)', reason, null);
}

section('B-5: non-shallow pass reason → gate null (해당 없음)');
{
  const state = {
    completionPassReason: 'standard_cycle',
    completionSatisfied: true,
  };

  const reason = getShallowMeaningfulCycleBlockReason(state);
  assert('B-5 standard_cycle → gate null', reason, null);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section C: 단일 writer 보장 — structural static check
// ──────────────────────────────────────────────────────────────────────────────

section('C-1: applyCanonicalShallowClosureFromContract 단일 존재 확인 (정적 검사)');
{
  const fs = await import('fs');
  const src = fs.readFileSync('src/lib/camera/squat-completion-state.ts', 'utf8');
  const matches = src.match(/function applyCanonicalShallowClosureFromContract/g) ?? [];
  assert('C-1 canonical closer 정확히 1개 존재', matches.length, 1);
}

section('C-2: isUltraLowCycleLegitimateByCanonicalProof completionSatisfied를 새로 쓰지 않음 (정적 검사)');
{
  const fs = await import('fs');
  const src = fs.readFileSync('src/lib/camera/squat-completion-state.ts', 'utf8');
  // legitimate 함수 블록을 추출하여 completionSatisfied = true 를 직접 쓰지 않는지 확인
  const fnStart = src.indexOf('function isUltraLowCycleLegitimateByCanonicalProof');
  const fnEnd = src.indexOf('\n}', fnStart) + 2;
  const fnBody = src.slice(fnStart, fnEnd);
  const hasIllegalWrite = /completionSatisfied\s*[:=]\s*true/.test(fnBody);
  assert('C-2 isUltraLowCycleLegitimateByCanonicalProof가 completionSatisfied=true를 쓰지 않음', hasIllegalWrite, false);
}

section('C-3: applyUltraLowPolicyLock legitimate 분기가 completionSatisfied를 명시적으로 true로 새로 쓰지 않음');
{
  const fs = await import('fs');
  const src = fs.readFileSync('src/lib/camera/squat-completion-state.ts', 'utf8');
  // legitimate bypass 분기 블록 추출 (ultraLowLegitimateByCanonical 분기)
  const bypassIdx = src.indexOf('if (ultraLowLegitimateByCanonical)');
  const bypassEnd = src.indexOf('\n  }', bypassIdx) + 4;
  const bypassBlock = src.slice(bypassIdx, bypassEnd);
  const hasIllegalWrite = /completionSatisfied\s*:\s*true/.test(bypassBlock);
  assert('C-3 legitimate bypass 분기에 completionSatisfied: true 강제 쓰기 없음', hasIllegalWrite, false);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section D: 아키텍처 불변량 — ultra_low_rom 단독으로 실패가 아님
// ──────────────────────────────────────────────────────────────────────────────

section('D-1: PR-6 trace에 legitimate_canonical 필드 존재 확인');
{
  const legitState = makeLegitimateUltraLowState();
  const result = applyUltraLowPolicyLock(legitState);
  assertTruthy('D-1 trace에 legitimate_canonical 포함', result.ultraLowPolicyTrace?.includes('legitimate_canonical='));
}

section('D-2: ultra_low but no canonical contract → illegitimate로 분류됨');
{
  // ultra_low + complete core pass지만 canonical contract 미달 (trajectory rescue 같은 케이스)
  const state = {
    ...makeLegitimateUltraLowState(),
    canonicalShallowContractSatisfied: false, // canonical 실패
  };
  const result = applyUltraLowPolicyLock(state);
  assert('D-2 ultraLowPolicyBlocked=true (canonical 없으면 차단)', result.ultraLowPolicyBlocked, true);
  assert('D-2 completionSatisfied=false', result.completionSatisfied, false);
}

section('D-3: ultra_low + canonical OK지만 officialShallowPathClosed=false → illegitimate');
{
  const state = {
    ...makeLegitimateUltraLowState(),
    officialShallowPathClosed: false, // 공식 shallow path 미닫힘
  };
  const result = applyUltraLowPolicyLock(state);
  assert('D-3 ultraLowPolicyBlocked=true (officialShallowPathClosed=false)', result.ultraLowPolicyBlocked, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────

results.forEach((line) => console.log(line));
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nSome tests FAILED — see above.');
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
