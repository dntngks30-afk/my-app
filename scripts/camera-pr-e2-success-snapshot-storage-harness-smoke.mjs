/**
 * PR-E2 — Success Snapshot Storage Harness Lock
 *
 * Scope: close the blind spot where Node regression could not verify the real
 *        `recordSquatSuccessSnapshot(...)` → `pushSuccessSnapshot(...)` → `getRecentSuccessSnapshots()`
 *        storage path end-to-end.
 *
 * What this script does:
 *   1. Installs a minimal browser-like stub (window + localStorage) so the real
 *      runtime path can execute unchanged in Node.
 *   2. Calls the REAL `recordSquatSuccessSnapshot(...)` — no bypass allowed.
 *   3. Reads back via the REAL `getRecentSuccessSnapshots()`.
 *   4. Asserts §8.1 (real-success fields), §8.2 (mismatch-injected), §8.3 (read-back
 *      shape), §8.4 (cleanup), §11 Matrix A/B/C.
 *   5. Cleans up storage after every assertion group.
 *
 * What this script must NOT do:
 *   - Bypass recordSquatSuccessSnapshot by directly constructing payloads.
 *   - Modify pass policy, severity logic, or semantics source selection.
 *   - Add test-only branches inside production files.
 *   - Mix E1 (shallow promotion) or E3 (setup/framing false-pass) logic.
 *
 * Run:
 *   npx tsx scripts/camera-pr-e2-success-snapshot-storage-harness-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// ── §7.2 Minimal browser-like stub ──────────────────────────────────────────
// Install BEFORE any production module imports so the typeof-window guards
// inside camera-success-diagnostic.ts resolve correctly.
//
// Only stubbing what the real runtime path actually needs:
//   - global.window
//   - window.location.pathname / .search
//   - global.localStorage (Map-backed in-memory store)

const _store = new Map();
const _localStorage = {
  getItem(key) {
    return _store.has(key) ? _store.get(key) : null;
  },
  setItem(key, value) {
    _store.set(key, String(value));
  },
  removeItem(key) {
    _store.delete(key);
  },
  clear() {
    _store.clear();
  },
  get length() {
    return _store.size;
  },
  key(index) {
    return Array.from(_store.keys())[index] ?? null;
  },
};

// global.window must be set before module import so typeof-window checks pass
global.window = /** @type {any} */ ({
  location: { pathname: '/app/squat', search: '' },
  localStorage: _localStorage,
});
global.localStorage = _localStorage;

// ── Production module imports ────────────────────────────────────────────────
const {
  recordSquatSuccessSnapshot,
  getRecentSuccessSnapshots,
  clearSuccessSnapshots,
} = await import('../src/lib/camera/camera-success-diagnostic.ts');

// ── Test harness helpers ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${d}`);
    process.exitCode = 1;
  }
}

/** §7.3 deterministic storage cleanup before each assertion group */
function clearStorage() {
  clearSuccessSnapshots();
}

// ── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * Minimal ExerciseGateResult fixture for a real successful squat.
 * Follows the same minimal-gate pattern used by PR-D Matrix 4 mismatch fixture,
 * adapted for a passing gate (finalPassEligible=true, squatFinalPassTruth aligned).
 *
 * No engine evaluation is called here — we are testing the STORAGE PATH,
 * not the gate evaluator. Gate truth is expressed via the fixture directly
 * (the same approach used throughout PR-D for semantics-surface tests).
 */
function makeSuccessGateFixture() {
  return {
    status: 'pass',
    progressionState: 'pass',
    confidence: 0.91,
    completionSatisfied: true,
    nextAllowed: true,
    flags: [],
    reasons: [],
    failureReasons: [],
    userGuidance: [],
    retryRecommended: false,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 4,
    passConfirmationWindowCount: 1,
    finalPassEligible: true,
    finalPassBlockedReason: null,
    guardrail: {
      captureQuality: 'ok',
      flags: [],
      retryRecommended: false,
      completionStatus: 'complete',
      debug: {},
    },
    evaluatorResult: {
      stepId: 'squat',
      metrics: [],
      qualityHints: [],
      completionHints: [],
      interpretedSignals: [],
      debug: {
        highlightedMetrics: {
          depthPeak: 0.42,
          baselineStandingDepth: 0.1,
          rawDepthPeak: 0.32,
          relativeDepthPeak: 0.32,
          ascentRecovered: 1,
          ascentRecoveredLowRom: 0,
          ascentRecoveredUltraLowRom: 0,
        },
        squatCompletionState: {
          completionSatisfied: true,
          completionPassReason: 'standard_cycle',
          currentSquatPhase: 'standing_recovered',
          cycleComplete: true,
          completionTruthPassed: true,
          lowQualityPassAllowed: false,
          passOwner: 'standard',
          finalSuccessOwner: 'standard',
          standardOwnerEligible: true,
          shadowEventOwnerEligible: false,
        },
      },
    },
    squatCycleDebug: {
      cycleComplete: true,
      depthBand: 'standard',
      romBand: 'standard',
      completionStatus: 'complete',
      passBlockedReason: null,
      descendDetected: true,
      bottomDetected: true,
      recoveryDetected: true,
      startBeforeBottom: true,
      captureArmingSatisfied: true,
      completionTruthPassed: true,
      lowQualityPassAllowed: false,
      passOwner: 'standard',
      finalSuccessOwner: 'standard',
      standardOwnerEligible: true,
      shadowEventOwnerEligible: false,
      completionPathUsed: 'standard',
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
      descendStartAtMs: 200,
      reversalAtMs: 900,
      recoveryAtMs: 1600,
      standingRecoveredAtMs: 1700,
      standingRecoveryHoldMs: 400,
      standingRecoveryFrameCount: 5,
      standingRecoveryMinFramesUsed: 3,
      standingRecoveryMinHoldMsUsed: 300,
      standingRecoveryBand: 'standard',
      standingRecoveryFinalizeReason: 'hold_satisfied',
      successPhaseAtOpen: 'standing_recovered',
      evidenceLabel: 'standard_cycle',
      cycleDurationMs: 1400,
      squatFinalPassTruth: {
        finalPassGranted: true,
        finalPassBlockedReason: null,
        finalPassTruthSource: 'post_owner_ui_gate',
        motionOwnerSource: 'pass_core',
        finalPassGrantedReason: 'post_owner_final_pass_clear',
      },
    },
  };
}

/**
 * Mismatch fixture: gate says false, squatFinalPassTruth says true.
 * Mirrors exactly the gateMismatch fixture from PR-D Matrix 4m,
 * adapted for storage-path assertion (§8.2).
 */
function makeMismatchGateFixture() {
  return {
    status: 'retry',
    progressionState: 'blocked',
    confidence: 0.65,
    completionSatisfied: true,
    nextAllowed: false,
    flags: [],
    reasons: [],
    failureReasons: [],
    userGuidance: [],
    retryRecommended: false,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    passConfirmationWindowCount: 1,
    finalPassEligible: false,
    finalPassBlockedReason: 'ui_progression_blocked',
    guardrail: {
      captureQuality: 'ok',
      flags: [],
      retryRecommended: false,
      completionStatus: 'complete',
      debug: {},
    },
    evaluatorResult: {
      stepId: 'squat',
      metrics: [],
      qualityHints: [],
      completionHints: [],
      interpretedSignals: [],
      debug: {
        highlightedMetrics: {
          depthPeak: 0.38,
          baselineStandingDepth: 0.1,
          rawDepthPeak: 0.28,
          relativeDepthPeak: 0.28,
          ascentRecovered: 1,
          ascentRecoveredLowRom: 0,
          ascentRecoveredUltraLowRom: 0,
        },
        squatCompletionState: {
          completionSatisfied: true,
          completionPassReason: 'standard_cycle',
          currentSquatPhase: 'standing_recovered',
          cycleComplete: true,
        },
      },
    },
    squatCycleDebug: {
      cycleComplete: true,
      depthBand: 'standard',
      completionStatus: 'complete',
      passBlockedReason: null,
      descendDetected: true,
      bottomDetected: true,
      recoveryDetected: true,
      startBeforeBottom: true,
      captureArmingSatisfied: true,
      completionTruthPassed: true,
      cycleDurationMs: 1300,
      squatFinalPassTruth: {
        finalPassGranted: true,
        finalPassBlockedReason: null,
        finalPassTruthSource: 'post_owner_ui_gate',
        motionOwnerSource: 'pass_core',
        finalPassGrantedReason: 'post_owner_final_pass_clear',
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix C — storage lifecycle (pre-checks before write tests)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix C — storage lifecycle ━━');

{
  clearStorage();
  const before = getRecentSuccessSnapshots();
  ok('Matrix C: clear before write → empty list', Array.isArray(before) && before.length === 0, before.length);
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix A — real success snapshot storage (§8.1)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix A — real success snapshot storage (§8.1) ━━');

{
  clearStorage();

  // §7.1 MUST call the real function — bypass is forbidden
  recordSquatSuccessSnapshot({
    gate: makeSuccessGateFixture(),
    successOpenedBy: 'finalPassLatched',
    currentRoute: '/app/squat',
    passLatchedAtMs: Date.now(),
    effectivePassLatched: true,
    competingPaths: [],
  });

  const snapshots = getRecentSuccessSnapshots();

  // §11 Matrix C: write once → list length 1
  ok('Matrix C: write once → list length 1', snapshots.length === 1, snapshots.length);

  const snap = snapshots[0];

  // §8.1 required fields
  ok('§8.1: motionType === squat', snap?.motionType === 'squat', snap?.motionType);
  ok('§8.1: passSemanticsTruth === final_pass_surface', snap?.passSemanticsTruth === 'final_pass_surface', snap?.passSemanticsTruth);
  ok('§8.1: finalPassGranted === true', snap?.finalPassGranted === true, snap?.finalPassGranted);
  ok('§8.1: finalPassSemanticsSource present', typeof snap?.finalPassSemanticsSource === 'string' && snap.finalPassSemanticsSource.length > 0, snap?.finalPassSemanticsSource);
  ok('§8.1: finalPassSemanticsSource = gate_final_pass_eligible', snap?.finalPassSemanticsSource === 'gate_final_pass_eligible', snap?.finalPassSemanticsSource);
  ok('§8.1: finalPassSemanticsMismatchDetected === false (aligned sources)', snap?.finalPassSemanticsMismatchDetected === false, snap?.finalPassSemanticsMismatchDetected);
  ok('§8.1: passSeverity !== failed', snap?.passSeverity !== 'failed', snap?.passSeverity);
  ok('§8.1: resultInterpretation !== movement_not_completed', snap?.resultInterpretation !== 'movement_not_completed', snap?.resultInterpretation);
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix B — mismatch preservation (§8.2)
// gate=false / squatFinalPassTruth.finalPassGranted=true → mismatch stored
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Matrix B — mismatch preservation (§8.2) ━━');

{
  clearStorage();

  recordSquatSuccessSnapshot({
    gate: makeMismatchGateFixture(),
    successOpenedBy: 'finalPassLatched',
    currentRoute: '/app/squat',
    passLatchedAtMs: Date.now(),
    effectivePassLatched: false,
    competingPaths: [],
  });

  const snapshots = getRecentSuccessSnapshots();
  ok('Matrix B: write once → list length 1', snapshots.length === 1, snapshots.length);

  const snap = snapshots[0];

  // §8.2 required invariants
  ok('§8.2: finalPassGranted === false (gate wins, no OR-union)', snap?.finalPassGranted === false, snap?.finalPassGranted);
  ok('§8.2: source = gate_final_pass_eligible', snap?.finalPassSemanticsSource === 'gate_final_pass_eligible', snap?.finalPassSemanticsSource);
  ok('§8.2: finalPassSemanticsMismatchDetected === true', snap?.finalPassSemanticsMismatchDetected === true, snap?.finalPassSemanticsMismatchDetected);
  ok('§8.2: passSeverity === failed', snap?.passSeverity === 'failed', snap?.passSeverity);
  ok('§8.2: no OR-union — finalPassGranted not widened to true', snap?.finalPassGranted !== true, snap?.finalPassGranted);
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.3 Read-back shape preservation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ §8.3 — Read-back shape preservation ━━');

{
  clearStorage();

  recordSquatSuccessSnapshot({
    gate: makeSuccessGateFixture(),
    successOpenedBy: 'finalPassLatched',
    currentRoute: '/app/squat',
    passLatchedAtMs: Date.now(),
    effectivePassLatched: true,
    competingPaths: [],
  });

  const readBack = getRecentSuccessSnapshots();
  const snap = readBack[0];

  ok('§8.3: read-back returns array', Array.isArray(readBack), typeof readBack);
  ok('§8.3: read-back[0] is object', snap != null && typeof snap === 'object', typeof snap);
  ok('§8.3: canonical field finalPassGranted preserved after serialization round-trip', typeof snap?.finalPassGranted === 'boolean', typeof snap?.finalPassGranted);
  ok('§8.3: canonical field finalPassSemanticsSource preserved', typeof snap?.finalPassSemanticsSource === 'string', typeof snap?.finalPassSemanticsSource);
  ok('§8.3: canonical field finalPassSemanticsMismatchDetected preserved', typeof snap?.finalPassSemanticsMismatchDetected === 'boolean', typeof snap?.finalPassSemanticsMismatchDetected);
  ok('§8.3: canonical field passSemanticsTruth preserved', snap?.passSemanticsTruth === 'final_pass_surface', snap?.passSemanticsTruth);
  ok('§8.3: canonical field passSeverity preserved', typeof snap?.passSeverity === 'string', snap?.passSeverity);
  ok('§8.3: motionType preserved across round-trip', snap?.motionType === 'squat', snap?.motionType);
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.4 / §11 Matrix C — cleanup after read → empty list
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ §8.4 / Matrix C — cleanup after read ━━');

{
  // Storage should still contain the entry from §8.3 block above
  const beforeCleanup = getRecentSuccessSnapshots();
  ok('§8.4 pre: list non-empty before cleanup', beforeCleanup.length > 0, beforeCleanup.length);

  clearStorage();

  const afterCleanup = getRecentSuccessSnapshots();
  ok('§8.4: cleanup → empty list', Array.isArray(afterCleanup) && afterCleanup.length === 0, afterCleanup.length);
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 Matrix C full lifecycle — clear → write → read → cleanup
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ §11 Matrix C — full lifecycle (clear → write → read → cleanup) ━━');

{
  clearStorage();
  const afterClear = getRecentSuccessSnapshots();
  ok('Matrix C full: clear → empty', afterClear.length === 0, afterClear.length);

  recordSquatSuccessSnapshot({
    gate: makeSuccessGateFixture(),
    successOpenedBy: 'finalPassLatched',
    currentRoute: '/app/squat',
    passLatchedAtMs: Date.now(),
    effectivePassLatched: true,
    competingPaths: [],
  });

  const afterWrite = getRecentSuccessSnapshots();
  ok('Matrix C full: write once → length 1', afterWrite.length === 1, afterWrite.length);

  clearStorage();
  const afterFinalCleanup = getRecentSuccessSnapshots();
  ok('Matrix C full: cleanup after read → empty', afterFinalCleanup.length === 0, afterFinalCleanup.length);
}

// ═══════════════════════════════════════════════════════════════════════════
// Semantics non-regression guard
// Confirms the storage path does not silently alter pass semantics.
// Both real-success and mismatch cases must express the exact same truth
// that readSquatFinalPassSemanticsTruth would compute directly.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━ Semantics non-regression guard ━━');

{
  const { readSquatFinalPassSemanticsTruth } = await import(
    '../src/lib/camera/squat/squat-final-pass-semantics.ts'
  );

  // Real-success case
  const successGate = makeSuccessGateFixture();
  const directRead = readSquatFinalPassSemanticsTruth({
    finalPassEligible: successGate.finalPassEligible,
    squatFinalPassTruth: successGate.squatCycleDebug?.squatFinalPassTruth,
  });

  clearStorage();
  recordSquatSuccessSnapshot({
    gate: successGate,
    successOpenedBy: 'finalPassLatched',
    currentRoute: '/app/squat',
    passLatchedAtMs: Date.now(),
    effectivePassLatched: true,
    competingPaths: [],
  });
  const storedSuccess = getRecentSuccessSnapshots()[0];

  ok(
    'Semantics guard: stored finalPassGranted matches direct read (success case)',
    storedSuccess?.finalPassGranted === directRead.finalPassGranted,
    { stored: storedSuccess?.finalPassGranted, direct: directRead.finalPassGranted }
  );
  ok(
    'Semantics guard: stored source matches direct read (success case)',
    storedSuccess?.finalPassSemanticsSource === directRead.source,
    { stored: storedSuccess?.finalPassSemanticsSource, direct: directRead.source }
  );
  ok(
    'Semantics guard: stored mismatch matches direct read (success case)',
    storedSuccess?.finalPassSemanticsMismatchDetected === directRead.mismatchDetected,
    { stored: storedSuccess?.finalPassSemanticsMismatchDetected, direct: directRead.mismatchDetected }
  );

  // Mismatch case
  const mismatchGate = makeMismatchGateFixture();
  const directReadM = readSquatFinalPassSemanticsTruth({
    finalPassEligible: mismatchGate.finalPassEligible,
    squatFinalPassTruth: mismatchGate.squatCycleDebug?.squatFinalPassTruth,
  });

  clearStorage();
  recordSquatSuccessSnapshot({
    gate: mismatchGate,
    successOpenedBy: 'finalPassLatched',
    currentRoute: '/app/squat',
    passLatchedAtMs: Date.now(),
    effectivePassLatched: false,
    competingPaths: [],
  });
  const storedMismatch = getRecentSuccessSnapshots()[0];

  ok(
    'Semantics guard: stored finalPassGranted matches direct read (mismatch case)',
    storedMismatch?.finalPassGranted === directReadM.finalPassGranted,
    { stored: storedMismatch?.finalPassGranted, direct: directReadM.finalPassGranted }
  );
  ok(
    'Semantics guard: stored mismatch flag matches direct read (mismatch case)',
    storedMismatch?.finalPassSemanticsMismatchDetected === directReadM.mismatchDetected,
    { stored: storedMismatch?.finalPassSemanticsMismatchDetected, direct: directReadM.mismatchDetected }
  );

  // Final cleanup
  clearStorage();
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n━━━ PR-E2 success snapshot storage harness: ${passed} passed, ${failed} failed ━━━`
);
process.exit(failed > 0 ? 1 : 0);
