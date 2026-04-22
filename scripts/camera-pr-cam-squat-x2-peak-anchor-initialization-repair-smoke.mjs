/**
 * PR-X2 -- Peak / Anchor Initialization Repair for Ultra-shallow Primary Traces.
 *
 * Builds on top of PR-X1 (pre-attempt arming / baseline-freeze early stabilization).
 * This smoke pins the narrow Wave X2 repair:
 *   1. When `applyShallowAcquisitionPeakProvenanceUnification` rebinds the peak
 *      anchor from series-start (or missing) to the guarded post-commit local peak,
 *      the stale `peak_anchor_at_series_start` note in `squatEventCycle.notes`
 *      is replaced by `peak_anchor_rebound_by_shallow_provenance_unification`.
 *      Core semantic fields (detected / band / descentFrames / reversalFrames /
 *      recoveryFrames / source) remain untouched so no closure / opener / sink /
 *      reversal law is reopened.
 *   2. Inside the same shallow-admitted epoch, the same-epoch peak provenance
 *      surface (completion-state `peakAtMs` and the adapter-level
 *      `squatPassCore.peakAtMs`) carries one consistent timestamp. The raw
 *      pass-core math is preserved under `rawPeakAtMs` so deep / standard-cycle
 *      peak computation is never modified.
 *   3. Deep / standing / seated never-pass controls are unchanged: the adapter
 *      only fires when `shallowAcquisitionPeakProvenanceUnified === true`.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-x2-peak-anchor-initialization-repair-smoke.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  applyShallowAcquisitionPeakProvenanceUnification,
} = await import('../src/lib/camera/squat-completion-state.ts');
const {
  readSquatCurrentRepPassTruth,
} = await import('../src/lib/camera/auto-progression.ts');

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
 * Representative ultra-shallow trace template:
 * - shallow admission satisfied, descent/commit confirmed
 * - guarded current-rep local peak found at index 8
 * - before repair: peakLatchedAtIndex = 0 (series-start drift),
 *   squatEventCycle already stamped with `peak_anchor_at_series_start`
 */
function seriesStartAnchorShallowState(overrides = {}) {
  const baseNotes = [
    'peak_anchor_at_series_start',
    'descent_weak',
    'descent_aligned_to_shared_truth',
  ];
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
    downwardCommitmentDelta: 0.09,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathReason: 'official_low_rom_candidate',
    officialShallowPathBlockedReason: 'no_reversal',
    baselineStandingDepth: 0.42,
    baselineFrozen: true,
    baselineFrozenDepth: 0.42,
    peakLatched: true,
    peakLatchedAtIndex: 0,
    peakAtMs: 900,
    peakAnchorTruth: 'committed_or_post_commit_peak',
    committedAtMs: 1000,
    descendStartAtMs: 900,
    relativeDepthPeak: 0.07,
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
    selectedCanonicalPeakEpochAtMs: 900,
    selectedCanonicalPeakEpochValidIndex: 0,
    selectedCanonicalPeakEpochSource: null,
    squatEventCycle: {
      detected: false,
      band: null,
      baselineFrozen: true,
      peakLatched: true,
      peakLatchedAtIndex: 0,
      descentDetected: true,
      reversalDetected: false,
      recoveryDetected: false,
      nearStandingRecovered: false,
      peakDepth: 0.06,
      relativePeak: 0.06,
      descentFrames: 12,
      reversalFrames: 0,
      recoveryFrames: 0,
      source: 'rule',
      notes: [...baseNotes],
    },
    ...overrides,
  };
}

console.log('\nPR-X2 peak/anchor initialization repair smoke\n');

console.log('-- Section 1: representative ultra-shallow fixtures show pre-patch series-start drift --');
for (const fileName of [
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
  const hasSeriesStartNote = obs.some((o) => {
    const notes = o?.squatCameraObservability?.eventCycle?.notes ?? [];
    return notes.includes('peak_anchor_at_series_start');
  });
  const hasZeroPeakIdx = obs.some((o) => o?.peakLatchedAtIndex === 0);
  ok(`${fileName}: pre-patch series-start peak drift observable`, hasSeriesStartNote || hasZeroPeakIdx, {
    hasSeriesStartNote,
    hasZeroPeakIdx,
  });
}

console.log('\n-- Section 2: unification replaces stale series-start note + unifies peak anchor --');
{
  const before = seriesStartAnchorShallowState();
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok(
    'peak anchor is rebound to guarded post-commit local peak',
    after.peakLatched === true &&
      after.peakLatchedAtIndex === 8 &&
      after.peakAtMs === 1280 &&
      after.peakAnchorTruth === 'committed_or_post_commit_peak',
    {
      peakLatched: after.peakLatched,
      peakLatchedAtIndex: after.peakLatchedAtIndex,
      peakAtMs: after.peakAtMs,
    }
  );
  ok(
    'same-epoch peak provenance is unified in selected canonical epoch fields',
    after.selectedCanonicalPeakEpochAtMs === 1280 &&
      after.selectedCanonicalPeakEpochValidIndex === 8 &&
      after.selectedCanonicalPeakEpochSource === 'completion_core_peak',
    {
      atMs: after.selectedCanonicalPeakEpochAtMs,
      idx: after.selectedCanonicalPeakEpochValidIndex,
      source: after.selectedCanonicalPeakEpochSource,
    }
  );
  const notes = after.squatEventCycle?.notes ?? [];
  ok(
    'stale peak_anchor_at_series_start note is replaced by rebound diagnostic',
    !notes.includes('peak_anchor_at_series_start') &&
      notes.includes('peak_anchor_rebound_by_shallow_provenance_unification'),
    notes
  );
  ok(
    'event-cycle semantic fields are NOT rewritten (no closure/reversal bleed)',
    after.squatEventCycle?.detected === false &&
      after.squatEventCycle?.band === null &&
      after.squatEventCycle?.descentFrames === 12 &&
      after.squatEventCycle?.reversalFrames === 0 &&
      after.squatEventCycle?.recoveryFrames === 0 &&
      after.squatEventCycle?.source === 'rule',
    after.squatEventCycle
  );
  ok(
    'completion terminal truth is unchanged: still not_confirmed + no_reversal',
    after.completionSatisfied === false &&
      after.completionPassReason === 'not_confirmed' &&
      after.completionBlockedReason === 'no_reversal' &&
      after.officialShallowPathBlockedReason === 'no_reversal',
    {
      completionSatisfied: after.completionSatisfied,
      completionPassReason: after.completionPassReason,
      completionBlockedReason: after.completionBlockedReason,
      officialShallowPathBlockedReason: after.officialShallowPathBlockedReason,
    }
  );
  ok(
    'shallow acquisition peak provenance unified flag + source are stamped',
    after.shallowAcquisitionPeakProvenanceUnified === true &&
      after.shallowAcquisitionPeakProvenanceUnifiedFrom === 'series_start_anchor' &&
      after.shallowAcquisitionPeakProvenanceUnifiedSource === 'guarded_shallow_local_peak' &&
      after.shallowAcquisitionPeakProvenanceUnifiedIndex === 8 &&
      after.shallowAcquisitionPeakProvenanceUnifiedAtMs === 1280,
    after
  );
}

console.log('\n-- Section 3: unification is a no-op when guarded local peak is absent --');
{
  const before = seriesStartAnchorShallowState({
    guardedShallowLocalPeakFound: false,
    guardedShallowLocalPeakBlockedReason: 'peak_anchor_series_start_only',
    guardedShallowLocalPeakIndex: null,
    guardedShallowLocalPeakAtMs: null,
  });
  const after = applyShallowAcquisitionPeakProvenanceUnification(before);
  ok(
    'without a valid local peak, peak anchor is not re-bound',
    after.peakLatchedAtIndex === before.peakLatchedAtIndex &&
      after.peakAtMs === before.peakAtMs &&
      !after.shallowAcquisitionPeakProvenanceUnified,
    {
      peakLatchedAtIndex: after.peakLatchedAtIndex,
      peakAtMs: after.peakAtMs,
      unified: after.shallowAcquisitionPeakProvenanceUnified,
    }
  );
  const notes = after.squatEventCycle?.notes ?? [];
  ok(
    'series-start note is preserved when unification does not fire (honest drift signal)',
    notes.includes('peak_anchor_at_series_start') &&
      !notes.includes('peak_anchor_rebound_by_shallow_provenance_unification'),
    notes
  );
}

console.log('\n-- Section 4: same-epoch peakAtMs provenance adapter (trace-only) --');
{
  const before = seriesStartAnchorShallowState();
  const csAfter = applyShallowAcquisitionPeakProvenanceUnification(before);
  const passCore = {
    passDetected: false,
    passBlockedReason: 'no_reversal_after_peak',
    descentDetected: true,
    descentStartAtMs: 900,
    peakAtMs: 960,
    reversalAtMs: undefined,
    standingRecoveredAtMs: undefined,
    repId: null,
    trace: {},
  };
  const truth = readSquatCurrentRepPassTruth({
    squatPassCore: passCore,
    squatCompletionState: csAfter,
  });
  ok(
    'trace adapter exposes unified shallow peakAtMs when provenance was unified',
    truth.ownerSource === 'pass_core' && truth.peakAtMs === 1280,
    { ownerSource: truth.ownerSource, peakAtMs: truth.peakAtMs }
  );
}

console.log('\n-- Section 5: deep / standard-cycle is not unified by the adapter --');
{
  const deepCs = {
    shallowAcquisitionPeakProvenanceUnified: false,
    peakAtMs: 1500,
    currentSquatPhase: 'standing_recovered',
    evidenceLabel: 'standard',
    completionMachinePhase: 'completed',
  };
  const deepPassCore = {
    passDetected: true,
    passBlockedReason: null,
    descentDetected: true,
    descentStartAtMs: 500,
    peakAtMs: 1200,
    reversalAtMs: 1300,
    standingRecoveredAtMs: 1500,
    repId: 'rep_1500',
    trace: {},
  };
  const truth = readSquatCurrentRepPassTruth({
    squatPassCore: deepPassCore,
    squatCompletionState: deepCs,
  });
  ok(
    'deep standard-cycle peakAtMs is NOT overridden by the shallow adapter',
    truth.ownerSource === 'pass_core' &&
      truth.passEligible === true &&
      truth.peakAtMs === 1200,
    { peakAtMs: truth.peakAtMs, pass: truth.passEligible }
  );
}

console.log('\n-- Section 6: never-pass / must-pass controls are preserved --');
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
  ok(`${fileName}: no final pass is latched (never-pass preserved)`, !hasAnyFinalPass(attemptList), {
    attempts: attemptList.length,
  });
}

for (const fileName of ['device_deep_01.txt', 'device_deep_02.txt']) {
  const trace = readFixture(fileName);
  if (trace == null) {
    ok(`${fileName}: fixture readable`, false);
    continue;
  }
  const attemptList = attempts(trace);
  ok(`${fileName}: deep standard pass is latched (must-pass preserved)`, hasAnyDeepStandardPass(attemptList), {
    attempts: attemptList.length,
  });
}

console.log('\n--');
console.log(`PR-X2 smoke — passed: ${passed}, failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
