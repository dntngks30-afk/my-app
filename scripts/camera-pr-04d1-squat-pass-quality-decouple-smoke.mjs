/**
 * PR-04D1 smoke — squat completion pass vs low-quality capture decouple
 *
 * 실행: npx tsx scripts/camera-pr-04d1-squat-pass-quality-decouple-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  getSquatRawStandardCycleSignalIntegrityBlock,
  getSquatQualityOnlyWarnings,
  getSquatPassBlockingReasons,
  isSquatLowQualityPassDecoupleEligible,
  squatPassProgressionIntegrityBlock,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

function squatPoseLandmarks(timestamp, depthProxy) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) =>
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
  return depthValues.map((depthProxy, i) => squatPoseLandmarks(startTs + i * stepMs, depthProxy));
}

function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}

function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: 4500,
    timestampDiscontinuityCount: 0,
  };
}

const baseCs = {
  completionSatisfied: true,
  completionPassReason: 'standard_cycle',
  currentSquatPhase: 'standing_recovered',
};

const lowGuard = { captureQuality: 'low', flags: ['hard_partial', 'unstable_frame_timing'] };

console.log('\n── A. standard_cycle + low + hard_partial: integrity raw exists but pass gate ignores when decouple ──');
{
  const raw = getSquatRawStandardCycleSignalIntegrityBlock(true, lowGuard, {
    debug: { squatCompletionState: baseCs },
  });
  ok('A0: raw integrity non-null', raw != null, raw);
  const dec = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    guardrail: { captureQuality: 'low' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  });
  ok('A1: decouple eligible', dec === true);
  const forPass = squatPassProgressionIntegrityBlock(raw, dec);
  ok('A2: progression integrity block null when decouple', forPass === null, forPass);
  const q = getSquatQualityOnlyWarnings({
    guardrail: lowGuard,
    rawIntegrityBlock: raw,
    decoupleEligible: dec,
  });
  ok('A3: quality warnings include expected tags', q.includes('capture_quality_low') && q.includes('hard_partial'));
}

console.log('\n── B. standard_cycle_signal_integrity only (unstable_frame_timing) ──');
{
  const g = { captureQuality: 'low', flags: ['unstable_frame_timing'] };
  const raw = getSquatRawStandardCycleSignalIntegrityBlock(true, g, {
    debug: { squatCompletionState: baseCs },
  });
  ok('B0: raw set', raw != null);
  const dec = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    guardrail: { captureQuality: 'low' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  });
  ok('B1: pass gate integrity cleared', squatPassProgressionIntegrityBlock(raw, dec) === null);
  const q = getSquatQualityOnlyWarnings({
    guardrail: g,
    rawIntegrityBlock: raw,
    decoupleEligible: dec,
  });
  ok('B2: standard_cycle_signal_integrity in quality-only list', q.includes('standard_cycle_signal_integrity'));
}

console.log('\n── C. invalid capture → decouple off (severe invalid guard) ──');
{
  const dec = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    guardrail: { captureQuality: 'invalid' },
    severeInvalid: true,
    effectivePassConfirmation: true,
  });
  ok('C1: not eligible when invalid + severe', dec === false);
  const dec2 = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    guardrail: { captureQuality: 'invalid' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  });
  ok('C2: not eligible when capture invalid', dec2 === false);
}

console.log('\n── D. incomplete cycle → not decouple ──');
{
  const dec = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: false,
    completionPassReason: 'standard_cycle',
    guardrail: { captureQuality: 'low' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  });
  ok('D1: completion false → no decouple', dec === false);
  const dec2 = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: true,
    completionPassReason: 'not_confirmed',
    guardrail: { captureQuality: 'low' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  });
  ok('D2: not_confirmed → no decouple', dec2 === false);
}

console.log('\n── E. auto-progression exposes contract fields on squatCycleDebug ──');
{
  const shallowLandmarks = toLandmarks(
    poseSeries(100, [
      ...Array(10).fill(0.015),
      0.01, 0.02, 0.02, 0.01, 0.03, 0.05, 0.07, 0.09, 0.08, 0.06, 0.04, 0.02,
    ])
  );
  const gate = evaluateExerciseAutoProgress('squat', shallowLandmarks, squatStats(shallowLandmarks.length));
  const d = gate.squatCycleDebug;
  ok('E0: squatCycleDebug exists', d != null);
  ok('E1: completionTruthPassed boolean', typeof d.completionTruthPassed === 'boolean');
  ok('E2: lowQualityPassAllowed boolean', typeof d.lowQualityPassAllowed === 'boolean');
  ok('E3: passOwner string', typeof d.passOwner === 'string');
  ok('E4: qualityOnlyWarnings is array or omitted', d.qualityOnlyWarnings == null || Array.isArray(d.qualityOnlyWarnings));
}

console.log('\n── F. getSquatPassBlockingReasons shape ──');
{
  const reasons = ['hard_partial', 'insufficient_signal'];
  const hb = ['insufficient_signal', 'valid_frames_too_few', 'framing_invalid'];
  const blockers = getSquatPassBlockingReasons({
    integrityBlockForPass: 'standard_cycle_signal_integrity:x',
    reasons,
    hardBlockerReasons: hb,
  });
  ok('F1: includes integrity + hard intersection', blockers.includes('insufficient_signal'));
}

console.log(`\n━━━ PR-04D1 smoke: ${passed} passed, ${failed} failed ━━━`);
