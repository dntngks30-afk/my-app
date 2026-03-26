/**
 * PR-CAM-23 smoke test — adaptive low-ROM timing guards
 *
 * 검증 목표:
 * - low-ROM 짧은 timing(120~160ms / 140~180ms)이라도
 *   continuity/recovery proof가 충분하면 pass
 * - 같은 shallow 영역이라도 continuity proof가 약하면 계속 fail
 * - deep / standing 동작은 그대로
 *
 * 실행:
 *   npx tsx scripts/camera-cam23-squat-lowrom-timing-guard-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
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
  return depths.map((depth, i) => makeFrame(depth, 100 + i * stepMs, phases[i] ?? 'start'));
}

console.log('\nA. genuine shallow low-ROM cycle passes with relaxed timing');
{
  const state = evaluateSquatCompletionState(
    frames(
      [
        0.01, 0.01, 0.01, 0.01,
        0.02, 0.04, 0.07, 0.09, 0.09,
        0.06, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01,
      ],
      [
        'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'start', 'start',
        'ascent', 'ascent', 'start', 'start', 'start', 'start', 'start', 'start',
      ],
      40
    )
  );

  ok('A1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'A2: completionPassReason stays non-standard',
    ['low_rom_event_cycle', 'ultra_low_rom_event_cycle'].includes(state.completionPassReason),
    { completionPassReason: state.completionPassReason, blocked: state.completionBlockedReason }
  );
  ok(
    'A3: low-ROM interpretation preserved',
    state.evidenceLabel === 'low_rom',
    { evidenceLabel: state.evidenceLabel, relativeDepthPeak: state.relativeDepthPeak }
  );
  ok(
    'A4: descent-to-peak is in relaxed range (~120ms)',
    state.squatDescentToPeakMs === 120,
    state.squatDescentToPeakMs
  );
  ok(
    'A5: reversal-to-standing is in relaxed range (~160ms)',
    state.squatReversalToStandingMs === 160,
    state.squatReversalToStandingMs
  );
}

console.log('\nB. fake shallow dip without continuity still fails');
{
  const state = evaluateSquatCompletionState(
    frames(
      [
        0.01, 0.01, 0.01, 0.01,
        0.019, 0.023, 0.027, 0.031, 0.031,
        0.024, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
      ],
      [
        'start', 'start', 'start', 'start',
        'descent', 'descent', 'descent', 'bottom', 'bottom',
        'ascent', 'start', 'start', 'start', 'start', 'start', 'start',
      ],
      40
    )
  );

  ok('B1: completionSatisfied = false', state.completionSatisfied === false, state);
  ok(
    'B2: weak continuity still blocked by timing',
    state.completionBlockedReason === 'descent_span_too_short',
    {
      completionBlockedReason: state.completionBlockedReason,
      recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
      recoveryDropRatio: state.recoveryDropRatio,
    }
  );
}

console.log('\nC. deep squat unchanged');
{
  const state = evaluateSquatCompletionState(
    frames(
      [
        0.01, 0.01, 0.01, 0.01,
        0.10, 0.22, 0.36, 0.52, 0.52,
        0.36, 0.22, 0.10, 0.02, 0.01, 0.01,
      ],
      [
        'start', 'start', 'start', 'start',
        'descent', 'descent', 'descent', 'bottom', 'bottom',
        'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
      ],
      60
    )
  );

  ok('C1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'C2: completionPassReason = standard_cycle',
    state.completionPassReason === 'standard_cycle',
    state.completionPassReason
  );
}

console.log('\nD. standing still unchanged');
{
  const state = evaluateSquatCompletionState(
    frames([0.01, 0.01, 0.01, 0.012, 0.011, 0.01, 0.01, 0.01], Array(8).fill('start'), 50)
  );

  ok('D1: no false pass', state.completionSatisfied === false, state);
}

console.log(`\n━━━ PR-CAM-23 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
