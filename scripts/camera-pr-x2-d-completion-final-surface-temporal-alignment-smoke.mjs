/**
 * PR-X2-D - Completion-to-Final-Surface Temporal Alignment smoke.
 *
 * Pins the narrow X2-D contract:
 * - completion-finalized shallow truth exports a canonical surface payload
 * - final pass surface/UI/latch/semantics consume that payload sink-only
 * - raw temporal diagnostics remain visible but cannot re-block the same rep
 *
 * Run:
 *   npx tsx scripts/camera-pr-x2-d-completion-final-surface-temporal-alignment-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatCompletionOwnerTruth,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const {
  computeSquatPostOwnerPreLatchGateLayer,
  isFinalPassLatched,
} = await import('../src/lib/camera/auto-progression.ts');
const {
  readSquatFinalPassSemanticsTruth,
} = await import('../src/lib/camera/squat/squat-final-pass-semantics.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(
      `  FAIL ${name}`,
      extra !== undefined ? JSON.stringify(extra).slice(0, 800) : ''
    );
    process.exitCode = 1;
  }
}

function makeUiGateInput(ownerPassed) {
  return {
    completionOwnerPassed: ownerPassed,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.88,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    liveReadinessNotReady: false,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    confidenceDecoupleEligible: false,
  };
}

function makeGate(layer, squatCompletionState) {
  return {
    completionSatisfied: squatCompletionState?.completionSatisfied === true,
    confidence: 0.88,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    guardrail: { captureQuality: 'high' },
    evaluatorResult: { debug: { squatCompletionState } },
    squatCycleDebug: {
      finalPassSource: 'completion',
      finalSuccessOwner: layer.ownerTruth.finalSuccessOwner,
      completionFinalizedForSurface: layer.ownerTruth.completionFinalizedForSurface,
      surfaceTemporalTruthSource: layer.ownerTruth.surfaceTemporalTruthSource,
      squatFinalPassTruth: layer.squatFinalPassTruth,
    },
    finalPassEligible: layer.progressionPassed,
    finalPassBlockedReason: layer.finalPassBlockedReason,
  };
}

function makeCompletionFinalizedShallowState(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'official_shallow_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.14,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1400,
    attemptStartedAfterReady: true,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    evidenceLabel: 'low_rom',
    peakLatchedAtIndex: 18,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    baselineFrozen: true,
    peakLatched: true,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'missing_reversal_epoch',
    selectedCanonicalDescentTimingEpochValidIndex: 12,
    selectedCanonicalDescentTimingEpochAtMs: 1000,
    selectedCanonicalPeakEpochValidIndex: 18,
    selectedCanonicalPeakEpochAtMs: 1120,
    selectedCanonicalReversalEpochValidIndex: null,
    selectedCanonicalReversalEpochAtMs: null,
    selectedCanonicalRecoveryEpochValidIndex: 26,
    selectedCanonicalRecoveryEpochAtMs: 1400,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    stillSeatedAtPass: false,
    squatEventCycle: {
      detected: true,
      descentFrames: 6,
      notes: [],
    },
    completionFinalizedForSurface: true,
    completionFinalizedOwner: 'completion',
    completionFinalizedEpochId: 'completion:1000:1120:1260:1400',
    completionFinalizedTemporalOrderSatisfied: true,
    completionFinalizedPassReason: 'official_shallow_cycle',
    completionFinalizedDescentAtMs: 1000,
    completionFinalizedPeakAtMs: 1120,
    completionFinalizedReversalAtMs: 1260,
    completionFinalizedRecoveryAtMs: 1400,
    ...overrides,
  };
}

function runSurface(state) {
  const ownerTruth = computeSquatCompletionOwnerTruth({
    squatCompletionState: state,
  });
  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: makeUiGateInput(ownerTruth.completionOwnerPassed),
    squatCompletionState: state,
    squatCycleDebug: undefined,
    squatPassCore: undefined,
  });
  const gate = makeGate(layer, state);
  const semantics = readSquatFinalPassSemanticsTruth({
    finalPassEligible: gate.finalPassEligible,
    squatFinalPassTruth: layer.squatFinalPassTruth,
  });
  return { ownerTruth, layer, gate, semantics };
}

console.log('\nPR-X2-D completion-final-surface temporal alignment smoke\n');

{
  const state = makeCompletionFinalizedShallowState();
  const { ownerTruth, layer, gate, semantics } = runSurface(state);

  ok(
    'completion-finalized shallow owner passes despite raw missing_reversal_epoch',
    ownerTruth.completionOwnerPassed === true &&
      ownerTruth.completionOwnerBlockedReason == null,
    ownerTruth
  );
  ok(
    'owner surfaces canonical completion payload as source of temporal truth',
    ownerTruth.completionFinalizedForSurface === true &&
      ownerTruth.completionFinalizedPassReason === 'official_shallow_cycle' &&
      ownerTruth.surfaceTemporalTruthSource === 'completion_finalized_payload',
    ownerTruth
  );
  ok(
    'final pass surface opens from completion payload',
    layer.finalPassBlockedReason == null &&
      layer.progressionPassed === true &&
      gate.finalPassEligible === true,
    {
      finalPassBlockedReason: layer.finalPassBlockedReason,
      progressionPassed: layer.progressionPassed,
      finalPassEligible: gate.finalPassEligible,
    }
  );
  ok(
    'UI gate, final latch, and pass semantics all align on the same rep',
    layer.uiGate.uiProgressionAllowed === true &&
      isFinalPassLatched('squat', gate) === true &&
      semantics.finalPassGranted === true,
    {
      uiProgressionAllowed: layer.uiGate.uiProgressionAllowed,
      latched: isFinalPassLatched('squat', gate),
      semantics,
    }
  );
  ok(
    'raw temporal blocker remains visible but no longer vetoes the final surface',
    state.canonicalTemporalEpochOrderBlockedReason === 'missing_reversal_epoch' &&
      ownerTruth.completionOwnerBlockedReason == null &&
      layer.finalPassBlockedReason == null,
    {
      rawBlockedReason: state.canonicalTemporalEpochOrderBlockedReason,
      ownerBlockedReason: ownerTruth.completionOwnerBlockedReason,
      finalPassBlockedReason: layer.finalPassBlockedReason,
    }
  );
}

{
  const state = makeCompletionFinalizedShallowState({
    completionFinalizedForSurface: false,
    completionFinalizedOwner: null,
    completionFinalizedEpochId: null,
    completionFinalizedTemporalOrderSatisfied: false,
    completionFinalizedPassReason: null,
    completionFinalizedDescentAtMs: null,
    completionFinalizedPeakAtMs: null,
    completionFinalizedReversalAtMs: null,
    completionFinalizedRecoveryAtMs: null,
  });
  const { ownerTruth, layer, gate, semantics } = runSurface(state);

  ok(
    'without completion-finalized payload the same dirty temporal ledger stays blocked',
    ownerTruth.completionOwnerPassed === false &&
      ownerTruth.completionOwnerBlockedReason ===
        'temporal_epoch_order:missing_reversal_epoch' &&
      layer.finalPassBlockedReason ===
        'temporal_epoch_order:missing_reversal_epoch',
    {
      ownerTruth,
      finalPassBlockedReason: layer.finalPassBlockedReason,
    }
  );
  ok(
    'payload-missing path keeps UI/latch/semantics closed',
    layer.uiGate.uiProgressionAllowed === false &&
      gate.finalPassEligible === false &&
      isFinalPassLatched('squat', gate) === false &&
      semantics.finalPassGranted === false,
    {
      uiProgressionAllowed: layer.uiGate.uiProgressionAllowed,
      finalPassEligible: gate.finalPassEligible,
      latched: isFinalPassLatched('squat', gate),
      semantics,
    }
  );
}

for (const testCase of [
  {
    name: 'completion false family stays blocked',
    state: makeCompletionFinalizedShallowState({
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: 'no_reversal',
      currentSquatPhase: 'ascending',
      cycleComplete: false,
      reversalConfirmedAfterDescend: false,
      recoveryConfirmedAfterReversal: false,
      standingRecoveredAtMs: null,
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedEpochId: null,
      completionFinalizedTemporalOrderSatisfied: false,
      completionFinalizedPassReason: null,
      completionFinalizedDescentAtMs: null,
      completionFinalizedPeakAtMs: null,
      completionFinalizedReversalAtMs: null,
      completionFinalizedRecoveryAtMs: null,
    }),
    expectedReason: 'no_reversal',
  },
  {
    name: 'no_recovery family stays blocked',
    state: makeCompletionFinalizedShallowState({
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: 'no_recovery',
      currentSquatPhase: 'ascending',
      cycleComplete: false,
      recoveryConfirmedAfterReversal: false,
      standingRecoveredAtMs: null,
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedPassReason: null,
    }),
    expectedReason: 'no_recovery',
  },
  {
    name: 'setup_motion_blocked family stays blocked',
    state: makeCompletionFinalizedShallowState({
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      currentSquatPhase: 'descending',
      cycleComplete: false,
      setupMotionBlocked: true,
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedPassReason: null,
    }),
    expectedReason: 'setup_motion_blocked',
  },
  {
    name: 'standing only / jitter family stays blocked',
    state: makeCompletionFinalizedShallowState({
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      currentSquatPhase: 'idle',
      cycleComplete: false,
      squatEventCycle: {
        detected: false,
        descentFrames: 0,
        notes: ['jitter_spike_reject'],
      },
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedPassReason: null,
    }),
    expectedReason: 'directionless_jitter',
  },
  {
    name: 'seated only family stays blocked',
    state: makeCompletionFinalizedShallowState({
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      currentSquatPhase: 'idle',
      cycleComplete: false,
      stillSeatedAtPass: true,
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedPassReason: null,
    }),
    expectedReason: 'still_seated_at_pass',
  },
  {
    name: 'static ultra-low reject family stays blocked',
    state: makeCompletionFinalizedShallowState({
      completionSatisfied: true,
      completionPassReason: 'static_ultra_low_marker',
      completionBlockedReason: null,
      evidenceLabel: 'ultra_low_rom',
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedPassReason: null,
    }),
    expectedReason: 'reject_ultra_low_static',
  },
]) {
  const { ownerTruth, layer, gate, semantics } = runSurface(testCase.state);
  ok(
    testCase.name,
    ownerTruth.completionOwnerPassed === false &&
      ownerTruth.completionOwnerBlockedReason === testCase.expectedReason &&
      layer.finalPassBlockedReason === testCase.expectedReason &&
      gate.finalPassEligible === false &&
      isFinalPassLatched('squat', gate) === false &&
      semantics.finalPassGranted === false,
    {
      ownerTruth,
      finalPassBlockedReason: layer.finalPassBlockedReason,
      finalPassEligible: gate.finalPassEligible,
      latched: isFinalPassLatched('squat', gate),
      semantics,
    }
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
