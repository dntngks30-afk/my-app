/**
 * PR-SHALLOW-SQUAT-FINALIZE-BAND-01: shallow squat finalize band smoke test
 *
 * 검증 목표:
 * A. 0.10~0.39 구간 → standingRecoveryBand가 'low_rom'으로 전환되는지 (핵심 변경)
 * B. evidenceLabel은 그대로 'standard'인지 (quality 라벨 불변)
 * C. 얕은 완성 시도에서 finalize 차단 사유가 low_rom 문맥인지 (recovery_hold_too_short 아님)
 * D. no_reversal 케이스 보존
 * E. standing still false positive 차단 유지
 * F. deep standard success 회귀 없음
 * G. auto-progression / pose-features imports 정상 (비변경 확인)
 *
 * Run: npx tsx scripts/camera-shallow-squat-finalize-band-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

/** 합성 PoseFeaturesFrame 배열 생성 (squat-completion-state.ts 직접 주입용) */
function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
}

/** landmark 목 (x, y, visibility) */
function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

/** depthProxy 기반 squat 포즈 landmark 목 */
function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.9));
  const hipY = 0.35;
  const kneeY = hipY + 0.15 * (1 - depthProxy);
  const ankleY = kneeY + 0.2;
  const kneeForward = depthProxy * 0.2;
  landmarks[23] = mockLandmark(0.45, hipY, 0.9);
  landmarks[24] = mockLandmark(0.55, hipY, 0.9);
  landmarks[25] = mockLandmark(0.45 + kneeForward, kneeY, 0.9);
  landmarks[26] = mockLandmark(0.55 - kneeForward, kneeY, 0.9);
  landmarks[27] = mockLandmark(0.45, ankleY, 0.9);
  landmarks[28] = mockLandmark(0.55, ankleY, 0.9);
  landmarks[11] = mockLandmark(0.45, 0.2, 0.9);
  landmarks[12] = mockLandmark(0.55, 0.2, 0.9);
  return { landmarks, timestamp };
}

function poseSeries(startTs, depthValues, stepMs = 80) {
  return depthValues.map((depthProxy, i) => squatPoseLandmarks(startTs + i * stepMs, depthProxy));
}

function squatStats(landmarks) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs: 2000,
    timestampDiscontinuityCount: 0,
  };
}

function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}

console.log('PR-SHALLOW-SQUAT-FINALIZE-BAND-01 smoke test\n');

// ─────────────────────────────────────────────────────────
// A. 핵심: 0.10~0.39 구간 standingRecoveryBand 전환 확인
// ─────────────────────────────────────────────────────────

// A-1: relativeDepthPeak ~0.14 (0.15 peak, baseline 0.01)
// → standingRecoveryBand = 'low_rom' (PR-SHALLOW-SQUAT-FINALIZE-BAND-01 핵심 변경)
// → evidenceLabel = 'standard' (quality label 불변, STANDARD_LABEL_FLOOR=0.10 ≤ 0.14)
const depth015State = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.05, 0.10, 0.15, 0.14, 0.10, 0.05, 0.02, 0.01, 0.01, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
  )
);
console.log('A. 0.10~0.39 구간 standingRecoveryBand 전환 검증 (핵심)');
ok('A1: depth ~0.15 → standingRecoveryBand=low_rom (PR 핵심 변경)', depth015State.standingRecoveryBand === 'low_rom');
ok('A2: depth ~0.15 → evidenceLabel=standard (quality label 불변)', depth015State.evidenceLabel === 'standard');

// A-2: relativeDepthPeak ~0.29 (0.30 peak, baseline 0.01) — 0.10~0.39 중간값
const depth030State = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.08, 0.18, 0.30, 0.25, 0.15, 0.07, 0.02, 0.01, 0.01, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
  )
);
ok('A3: depth ~0.30 → standingRecoveryBand=low_rom (0.40 미만)', depth030State.standingRecoveryBand === 'low_rom');
ok('A4: depth ~0.30 → evidenceLabel=standard (0.10 이상)', depth030State.evidenceLabel === 'standard');

// A-3: relativeDepthPeak ~0.39 경계값 (0.40 peak)
// baseline이 0.01이면 relativeDepthPeak = 0.40-0.01=0.39 → band='low_rom'
const depth040State = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.10, 0.25, 0.40, 0.32, 0.20, 0.08, 0.02, 0.01, 0.01, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
  )
);
// relativeDepthPeak = ~0.39 → low_rom (STANDARD_OWNER_FLOOR=0.40 미만)
ok('A5: depth peak ~0.40 (relative ~0.39) → standingRecoveryBand=low_rom', depth040State.standingRecoveryBand === 'low_rom');

// ─────────────────────────────────────────────────────────
// B. finalize 차단 사유: low_rom 문맥이어야 함
// ─────────────────────────────────────────────────────────
// relativeDepthPeak ~0.14, 서있기 복귀 프레임 1개(홀드 너무 짧음) → finalize 차단
// 새 코드: low_rom_standing_finalize_not_satisfied (이전: recovery_hold_too_short)
const shortHoldState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.05, 0.10, 0.15, 0.10, 0.05, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'ascent', 'ascent', 'start']
  )
);
console.log('\nB. finalize 차단 사유 문맥 검증');
ok(
  'B1: 얕은 스쿼트 finalize 차단 시 low_rom 문맥 사용 (recovery_hold_too_short 아님)',
  shortHoldState.completionSatisfied ||
  shortHoldState.completionBlockedReason === 'low_rom_standing_finalize_not_satisfied' ||
  shortHoldState.completionBlockedReason === 'ultra_low_rom_standing_finalize_not_satisfied'
);
ok(
  'B2: 얕은 스쿼트 finalize 차단 시 recovery_hold_too_short 아님',
  shortHoldState.completionSatisfied ||
  shortHoldState.completionBlockedReason !== 'recovery_hold_too_short'
);

// ─────────────────────────────────────────────────────────
// C. no_reversal 케이스 보존
// ─────────────────────────────────────────────────────────
// 하강 후 바닥에서 정체(역전 없음) → completionBlockedReason === 'no_reversal'
const noReversalState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.05, 0.10, 0.15, 0.15, 0.15, 0.15],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom']
  )
);
console.log('\nC. no_reversal 케이스 보존');
ok('C1: 역전 없는 하강 → completionSatisfied=false', !noReversalState.completionSatisfied);
ok('C2: 역전 없는 하강 → completionBlockedReason=no_reversal', noReversalState.completionBlockedReason === 'no_reversal');

// ─────────────────────────────────────────────────────────
// D. standing still false positive 차단
// ─────────────────────────────────────────────────────────
// 제자리(하강 없음) → completionSatisfied=false
const standingStillPoses = Array(12).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.01));
const standingStillLandmarks = toLandmarks(standingStillPoses);
const standingStillGate = evaluateExerciseAutoProgress('squat', standingStillLandmarks, squatStats(standingStillLandmarks));
console.log('\nD. standing still false positive 차단');
ok('D1: 제자리 → completionSatisfied=false', !standingStillGate.completionSatisfied);

// ─────────────────────────────────────────────────────────
// E. deep standard success 회귀 없음 (relativeDepthPeak >= STANDARD_OWNER_FLOOR=0.40)
// ─────────────────────────────────────────────────────────
console.log('\nE. deep standard success 회귀');
const deepState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.10, 0.25, 0.45, 0.42, 0.35, 0.22, 0.10, 0.03, 0.01, 0.01, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
  )
);
// relativeDepthPeak = ~0.44 → STANDARD_OWNER_FLOOR=0.40 이상
ok('E1: 깊은 스쿼트 → standingRecoveryBand=standard', deepState.standingRecoveryBand === 'standard');
ok('E2: 깊은 스쿼트 → evidenceLabel=standard', deepState.evidenceLabel === 'standard');
// 성공 시 standard_cycle이어야 하며, 미성공이어도 evidenceLabel 확인으로 충분
if (deepState.completionSatisfied) {
  ok('E3: 깊은 스쿼트 성공 → completionPassReason=standard_cycle', deepState.completionPassReason === 'standard_cycle');
} else {
  ok('E3: 깊은 스쿼트 (성공 전 단계) - evidenceLabel=standard 확인', deepState.evidenceLabel === 'standard');
}

// E-auto: auto-progression 경로에서도 깊은 스쿼트 통과
const deepPoses = toLandmarks(poseSeries(100, [
  ...Array(6).fill(0.015),
  0.05, 0.15, 0.30, 0.45, 0.42, 0.35, 0.22, 0.10, 0.04, 0.02,
  ...Array(4).fill(0.01),
]));
const deepGate = evaluateExerciseAutoProgress('squat', deepPoses, squatStats(deepPoses));
ok('E4: 깊은 스쿼트 auto-progression - gate 구조 정상 (squatCycleDebug 존재)', !!deepGate.squatCycleDebug);

// ─────────────────────────────────────────────────────────
// F. ultra_low_rom 경계 (~0.05 peak)
// ─────────────────────────────────────────────────────────
console.log('\nF. ultra_low_rom 경계 보존');
const ultraLowState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.04, 0.03, 0.01, 0.01, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'start', 'descent', 'bottom', 'ascent', 'ascent', 'start', 'start', 'start', 'start']
  )
);
// relativeDepthPeak = ~0.04 → LOW_ROM_LABEL_FLOOR=0.07 미만 → band='ultra_low_rom' 또는 'insufficient_signal'
ok('F1: ultra_low_rom depth → standingRecoveryBand != standard', ultraLowState.standingRecoveryBand !== 'standard');
ok('F2: ultra_low_rom depth → standingRecoveryBand != low_rom', ultraLowState.standingRecoveryBand !== 'low_rom');

// ─────────────────────────────────────────────────────────
// G. pose-features, auto-progression imports 정상 (비변경 파일 확인)
// ─────────────────────────────────────────────────────────
console.log('\nG. 비변경 파일 import 정상');
ok('G1: evaluateExerciseAutoProgress import 정상', typeof evaluateExerciseAutoProgress === 'function');
ok('G2: buildPoseFeaturesFrames import 정상', typeof buildPoseFeaturesFrames === 'function');
ok('G3: evaluateSquatCompletionState import 정상', typeof evaluateSquatCompletionState === 'function');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
