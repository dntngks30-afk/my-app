/**
 * PR-03 rework — 공식 shallow path closure (low_rom_cycle | ultra_low_rom_cycle) + deep 보존
 *
 * npx tsx scripts/camera-shallow-official-closure-smoke.mjs
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
function buildFrames(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

console.log('\nPR-03 camera-shallow-official-closure-smoke\n');

// deep standard — shallow 플래그·finalize 보존
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    60
  );
  const st = evaluateSquatCompletionState(fr);
  ok('deep: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('deep: officialShallowPathCandidate false', st.officialShallowPathCandidate === false, st.officialShallowPathCandidate);
  ok('deep: rule_finalized', st.completionFinalizeMode === 'rule_finalized', st.completionFinalizeMode);
  ok('deep: assist off', st.completionAssistApplied === false, st.completionAssistApplied);
  ok('deep: not event rescue pass reason', st.completionPassReason.endsWith('_event_cycle') === false, st.completionPassReason);
}

// shallow valid — 공식 closure
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);
  ok('shallow: candidate', st.officialShallowPathCandidate === true, st);
  ok('shallow: admitted', st.officialShallowPathAdmitted === true, st);
  ok('shallow: closed', st.officialShallowPathClosed === true, st);
  ok('shallow: pass reason low_rom_cycle', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('shallow: blocked null', st.officialShallowPathBlockedReason == null, st.officialShallowPathBlockedReason);
  ok('shallow: closedAsOfficialRomCycle (state)', st.officialShallowPathClosed === true, st);
  ok('shallow: not event rescue reason', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);
}

// ultra-low style
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [
        0.0, 0.0, 0.0, 0.0,
        0.004, 0.008, 0.012, 0.018,
        0.017, 0.016, 0.0154, 0.006, 0.005, 0.004, 0.003, 0.003,
      ],
      [
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'ascent', 'ascent', 'start', 'start', 'start',
      ],
      40
    )
  );
  ok('ultra: closed', st.officialShallowPathClosed === true, st);
  ok('ultra: ultra_low_rom_cycle', st.completionPassReason === 'ultra_low_rom_cycle', st.completionPassReason);
}

// descend only
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.1, 0.1, 0.1, 0.1],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
      80
    )
  );
  ok('descend-only: no close', st.officialShallowPathClosed !== true, st);
  ok('descend-only: no reversal after descend', st.reversalConfirmedAfterDescend === false, st);
}

// seated hold
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [0.01, 0.01, 0.01, 0.01, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04],
      ['start', 'start', 'start', 'start', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
      100
    )
  );
  ok('seated-like: no official close', st.officialShallowPathClosed !== true, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
