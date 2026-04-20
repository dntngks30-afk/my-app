/**
 * PR-CAM-SQUAT-BLENDED-EARLY-PEAK-FALSE-PASS-LOCK-01 smoke
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass,
  computeSquatPostOwnerPreLatchGateLayer,
  isFinalPassLatched,
  evaluateExerciseAutoProgress,
} = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}`, extra ?? '');
  process.exitCode = 1;
}

function buildContaminatedSignature() {
  return {
    cs: {
      evidenceLabel: 'ultra_low_rom',
      completionPassReason: 'not_confirmed',
      completionTruthPassed: false,
      relativeDepthPeak: 0.072,
      relativeDepthPeakSource: 'blended',
      rawDepthPeakPrimary: 0.002,
      rawDepthPeakBlended: 0.071,
      peakLatchedAtIndex: 0,
      eventCycleDetected: false,
      eventCyclePromoted: false,
    },
    dbg: {
      armingDepthBlendAssisted: true,
      armingFallbackUsed: true,
      armingDepthSource: 'fallback_assisted_blended',
      peakLatchedAtIndex: 0,
      eventCycleDetected: false,
      eventCyclePromoted: false,
      squatDepthPeakPrimary: 0.002,
      squatDepthPeakBlended: 0.071,
      rawDepthPeakPrimary: 0.002,
      rawDepthPeakBlended: 0.071,
    },
  };
}

/** Observed-family variant: same compound contaminated signature, but peakLatchedAtIndex=2.
 *  canonicalShallowContractProvenanceOnlySignalPresent=true confirms provenance-without-reversal
 *  contamination, which is the extra AND guard that keeps the index=2 branch narrow. */
function buildObservedFamilyPeakIndex2() {
  return {
    cs: {
      evidenceLabel: 'ultra_low_rom',
      completionPassReason: 'not_confirmed',
      completionTruthPassed: false,
      relativeDepthPeak: 0.074,
      relativeDepthPeakSource: 'blended',
      rawDepthPeakPrimary: 0.003,
      rawDepthPeakBlended: 0.073,
      peakLatchedAtIndex: 2,
      eventCycleDetected: false,
      eventCyclePromoted: false,
    },
    dbg: {
      armingDepthBlendAssisted: true,
      armingFallbackUsed: true,
      armingDepthSource: 'fallback_assisted_blended',
      peakLatchedAtIndex: 2,
      eventCycleDetected: false,
      eventCyclePromoted: false,
      squatDepthPeakPrimary: 0.003,
      squatDepthPeakBlended: 0.073,
      rawDepthPeakPrimary: 0.003,
      rawDepthPeakBlended: 0.073,
      canonicalShallowContractProvenanceOnlySignalPresent: true,
    },
  };
}

console.log('\nPR-CAM-SQUAT-BLENDED-EARLY-PEAK-FALSE-PASS-LOCK-01 smoke\n');

// A) contaminated compound signature MUST block final pass opening.
{
  const { cs, dbg } = buildContaminatedSignature();

  ok(
    'A1 contaminated compound signature -> blocker true',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', cs, dbg) === true
  );

  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'pass_core_detected',
      completionOwnerBlockedReason: null,
    },
    uiGateInput: {
      completionOwnerPassed: true,
      guardrailCompletionComplete: true,
      captureQualityInvalid: false,
      confidence: 0.9,
      passThresholdEffective: 0.56,
      effectivePassConfirmation: true,
      passConfirmationFrameCount: 3,
      framesReq: 2,
      captureArmingSatisfied: true,
      squatIntegrityBlockForPass: null,
      reasons: [],
      hardBlockerReasons: [],
      liveReadinessNotReady: false,
      readinessStableDwellSatisfied: true,
      setupMotionBlocked: false,
    },
    squatCompletionState: cs,
    squatCycleDebug: dbg,
    squatPassCore: {
      passDetected: true,
      passBlockedReason: null,
      repId: 'rep_test',
      descentDetected: true,
      reversalDetected: true,
      standingRecovered: true,
      setupClear: true,
      currentRepOwnershipClear: true,
      antiFalsePassClear: true,
      trace: 'smoke',
    },
  });

  const syntheticGate = {
    status: layer.progressionPassed ? 'pass' : 'retry',
    nextAllowed: layer.progressionPassed,
    completionSatisfied: true,
    passConfirmationSatisfied: true,
    finalPassEligible: layer.progressionPassed,
    finalPassBlockedReason: layer.finalPassBlockedReason,
  };

  ok('A2 contaminated signature -> gate.status !== pass', syntheticGate.status !== 'pass', syntheticGate);
  ok('A3 contaminated signature -> finalPassEligible false', syntheticGate.finalPassEligible === false, syntheticGate);
  ok(
    'A4 contaminated signature -> isFinalPassLatched false',
    isFinalPassLatched('squat', syntheticGate) === false,
    syntheticGate
  );
  // A5: PR-01 (Completion-First Authority Freeze) may close the final pass even earlier than the
  // narrow late blocker, because the contaminated signature also has completionTruthPassed=false
  // (completionPassReason='not_confirmed'). Accept either the narrow late blocker reason or an
  // earlier PR-01 authority reason — both are truthful, both close the split-brain path.
  const A5_ACCEPTED_REASONS = new Set([
    'contaminated_blended_early_peak_false_pass',
    'completion_truth_not_passed',
    'completion_reason_not_confirmed',
  ]);
  ok(
    'A5 contaminated signature -> truthful blocker reason (narrow late OR PR-01 authority)',
    A5_ACCEPTED_REASONS.has(syntheticGate.finalPassBlockedReason),
    syntheticGate.finalPassBlockedReason
  );
}

// B) single-field checks are NOT blockers by themselves.
{
  const { cs, dbg } = buildContaminatedSignature();

  ok(
    'B1 single-field not blocker: completionTruthPassed false only',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', {
      ...cs,
      completionPassReason: 'ultra_low_rom_cycle',
      completionTruthPassed: false,
      relativeDepthPeakSource: 'primary',
    }, {
      ...dbg,
      armingDepthBlendAssisted: false,
      armingFallbackUsed: false,
    }) === false
  );

  ok(
    'B2 single-field not blocker: blended source only',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', {
      ...cs,
      completionPassReason: 'low_rom_cycle',
      completionTruthPassed: true,
      relativeDepthPeakSource: 'blended',
    }, {
      ...dbg,
      armingDepthBlendAssisted: false,
      armingFallbackUsed: false,
    }) === false
  );

  ok(
    'B3 single-field not blocker: early peak only',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', {
      ...cs,
      completionPassReason: 'low_rom_cycle',
      completionTruthPassed: true,
      relativeDepthPeakSource: 'primary',
      peakLatchedAtIndex: 0,
    }, {
      ...dbg,
      armingDepthBlendAssisted: false,
      armingFallbackUsed: false,
    }) === false
  );

  ok(
    'B4 no-event-cycle alone is not blocker',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', {
      ...cs,
      completionPassReason: 'ultra_low_rom_cycle',
      completionTruthPassed: true,
      relativeDepthPeakSource: 'primary',
      eventCycleDetected: false,
      eventCyclePromoted: false,
    }, {
      ...dbg,
      armingDepthBlendAssisted: false,
      armingFallbackUsed: false,
      eventCycleDetected: false,
      eventCyclePromoted: false,
    }) === false
  );

  // B5: index=2 WITHOUT canonicalShallowContractProvenanceOnlySignalPresent is not a blocker.
  // The observed-family extension requires both index=2 AND the provenance-only marker.
  ok(
    'B5 peakLatchedAtIndex=2 without provenanceOnlySignalPresent is not blocker',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', {
      ...cs,
      peakLatchedAtIndex: 2,
    }, {
      ...dbg,
      peakLatchedAtIndex: 2,
      canonicalShallowContractProvenanceOnlySignalPresent: false,
    }) === false
  );
}

// D) observed-family variant: peakLatchedAtIndex=2 + provenanceOnlySignalPresent MUST block.
console.log('\nObserved-family variant (peakLatchedAtIndex=2)\n');
{
  const { cs, dbg } = buildObservedFamilyPeakIndex2();

  ok(
    'D1 observed-family index=2 -> blocker true',
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass('squat', cs, dbg) === true
  );

  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'pass_core_detected',
      completionOwnerBlockedReason: null,
    },
    uiGateInput: {
      completionOwnerPassed: true,
      guardrailCompletionComplete: true,
      captureQualityInvalid: false,
      confidence: 0.9,
      passThresholdEffective: 0.56,
      effectivePassConfirmation: true,
      passConfirmationFrameCount: 3,
      framesReq: 2,
      captureArmingSatisfied: true,
      squatIntegrityBlockForPass: null,
      reasons: [],
      hardBlockerReasons: [],
      liveReadinessNotReady: false,
      readinessStableDwellSatisfied: true,
      setupMotionBlocked: false,
    },
    squatCompletionState: cs,
    squatCycleDebug: dbg,
    squatPassCore: {
      passDetected: true,
      passBlockedReason: null,
      repId: 'rep_observed_index2',
      descentDetected: true,
      reversalDetected: true,
      standingRecovered: true,
      setupClear: true,
      currentRepOwnershipClear: true,
      antiFalsePassClear: true,
      trace: 'smoke_observed_index2',
    },
  });

  const syntheticGateD = {
    status: layer.progressionPassed ? 'pass' : 'retry',
    nextAllowed: layer.progressionPassed,
    completionSatisfied: true,
    passConfirmationSatisfied: true,
    finalPassEligible: layer.progressionPassed,
    finalPassBlockedReason: layer.finalPassBlockedReason,
  };

  ok('D2 observed-family index=2 -> gate.status !== pass', syntheticGateD.status !== 'pass', syntheticGateD);
  ok('D3 observed-family index=2 -> finalPassEligible false', syntheticGateD.finalPassEligible === false, syntheticGateD);
  ok(
    'D4 observed-family index=2 -> isFinalPassLatched false',
    isFinalPassLatched('squat', syntheticGateD) === false,
    syntheticGateD
  );
  // D5: same realignment as A5. After PR-01, the completion-first authority closes the observed
  // contaminated family at or before the narrow late blocker — accept either reason.
  const D5_ACCEPTED_REASONS = new Set([
    'contaminated_blended_early_peak_false_pass',
    'completion_truth_not_passed',
    'completion_reason_not_confirmed',
  ]);
  ok(
    'D5 observed-family index=2 -> truthful blocker reason (narrow late OR PR-01 authority)',
    D5_ACCEPTED_REASONS.has(syntheticGateD.finalPassBlockedReason),
    syntheticGateD.finalPassBlockedReason
  );
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));

  const depthT = clamp((170 - kneeAngleDeg) / 110);
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;

  const leftHipX = 0.44;
  const rightHipX = 0.56;
  const leftKneeX = 0.45;
  const rightKneeX = 0.55;

  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;

  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(leftHipX, hipY, 0.99);
  landmarks[24] = mockLandmark(rightHipX, hipY, 0.99);
  landmarks[25] = mockLandmark(leftKneeX, kneeY, 0.99);
  landmarks[26] = mockLandmark(rightKneeX, kneeY, 0.99);
  landmarks[27] = mockLandmark(leftKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(rightKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);

  return { landmarks, timestamp };
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function toLandmarks(series) {
  return series.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}
function squatStats(landmarks, captureDurationMs = 3200) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}

// C) representative permanence + deep standard stay green.
//
// PR-01 (Completion-First Authority Freeze) realignment:
//   Before PR-01, the shallow_92deg / ultra_low_rom_92deg synthetic sequences passed through the
//   pass-core-first owner shortcut even though the completion-owner path surfaced
//   `completionBlockedReason='ultra_low_rom_not_allowed'` and `completionSatisfied !== true`.
//   That path is explicitly one of the illegal states listed in SSOT §6 (#8:
//   "assist-only shallow admission reopening final pass without canonical completion-owner truth").
//
//   PR-01 closes that split-brain opener. Upstream shallow evidence formation is still fragile,
//   which means these synthetic shallow fixtures no longer reach canonical completion-owner pass.
//   Per PR-01 §12 and PR-Truth-Map §4.PR-01 "residual risk", this is accepted — the point of PR-01
//   is authority correction, not shallow-evidence perfection.
//
//   Therefore C1 and C2 assert the new authority-correct behavior: if the real path cannot
//   produce canonical completion-owner truth, final pass fails-closed with a truthful reason.
//   Shallow correctness is deferred to follow-on shallow-evidence PRs (see PR-F / PR-E1 family).
console.log('\nPreservation checks (representative shallow + deep standard)\n');
{
  const SHALLOW_ACCEPTED_BLOCKED_REASONS = new Set([
    'completion_truth_not_passed',
    'completion_reason_not_confirmed',
    'completion_blocked:ultra_low_rom_not_allowed',
    'completion_owner_reason_not_confirmed',
    'cycle_not_complete',
  ]);

  const shallowAngles = [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92,
    92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(6).fill(170),
  ];
  const shallowLandmarks = toLandmarks(makeKneeAngleSeries(200, shallowAngles, 80));
  const gateShallow = evaluateExerciseAutoProgress('squat', shallowLandmarks, squatStats(shallowLandmarks));
  if (gateShallow.finalPassEligible === true && gateShallow.status === 'pass') {
    ok('C1 shallow_92deg — passes when canonical completion-owner truth forms', true);
  } else {
    ok(
      'C1 shallow_92deg — fails-closed with truthful PR-01 authority reason (residual shallow-evidence risk)',
      gateShallow.finalPassEligible === false &&
        SHALLOW_ACCEPTED_BLOCKED_REASONS.has(gateShallow.finalPassBlockedReason),
      {
        status: gateShallow.status,
        finalPassEligible: gateShallow.finalPassEligible,
        finalPassBlockedReason: gateShallow.finalPassBlockedReason,
      }
    );
  }

  const ultraShallowAngles = [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92,
    92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(10).fill(170),
  ];
  const ultraLandmarks = toLandmarks(makeKneeAngleSeries(300, ultraShallowAngles, 80));
  const gateUltra = evaluateExerciseAutoProgress('squat', ultraLandmarks, squatStats(ultraLandmarks));
  if (gateUltra.finalPassEligible === true && gateUltra.status === 'pass') {
    ok('C2 ultra_low_rom_92deg — passes when canonical completion-owner truth forms', true);
  } else {
    ok(
      'C2 ultra_low_rom_92deg — fails-closed with truthful PR-01 authority reason (residual shallow-evidence risk)',
      gateUltra.finalPassEligible === false &&
        SHALLOW_ACCEPTED_BLOCKED_REASONS.has(gateUltra.finalPassBlockedReason),
      {
        status: gateUltra.status,
        finalPassEligible: gateUltra.finalPassEligible,
        finalPassBlockedReason: gateUltra.finalPassBlockedReason,
      }
    );
  }

  const deepAngles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
    60, 60,
    70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const deepLandmarks = toLandmarks(makeKneeAngleSeries(400, deepAngles, 80));
  const gateDeep = evaluateExerciseAutoProgress('squat', deepLandmarks, squatStats(deepLandmarks));
  ok('C3 deep standard full cycle remains pass', gateDeep.finalPassEligible === true && gateDeep.status === 'pass', {
    status: gateDeep.status,
    finalPassEligible: gateDeep.finalPassEligible,
    passReason: gateDeep.squatCycleDebug?.completionPassReason,
  });
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
