/**
 * PASS-WINDOW-RESET-01: Dedicated squat pass window builder.
 *
 * Sole responsibility: hand pass-core an unbiased motion window with a
 * locally-owned baseline derived from the post-readiness-dwell valid stream.
 *
 * Design contract:
 * - Input: `valid` (post-readiness-dwell frames from evaluators/squat.ts).
 * - Output: all valid depth frames WITHOUT upstream arming/completion slicing.
 * - Baseline: min depth of the first PASS_BASELINE_WINDOW frames of `valid`.
 *   Those frames are the start of the readiness dwell window, so the person
 *   was standing stably — they are the correct, uncontaminated reference point.
 *
 * Why this fixes the core failure:
 * - `completionFrames` could start AT or AFTER the peak (peakLatchedAtIndex=0),
 *   discarding the pre-peak descent and producing zero descentFrames.
 * - Using `valid` instead ensures the peak is never the first frame, which is
 *   the root cause of `freeze_or_latch_missing`, `no_reversal`, `series_too_short`,
 *   and `ascent_recovery_span_too_short` on shallow real reps.
 *
 * What this file MUST NOT do:
 * - No completion-state verdict fields.
 * - No arming/slicing by stable-standing segment identification.
 * - No ROM labels or policy.
 * - No baseline inherited from upstream completion-state freeze ownership.
 *
 * Reference: docs/PASS_WINDOW_RESET_01_SSOT_20260404.md §4, §5
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Baseline window: take the min of the first N valid frames as standing depth.
 * `valid[0..N-1]` corresponds to the start of the readiness-dwell window where
 * the person was confirmed standing — a safe, unbiased baseline reference.
 */
const PASS_BASELINE_WINDOW = 8;

/**
 * Minimum usable frames for the baseline segment.
 * Fewer than this indicates a very short dwell; we prefer blocking to using a
 * potentially contaminated single-frame baseline.
 */
const PASS_BASELINE_MIN_FRAMES = 3;

/**
 * Minimum pass-window depth frames for a meaningful evaluation.
 * Must be satisfied before pass-core even runs.
 */
const MIN_PASS_WINDOW_FRAMES = 8;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Single depth sample from the pass window. */
export interface SquatPassWindowFrame {
  depth: number;
  timestampMs: number;
}

/** Result of buildSquatPassWindow. */
export interface SquatPassWindowResult {
  /** All depth frames from the valid stream — no upstream arming/completion slicing applied. */
  passWindowFrames: SquatPassWindowFrame[];
  /**
   * Locally-derived baseline: min depth of the first PASS_BASELINE_WINDOW frames.
   * These correspond to the readiness-dwell standing segment.
   * 0 when usable=false.
   */
  passWindowBaseline: number;
  /** True when the window is large enough and a clean baseline was derived. */
  usable: boolean;
  /** Non-null when usable=false. */
  blockedReason: string | null;
  /** Number of frames used for baseline computation. */
  baselineWindowFrameCount: number;
  /** Trace string for real-device debugging. */
  trace: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Blended depth preferred, fallback to primary. Matches arming depth reader convention. */
function readPassWindowDepth(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * PASS-WINDOW-RESET-01: Build the independent squat pass window.
 *
 * @param valid - Post-readiness-dwell valid frames (from evaluators/squat.ts).
 *                These are `validRaw.slice(dwell.firstSliceStartIndexInValid)`.
 *                The first ~12 frames are the readiness-dwell standing segment.
 *
 * Key guarantee: `passWindowFrames` includes ALL of `valid` without arming slicing.
 * This means the peak is never the first frame, and pre-peak descent is always visible.
 */
export function buildSquatPassWindow(valid: PoseFeaturesFrame[]): SquatPassWindowResult {
  const passWindowFrames: SquatPassWindowFrame[] = [];
  for (const f of valid) {
    const d = readPassWindowDepth(f);
    if (typeof d !== 'number' || !Number.isFinite(d)) continue;
    passWindowFrames.push({ depth: d, timestampMs: f.timestampMs });
  }

  if (passWindowFrames.length < MIN_PASS_WINDOW_FRAMES) {
    return {
      passWindowFrames,
      passWindowBaseline: 0,
      usable: false,
      blockedReason: 'insufficient_pass_window_frames',
      baselineWindowFrameCount: 0,
      trace: `frames=${passWindowFrames.length}<${MIN_PASS_WINDOW_FRAMES}`,
    };
  }

  // Baseline = minimum depth across the first PASS_BASELINE_WINDOW frames.
  // Those frames are the readiness-dwell standing segment — guaranteed standing.
  const baselineWindow = passWindowFrames.slice(0, PASS_BASELINE_WINDOW);

  if (baselineWindow.length < PASS_BASELINE_MIN_FRAMES) {
    return {
      passWindowFrames,
      passWindowBaseline: 0,
      usable: false,
      blockedReason: 'baseline_window_too_short',
      baselineWindowFrameCount: baselineWindow.length,
      trace: `frames=${passWindowFrames.length}|bw=${baselineWindow.length}<${PASS_BASELINE_MIN_FRAMES}`,
    };
  }

  const passWindowBaseline = Math.min(...baselineWindow.map((f) => f.depth));

  return {
    passWindowFrames,
    passWindowBaseline,
    usable: true,
    blockedReason: null,
    baselineWindowFrameCount: baselineWindow.length,
    trace: `frames=${passWindowFrames.length}|baseline=${Math.round(passWindowBaseline * 1000) / 1000}|bw=${baselineWindow.length}`,
  };
}
