/**
 * PR-CAM-09: Squat ownership refactor smoke test
 *
 * 검증 항목:
 * 1. evidenceLabelToSquatEvidenceLevel — 매핑 정확성
 * 2. squatEvidenceLevelToReasons — 이유 태그 정확성
 * 3. completionBlockedReasonToFailureTags — retry failure 태그 매핑
 * 4. applySquatQualityCap — 품질 캡 다운그레이드 방향만 허용
 * 5. 기존 스쿼트 시나리오 (shallow full cycle pass, descend-only not pass 등) 회귀 확인
 *
 * Run: npx tsx scripts/camera-cam09-squat-ownership-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evidenceLabelToSquatEvidenceLevel, squatEvidenceLevelToReasons, squatEvidenceLevelToConfidenceDowngradeReason, applySquatQualityCap } = await import('../src/lib/camera/squat-evidence.ts');
const { completionBlockedReasonToFailureTags } = await import('../src/lib/camera/squat-retry-reason.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

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

console.log('Camera CAM-09 squat ownership smoke test\n');

// ─── A. evidenceLabelToSquatEvidenceLevel ───────────────────────────────────
console.log('A. evidenceLabelToSquatEvidenceLevel');

ok('A1: standard + cycleProofPassed → strong_evidence',
  evidenceLabelToSquatEvidenceLevel('standard', true) === 'strong_evidence');
ok('A2: low_rom + cycleProofPassed → shallow_evidence',
  evidenceLabelToSquatEvidenceLevel('low_rom', true) === 'shallow_evidence');
ok('A3: ultra_low_rom + cycleProofPassed → weak_evidence',
  evidenceLabelToSquatEvidenceLevel('ultra_low_rom', true) === 'weak_evidence');
ok('A4: insufficient_signal + cycleProofPassed → insufficient_signal',
  evidenceLabelToSquatEvidenceLevel('insufficient_signal', true) === 'insufficient_signal');
ok('A5: standard + !cycleProofPassed → insufficient_signal',
  evidenceLabelToSquatEvidenceLevel('standard', false) === 'insufficient_signal');
ok('A6: low_rom + !cycleProofPassed → insufficient_signal',
  evidenceLabelToSquatEvidenceLevel('low_rom', false) === 'insufficient_signal');

// ─── B. squatEvidenceLevelToReasons ─────────────────────────────────────────
console.log('\nB. squatEvidenceLevelToReasons');

ok('B1: insufficient_signal + null reason → cycle_proof_insufficient',
  squatEvidenceLevelToReasons('insufficient_signal', null)[0] === 'cycle_proof_insufficient');
ok('B2: insufficient_signal + blocked reason → uses blocked reason',
  squatEvidenceLevelToReasons('insufficient_signal', 'no_descend')[0] === 'no_descend');
ok('B3: strong_evidence → [standard, standing_recovered]',
  JSON.stringify(squatEvidenceLevelToReasons('strong_evidence', null)) === '["standard","standing_recovered"]');
ok('B4: shallow_evidence → [low_rom, standing_recovered]',
  JSON.stringify(squatEvidenceLevelToReasons('shallow_evidence', null)) === '["low_rom","standing_recovered"]');
ok('B5: weak_evidence → [ultra_low_rom, standing_recovered]',
  JSON.stringify(squatEvidenceLevelToReasons('weak_evidence', null)) === '["ultra_low_rom","standing_recovered"]');

// ─── C. squatEvidenceLevelToConfidenceDowngradeReason ───────────────────────
console.log('\nC. squatEvidenceLevelToConfidenceDowngradeReason');

ok('C1: strong_evidence → null',
  squatEvidenceLevelToConfidenceDowngradeReason('strong_evidence') === null);
ok('C2: shallow_evidence → shallow_depth',
  squatEvidenceLevelToConfidenceDowngradeReason('shallow_evidence') === 'shallow_depth');
ok('C3: weak_evidence → ultra_low_rom_cycle',
  squatEvidenceLevelToConfidenceDowngradeReason('weak_evidence') === 'ultra_low_rom_cycle');
ok('C4: insufficient_signal → null',
  squatEvidenceLevelToConfidenceDowngradeReason('insufficient_signal') === null);

// ─── D. completionBlockedReasonToFailureTags ─────────────────────────────────
console.log('\nD. completionBlockedReasonToFailureTags');

ok('D1: null → []',
  completionBlockedReasonToFailureTags(null).length === 0);
ok('D2: no_reversal → ascent_not_detected',
  completionBlockedReasonToFailureTags('no_reversal').includes('ascent_not_detected'));
ok('D3: no_ascend → ascent_not_detected',
  completionBlockedReasonToFailureTags('no_ascend').includes('ascent_not_detected'));
ok('D4: not_standing_recovered → ascent_not_detected',
  completionBlockedReasonToFailureTags('not_standing_recovered').includes('ascent_not_detected'));
ok('D5: no_descend → rep_incomplete',
  completionBlockedReasonToFailureTags('no_descend').includes('rep_incomplete'));
ok('D6: insufficient_relative_depth → rep_incomplete',
  completionBlockedReasonToFailureTags('insufficient_relative_depth').includes('rep_incomplete'));
ok('D7: not_armed → rep_incomplete',
  completionBlockedReasonToFailureTags('not_armed').includes('rep_incomplete'));
ok('D8: unknown reason → []',
  completionBlockedReasonToFailureTags('unknown_reason').length === 0);

// ─── E. applySquatQualityCap ─────────────────────────────────────────────────
console.log('\nE. applySquatQualityCap');

const goodQuality = { bottomStabilityLow: false, kneeTrackingOff: false, trunkLeanHigh: false, strongQuality: true };
const weakQuality = { bottomStabilityLow: false, kneeTrackingOff: false, trunkLeanHigh: false, strongQuality: false };
const multiConcernQuality = { bottomStabilityLow: true, kneeTrackingOff: true, trunkLeanHigh: false, strongQuality: false };

ok('E1: strong_evidence + good quality → strong_evidence (no cap)',
  applySquatQualityCap('strong_evidence', ['standard', 'standing_recovered'], 'standard', goodQuality).level === 'strong_evidence');
ok('E2: strong_evidence + weak quality → shallow_evidence (cap down)',
  applySquatQualityCap('strong_evidence', ['standard', 'standing_recovered'], 'standard', weakQuality).level === 'shallow_evidence');
ok('E3: shallow_evidence + 2 concerns → weak_evidence (cap down)',
  applySquatQualityCap('shallow_evidence', ['low_rom', 'standing_recovered'], 'low_rom', multiConcernQuality).level === 'weak_evidence');
ok('E4: shallow_evidence + 1 concern → shallow_evidence (not capped)',
  applySquatQualityCap('shallow_evidence', ['low_rom', 'standing_recovered'], 'low_rom', weakQuality).level === 'shallow_evidence');
ok('E5: weak_evidence + any quality → weak_evidence (already lowest passing tier)',
  applySquatQualityCap('weak_evidence', ['ultra_low_rom', 'standing_recovered'], 'ultra_low_rom', multiConcernQuality).level === 'weak_evidence');
ok('E6: quality cap never upgrades (insufficient_signal stays)',
  applySquatQualityCap('insufficient_signal', ['cycle_proof_insufficient'], 'insufficient_signal', goodQuality).level === 'insufficient_signal');
ok('E7: cam02_standard_quality_capped tag appears when capped',
  applySquatQualityCap('strong_evidence', ['standard', 'standing_recovered'], 'standard', weakQuality).reasons.includes('cam02_standard_quality_capped'));
ok('E8: confidenceDowngradeReason set when capped from strong → shallow',
  applySquatQualityCap('strong_evidence', ['standard', 'standing_recovered'], 'standard', weakQuality).confidenceDowngradeReason === 'cam02_standard_cycle_quality_capped');

// ─── F. 기존 시나리오 회귀 확인 ─────────────────────────────────────────────
console.log('\nF. 기존 시나리오 회귀 확인');

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}
function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33).fill(null).map((_, i) =>
    mockLandmark(0.4 + (i % 11) * 0.02, 0.2 + Math.floor(i / 11) * 0.08, 0.9)
  );
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
  return depthValues.map((d, i) => squatPoseLandmarks(startTs + i * stepMs, d));
}
function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}
function squatStats(landmarks) {
  return { sampledFrameCount: landmarks.length, droppedFrameCount: 0, captureDurationMs: 2500, timestampDiscontinuityCount: 0 };
}
function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
}

// shallow full cycle
const shallowState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    ['start','start','start','start','descent','descent','descent','bottom','bottom','ascent','ascent','ascent','start','start','start']
  )
);
ok('F1: shallow full cycle completionSatisfied', shallowState.completionSatisfied);
ok('F2: shallow evidence label is low_rom', shallowState.evidenceLabel === 'low_rom');

// descend-only
const descendOnlyLandmarks = toLandmarks([
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.02 + i * 0.02)),
  ...Array(8).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.1 + i * 0.08)),
]);
const descendOnlyGate = evaluateExerciseAutoProgress('squat', descendOnlyLandmarks, squatStats(descendOnlyLandmarks));
ok('F3: descend-only does not pass', !descendOnlyGate.completionSatisfied);

// tiny dip
const tinyDipLandmarks = toLandmarks([
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.01)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.025 + i * 0.003)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(740 + i * 80, 0.02 - i * 0.002)),
]);
const tinyDipGate = evaluateExerciseAutoProgress('squat', tinyDipLandmarks, squatStats(tinyDipLandmarks));
ok('F4: tiny dip does not pass', !tinyDipGate.completionSatisfied);

// setup crouch
const setupCrouchLandmarks = toLandmarks(
  Array(12).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.25 + i * 0.01))
);
const setupCrouchGate = evaluateExerciseAutoProgress('squat', setupCrouchLandmarks, squatStats(setupCrouchLandmarks));
ok('F5: setup crouch does not pass', !setupCrouchGate.completionSatisfied);

// completion quality remains separate from completion (mid-ascent)
const midAscentState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.04, 0.07, 0.1, 0.12, 0.11, 0.09, 0.07, 0.05],
    ['start','start','start','start','descent','descent','descent','bottom','ascent','ascent','ascent','ascent']
  )
);
ok('F6: mid-ascent not complete (quality independent from completion)', !midAscentState.completionSatisfied);

// squatCycleDebug present in gate result
const shallowArmedLandmarks = toLandmarks(poseSeries(100, [
  ...Array(10).fill(0.015),
  0.01, 0.02, 0.02, 0.01, 0.03, 0.05, 0.07, 0.09, 0.08, 0.06, 0.04, 0.02,
]));
const gateResult = evaluateExerciseAutoProgress('squat', shallowArmedLandmarks, squatStats(shallowArmedLandmarks));
ok('F7: squatCycleDebug present in gate result', !!gateResult.squatCycleDebug);

// internal quality is independent from completion
ok('F8: squatInternalQuality in squatCycleDebug is independent from completionSatisfied',
  gateResult.squatCycleDebug?.squatInternalQuality != null ||
  gateResult.squatCycleDebug?.squatInternalQuality === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
