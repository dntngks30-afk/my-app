/**
 * PR-D — Regression harness lock for squat post-PR-A/B/C truth contract.
 *
 * Verification-only: no product code edits. Fails loudly on illegal states or drift.
 *
 * Run:
 *   npx tsx scripts/camera-pr-d-squat-regression-harness-smoke.mjs
 *
 * Also run (kept green):
 *   npx tsx scripts/camera-pr-b-semantics-rebind-smoke.mjs
 *   npx tsx scripts/camera-pr-c-final-pass-semantics-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);
const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');
const { extractCaptureSessionSummaryFromAttempt } = await import(
  '../src/lib/camera/camera-trace-bundle.ts'
);
const { readSquatFinalPassSemanticsTruth } = await import(
  '../src/lib/camera/squat/squat-final-pass-semantics.ts'
);
const { buildDiagnosisSummary } = await import(
  '../src/lib/camera/trace/camera-trace-diagnosis-summary.ts'
);
const { buildSquatResultSeveritySummary } = await import(
  '../src/lib/camera/squat-result-severity.ts'
);

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

function assertNoIllegalGatePair(gate, label) {
  const illegal = gate.finalPassEligible === true && gate.finalPassBlockedReason != null;
  ok(`${label}: no illegal eligible+blocked`, !illegal, {
    finalPassEligible: gate.finalPassEligible,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
}

function assertPRAEquality(gate, label) {
  const rhs = gate.finalPassBlockedReason == null;
  ok(`${label}: PR-A finalPassEligible === (blockedReason==null)`, gate.finalPassEligible === rhs, {
    finalPassEligible: gate.finalPassEligible,
    finalPassBlockedReason: gate.finalPassBlockedReason,
  });
}

/**
 * PR-A: `progressionPassed === finalPassEligible` is enforced inside the evaluator; the public
 * `ExerciseGateResult` surface exposes `finalPassEligible` + `finalPassBlockedReason` (see auto-progression).
 * When `progressionPassed` is present (structural smokes), assert alignment.
 */
function assertProgressionAligned(gate, label) {
  if (typeof gate.progressionPassed === 'boolean') {
    ok(`${label}: progressionPassed === finalPassEligible`, gate.progressionPassed === gate.finalPassEligible, {
      progressionPassed: gate.progressionPassed,
      finalPassEligible: gate.finalPassEligible,
    });
  }
}

function assertSquatTruthAlignedWithGate(gate, label) {
  const t = gate.squatCycleDebug?.squatFinalPassTruth;
  if (t != null && typeof t.finalPassGranted === 'boolean') {
    ok(`${label}: squatFinalPassTruth.finalPassGranted === finalPassEligible`, t.finalPassGranted === gate.finalPassEligible, t);
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/** Same knee-angle fixture as PR-CAM-26 / CAM-21 (pose-features depth proxy). */
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

  const leftHipX = 0.44;
  const rightHipX = 0.56;
  const leftKneeX = 0.45;
  const rightKneeX = 0.55;

  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;

  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(leftHipX, hipY, 0.99);
  landmarks[24] = mockLandmark(rightHipX, hipY, 0.99);
  landmarks[25] = mockLandmark(leftKneeX, kneeY, 0.99);
  landmarks[26] = mockLandmark(rightKneeX, kneeY, 0.99);
  landmarks[27] = mockLandmark(leftKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(rightKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);

  return { landmarks, timestamp };
}

function toLandmarks(sequence) {
  return sequence.map((frame) => ({ landmarks: frame.landmarks, timestamp: frame.timestamp }));
}

function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function squatStats(landmarks, captureDurationMs = 3200) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}

function runGateInvariants(gate, label) {
  assertNoIllegalGatePair(gate, label);
  assertPRAEquality(gate, label);
  assertProgressionAligned(gate, label);
  assertSquatTruthAlignedWithGate(gate, label);
}

// ── Matrix group 1 — gate truth (real-path) ─────────────────────────────────
console.log('\n━━ Matrix 1 — gate truth (real-path) ━━');

const deepAngles = [
  ...Array(10).fill(170),
  165, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60,
  60, 60,
  70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170,
  ...Array(4).fill(170),
];
const deepLandmarks = toLandmarks(makeKneeAngleSeries(100, deepAngles, 80));
const gateDeep = evaluateExerciseAutoProgress('squat', deepLandmarks, squatStats(deepLandmarks));
runGateInvariants(gateDeep, 'M1 deep');
ok('M1 deep: status pass (PR-CAM-26 C anchor)', gateDeep.status === 'pass' && gateDeep.completionSatisfied === true, {
  status: gateDeep.status,
  completionSatisfied: gateDeep.completionSatisfied,
});
ok('M1 deep: standard_cycle', gateDeep.squatCycleDebug?.completionPassReason === 'standard_cycle', gateDeep.squatCycleDebug?.completionPassReason);
ok('M1 deep: latch equals gate', isFinalPassLatched('squat', gateDeep) === (gateDeep.finalPassEligible === true));

/** When current main already passes these fixtures, lock PR-A/B/C surfaces (no broadening). */
function whenPassing(name, gate) {
  return gate.status === 'pass' && gate.completionSatisfied === true && gate.finalPassEligible === true;
}

console.log('\n━━ Matrix 1b — optional shallow / ultra-low-ROM (only if engine passes today) ━━');
{
  const shallowAngles = [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92,
    92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(6).fill(170),
  ];
  const gateShallow = evaluateExerciseAutoProgress(
    'squat',
    toLandmarks(makeKneeAngleSeries(200, shallowAngles, 80)),
    squatStats(makeKneeAngleSeries(200, shallowAngles, 80))
  );
  if (whenPassing('shallow', gateShallow)) {
    runGateInvariants(gateShallow, 'M1b shallow');
    ok('M1b shallow: latched', isFinalPassLatched('squat', gateShallow) === true);
  } else {
    console.log('  SKIP: shallow fixture not passing on this main (no PR-D broadening)');
  }
}
{
  const ultraShallowAngles = [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92,
    92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(10).fill(170),
  ];
  const gateUltra = evaluateExerciseAutoProgress(
    'squat',
    toLandmarks(makeKneeAngleSeries(300, ultraShallowAngles, 80)),
    squatStats(makeKneeAngleSeries(300, ultraShallowAngles, 80), 3200)
  );
  if (whenPassing('ultra-shallow', gateUltra)) {
    runGateInvariants(gateUltra, 'M1b ultra-shallow');
    const cpr = gateUltra.squatCycleDebug?.completionPassReason;
    ok(
      'M1b ultra-shallow: shallow cycle class',
      cpr === 'ultra_low_rom_cycle' || cpr === 'low_rom_cycle',
      cpr
    );
  } else {
    console.log('  SKIP: ultra-low-ROM fixture not passing on this main (no PR-D broadening)');
  }
}

const emptyGate = evaluateExerciseAutoProgress('squat', [], {
  sampledFrameCount: 0,
  droppedFrameCount: 0,
  captureDurationMs: 0,
  timestampDiscontinuityCount: 0,
});
runGateInvariants(emptyGate, 'M1 empty');
ok('M1 empty: not pass', emptyGate.status !== 'pass', emptyGate.status);
ok('M1 empty: finalPassEligible false', emptyGate.finalPassEligible === false);

const standingAngles = Array(36).fill(170);
const gateStanding = evaluateExerciseAutoProgress(
  'squat',
  toLandmarks(makeKneeAngleSeries(400, standingAngles, 80)),
  squatStats(makeKneeAngleSeries(400, standingAngles, 80))
);
runGateInvariants(gateStanding, 'M1 standing');
ok('M1 standing: not pass', gateStanding.status !== 'pass', gateStanding.status);
ok('M1 standing: finalPassEligible false', gateStanding.finalPassEligible === false);

const microDipAngles = [
  ...Array(10).fill(170),
  168, 166, 165, 164,
  165, 166, 168, 170,
  ...Array(4).fill(170),
];
const gateMicro = evaluateExerciseAutoProgress(
  'squat',
  toLandmarks(makeKneeAngleSeries(500, microDipAngles, 40)),
  squatStats(makeKneeAngleSeries(500, microDipAngles, 40), 1800)
);
runGateInvariants(gateMicro, 'M1 micro-dip');
ok('M1 micro-dip: no false pass', !whenPassing('micro-dip', gateMicro), {
  status: gateMicro.status,
  completionSatisfied: gateMicro.completionSatisfied,
  finalPassEligible: gateMicro.finalPassEligible,
});

const seatedStillAngles = Array(28).fill(95);
const gateSeated = evaluateExerciseAutoProgress(
  'squat',
  toLandmarks(makeKneeAngleSeries(600, seatedStillAngles, 80)),
  squatStats(makeKneeAngleSeries(600, seatedStillAngles, 80))
);
runGateInvariants(gateSeated, 'M1 seated-still');
ok('M1 seated-still: not pass', gateSeated.status !== 'pass', gateSeated.status);

const sitDownOnlyAngles = [...Array(12).fill(170), 160, 140, 120, 100, 90, 85, 85, 85, 85];
const gateSitOnly = evaluateExerciseAutoProgress(
  'squat',
  toLandmarks(makeKneeAngleSeries(700, sitDownOnlyAngles, 80)),
  squatStats(makeKneeAngleSeries(700, sitDownOnlyAngles, 80))
);
runGateInvariants(gateSitOnly, 'M1 sit-down-only');
ok('M1 sit-down-only: not pass', gateSitOnly.status !== 'pass', gateSitOnly.status);

const swayAngles = Array(40)
  .fill(0)
  .map((_, i) => 170 + (i % 2 === 0 ? -1 : 1));
const gateSway = evaluateExerciseAutoProgress(
  'squat',
  toLandmarks(makeKneeAngleSeries(800, swayAngles, 50)),
  squatStats(makeKneeAngleSeries(800, swayAngles, 50), 2500)
);
runGateInvariants(gateSway, 'M1 sway');
ok('M1 sway: not pass', gateSway.status !== 'pass', gateSway.status);

const standUpOnlyAngles = [90, 95, 100, 110, 120, 135, 150, 160, 165, 170, 170, 170, 170, 170];
const gateStandUp = evaluateExerciseAutoProgress(
  'squat',
  toLandmarks(makeKneeAngleSeries(900, standUpOnlyAngles, 70)),
  squatStats(makeKneeAngleSeries(900, standUpOnlyAngles, 70), 2000)
);
runGateInvariants(gateStandUp, 'M1 stand-up-only');
ok('M1 stand-up-only: not pass', gateStandUp.status !== 'pass', gateStandUp.status);

// ── Matrix group 2 — semantics (helper-level) ────────────────────────────────
console.log('\n━━ Matrix 2 — semantics truth (buildSquatResultSeveritySummary) ━━');
{
  const s = buildSquatResultSeveritySummary({
    finalPassGranted: true,
    completionTruthPassed: false,
    captureQuality: 'ok',
  });
  ok('M2: success + completionTruth false → not failed', s.passSeverity !== 'failed', s);
  ok('M2: not movement_not_completed', s.resultInterpretation !== 'movement_not_completed', s);
}
{
  const s = buildSquatResultSeveritySummary({
    finalPassGranted: false,
    completionTruthPassed: true,
    captureQuality: 'ok',
  });
  ok('M2: fail + completionTruth true → failed', s.passSeverity === 'failed', s);
}
{
  const s = buildSquatResultSeveritySummary({
    finalPassGranted: true,
    captureQuality: 'low',
    qualityTier: 'low',
    limitations: [],
  });
  ok('M2: low quality success → low_quality_pass', s.passSeverity === 'low_quality_pass', s);
}
{
  const s = buildSquatResultSeveritySummary({
    finalPassGranted: true,
    captureQuality: 'ok',
    qualityTier: 'high',
    limitations: ['x'],
  });
  ok('M2: limitation-only success → warning_pass', s.passSeverity === 'warning_pass', s);
}

// ── Matrix group 3 — readSquatFinalPassSemanticsTruth ───────────────────────
console.log('\n━━ Matrix 3 — readSquatFinalPassSemanticsTruth ━━');
{
  const r = readSquatFinalPassSemanticsTruth({
    finalPassEligible: true,
    squatFinalPassTruth: { finalPassGranted: true },
  });
  ok('M3: gate source when aligned', r.source === 'gate_final_pass_eligible', r);
  ok('M3: no mismatch', r.mismatchDetected === false, r);
}
{
  const r = readSquatFinalPassSemanticsTruth({
    finalPassEligible: false,
    squatFinalPassTruth: { finalPassGranted: true },
  });
  ok('M3: disagree → mismatch', r.mismatchDetected === true, r);
  ok('M3: disagree → gate value', r.finalPassGranted === false, r);
}
{
  const r = readSquatFinalPassSemanticsTruth({ squatFinalPassTruth: { finalPassGranted: true } });
  ok('M3: fallback truth source', r.source === 'squat_final_pass_truth', r);
}
{
  const r = readSquatFinalPassSemanticsTruth({});
  ok('M3: none', r.source === 'none' && r.finalPassGranted === undefined, r);
}

// ── Matrix group 4 — cross-surface (deep pass + mismatch fixture) ───────────
console.log('\n━━ Matrix 4 — cross-surface alignment ━━');
{
  const read = readSquatFinalPassSemanticsTruth({
    finalPassEligible: gateDeep.finalPassEligible,
    squatFinalPassTruth: gateDeep.squatCycleDebug?.squatFinalPassTruth,
  });
  const diag = buildDiagnosisSummary('squat', gateDeep, undefined);
  const sq = diag?.squatCycle;
  ok('M4: diagnosis passSemanticsTruth', sq?.passSemanticsTruth === 'final_pass_surface', sq);
  ok('M4: diagnosis finalPassGranted matches read boundary', sq?.finalPassGranted === read.finalPassGranted, {
    sq: sq?.finalPassGranted,
    read: read.finalPassGranted,
  });
  ok('M4: diagnosis source matches read boundary', sq?.finalPassSemanticsSource === read.source, {
    sq: sq?.finalPassSemanticsSource,
    read: read.source,
  });
  ok(
    'M4: diagnosis mismatch matches read boundary',
    sq?.finalPassSemanticsMismatchDetected === read.mismatchDetected,
    { sq: sq?.finalPassSemanticsMismatchDetected, read: read.mismatchDetected }
  );
  ok('M4: success path severity non-failed', sq?.passSeverity !== 'failed', sq?.passSeverity);

  const attempt = buildAttemptSnapshot('squat', gateDeep, undefined, undefined);
  ok('M4: attempt built', attempt != null && attempt.movementType === 'squat', attempt);
  const bundle = extractCaptureSessionSummaryFromAttempt(attempt);
  ok('M4: bundle severity matches diagnosis severity', bundle.resultSeverity?.passSeverity === sq?.passSeverity, {
    bundle: bundle.resultSeverity?.passSeverity,
    diag: sq?.passSeverity,
  });
}

{
  const gateMismatch = {
    finalPassEligible: false,
    finalPassBlockedReason: 'ui_progression_blocked',
    completionSatisfied: true,
    confidence: 0.65,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    guardrail: {
      captureQuality: 'ok',
      flags: [],
      retryRecommended: false,
      completionStatus: 'complete',
    },
    evaluatorResult: {
      metrics: [],
      qualityHints: [],
      completionHints: [],
      interpretedSignals: [],
      debug: {
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
      squatFinalPassTruth: {
        finalPassGranted: true,
        finalPassBlockedReason: null,
        finalPassTruthSource: 'post_owner_ui_gate',
        motionOwnerSource: 'pass_core',
        finalPassGrantedReason: 'post_owner_final_pass_clear',
      },
    },
  };
  const readM = readSquatFinalPassSemanticsTruth({
    finalPassEligible: gateMismatch.finalPassEligible,
    squatFinalPassTruth: gateMismatch.squatCycleDebug.squatFinalPassTruth,
  });
  const diagM = buildDiagnosisSummary('squat', gateMismatch, undefined);
  const sqM = diagM?.squatCycle;
  ok('M4m: mismatch flagged in diagnosis', sqM?.finalPassSemanticsMismatchDetected === true, sqM);
  ok('M4m: diagnosis matches read boundary', sqM?.finalPassGranted === readM.finalPassGranted, {
    sq: sqM?.finalPassGranted,
    read: readM.finalPassGranted,
  });
  ok('M4m: severity failed (no OR-widen)', sqM?.passSeverity === 'failed', sqM?.passSeverity);
  const attemptM = buildAttemptSnapshot('squat', gateMismatch, undefined, undefined);
  const bundleM = extractCaptureSessionSummaryFromAttempt(attemptM);
  ok('M4m: bundle severity matches diagnosis', bundleM.resultSeverity?.passSeverity === sqM?.passSeverity, {
    bundle: bundleM.resultSeverity?.passSeverity,
    diag: sqM?.passSeverity,
  });
}

// ── Compat — canonical vs deprecated alias ──────────────────────────────────
console.log('\n━━ Compat — canonical vs deprecated alias ━━');
{
  const attempt = buildAttemptSnapshot('squat', gateDeep, undefined, undefined);
  const sq0 = attempt?.diagnosisSummary?.squatCycle;
  if (sq0?.finalPassGranted === true) {
    ok('Compat: deprecated true when canonical true', sq0?.finalPassGrantedForSemantics === true, sq0);
  }
  const cloneLegacy = JSON.parse(JSON.stringify(attempt));
  const scL = cloneLegacy.diagnosisSummary.squatCycle;
  delete scL.finalPassGranted;
  delete scL.finalPassSemanticsSource;
  delete scL.finalPassSemanticsMismatchDetected;
  delete scL.passSemanticsTruth;
  scL.finalPassGrantedForSemantics = true;
  scL.completionTruthPassed = true;
  const bundleLegacy = extractCaptureSessionSummaryFromAttempt(cloneLegacy);
  ok(
    'Compat: bundle uses deprecated when canonical absent',
    bundleLegacy.resultSeverity?.passSeverity !== 'failed',
    bundleLegacy.resultSeverity
  );

  const cloneCanon = JSON.parse(JSON.stringify(attempt));
  const scC = cloneCanon.diagnosisSummary.squatCycle;
  scC.finalPassGranted = false;
  scC.finalPassGrantedForSemantics = true;
  const bundleCanonWins = extractCaptureSessionSummaryFromAttempt(cloneCanon);
  ok(
    'Compat: canonical false wins over deprecated true',
    bundleCanonWins.resultSeverity?.passSeverity === 'failed',
    bundleCanonWins.resultSeverity
  );
}

console.log(`\n━━━ PR-D squat regression harness: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
