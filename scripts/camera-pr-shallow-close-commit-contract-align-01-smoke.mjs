/**
 * PR-SHALLOW-CLOSE-COMMIT-CONTRACT-ALIGN-01
 *
 * Focus:
 * - admitted official shallow close truth commits through the canonical writer
 * - blocker-cleared Class C frames do not stall at closed=false
 * - no opener-law, pass-core, registry, or deep-standard broadening
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-close-commit-contract-align-01-smoke.mjs
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
  applySameRepShallowAdmissionCloseRecovery,
} = await import('../src/lib/camera/squat-completion-state.ts');
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
    repId: 'shallow-close-commit-contract-align-probe',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'shallow-close-commit-contract-align-smoke',
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

function runCloseCommitPipeline(inputState, options = {}) {
  let state = applySameRepShallowAdmissionCloseRecovery(inputState, options);
  const contract = deriveCanonicalShallowCompletionContract(
    buildCanonicalShallowContractInputFromState(state)
  );
  state = mergeCanonicalShallowContractResult(state, contract);
  state = applyCanonicalShallowClosureFromContract(state, {
    standardOwnerFloor: 0.4,
    deriveSquatCompletionFinalizeMode,
    setupMotionBlocked: options.setupMotionBlocked === true,
  });
  return { state, contract };
}

function provenAdmittedCloseTruthState(overrides = {}) {
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
    peakAnchorTruth: 'committed_or_post_commit_peak',
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
  const { state, contract } = runCloseCommitPipeline(inputState, options);
  ok(name, state.completionSatisfied !== true && state.officialShallowPathClosed !== true, {
    completionSatisfied: state.completionSatisfied,
    completionPassReason: state.completionPassReason,
    completionBlockedReason: state.completionBlockedReason,
    contractBlockedReason: contract.blockedReason,
    contractStage: contract.stage,
    commitSatisfied: state.officialShallowAdmittedToClosedContractSatisfied,
    writerMiss: state.officialShallowOwnerWriteMissReason,
  });
}

function assertPipelinePasses(name, inputState, options = {}) {
  const { state, contract } = runCloseCommitPipeline(inputState, options);
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: state,
    squatPassCore: passCorePositive(),
  });
  const layer = runPostOwnerGate({
    squatCompletionState: state,
    squatPassCore: passCorePositive(),
    ownerTruth,
  });
  ok(`${name}: official shallow path commits closed`, state.officialShallowPathClosed === true, state);
  ok(`${name}: completionSatisfied commits true`, state.completionSatisfied === true, state);
  ok(`${name}: pass reason is official_shallow_cycle`, state.completionPassReason === 'official_shallow_cycle', state);
  ok(`${name}: completion owner then passes`, ownerTruth.completionOwnerPassed === true, ownerTruth);
  ok(`${name}: final pass opens through existing law`, layer.squatFinalPassTruth.finalPassGranted === true, layer);
  ok(
    `${name}: no completionTruthPassed=false / finalPassGranted=true`,
    !(state.completionSatisfied === false && layer.squatFinalPassTruth.finalPassGranted === true),
    { state, layer }
  );
  return { state, contract, ownerTruth, layer };
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

console.log('\nPR-SHALLOW-CLOSE-COMMIT-CONTRACT-ALIGN-01 smoke\n');

console.log('Must-pass');
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
  ok(`1. meaningful shallow same-rep rep ${i + 1}/10 passes reliably`, passedGate, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionBlockedReason: cs.completionBlockedReason,
    completionPassReason: dbg.completionPassReason,
  });
}
ok('1. repeated meaningful shallow pass count is 10/10', meaningfulPassCount === 10, meaningfulPassCount);

{
  const { state } = assertPipelinePasses(
    '2-3. Class B admitted shallow with full visible close proof',
    provenAdmittedCloseTruthState()
  );
  ok('2. close-commit contract stamp is visible', state.officialShallowAdmittedToClosedContractSatisfied === true, state);
  ok('2. recovered from descent span label is recorded', state.officialShallowAdmittedToClosedContractRecoveredFrom === 'descent_span_too_short', state);
  ok('2. writer applied official shallow owner write', state.officialShallowOwnerWriteApplied === true, state);
}

{
  const { state } = assertPipelinePasses(
    '3. Class C blocker-cleared close truth still commits',
    provenAdmittedCloseTruthState({
      completionBlockedReason: null,
      officialShallowPathBlockedReason: null,
    })
  );
  ok('3. Class C has no synthetic recovered blocker', state.officialShallowAdmittedToClosedContractRecoveredFrom == null, state);
  ok('3. Class C writer miss is null after commit', state.officialShallowOwnerWriteMissReason == null, state);
}

console.log('\nMust-stay-blocked');
{
  const landmarks = toLandmarks(makeKneeAngleSeries(70000, Array(32).fill(170), 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  ok('4. standing still remains blocked', gate.finalPassEligible === false && isFinalPassLatched('squat', gate) === false, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
}

assertPipelineBlocked(
  '5. seated hold remains blocked',
  provenAdmittedCloseTruthState({
    currentSquatPhase: 'committed_bottom_or_downward_commitment',
    completionBlockedReason: 'not_standing_recovered',
    ownerAuthoritativeRecoverySatisfied: false,
    recoveryConfirmedAfterReversal: false,
    officialShallowClosureProofSatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
  })
);

assertPipelineBlocked('6. setup contamination remains blocked', provenAdmittedCloseTruthState(), {
  setupMotionBlocked: true,
});

assertPipelineBlocked(
  '7. stale prior rep remains blocked',
  provenAdmittedCloseTruthState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'stale_prior_rep_epoch',
  })
);

assertPipelineBlocked(
  '8. mixed-rep contamination remains blocked',
  provenAdmittedCloseTruthState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'mixed_rep_epoch_contamination',
  })
);

assertPipelineBlocked(
  '9. no reversal remains blocked',
  provenAdmittedCloseTruthState({
    completionBlockedReason: 'no_reversal',
    officialShallowStreamBridgeApplied: false,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeReversalSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: false,
    officialShallowReversalSatisfied: false,
    officialShallowAscentEquivalentSatisfied: false,
  })
);

assertPipelineBlocked(
  '10. no recovery remains blocked',
  provenAdmittedCloseTruthState({
    completionBlockedReason: 'not_standing_recovered',
    recoveryConfirmedAfterReversal: false,
    ownerAuthoritativeRecoverySatisfied: false,
    officialShallowClosureProofSatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
  })
);

assertPipelineBlocked(
  '11. early-pass shortcut remains blocked',
  provenAdmittedCloseTruthState({
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
  ok('12. pass-core-only adversarial case remains blocked at owner truth', ownerTruth.completionOwnerPassed === false, ownerTruth);
  ok('12. pass-core-only adversarial case remains blocked at final gate', layer.progressionPassed === false && layer.squatFinalPassTruth.finalPassGranted === false, layer);
}

console.log('\nContract integrity');
assertPipelineBlocked(
  '13. admitted shallow alone cannot close',
  provenAdmittedCloseTruthState({
    completionBlockedReason: null,
    officialShallowStreamBridgeApplied: false,
    officialShallowReversalSatisfied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    ownerAuthoritativeReversalSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: false,
  })
);

assertPipelineBlocked(
  '14. admitted shallow with no genuine same-rep reversal/recovery still fails',
  provenAdmittedCloseTruthState({
    completionBlockedReason: null,
    reversalConfirmedAfterDescend: false,
    recoveryConfirmedAfterReversal: false,
    ownerAuthoritativeRecoverySatisfied: false,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'reversal_not_after_peak',
  })
);

{
  const { state } = assertPipelinePasses(
    '15. full shallow close truth has no closed=false stall',
    provenAdmittedCloseTruthState({
      completionBlockedReason: null,
      officialShallowPathBlockedReason: null,
    })
  );
  ok(
    '15. no fully satisfied shallow close truth remains closed=false without blocker',
    !(
      state.officialShallowPathAdmitted === true &&
      state.officialShallowStreamBridgeApplied === true &&
      state.officialShallowAscentEquivalentSatisfied === true &&
      state.officialShallowClosureProofSatisfied === true &&
      state.officialShallowReversalSatisfied === true &&
      state.completionBlockedReason == null &&
      state.officialShallowPathClosed !== true
    ),
    state
  );
}

{
  const landmarks = toLandmarks(makeKneeAngleSeries(90000, deepStandardAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  const dbg = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('16. deep standard cycle still passes via standard path', gate.status === 'pass' && gate.finalPassEligible === true && isFinalPassLatched('squat', gate) === true, {
    status: gate.status,
    finalPassBlockedReason: gate.finalPassBlockedReason,
    completionPassReason: dbg.completionPassReason,
  });
  ok('16. deep standard path remains standard_cycle', dbg.completionPassReason === 'standard_cycle', dbg.completionPassReason);
  ok('16. deep standard does not use official_shallow_cycle', cs.completionPassReason !== 'official_shallow_cycle', cs.completionPassReason);
}

{
  const impossibleLayer = runPostOwnerGate({
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      cycleComplete: false,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    squatPassCore: passCorePositive(),
  });
  ok('17. no completionTruthPassed=false / finalPassGranted=true', impossibleLayer.squatFinalPassTruth.finalPassGranted !== true, impossibleLayer);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
