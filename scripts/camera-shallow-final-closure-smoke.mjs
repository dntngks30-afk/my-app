/**
 * PR-03 shallow closure final — 공식 shallow 가 low_rom_cycle / ultra_low_rom_cycle 로 닫히는지
 *
 * npx tsx scripts/camera-shallow-final-closure-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
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

console.log('\nPR-03 camera-shallow-final-closure-smoke\n');

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('shallow success: satisfied', st.completionSatisfied === true, st);
  ok(
    'shallow success: pass reason low_rom or ultra',
    st.completionPassReason === 'low_rom_cycle' || st.completionPassReason === 'ultra_low_rom_cycle',
    st.completionPassReason
  );
  ok('shallow success: candidate', st.officialShallowPathCandidate === true, st);
  ok('shallow success: admitted', st.officialShallowPathAdmitted === true, st);
  ok('shallow success: closed', st.officialShallowPathClosed === true, st);
  ok('shallow success: closure proof flag', st.officialShallowClosureProofSatisfied === true, st);
  ok('shallow success: reversal satisfied', st.officialShallowReversalSatisfied === true, st);
  ok('shallow success: not event rescue pass', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);
  ok('shallow success: drift false', st.officialShallowDriftedToStandard === false, st);
  ok('shallow success: drift reason null', st.officialShallowDriftReason == null, st.officialShallowDriftReason);
}

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.02, 0.04, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 90), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('descent-only / seated-ish: not satisfied', st.completionSatisfied === false, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
