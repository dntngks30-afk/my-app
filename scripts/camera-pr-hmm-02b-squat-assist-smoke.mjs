/**
 * PR-HMM-02B — HMM shadow blocked-reason assist smoke
 *
 * 실행:
 *   npx tsx scripts/camera-pr-hmm-02b-squat-assist-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');
const {
  getHmmAssistDecision,
  shouldUseHmmAssistForBlockedReason,
} = await import('../src/lib/camera/squat/squat-hmm-assist.ts');

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
    timestampDeltaMs: 40,
    stepId: 'squat',
  };
}

function buildFrames(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

console.log('\n-- A. descent_span_too_short + strong HMM + finalize OK -> assist -> completion true --');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01,
    0.03, 0.08, 0.09, 0.09,
    0.06, 0.03, 0.02, 0.015, 0.012, 0.01,
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const without = evaluateSquatCompletionState(fr);
  const withHmm = evaluateSquatCompletionState(fr, { hmm });

  ok('A: rule-only blocked is descent_span_too_short', without.completionBlockedReason === 'descent_span_too_short', without);
  ok('A: rule-only completion false', without.completionSatisfied === false, without);
  ok('A: HMM strong enough for assist', hmm.completionCandidate && hmm.confidence >= 0.45, hmm);
  ok('A: assist applied', withHmm.hmmAssistApplied === true, withHmm);
  ok('A: final completion true', withHmm.completionSatisfied === true, withHmm);
  ok('A: phase standing_recovered', withHmm.currentSquatPhase === 'standing_recovered', withHmm);
}

console.log('\n-- B. no_descend + strong HMM + post gates -> assist (policy module) --');
{
  /** 피크 직후 급락 1프레임이면 z가 바로 떨어져 ascent dwell<2 — 완만한 2스텝 추가 (HMM z-정규화 정합) */
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.03, 0.06, 0.09, 0.09, 0.084, 0.072, 0.048, 0.028, 0.016, 0.012, 0.01, 0.01, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start', 'start', 'start',
    ],
    40
  );
  const hmm = decodeSquatHmm(fr);
  ok('B: HMM strong for fixture', hmm.completionCandidate && hmm.confidence >= 0.45, hmm);
  ok('B: shouldUseHmmAssistForBlockedReason', shouldUseHmmAssistForBlockedReason('no_descend', hmm), hmm);
  const dec = getHmmAssistDecision(hmm, {
    completionBlockedReason: 'no_descend',
    relativeDepthPeak: 0.08,
    standingRecoveredAtMs: 500,
    standingRecoveryFinalizeSatisfied: true,
    ascendConfirmed: true,
    downwardCommitmentReached: true,
    attemptAdmissionSatisfied: true,
    committedFrameExists: true,
  });
  ok('B: assist eligible', dec.assistEligible === true, dec);
  ok('B: assist applied', dec.assistApplied === true, dec);
  ok('B: nextBlockedReason null', dec.nextBlockedReason === null, dec);
}

console.log('\n-- C. no_reversal + strong HMM + post gates -> assist (policy module) --');
{
  const fr = buildFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.04, 0.08, 0.12, 0.12, 0.07, 0.03, 0.015, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    ],
    [
      'start', 'start', 'start', 'start', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start', 'start', 'start',
    ],
    40
  );
  const hmm = decodeSquatHmm(fr);
  ok('C: HMM strong', hmm.completionCandidate && hmm.confidence >= 0.45, hmm);
  ok('C: shouldUseHmmAssistForBlockedReason', shouldUseHmmAssistForBlockedReason('no_reversal', hmm), hmm);
  const dec = getHmmAssistDecision(hmm, {
    completionBlockedReason: 'no_reversal',
    relativeDepthPeak: 0.11,
    standingRecoveredAtMs: 600,
    standingRecoveryFinalizeSatisfied: true,
    ascendConfirmed: true,
    downwardCommitmentReached: true,
    attemptAdmissionSatisfied: true,
    committedFrameExists: true,
  });
  ok('C: assist eligible', dec.assistEligible === true, dec);
  ok('C: assist applied', dec.assistApplied === true, dec);
  ok('C: nextBlockedReason null', dec.nextBlockedReason === null, dec);
}

console.log('\n-- D. recovery/finalize blocked + strong HMM -> override forbidden --');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01,
    0.03, 0.05, 0.07, 0.09, 0.09,
    0.07, 0.05, 0.03, 0.02, 0.015,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'ascent', 'ascent',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const withHmm = evaluateSquatCompletionState(fr, { hmm });
  const dBlocked = withHmm.completionBlockedReason;
  ok(
    'D: blocked recovery/finalize family',
    dBlocked === 'recovery_hold_too_short' ||
      dBlocked === 'low_rom_standing_finalize_not_satisfied' ||
      dBlocked === 'ultra_low_rom_standing_finalize_not_satisfied',
    withHmm
  );
  ok('D: assist not applied', withHmm.hmmAssistApplied === false, withHmm);
  ok('D: completion false', withHmm.completionSatisfied === false, withHmm);
}

console.log('\n-- E. ultra_low finalize fail + strong HMM -> override forbidden --');
{
  const depths = [
    0.01, 0.01, 0.01, 0.01,
    0.02, 0.035, 0.045, 0.048, 0.047,
    0.04, 0.03, 0.018, 0.014,
  ];
  const phases = [
    'start', 'start', 'start', 'start',
    'descent', 'descent', 'bottom', 'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'ascent',
  ];
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const withHmm = evaluateSquatCompletionState(fr, { hmm });
  ok(
    'E: ultra-low finalize fail preserved',
    withHmm.completionBlockedReason === 'ultra_low_rom_standing_finalize_not_satisfied' ||
      withHmm.completionBlockedReason === 'recovery_hold_too_short',
    withHmm
  );
  ok('E: assist not applied', withHmm.hmmAssistApplied === false, withHmm);
  ok('E: completion false', withHmm.completionSatisfied === false, withHmm);
}

console.log('\n-- F. standing jitter, weak HMM -> assist off --');
{
  const depths = Array(20).fill(0.005).map((_, i) => 0.004 + (i % 3) * 0.0008);
  const phases = Array(20).fill('start');
  const fr = buildFrames(depths, phases, 40);
  const hmm = decodeSquatHmm(fr);
  const withHmm = evaluateSquatCompletionState(fr, { hmm });
  ok('F: weak HMM', !hmm.completionCandidate || hmm.confidence < 0.45, hmm);
  ok('F: assist not applied', withHmm.hmmAssistApplied === false, withHmm);
}

console.log(`\n== PR-HMM-02B assist smoke: ${passed} passed, ${failed} failed ==\n`);
