/**
 * PR-SHALLOW-AUTHORITATIVE-CLOSE-OWNERSHIP-RECOVERY-01
 *
 * Focus:
 * - same-rep official shallow close proof is consumed by the final owner writer
 * - timing-blocked residuals no longer survive as descent_span_too_short
 * - weird-pass families remain blocked
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-authoritative-close-ownership-recovery-01-smoke.mjs
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
    repId: 'shallow_authoritative_owner_probe',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'shallow-authoritative-owner-smoke',
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

function assertPipelineBlocked(name, inputState, options = {}) {
  const { state, contract } = runOwnerWritePipeline(inputState, options);
  ok(name, state.completionSatisfied !== true, {
    completionSatisfied: state.completionSatisfied,
    completionPassReason: state.completionPassReason,
    completionBlockedReason: state.completionBlockedReason,
    contractBlockedReason: contract.blockedReason,
    contractStage: contract.stage,
    ownerRecovered: state.sameRepShallowAuthoritativeCloseOwnershipRecovered,
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

console.log('\nPR-SHALLOW-AUTHORITATIVE-CLOSE-OWNERSHIP-RECOVERY-01 smoke\n');

console.log('must-pass: meaningful shallow same-rep reps');
let meaningfulPassCount = 0;
for (let i = 0; i < 10; i += 1) {
  const landmarks = toLandmarks(makeKneeAngleSeries(200 + i * 5000, meaningfulShallowAngles, 80));
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
    finalPassEligible: gate.finalPassEligible,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionBlockedReason: cs.completionBlockedReason,
    completionPassReason: dbg.completionPassReason,
  });
}
ok('meaningful shallow squat pass count is 10/10', meaningfulPassCount === 10, meaningfulPassCount);

console.log('\nmust-pass: final owner write owns proven shallow close');
{
  const { state, contract } = runOwnerWritePipeline(provenSameRepOwnerResidualState());
  ok('full same-rep shallow close proof no longer dies on descent_span_too_short', state.completionSatisfied === true && state.completionBlockedReason == null, {
    completionSatisfied: state.completionSatisfied,
    completionBlockedReason: state.completionBlockedReason,
    contractBlockedReason: contract.blockedReason,
  });
  ok('owner write produces officialShallowPathClosed=true', state.officialShallowPathClosed === true, state);
  ok('owner write produces official_shallow_cycle completion', state.completionPassReason === 'official_shallow_cycle' && state.cycleComplete === true, state.completionPassReason);
  const ownerTruth = readSquatPassOwnerTruth({ squatCompletionState: state, squatPassCore: passCorePositive() });
  ok('canonical completion-owner pass is true after owner write', ownerTruth.completionOwnerPassed === true && ownerTruth.completionOwnerBlockedReason == null, ownerTruth);
  ok('owner-write recovery is observable', state.sameRepShallowAuthoritativeCloseOwnershipRecovered === true && state.sameRepShallowAuthoritativeCloseOwnershipRecoveredFrom === 'descent_span_too_short', {
    recovered: state.sameRepShallowAuthoritativeCloseOwnershipRecovered,
    from: state.sameRepShallowAuthoritativeCloseOwnershipRecoveredFrom,
    source: state.canonicalShallowContractClosureSource,
  });
}

console.log('\nmust-stay-blocked: weird-pass families');
{
  const landmarks = toLandmarks(makeKneeAngleSeries(1000, Array(32).fill(170), 80));
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
  'no reversal remains blocked',
  provenSameRepOwnerResidualState({
    completionBlockedReason: 'no_reversal',
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowReversalSatisfied: false,
    reversalConfirmedByRuleOrHmm: false,
  })
);

assertPipelineBlocked(
  'no recovery remains blocked',
  provenSameRepOwnerResidualState({
    completionBlockedReason: 'not_standing_recovered',
    recoveryConfirmedAfterReversal: false,
    ownerAuthoritativeRecoverySatisfied: false,
    officialShallowClosureProofSatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
  })
);

assertPipelineBlocked(
  'early-pass shortcut remains blocked',
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
  ok('pass-core-only adversarial case remains blocked at owner truth', ownerTruth.completionOwnerPassed === false, ownerTruth);
  ok('pass-core-only adversarial case remains blocked at final gate', layer.progressionPassed === false && layer.squatFinalPassTruth.finalPassGranted === false, layer);
}

console.log('\nownership integrity');
assertPipelineBlocked(
  'diagnostic close-proof fields alone cannot pass without owner close proof',
  provenSameRepOwnerResidualState({
    reversalConfirmedAfterDescend: false,
    officialShallowReversalSatisfied: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
  })
);

{
  const { state } = runOwnerWritePipeline(provenSameRepOwnerResidualState());
  ok('final owner write cannot revert proven close back to descent_span_too_short', state.completionSatisfied === true && state.officialShallowPathClosed === true && state.completionBlockedReason !== 'descent_span_too_short', {
    completionSatisfied: state.completionSatisfied,
    officialShallowPathClosed: state.officialShallowPathClosed,
    completionBlockedReason: state.completionBlockedReason,
  });
}

{
  const landmarks = toLandmarks(makeKneeAngleSeries(9000, deepStandardAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  const dbg = gate.squatCycleDebug ?? {};
  ok('deep standard squat remains pass', gate.status === 'pass' && gate.finalPassEligible === true && isFinalPassLatched('squat', gate) === true, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionPassReason: dbg.completionPassReason,
  });
  ok('deep standard path remains standard_cycle', dbg.completionPassReason === 'standard_cycle', dbg.completionPassReason);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
