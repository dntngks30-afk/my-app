/**
 * PR-03 rework — completion state 가 trace 계약 필드를 노출하는지 (스냅샷 없이 직접 state 검증)
 *
 * npx tsx scripts/camera-shallow-closure-trace-smoke.mjs
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

console.log('\nPR-03 camera-shallow-closure-trace-smoke\n');

const shallowOk = evaluateSquatCompletionState(
  [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01].map((d, i) =>
    makeFrame(d, 100 + i * 80, ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start'][i])
  )
);

ok('trace keys: bridge flag boolean', typeof shallowOk.officialShallowStreamBridgeApplied === 'boolean', shallowOk);
ok('trace keys: ascent equiv boolean', typeof shallowOk.officialShallowAscentEquivalentSatisfied === 'boolean', shallowOk);
ok('trace keys: closure proof boolean', typeof shallowOk.officialShallowClosureProofSatisfied === 'boolean', shallowOk);
ok('shallow ok: closed matches trace closedAsOfficialRomCycle', shallowOk.officialShallowPathClosed === true, shallowOk);

const deep = evaluateSquatCompletionState(
  [0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01].map((d, i) =>
    makeFrame(d, 100 + i * 60, ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start'][i])
  )
);
ok('deep: shallow bridge off', deep.officialShallowStreamBridgeApplied === false, deep);
ok('deep: standard_cycle', deep.completionPassReason === 'standard_cycle', deep.completionPassReason);

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
