/**
 * THIN-EVIDENCE-PASS-RESET-01: Structural smoke guards.
 *
 * These are NOT a test suite — they are architectural invariant checks.
 * Each guard verifies one property required by the SSOT truth map.
 *
 * Policy:
 * - Automated checks are structural guards only.
 * - Real-device JSON remains the final validation truth.
 * - "Resolved" may NOT be claimed from smoke only.
 *
 * Guards:
 *  TE1. Good shallow pass preserved:
 *       A shallow rep with rev_span well above the threshold (~884ms equivalent)
 *       must still pass. Regression guard.
 *  TE2. Thin-evidence shallow blocked:
 *       A shallow rep with rev_span ~196ms (exactly 3 ascending frames @ ~98ms/frame)
 *       must NOT pass. thinEvidenceClear=false, blocked='reversal_span_too_short'.
 *  TE3. Deep pass exempt:
 *       A deep rep (relativePeak >= 0.1) must still pass regardless of reversal span.
 *       Gate does not apply above threshold.
 *  TE4. Standing-only blocked:
 *       Standing-only micro-sway must not pass (descent gate still blocks first).
 *
 * Reference: docs/THIN_EVIDENCE_PASS_RESET_01_SSOT_20260404.md §10
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
  const intervalMs = opts.intervalMs ?? 100;
  const out: SquatPassCoreDepthFrame[] = [];
  let t = 0;
  for (let i = 0; i < standFrames; i++) out.push({ depth: baseline, timestampMs: t++ * intervalMs });
  for (let i = 0; i < descentFrames; i++) {
    const d = baseline + ((peak - baseline) * (i + 1)) / descentFrames;
    out.push({ depth: d, timestampMs: t++ * intervalMs });
  }
  for (let i = 0; i < bottomFrames; i++) out.push({ depth: peak, timestampMs: t++ * intervalMs });
  for (let i = 0; i < ascentFrames; i++) {
    const d = peak - ((peak - baseline) * (i + 1)) / ascentFrames;
    out.push({ depth: d, timestampMs: t++ * intervalMs });
  }
  for (let i = 0; i < recoveryFrames; i++) out.push({ depth: baseline, timestampMs: t++ * intervalMs });
  return out;
}

function runPassCore(frames: SquatPassCoreDepthFrame[], baseline: number, setupBlocked = false) {
  const descent = computeSquatDescentTruth({ frames, baseline });
  return evaluateSquatPassCore({
    depthFrames: frames,
    baselineStandingDepth: baseline,
    setupMotionBlocked: setupBlocked,
    setupMotionBlockReason: setupBlocked ? 'framing_translation' : null,
    sharedDescentTruth: descent,
  });
}

// ── TE1: Good shallow pass preserved ─────────────────────────────────────────

/**
 * TE1: A shallow rep (relativePeak=0.06) with 10 ascending frames at 100ms/frame
 * produces rev_span = 9 * 100 = 900ms >> 300ms threshold. Must still pass.
 *
 * This matches the preserved good-pass signature: rev_span ~884ms–1100ms.
 */
export function guard_TE1_goodShallowPassPreserved(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36; // relativePeak = 0.06 — shallow band
  // squatProfile with 10 ascentFrames at default 100ms = rev_span ~900ms (9*100ms)
  const frames = squatProfile(baseline, peak, {
    descentFrames: 8,
    ascentFrames: 10,
    recoveryFrames: 4,
    intervalMs: 100,
  });
  const result = runPassCore(frames, baseline);
  const ok =
    result.passDetected === true &&
    result.thinEvidenceClear === true &&
    result.descentSpanClear === true;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `thinEvidenceClear=${result.thinEvidenceClear}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_span=${result.reversalSpanMs ?? 'n/a'}ms`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
    ].join('|'),
  };
}

// ── TE2: Thin-evidence shallow blocked ───────────────────────────────────────

/**
 * TE2: A shallow rep (relativePeak=0.06) where post-peak ascent produces exactly
 * 3 consecutive ascending frames at ~98ms intervals → rev_span ~196ms < 300ms.
 *
 * This is the exact thin-evidence signature from real-device validation:
 * cycle~684ms, dspan_ms~200ms, rev_span~196ms.
 * Must NOT pass after THIN-EVIDENCE-PASS-RESET-01.
 */
export function guard_TE2_thinEvidenceShallowBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  // Use 98ms frame interval to reproduce the ~196ms rev_span (2 * 98ms = 196ms with 3 frames)
  const frames = makeFrames(
    [
      // standing (8 frames for readiness + baseline)
      0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
      // descent: 4 frames → descentFrameCount=4 ≥ MIN_PRE_PEAK_DESCENT_FRAMES=3 → clears dspan gate
      0.32, 0.34, 0.35, 0.36,
      // bottom (2 frames at peak)
      0.36, 0.36,
      // EXACTLY 3 ascending frames (depth strictly decreasing) → rev_span = 2 * 98ms ≈ 196ms
      0.35, 0.34, 0.33,
      // standing recovery (2 frames at threshold or below)
      0.30, 0.30, 0.30,
    ],
    0,
    98 // 98ms intervals — matches real-device frame rate producing ~196ms rev_span
  );
  const result = runPassCore(frames, baseline);
  const ok =
    !result.passDetected &&
    result.passBlockedReason === 'reversal_span_too_short' &&
    result.thinEvidenceClear === false;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `thinEvidenceClear=${result.thinEvidenceClear}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_span=${result.reversalSpanMs ?? 'n/a'}ms`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
    ].join('|'),
  };
}

// ── TE3: Deep pass exempt from thin-evidence gate ─────────────────────────────

/**
 * TE3: A deep rep (relativePeak=0.45 >= 0.1) must still pass even if it were to
 * have a short reversal span — the gate does not apply above the shallow threshold.
 * Regression guard: THIN-EVIDENCE-PASS-RESET-01 must not affect deep reps.
 */
export function guard_TE3_deepRepExempt(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.75; // relativePeak = 0.45 — deep, well above DESCENT_SPAN_SHALLOW_PEAK_MAX=0.1
  const frames = squatProfile(baseline, peak, {
    ascentFrames: 8,
    recoveryFrames: 4,
    intervalMs: 100,
  });
  const result = runPassCore(frames, baseline);
  const ok = result.passDetected === true && result.thinEvidenceClear === true;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `thinEvidenceClear=${result.thinEvidenceClear}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_span=${result.reversalSpanMs ?? 'n/a'}ms`,
    ].join('|'),
  };
}

// ── TE4: Standing-only blocked ────────────────────────────────────────────────

/**
 * TE4: Standing-only micro-sway must not pass.
 * Regression guard: basic standing noise still blocked at descent gate before thin-evidence.
 */
export function guard_TE4_standingOnlyBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const frames = makeFrames([
    0.30, 0.30, 0.31, 0.31, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
  ]);
  const result = runPassCore(frames, baseline);
  const ok = !result.passDetected;
  return {
    ok,
    detail: `passDetected=${result.passDetected}|blocked=${result.passBlockedReason ?? 'none'}`,
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

export function runThinEvidenceResetSmoke(): void {
  const guards = [
    { name: 'TE1_goodShallowPassPreserved', fn: guard_TE1_goodShallowPassPreserved },
    { name: 'TE2_thinEvidenceShallowBlocked', fn: guard_TE2_thinEvidenceShallowBlocked },
    { name: 'TE3_deepRepExempt', fn: guard_TE3_deepRepExempt },
    { name: 'TE4_standingOnlyBlocked', fn: guard_TE4_standingOnlyBlocked },
  ];

  let allPassed = true;
  for (const g of guards) {
    const result = g.fn();
    const status = result.ok ? 'PASS' : 'FAIL';
    if (!result.ok) allPassed = false;
    console.log(`[${status}] ${g.name}: ${result.detail}`);
  }

  if (!allPassed) {
    throw new Error('THIN-EVIDENCE-PASS-RESET-01 smoke guards failed. See output above.');
  }

  console.log(
    '\nAll THIN-EVIDENCE-PASS-RESET-01 structural guards passed.\n' +
      'Automated checks are structural guards only. Real-device JSON remains the final truth.'
  );
}
