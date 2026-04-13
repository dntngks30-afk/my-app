/**
 * PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01 스모크 테스트
 *
 * 검증 항목:
 *   RI1  — stale pass-core suppressed when completion window starts after recovery
 *   RI2  — stale suppression on empty completion window (idle/not_armed path)
 *   RI3  — current-rep pass-core NOT suppressed when recovery is within window
 *   RI4  — suppressed result carries blocked reason 'stale_prior_rep'
 *   RI5  — suppressed result clears repId to null
 *   RI6  — passCoreStale=true on stale result
 *   RI7  — non-stale result preserves passDetected=true
 *   RI8  — non-stale result preserves repId
 *   RI9  — stale guard is no-op when passDetected=false
 *   RI10 — stale guard is no-op when standingRecoveredAtMs=undefined
 *   RI11 — false-pass: setup motion blocks unconditionally
 *   RI12 — false-pass: insufficient frames blocks
 *
 * npx tsx scripts/camera-pass-core-reset-and-rep-id-align-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatPassCore } = await import('../src/lib/camera/squat/pass-core.ts');
const { computeSquatDescentTruth } = await import(
  '../src/lib/camera/squat/squat-descent-truth.ts'
);

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeFrames(profile, startMs = 0, intervalMs = 33) {
  return profile.map((depth, i) => ({ depth, timestampMs: startMs + i * intervalMs }));
}

function squatProfile(
  baselineDepth,
  peakDepth,
  preStanding = 12,
  descent = 8,
  post = 12,
  recovery = 8
) {
  const frames = [];
  for (let i = 0; i < preStanding; i++) frames.push(baselineDepth);
  const step = (peakDepth - baselineDepth) / descent;
  for (let i = 1; i <= descent; i++) frames.push(baselineDepth + step * i);
  const rStep = (baselineDepth - peakDepth) / (post + recovery);
  for (let i = 1; i <= post + recovery; i++) frames.push(peakDepth + rStep * i);
  return frames;
}

function runPassCore(frames, baseline, setupBlocked = false) {
  const descent = computeSquatDescentTruth({ frames, baseline });
  return evaluateSquatPassCore({
    depthFrames: frames,
    baselineStandingDepth: baseline,
    setupMotionBlocked: setupBlocked,
    setupMotionBlockReason: setupBlocked ? 'framing_translation' : null,
    sharedDescentTruth: descent,
  });
}

/** Mirror of the guard in evaluators/squat.ts */
function applyStaleGuard(passCore, completionWindowStartTs) {
  if (!passCore.passDetected) return passCore;
  if (passCore.standingRecoveredAtMs == null) return passCore;
  const isStale =
    completionWindowStartTs == null ||
    passCore.standingRecoveredAtMs < completionWindowStartTs;
  if (!isStale) return passCore;
  return {
    ...passCore,
    passDetected: false,
    passBlockedReason: 'stale_prior_rep',
    repId: null,
    passCoreStale: true,
  };
}

function pass(name, detail) {
  console.log(`[PASS] ${name}: ${detail}`);
  return true;
}

function fail(name, detail) {
  console.error(`[FAIL] ${name}: ${detail}`);
  return false;
}

// ── Guards ───────────────────────────────────────────────────────────────────

function RI1_staleSuppressedWhenWindowAfterRecovery() {
  const name = 'RI1_staleSuppressedWhenWindowAfterRecovery';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.35), 0, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected)
    return fail(name, `SETUP_FAIL: pass-core did not pass: ${raw.trace}`);

  const recoveryTs = raw.standingRecoveredAtMs;
  const completionWindowStartTs = recoveryTs + 500;
  const guarded = applyStaleGuard(raw, completionWindowStartTs);

  if (guarded.passDetected !== false)
    return fail(name, `stale pass not suppressed: passDetected=${guarded.passDetected}`);
  if (guarded.passBlockedReason !== 'stale_prior_rep')
    return fail(name, `wrong blocked reason: ${guarded.passBlockedReason}`);
  return pass(name, `suppressed correctly (recovery=${recoveryTs}, window=${completionWindowStartTs})`);
}

function RI2_staleSuppressedOnEmptyWindow() {
  const name = 'RI2_staleSuppressedOnEmptyWindow';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.30), 0, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected)
    return fail(name, `SETUP_FAIL: pass-core did not pass: ${raw.trace}`);

  const guarded = applyStaleGuard(raw, null);
  if (guarded.passDetected !== false)
    return fail(name, `stale pass not suppressed on null window: ${guarded.passDetected}`);
  if (guarded.passBlockedReason !== 'stale_prior_rep')
    return fail(name, `wrong blocked reason on null window: ${guarded.passBlockedReason}`);
  return pass(name, `null-window stale guard correct`);
}

function RI3_currentRepNotSuppressed() {
  const name = 'RI3_currentRepNotSuppressed';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.35), 1000, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected)
    return fail(name, `SETUP_FAIL: pass-core did not pass: ${raw.trace}`);

  const completionWindowStartTs = 900; // window starts BEFORE rep → current rep
  const guarded = applyStaleGuard(raw, completionWindowStartTs);
  if (guarded.passDetected !== true)
    return fail(
      name,
      `current rep incorrectly suppressed: passDetected=${guarded.passDetected}, recovery=${raw.standingRecoveredAtMs}, window=${completionWindowStartTs}`
    );
  return pass(name, `current rep preserved (recovery=${raw.standingRecoveredAtMs}, window=${completionWindowStartTs})`);
}

function RI4_suppressedHasCorrectBlockedReason() {
  const name = 'RI4_suppressedHasCorrectBlockedReason';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.30), 0, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected) return fail(name, `SETUP_FAIL`);
  const guarded = applyStaleGuard(raw, null);
  if (guarded.passBlockedReason !== 'stale_prior_rep')
    return fail(name, `passBlockedReason=${guarded.passBlockedReason}`);
  return pass(name, `blocked reason = stale_prior_rep ✓`);
}

function RI5_suppressedClearsRepId() {
  const name = 'RI5_suppressedClearsRepId';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.30), 0, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected || raw.repId == null)
    return fail(name, `SETUP_FAIL: passDetected=${raw.passDetected}, repId=${raw.repId}`);
  const guarded = applyStaleGuard(raw, null);
  if (guarded.repId !== null)
    return fail(name, `repId not cleared: ${guarded.repId}`);
  return pass(name, `repId cleared to null ✓`);
}

function RI6_passCoreStaleFlag() {
  const name = 'RI6_passCoreStaleFlag';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.30), 0, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected) return fail(name, `SETUP_FAIL`);
  const guarded = applyStaleGuard(raw, null);
  if (guarded.passCoreStale !== true)
    return fail(name, `passCoreStale not set: ${guarded.passCoreStale}`);
  return pass(name, `passCoreStale=true ✓`);
}

function RI7_nonStalePreservesPass() {
  const name = 'RI7_nonStalePreservesPass';
  const baseline = 0.02;
  const startMs = 2000;
  const frames = makeFrames(squatProfile(baseline, 0.35), startMs, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected) return fail(name, `SETUP_FAIL`);
  const guarded = applyStaleGuard(raw, startMs - 100);
  if (guarded.passDetected !== true)
    return fail(name, `non-stale pass incorrectly cleared`);
  if (guarded.passCoreStale === true)
    return fail(name, `passCoreStale should be absent for non-stale`);
  return pass(name, `non-stale pass preserved ✓`);
}

function RI8_nonStalePreservesRepId() {
  const name = 'RI8_nonStalePreservesRepId';
  const baseline = 0.02;
  const startMs = 3000;
  const frames = makeFrames(squatProfile(baseline, 0.35), startMs, 33);
  const raw = runPassCore(frames, baseline);
  if (!raw.passDetected || raw.repId == null)
    return fail(name, `SETUP_FAIL: passDetected=${raw.passDetected}, repId=${raw.repId}`);
  const guarded = applyStaleGuard(raw, startMs - 200);
  if (guarded.repId !== raw.repId)
    return fail(name, `repId changed: was ${raw.repId}, now ${guarded.repId}`);
  return pass(name, `repId preserved: ${guarded.repId} ✓`);
}

function RI9_noOpOnNonPass() {
  const name = 'RI9_noOpOnNonPass';
  const frames = makeFrames([0.02, 0.02, 0.02, 0.02], 0, 33);
  const raw = runPassCore(frames, 0.02);
  if (raw.passDetected === true)
    return fail(name, `SETUP_FAIL: expected non-pass on short frames`);
  const originalReason = raw.passBlockedReason;
  const guarded = applyStaleGuard(raw, null);
  if (guarded.passDetected !== false)
    return fail(name, `guard mutated passDetected on non-pass`);
  if (guarded.passBlockedReason !== originalReason)
    return fail(name, `guard changed blocked reason: ${originalReason} → ${guarded.passBlockedReason}`);
  return pass(name, `no-op on passDetected=false ✓`);
}

function RI10_noOpOnMissingRecoveryTs() {
  const name = 'RI10_noOpOnMissingRecoveryTs';
  const synthetic = {
    passDetected: true,
    passBlockedReason: null,
    repId: 'rep_0',
    standingRecoveredAtMs: undefined,
    trace: 'synthetic',
  };
  const guarded = applyStaleGuard(synthetic, null);
  if (guarded.passDetected !== true)
    return fail(name, `guard suppressed result with undefined recovery timestamp`);
  return pass(name, `no-op when standingRecoveredAtMs=undefined ✓`);
}

function RI11_setupMotionFalsePass() {
  const name = 'RI11_setupMotionFalsePass';
  const baseline = 0.02;
  const frames = makeFrames(squatProfile(baseline, 0.40), 0, 33);
  const result = runPassCore(frames, baseline, true);
  if (result.passDetected !== false)
    return fail(name, `setup_motion_blocked did not prevent pass: ${result.trace}`);
  if (!result.passBlockedReason?.startsWith('setup_motion_blocked'))
    return fail(name, `wrong blocked reason: ${result.passBlockedReason}`);
  return pass(name, `setup motion blocks correctly ✓`);
}

function RI12_insufficientFramesFalsePass() {
  const name = 'RI12_insufficientFramesFalsePass';
  const frames = makeFrames([0.02, 0.03, 0.04], 0, 33);
  const result = runPassCore(frames, 0.02);
  if (result.passDetected !== false)
    return fail(name, `insufficient frames did not prevent pass: ${result.trace}`);
  return pass(name, `insufficient frames blocks correctly ✓`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

const guards = [
  RI1_staleSuppressedWhenWindowAfterRecovery,
  RI2_staleSuppressedOnEmptyWindow,
  RI3_currentRepNotSuppressed,
  RI4_suppressedHasCorrectBlockedReason,
  RI5_suppressedClearsRepId,
  RI6_passCoreStaleFlag,
  RI7_nonStalePreservesPass,
  RI8_nonStalePreservesRepId,
  RI9_noOpOnNonPass,
  RI10_noOpOnMissingRecoveryTs,
  RI11_setupMotionFalsePass,
  RI12_insufficientFramesFalsePass,
];

let allPassed = true;
for (const g of guards) {
  try {
    const ok = g();
    if (!ok) allPassed = false;
  } catch (e) {
    console.error(`[FAIL] ${g.name}: EXCEPTION: ${e?.message ?? e}`);
    allPassed = false;
  }
}

if (!allPassed) {
  console.error('\nPR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01 smoke guards FAILED.');
  process.exit(1);
}

console.log(
  '\nAll PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01 structural guards passed.\n' +
    'Automated checks are structural guards only. Real-device JSON is the final truth.\n'
);
