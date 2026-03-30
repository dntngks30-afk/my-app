/**
 * PR-03 — ultra-low ROM 공식 path (CAM-24 픽스처 + trace 필드)
 *
 * npx tsx scripts/camera-ultra-low-rom-official-path-smoke.mjs
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
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}
function frames(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

console.log('\nPR-03 camera-ultra-low-rom-official-path-smoke\n');

{
  const state = evaluateSquatCompletionState(
    frames(
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

  ok('ultra: completionSatisfied', state.completionSatisfied === true, state);
  ok('ultra: ultra_low_rom_cycle', state.completionPassReason === 'ultra_low_rom_cycle', state.completionPassReason);
  ok('ultra: officialShallowPathCandidate', state.officialShallowPathCandidate === true, state);
  ok('ultra: officialShallowPathAdmitted', state.officialShallowPathAdmitted === true, state);
  ok('ultra: officialShallowPathClosed', state.officialShallowPathClosed === true, state);
  ok('ultra: attemptStarted', state.attemptStarted === true, state.attemptStarted);
  ok('ultra: descendConfirmed', state.descendConfirmed === true, state.descendConfirmed);
  ok('ultra: recoveryConfirmedAfterReversal', state.recoveryConfirmedAfterReversal === true, state);
  ok(
    'ultra: pr03 or classic arming reason',
    state.officialShallowPathReason === 'pr03_official_shallow_contract' ||
      state.officialShallowPathReason === 'classic_start_before_bottom',
    state.officialShallowPathReason
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
