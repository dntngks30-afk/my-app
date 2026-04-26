/**
 * PR-V2-INPUT-05C — Wrong-window recovery trigger + independent lower-body evidence gate.
 *
 * Run: npx tsx scripts/camera-squat-v2-05c-wrong-window-recovery-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

const {
  resolveShallowV2RecoveryAttempt,
  shouldAttemptShallowV2Recovery,
  hasIndependentLowerBodyEvidence,
  TRIGGER_USABLE_CURVE_WRONG_WINDOW,
  WRONG_WINDOW_NO_INDEPENDENT_LOWER_BODY_EVIDENCE,
  buildWrongWindowSkippedRecoveryDiagnostics,
  TRIGGER_PR05_SOURCE_NONE_OR_UNUSABLE,
} = await import('../src/lib/camera/squat/squat-v2-shallow-recovery-window.ts');

let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? `: ${detail}` : ''}`);
  }
}

/** Minimal validRaw-like frames: flat depth / tiny hip → no independent evidence */
function stubFlatValidRaw(n = 80) {
  return Array.from({ length: n }, (_, i) => ({
    timestampMs: i * 33,
    isValid: true,
    phaseHint: 'descent',
    frameValidity: 'valid',
    stepId: 'squat',
    eventHints: [],
    qualityHints: [],
    timestampDeltaMs: 33,
    visibilitySummary: {
      visibleLandmarkRatio: 1,
      averageVisibility: 1,
      leftSideCompleteness: 1,
      rightSideCompleteness: 1,
      criticalJointsAvailability: 1,
    },
    bodyBox: { area: 1, width: 1, height: 1 },
    joints: {
      nose: null,
      leftEar: null,
      rightEar: null,
      leftShoulder: { x: 0.5, y: 0.35, visibility: 0.9 },
      rightShoulder: { x: 0.5, y: 0.35, visibility: 0.9 },
      leftElbow: null,
      rightElbow: null,
      leftWrist: null,
      rightWrist: null,
      leftHip: { x: 0.48, y: 0.52, visibility: 0.9 },
      rightHip: { x: 0.52, y: 0.52, visibility: 0.9 },
      leftKnee: null,
      rightKnee: null,
      leftAnkle: null,
      rightAnkle: null,
      torsoCenter: null,
      shoulderCenter: { x: 0.5, y: 0.35, visibility: 0.9 },
      hipCenter: { x: 0.5, y: 0.52, visibility: 0.9 },
      ankleCenter: null,
    },
    derived: {
      squatDepthProxy: 0.005,
      squatDepthProxyBlended: 0.005,
      squatDepthProxyRaw: 0.005,
    },
  }));
}

const wrongWindowOwned = {
  selectedDepthSource: 'hip_center_baseline',
  depthCurveUsable: true,
  finiteButUselessDepthRejected: false,
  sourceStats: { hip_center_baseline: {} },
  legacyDepthSelection: null,
  v2InputSwitchReason: null,
  frames: [],
};

const wrongWindowDecision = {
  usableMotionEvidence: false,
  motionPattern: 'upper_body_only',
  blockReason: 'lower_body_motion_not_dominant',
  romBand: 'micro',
  qualityWarnings: [],
  evidence: {},
  metrics: {
    peakFrameIndex: 0,
    descentStartFrameIndex: 0,
    relativePeak: 0.016,
    v2LowerUpperMotionRatio: 0.54,
    framesAfterPeak: 40,
    peakDistanceFromTailFrames: 40,
    inputFrameCount: 64,
  },
};

console.log('\nPR-V2-INPUT-05C wrong-window recovery smoke\n');

{
  const flat = stubFlatValidRaw(80);
  const ev = hasIndependentLowerBodyEvidence(flat);
  ok('05C: flat stub has no independent lower-body evidence', ev.ok === false, ev.reason);
}

{
  const r = resolveShallowV2RecoveryAttempt({
    validRaw: stubFlatValidRaw(80),
    validRawLength: 80,
    decision: wrongWindowDecision,
    owned: wrongWindowOwned,
    v2EvalFrameCount: 64,
  });
  ok('05C: wrong-window resolution non-null', r != null);
  ok('05C: wrongWindowDetected true', r?.wrongWindowDetected === true);
  ok('05C: triggerReason usable_curve_wrong_window', r?.triggerReason === TRIGGER_USABLE_CURVE_WRONG_WINDOW);
  ok('05C: shouldRunSlidingSearch false without evidence', r?.shouldRunSlidingSearch === false);
  ok('05C: independent evidence false', r?.independentLowerBodyEvidence === false);
}

{
  const r = resolveShallowV2RecoveryAttempt({
    validRaw: stubFlatValidRaw(80),
    validRawLength: 80,
    decision: wrongWindowDecision,
    owned: wrongWindowOwned,
    v2EvalFrameCount: 64,
  });
  const diag = buildWrongWindowSkippedRecoveryDiagnostics(r, wrongWindowDecision);
  ok('05C: skipped diag attempted true', diag.attempted === true);
  ok('05C: skipped diag applied false', diag.applied === false);
  ok(
    '05C: skipped diag blockedReason',
    diag.blockedReason === WRONG_WINDOW_NO_INDEPENDENT_LOWER_BODY_EVIDENCE
  );
}

{
  ok(
    '05C: shouldAttempt false when wrong-window but no evidence',
    !shouldAttemptShallowV2Recovery({
      validRaw: stubFlatValidRaw(80),
      validRawLength: 80,
      decision: wrongWindowDecision,
      owned: wrongWindowOwned,
      v2EvalFrameCount: 64,
    })
  );
}

{
  const ownedNone = {
    selectedDepthSource: 'none',
    depthCurveUsable: false,
    finiteButUselessDepthRejected: true,
    sourceStats: { none: {} },
    legacyDepthSelection: null,
    v2InputSwitchReason: null,
    frames: [],
  };
  const decision = {
    usableMotionEvidence: false,
    blockReason: 'no_reversal',
    metrics: {
      peakFrameIndex: 4,
      inputFrameCount: 20,
      framesAfterPeak: 5,
      peakDistanceFromTailFrames: 10,
    },
  };
  const r = resolveShallowV2RecoveryAttempt({
    validRaw: stubFlatValidRaw(80),
    validRawLength: 80,
    decision,
    owned: ownedNone,
    v2EvalFrameCount: 20,
  });
  ok('05C: legacy PR05 still resolves', r != null);
  ok('05C: legacy shouldRunSlidingSearch true', r.shouldRunSlidingSearch === true);
  ok('05C: legacy trigger reason', r.triggerReason === TRIGGER_PR05_SOURCE_NONE_OR_UNUSABLE);
  ok('05C: legacy wrongWindow false', r.wrongWindowDetected === false);
}

const bundle = [
  'scripts/camera-squat-v2-05b-recovery-safety-lock-smoke.mjs',
  'scripts/camera-squat-v2-05-shallow-epoch-recovery-smoke.mjs',
  'scripts/camera-squat-v2-04b-runtime-owner-safety-smoke.mjs',
  'scripts/camera-squat-v2-04d-depth-source-alignment-smoke.mjs',
  'scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs',
  'scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs',
  'scripts/camera-squat-v2-04c-peak-tail-window-recovery-smoke.mjs',
];

console.log('\n05C regression bundle:\n');
for (const script of bundle) {
  console.log(`  running ${script}`);
  try {
    execSync(`npx tsx ${script}`, { stdio: 'inherit', cwd: root });
  } catch {
    failed += 1;
    console.error(`  FAIL  bundle: ${script}`);
  }
}

if (failed) {
  console.error(`\n05C smoke: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\n05C smoke: all passed\n');
process.exit(0);
