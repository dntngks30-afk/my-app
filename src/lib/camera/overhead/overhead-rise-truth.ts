/**
 * OVERHEAD REACH — RISE TRUTH OWNER (PR-02)
 *
 * Reference: docs/ssot/OVERHEAD_REACH_SSOT_20260405_R2.md §6.1, §5 Bottleneck A
 * Vocabulary: src/lib/camera/overhead/overhead-truth-vocabulary.ts
 *
 * This module owns `meaningfulRiseSatisfied` and `riseStartedAtMs` for overhead reach.
 * It replaces fragile per-frame `raiseCount` (phaseHint='raise' counter) with a
 * baseline-relative elevation-travel check that is robust to slow, smooth lifting.
 *
 * ── Rationale ────────────────────────────────────────────────────────────────
 * Previous implementation (`raiseCount > 0`) only required ONE frame with an
 * arm-elevation delta > 2.2° between consecutive smoothed frames. This fails for:
 *   - Slow, smooth upward lifting (smoothing at α=0.42 reduces per-frame delta)
 *   - Already-high starting posture that drifts slightly upward
 *
 * This module checks: did the user raise their arm ≥ MIN_RISE_DELTA_DEG above
 * their starting (baseline) position? This is:
 *   - Robust to slow lifting (cumulative travel, not per-frame delta)
 *   - Immune to already-high starting posture (delta vs. baseline)
 *   - Immune to micro-sways (< MIN_RISE_DELTA_DEG travel)
 *   - Immune to passive oscillation at top (baseline already near top → delta small)
 *
 * ── Product law preserved ─────────────────────────────────────────────────────
 * What must still satisfy rise truth:
 *   - Real upward raise from a low/normal starting position
 *   - Slow or fast — doesn't matter, only total travel matters
 *
 * What must NOT satisfy rise truth:
 *   - Already-high starting posture with tiny additional upward drift
 *   - Micro arm sway / noise (< 20° above baseline)
 *   - Setup readiness motion that doesn't establish real upward travel
 *   - Passive oscillation around top when baseline was already near top
 *
 * ── Scope ─────────────────────────────────────────────────────────────────────
 * Overhead-only. Do NOT import from squat modules. Do NOT alter squat behavior.
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Minimum arm elevation gain above baseline required for a "meaningful rise".
 * Must be ≥ this many degrees above starting position.
 *
 * Value aligned with OVERHEAD_LOW_ROM_REQUIRED_DELTA_FROM_BASELINE_DEG = 20
 * so that the rise gate is consistent with the low-ROM progression path.
 *
 * Do NOT set this below 15° — micro-sways and arm noise can produce that much drift.
 * Do NOT set this above 30° — would block real short-ROM raises.
 */
export const OVERHEAD_RISE_MIN_DELTA_DEG = 20;

/**
 * Threshold above baseline to detect rise start.
 * When arm crosses baseline + this value, rise is considered to have started.
 * Used for `riseStartedAtMs` only — not a pass gate.
 */
const RISE_START_THRESHOLD_DEG = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverheadRiseTruthInput {
  /**
   * Valid frames only (isValid=true), in temporal order.
   * The baseline is computed from the first BASELINE_FRAMES of this array.
   * Rise detection uses the full array.
   */
  validFrames: readonly Pick<PoseFeaturesFrame, 'derived' | 'timestampMs'>[];
  /**
   * Pre-computed arm baseline elevation (degrees) — initial starting position.
   * Should be computed from the first N valid frames (e.g. mean of first 6).
   * Provided externally to ensure consistency with other paths that use the same baseline.
   */
  baselineArmDeg: number;
}

export interface OverheadRiseTruthResult {
  /**
   * True when the arm rose ≥ OVERHEAD_RISE_MIN_DELTA_DEG above baselineArmDeg.
   * This is the PR-01 vocabulary field `OverheadCompletionTruth.meaningfulRiseSatisfied`.
   */
  meaningfulRiseSatisfied: boolean;

  /**
   * Timestamp when arm first crossed baselineArmDeg + RISE_START_THRESHOLD_DEG.
   * Represents when the user first started raising their arms.
   * undefined if arm never clearly rose above baseline.
   * This is the PR-01 vocabulary field `OverheadCompletionTruth.riseStartedAtMs`.
   */
  riseStartedAtMs: number | undefined;

  /**
   * Net elevation gain from baseline to peak (degrees).
   * peakArmElevation - baselineArmDeg.
   * Negative or zero means arm never exceeded baseline.
   */
  riseElevationDeltaFromBaseline: number;

  /** Starting arm position used as rise baseline (degrees). */
  baselineArmDeg: number;

  /** Highest arm elevation observed in the session (degrees). */
  peakArmElevation: number;

  /**
   * Why rise was not satisfied, or null if satisfied.
   * Motion-only reason — no UI/runtime gate reasoning.
   *
   * Possible values:
   * - 'no_elevation_gain_above_baseline' — arm never exceeded baseline
   * - 'rise_delta_too_small'             — some gain but < OVERHEAD_RISE_MIN_DELTA_DEG
   * - null                               — satisfied
   */
  riseBlockedReason: 'no_elevation_gain_above_baseline' | 'rise_delta_too_small' | null;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Compute overhead rise truth from accumulated valid frames.
 *
 * Algorithm:
 * 1. Find peak arm elevation across all valid frames.
 * 2. Compute elevation delta = peak - baseline.
 * 3. If delta >= OVERHEAD_RISE_MIN_DELTA_DEG, rise is meaningful.
 * 4. Find first frame where elevation crossed baseline + RISE_START_THRESHOLD_DEG
 *    to provide riseStartedAtMs timestamp.
 *
 * This is called on every evaluator update (frame accumulation). Result will
 * transition from meaningfulRiseSatisfied=false to true as the user raises arms.
 */
export function computeOverheadRiseTruth(
  input: OverheadRiseTruthInput
): OverheadRiseTruthResult {
  const { validFrames, baselineArmDeg } = input;

  // Find peak arm elevation across all valid frames
  let peakArmElevation = 0;
  for (const f of validFrames) {
    const e = f.derived.armElevationAvg;
    if (typeof e === 'number' && e > peakArmElevation) {
      peakArmElevation = e;
    }
  }

  const elevationDelta = peakArmElevation - baselineArmDeg;
  const meaningfulRiseSatisfied = elevationDelta >= OVERHEAD_RISE_MIN_DELTA_DEG;

  // Find first frame where rise started (first crossing of baseline + threshold)
  const riseStartThreshold = baselineArmDeg + RISE_START_THRESHOLD_DEG;
  let riseStartedAtMs: number | undefined;
  for (const f of validFrames) {
    const e = f.derived.armElevationAvg;
    if (typeof e === 'number' && e > riseStartThreshold) {
      riseStartedAtMs = f.timestampMs;
      break;
    }
  }

  let riseBlockedReason: OverheadRiseTruthResult['riseBlockedReason'] = null;
  if (!meaningfulRiseSatisfied) {
    if (elevationDelta <= 0) {
      riseBlockedReason = 'no_elevation_gain_above_baseline';
    } else {
      riseBlockedReason = 'rise_delta_too_small';
    }
  }

  return {
    meaningfulRiseSatisfied,
    riseStartedAtMs,
    riseElevationDeltaFromBaseline: elevationDelta,
    baselineArmDeg,
    peakArmElevation,
    riseBlockedReason,
  };
}
