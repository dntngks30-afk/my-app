/**
 * PR-CAM-24 smoke test — guarded ultra-low squat pass
 *
 * 검증 목표:
 * - 0.01–0.02 guarded ultra-low cycle가 더 이상 insufficient_relative_depth로 막히지 않는다.
 * - guarded proof가 없는 tiny movement는 여전히 막힌다.
 * - 0.02+ low-ROM 및 deep path는 유지된다.
 *
 * 실행:
 *   npx tsx scripts/camera-cam24-guarded-ultralow-pass-smoke.mjs
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

console.log('\nA. guarded ultra-low real squat can pass');
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

  ok('A1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'A2: completionPassReason = ultra_low_rom_event_cycle',
    state.completionPassReason === 'ultra_low_rom_event_cycle',
    { completionPassReason: state.completionPassReason, blocked: state.completionBlockedReason }
  );
  ok(
    'A3: sub-0.02 no longer blocked as insufficient_relative_depth',
    state.completionBlockedReason === null,
    state.completionBlockedReason
  );
  ok(
    'A4: ultra-low interpretation admitted',
    state.evidenceLabel === 'ultra_low_rom',
    { evidenceLabel: state.evidenceLabel, relativeDepthPeak: state.relativeDepthPeak }
  );
  ok(
    'A5: guarded timing/recovery trace looks real',
    state.recoveryReturnContinuityFrames >= 4 &&
      state.recoveryDropRatio >= 0.45 &&
      state.squatDescentToPeakMs >= 120,
    {
      recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
      recoveryDropRatio: state.recoveryDropRatio,
      squatDescentToPeakMs: state.squatDescentToPeakMs,
      squatReversalToStandingMs: state.squatReversalToStandingMs,
    }
  );
}

console.log('\nB. 0.01–0.02 fake tiny movement without guarded proof still fails');
{
  const state = evaluateSquatCompletionState(
    frames(
      [0.0, 0.0, 0.0, 0.0, 0.004, 0.009, 0.014, 0.015, 0.011, 0.01, 0.009, 0.009],
      ['start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'ascent', 'start', 'start', 'start'],
      40
    )
  );

  ok('B1: completionSatisfied = false', state.completionSatisfied === false, state);
  ok(
    'B2: fake guarded ultra-low still blocked',
    state.completionBlockedReason != null,
    state.completionBlockedReason
  );
}

console.log('\nC. ordinary low-ROM path preserved');
{
  const state = evaluateSquatCompletionState(
    frames(
      [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start'],
      80
    )
  );

  ok('C1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'C2: low-ROM owner preserved',
    state.completionPassReason === 'low_rom_event_cycle',
    state.completionPassReason
  );
}

console.log('\nD. deep squat preserved');
{
  const state = evaluateSquatCompletionState(
    frames(
      [0.01, 0.01, 0.01, 0.01, 0.10, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.10, 0.02, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start'],
      60
    )
  );

  ok('D1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok(
    'D2: standard owner preserved',
    state.completionPassReason === 'standard_cycle',
    state.completionPassReason
  );
}

console.log(`\n━━━ PR-CAM-24 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
