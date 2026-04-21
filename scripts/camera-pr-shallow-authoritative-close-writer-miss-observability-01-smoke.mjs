/**
 * PR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01
 *
 * Behavior-preserving observability: canonical shallow final writer must emit an explicit
 * miss reason + guard snapshot when it does not apply — no pass/fail semantics change.
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-authoritative-close-writer-miss-observability-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateExerciseAutoProgress,
  computeSquatPostOwnerPreLatchGateLayer,
  readSquatPassOwnerTruth,
  isFinalPassLatched,
} = await import('../src/lib/camera/auto-progression.ts');
const {
  buildCanonicalShallowContractInputFromState,
  mergeCanonicalShallowContractResult,
  applyCanonicalShallowClosureFromContract,
} = await import('../src/lib/camera/squat/squat-completion-canonical.ts');
const {
  deriveCanonicalShallowCompletionContract,
} = await import('../src/lib/camera/squat/shallow-completion-contract.ts');
const {
  deriveSquatCompletionFinalizeMode,
} = await import('../src/lib/camera/squat/squat-completion-core.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}

function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2));
  const depthT = clamp((170 - kneeAngleDeg) / 110);
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY);
  landmarks[12] = mockLandmark(0.58, shoulderY);
  landmarks[23] = mockLandmark(0.44, hipY);
  landmarks[24] = mockLandmark(0.56, hipY);
  landmarks[25] = mockLandmark(0.45, kneeY);
  landmarks[26] = mockLandmark(0.55, kneeY);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02);
  return { landmarks, timestamp };
}

function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}

function squatStats(landmarks, captureDurationMs = 3200) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}

function baseUiGateInputClear() {
  return {
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
  };
}

function passCorePositive() {
  return {
    passDetected: true,
    passBlockedReason: null,
    repId: 'shallow_writer_miss_obs_probe',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'shallow-writer-miss-obs-smoke',
  };
}

function runPostOwnerGate(overrides) {
  const ownerTruth =
    overrides.ownerTruth ??
    readSquatPassOwnerTruth({
      squatCompletionState: overrides.squatCompletionState,
      squatPassCore: overrides.squatPassCore,
    });
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: overrides.uiGateInput ?? baseUiGateInputClear(),
    squatCompletionState: overrides.squatCompletionState,
    squatCycleDebug: overrides.squatCycleDebug ?? {},
    squatPassCore: overrides.squatPassCore,
  });
}

function runOwnerWritePipeline(inputState, options = {}) {
  const contract = deriveCanonicalShallowCompletionContract(
    buildCanonicalShallowContractInputFromState(inputState)
  );
  const merged = mergeCanonicalShallowContractResult(inputState, contract);
  const state = applyCanonicalShallowClosureFromContract(merged, {
    standardOwnerFloor: 0.4,
    deriveSquatCompletionFinalizeMode,
    setupMotionBlocked: options.setupMotionBlocked === true,
  });
  return { state, contract };
}

/** Same base as ownership-recovery smoke: full shallow proof cluster, timing-blocked completion. */
function provenSameRepOwnerResidualState(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'descent_span_too_short',
    cycleComplete: false,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'recovered',

    baselineStandingDepth: 0,
    rawDepthPeak: 0.12,
    relativeDepthPeak: 0.12,
    evidenceLabel: 'low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: 'descent_span_too_short',

    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.12,
    readinessStableDwellSatisfied: true,
    attemptStartedAfterReady: true,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    reversalConfirmedByRuleOrHmm: false,

    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowReversalSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    provenanceReversalEvidencePresent: true,
    standingFinalizeSatisfied: true,
    standingRecoveryFinalizeReason: 'low_rom_guarded_finalize',
    standingRecoveryBand: 'low_rom',

    setupMotionBlocked: false,
    eventCyclePromoted: false,
    peakLatched: true,
    peakLatchedAtIndex: 4,
    baselineFrozen: true,
    squatEventCycle: {
      detected: true,
      descentDetected: true,
      descentFrames: 4,
      notes: [],
    },

    descendStartAtMs: 1000,
    peakAtMs: 1120,
    reversalAtMs: 1500,
    standingRecoveredAtMs: 1900,
    selectedCanonicalDescentTimingEpochAtMs: 1000,
    selectedCanonicalPeakEpochAtMs: 1120,
    selectedCanonicalReversalEpochAtMs: 1500,
    selectedCanonicalRecoveryEpochAtMs: 1900,
    canonicalTemporalEpochOrderSatisfied: true,
    canonicalTemporalEpochOrderBlockedReason: null,
    cycleDurationMs: 900,
    squatDescentToPeakMs: 120,
    squatReversalToStandingMs: 400,

    completionAssistSources: [],
    ...overrides,
  };
}

/**
 * Clean shallow fail signature: visible proof cluster true (incl. setupMotionBlocked=false),
 * but a hidden writer guard (peak latch index) blocks same-rep ownership recovery.
 */
function cleanShallowFailHiddenPeakLatchFixture() {
  return provenSameRepOwnerResidualState({
    setupMotionBlocked: false,
    peakLatched: true,
    peakLatchedAtIndex: null,
  });
}

function assertPipelineBlocked(name, inputState, options = {}) {
  const { state } = runOwnerWritePipeline(inputState, options);
  ok(name, state.completionSatisfied !== true, {
    completionSatisfied: state.completionSatisfied,
    completionPassReason: state.completionPassReason,
    completionBlockedReason: state.completionBlockedReason,
    miss: state.officialShallowOwnerWriteMissReason,
  });
}

const meaningfulShallowAngles = [
  ...Array(8).fill(170),
  165, 155, 145, 130, 115, 100, 95, 93, 92,
  92, 93, 95, 100, 115, 130, 145, 160,
  ...Array(10).fill(170),
];

const deepStandardAngles = [
  ...Array(8).fill(170),
  160, 145, 130, 115, 100, 85, 75, 70, 68,
  70, 75, 85, 100, 120, 140, 160,
  ...Array(10).fill(170),
];

console.log('\nPR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01 smoke\n');

console.log('Section A — clean shallow fail fixture (hidden guard exposed)');
{
  const { state } = runOwnerWritePipeline(cleanShallowFailHiddenPeakLatchFixture());
  ok('officialShallowOwnerWriteCandidate is true', state.officialShallowOwnerWriteCandidate === true, state);
  ok('officialShallowOwnerWriteApplied is false', state.officialShallowOwnerWriteApplied === false, state);
  ok('officialShallowOwnerWriteMissReason is non-null', state.officialShallowOwnerWriteMissReason != null, state);
  ok(
    'officialShallowOwnerWriteMissReason is not writer_guard_unknown',
    state.officialShallowOwnerWriteMissReason !== 'writer_guard_unknown',
    state.officialShallowOwnerWriteMissReason
  );
  ok(
    'clean shallow fail surfaces peak latch anchor guard',
    state.officialShallowOwnerWriteMissReason === 'peak_latch_anchor_guard_failed',
    state.officialShallowOwnerWriteMissReason
  );
  ok('final completion remains blocked', state.completionSatisfied !== true, state);
  ok('no shallow owner write applied', state.canonicalShallowContractClosureApplied !== true, state);
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: state,
    squatPassCore: passCorePositive(),
  });
  const layer = runPostOwnerGate({ squatCompletionState: state, squatPassCore: passCorePositive() });
  ok('no pass granted (owner)', ownerTruth.completionOwnerPassed !== true, ownerTruth);
  ok('no pass granted (final gate)', layer.squatFinalPassTruth.finalPassGranted !== true, layer);
}

console.log('\nSection B — transient setup / evaluator setupMotionBlocked (still blocked, miss reason visible)');
{
  const { state } = runOwnerWritePipeline(provenSameRepOwnerResidualState(), {
    setupMotionBlocked: true,
  });
  ok('writer miss reason is setup_not_clear', state.officialShallowOwnerWriteMissReason === 'setup_not_clear', state);
  ok('final completion remains blocked', state.completionSatisfied !== true, state);
  ok('writer saw setup motion blocked', state.writerSawSetupMotionBlocked === true, state);
}

console.log('\nSection C — weird-pass still blocked');
{
  const landmarks = toLandmarks(makeKneeAngleSeries(3000, Array(32).fill(170), 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  ok('standing still remains blocked', gate.finalPassEligible === false && isFinalPassLatched('squat', gate) === false, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
}

assertPipelineBlocked(
  'seated hold remains blocked',
  provenSameRepOwnerResidualState({
    currentSquatPhase: 'committed_bottom_or_downward_commitment',
    completionBlockedReason: 'not_standing_recovered',
    ownerAuthoritativeRecoverySatisfied: false,
    recoveryConfirmedAfterReversal: false,
    officialShallowClosureProofSatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
  })
);

assertPipelineBlocked('setup contamination remains blocked', provenSameRepOwnerResidualState(), {
  setupMotionBlocked: true,
});

assertPipelineBlocked(
  'stale prior rep remains blocked',
  provenSameRepOwnerResidualState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'stale_prior_rep_epoch',
  })
);

assertPipelineBlocked(
  'mixed-rep contamination remains blocked',
  provenSameRepOwnerResidualState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'mixed_rep_epoch_contamination',
  })
);

assertPipelineBlocked(
  'early-pass remains blocked',
  provenSameRepOwnerResidualState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'recovery_not_after_reversal',
    reversalAtMs: 1500,
    standingRecoveredAtMs: 1480,
  })
);

{
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      cycleComplete: true,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    squatPassCore: passCorePositive(),
  });
  const layer = runPostOwnerGate({
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      cycleComplete: true,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    squatPassCore: passCorePositive(),
  });
  ok('pass-core-only adversarial remains blocked at owner truth', ownerTruth.completionOwnerPassed === false, ownerTruth);
  ok(
    'pass-core-only adversarial remains blocked at final gate',
    layer.progressionPassed === false && layer.squatFinalPassTruth.finalPassGranted === false,
    layer
  );
}

console.log('\nSection D — deep standard unchanged');
{
  const landmarks = toLandmarks(makeKneeAngleSeries(12000, deepStandardAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  const dbg = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok(
    'deep standard squat remains pass',
    gate.status === 'pass' && gate.finalPassEligible === true && isFinalPassLatched('squat', gate) === true,
    { status: gate.status, finalPassBlockedReason: gate.finalPassBlockedReason }
  );
  ok('deep standard path remains standard_cycle', dbg.completionPassReason === 'standard_cycle', dbg.completionPassReason);
  ok(
    'deep standard does not apply shallow owner write',
    cs.officialShallowOwnerWriteApplied !== true,
    {
      ownerWriteApplied: cs.officialShallowOwnerWriteApplied,
      ownerWriteMiss: cs.officialShallowOwnerWriteMissReason,
    }
  );
}

console.log('\nSection E — no silent writer miss on representative shallow fail fixture');
{
  const { state } = runOwnerWritePipeline(cleanShallowFailHiddenPeakLatchFixture());
  ok(
    'writer miss is explicit (non-null miss reason)',
    typeof state.officialShallowOwnerWriteMissReason === 'string' &&
      state.officialShallowOwnerWriteMissReason.length > 0,
    state.officialShallowOwnerWriteMissReason
  );
  ok('writer snapshot shows descent span guard seen as failed', state.writerSawDescentSpanSatisfied === false, state);
}

console.log('\nRegression: meaningful shallow live fixture still passes (10/10)');
let meaningfulPassCount = 0;
for (let i = 0; i < 10; i += 1) {
  const landmarks = toLandmarks(makeKneeAngleSeries(15000 + i * 5000, meaningfulShallowAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  const dbg = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  const passedGate =
    gate.status === 'pass' &&
    gate.completionSatisfied === true &&
    gate.finalPassEligible === true &&
    gate.finalPassBlockedReason == null &&
    isFinalPassLatched('squat', gate) === true &&
    dbg.completionTruthPassed === true &&
    cs.completionBlockedReason == null;
  if (passedGate) meaningfulPassCount += 1;
  ok(`meaningful shallow rep ${i + 1}/10 passes through final latch`, passedGate, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionBlockedReason: cs.completionBlockedReason,
    writerMiss: cs.officialShallowOwnerWriteMissReason,
  });
}
ok('meaningful shallow squat pass count is 10/10', meaningfulPassCount === 10, meaningfulPassCount);

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
