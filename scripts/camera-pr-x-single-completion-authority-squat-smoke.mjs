/**
 * PR-X single completion authority squat smoke.
 *
 * Locks the authority contract:
 * - completion is the only final pass source
 * - shallow closes as a completion band, not official-shallow/pass-core/UI ownership
 * - false-pass invariants stay closed
 *
 * Run:
 *   npx tsx scripts/camera-pr-x-single-completion-authority-squat-smoke.mjs
 */

const {
  computeSquatCompletionOwnerTruth,
  readOfficialShallowOwnerFreezeSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const { computeSquatUiProgressionLatchGate } = await import(
  '../src/lib/camera/squat/squat-ui-progression-latch-gate.ts'
);
const {
  computeSquatPostOwnerPreLatchGateLayer,
  readSquatPassOwnerTruth,
} = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, condition, detail = undefined) {
  if (condition) {
    passed += 1;
    console.log(`ok - ${name}`);
    return;
  }
  failed += 1;
  console.error(`not ok - ${name}`);
  if (detail !== undefined) console.error(detail);
}

function baseUiGateInput(overrides = {}) {
  return {
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.91,
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
    ...overrides,
  };
}

function completionCycle(overrides = {}) {
  const passReason = overrides.completionPassReason ?? 'standard_cycle';
  const shallow = passReason !== 'standard_cycle';
  return {
    completionSatisfied: true,
    completionPassReason: passReason,
    completionOwnerReason: shallow ? 'shallow_complete_rule' : null,
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: shallow ? 0.08 : 0.48,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: shallow,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1000,
    attemptStartedAfterReady: true,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    evidenceLabel: shallow ? 'ultra_low_rom' : 'standard',
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 4,
    officialShallowPathCandidate: shallow,
    officialShallowPathAdmitted: shallow,
    officialShallowPathClosed: shallow,
    officialShallowClosureProofSatisfied: shallow,
    canonicalShallowContractAntiFalsePassClear: shallow,
    canonicalTemporalEpochOrderSatisfied: true,
    canonicalTemporalEpochOrderBlockedReason: null,
    selectedCanonicalDescentTimingEpochValidIndex: 1,
    selectedCanonicalPeakEpochValidIndex: 4,
    selectedCanonicalReversalEpochValidIndex: 7,
    selectedCanonicalRecoveryEpochValidIndex: 11,
    selectedCanonicalDescentTimingEpochAtMs: 100,
    selectedCanonicalPeakEpochAtMs: 340,
    selectedCanonicalReversalEpochAtMs: 620,
    selectedCanonicalRecoveryEpochAtMs: 1000,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: shallow,
    officialShallowAscentEquivalentSatisfied: shallow,
    stillSeatedAtPass: false,
    squatEventCycle: {
      detected: true,
      descentFrames: 3,
      notes: [],
    },
    ...overrides,
  };
}

function passCore(overrides = {}) {
  return {
    passDetected: true,
    passBlockedReason: null,
    repId: 'rep_pr_x',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'pr_x_smoke',
    ...overrides,
  };
}

function postOwnerLayer(state, pc = passCore()) {
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: state,
    squatPassCore: pc,
  });
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: baseUiGateInput({ completionOwnerPassed: ownerTruth.completionOwnerPassed }),
    squatCompletionState: state,
    squatCycleDebug: {},
    squatPassCore: pc,
  });
}

console.log('\nPR-X single completion authority squat smoke\n');

const deepA = completionCycle({ standingRecoveredAtMs: 1000 });
const deepB = completionCycle({
  downwardCommitmentDelta: 0.62,
  selectedCanonicalRecoveryEpochAtMs: 1240,
  standingRecoveredAtMs: 1240,
});
for (const [name, state] of [
  ['deep fixture A', deepA],
  ['deep fixture B', deepB],
]) {
  const layer = postOwnerLayer(state, passCore({ passDetected: false, passBlockedReason: 'peak_not_latched' }));
  ok(`${name}: pass remains completion-owned`, layer.progressionPassed === true, layer);
  ok(
    `${name}: final owner is completion standard`,
    layer.ownerTruth.finalSuccessOwner === 'completion_truth_standard' &&
      layer.squatFinalPassTruth.finalPassSource === 'completion',
    layer.ownerTruth
  );
}

const shallow = completionCycle({ completionPassReason: 'official_shallow_cycle' });
const shallowLayer = postOwnerLayer(
  shallow,
  passCore({ passDetected: false, passBlockedReason: 'no_standing_recovery' })
);
ok('shallow valid cycle passes even when pass-core diagnostic blocks',
  shallowLayer.progressionPassed === true,
  shallowLayer
);
ok(
  'shallow final owner is completion shallow',
  shallowLayer.ownerTruth.finalSuccessOwner === 'completion_truth_shallow' &&
    shallowLayer.ownerTruth.completionBand === 'shallow',
  shallowLayer.ownerTruth
);
ok(
  'official shallow close is not a freeze/final owner',
  readOfficialShallowOwnerFreezeSnapshot({ squatCompletionState: shallow }).officialShallowOwnerFrozen === false,
  readOfficialShallowOwnerFreezeSnapshot({ squatCompletionState: shallow })
);

const uiMirror = computeSquatUiProgressionLatchGate(
  baseUiGateInput({
    completionOwnerPassed: true,
    liveReadinessNotReady: true,
    readinessStableDwellSatisfied: false,
    setupMotionBlocked: true,
    captureQualityInvalid: true,
    effectivePassConfirmation: false,
    passConfirmationFrameCount: 0,
    squatIntegrityBlockForPass: 'diagnostic_integrity_block',
    reasons: ['diagnostic_hard_block'],
    hardBlockerReasons: ['diagnostic_hard_block'],
  })
);
ok('UI gate mirrors completion result only', uiMirror.uiProgressionAllowed === true, uiMirror);

{
  const ownerTruth = readSquatPassOwnerTruth({
    squatCompletionState: shallow,
    squatPassCore: passCore({ passDetected: false, passBlockedReason: 'no_standing_recovery' }),
  });
  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: baseUiGateInput({
      completionOwnerPassed: ownerTruth.completionOwnerPassed,
      setupMotionBlocked: true,
    }),
    squatCompletionState: shallow,
    squatCycleDebug: {},
    squatPassCore: passCore({ passDetected: false, passBlockedReason: 'no_standing_recovery' }),
  });
  ok(
    'runtime setup blocked is enforced as completion invariant, not UI veto',
    layer.progressionPassed === false &&
      layer.ownerTruth.completionInvariantFailureReason === 'setup_motion_blocked' &&
      layer.uiGate.uiProgressionBlockedReason === 'completion_owner_not_satisfied',
    layer
  );
}

const falsePassCases = [
  [
    'no descent',
    completionCycle({
      attemptStarted: false,
      descendConfirmed: false,
      downwardCommitmentReached: false,
      downwardCommitmentDelta: 0,
    }),
  ],
  ['no reversal after descend', completionCycle({ reversalConfirmedAfterDescend: false })],
  [
    'no recovery after reversal',
    completionCycle({
      recoveryConfirmedAfterReversal: false,
      standingRecoveredAtMs: null,
    }),
  ],
  ['setup blocked', completionCycle({ setupMotionBlocked: true })],
  [
    'static seated hold',
    completionCycle({
      stillSeatedAtPass: true,
      recoveryConfirmedAfterReversal: false,
      standingRecoveredAtMs: null,
    }),
  ],
  [
    'cross-owner close only',
    completionCycle({
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      officialShallowPathClosed: true,
      evidenceLabel: 'ultra_low_rom',
    }),
  ],
  [
    'directionless jitter',
    completionCycle({
      evidenceLabel: 'insufficient_signal',
      squatEventCycle: { detected: false, descentFrames: 0, notes: ['jitter_spike_reject'] },
    }),
  ],
];

for (const [name, state] of falsePassCases) {
  const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: state });
  const layer = postOwnerLayer(state, passCore({ passDetected: true, passBlockedReason: null }));
  ok(`${name}: completion owner blocks`, owner.completionOwnerPassed === false, owner);
  ok(`${name}: final surface stays blocked`, layer.progressionPassed === false, layer);
}

console.log(`\nsummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
