/**
 * PR-7-CORRECTED: Ultra-low Core Closure Integrity smoke test
 *
 * 검증 대상:
 *   1. isUltraLowRomDirectCloseEligible — fresh cycle anchor + rule/HMM reversal 요구
 *   2. resolveSquatCompletionPath — ultra_low_rom_cycle 은 integrity gate 통과 시만 열림
 *   3. 위험 패턴 차단: stream-bridge-only, pre-attempt, no-anchor, weak descent
 *   4. 합법적 ultra-low cycle: 여전히 통과 가능
 *   5. deep standard / low_rom 회귀 없음
 *   6. single-writer truth 유지 (새 success writer 없음)
 *
 * 테스트 전략:
 *   - isUltraLowRomDirectCloseEligible 직접 단위 테스트
 *   - resolveSquatCompletionPath 직접 호출 (경계 케이스 망라)
 *   - evaluateSquatCompletionState 통합 시나리오 (standing still, descent-only, legitimate)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  isUltraLowRomDirectCloseEligible,
  resolveSquatCompletionPath,
  evaluateSquatCompletionState,
} = await import('../src/lib/camera/squat-completion-state.ts');

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
// 프레임 빌더 (evaluateSquatCompletionState 가 요구하는 형식)
// ──────────────────────────────────────────────────────────────────────────────
function makeFrame(depth, timestampMs, phaseHint = 'start') {
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

function buildFrames(depths, phases, stepMs = 100) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 1: isUltraLowRomDirectCloseEligible 단위 테스트
// ──────────────────────────────────────────────────────────────────────────────
section('isUltraLowRomDirectCloseEligible — unit tests');

assert(
  'both true → eligible',
  isUltraLowRomDirectCloseEligible({ hasValidCommittedPeakAnchor: true, reversalConfirmedByRuleOrHmm: true }),
  true
);

assert(
  'anchor missing → NOT eligible (pre-attempt / no freeze/latch)',
  isUltraLowRomDirectCloseEligible({ hasValidCommittedPeakAnchor: false, reversalConfirmedByRuleOrHmm: true }),
  false
);

assert(
  'rule reversal missing → NOT eligible (stream-bridge-only pattern)',
  isUltraLowRomDirectCloseEligible({ hasValidCommittedPeakAnchor: true, reversalConfirmedByRuleOrHmm: false }),
  false
);

assert(
  'both false → NOT eligible (standing-like / no cycle)',
  isUltraLowRomDirectCloseEligible({ hasValidCommittedPeakAnchor: false, reversalConfirmedByRuleOrHmm: false }),
  false
);

// ──────────────────────────────────────────────────────────────────────────────
// Section 2: resolveSquatCompletionPath — ultra_low_rom_cycle gate
// ──────────────────────────────────────────────────────────────────────────────
section('resolveSquatCompletionPath — ultra_low_rom_cycle integrity gate');

// 2-A: integrity true → explicit closure path 에서 ultra_low_rom_cycle 허용
assert(
  '2A: explicitShallowRomClosure + ultra_low_rom + integrity=true → ultra_low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
  }),
  'ultra_low_rom_cycle'
);

// 2-B: integrity false → explicit closure path 에서도 차단 (핵심 수정)
assert(
  '2B: explicitShallowRomClosure + ultra_low_rom + integrity=false → not_confirmed (stream-bridge-only blocked)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: false,
  }),
  'not_confirmed'
);

// 2-C: integrity false + evidenceLabel fallback path 도 차단
assert(
  '2C: evidenceLabel=ultra_low_rom fallback + integrity=false → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false, // explicit closure 미적용
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: false,
  }),
  'not_confirmed'
);

// 2-D: integrity true + evidenceLabel fallback path → ultra_low_rom_cycle 허용
assert(
  '2D: evidenceLabel=ultra_low_rom fallback + integrity=true → ultra_low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
  }),
  'ultra_low_rom_cycle'
);

// 2-E: completionBlockedReason != null → 항상 not_confirmed (integrity 무관)
assert(
  '2E: blocked → not_confirmed regardless of integrity',
  resolveSquatCompletionPath({
    completionBlockedReason: 'not_armed',
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
  }),
  'not_confirmed'
);

// ──────────────────────────────────────────────────────────────────────────────
// Section 3: resolveSquatCompletionPath — low_rom_cycle / standard_cycle 회귀 없음
// ──────────────────────────────────────────────────────────────────────────────
section('resolveSquatCompletionPath — low_rom_cycle / standard_cycle unaffected');

// 3-A: low_rom 은 integrity 무관하게 열림 (ultra-low 전용 gate)
assert(
  '3A: low_rom + explicitClosure + integrity=false → low_rom_cycle (not blocked)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: false, // integrity false 여도 low_rom 은 무관
  }),
  'low_rom_cycle'
);

// 3-B: standard_cycle 은 integrity 무관
assert(
  '3B: standard depth → standard_cycle regardless of integrity',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.45,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: false,
  }),
  'standard_cycle'
);

// 3-C: low_rom evidenceLabel fallback + integrity=false → low_rom_cycle (ultra-low gate 적용 안 됨)
assert(
  '3C: evidenceLabel=low_rom fallback + integrity=false → low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: false,
  }),
  'low_rom_cycle'
);

// ──────────────────────────────────────────────────────────────────────────────
// Section 4: evaluateSquatCompletionState 통합 시나리오
// ──────────────────────────────────────────────────────────────────────────────
section('evaluateSquatCompletionState — false positive scenarios');

// 4-A: 서 있기만 함 → completionSatisfied 절대 false
{
  const frames = buildFrames(
    Array(30).fill(0.01),
    Array(30).fill('start')
  );
  const st = evaluateSquatCompletionState(frames);
  assert(
    '4A: standing still → completionSatisfied=false',
    st.completionSatisfied,
    false
  );
  assert(
    '4A: standing still → completionPassReason=not_confirmed',
    st.completionPassReason,
    'not_confirmed'
  );
}

// 4-B: 하강만, 복귀 없음 → not_confirmed
{
  const depths = [0.01, 0.01, 0.02, 0.04, 0.06, 0.07, 0.07, 0.07, 0.07, 0.07];
  const phases = ['start','start','descent','descent','descent','bottom','bottom','bottom','bottom','bottom'];
  const frames = buildFrames(depths, phases);
  const st = evaluateSquatCompletionState(frames);
  assert(
    '4B: descent-only → completionSatisfied=false',
    st.completionSatisfied,
    false
  );
}

// 4-C: 깊은 스쿼트 (standard 대역) → ultra_low_rom_cycle 아님 (회귀 없음)
{
  const depths = [0.01, 0.01, 0.15, 0.30, 0.45, 0.50, 0.45, 0.30, 0.15, 0.05, 0.01, 0.01, 0.01, 0.01];
  const phases = ['start','start','descent','descent','descent','bottom','ascent','ascent','ascent','ascent','start','start','start','start'];
  const frames = buildFrames(depths, phases);
  const st = evaluateSquatCompletionState(frames);
  assertFalsy(
    '4C: deep standard squat → NOT ultra_low_rom_cycle',
    st.completionPassReason === 'ultra_low_rom_cycle'
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 5: 관찰된 위험 패턴 조합 검증 (resolveSquatCompletionPath 레벨)
// ──────────────────────────────────────────────────────────────────────────────
section('Observed dangerous pattern combinations — must be blocked');

// 패턴 A: eventCycleDetected=false + officialShallowPathClosed=true + streamBridge=true
// → integrity=false (hasValidCommittedPeakAnchor=false 가정) → not_confirmed
assert(
  '5A: stream-bridge-only (no anchor) → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true, // bridge 있어도
    ultraLowRomFreshCycleIntegrity: false, // anchor/rule-reversal 없음
  }),
  'not_confirmed'
);

// 패턴 B: proof=true + closureProof=true 지만 anchor 없음
assert(
  '5B: closure proof without anchor → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.04,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: true, // event based but no anchor
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: false,
  }),
  'not_confirmed'
);

// 패턴 C: not_armed history → completionBlockedReason이 null 이 됐어도 integrity 없음
assert(
  '5C: formerly not_armed (now unblocked) but no fresh anchor → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null, // blocked reason 해소됐더라도
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: false, // no anchor = pre-attempt history 오염
  }),
  'not_confirmed'
);

// 패턴 D: rule-reversal 있지만 anchor 없음 (freeze-latch-missing)
assert(
  '5D: rule reversal confirmed but no anchor → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: false, // anchor 없음 (freeze-latch missing)
  }),
  'not_confirmed'
);

// 패턴 E: anchor 있지만 rule-reversal 없음 (stream-bridge만)
assert(
  '5E: anchor exists but only stream-bridge (no rule/HMM reversal) → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true, // bridge 신호만
    ultraLowRomFreshCycleIntegrity: false, // rule reversal 없음
  }),
  'not_confirmed'
);

// ──────────────────────────────────────────────────────────────────────────────
// Section 6: 합법적 ultra-low cycle — 여전히 통과 가능
// ──────────────────────────────────────────────────────────────────────────────
section('Legitimate ultra-low cycles — still allowed');

// 6-A: anchor + rule reversal → ultra_low_rom_cycle 허용
assert(
  '6A: legitimate: anchor + rule reversal + explicit closure → ultra_low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
  }),
  'ultra_low_rom_cycle'
);

// 6-B: anchor + HMM reversal → ultra_low_rom_cycle 허용 (HMM은 rule/HMM 조건 만족)
assert(
  '6B: legitimate: anchor + HMM reversal → ultra_low_rom_cycle (HMM counts as rule/HMM)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true, // HMM assist도 OK
  }),
  'ultra_low_rom_cycle'
);

// 6-C: 합법적 ultra-low (not_confirmed 아님)
assert(
  '6C: legitimate deep ultra-low (no proof signals needed, integrity drives it)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.08,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
  }),
  'ultra_low_rom_cycle'
);

// ──────────────────────────────────────────────────────────────────────────────
// Section 7: 단일 writer 확인 — isUltraLowRomDirectCloseEligible 자체는 success writer 아님
// ──────────────────────────────────────────────────────────────────────────────
section('Single-writer truth — isUltraLowRomDirectCloseEligible is a gate, not a writer');

// isUltraLowRomDirectCloseEligible 는 boolean 만 반환 (completionSatisfied / completionPassReason 쓰지 않음)
const eligibleResult = isUltraLowRomDirectCloseEligible({ hasValidCommittedPeakAnchor: true, reversalConfirmedByRuleOrHmm: true });
assert(
  '7A: isUltraLowRomDirectCloseEligible returns boolean only',
  typeof eligibleResult,
  'boolean'
);

const ineligibleResult = isUltraLowRomDirectCloseEligible({ hasValidCommittedPeakAnchor: false, reversalConfirmedByRuleOrHmm: false });
assert(
  '7B: isUltraLowRomDirectCloseEligible returns boolean (false)',
  typeof ineligibleResult,
  'boolean'
);
assertFalsy(
  '7C: isUltraLowRomDirectCloseEligible false case has no truthy return',
  ineligibleResult
);

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────
console.log('\ncamera-pr7c-ultra-low-core-closure-smoke\n');
results.forEach((r) => console.log(r));
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
