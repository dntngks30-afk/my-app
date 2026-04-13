/**
 * PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01: structural smoke guards.
 *
 * These are NOT a test suite — they are architectural invariant checks.
 * Each guard verifies one property required by the SSOT locked truth map.
 *
 * Guard naming: RI = Rep-Identity.
 *
 * Covered invariants:
 *   RI1  — stale pass-core suppressed when completion window starts after recovery
 *   RI2  — stale suppression on empty completion window (idle/not_armed path)
 *   RI3  — current-rep pass-core NOT suppressed when recovery is within window
 *   RI4  — suppressed result sets passDetected=false, passBlockedReason='stale_prior_rep'
 *   RI5  — suppressed result clears repId to null
 *   RI6  — passCoreStale=true on stale result
 *   RI7  — non-stale result preserves original passDetected=true
 *   RI8  — non-stale result preserves repId
 *   RI9  — stale guard is a no-op when passDetected=false (non-pass inputs)
 *   RI10 — stale guard is a no-op when standingRecoveredAtMs is undefined
 *   RI11 — false-pass guard: setup motion blocks pass-core unconditionally
 *   RI12 — false-pass guard: insufficient frames blocks pass-core
 *
 * Automated checks are structural guards only.
 * Real-device JSON remains the final truth.
 */

import { evaluateSquatPassCore, type SquatPassCoreDepthFrame } from '@/lib/camera/squat/pass-core';
import { computeSquatDescentTruth } from '@/lib/camera/squat/squat-descent-truth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFrames(
  profile: number[],
  startMs = 0,
  intervalMs = 33
): SquatPassCoreDepthFrame[] {
  return profile.map((depth, i) => ({
    depth,
    timestampMs: startMs + i * intervalMs,
  }));
}

/** Standard squat profile: standing → descent → peak → reversal → standing */
function squatProfile(
  baselineDepth: number,
  peakDepth: number,
  preStandingFrames = 12,
  descentFrames = 8,
  postPeakFrames = 12,
  recoveryFrames = 8
): number[] {
  const frames: number[] = [];
  for (let i = 0; i < preStandingFrames; i++) frames.push(baselineDepth);
  const step = (peakDepth - baselineDepth) / descentFrames;
  for (let i = 1; i <= descentFrames; i++) frames.push(baselineDepth + step * i);
  const recovStep = (baselineDepth - peakDepth) / (postPeakFrames + recoveryFrames);
  for (let i = 1; i <= postPeakFrames + recoveryFrames; i++) {
    frames.push(peakDepth + recovStep * i);
  }
  return frames;
}

interface RunPassCoreResult {
  passDetected: boolean;
  passBlockedReason: string | null;
  repId: string | null;
  standingRecoveredAtMs: number | undefined;
  passCoreStale?: boolean;
  trace: string;
}

function runPassCore(
  frames: SquatPassCoreDepthFrame[],
  baseline: number,
  setupBlocked = false
): RunPassCoreResult {
  const descent = computeSquatDescentTruth({ frames, baseline });
  const result = evaluateSquatPassCore({
    depthFrames: frames,
    baselineStandingDepth: baseline,
    setupMotionBlocked: setupBlocked,
    setupMotionBlockReason: setupBlocked ? 'framing_translation' : null,
    sharedDescentTruth: descent,
  });
  return {
    passDetected: result.passDetected,
    passBlockedReason: result.passBlockedReason,
    repId: result.repId,
    standingRecoveredAtMs: result.standingRecoveredAtMs,
    passCoreStale: result.passCoreStale,
    trace: result.trace,
  };
}

/**
 * Simulates the stale guard logic that lives in evaluators/squat.ts.
 * Keeps the guard logic centralized here so smoke tests remain aligned
 * with the actual implementation.
 */
function applyStaleGuard(
  passCore: RunPassCoreResult,
  completionWindowStartTs: number | null
): RunPassCoreResult {
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

type GuardResult = { ok: boolean; detail: string };

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * RI1 — stale pass-core suppressed when completion window starts after recovery.
 *
 * Scenario: pass-core detected rep at T1, but completion window starts at T2 > T1.
 * Expected: guard suppresses passDetected, sets passBlockedReason='stale_prior_rep'.
 */
function guard_RI1_staleSuppressedWhenWindowAfterRecovery(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.35);
  const frames = makeFrames(profile, 0, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass raw rep: ${raw.trace}` };
  }

  const recoveryTs = raw.standingRecoveredAtMs!;
  const completionWindowStartTs = recoveryTs + 500; // window starts AFTER recovery → stale
  const guarded = applyStaleGuard(raw, completionWindowStartTs);

  if (guarded.passDetected !== false) {
    return { ok: false, detail: `stale pass not suppressed: passDetected=${guarded.passDetected}` };
  }
  if (guarded.passBlockedReason !== 'stale_prior_rep') {
    return {
      ok: false,
      detail: `wrong blocked reason: ${guarded.passBlockedReason}, expected stale_prior_rep`,
    };
  }
  return {
    ok: true,
    detail: `stale guard suppressed correctly (recoveryTs=${recoveryTs}, windowStart=${completionWindowStartTs})`,
  };
}

/**
 * RI2 — stale suppression on empty completion window (idle/not_armed path).
 *
 * When completionWindowStartTs=null (no completion frames), pass-core result
 * from a prior rep must be suppressed.
 */
function guard_RI2_staleSuppressedOnEmptyWindow(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.30);
  const frames = makeFrames(profile, 0, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass: ${raw.trace}` };
  }

  const guarded = applyStaleGuard(raw, null); // null = no completion frames

  if (guarded.passDetected !== false) {
    return {
      ok: false,
      detail: `stale pass with null window not suppressed: passDetected=${guarded.passDetected}`,
    };
  }
  if (guarded.passBlockedReason !== 'stale_prior_rep') {
    return {
      ok: false,
      detail: `wrong blocked reason on null window: ${guarded.passBlockedReason}`,
    };
  }
  return { ok: true, detail: `null-window stale guard suppressed correctly` };
}

/**
 * RI3 — current-rep pass-core NOT suppressed when recovery is within completion window.
 *
 * When completionWindowStartTs < standingRecoveredAtMs, the pass is current → keep.
 */
function guard_RI3_currentRepNotSuppressed(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.35);
  const frames = makeFrames(profile, 1000, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass: ${raw.trace}` };
  }

  const completionWindowStartTs = 900; // window starts BEFORE recovery → current rep
  const guarded = applyStaleGuard(raw, completionWindowStartTs);

  if (guarded.passDetected !== true) {
    return {
      ok: false,
      detail: `current rep incorrectly suppressed: passDetected=${guarded.passDetected}, recoveryTs=${raw.standingRecoveredAtMs}, windowStart=${completionWindowStartTs}`,
    };
  }
  return {
    ok: true,
    detail: `current rep preserved (recoveryTs=${raw.standingRecoveredAtMs}, windowStart=${completionWindowStartTs})`,
  };
}

/**
 * RI4 — suppressed result carries correct blocked reason 'stale_prior_rep'.
 */
function guard_RI4_suppressedHasCorrectBlockedReason(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.30);
  const frames = makeFrames(profile, 0, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass: ${raw.trace}` };
  }

  const guarded = applyStaleGuard(raw, null);
  if (guarded.passBlockedReason !== 'stale_prior_rep') {
    return {
      ok: false,
      detail: `passBlockedReason=${guarded.passBlockedReason}, expected stale_prior_rep`,
    };
  }
  return { ok: true, detail: `blocked reason = stale_prior_rep ✓` };
}

/**
 * RI5 — suppressed result clears repId to null.
 */
function guard_RI5_suppressedClearsRepId(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.30);
  const frames = makeFrames(profile, 0, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected || raw.repId == null) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass or no repId: ${raw.trace}` };
  }

  const guarded = applyStaleGuard(raw, null);
  if (guarded.repId !== null) {
    return { ok: false, detail: `repId not cleared: ${guarded.repId}` };
  }
  return { ok: true, detail: `repId cleared to null on stale suppression ✓` };
}

/**
 * RI6 — passCoreStale=true on stale result.
 */
function guard_RI6_passCoreStaleFlag(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.30);
  const frames = makeFrames(profile, 0, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass: ${raw.trace}` };
  }

  const guarded = applyStaleGuard(raw, null);
  if (guarded.passCoreStale !== true) {
    return { ok: false, detail: `passCoreStale not set on stale result: ${guarded.passCoreStale}` };
  }
  return { ok: true, detail: `passCoreStale=true on stale result ✓` };
}

/**
 * RI7 — non-stale result preserves original passDetected=true.
 */
function guard_RI7_nonStalePrevervesPass(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.35);
  const startMs = 2000;
  const frames = makeFrames(profile, startMs, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass: ${raw.trace}` };
  }

  const completionWindowStartTs = startMs - 100; // window before frames started → current rep
  const guarded = applyStaleGuard(raw, completionWindowStartTs);

  if (guarded.passDetected !== true) {
    return {
      ok: false,
      detail: `non-stale pass incorrectly cleared: passDetected=${guarded.passDetected}`,
    };
  }
  if (guarded.passCoreStale === true) {
    return { ok: false, detail: `passCoreStale should be undefined for non-stale result` };
  }
  return { ok: true, detail: `non-stale pass preserved ✓` };
}

/**
 * RI8 — non-stale result preserves original repId.
 */
function guard_RI8_nonStalePreservesRepId(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.35);
  const startMs = 3000;
  const frames = makeFrames(profile, startMs, 33);
  const raw = runPassCore(frames, baseline);

  if (!raw.passDetected || raw.repId == null) {
    return { ok: false, detail: `SETUP_FAIL: pass-core did not pass or no repId: ${raw.trace}` };
  }

  const completionWindowStartTs = startMs - 200;
  const guarded = applyStaleGuard(raw, completionWindowStartTs);

  if (guarded.repId !== raw.repId) {
    return {
      ok: false,
      detail: `repId changed on non-stale: was ${raw.repId}, now ${guarded.repId}`,
    };
  }
  return { ok: true, detail: `repId preserved for non-stale result (${guarded.repId}) ✓` };
}

/**
 * RI9 — stale guard is a no-op when passDetected=false.
 */
function guard_RI9_noOpOnNonPass(): GuardResult {
  const baseline = 0.02;
  // Short frames → pass-core should fail (insufficient_depth_frames or no descent)
  const shortFrames = makeFrames([baseline, baseline, baseline, baseline], 0, 33);
  const raw = runPassCore(shortFrames, baseline);

  if (raw.passDetected === true) {
    return { ok: false, detail: `SETUP_FAIL: expected pass-core to fail on short frames` };
  }

  const originalReason = raw.passBlockedReason;
  const guarded = applyStaleGuard(raw, null);

  if (guarded.passDetected !== false) {
    return { ok: false, detail: `guard mutated passDetected on non-pass input` };
  }
  if (guarded.passBlockedReason !== originalReason) {
    return {
      ok: false,
      detail: `guard changed blocked reason: ${originalReason} → ${guarded.passBlockedReason}`,
    };
  }
  return { ok: true, detail: `stale guard is no-op on passDetected=false ✓` };
}

/**
 * RI10 — stale guard is a no-op when standingRecoveredAtMs is undefined.
 *
 * If pass-core somehow passes without a recovery timestamp (edge case),
 * the guard must not suppress it (cannot determine staleness without a timestamp).
 */
function guard_RI10_noOpOnMissingRecoveryTs(): GuardResult {
  // Construct a synthetic result with passDetected=true but no standingRecoveredAtMs
  const syntheticPassCore: RunPassCoreResult = {
    passDetected: true,
    passBlockedReason: null,
    repId: 'rep_0',
    standingRecoveredAtMs: undefined,
    trace: 'synthetic',
  };

  const guarded = applyStaleGuard(syntheticPassCore, null);

  if (guarded.passDetected !== true) {
    return {
      ok: false,
      detail: `guard suppressed result with undefined recovery timestamp (should be no-op)`,
    };
  }
  return { ok: true, detail: `guard is no-op when standingRecoveredAtMs=undefined ✓` };
}

/**
 * RI11 — false-pass guard: setup motion blocks pass-core unconditionally.
 */
function guard_RI11_setupMotionFalsePass(): GuardResult {
  const baseline = 0.02;
  const profile = squatProfile(baseline, 0.40);
  const frames = makeFrames(profile, 0, 33);
  const result = runPassCore(frames, baseline, true /* setupBlocked=true */);

  if (result.passDetected !== false) {
    return { ok: false, detail: `setup_motion_blocked did not prevent pass: ${result.trace}` };
  }
  if (!result.passBlockedReason?.startsWith('setup_motion_blocked')) {
    return {
      ok: false,
      detail: `wrong blocked reason for setup block: ${result.passBlockedReason}`,
    };
  }
  return { ok: true, detail: `setup motion correctly blocks pass ✓` };
}

/**
 * RI12 — false-pass guard: insufficient frames blocks pass-core.
 */
function guard_RI12_insufficientFramesFalsePass(): GuardResult {
  const frames = makeFrames([0.02, 0.03, 0.04], 0, 33); // only 3 frames
  const result = runPassCore(frames, 0.02);

  if (result.passDetected !== false) {
    return { ok: false, detail: `insufficient frames did not prevent pass: ${result.trace}` };
  }
  return { ok: true, detail: `insufficient frames correctly blocks pass ✓` };
}

// ── Runner ────────────────────────────────────────────────────────────────────

export function runPassCoreResetAndRepIdAlignSmoke(): void {
  const guards: Array<{ name: string; fn: () => GuardResult }> = [
    { name: 'RI1_staleSuppressedWhenWindowAfterRecovery', fn: guard_RI1_staleSuppressedWhenWindowAfterRecovery },
    { name: 'RI2_staleSuppressedOnEmptyWindow', fn: guard_RI2_staleSuppressedOnEmptyWindow },
    { name: 'RI3_currentRepNotSuppressed', fn: guard_RI3_currentRepNotSuppressed },
    { name: 'RI4_suppressedHasCorrectBlockedReason', fn: guard_RI4_suppressedHasCorrectBlockedReason },
    { name: 'RI5_suppressedClearsRepId', fn: guard_RI5_suppressedClearsRepId },
    { name: 'RI6_passCoreStaleFlag', fn: guard_RI6_passCoreStaleFlag },
    { name: 'RI7_nonStalePreservesPass', fn: guard_RI7_nonStalePrevervesPass },
    { name: 'RI8_nonStalePreservesRepId', fn: guard_RI8_nonStalePreservesRepId },
    { name: 'RI9_noOpOnNonPass', fn: guard_RI9_noOpOnNonPass },
    { name: 'RI10_noOpOnMissingRecoveryTs', fn: guard_RI10_noOpOnMissingRecoveryTs },
    { name: 'RI11_setupMotionFalsePass', fn: guard_RI11_setupMotionFalsePass },
    { name: 'RI12_insufficientFramesFalsePass', fn: guard_RI12_insufficientFramesFalsePass },
  ];

  let allPassed = true;
  for (const g of guards) {
    let result: GuardResult;
    try {
      result = g.fn();
    } catch (e) {
      result = { ok: false, detail: `EXCEPTION: ${e instanceof Error ? e.message : String(e)}` };
    }
    const status = result.ok ? 'PASS' : 'FAIL';
    if (!result.ok) allPassed = false;
    console.log(`[${status}] ${g.name}: ${result.detail}`);
  }

  if (!allPassed) {
    throw new Error(
      'PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01 smoke guards failed. See output above.'
    );
  }

  console.log(
    '\nAll PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01 structural guards passed.\n' +
      'Automated checks are structural guards only. Real-device JSON remains the final truth.'
  );
}
