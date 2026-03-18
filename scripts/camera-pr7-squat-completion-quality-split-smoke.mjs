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

function poseSeries(startTs, depthValues, stepMs = 80) {
  return depthValues.map((depthProxy, i) => squatPoseLandmarks(startTs + i * stepMs, depthProxy));
}

function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
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

// A. Shallow full cycle passes only after standing recovery hold, with low_rom evidence label
const shallowState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start']
  )
);
const shallowLandmarks = toLandmarks(poseSeries(100, [0.01, 0.02, 0.02, 0.01, 0.03, 0.05, 0.07, 0.09, 0.08, 0.06, 0.04, 0.02]));
ok('A1: shallow full cycle can pass after standing recovery', shallowState.completionSatisfied);
ok('A2: shallow success opens only at standing_recovered', shallowState.successPhaseAtOpen === 'standing_recovered');
ok('A3: shallow success keeps low_rom evidence label', shallowState.evidenceLabel === 'low_rom');

// B-PR11. Low-ROM recovery signal: peak 7–10% with 40% recoveryDrop yields lowRomRecovered
const lowRomSyntheticFrames = [0.02, 0.04, 0.08, 0.07, 0.05, 0.04, 0.03].map((d) => ({
  derived: { squatDepthProxy: d },
  isValid: true,
}));
const lowRomRecovery = getSquatRecoverySignal(lowRomSyntheticFrames);
ok('B-PR11: low-ROM recovery signal (peak 8%, recovery 40%) yields lowRomRecovered', lowRomRecovery.lowRomRecovered && lowRomRecovery.peakDepth >= 0.07 && lowRomRecovery.peakDepth < 0.1);

// B-ultra. Ultra-low-ROM recovery signal: peak 2–7% with 50% recoveryDrop yields ultraLowRomRecovered
const ultraLowRomSyntheticFrames = [0.01, 0.02, 0.05, 0.03, 0.02, 0.015, 0.01].map((d) => ({
  derived: { squatDepthProxy: d },
  isValid: true,
}));
const ultraLowRomRecovery = getSquatRecoverySignal(ultraLowRomSyntheticFrames);
ok('B-ultra: ultra-low-ROM recovery signal (peak 5%, recovery 50%+) yields ultraLowRomRecovered', ultraLowRomRecovery.ultraLowRomRecovered && ultraLowRomRecovery.peakDepth >= 0.02 && ultraLowRomRecovery.peakDepth < 0.07);

// B-ultra-valid. Ultra-low-ROM recovery signal (synthetic frames: peak 5%, tail ~1.5%, drop 50%+)
const ultraLowRomValidFrames = [
  ...Array(3).fill(0).map((_, i) => ({ derived: { squatDepthProxy: 0.01 + i * 0.013 }, isValid: true })),
  ...Array(2).fill(0).map(() => ({ derived: { squatDepthProxy: 0.05 }, isValid: true })),
  ...Array(5).fill(0).map((_, i) => ({ derived: { squatDepthProxy: 0.025 - i * 0.004 }, isValid: true })),
];
const ultraLowRomValidRecovery = getSquatRecoverySignal(ultraLowRomValidFrames);
ok('B-ultra-valid: ultra-low-ROM recovery yields ultraLowRomRecovered', ultraLowRomValidRecovery.ultraLowRomRecovered);

// B. Descend-only does not pass
const descendOnlyPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.02 + i * 0.02)),
  ...Array(8).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.1 + i * 0.08)),
];
const descendOnlyLandmarks = toLandmarks(descendOnlyPoses);
const descendOnlyGate = evaluateExerciseAutoProgress('squat', descendOnlyLandmarks, squatStats(descendOnlyLandmarks));
ok('B: descend-only does not pass', !descendOnlyGate.completionSatisfied);

// B2. Mid-ascent must not pass before standing recovery
const midAscentState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.04, 0.07, 0.1, 0.12, 0.11, 0.09, 0.07, 0.05],
    ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent']
  )
);
ok('B2: mid-ascent does not pass before standing recovery', !midAscentState.completionSatisfied);
ok('B3: mid-ascent stays in ascending phase', midAscentState.currentSquatPhase === 'ascending');

// C. Setup crouch does not pass (start in lowered state, no clear start→descent→bottom→ascent)
const setupCrouchPoses = Array(12).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.25 + i * 0.01));
const setupCrouchLandmarks = toLandmarks(setupCrouchPoses);
const setupCrouchGate = evaluateExerciseAutoProgress('squat', setupCrouchLandmarks, squatStats(setupCrouchLandmarks));
ok('C: setup crouch does not pass', !setupCrouchGate.completionSatisfied);

// D-ultra. Micro dip with poor recovery does not pass (peak 4%, recovery < 50%)
const microDipFrames = [0.01, 0.02, 0.04, 0.038, 0.036, 0.034, 0.032].map((d) => ({
  derived: { squatDepthProxy: d },
  isValid: true,
}));
const microDipRecovery = getSquatRecoverySignal(microDipFrames);
ok('D-ultra: micro dip with poor recovery does not yield ultraLowRomRecovered', !microDipRecovery.ultraLowRomRecovered);

// D. Tiny dip does not pass (peak < noise floor)
const tinyDipPoses = [
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(100 + i * 80, 0.01)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(420 + i * 80, 0.025 + i * 0.003)),
  ...Array(4).fill(0).map((_, i) => squatPoseLandmarks(740 + i * 80, 0.02 - i * 0.002)),
];
const tinyDipLandmarks = toLandmarks(tinyDipPoses);
const tinyDipGate = evaluateExerciseAutoProgress('squat', tinyDipLandmarks, squatStats(tinyDipLandmarks));
ok('D: tiny dip does not pass', !tinyDipGate.completionSatisfied);

// E. Full cycle still required (recovery must be confirmed)
const noRecoveryPoses = poseSeries(100, [
  0.01, 0.02, 0.02, 0.01,
  0.05, 0.08, 0.12, 0.16,
  0.18, 0.16, 0.14, 0.12,
]);
const noRecoveryLandmarks = toLandmarks(noRecoveryPoses);
const noRecoveryGate = evaluateExerciseAutoProgress('squat', noRecoveryLandmarks, squatStats(noRecoveryLandmarks));
ok('E: full cycle required (no recovery = no pass)', !noRecoveryGate.completionSatisfied);

// F. Quality remains separate (shallow can be marked shallow in quality)
const shallowFrames = buildPoseFeaturesFrames('squat', shallowLandmarks);
const shallowResult = evaluateSquatFromPoseFrames(shallowFrames);
const depthBand = shallowResult.debug?.highlightedMetrics?.depthBand ?? -1;
ok('F: quality depthBand exists and can be shallow (0)', depthBand >= 0 && depthBand <= 2);

// G. Deep squat still passes with the same final-state contract
const deepState = evaluateSquatCompletionState(
  syntheticStateFrames(
    [0.01, 0.01, 0.01, 0.01, 0.05, 0.1, 0.16, 0.22, 0.24, 0.2, 0.14, 0.08, 0.03, 0.01, 0.01],
    ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start']
  )
);
const deepGate = evaluateExerciseAutoProgress('squat', shallowLandmarks, squatStats(shallowLandmarks));
ok('G1: deep squat still passes', deepState.completionSatisfied);
ok('G2: deep squat uses standard evidence label', deepState.evidenceLabel === 'standard');
ok('G3: gate returns valid structure (squatCycleDebug present)', !!deepGate.squatCycleDebug);

// H: Recovery signal uses 0.12 threshold (not 0.15) — unit test with synthetic depth
const syntheticFrames = [0.03, 0.06, 0.1, 0.15, 0.18, 0.2, 0.18, 0.12, 0.08, 0.04].map((d, i) => ({
  derived: { squatDepthProxy: d },
  isValid: true,
}));
const recovery = getSquatRecoverySignal(syntheticFrames);
ok('H: recovery allows peakDepth >= 0.10 (PR G9 shallower cycle)', recovery.peakDepth >= 0.1 && recovery.recovered);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
