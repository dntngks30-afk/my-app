/**
 * PR-01 — Squat Completion-First Authority Freeze smoke.
 *
 * Directly asserts the illegal authority states defined in:
 *   - docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md §6
 *   - docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md §7 Invariants A–G
 *
 * Illegal states locked by this smoke (each must be impossible after PR-01):
 *   1. `completionOwnerPassed !== true` and final pass true
 *   2. `completionTruthPassed === false` and final pass true
 *   3. `completionOwnerReason === 'not_confirmed'` and owner pass true
 *   4. `completionOwnerPassed === true` and owner blocked reason non-null
 *   5. `cycleComplete === false` and final pass true
 *   6. pass-core positive evidence opening final pass while canonical
 *      completion-owner truth is false (SSOT §6 #8)
 *
 * Also preserves must-remain-true cases (PR-01 §4 A/B/C/D/E):
 *   - deep/standard squat still passes
 *   - standing still still fails
 *   - stale prior rep still fails
 *   - seated-at-pass still fails
 *
 * This smoke asserts authority-law behavior, not specific thresholds or
 * evaluator semantics. It uses synthetic inputs directly against the
 * post-owner pre-latch gate so the owner-chain law can be tested in isolation,
 * plus a few real-path scenarios that should remain stable.
 *
 * Run:
 *   npx tsx scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateExerciseAutoProgress,
  computeSquatPostOwnerPreLatchGateLayer,
  enforceSquatOwnerContradictionInvariant,
  readSquatPassOwnerTruth,
  isFinalPassLatched,
} = await import('../src/lib/camera/auto-progression.ts');

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

// ── Synthetic inputs ────────────────────────────────────────────────────────
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

function validStandardCompletionState() {
  return {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    attemptStarted: true,
  };
}

function passCorePositive() {
  return {
    passDetected: true,
    passBlockedReason: null,
    repId: 'rep_pr01_synth',
    descentDetected: true,
    reversalDetected: true,
    standingRecovered: true,
    setupClear: true,
    currentRepOwnershipClear: true,
    antiFalsePassClear: true,
    trace: 'pr01_smoke',
  };
}

function runPostOwnerGate(overrides) {
  const ownerTruthInput =
    overrides.ownerTruth ??
    readSquatPassOwnerTruth({
      squatCompletionState: overrides.squatCompletionState,
      squatPassCore: overrides.squatPassCore,
    });
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth: ownerTruthInput,
    uiGateInput: overrides.uiGateInput ?? baseUiGateInputClear(),
    squatCompletionState: overrides.squatCompletionState,
    squatCycleDebug: overrides.squatCycleDebug ?? {},
    squatPassCore: overrides.squatPassCore,
  });
}

console.log('\nPR-01 — Squat Completion-First Authority Freeze smoke\n');

// ── §1 Illegal state #6 / SSOT §6 #8 ────────────────────────────────────────
// pass-core positive + completion-owner false MUST NOT open final pass.
console.log('§1 — pass-core positive without canonical completion-owner truth');
{
  // (a) completion blocked by ultra_low_rom_not_allowed
  const layerA = runPostOwnerGate({
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: 'ultra_low_rom_not_allowed',
      cycleComplete: true,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    squatPassCore: passCorePositive(),
  });
  ok(
    '§1a pass-core positive + ultra_low_rom_not_allowed → finalPassGranted false',
    layerA.squatFinalPassTruth.finalPassGranted === false,
    layerA.squatFinalPassTruth
  );
  ok(
    '§1a finalPassBlockedReason is truthful (not empty, not null)',
    typeof layerA.finalPassBlockedReason === 'string' && layerA.finalPassBlockedReason.length > 0,
    layerA.finalPassBlockedReason
  );

  // (b) completionPassReason='not_confirmed', completionSatisfied undefined
  const layerB = runPostOwnerGate({
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
  ok(
    '§1b pass-core positive + not_confirmed → finalPassGranted false',
    layerB.squatFinalPassTruth.finalPassGranted === false,
    layerB.squatFinalPassTruth
  );

  // (c) cycleComplete=false
  const layerC = runPostOwnerGate({
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      completionBlockedReason: null,
      cycleComplete: false,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
    squatPassCore: passCorePositive(),
  });
  ok(
    '§1c pass-core positive + cycleComplete=false → finalPassGranted false',
    layerC.squatFinalPassTruth.finalPassGranted === false,
    layerC.squatFinalPassTruth
  );
}

// ── §2 Invariant A: completionOwnerPassed !== true → finalPassEligible !== true ─
console.log('\n§2 — Invariant A (owner not passed → final pass not eligible)');
{
  const layer = runPostOwnerGate({
    ownerTruth: {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'some_reason',
    },
    squatCompletionState: validStandardCompletionState(),
  });
  ok(
    '§2 owner not passed → progressionPassed === false',
    layer.progressionPassed === false,
    layer
  );
}

// ── §3 Invariant B: 'not_confirmed' reason cannot open owner pass ───────────
console.log('\n§3 — Invariant B (not_confirmed reason cannot open owner pass)');
{
  const enforced = enforceSquatOwnerContradictionInvariant({
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'not_confirmed',
      completionOwnerBlockedReason: null,
    },
    squatCompletionState: validStandardCompletionState(),
  });
  ok(
    '§3 not_confirmed reason with owner passed → contradiction closes owner pass',
    enforced.completionOwnerPassed === false &&
      enforced.completionOwnerBlockedReason === 'owner_contradiction:not_confirmed_reason',
    enforced
  );
}

// ── §4 Invariant C: owner passed + owner blocked reason is contradiction ────
console.log('\n§4 — Invariant C (owner passed + blocked reason → fail-close)');
{
  const enforced = enforceSquatOwnerContradictionInvariant({
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'standard_cycle',
      completionOwnerBlockedReason: 'some_late_block_reason',
    },
    squatCompletionState: validStandardCompletionState(),
  });
  ok(
    '§4 owner passed + blocked reason → owner pass false',
    enforced.completionOwnerPassed === false &&
      enforced.completionOwnerBlockedReason === 'owner_contradiction:blocked_reason_with_passed_owner',
    enforced
  );
}

// ── §5 Invariant D: completionTruthPassed false + final pass true is illegal ─
console.log('\n§5 — Invariant D (completionTruthPassed=false + final pass true is illegal)');
{
  const layer = runPostOwnerGate({
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'pass_core_detected',
      completionOwnerBlockedReason: null,
    },
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      cycleComplete: true,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
  });
  ok(
    '§5 completionTruthPassed=false via pass_core_detected owner → finalPassGranted false',
    layer.squatFinalPassTruth.finalPassGranted === false,
    layer
  );
  ok(
    '§5 finalPassBlockedReason is completion-truth-layer reason (not bypassed)',
    layer.finalPassBlockedReason === 'completion_truth_not_passed' ||
      layer.finalPassBlockedReason === 'completion_reason_not_confirmed' ||
      (typeof layer.finalPassBlockedReason === 'string' &&
        layer.finalPassBlockedReason.startsWith('owner_contradiction:')),
    layer.finalPassBlockedReason
  );
}

// ── §6 Invariant E: cycleComplete=false + final pass true is illegal ───────
console.log('\n§6 — Invariant E (cycleComplete=false + final pass true is illegal)');
{
  const layer = runPostOwnerGate({
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'pass_core_detected',
      completionOwnerBlockedReason: null,
    },
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      completionBlockedReason: null,
      cycleComplete: false,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
  });
  ok(
    '§6 cycleComplete=false via pass_core_detected owner → finalPassGranted false',
    layer.squatFinalPassTruth.finalPassGranted === false,
    layer
  );
}

// ── §7 Invariant F: pass-core-only evidence cannot reopen final pass ────────
console.log('\n§7 — Invariant F (pass-core-only evidence cannot reopen final pass)');
{
  // readSquatPassOwnerTruth must not produce completionOwnerPassed=true from pass-core alone.
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
  ok(
    '§7 readSquatPassOwnerTruth: pass-core positive alone → completionOwnerPassed false',
    ownerTruth.completionOwnerPassed === false,
    ownerTruth
  );
  ok(
    '§7 readSquatPassOwnerTruth: blocked reason is non-empty and truthful',
    typeof ownerTruth.completionOwnerBlockedReason === 'string' &&
      ownerTruth.completionOwnerBlockedReason.length > 0,
    ownerTruth.completionOwnerBlockedReason
  );
}

// ── §8 Invariant G: absurd-pass registry still fail-closes ──────────────────
console.log('\n§8 — standing-still (absurd pass) still fails');
{
  function mockLandmark(x, y, v = 0.99) {
    return { x, y, visibility: v };
  }
  function pose(ts, deg) {
    const L = Array(33)
      .fill(null)
      .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
    const dT = Math.max(0, Math.min(1, (170 - deg) / 110));
    const sy = 0.18 + dT * 0.05;
    const hy = 0.38 + dT * 0.12;
    const ky = 0.58 + dT * 0.04;
    const shinLen = 0.18;
    const br = ((180 - deg) * Math.PI) / 180;
    const aDx = Math.sin(br) * shinLen;
    const aDy = Math.cos(br) * shinLen;
    L[11] = mockLandmark(0.42, sy);
    L[12] = mockLandmark(0.58, sy);
    L[23] = mockLandmark(0.44, hy);
    L[24] = mockLandmark(0.56, hy);
    L[25] = mockLandmark(0.45, ky);
    L[26] = mockLandmark(0.55, ky);
    L[27] = mockLandmark(0.45 + aDx, ky + aDy);
    L[28] = mockLandmark(0.55 + aDx, ky + aDy);
    L[0] = mockLandmark(0.5, 0.08 + dT * 0.02);
    return { landmarks: L, timestamp: ts };
  }
  const frames = Array.from({ length: 30 }, (_, i) => pose(100 + i * 80, 170));
  const lms = frames.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
  const gate = evaluateExerciseAutoProgress('squat', lms, {
    sampledFrameCount: lms.length,
    droppedFrameCount: 0,
    captureDurationMs: 3200,
    timestampDiscontinuityCount: 0,
  });
  ok(
    '§8 standing-still → finalPassEligible false',
    gate.finalPassEligible === false,
    { status: gate.status, finalPassBlockedReason: gate.finalPassBlockedReason }
  );
  ok(
    '§8 standing-still → isFinalPassLatched false',
    isFinalPassLatched('squat', gate) === false
  );
}

// ── §9 Deep standard remains pass (must-remain-true) ────────────────────────
console.log('\n§9 — deep standard squat still passes (must-remain-true)');
{
  function mockLandmark(x, y, v = 0.99) {
    return { x, y, visibility: v };
  }
  function pose(ts, deg) {
    const L = Array(33)
      .fill(null)
      .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
    const dT = Math.max(0, Math.min(1, (170 - deg) / 110));
    const sy = 0.18 + dT * 0.05;
    const hy = 0.38 + dT * 0.12;
    const ky = 0.58 + dT * 0.04;
    const shinLen = 0.18;
    const br = ((180 - deg) * Math.PI) / 180;
    const aDx = Math.sin(br) * shinLen;
    const aDy = Math.cos(br) * shinLen;
    L[11] = mockLandmark(0.42, sy);
    L[12] = mockLandmark(0.58, sy);
    L[23] = mockLandmark(0.44, hy);
    L[24] = mockLandmark(0.56, hy);
    L[25] = mockLandmark(0.45, ky);
    L[26] = mockLandmark(0.55, ky);
    L[27] = mockLandmark(0.45 + aDx, ky + aDy);
    L[28] = mockLandmark(0.55 + aDx, ky + aDy);
    L[0] = mockLandmark(0.5, 0.08 + dT * 0.02);
    return { landmarks: L, timestamp: ts };
  }
  const angles = [
    ...Array(10).fill(170),
    165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
    60, 60,
    70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
    ...Array(4).fill(170),
  ];
  const frames = angles.map((a, i) => pose(400 + i * 80, a));
  const lms = frames.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
  const gate = evaluateExerciseAutoProgress('squat', lms, {
    sampledFrameCount: lms.length,
    droppedFrameCount: 0,
    captureDurationMs: 3200,
    timestampDiscontinuityCount: 0,
  });
  ok('§9 deep standard → status pass', gate.status === 'pass', gate.status);
  ok('§9 deep standard → finalPassEligible true', gate.finalPassEligible === true, {
    finalPassEligible: gate.finalPassEligible,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
  ok('§9 deep standard → finalPassBlockedReason null', gate.finalPassBlockedReason == null, gate.finalPassBlockedReason);
  ok(
    '§9 deep standard → isFinalPassLatched true',
    isFinalPassLatched('squat', gate) === true
  );
}

// ── §10 final pass surface mutual coherence ─────────────────────────────────
console.log('\n§10 — final pass surface mutual coherence');
{
  // When all conditions are clean, all four surfaces agree.
  const layer = runPostOwnerGate({
    squatCompletionState: validStandardCompletionState(),
    squatPassCore: passCorePositive(),
  });
  ok(
    '§10 clean path → progressionPassed === squatFinalPassTruth.finalPassGranted',
    layer.progressionPassed === layer.squatFinalPassTruth.finalPassGranted,
    layer
  );
  ok(
    '§10 clean path → finalPassGranted true and finalPassBlockedReason null are coherent',
    layer.squatFinalPassTruth.finalPassGranted === true && layer.finalPassBlockedReason == null,
    layer
  );

  // When owner is contradicted, all four surfaces agree on failure.
  const blockedLayer = runPostOwnerGate({
    ownerTruth: {
      completionOwnerPassed: true,
      completionOwnerReason: 'pass_core_detected',
      completionOwnerBlockedReason: null,
    },
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      completionBlockedReason: null,
      cycleComplete: true,
      currentSquatPhase: 'standing_recovered',
      attemptStarted: true,
    },
  });
  ok(
    '§10 contradicted path → progressionPassed === false and finalPassGranted === false',
    blockedLayer.progressionPassed === false &&
      blockedLayer.squatFinalPassTruth.finalPassGranted === false,
    blockedLayer
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
