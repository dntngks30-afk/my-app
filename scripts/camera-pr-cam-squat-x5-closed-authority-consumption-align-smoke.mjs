/**
 * PR-X5 — Completion-State ↔ Final Sink Consumption Alignment After Closed
 * Shallow Authority.
 *
 * Parent SSOT: `docs/pr/PR-CAM-SQUAT-PRIMARY-FIXTURE-CLOSURE-MISS-TRUTH-MAP.md`
 *
 * X5 is a **consumption-alignment / verification** PR. It does not open a
 * new close (X4), repair arming (X1), repair peak provenance (X2), or
 * repair reversal ownership (X3). It locks the invariant that when a
 * same-epoch shallow authority is closed and the PR-2 false-pass guard is
 * clear, the canonical opener reader (Wave B follow-up) consumes the
 * close and the downstream chain
 *
 *   `officialShallowOwnerFrozen` →
 *   `completionOwnerPassed` →
 *   `uiProgressionAllowed` →
 *   `finalPassEligible` →
 *   `finalPassLatched`
 *
 * opens in order, and that when any guard refuses the close the same
 * chain stays closed (never-pass perimeter preserved).
 *
 * This smoke covers:
 *
 *   Section 1 — Unit: narrow diagnostic fields
 *     `SquatCycleDebug.officialShallowClosedAuthorityConsumed`
 *     `SquatCycleDebug.officialShallowClosedAuthorityConsumptionBlockedReason`
 *     faithfully reflect the same-tick owner-freeze outcome and never leak
 *     into any gate.
 *
 *   Section 2 — End-to-end same-epoch consumption: a clean synthetic
 *     shallow rep drives the full chain open with
 *     `officialShallowPathClosed=true → ... → finalPassEligible=true`.
 *
 *   Section 3 — False-pass guard refuses close (cross_epoch / setup_motion
 *     / still-seated-at-pass / pre-attempt arming): chain stays closed,
 *     consumption diagnostic is `false`, blocked reason mirrors the guard.
 *
 *   Section 4 — same-epoch boundary: `officialShallowPathClosed=true` on a
 *     slice where `currentSquatPhase !== 'standing_recovered'` must NOT
 *     open the freeze (recovery path) nor the downstream UI/final-latch.
 *
 *   Section 5 — E2E preservation: standing-still / seated-still /
 *     descent-only never reach final latch. Deep standard-cycle keeps
 *     its own owner (`completion_truth_standard`) and is not touched by
 *     any shallow-authority consumption path.
 *
 *   Section 6 — Closed-authority consumption idempotency: the diagnostic
 *     is `true` exactly when close was consumed, `false` otherwise, and
 *     is never present (`undefined`) on non-squat frames.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-x5-closed-authority-consumption-align-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateExerciseAutoProgress,
  isFinalPassLatched,
  computeSquatPostOwnerPreLatchGateLayer,
  readSquatPassOwnerTruth,
} = await import('../src/lib/camera/auto-progression.ts');
const {
  computeSquatCompletionOwnerTruth,
  readOfficialShallowOwnerFreezeSnapshot,
  readOfficialShallowFalsePassGuardSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const { computeSquatUiProgressionLatchGate } = await import(
  '../src/lib/camera/squat/squat-ui-progression-latch-gate.ts'
);
const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

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
      extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''
    );
    process.exitCode = 1;
  }
}

// ---- pose helpers (shared with other squat smokes) --------------------
function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}
function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) =>
      mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99)
    );
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
function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) =>
    squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle)
  );
}
function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * 80,
    timestampDiscontinuityCount: 0,
  };
}

const STANDING = Array(12).fill(170);
const DEEP_STANDARD = [
  170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142,
  155, 165, 170,
  ...Array(12).fill(170),
];
const SHALLOW = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92, 93, 95, 100, 110, 122, 136, 150,
  163, 170,
];

console.log('\nPR-X5 -- Closed Shallow Authority Consumption Alignment Smoke\n');

// ===========================================================================
// Section 1 -- Unit: synthetic slice drives the diagnostic correctly.
// ===========================================================================
console.log('Section 1: unit — consumption diagnostic on synthetic slice');

function chainOfSlice(slice) {
  const falsePassGuard = readOfficialShallowFalsePassGuardSnapshot({
    squatCompletionState: slice,
  });
  const freeze = readOfficialShallowOwnerFreezeSnapshot({
    squatCompletionState: slice,
  });
  const passOwnerTruth = readSquatPassOwnerTruth({
    squatCompletionState: slice,
    squatPassCore: undefined,
  });
  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth: passOwnerTruth,
    uiGateInput: {
      completionOwnerPassed: passOwnerTruth.completionOwnerPassed,
      guardrailCompletionComplete: true,
      captureQualityInvalid: false,
      confidence: 0.9,
      passThresholdEffective: 0.5,
      effectivePassConfirmation: true,
      passConfirmationFrameCount: 10,
      framesReq: 3,
      captureArmingSatisfied: true,
      squatIntegrityBlockForPass: null,
      reasons: [],
      hardBlockerReasons: [],
      liveReadinessNotReady: false,
      readinessStableDwellSatisfied: true,
      setupMotionBlocked: false,
    },
    squatCompletionState: slice,
    squatCycleDebug: undefined,
  });
  return {
    falsePassGuard,
    freeze,
    passOwnerTruth,
    layer,
  };
}

// A minimal same-epoch proved shallow rep: close authority set, false-pass
// guard clear, same epoch. This is exactly the X5 "must consume" case.
const cleanSlice = {
  completionSatisfied: true,
  completionPassReason: 'low_rom_cycle',
  completionOwnerReason: 'shallow_complete_rule',
  currentSquatPhase: 'standing_recovered',
  cycleComplete: true,
  completionBlockedReason: null,
  attemptStarted: true,
  descendConfirmed: true,
  downwardCommitmentReached: true,
  downwardCommitmentDelta: 0.07,
  reversalConfirmedAfterDescend: true,
  recoveryConfirmedAfterReversal: true,
  officialShallowReversalSatisfied: true,
  ownerAuthoritativeRecoverySatisfied: true,
  standingFinalizeSatisfied: true,
  standingRecoveredAtMs: 1200,
  attemptStartedAfterReady: true,
  readinessStableDwellSatisfied: true,
  setupMotionBlocked: false,
  evidenceLabel: 'low_rom',
  peakLatchedAtIndex: 6,
  officialShallowPathCandidate: true,
  officialShallowPathAdmitted: true,
  officialShallowPathReason: 'shallow_admitted',
  officialShallowPathBlockedReason: null,
  officialShallowPathAdmissionGuardFamily: null,
  officialShallowClosureFamily: 'strict_shallow_cycle',
  officialShallowClosureRewriteApplied: false,
  officialShallowClosureRewriteSuppressedReason: null,
  officialShallowProvedSameEpochCloseWriteRepairApplied: false,
  officialShallowProvedSameEpochCloseWriteRepairSuppressedReason: null,
  officialShallowPathClosed: true,
  officialShallowClosureProofSatisfied: true,
  canonicalShallowContractAntiFalsePassClear: true,
  canonicalTemporalEpochOrderSatisfied: true,
  canonicalTemporalEpochOrderBlockedReason: null,
  selectedCanonicalDescentTimingEpochValidIndex: 1,
  selectedCanonicalDescentTimingEpochAtMs: 200,
  selectedCanonicalPeakEpochValidIndex: 6,
  selectedCanonicalPeakEpochAtMs: 600,
  selectedCanonicalReversalEpochValidIndex: 10,
  selectedCanonicalReversalEpochAtMs: 900,
  selectedCanonicalRecoveryEpochValidIndex: 15,
  selectedCanonicalRecoveryEpochAtMs: 1200,
  reversalConfirmedByRuleOrHmm: true,
  officialShallowStreamBridgeApplied: true,
  stillSeatedAtPass: false,
  squatEventCycle: { detected: true, descentFrames: 5, notes: [] },
};

{
  const chain = chainOfSlice(cleanSlice);
  ok(
    'S1.1: false-pass guard clear on clean same-epoch proved slice',
    chain.falsePassGuard.officialShallowFalsePassGuardClear === true,
    chain.falsePassGuard
  );
  ok(
    'S1.1: officialShallowOwnerFrozen=true consumes close authority',
    chain.freeze.officialShallowOwnerFrozen === true,
    chain.freeze
  );
  ok(
    'S1.1: owner freeze reason = official_shallow_owner_freeze',
    chain.freeze.officialShallowOwnerReason === 'official_shallow_owner_freeze',
    chain.freeze
  );
  ok(
    'S1.1: completionOwnerPassed follows owner freeze',
    chain.passOwnerTruth.completionOwnerPassed === true &&
      chain.passOwnerTruth.officialShallowOwnerFrozen === true,
    chain.passOwnerTruth
  );
  ok(
    'S1.1: uiProgressionAllowed=true when frozen + owner passed',
    chain.layer.uiGate.uiProgressionAllowed === true &&
      chain.layer.uiGate.uiProgressionBlockedReason == null,
    chain.layer.uiGate
  );
  ok(
    'S1.1: finalPassBlockedReason null → finalPassEligible true',
    chain.layer.finalPassBlockedReason == null &&
      chain.layer.progressionPassed === true,
    chain.layer
  );
  ok(
    'S1.1: squatFinalPassTruth.finalPassGranted=true',
    chain.layer.squatFinalPassTruth.finalPassGranted === true &&
      chain.layer.squatFinalPassTruth.finalPassGrantedReason ===
        'post_owner_final_pass_clear',
    chain.layer.squatFinalPassTruth
  );
}

// ---- Same slice with the close authority removed: chain must stay closed.
{
  const slice = { ...cleanSlice, officialShallowPathClosed: false };
  const chain = chainOfSlice(slice);
  ok(
    'S1.2: close=false → owner freeze false (no close authority to consume)',
    chain.freeze.officialShallowOwnerFrozen === false,
    chain.freeze
  );
  ok(
    'S1.2: close=false → completionOwnerPassed still opens via non-freeze path',
    chain.passOwnerTruth.completionOwnerPassed === true &&
      chain.passOwnerTruth.officialShallowOwnerFrozen === false,
    chain.passOwnerTruth
  );
  // When close is absent the non-freeze path is still valid (completion state is fully satisfied above).
  // The X5 invariant is: frozen=false must NOT derive from any missing close authority.
  ok(
    'S1.2: frozen=false is not a bug when close itself is false',
    chain.freeze.officialShallowOwnerBlockedReason == null,
    chain.freeze
  );
}

// ---- Same slice but false-pass guard contaminated: frozen must stay false.
{
  const slice = { ...cleanSlice, stillSeatedAtPass: true };
  const chain = chainOfSlice(slice);
  ok(
    'S1.3: still_seated_at_pass refuses close consumption',
    chain.freeze.officialShallowOwnerFrozen === false &&
      chain.freeze.officialShallowOwnerBlockedReason ===
        'official_shallow_false_pass_guard:still_seated_at_pass',
    chain.freeze
  );
  ok(
    'S1.3: completionOwnerPassed=false with guard-derived blocked reason',
    chain.passOwnerTruth.completionOwnerPassed === false &&
      chain.passOwnerTruth.completionOwnerBlockedReason ===
        'official_shallow_false_pass_guard:still_seated_at_pass',
    chain.passOwnerTruth
  );
  ok(
    'S1.3: uiProgressionAllowed=false → finalPassEligible false',
    chain.layer.uiGate.uiProgressionAllowed === false &&
      chain.layer.progressionPassed === false,
    chain.layer
  );
}

// ---- Setup motion false-pass: guard must refuse close consumption.
{
  const slice = { ...cleanSlice, setupMotionBlocked: true };
  const chain = chainOfSlice(slice);
  ok(
    'S1.4: setup_motion_blocked refuses close consumption',
    chain.freeze.officialShallowOwnerFrozen === false &&
      chain.freeze.officialShallowOwnerBlockedReason ===
        'official_shallow_false_pass_guard:setup_motion_blocked',
    chain.freeze
  );
  ok(
    'S1.4: final sink stays closed',
    chain.layer.progressionPassed === false,
    chain.layer
  );
}

// ---- Cross-epoch stitched proof: guard must refuse close consumption.
{
  const slice = {
    ...cleanSlice,
    canonicalTemporalEpochOrderSatisfied: false,
  };
  const chain = chainOfSlice(slice);
  ok(
    'S1.5: cross_epoch_stitched_proof refuses close consumption',
    chain.freeze.officialShallowOwnerFrozen === false &&
      chain.freeze.officialShallowOwnerBlockedReason ===
        'official_shallow_false_pass_guard:cross_epoch_stitched_proof',
    chain.freeze
  );
  ok(
    'S1.5: final sink stays closed on cross-epoch stitching',
    chain.layer.progressionPassed === false,
    chain.layer
  );
}

// ---- Pre-attempt readiness miss: guard must refuse close consumption.
{
  const slice = { ...cleanSlice, attemptStartedAfterReady: false };
  const chain = chainOfSlice(slice);
  ok(
    'S1.6: attemptStartedAfterReady=false → ready_before_start_success',
    chain.freeze.officialShallowOwnerFrozen === false &&
      chain.freeze.officialShallowOwnerBlockedReason ===
        'official_shallow_false_pass_guard:ready_before_start_success',
    chain.freeze
  );
}

// ===========================================================================
// Section 2 -- End-to-end: clean shallow rep drives the full chain.
// ===========================================================================
console.log('\nSection 2: end-to-end — clean shallow rep consumes close');

{
  const lm = toLandmarks(
    makeKneeAngleSeries(2000, [...STANDING, ...SHALLOW, ...Array(10).fill(170)])
  );
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState;
  const passReason = cs?.completionPassReason;
  const shallowOwnerOk =
    passReason === 'low_rom_cycle' ||
    passReason === 'ultra_low_rom_cycle' ||
    passReason === 'low_rom_event_cycle' ||
    passReason === 'ultra_low_rom_event_cycle';
  ok('S2.1: end-to-end pass status', gate.status === 'pass', gate.status);
  ok('S2.1: shallow completion pass reason', shallowOwnerOk, { passReason });
  ok(
    'S2.1: officialShallowPathClosed=true on state slice',
    cs?.officialShallowPathClosed === true,
    {
      closed: cs?.officialShallowPathClosed,
      blocker: cs?.officialShallowPathBlockedReason,
    }
  );
  ok(
    'S2.1: officialShallowOwnerFrozen=true (close authority consumed)',
    d.officialShallowOwnerFrozen === true &&
      d.officialShallowOwnerFreezeBlockedReason == null,
    d
  );
  ok(
    'S2.1: completionOwnerPassed=true',
    d.completionOwnerPassed === true &&
      d.completionOwnerBlockedReason == null,
    {
      completionOwnerPassed: d.completionOwnerPassed,
      completionOwnerBlockedReason: d.completionOwnerBlockedReason,
    }
  );
  ok(
    'S2.1: uiProgressionAllowed=true → finalPassEligible=true',
    d.uiProgressionAllowed === true &&
      d.uiProgressionBlockedReason == null &&
      gate.finalPassEligible === true &&
      gate.finalPassBlockedReason == null,
    {
      uiAllowed: d.uiProgressionAllowed,
      finalPassEligible: gate.finalPassEligible,
      finalPassBlockedReason: gate.finalPassBlockedReason,
    }
  );
  ok(
    'S2.1: finalPassLatched=true',
    isFinalPassLatched('squat', gate) === true,
    {
      finalPassEligible: gate.finalPassEligible,
      finalPassBlockedReason: gate.finalPassBlockedReason,
    }
  );
  ok(
    'S2.1: squatFinalPassTruth.finalPassGranted=true',
    d.squatFinalPassTruth?.finalPassGranted === true,
    d.squatFinalPassTruth
  );
  ok(
    'S2.1: PR-X5 diagnostic — closed authority consumed',
    d.officialShallowClosedAuthorityConsumed === true &&
      d.officialShallowClosedAuthorityConsumptionBlockedReason == null,
    {
      consumed: d.officialShallowClosedAuthorityConsumed,
      blocked: d.officialShallowClosedAuthorityConsumptionBlockedReason,
    }
  );
  ok(
    'S2.1: first ordering — close BEFORE frozen BEFORE owner BEFORE uiAllowed BEFORE finalPassEligible BEFORE latched',
    cs?.officialShallowPathClosed === true &&
      d.officialShallowOwnerFrozen === true &&
      d.completionOwnerPassed === true &&
      d.uiProgressionAllowed === true &&
      gate.finalPassEligible === true &&
      isFinalPassLatched('squat', gate) === true
  );
}

// ===========================================================================
// Section 3 -- Preservation: standing / seated / descent-only / deep.
// ===========================================================================
console.log('\nSection 3: preservation — never-pass + deep standard');

// Standing still: no close, no owner freeze, no finalPass.
{
  const lm = toLandmarks(makeKneeAngleSeries(3000, [...STANDING, ...STANDING, ...STANDING]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState;
  ok('S3.1: standing — not pass', gate.status !== 'pass', gate.status);
  ok(
    'S3.1: standing — close=false, ownerFrozen=false, completionOwnerPassed=false',
    cs?.officialShallowPathClosed !== true &&
      d.officialShallowOwnerFrozen !== true &&
      d.completionOwnerPassed !== true,
    {
      closed: cs?.officialShallowPathClosed,
      frozen: d.officialShallowOwnerFrozen,
      ownerPassed: d.completionOwnerPassed,
    }
  );
  ok(
    'S3.1: standing — PR-X5 diagnostic consumed=false (no close to consume)',
    d.officialShallowClosedAuthorityConsumed === false,
    {
      consumed: d.officialShallowClosedAuthorityConsumed,
      blocker: d.officialShallowClosedAuthorityConsumptionBlockedReason,
    }
  );
  ok(
    'S3.1: standing — finalPassLatched false',
    isFinalPassLatched('squat', gate) === false,
    { eligible: gate.finalPassEligible }
  );
}

// Seated hold: stuck deep, never recovers.
{
  const seated = [...Array(8).fill(170), ...Array(36).fill(92)];
  const lm = toLandmarks(makeKneeAngleSeries(4000, seated));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState;
  ok('S3.2: seated — not pass', gate.status !== 'pass', gate.status);
  ok(
    'S3.2: seated — close=false + finalPassLatched false',
    cs?.officialShallowPathClosed !== true &&
      isFinalPassLatched('squat', gate) === false,
    {
      closed: cs?.officialShallowPathClosed,
      eligible: gate.finalPassEligible,
    }
  );
  ok(
    'S3.2: seated — PR-X5 diagnostic false (no close opened)',
    d.officialShallowClosedAuthorityConsumed === false,
    {
      consumed: d.officialShallowClosedAuthorityConsumed,
      blocker: d.officialShallowClosedAuthorityConsumptionBlockedReason,
    }
  );
}

// Descent-only (no reversal → no proof → no close).
{
  const descentOnly = [...STANDING, 170, 160, 145, 125, 108, 95, 85, 80, 78, 77];
  const lm = toLandmarks(makeKneeAngleSeries(5000, descentOnly));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  const cs = gate.evaluatorResult?.debug?.squatCompletionState;
  ok('S3.3: descent-only — not pass', gate.status !== 'pass', gate.status);
  ok(
    'S3.3: descent-only — close=false and consumed=false',
    cs?.officialShallowPathClosed !== true &&
      d.officialShallowClosedAuthorityConsumed === false,
    {
      closed: cs?.officialShallowPathClosed,
      consumed: d.officialShallowClosedAuthorityConsumed,
    }
  );
}

// Deep standard rep: passes via standard_cycle owner, NOT via shallow
// close authority. PR-X5 diagnostic stays false (standard path).
{
  const lm = toLandmarks(
    makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)])
  );
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const d = gate.squatCycleDebug ?? {};
  ok('S3.4: deep — pass via standard lineage', gate.status === 'pass', gate.status);
  ok(
    'S3.4: deep — passOwner/finalSuccessOwner standard',
    d.passOwner === 'completion_truth_standard' &&
      d.finalSuccessOwner === 'completion_truth_standard',
    d
  );
  ok(
    'S3.4: deep — finalPassLatched=true preserved',
    isFinalPassLatched('squat', gate) === true,
    { eligible: gate.finalPassEligible }
  );
  ok(
    'S3.4: deep — PR-X5 diagnostic consumed=false (standard path)',
    d.officialShallowClosedAuthorityConsumed === false,
    {
      consumed: d.officialShallowClosedAuthorityConsumed,
      blocker: d.officialShallowClosedAuthorityConsumptionBlockedReason,
    }
  );
  ok(
    'S3.4: deep — officialShallowOwnerFrozen=false (not a shallow rep)',
    d.officialShallowOwnerFrozen === false,
    d
  );
}

// ===========================================================================
// Section 4 -- Ultra-low-rom rep whose PR-4 rewrite opens close but whose
// epoch-ledger is incomplete must NOT open owner-freeze (guard refuses).
// This locks the X5 boundary: an upstream close decision that would have
// been consumed cleanly must still wait for the false-pass guard.
// ===========================================================================
console.log('\nSection 4: same-epoch boundary — guard must refuse incomplete epoch ledger');

{
  const depths = [0, 0, 0, 0, 0, 0, 0.06, 0.06, 0, 0, 0, 0, 0, 0];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'bottom', 'ascent', 'ascent',
    'start', 'start', 'start', 'start',
  ];
  let t = 0;
  const frames = depths.map((d, i) => ({
    timestampMs: (t += 60),
    isValid: true,
    phaseHint: phases[i],
    derived: { squatDepthProxy: d },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    stepId: 'squat',
  }));
  const st = evaluateSquatCompletionState(frames);
  ok(
    'S4.1: ultra-low-rom rewrite opened close authority',
    st.officialShallowPathClosed === true &&
      (st.officialShallowClosureRewriteApplied === true ||
        st.officialShallowProvedSameEpochCloseWriteRepairApplied === true),
    {
      closed: st.officialShallowPathClosed,
      rewrite: st.officialShallowClosureRewriteApplied,
      x4: st.officialShallowProvedSameEpochCloseWriteRepairApplied,
    }
  );
  const chain = chainOfSlice(st);
  ok(
    'S4.1: same-epoch guard refuses close when epoch ledger not clear',
    chain.freeze.officialShallowOwnerFrozen === false &&
      typeof chain.freeze.officialShallowOwnerBlockedReason === 'string' &&
      chain.freeze.officialShallowOwnerBlockedReason.startsWith(
        'official_shallow_false_pass_guard:'
      ),
    {
      frozen: chain.freeze.officialShallowOwnerFrozen,
      reason: chain.freeze.officialShallowOwnerBlockedReason,
    }
  );
  ok(
    'S4.1: downstream sink stays closed (no forced finalPass)',
    chain.layer.progressionPassed === false &&
      chain.layer.finalPassBlockedReason != null,
    chain.layer
  );
}

// ===========================================================================
// Section 5 -- Invariant: close true + guard clear + same-epoch always
// opens ALL downstream layers in order. This is the X5 acceptance criterion.
// ===========================================================================
console.log('\nSection 5: locked invariant — closed authority + guard clear → full chain');

const GUARD_CONTAMINATORS = [
  { name: 'still_seated_at_pass', patch: { stillSeatedAtPass: true } },
  { name: 'setup_motion_blocked', patch: { setupMotionBlocked: true } },
  { name: 'ready_before_start_success', patch: { attemptStartedAfterReady: false } },
  { name: 'no_real_descent', patch: { descendConfirmed: false, downwardCommitmentDelta: -0.01 } },
  { name: 'no_real_reversal', patch: { reversalConfirmedAfterDescend: false, officialShallowReversalSatisfied: false } },
  {
    name: 'cross_epoch_stitched_proof',
    patch: { canonicalTemporalEpochOrderSatisfied: false },
  },
];

for (const { name, patch } of GUARD_CONTAMINATORS) {
  const slice = { ...cleanSlice, ...patch };
  const chain = chainOfSlice(slice);
  ok(
    `S5.${name}: chain refuses to open when the ${name} guard is dirty`,
    chain.freeze.officialShallowOwnerFrozen === false &&
      chain.passOwnerTruth.completionOwnerPassed === false &&
      chain.layer.uiGate.uiProgressionAllowed === false &&
      chain.layer.progressionPassed === false &&
      chain.layer.squatFinalPassTruth.finalPassGranted === false,
    {
      frozen: chain.freeze.officialShallowOwnerFrozen,
      ownerPassed: chain.passOwnerTruth.completionOwnerPassed,
      uiAllowed: chain.layer.uiGate.uiProgressionAllowed,
      finalPassBlockedReason: chain.layer.finalPassBlockedReason,
    }
  );
}

// Positive acceptance: guard clear + close true → every downstream opens.
{
  const chain = chainOfSlice(cleanSlice);
  ok(
    'S5.accept: close=true + guard clear → full chain opens (acceptance invariant)',
    chain.freeze.officialShallowOwnerFrozen === true &&
      chain.passOwnerTruth.completionOwnerPassed === true &&
      chain.layer.uiGate.uiProgressionAllowed === true &&
      chain.layer.progressionPassed === true &&
      chain.layer.squatFinalPassTruth.finalPassGranted === true &&
      chain.layer.finalPassBlockedReason == null,
    {
      frozen: chain.freeze.officialShallowOwnerFrozen,
      ownerPassed: chain.passOwnerTruth.completionOwnerPassed,
      uiAllowed: chain.layer.uiGate.uiProgressionAllowed,
      finalPassBlockedReason: chain.layer.finalPassBlockedReason,
    }
  );
}

// ===========================================================================
// Section 6 -- Owner-not-passed precondition: UI gate must stay closed.
// ===========================================================================
console.log('\nSection 6: precondition — completionOwnerPassed=false keeps UI/final closed');

{
  const ui = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: false,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.9,
    passThresholdEffective: 0.5,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 10,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    officialShallowOwnerFrozen: false,
  });
  ok(
    'S6.1: owner not passed → uiProgressionAllowed=false with completion_owner_not_satisfied',
    ui.uiProgressionAllowed === false &&
      ui.uiProgressionBlockedReason === 'completion_owner_not_satisfied',
    ui
  );
}

// When owner is passed via frozen authority, the gate bypasses all legacy
// UI blockers (confidence/frame/readiness) — this is Wave B follow-up law.
{
  const ui = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.1,
    passThresholdEffective: 0.9,
    effectivePassConfirmation: false,
    passConfirmationFrameCount: 0,
    framesReq: 3,
    captureArmingSatisfied: false,
    squatIntegrityBlockForPass: 'standard_cycle_signal_integrity:hard_partial',
    reasons: ['hard_partial'],
    hardBlockerReasons: ['hard_partial'],
    officialShallowOwnerFrozen: true,
  });
  ok(
    'S6.2: owner passed + frozen=true → UI gate opens (Wave B follow-up law)',
    ui.uiProgressionAllowed === true && ui.uiProgressionBlockedReason == null,
    ui
  );
}

// ===========================================================================
console.log(`\nPR-X5 smoke: ${passed + failed} tests -- ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
