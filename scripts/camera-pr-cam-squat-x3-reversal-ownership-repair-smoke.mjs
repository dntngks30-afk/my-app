/**
 * PR-X3 -- Reversal Ownership Repair for no_reversal Family.
 *
 * Builds on top of PR-X1 (pre-attempt arming / baseline freeze early
 * stabilization) and PR-X2 (peak / anchor initialization repair,
 * same-epoch peak provenance unification). This smoke pins the narrow
 * Wave X3 repair:
 *
 *   1. Representative Family C fixtures (pure + mixed) exhibit the
 *      reversal ownership mismatch: completion-state says
 *      `officialShallowReversalSatisfied=true` in a shallow-admitted
 *      epoch, while pass-core's same-tick raw math yields
 *      `reversalAtMs=null` / `passBlockedReason='no_reversal_after_peak'`.
 *
 *   2. Inside a shallow-admitted same-epoch (`officialShallowPathAdmitted`
 *      && `officialShallowReversalSatisfied`), when completion-state has
 *      a finite `cs.reversalAtMs`, the observability adapters (both
 *      `livePassCoreTruth` and the trace-only `readSquatCurrentRepPassTruth`)
 *      unify the exposed `squatPassCore.reversalAtMs` to the
 *      completion-state timestamp. The raw pass-core math is preserved
 *      under `rawReversalAtMs` so no standard-cycle / deep reversal
 *      semantic is modified.
 *
 *   3. In the same unified window, if pass-core's raw blocked reason was
 *      exactly `'no_reversal_after_peak'`, the adapter exposes the
 *      blocked reason as `'shallow_reversal_ownership_unified'`
 *      (SSOT §10.2 assertion 4). Other pass-core blockers
 *      (`peak_not_latched`, `no_standing_recovery`, ...) are NOT
 *      rewritten — X3 is reversal ownership alignment only.
 *
 *   4. When the shallow admission / same-epoch reversal truth is absent
 *      (standard-cycle deep reps, never-pass standing/seated), the
 *      adapter is a no-op: raw pass-core reversal math and blocked
 *      reason are passed through unchanged. Opener law
 *      (`readSquatPassOwnerTruth`) is NOT modified; `passDetected`
 *      still depends solely on pass-core math or
 *      `officialShallowOwnerFrozen` (Wave B opener unification).
 *
 *   5. Closure / opener / final-sink / standing-recovery law is NOT
 *      touched. In representative Family C fixtures this PR only
 *      aligns the exposed reversal truth; `officialShallowPathClosed`
 *      and `finalPassLatched` remain governed by later PRs (X4/X5/X6).
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-x3-reversal-ownership-repair-smoke.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  readSquatCurrentRepPassTruth,
} = await import('../src/lib/camera/auto-progression.ts');
const {
  noteSquatGateForCameraObservability,
  getLiveSquatPassCoreTruth,
  resetSquatCameraObservabilitySession,
} = await import('../src/lib/camera/camera-observability-squat-session.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : '');
    process.exitCode = 1;
  }
}

function readFixture(fileName) {
  const path = join(process.env.USERPROFILE ?? homedir(), 'Desktop', fileName);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function observations(trace) {
  return Array.isArray(trace?.squatAttemptObservations) ? trace.squatAttemptObservations : [];
}

function attempts(trace) {
  return Array.isArray(trace?.attempts) ? trace.attempts : [];
}

function hasAnyFinalPass(attemptList) {
  return attemptList.some(
    (a) => a?.progressionPassed === true && a?.finalPassLatched === true
  );
}

function hasAnyDeepStandardPass(attemptList) {
  return attemptList.some(
    (a) =>
      a?.progressionPassed === true &&
      a?.finalPassLatched === true &&
      a?.diagnosisSummary?.squatCycle?.completionPassReason === 'standard_cycle'
  );
}

/**
 * Build a minimal SquatCompletionState-like shape that the trace adapter
 * reads. Only the fields consulted by `readSquatCurrentRepPassTruth` are
 * populated. `readSquatPassOwnerTruth` / `computeSquatCompletionOwnerTruth`
 * is fed the same state, so we set enough fields to keep the opener-law
 * branch at `officialShallowOwnerFrozen !== true`. That way the trace
 * adapter returns `passEligible=false` (which is exactly the Family C
 * same-epoch runtime state we are pinning).
 */
function shallowAdmittedReversalSatisfiedState(overrides = {}) {
  return {
    // identity / phase
    currentSquatPhase: 'ascending',
    completionMachinePhase: 'blocked',
    evidenceLabel: 'low_rom',
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    // baseline / peak (already stable upstream via X1/X2)
    baselineStandingDepth: 0.42,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 8,
    peakAtMs: 1280,
    relativeDepthPeak: 0.07,
    // shallow admission + reversal truth (X3 target)
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: 'descent_span_too_short',
    officialShallowReversalSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    // completion-state owned reversal timestamp
    committedAtMs: 1200,
    reversalAtMs: 1500,
    ascendStartAtMs: 1500,
    descendStartAtMs: 900,
    // X2 stamps (harness preserves the PR-X2 flag surface)
    shallowAcquisitionPeakProvenanceUnified: false,
    // terminal truth (X3 does NOT open closure)
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'descent_span_too_short',
    cycleComplete: false,
    ...overrides,
  };
}

function buildPassCoreMissingReversal(overrides = {}) {
  return {
    passDetected: false,
    passBlockedReason: 'no_reversal_after_peak',
    descentDetected: true,
    descentStartAtMs: 900,
    peakAtMs: 960,
    reversalAtMs: null,
    standingRecoveredAtMs: null,
    repId: null,
    trace: {
      readinessClear: true,
      baselineEstablished: true,
      descentSpanClear: true,
      peakLatched: true,
      reversalDetected: false,
      standingRecovered: false,
    },
    ...overrides,
  };
}

function buildFakeGate({ passCore, completionState, officialShallowOwnerFrozen = false }) {
  return {
    finalPassEligible: false,
    finalPassBlockedReason: 'completion_not_satisfied',
    squatCycleDebug: {
      officialShallowOwnerFrozen,
      uiProgressionAllowed: false,
      uiProgressionBlockedReason: 'completion_owner_not_satisfied',
    },
    guardrail: { debug: { sampledFrameCount: 42 } },
    evaluatorResult: {
      stepId: 'squat',
      debug: {
        squatPassCore: passCore,
        squatCompletionState: completionState,
        highlightedMetrics: {},
      },
    },
  };
}

console.log('\nPR-X3 reversal ownership repair smoke\n');

console.log('-- Section 1: mixed Family C fixtures show pre-X3 reversal ownership mismatch --');
for (const fileName of [
  'device_shallow_fail_01.txt',
  'device_shallow_fail_07.txt',
  'device_shallow_fail_10.txt',
  'device_shallow_fail_13.txt',
]) {
  const trace = readFixture(fileName);
  if (trace == null) {
    ok(`${fileName}: fixture readable`, false);
    continue;
  }
  const obs = observations(trace);
  let revSatTicks = 0;
  let mismatchTicks = 0;
  for (const o of obs) {
    const revSat = o?.officialShallowReversalSatisfied === true;
    const pc = o?.squatCameraObservability?.pass_core_truth?.squatPassCore;
    if (revSat) revSatTicks += 1;
    if (revSat && pc && (pc.reversalAtMs == null || pc.passBlockedReason === 'no_reversal_after_peak')) {
      mismatchTicks += 1;
    }
  }
  ok(
    `${fileName}: baseline reversal ownership mismatch observable`,
    revSatTicks > 0 && mismatchTicks > 0,
    { revSatTicks, mismatchTicks }
  );
}

console.log('\n-- Section 1b: pure Family C fixture (fail_11) has sustained no_reversal_after_peak --');
{
  const fileName = 'device_shallow_fail_11.txt';
  const trace = readFixture(fileName);
  if (trace == null) {
    ok(`${fileName}: fixture readable`, false);
  } else {
    const obs = observations(trace);
    let sustainedNoReversalTicks = 0;
    let revSatAfterNoReversal = 0;
    let sawNoReversalAfterPeak = false;
    for (const o of obs) {
      const pc = o?.squatCameraObservability?.pass_core_truth?.squatPassCore;
      if (pc?.passBlockedReason === 'no_reversal_after_peak') {
        sawNoReversalAfterPeak = true;
        sustainedNoReversalTicks += 1;
      } else if (sawNoReversalAfterPeak && o?.officialShallowReversalSatisfied === true) {
        revSatAfterNoReversal += 1;
      }
    }
    /**
     * fail_11 ("pure Family C" per SSOT §5): proof never fully completes and
     * `no_reversal_after_peak` dominates the early tick window. X3 does not
     * manufacture reversal truth where completion-state itself has not
     * confirmed it — the raw veto must be preserved in that span.
     */
    ok(
      `${fileName}: sustained pre-confirm no_reversal_after_peak window exists (pure Family C)`,
      sustainedNoReversalTicks > 0,
      { sustainedNoReversalTicks, revSatAfterNoReversal }
    );
  }
}

console.log('\n-- Section 2: trace adapter unifies reversal timestamp in same-epoch shallow-admitted rep --');
{
  const cs = shallowAdmittedReversalSatisfiedState();
  const pc = buildPassCoreMissingReversal();
  const truth = readSquatCurrentRepPassTruth({
    squatPassCore: pc,
    squatCompletionState: cs,
  });
  ok(
    'trace adapter exposes completion-state reversalAtMs (1500) instead of null',
    truth.ownerSource === 'pass_core' &&
      truth.reversalAtMs === 1500,
    { ownerSource: truth.ownerSource, reversalAtMs: truth.reversalAtMs }
  );
  ok(
    'trace adapter blockedReason is rewritten from no_reversal_after_peak to shallow_reversal_ownership_unified',
    truth.passEligible === false &&
      truth.blockedReason === 'shallow_reversal_ownership_unified',
    { blockedReason: truth.blockedReason, passEligible: truth.passEligible }
  );
}

console.log('\n-- Section 3: livePassCoreTruth adapter unifies reversal + preserves raw provenance --');
{
  resetSquatCameraObservabilitySession();
  const cs = shallowAdmittedReversalSatisfiedState();
  const pc = buildPassCoreMissingReversal();
  noteSquatGateForCameraObservability(buildFakeGate({ passCore: pc, completionState: cs }));
  const live = getLiveSquatPassCoreTruth();
  const squatPassCore = live?.squatPassCore ?? {};
  ok(
    'reversalAtMs is unified to completion-state timestamp',
    squatPassCore.reversalAtMs === 1500,
    { reversalAtMs: squatPassCore.reversalAtMs }
  );
  ok(
    'rawReversalAtMs preserves the original pass-core reversalAtMs (null)',
    squatPassCore.rawReversalAtMs === null,
    { rawReversalAtMs: squatPassCore.rawReversalAtMs }
  );
  ok(
    'reversalOwnershipUnifiedByShallow flag is true',
    squatPassCore.reversalOwnershipUnifiedByShallow === true,
    { flag: squatPassCore.reversalOwnershipUnifiedByShallow }
  );
  ok(
    'passBlockedReason is coerced away from no_reversal_after_peak',
    squatPassCore.passBlockedReason === 'shallow_reversal_ownership_unified',
    { passBlockedReason: squatPassCore.passBlockedReason }
  );
  ok(
    'rawPassBlockedReason still preserves the pass-core raw veto for diagnostics',
    squatPassCore.rawPassBlockedReason === 'no_reversal_after_peak',
    { rawPassBlockedReason: squatPassCore.rawPassBlockedReason }
  );
  ok(
    'passDetected is NOT opened by X3 (opener law preserved, closure write still governs final pass)',
    squatPassCore.passDetected === false && squatPassCore.rawPassDetected === false,
    { passDetected: squatPassCore.passDetected, rawPassDetected: squatPassCore.rawPassDetected }
  );
}

console.log('\n-- Section 4: adapter is a no-op when shallow admission is absent --');
{
  resetSquatCameraObservabilitySession();
  const cs = shallowAdmittedReversalSatisfiedState({
    officialShallowPathAdmitted: false,
    officialShallowReversalSatisfied: false,
  });
  const pc = buildPassCoreMissingReversal();
  noteSquatGateForCameraObservability(buildFakeGate({ passCore: pc, completionState: cs }));
  const live = getLiveSquatPassCoreTruth();
  const squatPassCore = live?.squatPassCore ?? {};
  ok(
    'reversalAtMs stays at raw pass-core null',
    squatPassCore.reversalAtMs === null,
    { reversalAtMs: squatPassCore.reversalAtMs }
  );
  ok(
    'passBlockedReason stays at no_reversal_after_peak (raw veto preserved)',
    squatPassCore.passBlockedReason === 'no_reversal_after_peak',
    { passBlockedReason: squatPassCore.passBlockedReason }
  );
  ok(
    'reversalOwnershipUnifiedByShallow is false',
    squatPassCore.reversalOwnershipUnifiedByShallow === false,
    { flag: squatPassCore.reversalOwnershipUnifiedByShallow }
  );
}

console.log('\n-- Section 5: adapter is a no-op when completion-state has no finite reversalAtMs --');
{
  const cs = shallowAdmittedReversalSatisfiedState({
    reversalAtMs: undefined,
  });
  const pc = buildPassCoreMissingReversal();
  const truth = readSquatCurrentRepPassTruth({
    squatPassCore: pc,
    squatCompletionState: cs,
  });
  ok(
    'trace adapter does not invent a reversal timestamp when cs.reversalAtMs is missing',
    truth.reversalAtMs === null || truth.reversalAtMs === undefined,
    { reversalAtMs: truth.reversalAtMs }
  );
  ok(
    'trace adapter preserves the raw no_reversal_after_peak blockedReason (honest provenance)',
    truth.blockedReason === 'no_reversal_after_peak',
    { blockedReason: truth.blockedReason }
  );
}

console.log('\n-- Section 6: non-reversal pass-core blockers are NOT rewritten by X3 --');
{
  const cs = shallowAdmittedReversalSatisfiedState();
  for (const blocker of ['peak_not_latched', 'no_standing_recovery', 'setup_motion_blocked']) {
    const pc = buildPassCoreMissingReversal({ passBlockedReason: blocker });
    const truth = readSquatCurrentRepPassTruth({
      squatPassCore: pc,
      squatCompletionState: cs,
    });
    ok(
      `trace adapter preserves pass-core blockedReason "${blocker}" (X3 is reversal-only)`,
      truth.blockedReason === blocker,
      { blockedReason: truth.blockedReason }
    );
  }
}

console.log('\n-- Section 7: deep / standard-cycle rep is NOT affected --');
{
  resetSquatCameraObservabilitySession();
  const deepCs = {
    officialShallowPathAdmitted: false,
    officialShallowReversalSatisfied: false,
    shallowAcquisitionPeakProvenanceUnified: false,
    evidenceLabel: 'standard',
    completionMachinePhase: 'completed',
    currentSquatPhase: 'standing_recovered',
    reversalAtMs: 1300,
    peakAtMs: 1200,
  };
  const deepPassCore = {
    passDetected: true,
    passBlockedReason: null,
    descentDetected: true,
    descentStartAtMs: 500,
    peakAtMs: 1200,
    reversalAtMs: 1300,
    standingRecoveredAtMs: 1500,
    repId: 'rep_deep_1500',
    trace: {},
  };
  const truth = readSquatCurrentRepPassTruth({
    squatPassCore: deepPassCore,
    squatCompletionState: deepCs,
  });
  ok(
    'deep pass-core reversalAtMs (1300) passes through unchanged',
    truth.passEligible === true &&
      truth.blockedReason === null &&
      truth.reversalAtMs === 1300,
    { peakAtMs: truth.peakAtMs, reversalAtMs: truth.reversalAtMs }
  );

  noteSquatGateForCameraObservability(
    buildFakeGate({ passCore: deepPassCore, completionState: deepCs })
  );
  const live = getLiveSquatPassCoreTruth();
  const squatPassCore = live?.squatPassCore ?? {};
  ok(
    'livePassCoreTruth deep reversalAtMs passes through unchanged',
    squatPassCore.reversalAtMs === 1300 &&
      squatPassCore.reversalOwnershipUnifiedByShallow === false &&
      squatPassCore.rawPassBlockedReason === null &&
      squatPassCore.passBlockedReason === null,
    {
      reversalAtMs: squatPassCore.reversalAtMs,
      flag: squatPassCore.reversalOwnershipUnifiedByShallow,
      passBlockedReason: squatPassCore.passBlockedReason,
    }
  );
}

console.log('\n-- Section 8: X3 does not open closure / final-pass on representative Family C fixtures --');
for (const fileName of [
  'device_shallow_fail_01.txt',
  'device_shallow_fail_07.txt',
  'device_shallow_fail_10.txt',
  'device_shallow_fail_11.txt',
  'device_shallow_fail_13.txt',
]) {
  const trace = readFixture(fileName);
  if (trace == null) {
    ok(`${fileName}: fixture readable`, false);
    continue;
  }
  const attemptList = attempts(trace);
  ok(
    `${fileName}: no final pass was latched pre-X3 (scope lock; X4/X5 own closure/sink)`,
    !hasAnyFinalPass(attemptList),
    { attempts: attemptList.length }
  );
}

console.log('\n-- Section 9: never-pass / must-pass controls are preserved --');
for (const fileName of [
  'device_standing_01.txt',
  'device_standing_02.txt',
  'device_seated_01.txt',
  'device_seated_02.txt',
]) {
  const trace = readFixture(fileName);
  if (trace == null) {
    ok(`${fileName}: fixture readable`, false);
    continue;
  }
  const attemptList = attempts(trace);
  ok(
    `${fileName}: no final pass is latched (never-pass preserved)`,
    !hasAnyFinalPass(attemptList),
    { attempts: attemptList.length }
  );
}

for (const fileName of ['device_deep_01.txt', 'device_deep_02.txt']) {
  const trace = readFixture(fileName);
  if (trace == null) {
    ok(`${fileName}: fixture readable`, false);
    continue;
  }
  const attemptList = attempts(trace);
  ok(
    `${fileName}: deep standard pass is latched (must-pass preserved)`,
    hasAnyDeepStandardPass(attemptList),
    { attempts: attemptList.length }
  );
}

console.log('\n--');
console.log(`PR-X3 smoke — passed: ${passed}, failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
