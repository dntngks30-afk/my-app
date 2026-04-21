/**
 * PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01
 *
 * Focus:
 * - same-rep official shallow admission recovery
 * - same-rep official shallow close recovery from narrow timing blockers
 * - blocked families stay blocked
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-same-rep-admission-close-recovery-01-smoke.mjs
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
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
  const depthT = clamp((170 - kneeAngleDeg) / 110);
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
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
    repId: 'same_rep_recovery_probe',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'same-rep-recovery-smoke',
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

function runRecoveryPipeline(inputState, options = {}) {
  let state = applySameRepShallowAdmissionCloseRecovery(inputState, options);
  const contract = deriveCanonicalShallowCompletionContract(
    buildCanonicalShallowContractInputFromState(state)
  );
  state = mergeCanonicalShallowContractResult(state, contract);
  state = applyCanonicalShallowClosureFromContract(state, {
    standardOwnerFloor: 0.4,
    deriveSquatCompletionFinalizeMode,
  });
  return { state, contract };
}

function provenSameRepShallowState(overrides = {}) {
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
    officialShallowPathBlockedReason: null,

    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.12,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    reversalConfirmedByRuleOrHmm: true,

    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
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
  const { state, contract } = runRecoveryPipeline(inputState, options);
  ok(name, state.completionSatisfied !== true && contract.satisfied !== true, {
    completionSatisfied: state.completionSatisfied,
    completionPassReason: state.completionPassReason,
    completionBlockedReason: state.completionBlockedReason,
    contractBlockedReason: contract.blockedReason,
    contractStage: contract.stage,
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

console.log('\nPR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01 smoke\n');

console.log('must-pass: repeated meaningful shallow same-rep reps');
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

console.log('\nmust-pass: same-rep shallow close recovery');
{
  const { state, contract } = runRecoveryPipeline(provenSameRepShallowState(), {
    setupMotionBlocked: false,
  });
  ok('descent_span_too_short recovered only after same-rep proof is complete', state.completionSatisfied === true, {
    completionBlockedReason: state.completionBlockedReason,
    contractBlockedReason: contract.blockedReason,
    trace: contract.trace,
  });
  ok('close recovery writes official shallow cycle through canonical closer', state.completionPassReason === 'official_shallow_cycle', state.completionPassReason);
  ok('close recovery is observable and narrow', state.sameRepShallowCloseRecovered === true && state.sameRepShallowCloseRecoveredFrom === 'descent_span_too_short', {
    recovered: state.sameRepShallowCloseRecovered,
    from: state.sameRepShallowCloseRecoveredFrom,
  });
}

{
  const { state, contract } = runRecoveryPipeline(
    provenSameRepShallowState({
      completionBlockedReason: 'ascent_recovery_span_too_short',
      squatReversalToStandingMs: 120,
    }),
    { setupMotionBlocked: false }
  );
  ok('ascent_recovery_span_too_short recovered only after same-rep proof is complete', state.completionSatisfied === true, {
    completionBlockedReason: state.completionBlockedReason,
    contractBlockedReason: contract.blockedReason,
  });
  ok('ascent close recovery records the original blocker', state.sameRepShallowCloseRecoveredFrom === 'ascent_recovery_span_too_short', state.sameRepShallowCloseRecoveredFrom);
}

console.log('\nmust-pass: same-rep shallow admission recovery');
{
  const admissionState = provenSameRepShallowState({
    officialShallowPathAdmitted: false,
    officialShallowPathReason: null,
    officialShallowPathBlockedReason: 'not_armed',
    completionBlockedReason: 'not_armed',
    baselineFrozen: false,
    peakLatched: false,
    peakLatchedAtIndex: null,
    reversalConfirmedAfterDescend: false,
    recoveryConfirmedAfterReversal: false,
    officialShallowReversalSatisfied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    standingRecoveredAtMs: null,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'missing_peak_epoch',
    squatEventCycle: {
      detected: true,
      descentDetected: true,
      descentFrames: 3,
      notes: ['freeze_or_latch_missing'],
    },
  });
  const state = applySameRepShallowAdmissionCloseRecovery(admissionState, {
    setupMotionBlocked: false,
  });
  ok('not_armed/freeze_or_latch shallow evidence is admitted into official shallow path', state.officialShallowPathAdmitted === true, state);
  ok('admission recovery does not mark success', state.completionSatisfied !== true && state.completionBlockedReason === 'not_armed', {
    completionSatisfied: state.completionSatisfied,
    completionBlockedReason: state.completionBlockedReason,
  });
  ok('admission recovery is observable', state.sameRepShallowAdmissionRecovered === true, state.sameRepShallowAdmissionRecovered);
}

{
  const state = applySameRepShallowAdmissionCloseRecovery(
    provenSameRepShallowState({
      officialShallowPathAdmitted: false,
      officialShallowPathBlockedReason: 'not_armed',
      completionBlockedReason: 'not_armed',
      readinessStableDwellSatisfied: false,
      attemptStartedAfterReady: false,
      squatEventCycle: {
        detected: true,
        descentDetected: true,
        descentFrames: 3,
        notes: ['freeze_or_latch_missing'],
      },
    }),
    { setupMotionBlocked: false }
  );
  ok('admission recovery does not bypass explicit readiness failure', state.officialShallowPathAdmitted !== true, state);
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
  provenSameRepShallowState({
    currentSquatPhase: 'committed_bottom_or_downward_commitment',
    completionBlockedReason: 'not_standing_recovered',
    ownerAuthoritativeRecoverySatisfied: false,
    recoveryConfirmedAfterReversal: false,
    officialShallowClosureProofSatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
  })
);

assertPipelineBlocked(
  'setup contamination remains blocked',
  provenSameRepShallowState(),
  { setupMotionBlocked: true }
);

assertPipelineBlocked(
  'explicit readiness failure remains blocked',
  provenSameRepShallowState({
    readinessStableDwellSatisfied: false,
    attemptStartedAfterReady: false,
  })
);

assertPipelineBlocked(
  'stale prior rep remains blocked',
  provenSameRepShallowState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'stale_prior_rep_epoch',
  })
);

assertPipelineBlocked(
  'mixed-rep contamination remains blocked',
  provenSameRepShallowState({
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'mixed_rep_epoch_contamination',
  })
);

assertPipelineBlocked(
  'no reversal remains blocked',
  provenSameRepShallowState({
    completionBlockedReason: 'no_reversal',
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowReversalSatisfied: false,
    reversalConfirmedByRuleOrHmm: false,
  })
);

assertPipelineBlocked(
  'no recovery remains blocked',
  provenSameRepShallowState({
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
  provenSameRepShallowState({
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

console.log('\nmust-remain-green: deep standard path');
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
