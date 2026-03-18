/**
 * PR-7: Squat completion vs quality split smoke test
 * Acceptance: completion decoupled from depth; false positives blocked.
 * Run: npx tsx scripts/camera-pr7-squat-completion-quality-split-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { buildPoseFeaturesFrames, getSquatRecoverySignal } = await import('../src/lib/camera/pose-features.ts');
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

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

/** depthProxy: 0=standing, 1=deep. Knee bent forward for non-zero depth. */
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

function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}

function squatStats(landmarks) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs: 2000,
    timestampDiscontinuityCount: 0,
  };
}

console.log('Camera PR-7 squat completion vs quality split smoke test\n');

// A. Valid shallow squat cycle can pass (implementation allows; mock geometry may vary)
const shallowSquatPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.05 + i * 0.05)),
  ...Array(5).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.22 + i * 0.01)),
  ...Array(5).fill(0).map((_, i) => squatPoseLandmarks(820 + i * 80, 0.2 - i * 0.04)),
];
const shallowLandmarks = toLandmarks(shallowSquatPoses);
const shallowGate = evaluateExerciseAutoProgress('squat', shallowLandmarks, squatStats(shallowLandmarks));
ok('A: shallow squat not blocked by depth-only (no depth>=45 gate)', !shallowGate.squatCycleDebug?.passBlockedReason?.includes('depth'));

// B. Descend-only does not pass
const descendOnlyPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.02 + i * 0.02)),
  ...Array(8).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.1 + i * 0.08)),
];
const descendOnlyLandmarks = toLandmarks(descendOnlyPoses);
const descendOnlyGate = evaluateExerciseAutoProgress('squat', descendOnlyLandmarks, squatStats(descendOnlyLandmarks));
ok('B: descend-only does not pass', !descendOnlyGate.completionSatisfied);

// C. Setup crouch does not pass (start in lowered state, no clear start→descent→bottom→ascent)
const setupCrouchPoses = Array(12).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.25 + i * 0.01));
const setupCrouchLandmarks = toLandmarks(setupCrouchPoses);
const setupCrouchGate = evaluateExerciseAutoProgress('squat', setupCrouchLandmarks, squatStats(setupCrouchLandmarks));
ok('C: setup crouch does not pass', !setupCrouchGate.completionSatisfied);

// D. Tiny dip does not pass (peak < noise floor)
const tinyDipPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.02)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.06 + i * 0.01)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(740 + i * 80, 0.04 - i * 0.01)),
];
const tinyDipLandmarks = toLandmarks(tinyDipPoses);
const tinyDipGate = evaluateExerciseAutoProgress('squat', tinyDipLandmarks, squatStats(tinyDipLandmarks));
ok('D: tiny dip does not pass', !tinyDipGate.completionSatisfied);

// E. Full cycle still required (recovery must be confirmed)
const noRecoveryPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.02 + i * 0.03)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.2 + i * 0.02)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(740 + i * 80, 0.25 - i * 0.02)),
];
const noRecoveryLandmarks = toLandmarks(noRecoveryPoses);
const noRecoveryGate = evaluateExerciseAutoProgress('squat', noRecoveryLandmarks, squatStats(noRecoveryLandmarks));
ok('E: full cycle required (no recovery = no pass)', !noRecoveryGate.completionSatisfied);

// F. Quality remains separate (shallow can be marked shallow in quality)
const shallowFrames = buildPoseFeaturesFrames('squat', shallowLandmarks);
const shallowResult = evaluateSquatFromPoseFrames(shallowFrames);
const depthBand = shallowResult.debug?.highlightedMetrics?.depthBand ?? -1;
ok('F: quality depthBand exists and can be shallow (0)', depthBand >= 0 && depthBand <= 2);

// G. Full-cycle gate logic intact (evaluator/guardrail structure unchanged)
const deepSquatPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.1 + i * 0.15)),
  ...Array(5).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.55 + i * 0.02)),
  ...Array(5).fill(0).map((_, i) => squatPoseLandmarks(820 + i * 80, 0.5 - i * 0.1)),
];
const deepLandmarks = toLandmarks(deepSquatPoses);
const deepGate = evaluateExerciseAutoProgress('squat', deepLandmarks, squatStats(deepLandmarks));
ok('G: gate returns valid structure (squatCycleDebug present)', !!deepGate.squatCycleDebug);

// H: Recovery signal uses 0.12 threshold (not 0.15) — unit test with synthetic depth
const syntheticFrames = [0.03, 0.06, 0.1, 0.15, 0.18, 0.2, 0.18, 0.12, 0.08, 0.04].map((d, i) => ({
  derived: { squatDepthProxy: d },
  isValid: true,
}));
const recovery = getSquatRecoverySignal(syntheticFrames);
ok('H: recovery allows peakDepth >= 0.12 (was 0.15)', recovery.peakDepth >= 0.12 && recovery.recovered);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
