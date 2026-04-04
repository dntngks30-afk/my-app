/**
 * DESCENT-TRUTH-RESET-01: Single shared squat descent truth owner.
 *
 * This module is the ONLY authoritative owner of squat descent truth.
 * It derives descent from pass-window-owned frames (SquatPassWindowFrame[])
 * and exposes a single, consistent descent result consumed by:
 *   - pass-core.ts (single pass writer)
 *   - squat-completion-state.ts (descendConfirmed alignment)
 *   - squat-event-cycle.ts (descentDetected/descentFrames alignment)
 *
 * Design laws enforced here:
 *   §4.4 Shallow descent compatibility: global pre-peak excursion is used,
 *     NOT per-frame increment counting. A ~0.06 depth change is valid even
 *     when smoothing makes individual frame increments < 0.002.
 *   §4.5 Peak tie law: latest-equal-max anchoring preserves the pre-peak
 *     descent window for shallow plateau reps.
 *
 * Forbidden: policy, interpretation, pass-opening. This module only answers
 * "did meaningful descent happen?" and provides timing/excursion evidence.
 *
 * Reference: docs/DESCENT_TRUTH_RESET_01_SSOT_20260404.md
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Minimum relative peak (peak − baseline) for meaningful descent.
 * Aligned with pass-core MIN_DESCENT_DEPTH_DELTA. Blocks standing-only / micro-sway.
 */
const MIN_SHARED_DESCENT_RELATIVE_PEAK = 0.025;

/**
 * §4.5 Peak tie tolerance: depth within this band of the global max is
 * considered "equal-max" for latest-equal-max anchoring.
 * Small value — only covers floating-point plateau flatness, not broad shoulders.
 */
const PEAK_TIE_TOLERANCE = 0.003;

/**
 * Descent epoch threshold: scan backward from peak to find the last frame
 * with depth <= baseline + (relativePeak × this fraction).
 * That frame is the start of the "active descent" epoch.
 * Aligned with pass-core DESCENT_EPOCH_REL_THRESHOLD.
 */
const DESCENT_EPOCH_REL_THRESHOLD = 0.10;

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single depth + timestamp sample from the pass window. */
export interface SquatDescentTruthFrame {
  depth: number;
  timestampMs: number;
}

export interface SquatDescentTruthInput {
  /** Pass-window frames (SquatPassWindowFrame[] compatible). */
  frames: SquatDescentTruthFrame[];
  /** Pass-window-owned baseline: min depth of first 8 valid frames. */
  baseline: number;
}

/**
 * DESCENT-TRUTH-RESET-01 shared descent truth contract (§4.3).
 * These fields are the canonical descent facts consumed by pass-core,
 * completion-state, and event-cycle.
 */
export interface SquatDescentTruthResult {
  /** True when meaningful descent was detected (global excursion >= threshold). */
  descentDetected: boolean;

  /** Timestamp (ms) of descent epoch start (last frame near baseline before peak). */
  descentStartAtMs: number | null;

  /** Timestamp (ms) of the peak depth frame (latest-equal-max anchored). */
  peakAtMs: number | null;

  /** Index within the input frames array of the peak frame. */
  peakIndex: number | null;

  /** Absolute depth value at the peak. */
  peakDepth: number;

  /** relativePeak = peakDepth − baseline (>= 0). */
  relativePeak: number;

  /**
   * Pre-peak frame count (frames before peakIndex).
   * §4.4: does NOT count per-frame increments — just the total pre-peak window size.
   */
  descentFrameCount: number;

  /**
   * Global pre-peak excursion = peakDepth − min(pre-peak depths).
   * §4.4: this is the global measure used instead of per-frame increments.
   * Valid for shallow reps where smoothing makes per-frame deltas < 0.002.
   */
  descentExcursion: number;

  /**
   * DESCENT-SPAN-RESET-01: Pre-peak descent duration (ms) = peakAtMs − descentStartAtMs.
   * Exposes the pass-relevant pre-peak span contract for pass-core alignment.
   * Non-null only when descentDetected=true (both timestamps are available).
   * Null in all blocked / no-frames paths.
   */
  descentToPeakSpanMs: number | null;

  /** Non-null when descentDetected=false. First reason why descent was not confirmed. */
  descentBlockedReason: string | null;

  /** Machine-readable trace string for real-device debugging. */
  trace: string;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * DESCENT-TRUTH-RESET-01: Compute the single shared squat descent truth.
 *
 * §4.4 Shallow descent: uses global pre-peak excursion (peakDepth − min pre-peak depth),
 *   not per-frame increment counting. A shallow rep with overall ~0.06 depth change is
 *   recognized even when smoothing makes individual steps < 0.002.
 *
 * §4.5 Peak tie law: scans all frames and uses the LATEST occurrence within
 *   PEAK_TIE_TOLERANCE of the global max. This preserves the maximum pre-peak
 *   descent window for reps where depth plateaus near the bottom.
 *
 * Pass-core, completion-state, and event-cycle must all consume this result
 * as the single authoritative descent truth.
 */
export function computeSquatDescentTruth(input: SquatDescentTruthInput): SquatDescentTruthResult {
  const { frames, baseline } = input;

  const noFrames: SquatDescentTruthResult = {
    descentDetected: false,
    descentStartAtMs: null,
    peakAtMs: null,
    peakIndex: null,
    peakDepth: 0,
    relativePeak: 0,
    descentFrameCount: 0,
    descentExcursion: 0,
    descentToPeakSpanMs: null,
    descentBlockedReason: 'no_frames',
    trace: 'frames=0|no_descent',
  };

  if (frames.length < 2) return noFrames;

  // ── Step 1: Find global maximum depth ──
  let globalMax = -Infinity;
  for (const f of frames) {
    if (f.depth > globalMax) globalMax = f.depth;
  }

  // ── Step 2: Latest-equal-max peak anchoring (§4.5) ──
  // Scan FORWARD through all frames.
  // Use the LAST frame within PEAK_TIE_TOLERANCE of the global max as the peak anchor.
  // This preserves the largest possible pre-peak window for shallow plateau reps.
  // Guard: peakIndex must be < frames.length - 1 to allow post-peak reversal scan.
  // If the very last frame equals the max, we still use it (reversal scan will just be empty).
  let peakIndex = -1;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i]!.depth >= globalMax - PEAK_TIE_TOLERANCE) {
      peakIndex = i;
    }
  }

  if (peakIndex < 0) {
    // Should never happen if frames.length >= 2 and globalMax was found
    return noFrames;
  }

  const peakFrame = frames[peakIndex]!;
  const peakDepth = peakFrame.depth;
  const relativePeak = Math.max(0, peakDepth - baseline);

  // ── Step 3: Pre-peak descent analysis ──
  const prePeak = frames.slice(0, peakIndex);
  const descentFrameCount = prePeak.length;

  // §4.4 Shallow descent compatibility: global excursion (not per-frame increments).
  // minPrePeakDepth = minimum depth in pre-peak window.
  // descentExcursion = peak - min(pre-peak) = total depth change actually achieved.
  const minPrePeakDepth =
    prePeak.length > 0 ? Math.min(...prePeak.map((f) => f.depth)) : baseline;
  const descentExcursion = Math.max(0, peakDepth - minPrePeakDepth);

  // ── Step 4: Descent detection gate ──
  // relativePeak >= threshold ensures meaningful global depth change from standing.
  // descentFrameCount >= 1 ensures there is at least one pre-peak frame (not first-frame spike).
  const descentDetected =
    relativePeak >= MIN_SHARED_DESCENT_RELATIVE_PEAK && descentFrameCount >= 1;

  if (!descentDetected) {
    const reason =
      relativePeak < MIN_SHARED_DESCENT_RELATIVE_PEAK
        ? 'insufficient_relative_peak'
        : 'no_pre_peak_frames';
    return {
      descentDetected: false,
      descentStartAtMs: null,
      peakAtMs: peakFrame.timestampMs,
      peakIndex,
      peakDepth,
      relativePeak,
      descentFrameCount,
      descentExcursion,
      descentToPeakSpanMs: null,
      descentBlockedReason: reason,
      trace: `peak=${r3(relativePeak)}|pIdx=${peakIndex}|frames=${descentFrameCount}|exc=${r3(descentExcursion)}|blocked=${reason}`,
    };
  }

  // ── Step 5: Descent epoch start ──
  // Scan backward from peak to find the last frame near baseline.
  // "Near baseline" = depth <= baseline + (relativePeak × DESCENT_EPOCH_REL_THRESHOLD).
  // This frames the start of the "active descent" epoch for cycle duration measurement.
  const epochThreshold = baseline + Math.max(0.005, relativePeak * DESCENT_EPOCH_REL_THRESHOLD);
  let descentStartAtMs: number | null =
    prePeak.length > 0 ? prePeak[0]!.timestampMs : null;

  for (let i = peakIndex; i >= 0; i--) {
    if (frames[i]!.depth <= epochThreshold) {
      descentStartAtMs = frames[i]!.timestampMs;
      break;
    }
  }

  return {
    descentDetected: true,
    descentStartAtMs,
    peakAtMs: peakFrame.timestampMs,
    peakIndex,
    peakDepth,
    relativePeak,
    descentFrameCount,
    descentExcursion,
    descentToPeakSpanMs: descentStartAtMs != null ? peakFrame.timestampMs - descentStartAtMs : null,
    descentBlockedReason: null,
    trace: `peak=${r3(relativePeak)}|pIdx=${peakIndex}|frames=${descentFrameCount}|exc=${r3(descentExcursion)}|desc=1`,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
