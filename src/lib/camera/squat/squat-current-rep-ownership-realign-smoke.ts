/**
 * PR-CAM-CURRENT-REP-OWNERSHIP-REALIGN-01: Structural smoke guards.
 *
 * These are NOT a test suite — they are architectural invariant checks.
 * Each guard verifies one property required by the SSOT locked truth map.
 *
 * Policy:
 * - Automated checks are structural guards only.
 * - Real-device JSON remains the final validation truth.
 * - "Resolved" may NOT be claimed from smoke only.
 *
 * Guards:
 *  OR1. Pass-core descentStartAtMs propagation:
 *       When pass-core has descentDetected=true, descentStartAtMs must be non-null
 *       regardless of whether passDetected is true or false.
 *
 *  OR2. Pass-core descentStartAtMs propagation — reversal blocked:
 *       When a rep detects descent + peak but fails at reversal,
 *       descentStartAtMs must still be present in the blocked result.
 *
 *  OR3. Pass-core descentStartAtMs propagation — standing recovery blocked:
 *       When a rep has valid descent + peak + reversal but no standing recovery,
 *       descentStartAtMs must still be present.
 *
 *  OR4. Pass-core descentStartAtMs propagation — anti-spike blocked:
 *       When a rep has the full cycle but fails anti-spike timing,
 *       descentStartAtMs must still be present.
 *
 *  OR5. Canonical temporal contract preserved:
 *       For any passing rep, descent < peak < reversal < standing recovery.
 *
 *  OR6. False-pass: setup motion fail-close:
 *       Pass-core must block when setup motion is detected, regardless of cycle quality.
 *
 *  OR7. False-pass: standing sway fail-close:
 *       Micro-sway near baseline must not produce descentDetected=true.
 *
 *  OR8. False-pass: series-start contamination fail-close:
 *       Peak at frame 0 (no pre-peak descent) must be blocked.
 *
 *  OR9. False-pass: degenerate pseudo-cycle fail-close:
 *       A cycle that is too short in duration must be blocked.
 *
 *  OR10. Live-style shallow rep — descentStartAtMs coherence:
 *        A shallow rep that fails at reversal (live pattern) must still carry
 *        descentStartAtMs, peakAtMs, and descentToPeakSpanMs in the blocked result.
 *
 *  OR11. Live-style ultra-shallow plateau — timestamp propagation:
 *        An ultra-shallow plateau rep failing at peak latch or reversal must
 *        carry all available timestamps up to the failure point.
 *
 *  OR12. Cross-layer timestamp split guard:
 *        When descentDetected=true in pass-core, the descentStartAtMs must match
 *        the shared descent truth's descentStartAtMs (same epoch source).
 *
 * Reference: docs/pr/PR-CAM-CURRENT-REP-OWNERSHIP-REALIGN-01.md
 */

import { evaluateSquatPassCore } from '@/lib/camera/squat/pass-core';
import { computeSquatDescentTruth } from '@/lib/camera/squat/squat-descent-truth';
import type { SquatPassCoreDepthFrame } from '@/lib/camera/squat/pass-core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFrames(depths: number[], startMs = 0, intervalMs = 100): SquatPassCoreDepthFrame[] {
  return depths.map((depth, i) => ({ depth, timestampMs: startMs + i * intervalMs }));
}

function squatProfile(
  baseline: number,
  peak: number,
  opts: {
    standFrames?: number;
    descentFrames?: number;
    bottomFrames?: number;
    ascentFrames?: number;
    recoveryFrames?: number;
    intervalMs?: number;
  } = {}
): SquatPassCoreDepthFrame[] {
  const standFrames = opts.standFrames ?? 8;
  const descentFrames = opts.descentFrames ?? 8;
  const bottomFrames = opts.bottomFrames ?? 4;
  const ascentFrames = opts.ascentFrames ?? 6;
  const recoveryFrames = opts.recoveryFrames ?? 4;
  const interval = opts.intervalMs ?? 100;
  const out: SquatPassCoreDepthFrame[] = [];
  let t = 0;
  for (let i = 0; i < standFrames; i++) out.push({ depth: baseline, timestampMs: t++ * interval });
  for (let i = 0; i < descentFrames; i++) {
    const d = baseline + ((peak - baseline) * (i + 1)) / descentFrames;
    out.push({ depth: d, timestampMs: t++ * interval });
  }
  for (let i = 0; i < bottomFrames; i++) out.push({ depth: peak, timestampMs: t++ * interval });
  for (let i = 0; i < ascentFrames; i++) {
    const d = peak - ((peak - baseline) * (i + 1)) / ascentFrames;
    out.push({ depth: d, timestampMs: t++ * interval });
  }
  for (let i = 0; i < recoveryFrames; i++) out.push({ depth: baseline, timestampMs: t++ * interval });
  return out;
}

function ultraShallowPlateauProfile(
  baseline: number,
  peak: number,
  opts: {
    standFrames?: number;
    riseFrames?: number;
    plateauFrames?: number;
    fallFrames?: number;
    recoveryFrames?: number;
    intervalMs?: number;
  } = {}
): SquatPassCoreDepthFrame[] {
  const standFrames = opts.standFrames ?? 8;
  const riseFrames = opts.riseFrames ?? 6;
  const plateauFrames = opts.plateauFrames ?? 4;
  const fallFrames = opts.fallFrames ?? 6;
  const recoveryFrames = opts.recoveryFrames ?? 4;
  const interval = opts.intervalMs ?? 100;
  const out: SquatPassCoreDepthFrame[] = [];
  let t = 0;
  for (let i = 0; i < standFrames; i++) out.push({ depth: baseline, timestampMs: t++ * interval });
  for (let i = 0; i < riseFrames; i++) {
    const d = baseline + ((peak - baseline) * (i + 1)) / riseFrames;
    out.push({ depth: d, timestampMs: t++ * interval });
  }
  for (let i = 0; i < plateauFrames; i++) out.push({ depth: peak, timestampMs: t++ * interval });
  for (let i = 0; i < fallFrames; i++) {
    const d = peak - ((peak - baseline) * (i + 1)) / fallFrames;
    out.push({ depth: d, timestampMs: t++ * interval });
  }
  for (let i = 0; i < recoveryFrames; i++) out.push({ depth: baseline, timestampMs: t++ * interval });
  return out;
}

function runPassCore(frames: SquatPassCoreDepthFrame[], baseline: number, setupBlocked = false) {
  const descent = computeSquatDescentTruth({ frames, baseline });
  return {
    result: evaluateSquatPassCore({
      depthFrames: frames,
      baselineStandingDepth: baseline,
      setupMotionBlocked: setupBlocked,
      setupMotionBlockReason: setupBlocked ? 'framing_translation' : null,
      sharedDescentTruth: descent,
    }),
    descent,
  };
}

// ── OR1: descentStartAtMs propagation — basic ─────────────────────────────────

/**
 * OR1: When pass-core reports descentDetected=true, descentStartAtMs must be non-null.
 *
 * This is the core invariant that eliminates the illegal half-state:
 *   descentDetected=true && descentStartAtMs==null
 *
 * Tested with a shallow rep that fails at thin-evidence gate (reversal span too short).
 */
export function guard_OR1_descentStartAtMsPropagation(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36;
  // 2 ascending frames only → reversal structurally confirmed but span too short for shallow
  const frames = makeFrames([
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
    0.32, 0.33, 0.34, 0.35, 0.36,
    0.36, 0.36,
    0.35, 0.34,
    0.34, 0.34, 0.34,
  ]);
  const { result, descent } = runPassCore(frames, baseline);

  const ok =
    descent.descentDetected === true &&
    result.descentDetected === true &&
    result.passDetected === false &&
    result.descentStartAtMs != null;

  return {
    ok,
    detail: [
      `descentDetected=${result.descentDetected}`,
      `passDetected=${result.passDetected}`,
      `descentStartAtMs=${result.descentStartAtMs ?? 'null'}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR2: descentStartAtMs propagation — reversal blocked ──────────────────────

/**
 * OR2: Descent detected but no reversal after peak.
 * descentStartAtMs must still be present.
 */
export function guard_OR2_descentStartAtMsReversalBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36;
  // Descent → peak hold → no reversal (depth stays at peak)
  const frames = makeFrames([
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
    0.32, 0.33, 0.34, 0.35, 0.36,
    0.36, 0.36, 0.36, 0.36, 0.36,
  ]);
  const { result } = runPassCore(frames, baseline);

  const ok =
    result.descentDetected === true &&
    result.passDetected === false &&
    result.descentStartAtMs != null &&
    result.peakAtMs != null;

  return {
    ok,
    detail: [
      `descentDetected=${result.descentDetected}`,
      `passDetected=${result.passDetected}`,
      `descentStartAtMs=${result.descentStartAtMs ?? 'null'}`,
      `peakAtMs=${result.peakAtMs ?? 'null'}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR3: descentStartAtMs propagation — standing recovery blocked ─────────────

/**
 * OR3: Descent + reversal detected but no standing recovery.
 * descentStartAtMs must still be present.
 */
export function guard_OR3_descentStartAtMsStandingBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.45;
  // Full descent + reversal but stalls mid-rise (no standing recovery)
  const frames = makeFrames([
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
    0.33, 0.36, 0.39, 0.42, 0.45,
    0.45, 0.45,
    0.43, 0.41, 0.39, 0.37,
    0.37, 0.37, 0.37,
  ]);
  const { result } = runPassCore(frames, baseline);

  const ok =
    result.descentDetected === true &&
    result.reversalDetected === true &&
    result.passDetected === false &&
    result.descentStartAtMs != null &&
    result.peakAtMs != null &&
    result.reversalAtMs != null;

  return {
    ok,
    detail: [
      `descentDetected=${result.descentDetected}`,
      `reversalDetected=${result.reversalDetected}`,
      `standingRecovered=${result.standingRecovered}`,
      `descentStartAtMs=${result.descentStartAtMs ?? 'null'}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR4: descentStartAtMs propagation — anti-spike blocked ────────────────────

/**
 * OR4: Full cycle but anti-spike timing fails (cycle too short).
 * descentStartAtMs must still be present.
 */
export function guard_OR4_descentStartAtMsAntiSpikeBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.45;
  // Very fast cycle: 10ms intervals → total < MIN_CYCLE_DURATION_MS
  const frames = squatProfile(baseline, peak, {
    standFrames: 8,
    descentFrames: 4,
    bottomFrames: 2,
    ascentFrames: 4,
    recoveryFrames: 3,
    intervalMs: 10,
  });
  const { result } = runPassCore(frames, baseline);

  const ok =
    result.descentDetected === true &&
    result.passDetected === false &&
    result.descentStartAtMs != null;

  return {
    ok,
    detail: [
      `descentDetected=${result.descentDetected}`,
      `antiSpikeClear=${result.antiSpikeClear}`,
      `descentStartAtMs=${result.descentStartAtMs ?? 'null'}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR5: Canonical temporal contract preserved ────────────────────────────────

/**
 * OR5: For any passing rep, the temporal order must be:
 *   descent < peak < reversal < standing recovery
 *
 * Tests both standard and shallow reps.
 */
export function guard_OR5_canonicalTemporalContract(): { ok: boolean; detail: string } {
  const cases = [
    { label: 'deep', baseline: 0.30, peak: 0.75, intervalMs: 100 },
    { label: 'shallow', baseline: 0.30, peak: 0.36, intervalMs: 150 },
  ];

  const violations: string[] = [];

  for (const c of cases) {
    const frames = squatProfile(c.baseline, c.peak, {
      descentFrames: 6,
      ascentFrames: 6,
      recoveryFrames: 4,
      intervalMs: c.intervalMs,
    });
    const { result } = runPassCore(frames, c.baseline);

    if (!result.passDetected) {
      violations.push(`${c.label}: passDetected=false (blocked=${result.passBlockedReason})`);
      continue;
    }

    const d = result.descentStartAtMs ?? -1;
    const p = result.peakAtMs ?? -1;
    const r = result.reversalAtMs ?? -1;
    const s = result.standingRecoveredAtMs ?? -1;

    if (!(d < p)) violations.push(`${c.label}: descent(${d}) >= peak(${p})`);
    if (!(p <= r)) violations.push(`${c.label}: peak(${p}) > reversal(${r})`);
    if (!(r < s)) violations.push(`${c.label}: reversal(${r}) >= standing(${s})`);
  }

  const ok = violations.length === 0;
  return {
    ok,
    detail: ok
      ? `all ${cases.length} cases: temporal order descent<peak<reversal<standing`
      : violations.join('; '),
  };
}

// ── OR6: Setup motion fail-close ──────────────────────────────────────────────

/**
 * OR6: Setup motion must block pass unconditionally.
 */
export function guard_OR6_setupMotionFailClose(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.75;
  const frames = squatProfile(baseline, peak);
  const { result } = runPassCore(frames, baseline, true);
  const ok = !result.passDetected;
  return {
    ok,
    detail: `passDetected=${result.passDetected}|blocked=${result.passBlockedReason ?? 'none'}`,
  };
}

// ── OR7: Standing sway fail-close ─────────────────────────────────────────────

/**
 * OR7: Micro-sway near baseline must not pass.
 */
export function guard_OR7_standingSwayFailClose(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const frames = makeFrames([
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
    0.31, 0.31, 0.31, 0.30, 0.30, 0.30, 0.30, 0.30,
  ]);
  const { result, descent } = runPassCore(frames, baseline);
  const ok = !result.passDetected && !descent.descentDetected;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `descentDetected=${descent.descentDetected}`,
      `relativePeak=${Math.round(descent.relativePeak * 1000) / 1000}`,
    ].join('|'),
  };
}

// ── OR8: Series-start contamination fail-close ────────────────────────────────

/**
 * OR8: Peak at series start (no pre-peak descent) must be blocked.
 */
export function guard_OR8_seriesStartContaminationFailClose(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const frames = makeFrames([
    0.36, 0.36,
    0.35, 0.34, 0.33,
    0.31, 0.30, 0.30, 0.30,
  ]);
  const { result, descent } = runPassCore(frames, baseline);
  const ok = !result.passDetected && result.descentSpanClear === false;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `descentSpanClear=${result.descentSpanClear}`,
      `descentFrameCount=${descent.descentFrameCount}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR9: Degenerate pseudo-cycle fail-close ───────────────────────────────────

/**
 * OR9: Cycle with total duration shorter than minimum must be blocked.
 */
export function guard_OR9_degeneratePseudoCycleFailClose(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.75;
  // 5ms intervals → cycle << MIN_CYCLE_DURATION_MS
  const frames = squatProfile(baseline, peak, {
    standFrames: 4,
    descentFrames: 4,
    bottomFrames: 2,
    ascentFrames: 4,
    recoveryFrames: 3,
    intervalMs: 5,
  });
  const { result } = runPassCore(frames, baseline);
  const ok = !result.passDetected && result.antiSpikeClear === false;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `antiSpikeClear=${result.antiSpikeClear}`,
      `cycleDurationMs=${result.cycleDurationMs ?? 'n/a'}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR10: Live-style shallow — descentStartAtMs coherence ─────────────────────

/**
 * OR10: Live-style shallow rep failing at reversal must carry
 * descentStartAtMs, peakAtMs, and descentToPeakSpanMs.
 *
 * Reproduces the live pattern: bottom/commit evidence visible but
 * reversal not reached → completion/pass-core must still own descent epoch.
 */
export function guard_OR10_liveShallowDescentCoherence(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36;
  // Slow descent → peak hold → minimal rise (not enough for reversal)
  const frames = makeFrames(
    [
      0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
      0.31, 0.32, 0.33, 0.34, 0.35, 0.36,
      0.36, 0.36, 0.36,
      0.355, 0.355,
    ],
    0,
    100
  );
  const { result, descent } = runPassCore(frames, baseline);

  const ok =
    descent.descentDetected === true &&
    result.descentStartAtMs != null &&
    result.peakAtMs != null &&
    result.descentStartAtMs < result.peakAtMs;

  return {
    ok,
    detail: [
      `descentDetected=${descent.descentDetected}`,
      `descentStartAtMs=${result.descentStartAtMs ?? 'null'}`,
      `peakAtMs=${result.peakAtMs ?? 'null'}`,
      `descentToPeakSpanMs=${result.descentToPeakSpanMs ?? 'null'}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR11: Ultra-shallow plateau — timestamp propagation ───────────────────────

/**
 * OR11: Ultra-shallow plateau rep failing at peak latch or reversal
 * must carry all available timestamps.
 *
 * Reproduces: baselineFrozen=false / peakLatched=false / freeze_or_latch_missing
 * from live patterns where plateau behavior prevents peak latch.
 */
export function guard_OR11_ultraShallowTimestampPropagation(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.33; // ultra-shallow
  const frames = ultraShallowPlateauProfile(baseline, peak, {
    standFrames: 8,
    riseFrames: 6,
    plateauFrames: 4,
    fallFrames: 6,
    recoveryFrames: 4,
    intervalMs: 100,
  });
  const { result, descent } = runPassCore(frames, baseline);

  // Regardless of pass/fail, when descent is detected, timestamps must be present
  const ok =
    descent.descentDetected === true
      ? result.descentStartAtMs != null && result.peakAtMs != null
      : true; // if no descent detected, timestamps are not required

  return {
    ok,
    detail: [
      `descentDetected=${descent.descentDetected}`,
      `peakLatched=${result.peakLatched}`,
      `descentStartAtMs=${result.descentStartAtMs ?? 'null'}`,
      `peakAtMs=${result.peakAtMs ?? 'null'}`,
      `passDetected=${result.passDetected}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── OR12: Cross-layer timestamp split guard ───────────────────────────────────

/**
 * OR12: When descentDetected=true, pass-core's descentStartAtMs must match
 * the shared descent truth's descentStartAtMs.
 *
 * This verifies no cross-layer timebase split: both layers see the same epoch.
 */
export function guard_OR12_crossLayerTimestampSplit(): { ok: boolean; detail: string } {
  const cases = [
    { label: 'ultra_shallow', baseline: 0.30, peak: 0.33 },
    { label: 'shallow', baseline: 0.30, peak: 0.36 },
    { label: 'deep', baseline: 0.30, peak: 0.75 },
  ];

  const violations: string[] = [];

  for (const c of cases) {
    const frames = squatProfile(c.baseline, c.peak, {
      descentFrames: 6,
      ascentFrames: 6,
      recoveryFrames: 4,
      intervalMs: 150,
    });
    const { result, descent } = runPassCore(frames, c.baseline);

    if (descent.descentDetected && result.descentDetected) {
      if (result.descentStartAtMs == null) {
        violations.push(`${c.label}: pass-core descentStartAtMs=null when descentDetected=true`);
      } else if (descent.descentStartAtMs != null && result.descentStartAtMs !== descent.descentStartAtMs) {
        // Allow minor difference from fallback (depthFrames[0].timestampMs), but they should be close
        const diff = Math.abs(result.descentStartAtMs - descent.descentStartAtMs);
        if (diff > 1) {
          violations.push(
            `${c.label}: descentStartAtMs mismatch (pass-core=${result.descentStartAtMs}, truth=${descent.descentStartAtMs}, diff=${diff}ms)`
          );
        }
      }
    }
  }

  const ok = violations.length === 0;
  return {
    ok,
    detail: ok
      ? `all ${cases.length} cases: cross-layer descentStartAtMs aligned`
      : violations.join('; '),
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

export function runCurrentRepOwnershipRealignSmoke(): void {
  const guards = [
    { name: 'OR1_descentStartAtMsPropagation', fn: guard_OR1_descentStartAtMsPropagation },
    { name: 'OR2_descentStartAtMsReversalBlocked', fn: guard_OR2_descentStartAtMsReversalBlocked },
    { name: 'OR3_descentStartAtMsStandingBlocked', fn: guard_OR3_descentStartAtMsStandingBlocked },
    { name: 'OR4_descentStartAtMsAntiSpikeBlocked', fn: guard_OR4_descentStartAtMsAntiSpikeBlocked },
    { name: 'OR5_canonicalTemporalContract', fn: guard_OR5_canonicalTemporalContract },
    { name: 'OR6_setupMotionFailClose', fn: guard_OR6_setupMotionFailClose },
    { name: 'OR7_standingSwayFailClose', fn: guard_OR7_standingSwayFailClose },
    { name: 'OR8_seriesStartContaminationFailClose', fn: guard_OR8_seriesStartContaminationFailClose },
    { name: 'OR9_degeneratePseudoCycleFailClose', fn: guard_OR9_degeneratePseudoCycleFailClose },
    { name: 'OR10_liveShallowDescentCoherence', fn: guard_OR10_liveShallowDescentCoherence },
    { name: 'OR11_ultraShallowTimestampPropagation', fn: guard_OR11_ultraShallowTimestampPropagation },
    { name: 'OR12_crossLayerTimestampSplit', fn: guard_OR12_crossLayerTimestampSplit },
  ];

  let allPassed = true;
  for (const g of guards) {
    const result = g.fn();
    const status = result.ok ? 'PASS' : 'FAIL';
    if (!result.ok) allPassed = false;
    console.log(`[${status}] ${g.name}: ${result.detail}`);
  }

  if (!allPassed) {
    throw new Error('PR-CAM-CURRENT-REP-OWNERSHIP-REALIGN-01 smoke guards failed. See output above.');
  }

  console.log(
    '\nAll PR-CAM-CURRENT-REP-OWNERSHIP-REALIGN-01 structural guards passed.\n' +
      'Automated checks are structural guards only. Real-device JSON remains the final truth.'
  );
}
