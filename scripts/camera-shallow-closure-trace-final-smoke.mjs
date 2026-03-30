/**
 * PR-03 final — completion state / trace 계약 필드 동기화
 *
 * npx tsx scripts/camera-shallow-closure-trace-final-smoke.mjs
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

console.log('\nPR-03 camera-shallow-closure-trace-final-smoke\n');

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('keys: reversal', typeof st.officialShallowReversalSatisfied === 'boolean', st);
  ok('keys: ascent equiv', typeof st.officialShallowAscentEquivalentSatisfied === 'boolean', st);
  ok('keys: closure proof', typeof st.officialShallowClosureProofSatisfied === 'boolean', st);
  ok('keys: drift', typeof st.officialShallowDriftedToStandard === 'boolean', st);
  ok('keys: drift reason null|string', st.officialShallowDriftReason == null || typeof st.officialShallowDriftReason === 'string', st);
  ok('keys: prefix count', st.officialShallowPreferredPrefixFrameCount == null || typeof st.officialShallowPreferredPrefixFrameCount === 'number', st);
  ok('closedAsOfficial: sync', st.officialShallowPathClosed === true, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
