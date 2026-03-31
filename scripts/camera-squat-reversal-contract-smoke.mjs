/**
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract B smoke (strict + shallow bridge via completion state)
 * npx tsx scripts/camera-squat-reversal-contract-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { detectSquatReversalConfirmation } = await import(
  '../src/lib/camera/squat/squat-reversal-confirmation.ts'
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

console.log('\ncamera-squat-reversal-contract-smoke\n');

{
  const valid = [];
  let ts = 0;
  for (let i = 0; i < 8; i++) valid.push(makeFrame(0.01, (ts += 40), 'start'));
  for (let i = 0; i < 10; i++) valid.push(makeFrame(0.05 + i * 0.04, (ts += 40), i < 5 ? 'descent' : 'bottom'));
  for (let i = 0; i < 10; i++) valid.push(makeFrame(0.45 - i * 0.03, (ts += 40), 'ascent'));
  for (let i = 0; i < 6; i++) valid.push(makeFrame(0.02, (ts += 40), 'start'));
  const peakIdx = valid.reduce((b, f, i) => (f.derived.squatDepthProxy > valid[b].derived.squatDepthProxy ? i : b), 0);
  const peakP = valid[peakIdx].derived.squatDepthProxy;
  const rev = detectSquatReversalConfirmation({
    validFrames: valid,
    peakValidIndex: peakIdx,
    peakPrimaryDepth: peakP,
    relativeDepthPeak: 0.44,
    reversalDropRequired: Math.max(0.007, 0.44 * 0.13),
    hmm: null,
  });
  ok('B1 strict: deep cycle reversal', rev.reversalConfirmed === true, rev);
}

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('shallow: reversal satisfied', st.officialShallowReversalSatisfied === true, st);
  ok(
    'shallow: bridge or strict path',
    st.reversalEvidenceProvenance != null || st.reversalConfirmedAfterDescend === true,
    st
  );
}

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.02, 0.04, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 90), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('descent-only: not satisfied', st.completionSatisfied === false, st);
}

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
  const fr = depths.map((d, i) => makeFrame(d, 100 + i * 50, 'start'));
  const st = evaluateSquatCompletionState(fr);
  ok('standing/jitter: no pass', st.completionSatisfied === false, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
