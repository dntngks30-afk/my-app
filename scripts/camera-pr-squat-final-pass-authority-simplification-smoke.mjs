/**
 * PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION — authority-sink smoke.
 *
 * Pins the narrow contract of this PR:
 * - Final pass authority is owned by `completion` only (standard + official
 *   shallow variation). Secondary layers may diagnose, but may not veto a
 *   rep whose completion truth has already been established.
 * - `setup_motion_blocked` is a pre-attempt veto only. A post-attempt
 *   real-device setup contamination (first-seen-after-completion) no longer
 *   cancels a rep with completed descent/reversal/recovery.
 * - `shallow_descent_too_short` is demoted to a quality warning once all
 *   four official-shallow completion conditions are satisfied.
 * - `recovery_hold_too_short` is demoted to a quality warning once
 *   `recoveryConfirmedAfterReversal === true` and same-rep standing-
 *   recovery finalize evidence is NOT explicitly false.
 * - False-positive locks remain: standing pass, seated pass, no-descent,
 *   no-reversal, no-recovery, pre-commit setup block, trajectory-only
 *   reversal rescue.
 *
 * Run:
 *   npx tsx scripts/camera-pr-squat-final-pass-authority-simplification-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatCompletionOwnerTruth,
  resolveSquatFinalPassAuthoritySimplification,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const {
  computeSquatPostOwnerPreLatchGateLayer,
} = await import('../src/lib/camera/auto-progression.ts');

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
      extra !== undefined ? JSON.stringify(extra, null, 2).slice(0, 1200) : ''
    );
    process.exitCode = 1;
  }
}

function makeUiGateInput(ownerPassed, setupMotionBlocked = false) {
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
    setupMotionBlocked,
    officialShallowOwnerFrozen: false,
    confidenceDecoupleEligible: false,
  };
}

function runSinkForState(state) {
  const ownerTruth = computeSquatCompletionOwnerTruth({
    squatCompletionState: state,
  });
  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: makeUiGateInput(
      ownerTruth.completionOwnerPassed,
      state.setupMotionBlocked === true
    ),
    squatCompletionState: state,
    squatCycleDebug: undefined,
    squatPassCore: undefined,
  });
  return { ownerTruth, layer };
}

/**
 * Deep retro-veto fixture — the real-device failure this PR exists to fix.
 * Rep completed descent/reversal/recovery cleanly, then late setup
 * contamination (first-seen-after-completion) set `completionBlockedReason =
 * 'setup_motion_blocked'`. Without the sink, the owner truth fails with
 * `setup_motion_blocked`.
 */
function makeDeepRetroSetupVetoState(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: 'setup_motion_blocked',
    completionOwnerReason: 'standard_cycle',
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    attemptStartedAfterReady: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.42,
    reversalConfirmedAfterDescend: true,
    reversalConfirmedByRuleOrHmm: true,
    recoveryConfirmedAfterReversal: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1400,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: true,
    evidenceLabel: 'standard',
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 20,
    officialShallowPathAdmitted: false,
    officialShallowReversalSatisfied: false,
    officialShallowAscentEquivalentSatisfied: false,
    stillSeatedAtPass: false,
    trajectoryReversalRescueApplied: false,
    sameRepCompletionWindowPresent: true,
    sameRepSetupCleanWithinRepWindow: true,
    sameRepSetupBlockFirstSeenBeforeCommit: false,
    sameRepSetupBlockFirstSeenAfterCompletion: true,
    sameRepStandingRecoveryFinalizeSatisfied: true,
    sameRepRecoveryHoldMs: 210,
    squatEventCycle: {
      detected: true,
      descentFrames: 7,
      notes: [],
    },
    ...overrides,
  };
}

/**
 * Deep recovery-hold retro-veto fixture — trace shows completion cycle
 * reached recovery, but completionBlockedReason = 'recovery_hold_too_short'.
 * same-rep standing finalize evidence is not explicitly false → demote.
 */
function makeDeepRecoveryHoldQualityState(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: 'recovery_hold_too_short',
    completionOwnerReason: 'standard_cycle',
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    attemptStartedAfterReady: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.40,
    reversalConfirmedAfterDescend: true,
    reversalConfirmedByRuleOrHmm: true,
    recoveryConfirmedAfterReversal: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1380,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    evidenceLabel: 'standard',
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 20,
    officialShallowPathAdmitted: false,
    stillSeatedAtPass: false,
    trajectoryReversalRescueApplied: false,
    sameRepStandingRecoveryFinalizeSatisfied: true,
    sameRepRecoveryHoldMs: 180,
    squatEventCycle: { detected: true, descentFrames: 7, notes: [] },
    ...overrides,
  };
}

/**
 * Shallow retro-veto fixture — official shallow admitted / reversal /
 * ascent-equivalent / recovery all satisfied; completionBlockedReason =
 * 'shallow_descent_too_short'.
 */
function makeShallowDescentQualityState(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'official_shallow_cycle',
    completionBlockedReason: 'shallow_descent_too_short',
    completionOwnerReason: 'shallow_complete_rule',
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    attemptStartedAfterReady: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.14,
    reversalConfirmedAfterDescend: true,
    reversalConfirmedByRuleOrHmm: true,
    recoveryConfirmedAfterReversal: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1390,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    evidenceLabel: 'low_rom',
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 18,
    relativeDepthPeak: 0.15,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowReversalSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    stillSeatedAtPass: false,
    trajectoryReversalRescueApplied: false,
    sameRepStandingRecoveryFinalizeSatisfied: true,
    sameRepRecoveryHoldMs: 190,
    squatEventCycle: { detected: true, descentFrames: 4, notes: [] },
    ...overrides,
  };
}

console.log('\nPR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION smoke\n');

// 1. Deep retro setup-motion veto → demoted to standard pass.
{
  const state = makeDeepRetroSetupVetoState();
  const { ownerTruth, layer } = runSinkForState(state);

  ok(
    'pre-sink: deep retro setup veto blocks owner truth',
    ownerTruth.completionOwnerPassed === false &&
      (ownerTruth.completionOwnerBlockedReason === 'setup_motion_blocked' ||
        ownerTruth.completionOwnerBlockedReason?.endsWith(':setup_motion_blocked')),
    { completionOwnerBlockedReason: ownerTruth.completionOwnerBlockedReason }
  );
  ok(
    'sink promotes deep standard_cycle by demoting retro setup_motion_blocked',
    layer.finalPassAuthoritySimplification.applied === true &&
      layer.finalPassAuthoritySimplification.passOwner === 'completion_truth_standard' &&
      layer.finalPassAuthoritySimplification.sinkReason ===
        'promote_standard_demote_setup_motion_blocked' &&
      layer.progressionPassed === true &&
      layer.finalPassBlockedReason == null &&
      layer.ownerTruth.completionOwnerPassed === true &&
      layer.ownerTruth.finalSuccessOwner === 'completion_truth_standard' &&
      layer.ownerTruth.completionOwnerReason === 'standard_cycle' &&
      layer.uiGate.uiProgressionAllowed === true,
    {
      applied: layer.finalPassAuthoritySimplification,
      finalPassBlockedReason: layer.finalPassBlockedReason,
      uiProgressionAllowed: layer.uiGate.uiProgressionAllowed,
    }
  );
}

// 2. Deep recovery-hold retro veto → demoted to standard pass (quality warning only).
{
  const state = makeDeepRecoveryHoldQualityState();
  const { ownerTruth, layer } = runSinkForState(state);

  ok(
    'pre-sink: deep recovery_hold_too_short blocks owner truth',
    ownerTruth.completionOwnerPassed === false,
    { completionOwnerBlockedReason: ownerTruth.completionOwnerBlockedReason }
  );
  ok(
    'sink promotes deep standard_cycle by demoting recovery_hold_too_short',
    layer.finalPassAuthoritySimplification.applied === true &&
      layer.finalPassAuthoritySimplification.passOwner === 'completion_truth_standard' &&
      layer.finalPassAuthoritySimplification.sinkReason ===
        'promote_standard_demote_recovery_hold_too_short' &&
      layer.progressionPassed === true &&
      layer.finalPassBlockedReason == null,
    { applied: layer.finalPassAuthoritySimplification }
  );
}

// 3. Shallow retro-veto (shallow_descent_too_short) → demoted to official shallow pass.
{
  const state = makeShallowDescentQualityState();
  const { ownerTruth, layer } = runSinkForState(state);

  ok(
    'pre-sink: shallow_descent_too_short blocks shallow owner truth',
    ownerTruth.completionOwnerPassed === false,
    { completionOwnerBlockedReason: ownerTruth.completionOwnerBlockedReason }
  );
  ok(
    'sink promotes official_shallow_cycle by demoting shallow_descent_too_short',
    layer.finalPassAuthoritySimplification.applied === true &&
      layer.finalPassAuthoritySimplification.passOwner ===
        'completion_truth_official_shallow' &&
      layer.finalPassAuthoritySimplification.sinkReason ===
        'promote_official_shallow_demote_shallow_descent_too_short' &&
      layer.progressionPassed === true &&
      layer.finalPassBlockedReason == null &&
      layer.ownerTruth.finalSuccessOwner === 'completion_truth_shallow' &&
      layer.ownerTruth.completionOwnerReason === 'official_shallow_cycle',
    {
      applied: layer.finalPassAuthoritySimplification,
      finalSuccessOwner: layer.ownerTruth.finalSuccessOwner,
      completionOwnerReason: layer.ownerTruth.completionOwnerReason,
    }
  );
}

// 4. False-positive lock: stillSeatedAtPass must remain a failure.
{
  const state = makeDeepRetroSetupVetoState({ stillSeatedAtPass: true });
  const { layer } = runSinkForState(state);

  ok(
    'stillSeatedAtPass retains fail — sink never promotes',
    layer.finalPassAuthoritySimplification.applied === false &&
      layer.progressionPassed === false &&
      layer.finalPassBlockedReason != null,
    {
      applied: layer.finalPassAuthoritySimplification,
      finalPassBlockedReason: layer.finalPassBlockedReason,
    }
  );
}

// 5. False-positive lock: pre-commit setup block must stay blocked.
{
  const state = makeDeepRetroSetupVetoState({
    attemptStarted: false,
    descendConfirmed: false,
    downwardCommitmentReached: false,
    sameRepSetupBlockFirstSeenBeforeCommit: true,
    sameRepSetupBlockFirstSeenAfterCompletion: false,
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
  });
  const { layer } = runSinkForState(state);

  ok(
    'pre-attempt + pre-commit setup block stays final-veto',
    layer.finalPassAuthoritySimplification.applied === false &&
      layer.progressionPassed === false &&
      layer.finalPassBlockedReason != null,
    {
      applied: layer.finalPassAuthoritySimplification,
      finalPassBlockedReason: layer.finalPassBlockedReason,
    }
  );
}

// 6. False-positive lock: no reversal → must stay blocked.
{
  const state = makeDeepRetroSetupVetoState({
    completionBlockedReason: 'no_reversal_after_descend',
    reversalConfirmedAfterDescend: false,
    reversalConfirmedByRuleOrHmm: false,
  });
  const { layer } = runSinkForState(state);

  ok(
    'no-reversal fixture stays blocked — sink does not promote',
    layer.finalPassAuthoritySimplification.applied === false &&
      layer.progressionPassed === false &&
      layer.finalPassBlockedReason != null,
    {
      applied: layer.finalPassAuthoritySimplification,
      finalPassBlockedReason: layer.finalPassBlockedReason,
    }
  );
}

// 7. False-positive lock: no recovery → must stay blocked.
{
  const state = makeDeepRetroSetupVetoState({
    recoveryConfirmedAfterReversal: false,
    completionBlockedReason: 'no_recovery_after_reversal',
  });
  const { layer } = runSinkForState(state);

  ok(
    'no-recovery fixture stays blocked — sink does not promote',
    layer.finalPassAuthoritySimplification.applied === false &&
      layer.progressionPassed === false,
    { applied: layer.finalPassAuthoritySimplification }
  );
}

// 8. False-positive lock: trajectory-only reversal rescue → must stay blocked.
{
  const state = makeDeepRetroSetupVetoState({
    trajectoryReversalRescueApplied: true,
  });
  const { layer } = runSinkForState(state);

  ok(
    'trajectory-only reversal rescue stays blocked — sink does not promote',
    layer.finalPassAuthoritySimplification.applied === false &&
      layer.progressionPassed === false,
    { applied: layer.finalPassAuthoritySimplification }
  );
}

// 9. False-positive lock: genuine too-short hold (explicit false) stays blocked.
{
  const state = makeDeepRecoveryHoldQualityState({
    sameRepStandingRecoveryFinalizeSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
  });
  const { layer } = runSinkForState(state);

  ok(
    'genuine too-short hold (explicit false) stays blocked',
    layer.finalPassAuthoritySimplification.applied === false &&
      layer.progressionPassed === false,
    { applied: layer.finalPassAuthoritySimplification }
  );
}

// 10. Authority invariant: completionOwnerPassed === finalPassEligible on promote.
{
  const state = makeDeepRetroSetupVetoState();
  const { layer } = runSinkForState(state);

  ok(
    'completionOwnerPassed === (finalPassBlockedReason == null) after promote',
    layer.ownerTruth.completionOwnerPassed ===
      (layer.finalPassBlockedReason == null),
    {
      completionOwnerPassed: layer.ownerTruth.completionOwnerPassed,
      finalPassBlockedReason: layer.finalPassBlockedReason,
    }
  );
}

// 11. Direct helper check — owner-already-passed path returns simplificationApplied = false.
{
  const ok1 = resolveSquatFinalPassAuthoritySimplification({
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'standard_cycle',
      completionOwnerBlockedReason: null,
      completionBand: 'standard_or_deep',
      completionInvariantFailureReason: null,
      completionEpochId: 'completion:1:2:3:4',
      finalPassSource: 'completion',
      finalSuccessOwner: 'completion_truth_standard',
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
      completionFinalizedForSurface: false,
      completionFinalizedOwner: null,
      completionFinalizedEpochId: null,
      completionFinalizedTemporalOrderSatisfied: false,
      completionFinalizedPassReason: null,
      completionFinalizedDescentAtMs: null,
      completionFinalizedPeakAtMs: null,
      completionFinalizedReversalAtMs: null,
      completionFinalizedRecoveryAtMs: null,
      surfaceTemporalTruthSource: 'none',
    },
    squatCompletionState: undefined,
  });
  ok(
    'owner already passed → sink is a pass-through (no simplification)',
    ok1.simplificationApplied === false &&
      ok1.authoritySinkReason === 'owner_already_passed' &&
      ok1.passOwner === 'completion_truth_standard',
    ok1
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
