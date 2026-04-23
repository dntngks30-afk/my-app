/**
 * Post-PR3 shallow authority preservation smoke.
 *
 * Covers:
 * 1. late legitimate shallow bundle + ultra_low kill baseline -> pass
 * 2. late legitimate shallow bundle + later no_reversal/no_reversal_after_peak relapse survives
 * 3. admitted-only negative
 * 4. reversal missing negative
 * 5. recovery missing negative
 * 6. setup contamination before authority negative
 * 7. standing/seated/no-motion/noise negatives
 *
 * Run:
 *   npx tsx scripts/camera-post-pr3-shallow-authority-preservation-smoke.mjs
 */

const {
  applyCanonicalShallowClosureFromContract,
  resolveLateShallowClosureCapableAuthority,
} = await import('../src/lib/camera/squat/squat-completion-canonical.ts');
const {
  applySameEvalProvisionalTerminalAuthorityFreeze,
  applyUltraLowPolicyLock,
} = await import('../src/lib/camera/squat-completion-state.ts');
const {
  computeSquatCompletionOwnerTruth,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const {
  getSquatPostOwnerFinalPassBlockedReason,
  readSquatPassOwnerTruth,
} = await import('../src/lib/camera/auto-progression.ts');

const STANDARD_OWNER_FLOOR = 0.4;

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

function lateBundle(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'ultra_low_rom_not_allowed',
    currentSquatPhase: 'standing_recovered',
    cycleComplete: false,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: 'ultra_low_rom_not_allowed',
    officialShallowClosureProofSatisfied: false,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.06,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 6,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowReversalSatisfied: true,
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    attemptStartedAfterReady: true,
    standingRecoveredAtMs: 1200,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
    canonicalShallowContractSatisfied: false,
    canonicalShallowContractAntiFalsePassClear: false,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: null,
    reversalConfirmedByRuleOrHmm: false,
    reversalConfirmedBy: 'rule',
    squatEventCycle: {
      detected: true,
      descentFrames: 3,
      notes: [],
    },
    ...overrides,
  };
}

function authority(state) {
  return resolveLateShallowClosureCapableAuthority(state, {
    standardOwnerFloor: STANDARD_OWNER_FLOOR,
    setupMotionBlocked: state.setupMotionBlocked,
    requireCanonicalAntiFalsePassClear: true,
  });
}

function close(state) {
  return applyCanonicalShallowClosureFromContract(state, {
    standardOwnerFloor: STANDARD_OWNER_FLOOR,
    setupMotionBlocked: state.setupMotionBlocked,
    deriveSquatCompletionFinalizeMode: () => 'official_shallow_finalized',
  });
}

function finalPassBlockedReason(state) {
  const ownerTruth = computeSquatCompletionOwnerTruth({ squatCompletionState: state });
  return getSquatPostOwnerFinalPassBlockedReason({
    ownerTruth,
    uiGate: { uiProgressionAllowed: true, uiProgressionBlockedReason: null },
    squatCompletionState: state,
  });
}

console.log('\nPost-PR3 shallow authority preservation smoke\n');

const ultraLowKilled = lateBundle();
ok(
  'late legitimate bundle is closure-capable even when closureProof is false',
  authority(ultraLowKilled).satisfied === true,
  authority(ultraLowKilled)
);

const policyAfter = applyUltraLowPolicyLock(ultraLowKilled);
ok(
  'ultra_low policy does not terminal-kill late legitimate authority',
  policyAfter.ultraLowPolicyBlocked === false,
  policyAfter.ultraLowPolicyTrace
);

const closed = close(ultraLowKilled);
const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: closed });
ok(
  'late legitimate bundle closes as official shallow',
  closed.officialShallowPathClosed === true &&
    closed.completionSatisfied === true &&
    closed.completionPassReason === 'official_shallow_cycle',
  closed
);
ok(
  'closed authority is consumed by completion owner',
  owner.completionOwnerPassed === true && owner.officialShallowOwnerFrozen === true,
  owner
);
ok('closed authority reaches final pass sink', finalPassBlockedReason(closed) == null, {
  finalPassBlockedReason: finalPassBlockedReason(closed),
});

const noReversalRelapse = lateBundle({
  completionBlockedReason: 'no_reversal',
  officialShallowPathBlockedReason: 'no_reversal',
  reversalConfirmedAfterDescend: false,
  recoveryConfirmedAfterReversal: false,
  officialShallowStreamBridgeApplied: false,
  officialShallowAscentEquivalentSatisfied: false,
  officialShallowReversalSatisfied: false,
});
const frozenNoReversal = applySameEvalProvisionalTerminalAuthorityFreeze(
  noReversalRelapse,
  { state: closed, frameCount: 24 },
  undefined
);
ok(
  'same-eval later no_reversal cannot retro-kill earlier authority',
  frozenNoReversal.officialShallowPathClosed === true &&
    frozenNoReversal.sameEvalShallowTerminalAuthorityFreezeApplied === true,
  frozenNoReversal
);

const ownerWithPassCoreRelapse = readSquatPassOwnerTruth({
  squatCompletionState: closed,
  squatPassCore: {
    passDetected: false,
    passBlockedReason: 'no_reversal_after_peak',
    passCoreStale: false,
  },
});
ok(
  'same-eval pass-core no_reversal_after_peak cannot retro-kill frozen authority',
  ownerWithPassCoreRelapse.completionOwnerPassed === true,
  ownerWithPassCoreRelapse
);

const ultraLowRelapse = lateBundle({
  officialShallowStreamBridgeApplied: false,
  officialShallowAscentEquivalentSatisfied: false,
  officialShallowReversalSatisfied: false,
});
const frozenUltraLow = applySameEvalProvisionalTerminalAuthorityFreeze(
  ultraLowRelapse,
  { state: closed, frameCount: 24 },
  undefined
);
ok(
  'same-eval later ultra_low cannot retro-kill earlier authority',
  frozenUltraLow.officialShallowPathClosed === true &&
    frozenUltraLow.sameEvalShallowTerminalAuthorityFreezeRecoveredFrom ===
      'ultra_low_rom_not_allowed',
  frozenUltraLow
);

const negatives = [
  ['admitted-only', lateBundle({
    baselineFrozen: false,
    peakLatched: false,
    reversalConfirmedAfterDescend: false,
    recoveryConfirmedAfterReversal: false,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowReversalSatisfied: false,
  })],
  ['reversal missing', lateBundle({
    reversalConfirmedAfterDescend: false,
    officialShallowReversalSatisfied: false,
  })],
  ['recovery missing', lateBundle({
    recoveryConfirmedAfterReversal: false,
  })],
  ['setup contamination before authority', lateBundle({
    setupMotionBlocked: true,
  })],
  ['standing only', lateBundle({
    attemptStarted: false,
    descendConfirmed: false,
    downwardCommitmentReached: false,
    downwardCommitmentDelta: 0,
  })],
  ['seated/no-motion', lateBundle({
    downwardCommitmentDelta: 0,
    squatEventCycle: { detected: false, descentFrames: 0, notes: [] },
  })],
  ['noise only', lateBundle({
    evidenceLabel: 'insufficient_signal',
    squatEventCycle: { detected: false, descentFrames: 0, notes: ['jitter_spike_reject'] },
  })],
];

for (const [name, state] of negatives) {
  ok(`must-fail negative preserved: ${name}`, authority(state).satisfied === false, authority(state));
}

console.log(`\nsummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
