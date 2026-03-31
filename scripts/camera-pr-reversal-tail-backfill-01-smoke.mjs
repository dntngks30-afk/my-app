/**
 * PR-CAM-REVERSAL-TAIL-BACKFILL-01 — standing tail 증거로 reversal 앵커 backfill
 *
 * npx tsx scripts/camera-pr-reversal-tail-backfill-01-smoke.mjs
 *
 * 회귀(문서 참고, 본 스크립트에서 재실행하지 않음):
 * - npx tsx scripts/camera-pr-ascent-integrity-rescue-01-smoke.mjs
 * - npx tsx scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs
 * - npx tsx scripts/camera-peak-anchor-integrity-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  getGuardedStandingTailReversalBackfill,
  evaluateSquatCompletionState,
  trajectoryRescueMeetsAscentIntegrity,
} = await import('../src/lib/camera/squat-completion-state.ts');

const MIN_SHALLOW_MS = 200;

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

function mkFrame(depth, phase, ts) {
  return {
    timestampMs: ts,
    isValid: true,
    phaseHint: phase,
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

const peakF = { index: 14, depth: 0.14, timestampMs: 100 + 14 * 80, phaseHint: 'bottom' };
const committedF = { index: 12, depth: 0.12, timestampMs: 100 + 12 * 80, phaseHint: 'bottom' };

const baseArgs = {
  reversalFrame: undefined,
  committedFrame: committedF,
  committedOrPostCommitPeakFrame: peakF,
  attemptStarted: true,
  downwardCommitmentReached: true,
  standingRecoveredAtMs: 100 + 40 * 80,
  standingRecoveryFinalizeReason: 'tail_hold_below_min',
  recovery: { recoveryReturnContinuityFrames: 3, recoveryDropRatio: 0.5 },
  squatReversalDropRequired: 0.02,
  squatReversalDropAchieved: 0.018,
  minReversalToStandingMsForShallow: MIN_SHALLOW_MS,
};

console.log('PR-CAM-REVERSAL-TAIL-BACKFILL-01 smoke\n');

// A: helper — full pass
{
  const r = getGuardedStandingTailReversalBackfill(baseArgs);
  ok('A: backfillApplied true', r.backfillApplied === true, r);
  ok('A: backfilled is peak frame', r.backfilledReversalFrame === peakF, r);
}

// B: no standingRecoveredAtMs
{
  const r = getGuardedStandingTailReversalBackfill({ ...baseArgs, standingRecoveredAtMs: undefined });
  ok('B: no standing ms → no backfill', r.backfillApplied === false, r);
}

// C: insufficient drop
{
  const r = getGuardedStandingTailReversalBackfill({
    ...baseArgs,
    squatReversalDropAchieved: 0.01,
    squatReversalDropRequired: 0.02,
  });
  ok('C: drop below 0.9*required → no backfill', r.backfillApplied === false, r);
}

// D: low continuity
{
  const r = getGuardedStandingTailReversalBackfill({
    ...baseArgs,
    recovery: { recoveryReturnContinuityFrames: 1, recoveryDropRatio: 0.5 },
  });
  ok('D: continuity < 2 → no backfill', r.backfillApplied === false, r);
}

// E: explicit reversalFrame
{
  const explicit = { ...peakF, index: 10 };
  const r = getGuardedStandingTailReversalBackfill({
    ...baseArgs,
    reversalFrame: explicit,
  });
  ok('E: explicit reversal → backfill false', r.backfillApplied === false, r);
  ok('E: returns explicit frame', r.backfilledReversalFrame === explicit, r);
}

// F: timing fail
{
  const r = getGuardedStandingTailReversalBackfill({
    ...baseArgs,
    standingRecoveredAtMs: peakF.timestampMs + 50,
  });
  ok('F: timing < min shallow → no backfill', r.backfillApplied === false, r);
}

// G: ascent integrity — explicit false + finalize false → false (tail 경로가 동일 계약 사용)
{
  const g = trajectoryRescueMeetsAscentIntegrity({
    explicitAscendConfirmed: false,
    standingRecoveredAtMs: 5000,
    standingRecoveryFinalizeSatisfied: false,
    recoveryReturnContinuityFrames: 4,
    recoveryDropRatio: 0.5,
    reversalAtMs: peakF.timestampMs,
    minReversalToStandingMs: MIN_SHALLOW_MS,
  });
  ok('G: integrity false without explicit ascend or finalize', g === false, g);
}

// Integration: 필드 노출 + 얕은 의미 사이클 회귀 (end-to-end tail 발동은 랜드마크 합성 스모크에서 dogfood)
{
  const st = evaluateSquatCompletionState(
    [0.02, 0.025, 0.03].map((d, i) => mkFrame(d, 'start', 100 + i * 80))
  );
  ok('Int: reversalTailBackfillApplied is boolean', typeof st.reversalTailBackfillApplied === 'boolean');

  const pr7 = [
    0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
  ].map((d, i) =>
    mkFrame(
      d,
      [
        'start',
        'start',
        'start',
        'start',
        'descent',
        'descent',
        'descent',
        'bottom',
        'bottom',
        'ascent',
        'ascent',
        'ascent',
        'start',
        'start',
        'start',
      ][i],
      1000 + i * 80
    )
  );
  const shallow = evaluateSquatCompletionState(pr7);
  ok('Int: shallow meaningful cycle still completes', shallow.completionSatisfied === true);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
