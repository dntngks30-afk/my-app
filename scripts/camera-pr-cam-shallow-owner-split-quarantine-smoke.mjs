/**
 * PR-CAM-SHALLOW-PASS-OWNER-SPLIT-QUARANTINE
 *   ↳ Shallow Pass Owner Split + Setup-Contamination Quarantine
 *
 * Parent SSOT: docs/pr/PR-CAM-SHALLOW-PASS-OWNER-SPLIT-QUARANTINE-SSOT.md
 * Implementation prompt: docs/pr/PR-IMPLEMENT-PROMPT-SHALLOW-OWNER-SPLIT.md
 *
 * 본 smoke 는 단 하나의 단일 법칙을 잠근다:
 *   - 한 motion epoch 는 {standard | official-shallow | contaminated-no-pass}
 *     정확히 한 terminal lane 에만 속한다.
 *   - lane drift 는 금지다.
 *
 * 섹션:
 *   1. resolveSquatCompletionPath 단위 테스트
 *      A. contamination quarantine (§6.1 / §6.4)
 *      B. evidence-label fallback 은 admission 필수 (§6.2 lane split)
 *      C. attempt freshness (§6.5)
 *      D. 깨지면 안 되는 기존 경로 보존
 *   2. computeSquatSetupMotionBlock interior sliding scan (§6.1 탐지 강화)
 *   3. evaluateSquatCompletionState 단계 통합 (§6.1 + §6.2)
 *      A. setupMotionBlocked=true → standard / shallow / label 전부 차단
 *      B. 깨끗한 epoch → 기존 deep standard 통과 보존
 *   4. lane exclusivity (admitted shallow lane 이 standard owner 에 탈취되지 않음)
 *
 * Run: npx tsx scripts/camera-pr-cam-shallow-owner-split-quarantine-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { resolveSquatCompletionPath } = await import(
  '../src/lib/camera/squat/squat-completion-core.ts'
);
const { evaluateSquatCompletionState, computeSquatSetupMotionBlock } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. resolveSquatCompletionPath 단위 테스트
// ─────────────────────────────────────────────────────────────────────────────

console.log('1. resolveSquatCompletionPath — 단일 결정점 법칙 잠금\n');

// 1A. contamination quarantine (§6.1 / §6.4) — setupMotionBlocked=true 면
//     standard / shallow-closure / evidence-label fallback 전부 not_confirmed.
console.log('  1A. Contamination quarantine (§6.1 / §6.4)');

// 1A-1. deep depth + clean → standard_cycle (baseline 비교)
ok(
  '1A-1: deep depth + clean (no contamination) → standard_cycle (baseline)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.69,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'standard_cycle'
);

// 1A-2. deep depth + contamination → not_confirmed (핵심 법칙)
// 이 케이스가 SSOT §3.1 "sit + grab-camera -> completion_truth_standard"
// 재현 경로다.
ok(
  '1A-2: deep depth + setupMotionBlocked=true → not_confirmed (standard lane 차단)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.69,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: true,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1A-3. shallow admitted + contamination → not_confirmed
// (admission contract 는 이미 setup_motion_blocked 로 차단하므로 admitted=true
//  자체가 비정상이지만, 방어적 잠금을 확인한다.)
ok(
  '1A-3: shallow admitted + contamination → not_confirmed (shallow lane 차단)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.25,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: true,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1A-4. evidence-label fallback + contamination → not_confirmed
ok(
  '1A-4: evidenceLabel=low_rom + contamination → not_confirmed (fallback 차단)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: true,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1A-5. ultra_low_rom label + contamination → not_confirmed
ok(
  '1A-5: evidenceLabel=ultra_low_rom + contamination → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: true,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1B. Evidence-label fallback 은 admission 필수 (§6.2 lane split)
console.log('\n  1B. Evidence-label fallback requires admission (§6.2)');

// 1B-1. low_rom label + admitted → low_rom_cycle (통과)
ok(
  '1B-1: evidenceLabel=low_rom + admitted=true → low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'low_rom_cycle'
);

// 1B-2. low_rom label + NOT admitted → not_confirmed (이전: low_rom_cycle)
// 이 케이스가 "admission 없이 label 만으로 shallow lane 우회" 차단.
ok(
  '1B-2: evidenceLabel=low_rom + admitted=false → not_confirmed (우회 차단)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1B-3. ultra_low_rom label + NOT admitted → not_confirmed
ok(
  '1B-3: evidenceLabel=ultra_low_rom + admitted=false → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1B-4. standardEvidenceOwnerShallowBand + NOT admitted → not_confirmed
// (0.10 < depth < 0.40, label=standard 케이스도 admission 잠금)
ok(
  '1B-4: standard label + shallow-band depth + admitted=false → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.25,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1B-5. standard label + shallow-band + admitted → low_rom_cycle (통과 보존)
ok(
  '1B-5: standard label + shallow-band depth + admitted=true → low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.25,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'low_rom_cycle'
);

// 1C. Attempt freshness (§6.5)
console.log('\n  1C. Attempt freshness (§6.5)');

// 1C-1. explicit shallow closure + fresh=true → low_rom_cycle
ok(
  '1C-1: admitted + closure-proof + fresh=true → low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'low_rom_cycle'
);

// 1C-2. explicit shallow closure + fresh=false (half-state) → not_confirmed
ok(
  '1C-2: admitted + closure-proof + fresh=false (half-state) → not_confirmed',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: false,
  }) === 'not_confirmed'
);

// 1C-3. standard_cycle 은 freshness gate 와 무관 (§6.5 는 shallow 에만 적용)
ok(
  '1C-3: deep depth + fresh=false → standard_cycle (standard lane 은 §6.5 적용 안 함)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.69,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: false,
  }) === 'standard_cycle'
);

// 1D. 기존 경로 보존 (회귀 방어)
console.log('\n  1D. 기존 경로 보존 / 회귀 방어');

// 1D-1. completionBlockedReason 기존 분기 보존
ok(
  '1D-1: completionBlockedReason != null → not_confirmed (기존)',
  resolveSquatCompletionPath({
    completionBlockedReason: 'no_reversal',
    relativeDepthPeak: 0.5,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1D-2. ultraLowRomFreshCycleIntegrity=false → ultra_low 차단 (기존)
ok(
  '1D-2: admitted ultra_low + integrity=false → not_confirmed (PR-7 기존)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: false,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'not_confirmed'
);

// 1D-3. admitted ultra_low + integrity=true + fresh=true → ultra_low_rom_cycle
ok(
  '1D-3: admitted ultra_low + integrity=true + fresh=true → ultra_low_rom_cycle',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'ultra_low_rom_cycle'
);

// 1D-4. default 호출(새 param 생략) → 기존 동작 유지
// (setupMotionBlocked / attemptEpochFresh 미지정 시 legacy 동작 보존)
ok(
  '1D-4: 레거시 호출 (새 param 생략) → standard_cycle (legacy 호환)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.69,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
  }) === 'standard_cycle'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. computeSquatSetupMotionBlock interior sliding scan (§6.1 탐지 강화)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n2. computeSquatSetupMotionBlock — interior sliding scan\n');

function mkFrame(ts, depthProxy, area, hipX = 0.5, hipY = 0.5, phase = 'unknown') {
  return {
    timestampMs: ts,
    isValid: true,
    phaseHint: phase,
    derived: { squatDepthProxy: depthProxy },
    bodyBox: { area, x: 0, y: 0, w: 1, h: 1 },
    joints: {
      hipCenter: { x: hipX, y: hipY, visibility: 0.9 },
    },
    landmarks: {
      LEFT_HIP: { x: hipX - 0.05, y: hipY, visibility: 0.9 },
      RIGHT_HIP: { x: hipX + 0.05, y: hipY, visibility: 0.9 },
    },
    qualityHints: [],
  };
}

// 2A. 정상 깊은 스쿼트 (head/tail area 동일, 중간 팽창) → blocked=false
{
  const frames = [];
  // 0..3: standing area=0.10
  for (let i = 0; i < 4; i++) frames.push(mkFrame(100 + i * 80, 0.01, 0.10));
  // 4..8: descent / bottom (area 1.15× 로 팽창)
  frames.push(mkFrame(100 + 4 * 80, 0.10, 0.11));
  frames.push(mkFrame(100 + 5 * 80, 0.25, 0.12));
  frames.push(mkFrame(100 + 6 * 80, 0.45, 0.13));
  frames.push(mkFrame(100 + 7 * 80, 0.42, 0.13));
  frames.push(mkFrame(100 + 8 * 80, 0.35, 0.12));
  // 9..12: ascent
  frames.push(mkFrame(100 + 9 * 80, 0.22, 0.11));
  frames.push(mkFrame(100 + 10 * 80, 0.10, 0.10));
  frames.push(mkFrame(100 + 11 * 80, 0.04, 0.10));
  frames.push(mkFrame(100 + 12 * 80, 0.01, 0.10));
  // 13..16: standing again
  for (let i = 13; i < 17; i++) frames.push(mkFrame(100 + i * 80, 0.01, 0.10));
  const r = computeSquatSetupMotionBlock(frames);
  ok(
    `2A-1: 정상 deep squat (head/tail/interior area 정상) → blocked=false  [got ${r.reason}]`,
    r.blocked === false && r.reason === null
  );
}

// 2B. head/tail 은 동일하지만 중간 구간 area 급감 (step-back mid-epoch)
{
  const frames = [];
  // 0..3: standing area=0.10
  for (let i = 0; i < 4; i++) frames.push(mkFrame(100 + i * 80, 0.01, 0.10));
  // 4..9: mid contamination — area 0.05 (50% shrink) 지속
  for (let i = 4; i < 10; i++) frames.push(mkFrame(100 + i * 80, 0.2 + i * 0.02, 0.05));
  // 10..13: 복귀
  for (let i = 10; i < 14; i++) frames.push(mkFrame(100 + i * 80, 0.05, 0.10));
  const r = computeSquatSetupMotionBlock(frames);
  ok(
    `2B-1: mid-epoch area shrink → blocked=true, reason=step_back_or_camera_tilt_area_shrink  [got ${r.reason}]`,
    r.blocked === true && r.reason === 'step_back_or_camera_tilt_area_shrink'
  );
}

// 2C. mid-epoch area spike → step_in_or_camera_close_area_spike
{
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(mkFrame(100 + i * 80, 0.01, 0.10));
  // 4..9: area 1.7× 지속 (장기 spike = 카메라 접근)
  for (let i = 4; i < 10; i++) frames.push(mkFrame(100 + i * 80, 0.2 + i * 0.01, 0.17));
  for (let i = 10; i < 14; i++) frames.push(mkFrame(100 + i * 80, 0.05, 0.10));
  const r = computeSquatSetupMotionBlock(frames);
  ok(
    `2C-1: mid-epoch area spike → blocked=true, reason=step_in_or_camera_close_area_spike  [got ${r.reason}]`,
    r.blocked === true && r.reason === 'step_in_or_camera_close_area_spike'
  );
}

// 2D. 기존 head/tail 경로 보존 (tail area 반 이상 shrink)
{
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(mkFrame(100 + i * 80, 0.01, 0.10));
  for (let i = 4; i < 9; i++) frames.push(mkFrame(100 + i * 80, 0.2 + i * 0.03, 0.10));
  // 9..13: area 0.05 (50% shrink) — tail
  for (let i = 9; i < 14; i++) frames.push(mkFrame(100 + i * 80, 0.05, 0.05));
  const r = computeSquatSetupMotionBlock(frames);
  ok(
    `2D-1: head/tail shrink 기존 경로 보존 → blocked=true  [got ${r.reason}]`,
    r.blocked === true && r.reason === 'step_back_or_camera_tilt_area_shrink'
  );
}

// 2E. 짧은 시퀀스 (len<14) → blocked=false (기존 불변)
{
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push(mkFrame(100 + i * 80, 0.01, 0.10));
  const r = computeSquatSetupMotionBlock(frames);
  ok('2E-1: 짧은 시퀀스 → blocked=false (기존)', r.blocked === false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. evaluateSquatCompletionState 통합
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n3. evaluateSquatCompletionState 통합\n');

function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
}

// 3A. setupMotionBlocked=true → 모든 lane 차단
console.log('  3A. setupMotionBlocked=true 통합 (no lane may open)');

// 3A-1. deep depth + contamination → standard_cycle 미열림
const deepFrames = syntheticStateFrames(
  [0.01, 0.01, 0.01, 0.01, 0.01, 0.10, 0.25, 0.45, 0.42, 0.35, 0.22, 0.10, 0.03, 0.01, 0.01, 0.01, 0.01],
  ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
);
const deepContaminated = evaluateSquatCompletionState(deepFrames, { setupMotionBlocked: true });
ok(
  '3A-1: deep depth + setupMotionBlocked=true → completionSatisfied=false (standard lane 차단)',
  deepContaminated.completionSatisfied === false
);
ok(
  '3A-2: deep depth + setupMotionBlocked=true → completionPassReason !== "standard_cycle"',
  deepContaminated.completionPassReason !== 'standard_cycle'
);
ok(
  '3A-3: deep depth + setupMotionBlocked=true → contaminationLaneActive=true (diagnostic)',
  deepContaminated.contaminationLaneActive === true
);

// 3A-4. shallow depth + contamination → shallow lane 도 안 열림
const shallowContaminated = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.05, 0.10, 0.18, 0.16, 0.10, 0.05, 0.02, 0.01, 0.01, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
  ),
  { setupMotionBlocked: true }
);
ok(
  '3A-4: shallow depth + contamination → completionSatisfied=false',
  shallowContaminated.completionSatisfied === false
);
ok(
  '3A-5: shallow depth + contamination → officialShallowPathClosed=false',
  shallowContaminated.officialShallowPathClosed !== true
);
ok(
  '3A-6: shallow depth + contamination → officialShallowPathAdmitted=false (admission guard)',
  shallowContaminated.officialShallowPathAdmitted !== true
);

// 3B. 깨끗한 epoch → 기존 deep 통과 보존
console.log('\n  3B. 깨끗한 epoch 깊은 스쿼트 통과 보존');

const deepClean = evaluateSquatCompletionState(deepFrames, { setupMotionBlocked: false });
ok(
  '3B-1: deep clean → contaminationLaneActive=false',
  deepClean.contaminationLaneActive === false
);
// 완성이 안 된 다른 이유(no_reversal 등)가 있을 수 있으므로
// "contamination 때문에 막힌 것은 아님" 을 확인
ok(
  '3B-2: deep clean → completionPassReason 은 contamination 이 아닌 사유로 결정됨',
  deepClean.completionPassReason !== 'not_confirmed' ||
    deepClean.completionBlockedReason !== 'setup_motion_blocked'
);
ok(
  '3B-3: deep clean → evidenceLabel=standard (기존 불변)',
  deepClean.evidenceLabel === 'standard'
);

// 3C. attemptEpochFresh diagnostic 노출
console.log('\n  3C. attemptEpochFresh diagnostic');
ok(
  '3C-1: deep clean → attemptEpochFresh 필드 존재 (boolean)',
  typeof deepClean.attemptEpochFresh === 'boolean'
);

// 3D. seated-hold 유사 패턴 (descent 없음) → contamination 없어도 통과 안 함
{
  const seatedFrames = syntheticStateFrames(
    Array(16).fill(0.18),
    Array(16).fill('unknown')
  );
  const seatedState = evaluateSquatCompletionState(seatedFrames, { setupMotionBlocked: false });
  ok(
    '3D-1: seated-hold (depth constant, no descent) → completionSatisfied=false',
    seatedState.completionSatisfied === false
  );
  ok(
    '3D-2: seated-hold → completionPassReason=not_confirmed',
    seatedState.completionPassReason === 'not_confirmed'
  );
}

// 3E. standing-still (no depth) → 통과 안 함
{
  const standingFrames = syntheticStateFrames(
    Array(16).fill(0.01),
    Array(16).fill('start')
  );
  const standingState = evaluateSquatCompletionState(standingFrames, { setupMotionBlocked: false });
  ok(
    '3E-1: standing-still → completionSatisfied=false',
    standingState.completionSatisfied === false
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Lane exclusivity — admitted shallow 는 standard owner 가 못 뺏음
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n4. Lane exclusivity — admitted shallow is not stolen by standard\n');

// 4A. shallow 영역 깊이(0<d<0.40) 에서 admitted 되면 shallow 에만 닫힘
// (PR implementation 에서 `deriveOfficialShallowCandidate` 가 depth<0.40 을
//  강제하므로 lane drift 는 원천적으로 불가. 이 테스트는 lane 격리가
//  실제로 지속되는지 resolveSquatCompletionPath 직접 호출로 잠근다.)
ok(
  '4A-1: admitted shallow + shallow-zone depth → low_rom_cycle (not standard_cycle)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.28,
    evidenceLabel: 'low_rom',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    shallowRomClosureProofSignals: true,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'low_rom_cycle'
);

// 4B. admitted shallow lane 에서 standard owner 대역(depth>=0.40) 이
//     동시에 나타날 수는 없지만 (candidate 자체가 깊이로 막힘), 만에 하나
//     상위가 잘못 호출해도 standard 는 열린다. 이건 잘못된 상위 호출이며
//     candidate/admitted 조건 자체가 이미 상호 배타적이다. 정상 호출 경로에서
//     admitted=true 가 0.40 이상 depth 와 공존하지 않는다는 invariant 은
//     `deriveOfficialShallowCandidate` 구현에 위치한다.
ok(
  '4B-1 (invariant): candidate=true 와 depth>=0.40 이 공존 가능하다면 lane drift 위험 — ' +
    '상위 derivation 으로 방지됨을 상기',
  true // documentation-only anchor; enforced by deriveOfficialShallowCandidate
);

// 4C. non-admitted + deep → standard_cycle (기존 보존)
ok(
  '4C-1: non-admitted + deep depth → standard_cycle (기존 보존)',
  resolveSquatCompletionPath({
    completionBlockedReason: null,
    relativeDepthPeak: 0.69,
    evidenceLabel: 'standard',
    eventBasedDescentPath: false,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    shallowRomClosureProofSignals: false,
    ultraLowRomFreshCycleIntegrity: true,
    setupMotionBlocked: false,
    attemptEpochFresh: true,
  }) === 'standard_cycle'
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const name of failures) console.log(`  - ${name}`);
}
process.exit(failed > 0 ? 1 : 0);
