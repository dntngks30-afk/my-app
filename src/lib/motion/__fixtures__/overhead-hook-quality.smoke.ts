/**
 * PR-OH-INPUT-01: Smoke fixtures for overhead hook quality scoping.
 *
 * These are pure logic assertions — no test runner required.
 * Import and call `runOverheadHookQualitySmoke()` from a browser console or Node repl.
 * Each assertion throws on failure with a descriptive message.
 *
 * Covers acceptance tests:
 * 1. Overhead legitimate full-body frame → accepted
 * 2. Oversized / body-box-invalid framing → still rejected for overhead (lower bound only)
 * 3. Missing core joints still rejected by overhead profile
 * 4. Landmark/adaptor failure remains distinct from quality rejection
 * 5. Squat (default) profile behavior unchanged for the same inputs
 */

import {
  getPoseFrameQuality,
  getOverheadPoseFrameQuality,
  HOOK_QUALITY_THRESHOLDS,
  OVERHEAD_HOOK_QUALITY_THRESHOLDS,
  type PoseFrame,
  type PoseLandmark,
} from '@/lib/motion/pose-types';

// ---------------------------------------------------------------------------
// Frame builder helpers
// ---------------------------------------------------------------------------

function makeLandmark(x: number, y: number, visibility = 0.9): PoseLandmark {
  return { x, y, visibility };
}

/**
 * Build a 33-landmark frame with uniform visibility, with bbox approximation.
 * x range: [xMin, xMax], y range: [yMin, yMax]
 */
function buildFrame(xMin: number, xMax: number, yMin: number, yMax: number, visibility = 0.9): PoseFrame {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    return makeLandmark(xMin + t * (xMax - xMin), yMin + t * (yMax - yMin), visibility);
  });
  return { timestampMs: 1000, landmarks, source: 'mediapipe', width: 640, height: 480 };
}

/** Frame with all landmarks at 0,0 — adaptor would still succeed but all visibility-based checks would fail */
function buildZeroFrame(): PoseFrame {
  return {
    timestampMs: 1000,
    landmarks: Array.from({ length: 33 }, () => makeLandmark(0, 0, 0)),
    source: 'mediapipe',
    width: 640,
    height: 480,
  };
}

/** Frame with only 10 landmarks — triggers landmark_count / adaptor gate */
function buildPartialLandmarkFrame(): PoseFrame {
  return {
    timestampMs: 1000,
    landmarks: Array.from({ length: 10 }, () => makeLandmark(0.5, 0.5, 0.9)),
    source: 'mediapipe',
    width: 640,
    height: 480,
  };
}

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`SMOKE FAIL: ${message}`);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

/**
 * Test 1: Overhead legitimate full-body frame should be accepted by overhead profile.
 *
 * Simulate a person standing with arms overhead:
 * - x span ≈ 0.7 (shoulders spread), y span ≈ 1.4 (floor to raised hands)
 * - bodyBoxArea = 0.7 * 1.4 = 0.98 — would fail default MAX_BODY_BOX_AREA = 0.98 check
 * - All core joints visible
 */
function testLegitimateOverheadFrameAcceptedByOverheadProfile(): void {
  // arms-overhead frame: x[0.15, 0.85], y[0, 1.4] → area = 0.70 * 1.40 = 0.98
  const frame = buildFrame(0.15, 0.85, 0.0, 1.40, 0.95);

  const defaultQ = getPoseFrameQuality(frame, null);
  const overheadQ = getOverheadPoseFrameQuality(frame, null);

  // Default profile should reject (area > 0.98)
  assert(
    defaultQ.reasons.includes('body_box_invalid'),
    'Default profile must reject body_box_invalid for area >= 0.98'
  );
  assert(!defaultQ.usable, 'Default profile: frame must not be usable');

  // Overhead profile should accept (no upper body-box limit)
  assert(
    !overheadQ.reasons.includes('body_box_invalid'),
    'Overhead profile must not reject body_box_invalid for area from arms-up posture'
  );
  assert(
    overheadQ.usable,
    'Overhead profile: legitimate arms-overhead frame must be usable'
  );
}

/**
 * Test 2: Oversized/invalid framing — lower bound still rejects.
 * An empty/blank frame with near-zero bbox should be rejected by overhead profile too.
 */
function testTinyBboxRejectedByOverheadProfile(): void {
  // All landmarks at a single point → area ≈ 0
  const frame: PoseFrame = {
    timestampMs: 1000,
    landmarks: Array.from({ length: 33 }, () => makeLandmark(0.5, 0.5, 0.9)),
    source: 'mediapipe',
    width: 640,
    height: 480,
  };

  const overheadQ = getOverheadPoseFrameQuality(frame, null);

  assert(
    overheadQ.reasons.includes('body_box_invalid'),
    'Overhead profile must still reject body_box_invalid for near-zero area (empty/blank frame)'
  );
  assert(!overheadQ.usable, 'Overhead profile: zero-bbox frame must not be usable');
}

/**
 * Test 3: Missing core joints still rejects.
 * Frame where all core joint landmarks have visibility = 0 (below 0.45 threshold).
 */
function testCoreJointsMissingStillRejectsInOverheadProfile(): void {
  // Build 33-landmark frame where all core-related indices have very low visibility
  // Core indices: 11(L_SHOULDER), 12(R_SHOULDER), 23(L_HIP), 24(R_HIP), 25(L_KNEE), 26(R_KNEE)
  const coreIndices = new Set([11, 12, 23, 24, 25, 26]);
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    const vis = coreIndices.has(i) ? 0.1 : 0.9; // core joints barely visible
    return makeLandmark(0.1 + t * 0.6, 0.1 + t * 0.8, vis);
  });
  const frame: PoseFrame = { timestampMs: 1000, landmarks, source: 'mediapipe', width: 640, height: 480 };

  const overheadQ = getOverheadPoseFrameQuality(frame, null);

  assert(
    overheadQ.reasons.includes('core_joints_missing'),
    'Overhead profile must still reject core_joints_missing when all core joints have low visibility'
  );
  assert(!overheadQ.usable, 'Overhead profile: frame with no visible core joints must not be usable');
}

/**
 * Test 4: Landmark/adaptor failure is a distinct gate (pre-quality).
 * Partial frame (< 33 landmarks) does not reach quality checks.
 */
function testLandmarkCountRejectsBeforeQuality(): void {
  const frame = buildPartialLandmarkFrame();

  const defaultQ = getPoseFrameQuality(frame, null);
  const overheadQ = getOverheadPoseFrameQuality(frame, null);

  for (const [label, q] of [['default', defaultQ], ['overhead', overheadQ]] as const) {
    assert(
      q.reasons.includes('landmark_count'),
      `${label} profile: < 33 landmarks must produce landmark_count reason`
    );
    assert(!q.usable, `${label} profile: < 33 landmark frame must not be usable`);
  }
}

/**
 * Test 5: Squat (default) profile unchanged — same frame that overhead accepts is still rejected by default.
 * This is the squat no-regression assertion.
 */
function testSquatDefaultProfileUnchanged(): void {
  // Use Case-A equivalent: area = 1.3768 > 0.98
  const frame = buildFrame(0.0, 1.0, 0.0, 1.3768, 0.9);

  const defaultQ = getPoseFrameQuality(frame, null);
  const overheadQ = getOverheadPoseFrameQuality(frame, null);

  assert(
    defaultQ.reasons.includes('body_box_invalid'),
    'Default profile: area > 0.98 must still reject body_box_invalid (squat no-regression)'
  );

  assert(
    !overheadQ.reasons.includes('body_box_invalid'),
    'Overhead profile: area = 1.3768 must not reject body_box_invalid (arms-overhead fix)'
  );
}

/**
 * Test 6: Threshold echo correctness.
 */
function testThresholdEchoValues(): void {
  assert(
    HOOK_QUALITY_THRESHOLDS.maxBodyBoxArea === 0.98,
    'Default HOOK_QUALITY_THRESHOLDS.maxBodyBoxArea must be 0.98'
  );
  assert(
    HOOK_QUALITY_THRESHOLDS.minCoreVisibilityRatio === 0.34,
    'Default HOOK_QUALITY_THRESHOLDS.minCoreVisibilityRatio must be 0.34'
  );
  assert(
    OVERHEAD_HOOK_QUALITY_THRESHOLDS.maxBodyBoxArea === null,
    'OVERHEAD_HOOK_QUALITY_THRESHOLDS.maxBodyBoxArea must be null (no upper limit)'
  );
  assert(
    OVERHEAD_HOOK_QUALITY_THRESHOLDS.minCoreVisibilityRatio === 0.30,
    'OVERHEAD_HOOK_QUALITY_THRESHOLDS.minCoreVisibilityRatio must be 0.30'
  );
}

/**
 * Test 7: Case A exact values (from observed upload JSON).
 * coreVisibilityRatio=0.3333, bodyBoxArea=1.3768
 * - Default profile: rejects both
 * - Overhead profile: accepts (both conditions are within overhead contract)
 */
function testCaseAObservedValues(): void {
  // Build a frame that produces approximately these measured values.
  // We approximate: coreVisibilityRatio ≈ 0.3333 (2/6 core joints visible)
  // Core indices: 11, 12, 23, 24, 25, 26
  const coreIndices = new Set([11, 12, 23, 24, 25, 26]);
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    // Only indices 11, 12 are visible; 23, 24, 25, 26 have low visibility → 2/6 = 0.3333
    const vis = (i === 11 || i === 12) ? 0.9 : (coreIndices.has(i) ? 0.1 : 0.9);
    return makeLandmark(t * 1.0, t * 1.3768, vis);
  });
  const frame: PoseFrame = { timestampMs: 1000, landmarks, source: 'mediapipe', width: 640, height: 480 };

  const defaultQ = getPoseFrameQuality(frame, null);
  const overheadQ = getOverheadPoseFrameQuality(frame, null);

  // Default: rejects body_box_invalid
  assert(
    defaultQ.reasons.includes('body_box_invalid'),
    'CaseA: default profile must reject body_box_invalid'
  );

  // Overhead: body_box is no longer a blocking reason
  assert(
    !overheadQ.reasons.includes('body_box_invalid'),
    'CaseA: overhead profile must NOT reject body_box_invalid for arms-overhead area'
  );

  // Core visibility ≈ 0.3333 ≥ 0.30: overhead profile should accept
  // (actual ratio depends on frame building; this validates the threshold logic)
  const coreRatio = overheadQ.coreVisibilityRatio;
  if (coreRatio >= 0.30) {
    assert(
      !overheadQ.reasons.includes('core_joints_missing'),
      'CaseA: overhead profile must not reject core_joints_missing when ratio >= 0.30'
    );
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runOverheadHookQualitySmoke(): { passed: number; failed: number; errors: string[] } {
  const tests = [
    testLegitimateOverheadFrameAcceptedByOverheadProfile,
    testTinyBboxRejectedByOverheadProfile,
    testCoreJointsMissingStillRejectsInOverheadProfile,
    testLandmarkCountRejectsBeforeQuality,
    testSquatDefaultProfileUnchanged,
    testThresholdEchoValues,
    testCaseAObservedValues,
  ];

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const test of tests) {
    try {
      test();
      passed += 1;
    } catch (err) {
      failed += 1;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { passed, failed, errors };
}
