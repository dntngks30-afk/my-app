/**
 * DESCENT-SPAN-RESET-01: Structural smoke guards.
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
 *  DS1. Good shallow pass preserved:
 *       A shallow rep (relativePeak ~0.06) with meaningful descent (8 frames) must still pass.
 *  DS2. Early-peak shallow blocked:
 *       A shallow rep where peak latches after only 2 pre-peak frames (descentFrameCount=2)
 *       must NOT pass (descentSpanClear=false, passBlockedReason='descent_span_too_short').
 *  DS3. Deep pass preserved:
 *       A deep rep (relativePeak ~0.45) must still pass (gate does not apply above 0.1).
 *  DS4. Standing-only blocked:
 *       Standing-only micro-sway must not pass.
 *
 * Reference: docs/DESCENT_SPAN_RESET_01_SSOT_20260404.md §10
 */

import { evaluateSquatPassCore } from '@/lib/camera/squat/pass-core';
import { computeSquatDescentTruth } from '@/lib/camera/squat/squat-descent-truth';
import type { SquatPassCoreDepthFrame } from '@/lib/camera/squat/pass-core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFrames(depths: number[], startMs = 0, intervalMs = 100): SquatPassCoreDepthFrame[] {
  return depths.map((depth, i) => ({ depth, timestampMs: startMs + i * intervalMs }));
}

/** Build a realistic squat depth profile: stand → descent → bottom → ascent → stand */
function squatProfile(
  baseline: number,
  peak: number,
  opts: {
    standFrames?: number;
    descentFrames?: number;
    bottomFrames?: number;
    ascentFrames?: number;
    recoveryFrames?: number;
  } = {}
): SquatPassCoreDepthFrame[] {
  const standFrames = opts.standFrames ?? 8;
  const descentFrames = opts.descentFrames ?? 8;
  const bottomFrames = opts.bottomFrames ?? 4;
  const ascentFrames = opts.ascentFrames ?? 6;
  const recoveryFrames = opts.recoveryFrames ?? 4;
  const out: SquatPassCoreDepthFrame[] = [];
  let t = 0;
  for (let i = 0; i < standFrames; i++) out.push({ depth: baseline, timestampMs: t++ * 100 });
  for (let i = 0; i < descentFrames; i++) {
    const d = baseline + ((peak - baseline) * (i + 1)) / descentFrames;
    out.push({ depth: d, timestampMs: t++ * 100 });
  }
  for (let i = 0; i < bottomFrames; i++) out.push({ depth: peak, timestampMs: t++ * 100 });
  for (let i = 0; i < ascentFrames; i++) {
    const d = peak - ((peak - baseline) * (i + 1)) / ascentFrames;
    out.push({ depth: d, timestampMs: t++ * 100 });
  }
  for (let i = 0; i < recoveryFrames; i++) out.push({ depth: baseline, timestampMs: t++ * 100 });
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

// ── DS1: Good shallow pass preserved ─────────────────────────────────────────

/**
 * DS1: A shallow rep (relativePeak=0.06) with 8 pre-peak descent frames MUST still pass.
 * This is the preserved success class: meaningful descent + structured ascent + recovery.
 * Regression guard: the new gate must not block genuine shallow passes.
 */
export function guard_DS1_goodShallowPassPreserved(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36; // relativePeak = 0.06 — shallow band
  // squatProfile with default descentFrames=8 → descentFrameCount >> MIN_PRE_PEAK_DESCENT_FRAMES=3
  const frames = squatProfile(baseline, peak, { ascentFrames: 6, recoveryFrames: 4 });
  const result = runPassCore(frames, baseline);
  const ok = result.passDetected === true && result.descentSpanClear === true;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `descentSpanClear=${result.descentSpanClear}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `dspan_ms=${result.descentToPeakSpanMs ?? 'n/a'}`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
      `std_fr=${result.standingRecoveryFrameCount ?? 0}`,
    ].join('|'),
  };
}

// ── DS2: Early-peak shallow blocked ──────────────────────────────────────────

/**
 * DS2: A shallow rep where peak latches after only 2 pre-peak frames (descentFrameCount=2)
 * must NOT pass. The post-peak structure is valid (3 ascending frames + 2 recovery frames),
 * so without the descent span gate this rep would have opened pass.
 *
 * This is the exact false-pass class: peakLatchedAtIndex≈2, descentFrameCount<3,
 * completion would say 'descent_span_too_short', now pass-core must also block it.
 */
export function guard_DS2_earlyPeakShallowBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  // Sequence: 1 standing frame → 1 partial descent → PEAK (2 frames at peak → latest-equal-max anchors at frame 2)
  // → 3 ascending frames (valid reversal) → 3 recovery frames (valid standing)
  // descentFrameCount = peakIndex = 2 → gate blocks (2 < 3)
  const frames = makeFrames([
    // standing (8 frames for readiness)
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
    // 1 brief descent frame + immediate peak (2 frames at peak)
    0.33, 0.36, 0.36,
    // 3 ascending frames → valid reversal structure
    0.35, 0.34, 0.33,
    // 3 frames at or below standing threshold → valid standing recovery
    0.31, 0.30, 0.30, 0.30,
  ]);
  const result = runPassCore(frames, baseline);
  const ok =
    !result.passDetected &&
    result.passBlockedReason === 'descent_span_too_short' &&
    result.descentSpanClear === false;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `descentSpanClear=${result.descentSpanClear}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `dspan_ms=${result.descentToPeakSpanMs ?? 'n/a'}`,
    ].join('|'),
  };
}

// ── DS3: Deep pass preserved ──────────────────────────────────────────────────

/**
 * DS3: A deep rep (relativePeak=0.45) must still pass.
 * Gate only applies when relativePeak < 0.1. Deep reps are exempt.
 * Regression guard: DESCENT-SPAN-RESET-01 must not affect deep reps.
 */
export function guard_DS3_deepRepPasses(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.75; // relativePeak = 0.45 — deep
  const frames = squatProfile(baseline, peak, { ascentFrames: 8, recoveryFrames: 4 });
  const result = runPassCore(frames, baseline);
  const ok = result.passDetected === true && result.descentSpanClear === true;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `descentSpanClear=${result.descentSpanClear}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── DS4: Standing-only blocked ────────────────────────────────────────────────

/**
 * DS4: Standing-only micro-sway must not pass.
 * Regression guard: basic standing noise must remain blocked at descent detection.
 */
export function guard_DS4_standingOnlyBlocked(): { ok: boolean; detail: string } {
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

export function runDescentSpanResetSmoke(): void {
  const guards = [
    { name: 'DS1_goodShallowPassPreserved', fn: guard_DS1_goodShallowPassPreserved },
    { name: 'DS2_earlyPeakShallowBlocked', fn: guard_DS2_earlyPeakShallowBlocked },
    { name: 'DS3_deepRepPasses', fn: guard_DS3_deepRepPasses },
    { name: 'DS4_standingOnlyBlocked', fn: guard_DS4_standingOnlyBlocked },
  ];

  let allPassed = true;
  for (const g of guards) {
    const result = g.fn();
    const status = result.ok ? 'PASS' : 'FAIL';
    if (!result.ok) allPassed = false;
    console.log(`[${status}] ${g.name}: ${result.detail}`);
  }

  if (!allPassed) {
    throw new Error('DESCENT-SPAN-RESET-01 smoke guards failed. See output above.');
  }

  console.log(
    '\nAll DESCENT-SPAN-RESET-01 structural guards passed.\n' +
      'Automated checks are structural guards only. Real-device JSON remains the final truth.'
  );
}
