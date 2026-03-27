/**
 * PR-CAM-27 smoke test — guarded low-ROM standing recovery finalization
 *
 * 검증 목표:
 * - low_rom은 짧지만 실제적인 standing tail에서 guarded finalize 가능
 * - mid-ascent / noisy partial / ultra-low fake widen은 계속 차단
 * - standard는 기존 strict standing hold 계약 유지
 * - debug에 band-aware recovery minimum 이 명시적으로 남음
 *
 * 실행:
 *   npx tsx scripts/camera-cam27-lowrom-standing-recovery-finalize-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);
const { isFinalPassLatched } = await import('../src/lib/camera/auto-progression.ts');

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

function makeSquatGate(opts) {
  return {
    completionSatisfied: opts.completionSatisfied ?? true,
    confidence: opts.confidence,
    passConfirmationSatisfied: opts.passConfirmationSatisfied ?? true,
    passConfirmationFrameCount: opts.passConfirmationFrameCount ?? 3,
    guardrail: {
      captureQuality: opts.captureQuality ?? 'ok',
      flags: opts.flags ?? [],
      retryRecommended: false,
      completionStatus: 'complete',
    },
    evaluatorResult: {
      debug: {
        squatCompletionState: opts.squatCompletionState ?? null,
      },
    },
  };
}

console.log('\nA. low_rom short standing tail can still finalize');
{
  const state = evaluateSquatCompletionState(
    frames(
      [
        0.01, 0.01, 0.01, 0.01,
        0.03, 0.05, 0.07, 0.09, 0.09,
        0.07, 0.05, 0.03, 0.018, 0.012, 0.01,
      ],
      [
        'start', 'start', 'start', 'start',
        'descent', 'descent', 'descent', 'bottom', 'bottom',
        'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
      ],
      40
    )
  );

  ok('A1: completionSatisfied = true', state.completionSatisfied === true, state);
  ok('A2: currentSquatPhase = standing_recovered', state.currentSquatPhase === 'standing_recovered', {
    currentSquatPhase: state.currentSquatPhase,
    blocked: state.completionBlockedReason,
  });
  ok('A3: evidenceLabel = low_rom', state.evidenceLabel === 'low_rom', {
    evidenceLabel: state.evidenceLabel,
    relativeDepthPeak: state.relativeDepthPeak,
  });
  ok(
    'A4: low_rom uses guarded shorter standing hold',
    state.standingRecoveryBand === 'low_rom' &&
      state.standingRecoveryMinFramesUsed === 2 &&
      state.standingRecoveryMinHoldMsUsed === 60,
    {
      standingRecoveryBand: state.standingRecoveryBand,
      standingRecoveryMinFramesUsed: state.standingRecoveryMinFramesUsed,
      standingRecoveryMinHoldMsUsed: state.standingRecoveryMinHoldMsUsed,
      standingRecoveryHoldMs: state.standingRecoveryHoldMs,
    }
  );
}

console.log('\nB. mid-ascent is still blocked');
{
  const state = evaluateSquatCompletionState(
    frames(
      [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.08, 0.07, 0.06, 0.055],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent'],
      40
    )
  );

  ok('B1: completionSatisfied = false', state.completionSatisfied === false, state);
  ok(
    'B2: blocked reason remains recovery related',
    state.completionBlockedReason === 'not_standing_recovered',
    {
      completionBlockedReason: state.completionBlockedReason,
      currentSquatPhase: state.currentSquatPhase,
    }
  );
}

console.log('\nC. noisy/partial false positives remain blocked');
{
  const state = evaluateSquatCompletionState(
    frames(
      [0.01, 0.01, 0.01, 0.01, 0.028, 0.034, 0.029, 0.02, 0.012, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'bottom', 'ascent', 'start', 'start', 'start'],
      40
    )
  );
  ok('C1: fake shallow spike does not complete', state.completionSatisfied === false, state);

  const blockedGate = makeSquatGate({
    confidence: 0.64,
    captureQuality: 'low',
    flags: ['hard_partial', 'unstable_frame_timing'],
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'C2: low-quality standard false positive still blocked',
    isFinalPassLatched('squat', blockedGate) === false,
    isFinalPassLatched('squat', blockedGate)
  );
}

console.log('\nD. standard path stays strict');
{
  const state = evaluateSquatCompletionState(
    frames(
      [0.01, 0.01, 0.01, 0.01, 0.10, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.10, 0.02, 0.01, 0.01, 0.01, 0.01],
      ['start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start', 'start'],
      40
    )
  );

  ok('D1: standard completion preserved', state.completionSatisfied === true, state);
  ok('D2: standard owner preserved', state.completionPassReason === 'standard_cycle', state.completionPassReason);
  ok(
    'D3: standard still uses strict standing hold mins',
    state.standingRecoveryBand === 'standard' &&
      state.standingRecoveryMinFramesUsed === 2 &&
      state.standingRecoveryMinHoldMsUsed === 160,
    {
      standingRecoveryBand: state.standingRecoveryBand,
      standingRecoveryMinFramesUsed: state.standingRecoveryMinFramesUsed,
      standingRecoveryMinHoldMsUsed: state.standingRecoveryMinHoldMsUsed,
    }
  );
}

console.log('\nE. ultra-low-ROM is not accidentally widened');
{
  const failState = evaluateSquatCompletionState(
    frames(
      [0.0, 0.0, 0.0, 0.0, 0.004, 0.009, 0.014, 0.015, 0.011, 0.01, 0.009, 0.009],
      ['start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'ascent', 'start', 'start', 'start'],
      40
    )
  );

  ok('E1: insufficient ultra-low signal still fails', failState.completionSatisfied === false, failState);

  const preservedState = evaluateSquatCompletionState(
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
  ok(
    'E2: ultra-low stays on strict standing-recovery band',
    preservedState.standingRecoveryBand === 'ultra_low_rom' &&
      preservedState.standingRecoveryMinHoldMsUsed === 160 &&
      preservedState.completionSatisfied === true,
    {
      standingRecoveryBand: preservedState.standingRecoveryBand,
      standingRecoveryMinHoldMsUsed: preservedState.standingRecoveryMinHoldMsUsed,
      completionBlockedReason: preservedState.completionBlockedReason,
      completionSatisfied: preservedState.completionSatisfied,
    }
  );
}

console.log('\nF. debug truth is explicit');
{
  const state = evaluateSquatCompletionState(
    frames(
      [
        0.01, 0.01, 0.01, 0.01,
        0.03, 0.05, 0.07, 0.09, 0.09,
        0.07, 0.05, 0.03, 0.018, 0.012, 0.01,
      ],
      [
        'start', 'start', 'start', 'start',
        'descent', 'descent', 'descent', 'bottom', 'bottom',
        'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
      ],
      40
    )
  );

  ok(
    'F1: band-aware recovery debug fields are populated',
    typeof state.standingRecoveryBand === 'string' &&
      typeof state.standingRecoveryMinFramesUsed === 'number' &&
      typeof state.standingRecoveryMinHoldMsUsed === 'number' &&
      typeof state.standingRecoveryFinalizeReason === 'string',
    {
      standingRecoveryBand: state.standingRecoveryBand,
      standingRecoveryMinFramesUsed: state.standingRecoveryMinFramesUsed,
      standingRecoveryMinHoldMsUsed: state.standingRecoveryMinHoldMsUsed,
      standingRecoveryFinalizeReason: state.standingRecoveryFinalizeReason,
    }
  );
}

console.log(`\n━━━ PR-CAM-27 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
