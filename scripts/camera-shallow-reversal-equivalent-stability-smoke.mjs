/**
 * PR-03 final — shallow 입장 후 progression 역전이 있으면 rule blocked 가 no_reversal 로 역행하지 않음
 *
 * npx tsx scripts/camera-shallow-reversal-equivalent-stability-smoke.mjs
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

console.log('\nPR-03 camera-shallow-reversal-equivalent-stability-smoke\n');

// 정상 shallow 완료 — reversal 축·closure proof·blocked 일관
{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('shallow ok: reversal satisfied', st.officialShallowReversalSatisfied === true, st);
  ok('shallow ok: closure proof', st.officialShallowClosureProofSatisfied === true, st);
  ok('shallow ok: rule blocked null', st.ruleCompletionBlockedReason == null, st.ruleCompletionBlockedReason);
  ok('shallow ok: not no_reversal at terminal', st.completionBlockedReason !== 'no_reversal', st.completionBlockedReason);
}

// 하강만 — reversal 없음, no_reversal 유지 (오탐 아님)
{
  const st = evaluateSquatCompletionState(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.1, 0.1, 0.1, 0.1].map((d, i) =>
      makeFrame(d, 200 + i * 80, ['start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'][i])
    )
  );
  ok('descend-only: no reversal flag', st.officialShallowReversalSatisfied === false, st);
  ok('descend-only: not closed', st.officialShallowPathClosed !== true, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
