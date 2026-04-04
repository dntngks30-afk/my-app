/**
 * REVERSAL-STANDING-RESET-01: Structural smoke guards.
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
 *  R1. Bottom-collapse false pass blocked:
 *      A rep that reaches the peak and collapses to standing in ONE frame must NOT pass.
 *  R2. One-frame post-peak drop blocked:
 *      A single post-peak depth drop large enough to satisfy reversalDropRequired must NOT pass
 *      without MIN_REVERSAL_FRAMES ascending frames.
 *  R3. Same-frame reversal+standing impossible:
 *      reversalConfirmedAtMs must be strictly < standingRecoveredAtMs on every pass.
 *  R4. Valid shallow rep still passes:
 *      A rep with real ascent (>= 3 ascending frames) and recovery must pass.
 *  R5. Valid deep rep preserved:
 *      A deep rep must pass.
 *  R6. Standing-only blocked:
 *      Standing-only micro-sway must never pass.
 *  R7. Setup-motion blocked:
 *      setup motion = blocked unconditionally.
 *
 * Reference: docs/REVERSAL_STANDING_RESET_01_TRUTH_MAP_20260404.md §8, §9, §10
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
  opts: { standFrames?: number; descentFrames?: number; bottomFrames?: number; ascentFrames?: number; recoveryFrames?: number } = {}
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

// ── R1: Bottom-collapse false pass blocked ────────────────────────────────────

/**
 * R1: A rep that reaches peak and jumps to baseline in ONE post-peak frame must NOT pass.
 * This is the canonical false-pass scenario: bottom-collapse with simultaneous threshold hit.
 * Without REVERSAL-TRUTH-RESET-01, this would have passed via single-frame reversal.
 */
export function guard_R1_bottomCollapseBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36; // relativePeak = 0.06
  // Standing → descent → bottom → ONE frame collapse to baseline (no real ascent)
  const frames = makeFrames([
    // standing (8 frames)
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30,
    // descent (4 frames)
    0.32, 0.34, 0.35, 0.36,
    // bottom (3 frames)
    0.36, 0.36, 0.36,
    // ONE collapse frame: jumps all the way to baseline
    0.30,
    // stays at baseline (but only 1 frame of "reversal" occurred)
    0.30, 0.30, 0.30,
  ]);
  const result = runPassCore(frames, baseline);
  const ok = !result.passDetected;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
      `rev_block=${result.reversalBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── R2: One-frame post-peak drop blocked ──────────────────────────────────────

/**
 * R2: A single post-peak depth drop large enough to satisfy the old reversalDropRequired
 * must NOT pass without MIN_REVERSAL_FRAMES ascending frames.
 */
export function guard_R2_oneFrameDropBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36; // relativePeak = 0.06, reversalDropRequired = 0.012
  // Standing → descent → ONE post-peak drop of 0.03 (> 0.012 = reversalDropRequired) → back down
  const frames = makeFrames([
    0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, // standing
    0.32, 0.34, 0.35, 0.36, // descent
    0.36, 0.36, // bottom
    0.33, // one large drop frame (> reversalDropRequired old-style)
    0.34, 0.35, 0.35, // goes back down / flat (not continuing ascent)
  ]);
  const result = runPassCore(frames, baseline);
  const ok = !result.passDetected;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
      `rev_block=${result.reversalBlockedReason ?? 'none'}`,
    ].join('|'),
  };
}

// ── R3: Same-frame reversal+standing impossible ───────────────────────────────

/**
 * R3: On any passing rep, reversalConfirmedAtMs must be strictly less than
 * standingRecoveredAtMs. Same-frame satisfaction is structurally impossible.
 */
export function guard_R3_sameFrameImpossible(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36;
  const frames = squatProfile(baseline, peak);
  const result = runPassCore(frames, baseline);

  if (!result.passDetected) {
    return {
      ok: false,
      detail: `pass not detected — cannot check same-frame: blocked=${result.passBlockedReason}`,
    };
  }

  const revTs = result.reversalConfirmedAtMs;
  const stdTs = result.standingRecoveredAtMs;

  if (revTs == null || stdTs == null) {
    return {
      ok: false,
      detail: `missing timestamps: reversalConfirmedAtMs=${revTs} standingRecoveredAtMs=${stdTs}`,
    };
  }

  const ok = stdTs > revTs;
  return {
    ok,
    detail: `reversalConfirmedAtMs=${revTs}|standingRecoveredAtMs=${stdTs}|diff=${stdTs - revTs}ms`,
  };
}

// ── R4: Valid shallow rep still passes ────────────────────────────────────────

/**
 * R4: A rep with real ascent (6 ascending frames) and recovery MUST pass.
 * Regression guard: structured reversal must not block valid shallow reps.
 */
export function guard_R4_shallowRepPasses(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36; // 0.06 relative — shallow band
  const frames = squatProfile(baseline, peak, { ascentFrames: 6, recoveryFrames: 4 });
  const result = runPassCore(frames, baseline);
  const ok = result.passDetected === true;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
      `std_fr=${result.standingRecoveryFrameCount ?? 0}`,
    ].join('|'),
  };
}

// ── R5: Valid deep rep preserved ──────────────────────────────────────────────

/**
 * R5: A deep rep (0.45 relative) must still pass.
 * Regression guard: deep reps must not regress.
 */
export function guard_R5_deepRepPasses(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.75; // 0.45 relative — deep
  const frames = squatProfile(baseline, peak, { ascentFrames: 8, recoveryFrames: 4 });
  const result = runPassCore(frames, baseline);
  const ok = result.passDetected === true;
  return {
    ok,
    detail: [
      `passDetected=${result.passDetected}`,
      `blocked=${result.passBlockedReason ?? 'none'}`,
      `rev_fr=${result.reversalFrameCount ?? 0}`,
    ].join('|'),
  };
}

// ── R6: Standing-only blocked ─────────────────────────────────────────────────

/**
 * R6: Standing-only micro-sway must not pass.
 */
export function guard_R6_standingOnlyBlocked(): { ok: boolean; detail: string } {
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

// ── R7: Setup-motion blocked ──────────────────────────────────────────────────

/**
 * R7: Setup camera motion must block pass even with a valid motion profile.
 */
export function guard_R7_setupMotionBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.30;
  const peak = 0.36;
  const frames = squatProfile(baseline, peak);
  const result = runPassCore(frames, baseline, true);
  const ok = !result.passDetected && result.passBlockedReason?.includes('setup_motion_blocked') === true;
  return {
    ok,
    detail: `passDetected=${result.passDetected}|blocked=${result.passBlockedReason ?? 'none'}`,
  };
}

// ── Run all guards ─────────────────────────────────────────────────────────────

/** Run all structural guards and return a summary. */
export function runReversalStandingResetSmoke(): {
  passed: number;
  failed: number;
  results: Array<{ guard: string; ok: boolean; detail: string }>;
  allPassed: boolean;
} {
  const guards: Array<{ name: string; fn: () => { ok: boolean; detail: string } }> = [
    { name: 'R1_bottomCollapseBlocked', fn: guard_R1_bottomCollapseBlocked },
    { name: 'R2_oneFrameDropBlocked', fn: guard_R2_oneFrameDropBlocked },
    { name: 'R3_sameFrameImpossible', fn: guard_R3_sameFrameImpossible },
    { name: 'R4_shallowRepPasses', fn: guard_R4_shallowRepPasses },
    { name: 'R5_deepRepPasses', fn: guard_R5_deepRepPasses },
    { name: 'R6_standingOnlyBlocked', fn: guard_R6_standingOnlyBlocked },
    { name: 'R7_setupMotionBlocked', fn: guard_R7_setupMotionBlocked },
  ];

  const results: Array<{ guard: string; ok: boolean; detail: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of guards) {
    try {
      const { ok, detail } = fn();
      results.push({ guard: name, ok, detail });
      if (ok) passed++; else failed++;
    } catch (err) {
      results.push({ guard: name, ok: false, detail: `threw: ${String(err)}` });
      failed++;
    }
  }

  return { passed, failed, results, allPassed: failed === 0 };
}

/**
 * IMPORTANT: Automated checks are structural guards only.
 * Real-device JSON remains the final truth.
 * Do NOT claim REVERSAL-STANDING-RESET-01 as resolved based on smoke only.
 *
 * Real-device validation checklist:
 * - [ ] No pass while completion-side shows reversalConfirmedAfterDescend=false
 * - [ ] No pass when device JSON bottom-collapse without real ascent segment
 * - [ ] pass_snapshot opens only after clear post-peak upward segment + standing
 * - [ ] shallow valid reps still pass after real ascent and recovery
 * - [ ] pass-core trace shows: rev_fr >= 3, std_fr >= 2, reversalConfirmedAtMs < standingRecoveredAtMs
 * - [ ] standing/setup/jitter/bottom-collapse remain blocked
 */
