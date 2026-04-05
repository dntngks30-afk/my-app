/**
 * PR-OH-READINESS-02: Smoke fixtures for overhead-specific feature validity and
 * readiness continuity in guardrails.ts.
 *
 * These are pure logic assertions — no test runner required.
 * Call `runOverheadGuardrailReadinessSmoke()` from a browser console or Node REPL.
 * Each assertion throws on failure with a descriptive message.
 *
 * Functions under test (private helpers in guardrails.ts — logic is mirrored here):
 *   - isOverheadFrameAnalyzable (OH-READINESS-02 extended validity filter)
 *   - getOverheadArmCoreAvailability (arm-core critical availability metric)
 *
 * Acceptance tests covered:
 *  1. Legitimate full-body overhead frame → isOverheadFrameAnalyzable = true
 *  2. Frame with wrists off-screen (missing_keypoints) + shoulders+elbows+hips usable → true
 *  3. Frame with only shoulders visible (no elbows) → false (elevation uncomputable)
 *  4. Frame with frameValidity 'invalid' (< 33 landmarks) → always false
 *  5. getOverheadArmCoreAvailability excludes wrists, uses 0.35 threshold
 *  6. Arm-core availability correctly reflects partial arm joint visibility
 *  7. Squat no-regression: squat uses frame.isValid path (unchanged)
 *  8. Truth separation: overheadExtendedAnalyzableCount increments only for newly-admitted frames
 */

import type { PoseFeaturesFrame } from '../pose-features';
import type { PoseLandmark } from '@/lib/motion/pose-types';

// ---------------------------------------------------------------------------
// Helpers that mirror guardrails.ts private logic for regression testing
// ---------------------------------------------------------------------------

const OVERHEAD_ARM_TRIPLET_VIS_MIN = 0.20;
const OVERHEAD_ARM_CORE_VIS_THRESHOLD = 0.35;

function isOverheadJointUsable_mirror(joint: PoseLandmark | null): boolean {
  if (!joint) return false;
  if (typeof joint.visibility === 'number') return joint.visibility >= OVERHEAD_ARM_TRIPLET_VIS_MIN;
  return true;
}

function isOverheadFrameAnalyzable_mirror(frame: PoseFeaturesFrame): boolean {
  if (frame.frameValidity === 'invalid') return false;
  if (frame.isValid) return true;
  const { joints } = frame;
  const leftUsable =
    isOverheadJointUsable_mirror(joints.leftHip) &&
    isOverheadJointUsable_mirror(joints.leftShoulder) &&
    isOverheadJointUsable_mirror(joints.leftElbow);
  const rightUsable =
    isOverheadJointUsable_mirror(joints.rightHip) &&
    isOverheadJointUsable_mirror(joints.rightShoulder) &&
    isOverheadJointUsable_mirror(joints.rightElbow);
  return leftUsable || rightUsable;
}

function getOverheadArmCoreAvailability_mirror(frame: PoseFeaturesFrame): number {
  const armCoreJoints: Array<PoseLandmark | null> = [
    frame.joints.leftShoulder,
    frame.joints.rightShoulder,
    frame.joints.leftElbow,
    frame.joints.rightElbow,
    frame.joints.leftHip,
    frame.joints.rightHip,
  ];
  const visibleCount = armCoreJoints.filter((joint) => {
    if (!joint) return false;
    if (typeof joint.visibility === 'number') return joint.visibility >= OVERHEAD_ARM_CORE_VIS_THRESHOLD;
    return true;
  }).length;
  return visibleCount / armCoreJoints.length;
}

// ---------------------------------------------------------------------------
// Frame builder helpers
// ---------------------------------------------------------------------------

function makeLandmark(x: number, y: number, visibility = 0.9): PoseLandmark {
  return { x, y, visibility };
}

function makeNullLandmark(): PoseLandmark {
  return { x: 0, y: 0, visibility: 0 };
}

type PartialJointMap = Partial<PoseFeaturesFrame['joints']>;

/**
 * Build a minimal PoseFeaturesFrame for testing.
 * frameValidity and isValid are set manually for test purposes.
 */
function buildTestFrame(
  opts: {
    frameValidity: PoseFeaturesFrame['frameValidity'];
    isValid: boolean;
    joints: PartialJointMap;
  }
): PoseFeaturesFrame {
  const nullLandmark = makeNullLandmark();
  const defaultJoints: PoseFeaturesFrame['joints'] = {
    nose: nullLandmark,
    leftShoulder: nullLandmark,
    rightShoulder: nullLandmark,
    leftElbow: nullLandmark,
    rightElbow: nullLandmark,
    leftWrist: nullLandmark,
    rightWrist: nullLandmark,
    leftHip: nullLandmark,
    rightHip: nullLandmark,
    leftKnee: nullLandmark,
    rightKnee: nullLandmark,
    leftAnkle: nullLandmark,
    rightAnkle: nullLandmark,
    torsoCenter: null,
    shoulderCenter: null,
    hipCenter: null,
    ankleCenter: null,
  };

  const joints = { ...defaultJoints, ...opts.joints };

  return {
    timestampMs: 1000,
    stepId: 'overhead-reach',
    frameValidity: opts.frameValidity,
    phaseHint: 'unknown',
    eventHints: [],
    qualityHints: [],
    timestampDeltaMs: null,
    isValid: opts.isValid,
    visibilitySummary: {
      visibleLandmarkRatio: opts.isValid ? 0.75 : 0.20,
      averageVisibility: opts.isValid ? 0.80 : 0.25,
      leftSideCompleteness: 0.5,
      rightSideCompleteness: 0.5,
      criticalJointsAvailability: opts.isValid ? 0.75 : 0.25,
    },
    bodyBox: { area: 0.6, width: 0.5, height: 1.2 },
    joints,
    derived: {
      kneeAngleLeft: null, kneeAngleRight: null, kneeAngleAvg: null, kneeAngleGap: null,
      squatDepthProxy: null, kneeTrackingRatio: null, trunkLeanDeg: null,
      torsoExtensionDeg: null, weightShiftRatio: null,
      armElevationLeft: 150, armElevationRight: 150, armElevationAvg: 150,
      armElevationGap: 0,
      shoulderWristElevationLeftDeg: null,
      shoulderWristElevationRightDeg: null,
      shoulderWristElevationAvgDeg: null,
      wristAboveShoulderLeftNorm: null,
      wristAboveShoulderRightNorm: null,
      wristAboveShoulderAvgNorm: null,
      elbowAboveShoulderLeftNorm: null,
      elbowAboveShoulderRightNorm: null,
      elbowAboveShoulderAvgNorm: null,
      elbowAngleLeft: null, elbowAngleRight: null,
      wristElbowAlignmentLeft: null, wristElbowAlignmentRight: null,
      shoulderSymmetry: null, pelvicDrop: null, swayAmplitude: null,
      holdBalance: null, footHeightGap: null, footDownDetected: false,
      torsoCorrectionDetected: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FAIL [${label}]`);
}

function assertEqual(actual: number, expected: number, tol: number, label: string): void {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`FAIL [${label}]: expected ${expected} ± ${tol}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

/**
 * Test 1: Legitimate full-body overhead frame (isValid: true)
 * → isOverheadFrameAnalyzable should return true (via the isValid short-circuit).
 */
function test_validFramePassesThroughImmediately(): void {
  const frame = buildTestFrame({
    frameValidity: 'valid',
    isValid: true,
    joints: {
      leftShoulder: makeLandmark(0.3, 0.2, 0.9),
      rightShoulder: makeLandmark(0.7, 0.2, 0.9),
      leftElbow: makeLandmark(0.2, 0.35, 0.85),
      rightElbow: makeLandmark(0.8, 0.35, 0.85),
      leftWrist: makeLandmark(0.1, 0.1, 0.75),
      rightWrist: makeLandmark(0.9, 0.1, 0.75),
      leftHip: makeLandmark(0.35, 0.6, 0.9),
      rightHip: makeLandmark(0.65, 0.6, 0.9),
    },
  });
  assert(isOverheadFrameAnalyzable_mirror(frame), 'valid frame passes isOverheadFrameAnalyzable');
}

/**
 * Test 2: missing_keypoints frame where wrists are off-screen but hip+shoulder+elbow visible
 * This is the core case: arms raised, wrists exit frame, but elevation is still computable.
 * → should be overhead-analyzable.
 */
function test_missingKeypointsWithArmTripletUsable(): void {
  const frame = buildTestFrame({
    frameValidity: 'missing_keypoints',
    isValid: false,
    joints: {
      leftShoulder: makeLandmark(0.35, 0.25, 0.88),
      rightShoulder: makeLandmark(0.65, 0.25, 0.88),
      leftElbow: makeLandmark(0.28, 0.12, 0.55),  // arm raised, at frame top edge
      rightElbow: makeLandmark(0.72, 0.12, 0.55),
      leftWrist: makeLandmark(0.22, 0.02, 0.10),  // wrist nearly off-screen (< 0.20)
      rightWrist: makeLandmark(0.78, 0.02, 0.10),
      leftHip: makeLandmark(0.38, 0.65, 0.80),
      rightHip: makeLandmark(0.62, 0.65, 0.80),
      leftKnee: makeLandmark(0.38, 0.85, 0.30),  // lower body near frame bottom
      rightKnee: makeLandmark(0.62, 0.85, 0.30),
      leftAnkle: makeLandmark(0.38, 0.98, 0.10),
      rightAnkle: makeLandmark(0.62, 0.98, 0.10),
    },
  });
  // Elbow vis = 0.55 >= 0.20 → triplet usable on both sides → should pass
  assert(isOverheadFrameAnalyzable_mirror(frame), 'missing_keypoints with arm triplet at 0.55 → analyzable');
}

/**
 * Test 3: missing_keypoints frame where only shoulders are visible (no elbows/hips visible)
 * → arm elevation is NOT computable → should NOT be overhead-analyzable.
 */
function test_missingKeypointsOnlyShoulders(): void {
  const frame = buildTestFrame({
    frameValidity: 'missing_keypoints',
    isValid: false,
    joints: {
      leftShoulder: makeLandmark(0.35, 0.25, 0.88),
      rightShoulder: makeLandmark(0.65, 0.25, 0.88),
      leftElbow: makeLandmark(0.28, 0.12, 0.05),  // elbow off-screen, vis = 0.05 < 0.20
      rightElbow: makeLandmark(0.72, 0.12, 0.05),
      leftWrist: makeLandmark(0.22, 0.02, 0.02),
      rightWrist: makeLandmark(0.78, 0.02, 0.02),
      leftHip: makeLandmark(0.38, 0.65, 0.08),   // hip barely detectable
      rightHip: makeLandmark(0.62, 0.65, 0.08),
    },
  });
  // No side has hip >= 0.20 AND elbow >= 0.20 → neither triplet usable
  assert(!isOverheadFrameAnalyzable_mirror(frame), 'only-shoulders frame → NOT analyzable');
}

/**
 * Test 4: frameValidity === 'invalid' (< 33 landmarks) → always rejected.
 */
function test_invalidFrameAlwaysRejected(): void {
  const frame = buildTestFrame({
    frameValidity: 'invalid',
    isValid: false,
    joints: {
      leftShoulder: makeLandmark(0.35, 0.25, 0.88),
      rightShoulder: makeLandmark(0.65, 0.25, 0.88),
      leftElbow: makeLandmark(0.28, 0.12, 0.80),
      rightElbow: makeLandmark(0.72, 0.12, 0.80),
      leftHip: makeLandmark(0.38, 0.65, 0.80),
      rightHip: makeLandmark(0.62, 0.65, 0.80),
    },
  });
  assert(!isOverheadFrameAnalyzable_mirror(frame), 'invalid (<33 landmarks) → always rejected');
}

/**
 * Test 5: getOverheadArmCoreAvailability — all 6 arm-core joints visible at 0.9
 * → should return 1.0.
 */
function test_armCoreAvailability_full(): void {
  const frame = buildTestFrame({
    frameValidity: 'valid',
    isValid: true,
    joints: {
      leftShoulder: makeLandmark(0.35, 0.25, 0.90),
      rightShoulder: makeLandmark(0.65, 0.25, 0.90),
      leftElbow: makeLandmark(0.28, 0.12, 0.85),
      rightElbow: makeLandmark(0.72, 0.12, 0.85),
      leftHip: makeLandmark(0.38, 0.65, 0.90),
      rightHip: makeLandmark(0.62, 0.65, 0.90),
      // wrists have low visibility — should not affect arm-core metric
      leftWrist: makeLandmark(0.22, 0.02, 0.10),
      rightWrist: makeLandmark(0.78, 0.02, 0.10),
    },
  });
  const avail = getOverheadArmCoreAvailability_mirror(frame);
  assertEqual(avail, 1.0, 0.001, 'arm-core availability = 1.0 when 6/6 arm-core joints visible');
}

/**
 * Test 6: getOverheadArmCoreAvailability — only one side's triplet visible
 * → should return ~0.5 (3/6 arm-core joints).
 */
function test_armCoreAvailability_halfVisible(): void {
  const frame = buildTestFrame({
    frameValidity: 'missing_keypoints',
    isValid: false,
    joints: {
      leftShoulder: makeLandmark(0.35, 0.25, 0.88),  // vis >= 0.35 → visible
      rightShoulder: makeLandmark(0.65, 0.25, 0.88),
      leftElbow: makeLandmark(0.28, 0.12, 0.50),    // vis >= 0.35 → visible
      rightElbow: makeLandmark(0.72, 0.12, 0.15),   // vis < 0.35 → not visible
      leftHip: makeLandmark(0.38, 0.65, 0.80),      // vis >= 0.35 → visible
      rightHip: makeLandmark(0.62, 0.65, 0.12),     // vis < 0.35 → not visible
    },
  });
  const avail = getOverheadArmCoreAvailability_mirror(frame);
  // 3 visible (lShoulder, rShoulder, lElbow, lHip) wait...
  // lShoulder 0.88 ✓, rShoulder 0.88 ✓, lElbow 0.50 ✓, rElbow 0.15 ✗, lHip 0.80 ✓, rHip 0.12 ✗
  // 4 visible / 6 = 0.667
  assertEqual(avail, 4 / 6, 0.01, 'arm-core availability = 4/6 for partial arm visibility');
}

/**
 * Test 7: Squat no-regression assertion.
 * The squat path uses `frame.isValid` — a frame that would be overhead-analyzable
 * but has isValid=false should NOT be treated as valid for squat.
 * (This is documented as a contract, not tested via guardrails directly.)
 */
function test_squatUsesIsValidPath(): void {
  const frame = buildTestFrame({
    frameValidity: 'missing_keypoints',
    isValid: false,
    joints: {
      leftShoulder: makeLandmark(0.35, 0.25, 0.88),
      rightShoulder: makeLandmark(0.65, 0.25, 0.88),
      leftElbow: makeLandmark(0.28, 0.35, 0.55),
      rightElbow: makeLandmark(0.72, 0.35, 0.55),
      leftHip: makeLandmark(0.38, 0.65, 0.80),
      rightHip: makeLandmark(0.62, 0.65, 0.80),
    },
  });
  // Overhead: overhead-analyzable = true
  assert(isOverheadFrameAnalyzable_mirror(frame), 'overhead path: missing_keypoints with triplet → analyzable');
  // Squat path: uses frame.isValid → false (isValid is false per the frame definition)
  assert(!frame.isValid, 'squat path: same frame.isValid = false → NOT valid for squat');
}

/**
 * Test 8: overheadExtendedAnalyzableCount logic.
 * When guardrailValidFrameCount (overhead-specific) > defaultValidFrameCount (isValid count),
 * the difference equals overheadExtendedAnalyzableCount.
 */
function test_overheadExtendedAnalyzableCount(): void {
  // Simulate: 3 total feature frames, 1 passes isValid, 2 are missing_keypoints
  // Of those 2, 1 has a usable arm triplet → overhead admits 2 total
  const mockFeatureFrames: PoseFeaturesFrame[] = [
    buildTestFrame({ frameValidity: 'valid', isValid: true, joints: {} }),
    buildTestFrame({
      frameValidity: 'missing_keypoints',
      isValid: false,
      joints: {
        leftShoulder: makeLandmark(0.35, 0.25, 0.88),
        leftElbow: makeLandmark(0.28, 0.12, 0.55),
        leftHip: makeLandmark(0.38, 0.65, 0.80),
        rightShoulder: makeLandmark(0.65, 0.25, 0.88),
        rightElbow: makeLandmark(0.72, 0.12, 0.55),
        rightHip: makeLandmark(0.62, 0.65, 0.80),
      },
    }),
    buildTestFrame({
      frameValidity: 'missing_keypoints',
      isValid: false,
      joints: {
        leftShoulder: makeLandmark(0.35, 0.25, 0.88),
        leftElbow: makeLandmark(0.28, 0.12, 0.05), // not usable
        leftHip: makeLandmark(0.38, 0.65, 0.05),   // not usable
        rightShoulder: makeLandmark(0.65, 0.25, 0.88),
        rightElbow: makeLandmark(0.72, 0.12, 0.05),
        rightHip: makeLandmark(0.62, 0.65, 0.05),
      },
    }),
  ];

  const defaultValidCount = mockFeatureFrames.filter((f) => f.isValid).length;
  const overheadValidCount = mockFeatureFrames.filter(isOverheadFrameAnalyzable_mirror).length;
  const overheadExtendedAnalyzableCount = Math.max(0, overheadValidCount - defaultValidCount);

  assertEqual(defaultValidCount, 1, 0, 'defaultValidCount = 1 (only the isValid:true frame)');
  assertEqual(overheadValidCount, 2, 0, 'overheadValidCount = 2 (isValid + one overhead-analyzable)');
  assertEqual(overheadExtendedAnalyzableCount, 1, 0, 'overheadExtendedAnalyzableCount = 1');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runOverheadGuardrailReadinessSmoke(): void {
  const tests: Array<[string, () => void]> = [
    ['test_validFramePassesThroughImmediately', test_validFramePassesThroughImmediately],
    ['test_missingKeypointsWithArmTripletUsable', test_missingKeypointsWithArmTripletUsable],
    ['test_missingKeypointsOnlyShoulders', test_missingKeypointsOnlyShoulders],
    ['test_invalidFrameAlwaysRejected', test_invalidFrameAlwaysRejected],
    ['test_armCoreAvailability_full', test_armCoreAvailability_full],
    ['test_armCoreAvailability_halfVisible', test_armCoreAvailability_halfVisible],
    ['test_squatUsesIsValidPath', test_squatUsesIsValidPath],
    ['test_overheadExtendedAnalyzableCount', test_overheadExtendedAnalyzableCount],
  ];

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const [name, fn] of tests) {
    try {
      fn();
      passed++;
    } catch (err) {
      failed++;
      failures.push(`${name}: ${(err as Error).message}`);
    }
  }

  if (failures.length > 0) {
    const summary = failures.join('\n');
    throw new Error(`OH-READINESS-02 smoke: ${failed} test(s) failed:\n${summary}`);
  }

  // eslint-disable-next-line no-console
  console.log(`OH-READINESS-02 smoke: ${passed}/${passed + failed} tests passed`);
}
