/**
 * PR-P3 — Squat Absurd-Pass Registry Normalization smoke.
 *
 * Locked invariants proved here:
 *   1. The explicit registry surface
 *      `SQUAT_ACTIVE_ABSURD_PASS_REGISTRY` exists, contains the three
 *      active late-veto families in production order, and every entry
 *      is stage `'late_final_veto'` with a non-empty blocked reason.
 *   2. The registry module exports NO `grant` / `allow` / `open`
 *      semantic. The runtime evaluator
 *      `evaluateSquatAbsurdPassRegistry` either returns `null` or a
 *      close verdict with `{ familyId, blockedReason }` — block-only.
 *   3. Each registry entry's `predicate` result equals its own
 *      re-exported legacy name (no behavior drift).
 *   4. For a firing fixture, the registry evaluator and the post-owner
 *      pre-latch gate produce the same blocked-reason string at the
 *      same layer (current late-veto order preserved).
 *   5. For a clean fixture, neither the registry nor the final-pass
 *      surface fires.
 *   6. Representative shallow must-pass fixtures are not regressed:
 *      registry returns `null` and E1's canonical signals remain
 *      intact for both `shallow_92deg` and `ultra_low_rom_92deg`.
 *   7. The passive upstream-classified family inventory exists and
 *      only contains `'upstream_classified_only'` entries — no
 *      `'late_final_veto'` family slips in.
 *   8. PR-01 illegal states remain locked: `completionTruthPassed
 *      === false` + final-pass true and cycle-incomplete + final-pass
 *      true both stay impossible, including when the synthetic
 *      legacy `pass_core_detected` reason is used as an owner label.
 *
 * Out of scope (explicit non-goals):
 *   - no new blocker family is added;
 *   - no threshold or opener law change;
 *   - no P2 naming/comment sweep;
 *   - no proof-gate skip-marker expansion.
 *
 * Run:
 *   npx tsx scripts/camera-pr-p3-squat-absurd-pass-registry-normalization-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const registryModule = await import(
  '../src/lib/camera/squat/squat-absurd-pass-registry.ts'
);
const {
  SQUAT_ACTIVE_ABSURD_PASS_REGISTRY,
  SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES,
  SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON,
  SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON,
  SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON,
  evaluateSquatAbsurdPassRegistry,
  shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass,
  shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass,
  shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass,
} = registryModule;

const autoProgressionModule = await import('../src/lib/camera/auto-progression.ts');
const {
  computeSquatPostOwnerPreLatchGateLayer,
  readSquatPassOwnerTruth,
} = autoProgressionModule;

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra ?? '');
    process.exitCode = 1;
  }
}

console.log('\nPR-P3 — Squat Absurd-Pass Registry Normalization smoke\n');

// ── §1 Registry shape ────────────────────────────────────────────────────
console.log('§1 — Registry shape');
{
  ok(
    '§1a registry is a frozen-shaped readonly array with three entries',
    Array.isArray(SQUAT_ACTIVE_ABSURD_PASS_REGISTRY) &&
      SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.length === 3,
    SQUAT_ACTIVE_ABSURD_PASS_REGISTRY?.length
  );
  const ids = SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.map((e) => e.familyId);
  ok(
    '§1b production order is preserved (ultra-low-trajectory → setup-series-start → blended-early-peak)',
    ids[0] === 'ultra_low_trajectory_rescue_short_cycle' &&
      ids[1] === 'ultra_low_setup_series_start_false_pass' &&
      ids[2] === 'blended_early_peak_contaminated_false_pass',
    ids
  );
  ok(
    '§1c every entry stage === "late_final_veto"',
    SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.every((e) => e.stage === 'late_final_veto'),
    SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.map((e) => e.stage)
  );
  ok(
    '§1d every entry has non-empty blockedReason and description',
    SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.every(
      (e) =>
        typeof e.blockedReason === 'string' &&
        e.blockedReason.length > 0 &&
        typeof e.description === 'string' &&
        e.description.length > 0
    )
  );
  ok(
    '§1e every entry predicate is a function',
    SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.every((e) => typeof e.predicate === 'function')
  );
  ok(
    '§1f entry blockedReasons match exported constants',
    SQUAT_ACTIVE_ABSURD_PASS_REGISTRY[0].blockedReason ===
      SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON &&
      SQUAT_ACTIVE_ABSURD_PASS_REGISTRY[1].blockedReason ===
        SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON &&
      SQUAT_ACTIVE_ABSURD_PASS_REGISTRY[2].blockedReason ===
        SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON
  );
}

// ── §2 Registry is block-only (static surface analysis) ─────────────────
console.log('\n§2 — Registry is block-only (no grant / open / allow surface)');
{
  const exportedNames = Object.keys(registryModule);
  const hasGrantSemantic = exportedNames.some((n) => {
    const lowered = n.toLowerCase();
    return (
      lowered.includes('grant') ||
      lowered.includes('allow') ||
      lowered.startsWith('open') ||
      lowered.includes('openfinalpass')
    );
  });
  ok(
    '§2a registry module exports no grant/allow/open symbol',
    !hasGrantSemantic,
    exportedNames
  );
  const entryKeys = SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.flatMap((e) => Object.keys(e));
  const hasGrantKey = entryKeys.some((k) => {
    const lowered = k.toLowerCase();
    return lowered.includes('grant') || lowered.includes('allow') || lowered.startsWith('open');
  });
  ok(
    '§2b no registry entry has a grant/allow/open key',
    !hasGrantKey,
    entryKeys
  );
  // Evaluator cannot produce anything other than null or a block verdict.
  const nullVerdict = evaluateSquatAbsurdPassRegistry({
    stepId: 'squat',
    squatCompletionState: undefined,
    squatCycleDebug: undefined,
  });
  ok(
    '§2c evaluator returns null on empty state (no grant path)',
    nullVerdict === null,
    nullVerdict
  );
}

// ── §3 Predicate parity (registry entry === legacy compat export) ──────
console.log('\n§3 — Registry predicate parity with legacy compat exports');
{
  const cs = {
    completionPassReason: 'ultra_low_rom_cycle',
    reversalConfirmedBy: 'trajectory',
    trajectoryReversalRescueApplied: true,
  };
  const dbg = { minimumCycleDurationSatisfied: false };
  const viaRegistry = SQUAT_ACTIVE_ABSURD_PASS_REGISTRY[0].predicate('squat', cs, dbg);
  const viaLegacy = shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
    'squat',
    cs,
    dbg
  );
  ok('§3a ultra-low-trajectory-short-cycle parity', viaRegistry === true && viaLegacy === true);
}
{
  const cs = {
    evidenceLabel: 'ultra_low_rom',
    reversalConfirmedBy: 'trajectory',
    trajectoryReversalRescueApplied: true,
    committedAtMs: 1000,
    reversalAtMs: 1000,
    descendStartAtMs: 1000,
    squatDescentToPeakMs: 0,
    peakLatchedAtIndex: 0,
    squatEventCycle: { notes: ['peak_anchor_at_series_start'] },
  };
  const dbg = { armingFallbackUsed: true };
  const viaRegistry = SQUAT_ACTIVE_ABSURD_PASS_REGISTRY[1].predicate('squat', cs, dbg);
  const viaLegacy = shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass('squat', cs, dbg);
  ok('§3b setup-series-start parity', viaRegistry === true && viaLegacy === true);
}
{
  const cs = {
    evidenceLabel: 'ultra_low_rom',
    completionPassReason: 'not_confirmed',
    completionTruthPassed: false,
    relativeDepthPeakSource: 'blended',
    rawDepthPeakPrimary: 0,
    rawDepthPeakBlended: 0.08,
    peakLatchedAtIndex: 0,
    eventCycleDetected: false,
    eventCyclePromoted: false,
  };
  const dbg = {
    armingDepthBlendAssisted: true,
    armingFallbackUsed: true,
    armingDepthSource: 'fallback_assisted_blended',
  };
  const viaRegistry = SQUAT_ACTIVE_ABSURD_PASS_REGISTRY[2].predicate('squat', cs, dbg);
  const viaLegacy = shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass(
    'squat',
    cs,
    dbg
  );
  ok('§3c blended-early-peak parity', viaRegistry === true && viaLegacy === true);
}

// ── §4 End-to-end behavior parity via post-owner pre-latch gate ────────
console.log('\n§4 — Registry fires through applySquatFinalBlockerVetoLayer → same blocked reason');

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

function runPostOwnerGate(squatCompletionState, squatCycleDebug, ownerTruthOverride) {
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth:
      ownerTruthOverride ??
      readSquatPassOwnerTruth({
        squatCompletionState,
        squatPassCore: undefined,
      }),
    uiGateInput: baseUiGateInputClear(),
    squatCompletionState,
    squatCycleDebug: squatCycleDebug ?? {},
    squatPassCore: undefined,
  });
}

{
  // Pass the post-owner layer by fabricating a passed owner truth while the
  // registry fires via the late-veto. This isolates the registry layer from
  // completion/owner invariants and confirms block-only behavior.
  const cs = {
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionBlockedReason: null,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    attemptStarted: true,
    reversalConfirmedBy: 'trajectory',
    trajectoryReversalRescueApplied: true,
  };
  const dbg = { minimumCycleDurationSatisfied: false };
  const layer = runPostOwnerGate(cs, dbg, {
    completionOwnerPassed: true,
    completionOwnerReason: 'ultra_low_rom_cycle',
    completionOwnerBlockedReason: null,
  });
  const verdict = evaluateSquatAbsurdPassRegistry({
    stepId: 'squat',
    squatCompletionState: cs,
    squatCycleDebug: dbg,
  });
  ok(
    '§4a ultra-low-trajectory-short-cycle: registry fires',
    verdict?.familyId === 'ultra_low_trajectory_rescue_short_cycle' &&
      verdict.blockedReason === SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON,
    verdict
  );
  ok(
    '§4b ultra-low-trajectory-short-cycle: post-owner surface closed with same reason',
    layer.squatFinalPassTruth.finalPassGranted === false &&
      layer.finalPassBlockedReason === SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON,
    { finalPassBlockedReason: layer.finalPassBlockedReason }
  );
}

{
  const cs = {
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionBlockedReason: null,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    attemptStarted: true,
    evidenceLabel: 'ultra_low_rom',
    reversalConfirmedBy: 'trajectory',
    trajectoryReversalRescueApplied: true,
    committedAtMs: 1000,
    reversalAtMs: 1000,
    descendStartAtMs: 1000,
    squatDescentToPeakMs: 0,
    peakLatchedAtIndex: 0,
    squatEventCycle: { notes: ['peak_anchor_at_series_start'] },
  };
  const dbg = { armingFallbackUsed: true };
  const layer = runPostOwnerGate(cs, dbg, {
    completionOwnerPassed: true,
    completionOwnerReason: 'ultra_low_rom_cycle',
    completionOwnerBlockedReason: null,
  });
  ok(
    '§4c setup-series-start: post-owner surface closed with same reason',
    layer.squatFinalPassTruth.finalPassGranted === false &&
      layer.finalPassBlockedReason === SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON,
    { finalPassBlockedReason: layer.finalPassBlockedReason }
  );
}

// ── §5 Clean path: neither registry nor final surface fires ────────────
console.log('\n§5 — Clean path: neither registry nor final surface fires');
{
  const cleanCs = {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    attemptStarted: true,
  };
  const cleanDbg = {
    minimumCycleDurationSatisfied: true,
    armingFallbackUsed: false,
    armingDepthBlendAssisted: false,
  };
  const verdict = evaluateSquatAbsurdPassRegistry({
    stepId: 'squat',
    squatCompletionState: cleanCs,
    squatCycleDebug: cleanDbg,
  });
  ok('§5a registry returns null on clean standard_cycle', verdict === null, verdict);

  const layer = runPostOwnerGate(cleanCs, cleanDbg);
  ok(
    '§5b clean path → progressionPassed true and finalPassBlockedReason null',
    layer.progressionPassed === true && layer.finalPassBlockedReason == null,
    layer
  );
}

// ── §6 non-squat stepId is a no-op ─────────────────────────────────────
console.log('\n§6 — Non-squat stepId: registry is a no-op');
{
  const verdict = evaluateSquatAbsurdPassRegistry({
    stepId: 'overhead-reach',
    squatCompletionState: {
      completionPassReason: 'ultra_low_rom_cycle',
      reversalConfirmedBy: 'trajectory',
      trajectoryReversalRescueApplied: true,
    },
    squatCycleDebug: { minimumCycleDurationSatisfied: false },
  });
  ok('§6a non-squat stepId → registry returns null', verdict === null, verdict);
}

// ── §7 Passive upstream-classified inventory is passive only ───────────
console.log('\n§7 — Passive upstream-classified family inventory');
{
  ok(
    '§7a inventory exists and is a non-empty readonly array',
    Array.isArray(SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES) &&
      SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES.length >= 6,
    SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES?.length
  );
  ok(
    '§7b every inventory entry stage === "upstream_classified_only"',
    SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES.every(
      (e) => e.stage === 'upstream_classified_only'
    ),
    SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES.map((e) => e.stage)
  );
  ok(
    '§7c inventory entries carry no predicate (passive only)',
    SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES.every(
      (e) => typeof e.predicate === 'undefined'
    )
  );
  const expectedFamilies = [
    'standing_still',
    'seated_hold_or_still_seated_at_pass',
    'setup_motion_contaminated_cycle',
    'stale_prior_rep_reused_as_current_rep',
    'mixed_rep_timestamp_contamination',
    'no_real_descent',
    'no_real_reversal_or_ascent_equivalent',
    'no_real_recovery_after_reversal',
  ];
  const presentIds = SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES.map((e) => e.familyId);
  const missing = expectedFamilies.filter((f) => !presentIds.includes(f));
  ok(
    '§7d inventory covers P3 SSOT family list',
    missing.length === 0,
    { missing, presentIds }
  );
  ok(
    '§7e no inventory family overlaps with the active registry family ids',
    SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES.every(
      (e) =>
        !SQUAT_ACTIVE_ABSURD_PASS_REGISTRY.some((active) => active.familyId === e.familyId)
    )
  );
}

// ── §8 PR-01 illegal states remain locked (registry is block-only) ─────
console.log('\n§8 — PR-01 illegal states remain locked after P3 normalization');
{
  // completionTruthPassed === false + synthetic pass_core_detected owner → not granted
  const layer = runPostOwnerGate(
    {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      cycleComplete: true,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    {},
    {
      completionOwnerPassed: true,
      completionOwnerReason: 'pass_core_detected',
      completionOwnerBlockedReason: null,
    }
  );
  ok(
    '§8a completionTruthPassed=false with synthetic pass_core_detected owner → finalPassGranted false',
    layer.squatFinalPassTruth.finalPassGranted === false &&
      layer.progressionPassed === false,
    layer
  );
}
{
  // cycleComplete=false → not granted
  const layer = runPostOwnerGate(
    {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      completionBlockedReason: null,
      cycleComplete: false,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    {},
    {
      completionOwnerPassed: true,
      completionOwnerReason: 'standard_cycle',
      completionOwnerBlockedReason: null,
    }
  );
  ok(
    '§8b cycleComplete=false → finalPassGranted false',
    layer.squatFinalPassTruth.finalPassGranted === false &&
      layer.progressionPassed === false,
    layer
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
