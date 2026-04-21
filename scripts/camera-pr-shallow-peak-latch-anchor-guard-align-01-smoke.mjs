/**
 * PR-SHALLOW-PEAK-LATCH-ANCHOR-GUARD-ALIGN-01
 *
 * Focus:
 * - same-rep peak/latch anchor alignment at the canonical shallow final writer
 * - no pass-core opener revival
 * - weird-pass families remain blocked
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-peak-latch-anchor-guard-align-01-smoke.mjs
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
    repId: 'shallow_peak_latch_anchor_align_probe',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'shallow-peak-latch-anchor-align-smoke',
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

function provenSameRepAnchorResidualState(overrides = {}) {
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
    peakLatched: false,
    peakLatchedAtIndex: null,
    peakAnchorTruth: undefined,
    guardedShallowLocalPeakFound: true,
    guardedShallowLocalPeakBlockedReason: null,
    guardedShallowLocalPeakIndex: 6,
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
  const { state } = runOwnerWritePipeline(inputState, options);
  ok(name, state.completionSatisfied !== true, {
    completionSatisfied: state.completionSatisfied,
    completionPassReason: state.completionPassReason,
    completionBlockedReason: state.completionBlockedReason,
    writerMiss: state.officialShallowOwnerWriteMissReason,
    writerAnchorSource: state.officialShallowWriterAnchorSource,
  });
}

function assertWriterPasses(name, inputState) {
  const { state } = runOwnerWritePipeline(inputState, { setupMotionBlocked: false });
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: state,
    squatPassCore: passCorePositive(),
  });
  const layer = runPostOwnerGate({
    squatCompletionState: state,
    squatPassCore: passCorePositive(),
    ownerTruth,
  });
  ok(`${name}: official shallow path closed`, state.officialShallowPathClosed === true, state);
  ok(`${name}: completion satisfied`, state.completionSatisfied === true, state);
  ok(`${name}: canonical completion owner passes`, ownerTruth.completionOwnerPassed === true, ownerTruth);
  ok(`${name}: final surface grants`, layer.squatFinalPassTruth.finalPassGranted === true, layer);
  ok(
    `${name}: final surface stays legal`,
    state.completionSatisfied === true &&
      layer.progressionPassed === true &&
      layer.finalPassBlockedReason == null &&
      layer.squatFinalPassTruth.finalPassGranted === true,
    layer
  );
  return { state, ownerTruth, layer };
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

console.log('\nPR-SHALLOW-PEAK-LATCH-ANCHOR-GUARD-ALIGN-01 smoke\n');

console.log('Section A - must-pass');
let meaningfulPassCount = 0;
for (let i = 0; i < 10; i += 1) {
  const landmarks = toLandmarks(makeKneeAngleSeries(1000 + i * 5000, meaningfulShallowAngles, 80));
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
  ok(`meaningful shallow rep ${i + 1}/10 passes reliably`, passedGate, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionBlockedReason: cs.completionBlockedReason,
    writerMiss: cs.officialShallowOwnerWriteMissReason,
  });
}
ok('meaningful shallow squat pass count is 10/10', meaningfulPassCount === 10, meaningfulPassCount);

{
  const { state } = assertWriterPasses(
    'admitted shallow proof no longer dies solely on anchor misalignment',
    provenSameRepAnchorResidualState()
  );
  ok('writer records same-rep guarded local peak anchor source', state.officialShallowWriterAnchorSource === 'guarded_shallow_local_peak', state);
  ok('writer records aligned anchor index', state.officialShallowWriterAnchorIndex === 6, state);
  ok('writer synchronizes peak latch index after successful official write', state.peakLatchedAtIndex === 6, state);
}

console.log('\nSection B - must-stay-blocked');
{
  const landmarks = toLandmarks(makeKneeAngleSeries(70000, Array(32).fill(170), 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  ok('standing still remains blocked', gate.finalPassEligible === false && isFinalPassLatched('squat', gate) === false, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
}

assertPipelineBlocked(
  'seated hold remains blocked',
  provenSameRepAnchorResidualState({
    currentSquatPhase: 'committed_bottom_or_downward_commitment',
    completionBlockedReason: 'not_standing_recovered',
    ownerAuthoritativeRecoverySatisfied: false,
    recoveryConfirmedAfterReversal: false,
    officialShallowClosureProofSatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
  })
);

assertPipelineBlocked('setup contamination remains blocked', provenSameRepAnchorResidualState(), {
  setupMotionBlocked: true,
});

assertPipelineBlocked(
  'stale prior rep remains blocked',
  provenSameRepAnchorResidualState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'stale_prior_rep_epoch',
  })
);

assertPipelineBlocked(
  'mixed-rep contamination remains blocked',
  provenSameRepAnchorResidualState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'mixed_rep_epoch_contamination',
  })
);

assertPipelineBlocked(
  'no reversal remains blocked',
  provenSameRepAnchorResidualState({
    completionBlockedReason: 'no_reversal',
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowReversalSatisfied: false,
    officialShallowAscentEquivalentSatisfied: false,
  })
);

assertPipelineBlocked(
  'no recovery remains blocked',
  provenSameRepAnchorResidualState({
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
  provenSameRepAnchorResidualState({
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

console.log('\nSection C - anchor integrity');
assertPipelineBlocked(
  'shallow rep cannot pass without same-rep anchor truth',
  provenSameRepAnchorResidualState({
    guardedShallowLocalPeakFound: false,
    guardedShallowLocalPeakBlockedReason: 'local_peak_missing',
    guardedShallowLocalPeakIndex: null,
  })
);

assertPipelineBlocked(
  'series-start anchor cannot be reused without aligned local anchor',
  provenSameRepAnchorResidualState({
    peakLatched: true,
    peakLatchedAtIndex: 0,
    guardedShallowLocalPeakFound: false,
    guardedShallowLocalPeakBlockedReason: 'peak_anchor_series_start_only',
    guardedShallowLocalPeakIndex: null,
  })
);

{
  const { state } = assertWriterPasses(
    'peakLatchedAtIndex null passes only with explicit aligned provenance',
    provenSameRepAnchorResidualState({ peakLatchedAtIndex: null })
  );
  ok('null anchor pass is not silent', state.officialShallowWriterAnchorSource === 'guarded_shallow_local_peak', state);
}

{
  const { state } = assertWriterPasses(
    'peakLatchedAtIndex 0 passes only with explicit aligned provenance',
    provenSameRepAnchorResidualState({ peakLatched: true, peakLatchedAtIndex: 0 })
  );
  ok('series-start anchor pass is not silent', state.officialShallowWriterAnchorSource === 'guarded_shallow_local_peak', state);
  ok('series-start anchor replaced by current-rep local anchor', state.peakLatchedAtIndex === 6, state);
}

console.log('\nSection D - deep standard unchanged');
{
  const landmarks = toLandmarks(makeKneeAngleSeries(90000, deepStandardAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  const dbg = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('deep standard cycle still passes via standard path', gate.status === 'pass' && gate.finalPassEligible === true && isFinalPassLatched('squat', gate) === true, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionPassReason: dbg.completionPassReason,
  });
  ok('deep standard path remains standard_cycle', dbg.completionPassReason === 'standard_cycle', dbg.completionPassReason);
  ok('deep standard does not use shallow writer anchor alignment', cs.officialShallowWriterAnchorSource !== 'guarded_shallow_local_peak', cs.officialShallowWriterAnchorSource);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
