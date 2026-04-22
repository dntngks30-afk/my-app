/**
 * PR-SHALLOW-UPSTREAM-CURRENT-REP-EPOCH-STABILITY-01
 *
 * Device-replay-first guard:
 * - latest available same-rep drift traces are mandatory representative fixtures
 * - historical A-family pre-attempt traces remain regression guards
 * - standing/seated remain non-pass controls, deep remains standard-pass control
 *
 * Runtime boundary:
 * - verifies upstream current-rep epoch persistence after legitimate official
 *   shallow admission
 * - does not grant pass, clear terminal blockers, or relax span/reversal laws
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-upstream-current-rep-epoch-stability-01-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  applyShallowCurrentRepEpochStability,
} = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function readFirstExistingDesktopTrace(label, fileNames) {
  for (const fileName of fileNames) {
    const desktopPath = join(process.env.USERPROFILE ?? homedir(), 'Desktop', fileName);
    if (existsSync(desktopPath)) {
      ok(`${label}: fixture exists (${fileName})`, true);
      return {
        fileName,
        trace: JSON.parse(readFileSync(desktopPath, 'utf8')),
      };
    }
  }
  ok(`${label}: at least one fixture candidate exists`, false, fileNames);
  return { fileName: null, trace: null };
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

function hasHistoricalAFamilyPreAttemptSignature(obs) {
  return obs.some((o) => {
    const notes = o?.squatCameraObservability?.eventCycle?.notes ?? [];
    return (
      o?.attemptStarted === false &&
      o?.completionBlockedReason === 'not_armed' &&
      o?.baselineFrozen === false &&
      o?.peakLatched === false &&
      notes.includes('freeze_or_latch_missing')
    );
  });
}

function hasSameRepDriftSignature(obs) {
  const openedIndex = obs.findIndex(
    (o) =>
      o?.attemptStarted === true &&
      o?.descendConfirmed === true &&
      o?.officialShallowPathAdmitted === true
  );
  if (openedIndex < 0) return false;

  const afterOpen = obs.slice(openedIndex + 1);
  const driftedBackToPreAttempt = afterOpen.some(
    (o) =>
      o?.attemptStarted === false ||
      o?.completionBlockedReason === 'not_armed' ||
      (o?.officialShallowPathAdmitted === false &&
        (o?.completionBlockedReason === 'not_armed' ||
          o?.completionBlockedReason === 'no_reversal' ||
          o?.completionBlockedReason === 'descent_span_too_short'))
  );
  const hasReversalRecoveryTruth = obs.some(
    (o) =>
      o?.reversalConfirmedAfterDescend === true &&
      o?.recoveryConfirmedAfterReversal === true &&
      o?.officialShallowClosureProofSatisfied === true
  );
  const families = new Set(
    obs
      .map((o) => o?.completionBlockedReason)
      .filter((reason) =>
        [
          'not_armed',
          'no_reversal',
          'descent_span_too_short',
          'ascent_recovery_span_too_short',
          'not_standing_recovered',
          'no_standing_recovery',
        ].includes(reason)
      )
  );
  return driftedBackToPreAttempt && hasReversalRecoveryTruth && families.size >= 2;
}

function provenPrefixSnapshot(overrides = {}) {
  return {
    baselineFrozenDepth: 0.41,
    peakLatchedAtIndex: 7,
    peakAnchorTruth: 'committed_or_post_commit_peak',
    completionBlockedReason: 'descent_span_too_short',
    officialShallowPathBlockedReason: null,
    descendStartAtMs: 1000,
    peakAtMs: 1240,
    committedAtMs: 1120,
    selectedCanonicalDescentTimingEpochAtMs: 1000,
    selectedCanonicalDescentTimingEpochValidIndex: 3,
    selectedCanonicalPeakEpochAtMs: 1240,
    selectedCanonicalPeakEpochValidIndex: 7,
    relativeDepthPeak: 0.12,
    evidenceLabel: 'low_rom',
    ...overrides,
  };
}

function regressedCurrentState(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'not_armed',
    officialShallowPathBlockedReason: 'not_armed',
    cycleComplete: false,
    currentSquatPhase: 'idle',
    completionMachinePhase: 'blocked',
    attemptStarted: false,
    descendConfirmed: false,
    downwardCommitmentReached: false,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: false,
    officialShallowPathReason: null,
    baselineFrozen: false,
    baselineFrozenDepth: null,
    peakLatched: false,
    peakLatchedAtIndex: null,
    peakAnchorTruth: undefined,
    relativeDepthPeak: 0.12,
    evidenceLabel: 'low_rom',
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    attemptStartedAfterReady: true,
    eventCyclePromoted: false,
    canonicalTemporalEpochOrderBlockedReason: null,
    selectedCanonicalDescentTimingEpochAtMs: null,
    selectedCanonicalDescentTimingEpochValidIndex: null,
    selectedCanonicalPeakEpochAtMs: null,
    selectedCanonicalPeakEpochValidIndex: null,
    ...overrides,
  };
}

console.log('\nPR-SHALLOW-UPSTREAM-CURRENT-REP-EPOCH-STABILITY-01 smoke\n');

console.log('Section A - mandatory latest same-rep drift fixtures');
const PRIMARY_TRACE_A = [
  'turn7file0.json',
  'turn7file0.txt',
  'latest_shallow_trace_a.json',
  'latest_shallow_trace_a.txt',
  'device_shallow_fail_07.txt',
];
const PRIMARY_TRACE_B = [
  'turn7file1.json',
  'turn7file1.txt',
  'latest_shallow_trace_b.json',
  'latest_shallow_trace_b.txt',
  'device_shallow_fail_08.txt',
];

for (const [label, candidates] of [
  ['latest trace A', PRIMARY_TRACE_A],
  ['latest trace B', PRIMARY_TRACE_B],
]) {
  const { fileName, trace } = readFirstExistingDesktopTrace(label, candidates);
  const obs = observations(trace);
  ok(`${label} (${fileName}): same-rep drift signature present`, hasSameRepDriftSignature(obs), {
    obsCount: obs.length,
  });
}

console.log('\nSection B - historical A-family and control fixtures remain locked');
for (const fileName of [
  'device_shallow_fail_01.txt',
  'device_shallow_fail_02.txt',
  'device_shallow_fail_03.txt',
  'device_shallow_fail_04.txt',
  'device_shallow_fail_05.txt',
  'device_shallow_fail_06.txt',
  'device_shallow_fail_09.txt',
  'device_shallow_fail_10.txt',
]) {
  const { trace } = readFirstExistingDesktopTrace(`historical A-family ${fileName}`, [fileName]);
  const obs = observations(trace);
  ok(`${fileName}: historical pre-attempt guard still represented`, hasHistoricalAFamilyPreAttemptSignature(obs), {
    obsCount: obs.length,
  });
}

for (const fileName of [
  'device_standing_01.txt',
  'device_standing_02.txt',
  'device_seated_01.txt',
  'device_seated_02.txt',
]) {
  const { trace } = readFirstExistingDesktopTrace(`negative ${fileName}`, [fileName]);
  const attemptList = attempts(trace);
  ok(`${fileName}: no final pass is latched`, !hasAnyFinalPass(attemptList), {
    attempts: attemptList.length,
  });
}

for (const fileName of ['device_deep_01.txt', 'device_deep_02.txt']) {
  const { trace } = readFirstExistingDesktopTrace(`deep ${fileName}`, [fileName]);
  const attemptList = attempts(trace);
  ok(`${fileName}: deep standard pass is present`, hasAnyDeepStandardPass(attemptList), {
    attempts: attemptList.length,
  });
}

console.log('\nSection C - upstream current-rep epoch stability boundary');
{
  const state = applyShallowCurrentRepEpochStability(
    regressedCurrentState(),
    provenPrefixSnapshot(),
    { setupMotionBlocked: false }
  );
  ok('opened shallow rep does not regress to pre-attempt/not_armed', state.attemptStarted === true && state.officialShallowPathAdmitted === true, {
    attemptStarted: state.attemptStarted,
    admitted: state.officialShallowPathAdmitted,
  });
  ok('baseline/peak epoch facts persist after legitimate opening', state.baselineFrozen === true && state.peakLatched === true && state.peakLatchedAtIndex === 7, {
    baselineFrozen: state.baselineFrozen,
    peakLatched: state.peakLatched,
    peakLatchedAtIndex: state.peakLatchedAtIndex,
  });
  ok('pre-attempt blocker is remapped only to existing residual blocker', state.completionBlockedReason === 'descent_span_too_short', {
    completionBlockedReason: state.completionBlockedReason,
  });
  ok('epoch stability does not grant pass or clear terminal blocker', state.completionSatisfied !== true && state.completionBlockedReason != null, {
    completionSatisfied: state.completionSatisfied,
    completionBlockedReason: state.completionBlockedReason,
  });
  ok('epoch stability stamps observability', state.upstreamCurrentRepEpochStabilityApplied === true, state);
}

{
  const state = applyShallowCurrentRepEpochStability(
    regressedCurrentState({ setupMotionBlocked: true }),
    provenPrefixSnapshot(),
    { setupMotionBlocked: true }
  );
  ok('setup contamination does not get sticky epoch recovery', state.upstreamCurrentRepEpochStabilityApplied !== true && state.attemptStarted !== true, state);
}

{
  const state = applyShallowCurrentRepEpochStability(
    regressedCurrentState({
      relativeDepthPeak: 0.62,
      evidenceLabel: 'standard',
    }),
    provenPrefixSnapshot({ relativeDepthPeak: 0.62, evidenceLabel: 'standard' }),
    { setupMotionBlocked: false }
  );
  ok('deep/standard band does not use shallow epoch recovery', state.upstreamCurrentRepEpochStabilityApplied !== true && state.attemptStarted !== true, state);
}

{
  const state = applyShallowCurrentRepEpochStability(
    regressedCurrentState({
      canonicalTemporalEpochOrderBlockedReason: 'mixed_rep_epoch_contamination',
    }),
    provenPrefixSnapshot(),
    { setupMotionBlocked: false }
  );
  ok('mixed-rep contamination does not get sticky epoch recovery', state.upstreamCurrentRepEpochStabilityApplied !== true && state.attemptStarted !== true, state);
}

{
  const state = applyShallowCurrentRepEpochStability(
    regressedCurrentState({
      completionBlockedReason: 'not_armed',
    }),
    provenPrefixSnapshot({
      completionBlockedReason: null,
      officialShallowPathBlockedReason: null,
    }),
    { setupMotionBlocked: false }
  );
  ok('epoch recovery does not invent pass when snapshot has no residual blocker', state.completionSatisfied !== true && state.completionBlockedReason === 'not_armed', {
    completionSatisfied: state.completionSatisfied,
    completionBlockedReason: state.completionBlockedReason,
  });
  ok('epoch recovery does not clear official blocker without residual blocker', state.officialShallowPathBlockedReason === 'not_armed', {
    officialShallowPathBlockedReason: state.officialShallowPathBlockedReason,
  });
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
