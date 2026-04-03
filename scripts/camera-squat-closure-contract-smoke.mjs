/**
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract C smoke (path resolution + drift)
 * npx tsx scripts/camera-squat-closure-contract-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState, resolveSquatCompletionPath } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra ?? '');
    process.exitCode = 1;
  }
}

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
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

console.log('\ncamera-squat-closure-contract-smoke\n');

{
  ok(
    'resolveSquatCompletionPath: standard owner',
    resolveSquatCompletionPath({
      completionBlockedReason: null,
      relativeDepthPeak: 0.45,
      evidenceLabel: 'standard',
      eventBasedDescentPath: false,
      officialShallowPathCandidate: false,
      officialShallowPathAdmitted: false,
      shallowRomClosureProofSignals: false,
      ultraLowRomFreshCycleIntegrity: false,
    }) === 'standard_cycle'
  );
  ok(
    'resolveSquatCompletionPath: blocked',
    resolveSquatCompletionPath({
      completionBlockedReason: 'no_reversal',
      relativeDepthPeak: 0.2,
      evidenceLabel: 'low_rom',
      eventBasedDescentPath: false,
      officialShallowPathCandidate: true,
      officialShallowPathAdmitted: true,
      shallowRomClosureProofSignals: true,
      ultraLowRomFreshCycleIntegrity: true,
    }) === 'not_confirmed'
  );
}

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('C: shallow closes low_rom', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('C: official closed', st.officialShallowPathClosed === true, st);
  ok('C: closure proof', st.officialShallowClosureProofSatisfied === true, st);
  ok('C: no drift', st.officialShallowDriftedToStandard === false, st);
}

{
  const cam24 = [
    0.0, 0.0, 0.0, 0.0, 0.004, 0.008, 0.012, 0.018, 0.017, 0.016, 0.0154, 0.006, 0.005, 0.004, 0.003, 0.003,
  ].map((d, i) =>
    makeFrame(
      d,
      100 + i * 40,
      i < 11 ? 'start' : i < 14 ? 'ascent' : 'start'
    )
  );
  const st = evaluateSquatCompletionState(cam24);
  ok('C: ultra path or blocked only', st.completionPassReason === 'ultra_low_rom_cycle' || !st.completionSatisfied, {
    pr: st.completionPassReason,
    sat: st.completionSatisfied,
  });
}

{
  const shallowDepths = [
    0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
  ];
  const shallowPhases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const shallowFrames = shallowDepths.map((d, i) => makeFrame(d, (t += 80), shallowPhases[i]));
  const deepTailDepths = [
    0.01, 0.01, 0.02, 0.08, 0.18, 0.32, 0.48, 0.52, 0.55, 0.52, 0.38, 0.22, 0.1, 0.02, 0.01,
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ];
  const deepTailPhases = [
    'start', 'start', 'descent', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const stepDeep = 75;
  const deepFrames = deepTailDepths.map((d, i) => makeFrame(d, (t += stepDeep), deepTailPhases[i]));
  const st = evaluateSquatCompletionState([...shallowFrames, ...deepFrames]);
  ok('C: prefix shallow beats standard drift', st.completionPassReason === 'low_rom_cycle', st);
  ok('C: drift false after prefix', st.officialShallowDriftedToStandard === false, st);
}

{
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 200;
  const fr = depths.map((d, i) => makeFrame(d, (t += 60), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('C: deep standard preserved', st.completionPassReason === 'standard_cycle', st.completionPassReason);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
