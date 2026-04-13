/**
 * PR-SQUAT-SHALLOW-REOPEN-INTEGRITY-BLOCKER-GUARD-01 smoke.
 *
 * Run:
 *   npx tsx scripts/camera-squat-shallow-reopen-integrity-blocker-guard-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  applyCompletionOwnerShallowAdmissibilityReopen,
} = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
  console.error(`  FAIL: ${name}${detail}`);
  process.exitCode = 1;
}

function reopenCandidate(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: null,
    canonicalShallowContractBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    standingRecoveredAtMs: 1200,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    recoveryConfirmedAfterReversal: true,
    eventCyclePromoted: false,
    officialShallowPathAdmitted: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowReversalSatisfied: true,
    reversalConfirmedByRuleOrHmm: true,
    setupMotionBlocked: false,
    relativeDepthPeak: 0.22,
    cycleComplete: false,
    completionMachinePhase: 'standing_recovered',
    ...overrides,
  };
}

function reopened(state) {
  return applyCompletionOwnerShallowAdmissibilityReopen(state);
}

function remainedBlocked(result) {
  return result.completionSatisfied === false && result.completionPassReason === 'not_confirmed';
}

console.log('\nA. canonical integrity blockers deny owner-local reopen');
{
  const a1 = reopened(reopenCandidate({ completionBlockedReason: 'descent_span_too_short' }));
  ok('A1: descent_span_too_short cannot be laundered to pass', remainedBlocked(a1), a1);
  ok('A1b: descent_span_too_short reason is preserved', a1.completionBlockedReason === 'descent_span_too_short', a1);

  const a2 = reopened(reopenCandidate({ completionBlockedReason: 'ascent_recovery_span_too_short' }));
  ok('A2: ascent_recovery_span_too_short cannot be laundered to pass', remainedBlocked(a2), a2);
  ok(
    'A2b: ascent_recovery_span_too_short reason is preserved',
    a2.completionBlockedReason === 'ascent_recovery_span_too_short',
    a2
  );

  const a3 = reopened(reopenCandidate({ canonicalShallowContractBlockedReason: 'timing_integrity_blocked' }));
  ok('A3: canonical blocked result cannot be reopened', remainedBlocked(a3), a3);
  ok(
    'A3b: canonical blocked reason is preserved',
    a3.canonicalShallowContractBlockedReason === 'timing_integrity_blocked',
    a3
  );

  const a4 = reopened(
    reopenCandidate({
      completionBlockedReason: 'descent_span_too_short',
      canonicalShallowContractBlockedReason: 'timing_integrity_blocked',
    })
  );
  ok('A4: all candidate/proof flags true still cannot reopen blocked state', remainedBlocked(a4), a4);
}

// SINGLE-WRITER-RESTORATION: B section rewritten.
// applyCompletionOwnerShallowAdmissibilityReopen is now a no-op (canonical closer is sole writer).
// Even when all blocker guards are absent, the reopen must NOT fire.
console.log('\nB. no-op guarantee: reopen never writes completionSatisfied=true');
{
  const b1 = reopened(reopenCandidate({ relativeDepthPeak: 0.22 }));
  ok('B1: no-op reopen leaves completionSatisfied=false', remainedBlocked(b1), b1);
  ok('B1b: no-op reopen does not set completionOwnerReason', b1.completionOwnerReason == null, b1);
  ok('B1c: no-op reopen leaves pass reason not_confirmed', b1.completionPassReason === 'not_confirmed', b1);

  const b2 = reopened(reopenCandidate({ relativeDepthPeak: 0.04 }));
  ok('B2: no-op reopen leaves ultra_low completionSatisfied=false', remainedBlocked(b2), b2);
  ok('B2b: no-op reopen does not set ultra_low owner reason', b2.completionOwnerReason == null, b2);
  ok('B2c: no-op reopen leaves pass reason not_confirmed', b2.completionPassReason === 'not_confirmed', b2);
}

console.log('\nC. existing false-positive reopen denials stay closed');
{
  const c1 = reopened(reopenCandidate({ currentSquatPhase: 'armed' }));
  ok('C1: standing/armed phase does not reopen', remainedBlocked(c1), c1);

  const c2 = reopened(reopenCandidate({ currentSquatPhase: 'descending' }));
  ok('C2: descent phase does not reopen', remainedBlocked(c2), c2);

  const c3 = reopened(reopenCandidate({ currentSquatPhase: 'committed_bottom_or_downward_commitment' }));
  ok('C3: bottom phase does not reopen', remainedBlocked(c3), c3);

  const c4 = reopened(reopenCandidate({ recoveryConfirmedAfterReversal: false }));
  ok('C4: delayed/standingRecovered without recovery proof does not reopen', remainedBlocked(c4), c4);

  const c5 = reopened(reopenCandidate({ completionPassReason: 'standard_cycle' }));
  ok('C5: non-not_confirmed state is not reopened by shallow helper', c5.completionSatisfied === false, c5);
}

console.log(`\nshallow reopen integrity blocker guard smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
