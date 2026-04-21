/**
 * PR-SHALLOW-UPSTREAM-ARMING-PEAK-LATCH-ACQUISITION-01
 *
 * Device-replay-first guard:
 * - raw device trace files are mandatory fixtures
 * - dominant A-family pre-attempt/not_armed/freeze_or_latch_missing signature is explicit
 * - secondary/tertiary families stay distinct (no broad scope creep)
 * - standing/seated remain non-pass controls, deep remains standard-pass control
 *
 * Upstream-narrow contract:
 * - verifies the new pre-arming-epoch fallback gate used by shallow candidate acquisition
 *
 * Run:
 *   npx tsx scripts/camera-pr-shallow-upstream-arming-peak-latch-acquisition-01-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch,
} = await import('../src/lib/camera/squat/squat-completion-core.ts');

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

function readTraceFromDesktop(fileName) {
  const desktopPath = join(process.env.USERPROFILE ?? homedir(), 'Desktop', fileName);
  ok(`fixture exists: ${fileName}`, existsSync(desktopPath), desktopPath);
  if (!existsSync(desktopPath)) return null;
  const raw = readFileSync(desktopPath, 'utf8');
  return JSON.parse(raw);
}

function observations(trace) {
  return Array.isArray(trace?.squatAttemptObservations) ? trace.squatAttemptObservations : [];
}

function attempts(trace) {
  return Array.isArray(trace?.attempts) ? trace.attempts : [];
}

function hasAFamilyPreAttemptSignature(obs) {
  if (!Array.isArray(obs) || obs.length === 0) return false;
  return obs.some((o) => {
    const notes = o?.squatCameraObservability?.eventCycle?.notes ?? [];
    const completionPeakIdx = o?.squatCameraObservability?.completion?.peakLatchedAtIndex;
    return (
      o?.attemptStarted === false &&
      o?.completionBlockedReason === 'not_armed' &&
      o?.baselineFrozen === false &&
      o?.peakLatched === false &&
      (completionPeakIdx === 0 || o?.peakLatchedAtIndex === 0) &&
      notes.includes('freeze_or_latch_missing') &&
      (o?.downwardCommitmentReached === true ||
        o?.motionDescendDetected === true ||
        o?.shallowCandidateObserved === true)
    );
  });
}

function hasSecondarySpanFamilySignature(obs) {
  if (!Array.isArray(obs) || obs.length === 0) return false;
  return obs.some(
    (o) =>
      o?.attemptStarted === true &&
      o?.officialShallowPathAdmitted === true &&
      o?.officialShallowStreamBridgeApplied === true &&
      o?.officialShallowClosureProofSatisfied === true &&
      o?.officialShallowReversalSatisfied === true &&
      (o?.completionBlockedReason === 'descent_span_too_short' ||
        o?.completionBlockedReason === 'ascent_recovery_span_too_short')
  );
}

function hasTertiaryNoReversalSignature(obs) {
  if (!Array.isArray(obs) || obs.length === 0) return false;
  return obs.some(
    (o) =>
      o?.attemptStarted === true &&
      o?.descendConfirmed === true &&
      o?.downwardCommitmentReached === true &&
      o?.completionBlockedReason === 'no_reversal'
  );
}

function hasAnyFinalPass(attemptList) {
  return attemptList.some(
    (a) =>
      a?.progressionPassed === true &&
      a?.finalPassLatched === true
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

console.log('\nPR-SHALLOW-UPSTREAM-ARMING-PEAK-LATCH-ACQUISITION-01 smoke\n');

const A_FAMILY = [
  'device_shallow_fail_01.txt',
  'device_shallow_fail_02.txt',
  'device_shallow_fail_03.txt',
  'device_shallow_fail_04.txt',
  'device_shallow_fail_05.txt',
  'device_shallow_fail_06.txt',
  'device_shallow_fail_09.txt',
  'device_shallow_fail_10.txt',
];

const SECONDARY_GUARD = [
  'device_shallow_fail_07.txt',
  'device_shallow_fail_08.txt',
];

const TERTIARY_GUARD = ['device_shallow_fail_11.txt'];

const NEGATIVE_GUARD = [
  'device_standing_01.txt',
  'device_standing_02.txt',
  'device_seated_01.txt',
  'device_seated_02.txt',
];

const POSITIVE_GUARD = [
  'device_deep_01.txt',
  'device_deep_02.txt',
];

console.log('Section A - mandatory device fixtures and family signatures');
for (const fileName of A_FAMILY) {
  const trace = readTraceFromDesktop(fileName);
  const obs = observations(trace);
  ok(`${fileName}: A-family pre-attempt/not_armed signature present`, hasAFamilyPreAttemptSignature(obs), {
    obsCount: obs.length,
  });
}

for (const fileName of SECONDARY_GUARD) {
  const trace = readTraceFromDesktop(fileName);
  const obs = observations(trace);
  ok(`${fileName}: secondary span family remains distinct`, hasSecondarySpanFamilySignature(obs), {
    obsCount: obs.length,
  });
}

for (const fileName of TERTIARY_GUARD) {
  const trace = readTraceFromDesktop(fileName);
  const obs = observations(trace);
  ok(`${fileName}: tertiary no_reversal family remains distinct`, hasTertiaryNoReversalSignature(obs), {
    obsCount: obs.length,
  });
}

console.log('\nSection B - negative/positive control lock');
for (const fileName of NEGATIVE_GUARD) {
  const trace = readTraceFromDesktop(fileName);
  const attemptList = attempts(trace);
  ok(`${fileName}: no final pass is latched`, !hasAnyFinalPass(attemptList), {
    attempts: attemptList.length,
  });
}

for (const fileName of POSITIVE_GUARD) {
  const trace = readTraceFromDesktop(fileName);
  const attemptList = attempts(trace);
  ok(`${fileName}: deep standard pass is present`, hasAnyDeepStandardPass(attemptList), {
    attempts: attemptList.length,
  });
}

console.log('\nSection C - upstream fallback gate narrowness');
const goodEpoch = {
  source: 'pre_arming_kinematic_descent_epoch',
  baselineKneeAngleAvg: 171.5,
  baselineWindowStartValidIndex: 0,
  baselineWindowEndValidIndex: 5,
  descentOnsetValidIndex: 8,
  descentOnsetAtMs: 1200,
  descentOnsetKneeAngleAvg: 162.1,
  completionSliceStartIndex: 14,
  peakGuardValidIndex: 32,
  peakGuardAtMs: 2500,
  proof: {
    monotonicSustainSatisfied: true,
    baselineBeforeOnset: true,
    onsetBeforeCompletionSlicePeak: true,
    noStandingRecoveryBetweenOnsetAndSlice: true,
  },
};

ok(
  'A-like: pre-arming epoch fallback enables shallow candidate acquisition when baseline frames are short',
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch({
    preArmingEpoch: goodEpoch,
    completionSliceStartIndex: 14,
    relativeDepthPeak: 0.06,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    setupMotionBlocked: false,
    baselineFrameCount: 2,
  }) === true
);

ok(
  'N-like: missing epoch does not enable fallback',
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch({
    preArmingEpoch: undefined,
    completionSliceStartIndex: 14,
    relativeDepthPeak: 0.06,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    setupMotionBlocked: false,
    baselineFrameCount: 2,
  }) === false
);

ok(
  'N-like: setup contamination blocks fallback',
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch({
    preArmingEpoch: goodEpoch,
    completionSliceStartIndex: 14,
    relativeDepthPeak: 0.06,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    setupMotionBlocked: true,
    baselineFrameCount: 2,
  }) === false
);

ok(
  'N-like: deep/standard band does not enable shallow fallback',
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch({
    preArmingEpoch: goodEpoch,
    completionSliceStartIndex: 14,
    relativeDepthPeak: 0.72,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    setupMotionBlocked: false,
    baselineFrameCount: 2,
  }) === false
);

ok(
  'N-like: baseline already sufficient does not use fallback',
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch({
    preArmingEpoch: goodEpoch,
    completionSliceStartIndex: 14,
    relativeDepthPeak: 0.06,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    setupMotionBlocked: false,
    baselineFrameCount: 4,
  }) === false
);

ok(
  'N-like: invalid epoch proof does not enable fallback',
  shouldEnableUpstreamShallowArmingCandidateFromPreArmingEpoch({
    preArmingEpoch: {
      ...goodEpoch,
      proof: {
        ...goodEpoch.proof,
        noStandingRecoveryBetweenOnsetAndSlice: false,
      },
    },
    completionSliceStartIndex: 14,
    relativeDepthPeak: 0.06,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    setupMotionBlocked: false,
    baselineFrameCount: 2,
  }) === false
);

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
