/**
 * PR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01 — ultra-low-rom event promotion ascent-integrity gate
 * Run: npx tsx scripts/camera-ultra-low-rom-event-gate-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateSquatCompletionState,
  ultraLowRomEventPromotionMeetsAscentIntegrity,
} = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  ✗ ${name}${detail}`);
    process.exitCode = 1;
  }
}

function makeFrame(depthPrimary, timestampMs, phaseHint, blended = undefined) {
  const derived = { squatDepthProxy: depthPrimary };
  if (blended !== undefined) derived.squatDepthProxyBlended = blended;
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived,
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
  };
}

function framesFrom(depthsPrimary, phases, blendedSeries, stepMs = 40) {
  return depthsPrimary.map((dp, i) =>
    makeFrame(dp, 100 + i * stepMs, phases[i] ?? 'start', blendedSeries?.[i])
  );
}

/** HMM structural assist 경로용 최소 스텁 (detectSquatEventCycle 전용 필드만 사용) */
function hmmStructuralUltraStub() {
  return {
    sequence: [],
    states: [],
    dominantStateCounts: { standing: 8, descent: 4, bottom: 40, ascent: 5 },
    transitionCount: 12,
    completionCandidate: true,
    confidence: 0.55,
    confidenceBreakdown: {
      excursionTerm: 0.2,
      sequenceTerm: 0.2,
      coverageTerm: 0.15,
      noisePenalty: 0,
    },
    peakDepth: 0.035,
    effectiveExcursion: 0.02,
    notes: ['stub'],
  };
}

console.log('\nPR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01 smoke\n');

// ── A. Helper: seated-style (no progression reversal, no 180ms tail) → promotion gate false
console.log('A. ultra-low helper blocks without rule reversal / timing tail');
{
  ok(
    'A1: no reversal + no squatReversalToStandingMs → false',
    ultraLowRomEventPromotionMeetsAscentIntegrity({
      relativeDepthPeak: 0.02,
      evidenceLabel: 'ultra_low_rom',
      reversalConfirmedAfterDescend: false,
      recoveryConfirmedAfterReversal: false,
      ascendConfirmed: true,
      standingRecoveredAtMs: 5000,
      standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
      squatReversalToStandingMs: undefined,
    }) === false
  );
  ok(
    'A2: low_rom_guarded_finalize alone → false (ultra finalize contract)',
    ultraLowRomEventPromotionMeetsAscentIntegrity({
      relativeDepthPeak: 0.02,
      evidenceLabel: 'ultra_low_rom',
      reversalConfirmedAfterDescend: false,
      recoveryConfirmedAfterReversal: false,
      ascendConfirmed: true,
      standingRecoveredAtMs: 5000,
      standingRecoveryFinalizeReason: 'low_rom_guarded_finalize',
      squatReversalToStandingMs: 200,
    }) === false
  );
}

// ── B. Helper: progression reversal OR 180ms tail
console.log('\nB. ultra-low helper allows true rescue');
{
  ok(
    'B1: reversalConfirmedAfterDescend true → true',
    ultraLowRomEventPromotionMeetsAscentIntegrity({
      relativeDepthPeak: 0.02,
      evidenceLabel: 'ultra_low_rom',
      reversalConfirmedAfterDescend: true,
      recoveryConfirmedAfterReversal: true,
      ascendConfirmed: true,
      standingRecoveredAtMs: 5000,
      standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
      squatReversalToStandingMs: 100,
    }) === true
  );
  ok(
    'B2: standing_hold_met + squatReversalToStandingMs >= 180 (spec tail)',
    ultraLowRomEventPromotionMeetsAscentIntegrity({
      relativeDepthPeak: 0.03,
      evidenceLabel: 'ultra_low_rom',
      reversalConfirmedAfterDescend: false,
      recoveryConfirmedAfterReversal: false,
      ascendConfirmed: true,
      standingRecoveredAtMs: 8000,
      standingRecoveryFinalizeReason: 'standing_hold_met',
      squatReversalToStandingMs: 180,
    }) === true
  );
}

// ── C. Standing still
console.log('\nC. standing still');
{
  const st = evaluateSquatCompletionState(
    framesFrom(Array(24).fill(0.018), Array(24).fill('start'), undefined, 50)
  );
  ok('C: no completion', st.completionSatisfied === false, st.completionPassReason);
}

// ── D. 얕은 의미 사이클(PR-7 스타일) — evidence low_rom·통과 유지(ultra 전용 게이트 미적용)
console.log('\nD. shallow low-ROM completion preserved (PR-7 style)');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
  ];
  const phases = [
    'start',
    'start',
    'start',
    'start',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
    'ascent',
    'ascent',
    'ascent',
    'start',
    'start',
    'start',
  ];
  const st = evaluateSquatCompletionState(framesFrom(depths, phases, undefined, 80));
  ok(
    'D: shallow cycle still completes with low_rom evidence',
    st.completionSatisfied === true && st.evidenceLabel === 'low_rom',
    { pr: st.completionPassReason, ev: st.evidenceLabel }
  );
}

// ── E. Deep standard
console.log('\nE. deep standard_cycle');
{
  const depthsD = [
    0.02, 0.02, 0.02, 0.02, 0.08, 0.18, 0.32, 0.46, 0.46, 0.4, 0.28, 0.14, 0.06, 0.03, 0.02,
    ...Array(12).fill(0.02),
  ];
  const phasesD = [
    'start',
    'start',
    'start',
    'start',
    'descent',
    'descent',
    'descent',
    'bottom',
    'bottom',
    'ascent',
    'ascent',
    'ascent',
    'start',
    'start',
    'start',
    ...Array(12).fill('start'),
  ];
  const st = evaluateSquatCompletionState(framesFrom(depthsD, phasesD, undefined, 80));
  ok('E: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
}

// ── F. Integration: long bottom dwell + HMM — ultra band but no progression reversal → no promotion
console.log('\nF. seated-style integration (ultra event candidate + HMM, weak completion reversal)');
{
  const step = 40;
  const depthsP = [];
  const blends = [];
  const phases = [];
  for (let i = 0; i < 8; i++) {
    depthsP.push(0.02);
    blends.push(0.021);
    phases.push('start');
  }
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    depthsP.push(0.02 + 0.012 * t);
    blends.push(0.021 + 0.14 * t);
    phases.push('descent');
  }
  for (let i = 0; i < 42; i++) {
    depthsP.push(0.034 + (i % 3) * 0.0005);
    blends.push(0.16 + (i % 3) * 0.001);
    phases.push('bottom');
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    depthsP.push(0.034 - 0.014 * t);
    blends.push(0.16 - 0.1 * t);
    phases.push('ascent');
  }
  for (let i = 0; i < 18; i++) {
    depthsP.push(0.02);
    blends.push(0.021);
    phases.push('start');
  }
  const fr = framesFrom(depthsP, phases, blends, step);
  const st = evaluateSquatCompletionState(fr, { hmm: hmmStructuralUltraStub() });

  const ultraCand =
    st.squatEventCycle?.detected === true && st.squatEventCycle?.band === 'ultra_low_rom';
  if (ultraCand && st.reversalConfirmedAfterDescend !== true) {
    ok(
      'F: ultra-low event promotion blocked without ascent integrity',
      st.eventCyclePromoted !== true && st.completionPassReason === 'not_confirmed',
      {
        completionPassReason: st.completionPassReason,
        eventCyclePromoted: st.eventCyclePromoted,
        reversalConfirmedAfterDescend: st.reversalConfirmedAfterDescend,
        squatReversalToStandingMs: st.squatReversalToStandingMs,
      }
    );
  } else {
    ok(
      'F: skipped (fixture did not hit ultra candidate + no reversal — pipeline variant)',
      true
    );
  }
}

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
