/**
 * PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01
 *
 * Device-replay-first guard:
 * - latest available shallow owner-split traces are mandatory representative fixtures
 * - historical Lane A pre-attempt traces remain regression guards
 * - standing/seated remain non-pass controls, deep remains standard-pass control
 *
 * Runtime boundary:
 * - verifies acquisition/peak provenance unification after legitimate official
 *   shallow admission and guarded current-rep local-peak proof
 * - does not grant pass, clear terminal blockers, or relax span/reversal laws
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-acquisition-peak-provenance-unify-01-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  applyShallowAcquisitionPeakProvenanceUnification,
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

function hasLaneAPreAttemptAcquisitionCollapse(obs) {
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

function hasLaneBAdmissionPeakOwnerSplit(obs) {
  return obs.some(
    (o) =>
      o?.attemptStarted === true &&
      o?.descendConfirmed === true &&
      o?.officialShallowPathAdmitted === true &&
      (o?.baselineFrozen === false ||
        o?.peakLatched === false ||
        o?.completionBlockedReason === 'freeze_or_latch_missing' ||
        o?.completionBlockedReason === 'not_armed')
  );
}

function hasLaneEStaleOrMissingPeakAnchor(obs) {
  return obs.some((o) => {
    const completionPeakIdx = o?.squatCameraObservability?.completion?.peakLatchedAtIndex;
    return (
      o?.peakLatchedAtIndex === 0 ||
      completionPeakIdx === 0 ||
      (o?.officialShallowPathAdmitted === true && o?.peakLatched !== true)
    );
  });
}

function hasOpenedSameRepResidualDrift(obs) {
  const openedIndex = obs.findIndex(
    (o) =>
      o?.attemptStarted === true &&
      o?.descendConfirmed === true &&
      o?.officialShallowPathAdmitted === true
  );
  if (openedIndex < 0) return false;
  const families = new Set(
    obs
      .slice(openedIndex)
      .map((o) => o?.completionBlockedReason)
      .filter((reason) =>
        [
          'not_armed',
          'no_reversal',
          'descent_span_too_short',
          'ascent_recovery_span_too_short',
        ].includes(reason)
      )
  );
  return families.size >= 2;
}

function admittedShallowOwnerSplitState(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'no_reversal',
    cycleComplete: false,
    currentSquatPhase: 'committed_bottom_or_downward_commitment',
    completionMachinePhase: 'blocked',
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.12,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathReason: 'official_low_rom_candidate',
    officialShallowPathBlockedReason: 'no_reversal',
    baselineStandingDepth: 0.42,
    baselineFrozen: false,
    baselineFrozenDepth: null,
    peakLatched: false,
    peakLatchedAtIndex: null,
    peakAtMs: null,
    peakAnchorTruth: undefined,
    committedAtMs: 1120,
    descendStartAtMs: 960,
    relativeDepthPeak: 0.12,
    evidenceLabel: 'low_rom',
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    attemptStartedAfterReady: true,
    eventCyclePromoted: false,
    canonicalTemporalEpochOrderBlockedReason: null,
    guardedShallowLocalPeakFound: true,
    guardedShallowLocalPeakBlockedReason: null,
    guardedShallowLocalPeakIndex: 8,
    guardedShallowLocalPeakAtMs: 1280,
    selectedCanonicalPeakEpochAtMs: null,
    selectedCanonicalPeakEpochValidIndex: null,
    selectedCanonicalPeakEpochSource: null,
    ...overrides,
  };
}

console.log('\nPR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01 smoke\n');

console.log('Section A - mandatory latest acquisition/peak-provenance split fixtures');
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
]) {
  const { fileName, trace } = readFirstExistingDesktopTrace(label, candidates);
  const obs = observations(trace);
  ok(`${label} (${fileName}): Lane B admission/peak-owner split represented`, hasLaneBAdmissionPeakOwnerSplit(obs), {
    obsCount: obs.length,
  });
  ok(`${label} (${fileName}): Lane E stale/missing peak-anchor risk represented`, hasLaneEStaleOrMissingPeakAnchor(obs), {
    obsCount: obs.length,
  });
}

{
  const { fileName, trace } = readFirstExistingDesktopTrace('latest trace B', PRIMARY_TRACE_B);
  const obs = observations(trace);
  ok(`latest trace B (${fileName}): opened shallow residual drift represented`, hasOpenedSameRepResidualDrift(obs), {
    obsCount: obs.length,
  });
}

console.log('\nSection B - historical Lane A and control fixtures remain locked');
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
  const { trace } = readFirstExistingDesktopTrace(`historical Lane A ${fileName}`, [fileName]);
  const obs = observations(trace);
  ok(`${fileName}: Lane A pre-attempt acquisition collapse still represented`, hasLaneAPreAttemptAcquisitionCollapse(obs), {
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

console.log('\nSection C - acquisition/peak provenance unification boundary');
{
  const before = admittedShallowOwnerSplitState();
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok('missing peak owner: provenance is unified to guarded current-rep local peak', (
    after.baselineFrozen === true &&
    after.baselineFrozenDepth === 0.42 &&
    after.peakLatched === true &&
    after.peakLatchedAtIndex === 8 &&
    after.peakAtMs === 1280 &&
    after.peakAnchorTruth === 'committed_or_post_commit_peak' &&
    after.selectedCanonicalPeakEpochValidIndex === 8 &&
    after.selectedCanonicalPeakEpochAtMs === 1280 &&
    after.shallowAcquisitionPeakProvenanceUnified === true &&
    after.shallowAcquisitionPeakProvenanceUnifiedFrom === 'missing_latched_anchor'
  ), after);
  ok('missing peak owner: pass and terminal blocker are not rewritten', (
    after.completionSatisfied === false &&
    after.completionPassReason === 'not_confirmed' &&
    after.completionBlockedReason === 'no_reversal'
  ), after);
}

{
  const before = admittedShallowOwnerSplitState({
    completionBlockedReason: 'descent_span_too_short',
    baselineFrozen: true,
    baselineFrozenDepth: 0.42,
    peakLatched: true,
    peakLatchedAtIndex: 0,
    peakAtMs: 900,
    peakAnchorTruth: 'committed_or_post_commit_peak',
    selectedCanonicalPeakEpochValidIndex: 0,
    selectedCanonicalPeakEpochAtMs: 900,
  });
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok('series-start peak owner: stale anchor rebounds to guarded current-rep local peak', (
    after.peakLatchedAtIndex === 8 &&
    after.peakAtMs === 1280 &&
    after.selectedCanonicalPeakEpochValidIndex === 8 &&
    after.selectedCanonicalPeakEpochAtMs === 1280 &&
    after.shallowAcquisitionPeakProvenanceUnifiedFrom === 'series_start_anchor'
  ), after);
  ok('series-start peak owner: span blocker is preserved', after.completionBlockedReason === 'descent_span_too_short', after);
}

{
  const before = admittedShallowOwnerSplitState({
    setupMotionBlocked: true,
    guardedShallowLocalPeakIndex: 8,
    guardedShallowLocalPeakAtMs: 1280,
  });
  const after = applyShallowAcquisitionPeakProvenanceUnification(before, {
    setupMotionBlocked: true,
  });
  ok('negative/setup guard: setup-blocked motion is not made sticky', after === before, after);
}

{
  const before = admittedShallowOwnerSplitState({
    officialShallowPathAdmitted: false,
    attemptStarted: false,
    descendConfirmed: false,
    downwardCommitmentReached: false,
  });
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok('pre-admission guard: no acquisition broadening without legitimate opening', after === before, after);
}

{
  const before = admittedShallowOwnerSplitState({
    evidenceLabel: 'standard',
    relativeDepthPeak: 0.32,
    peakLatched: false,
  });
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok('deep/standard guard: standard path is untouched', after === before, after);
}

{
  const before = admittedShallowOwnerSplitState({
    guardedShallowLocalPeakFound: false,
    guardedShallowLocalPeakBlockedReason: 'peak_anchor_series_start_only',
    guardedShallowLocalPeakIndex: 0,
    guardedShallowLocalPeakAtMs: 900,
  });
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok('local-peak proof guard: stale series-start-only peak is rejected', after === before, after);
}

console.log(`\nPR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01 smoke complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
