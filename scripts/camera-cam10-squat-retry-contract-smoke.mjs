/**
 * PR-CAM-10: Squat ambiguous retry / second-chance contract smoke tests.
 * Run: npx tsx scripts/camera-cam10-squat-retry-contract-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS,
  isSquatAmbiguousRetrySuppressedForBlockedReason,
  isSquatAmbiguousRetryEligible,
  deriveSquatAmbiguousRetryReason,
} = await import('../src/lib/camera/squat-ambiguous-retry.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

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

/** 최소 필드만 채운 squat gate mock (eligibility 전용) */
function mockSquatGate(partial) {
  return {
    evaluatorResult: {
      stepId: 'squat',
      debug: {
        squatCompletionState: {
          completionBlockedReason: partial.blocked ?? null,
        },
        highlightedMetrics: {
          completionMachinePhase: partial.phase ?? 'bottom_or_low_point',
        },
      },
    },
    completionSatisfied: false,
    guardrail: {
      captureQuality: partial.captureQuality ?? 'ok',
      flags: partial.guardrailFlags ?? [],
    },
    failureReasons: partial.failureReasons ?? [],
    squatCycleDebug: {
      completionMachinePhase: partial.phase ?? 'bottom_or_low_point',
      completionBlockedReason: partial.blocked ?? null,
    },
  };
}

console.log('Camera CAM-10 squat retry contract smoke\n');

console.log('A. blocked reason suppression');
ok('A1: not_armed suppressed', isSquatAmbiguousRetrySuppressedForBlockedReason('not_armed'));
ok('A2: no_reversal not suppressed', !isSquatAmbiguousRetrySuppressedForBlockedReason('no_reversal'));
ok('A3: null not suppressed', !isSquatAmbiguousRetrySuppressedForBlockedReason(null));

console.log('\nB. min capture duration');
const eligibleBase = mockSquatGate({ blocked: 'no_reversal', phase: 'bottom_or_low_point' });
ok(
  'B1: below min capture → not eligible',
  !isSquatAmbiguousRetryEligible(eligibleBase, SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS - 1)
);
ok(
  'B2: at min capture → eligible',
  isSquatAmbiguousRetryEligible(eligibleBase, SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS)
);
ok('B3: derive null when not eligible', deriveSquatAmbiguousRetryReason(eligibleBase, 1000) === null);

console.log('\nC. not_armed never eligible (voice spam / early nag)');
const notArmed = mockSquatGate({ blocked: 'not_armed', phase: 'descending_confirmed' });
ok(
  'C1: not_armed ineligible even with long capture',
  !isSquatAmbiguousRetryEligible(notArmed, 5000)
);

console.log('\nD. derive maps blocked reason');
ok(
  'D1: no_reversal → no_reversal voice reason',
  deriveSquatAmbiguousRetryReason(eligibleBase, 4000) === 'no_reversal'
);
const noRec = mockSquatGate({ blocked: 'not_standing_recovered', phase: 'recovered' });
ok(
  'D2: not_standing_recovered → no_recovery',
  deriveSquatAmbiguousRetryReason(noRec, 4000) === 'no_recovery'
);

console.log('\nE. framing hard fail ineligible');
const framing = mockSquatGate({
  phase: 'descending_confirmed',
  failureReasons: ['framing_invalid'],
});
ok('E1: framing_invalid ineligible', !isSquatAmbiguousRetryEligible(framing, 4000));

console.log('\nF. Regression — completion truth + auto-progress negatives');
function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
}
const shallowSynthetic = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom',
      'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ]
  )
);
ok(
  'F1: shallow full cycle completion (synthetic, same as PR-7 A1)',
  shallowSynthetic.completionSatisfied === true && shallowSynthetic.evidenceLabel === 'low_rom'
);

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}
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
function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}
function squatStats(landmarks) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs: 2500,
    timestampDiscontinuityCount: 0,
  };
}
const descendOnlyLandmarks = toLandmarks([
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.02 + i * 0.02)),
  ...Array(8).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.1 + i * 0.08)),
]);
const descendGate = evaluateExerciseAutoProgress('squat', descendOnlyLandmarks, squatStats(descendOnlyLandmarks));
ok('F2: descend-only no completion', descendGate.completionSatisfied === false);

const setupCrouchLandmarks = toLandmarks(
  Array(12).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.25 + i * 0.01))
);
const setupGate = evaluateExerciseAutoProgress('squat', setupCrouchLandmarks, squatStats(setupCrouchLandmarks));
ok('F3: setup crouch no completion', setupGate.completionSatisfied === false);

const tinyDipLandmarks = toLandmarks([
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.01)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.025 + i * 0.003)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(740 + i * 80, 0.02 - i * 0.002)),
]);
const tinyGate = evaluateExerciseAutoProgress('squat', tinyDipLandmarks, squatStats(tinyDipLandmarks));
ok('F4: tiny dip no completion', tinyGate.completionSatisfied === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
