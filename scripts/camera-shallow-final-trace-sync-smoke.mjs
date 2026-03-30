/**
 * PR-03 shallow closure final — completion state 필드가 trace 계약과 논리적으로 일치하는지
 *
 * npx tsx scripts/camera-shallow-final-trace-sync-smoke.mjs
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

/** camera-trace `buildSquatAttemptObservation` 과 동일한 불리언 동기화 규칙 */
function traceMirrorFromCompletionState(cs) {
  return {
    closedAsOfficialRomCycle: cs?.officialShallowPathClosed === true,
    closedAsEventRescuePassReason:
      cs?.completionPassReason === 'low_rom_event_cycle' ||
      cs?.completionPassReason === 'ultra_low_rom_event_cycle',
    officialShallowClosureProofSatisfied: cs?.officialShallowClosureProofSatisfied === true,
    officialShallowPrimaryDropClosureFallback: cs?.officialShallowPrimaryDropClosureFallback === true,
    officialShallowReversalSatisfied: cs?.officialShallowReversalSatisfied === true,
    officialShallowDriftedToStandard: cs?.officialShallowDriftedToStandard === true,
  };
}

console.log('\nPR-03 camera-shallow-final-trace-sync-smoke\n');

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  const tr = traceMirrorFromCompletionState(st);
  ok('trace mirror: closedAsOfficialRomCycle', tr.closedAsOfficialRomCycle === true, tr);
  ok('trace mirror: not event rescue', tr.closedAsEventRescuePassReason === false, tr);
  ok('trace mirror: closure proof', tr.officialShallowClosureProofSatisfied === true, tr);
  ok('trace mirror: reversal', tr.officialShallowReversalSatisfied === true, tr);
  ok('trace mirror: drift', tr.officialShallowDriftedToStandard === false, tr);
  ok('state: primary fallback is boolean', typeof st.officialShallowPrimaryDropClosureFallback === 'boolean', st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
