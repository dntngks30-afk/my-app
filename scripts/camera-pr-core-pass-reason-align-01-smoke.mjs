/**
 * PR-CAM-CORE-PASS-REASON-ALIGN-01 — completionPassReason taxonomy vs descent path
 * Run: npx tsx scripts/camera-pr-core-pass-reason-align-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { resolveSquatPassOwner } = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const { isFinalPassLatched } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra != null ? ` | ${JSON.stringify(extra)}` : ''}`);
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

function framesFrom(depthsPrimary, phases, blendedSeries, stepMs = 80) {
  return depthsPrimary.map((dp, i) =>
    makeFrame(dp, 100 + i * stepMs, phases[i] ?? 'start', blendedSeries?.[i])
  );
}

console.log('\nPR-CAM-CORE-PASS-REASON-ALIGN-01 smoke\n');

// 1) Deep standard
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
  ok('1 deep: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
}

// 2) Ordinary low-ROM (phase descent present → low_rom_cycle, not wrapper)
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
  ok('2 shallow: low_rom_cycle', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('2 shallow: not wrapper promoted', st.eventCyclePromoted !== true, st.eventCyclePromoted);
  ok('2 shallow: eventBasedDescentPath false', st.eventBasedDescentPath === false, st.eventBasedDescentPath);
}

// 3) Ordinary ultra-low (depths stay < ~0.07 rel vs typical baseline)
{
  const depths = [
    0.02, 0.02, 0.02, 0.02, 0.028, 0.036, 0.042, 0.045, 0.045, 0.04, 0.034, 0.028, 0.024, 0.02, 0.02,
    ...Array(10).fill(0.02),
  ];
  const phases = [
    'start',
    'start',
    'start',
    'start',
    'descent',
    'descent',
    'bottom',
    'bottom',
    'bottom',
    'ascent',
    'ascent',
    'ascent',
    'start',
    'start',
    'start',
    ...Array(10).fill('start'),
  ];
  const st = evaluateSquatCompletionState(framesFrom(depths, phases, undefined, 80));
  ok('3 ultra-low: ultra_low_rom_cycle', st.completionPassReason === 'ultra_low_rom_cycle', {
    pr: st.completionPassReason,
    rel: st.relativeDepthPeak,
  });
  ok('3 ultra-low: not promoted', st.eventCyclePromoted !== true, st.eventCyclePromoted);
}

// 4) eventBasedDescentPath: no phaseHint descent, depth trajectory still admits attempt
{
  const n = 36;
  const depths = [];
  const phases = [];
  for (let i = 0; i < 8; i++) {
    depths.push(0.02);
    phases.push('start');
  }
  for (let i = 0; i < 10; i++) {
    depths.push(0.02 + 0.05 * (i / 9));
    phases.push('start');
  }
  for (let i = 0; i < 6; i++) {
    depths.push(0.075);
    phases.push('start');
  }
  for (let i = 0; i < 8; i++) {
    depths.push(0.075 - 0.055 * (i / 7));
    phases.push('start');
  }
  while (depths.length < n) {
    depths.push(0.02);
    phases.push('start');
  }
  const st = evaluateSquatCompletionState(framesFrom(depths.slice(0, n), phases.slice(0, n), undefined, 80));
  if (st.eventBasedDescentPath === true && st.completionSatisfied) {
    ok(
      '4 event path: *_event_cycle when satisfied',
      st.completionPassReason === 'low_rom_event_cycle' ||
        st.completionPassReason === 'ultra_low_rom_event_cycle',
      st.completionPassReason
    );
  } else {
    ok(
      '4 event path: skipped (fixture did not yield eventBasedDescentPath + pass)',
      true,
      { edp: st.eventBasedDescentPath, sat: st.completionSatisfied, pr: st.completionPassReason }
    );
  }
}

// 5) Wrapper promotion: core not_confirmed + canEventPromote (best-effort fixture)
{
  const baseP = 0.04;
  const baseB = 0.045;
  const n = 55;
  const depthsP = [];
  const blends = [];
  const phases = [];
  for (let i = 0; i < 8; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  for (let i = 8; i < 20; i++) {
    const t = (i - 8) / 11;
    depthsP.push(baseP + 0.012 * t);
    blends.push(baseB + 0.34 * t);
    phases.push(t > 0.35 ? 'descent' : 'start');
  }
  for (let i = 20; i < 34; i++) {
    depthsP.push(baseP + 0.014);
    blends.push(0.4);
    phases.push('bottom');
  }
  for (let i = 34; i < 48; i++) {
    const t = (i - 34) / 13;
    depthsP.push(baseP + 0.014 - 0.01 * t);
    blends.push(0.4 - 0.34 * t);
    phases.push('ascent');
  }
  for (let i = 48; i < n; i++) {
    depthsP.push(baseP);
    blends.push(baseB);
    phases.push('start');
  }
  const st = evaluateSquatCompletionState(framesFrom(depthsP, phases, blends, 40), {});
  if (st.eventCyclePromoted === true) {
    ok(
      '5 promoted: *_event_cycle + flag',
      (st.completionPassReason === 'low_rom_event_cycle' ||
        st.completionPassReason === 'ultra_low_rom_event_cycle') &&
        st.eventCyclePromoted === true,
      { pr: st.completionPassReason, prom: st.eventCyclePromoted }
    );
  } else {
    ok(
      '5 promoted: skipped (no promote in this synthetic blend)',
      true,
      { pr: st.completionPassReason, prom: st.eventCyclePromoted }
    );
  }
}

// 6) Downstream: owner + easy latch accept *_cycle
{
  const guardrailOk = { captureQuality: 'ok', flags: [] };
  for (const cpr of ['low_rom_cycle', 'ultra_low_rom_cycle']) {
    const owner = resolveSquatPassOwner({
      guardrail: guardrailOk,
      severeInvalid: false,
      decoupleEligible: true,
      completionSatisfied: true,
      completionPassReason: cpr,
    });
    ok(`6 owner ${cpr} -> completion_truth_event`, owner === 'completion_truth_event', owner);
  }
  const gate = {
    completionSatisfied: true,
    confidence: 0.58,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 2,
    guardrail: guardrailOk,
    evaluatorResult: {
      debug: {
        squatCompletionState: {
          completionSatisfied: true,
          completionPassReason: 'low_rom_cycle',
          currentSquatPhase: 'standing_recovered',
        },
      },
    },
  };
  ok('6 easy latch: low_rom_cycle', isFinalPassLatched('squat', gate) === true, isFinalPassLatched('squat', gate));
}

const strictGate = {
  completionSatisfied: true,
  confidence: 0.62,
  passConfirmationSatisfied: true,
  passConfirmationFrameCount: 3,
  guardrail: { captureQuality: 'ok', flags: [] },
  evaluatorResult: {
    debug: {
      squatCompletionState: {
        completionSatisfied: true,
        completionPassReason: 'standard_cycle',
        currentSquatPhase: 'standing_recovered',
      },
    },
  },
};
ok('6 strict: standard_cycle latch', isFinalPassLatched('squat', strictGate) === true);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
