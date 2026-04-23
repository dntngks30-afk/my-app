/**
 * PR-CAM-SHALLOW-FINAL-PASS-TRUTH-LOCK
 *
 * Focused smoke for the final shallow authority repair:
 * - early shallow pre-attempt remains blocked
 * - later same-eval terminal bundle gains provisional terminal authority
 * - ultra-low policy no longer kills that terminal authority
 * - late same-eval contamination cannot retroactively erase earlier authority
 * - contamination/weird-pass controls remain blocked
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-shallow-final-authority-repair-smoke.mjs
 */

const {
  applyCanonicalShallowClosureFromContract,
  resolveProvisionalShallowTerminalAuthority,
} = await import('../src/lib/camera/squat/squat-completion-canonical.ts');
const {
  applyUltraLowPolicyLock,
  applySameEvalProvisionalTerminalAuthorityFreeze,
} = await import('../src/lib/camera/squat-completion-state.ts');
const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
);
const { computeSquatCompletionOwnerTruth } = await import(
  '../src/lib/camera/squat/squat-progression-contract.ts'
);

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

function terminalBundle(overrides = {}) {
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
    officialShallowClosureProofSatisfied: false,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.06,
    baselineFrozen: true,
    baselineFrozenDepth: 0,
    peakLatched: true,
    peakLatchedAtIndex: 5,
    peakAnchorTruth: 'committed_or_post_commit_peak',
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowReversalSatisfied: true,
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    attemptStartedAfterReady: true,
    standingRecoveredAtMs: 1000,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
    canonicalTemporalEpochOrderSatisfied: true,
    canonicalTemporalEpochOrderBlockedReason: null,
    selectedCanonicalDescentTimingEpochValidIndex: 1,
    selectedCanonicalPeakEpochValidIndex: 5,
    selectedCanonicalReversalEpochValidIndex: 8,
    selectedCanonicalRecoveryEpochValidIndex: 12,
    selectedCanonicalDescentTimingEpochAtMs: 100,
    selectedCanonicalPeakEpochAtMs: 350,
    selectedCanonicalReversalEpochAtMs: 600,
    selectedCanonicalRecoveryEpochAtMs: 1000,
    canonicalShallowContractAntiFalsePassClear: true,
    canonicalShallowContractSatisfied: false,
    reversalConfirmedByRuleOrHmm: true,
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 250,
    squatReversalToStandingMs: 400,
    squatEventCycle: {
      detected: true,
      descentFrames: 3,
      notes: [],
    },
    ...overrides,
  };
}

function provisional(state) {
  return resolveProvisionalShallowTerminalAuthority(state, {
    standardOwnerFloor: STANDARD_OWNER_FLOOR,
    setupMotionBlocked: state.setupMotionBlocked,
    requireCanonicalAntiFalsePassClear: true,
  });
}

console.log('\nPR-CAM shallow final authority repair smoke\n');

const early = terminalBundle({
  officialShallowPathAdmitted: false,
  attemptStarted: false,
  descendConfirmed: false,
  baselineFrozen: false,
  peakLatched: false,
  peakLatchedAtIndex: null,
  completionBlockedReason: 'not_armed',
});
ok('early shallow pre-attempt candidate stays blocked', provisional(early).satisfied === false, provisional(early));

const later = terminalBundle();
ok('later same-eval terminal bundle gains provisional authority', provisional(later).satisfied === true, provisional(later));

const policyBefore = applyUltraLowPolicyLock(
  terminalBundle({
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: true,
  })
);
ok('without terminal bundle, ultra-low policy still blocks', policyBefore.ultraLowPolicyBlocked === true, policyBefore.ultraLowPolicyTrace);
ok(
  'without terminal bundle, meaningful shallow still returns ultra_low_rom_not_allowed',
  getShallowMeaningfulCycleBlockReason(policyBefore) === 'ultra_low_rom_not_allowed',
  getShallowMeaningfulCycleBlockReason(policyBefore)
);

const policyAfter = applyUltraLowPolicyLock(
  terminalBundle({
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
  })
);
ok('with terminal bundle, ultra-low policy does not kill', policyAfter.ultraLowPolicyBlocked === false, policyAfter.ultraLowPolicyTrace);
ok(
  'with terminal bundle, meaningful shallow does not emit ultra_low_rom_not_allowed',
  getShallowMeaningfulCycleBlockReason(policyAfter) == null,
  getShallowMeaningfulCycleBlockReason(policyAfter)
);

const canonicalClosed = applyCanonicalShallowClosureFromContract(later, {
  standardOwnerFloor: STANDARD_OWNER_FLOOR,
  setupMotionBlocked: false,
  deriveSquatCompletionFinalizeMode: () => 'official_shallow_finalized',
});
ok('canonical close consumes provisional terminal authority as official_shallow_cycle',
  canonicalClosed.completionPassReason === 'official_shallow_cycle' &&
    canonicalClosed.officialShallowPathClosed === true &&
    canonicalClosed.provisionalShallowTerminalAuthority === true,
  canonicalClosed
);
ok(
  'completion shallow owner consumes the closed authority',
  computeSquatCompletionOwnerTruth({ squatCompletionState: canonicalClosed }).finalSuccessOwner ===
    'completion_truth_shallow' &&
    computeSquatCompletionOwnerTruth({ squatCompletionState: canonicalClosed }).officialShallowOwnerFrozen === false,
  computeSquatCompletionOwnerTruth({ squatCompletionState: canonicalClosed })
);

const lateContaminated = terminalBundle({
  completionSatisfied: false,
  completionPassReason: 'not_confirmed',
  completionBlockedReason: null,
  officialShallowPathClosed: false,
  setupMotionBlocked: true,
});
const frozen = applySameEvalProvisionalTerminalAuthorityFreeze(
  lateContaminated,
  { state: canonicalClosed, frameCount: 42 },
  { setupMotionBlocked: true }
);
ok('late contamination after earlier authority is non-retroactive',
  frozen.officialShallowPathClosed === true &&
    frozen.setupMotionBlocked === false &&
    frozen.sameEvalShallowTerminalAuthorityFreezeApplied === true,
  frozen
);

const noEarlierAuthority = applySameEvalProvisionalTerminalAuthorityFreeze(
  lateContaminated,
  null,
  { setupMotionBlocked: true }
);
ok('contamination without earlier authority still fails',
  noEarlierAuthority.officialShallowPathClosed !== true &&
    noEarlierAuthority.setupMotionBlocked === true,
  noEarlierAuthority
);

const controls = [
  ['stand still', terminalBundle({ attemptStarted: false, descendConfirmed: false, downwardCommitmentDelta: 0 })],
  ['setup blocked alone', terminalBundle({ setupMotionBlocked: true })],
  ['seated hold', terminalBundle({ recoveryConfirmedAfterReversal: false, standingRecoveredAtMs: null })],
  ['jitter only', terminalBundle({ evidenceLabel: 'insufficient_signal' })],
  ['area spike only', terminalBundle({ setupMotionBlocked: true, officialShallowStreamBridgeApplied: false })],
  ['standard owner zone', terminalBundle({ relativeDepthPeak: 0.5, evidenceLabel: 'standard' })],
];

for (const [name, state] of controls) {
  ok(`weird-pass control remains blocked: ${name}`, provisional(state).satisfied === false, provisional(state));
}

console.log(`\nsummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
