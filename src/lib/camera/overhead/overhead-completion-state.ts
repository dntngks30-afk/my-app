/**
 * OVERHEAD REACH — COMPLETION TRUTH LAYER
 *
 * PR-SIMPLE-PASS-01: Resets completion to one simple best-side rise-plus-hold owner.
 *
 * Product law: "pass easy, judge strictly."
 *   - Pass = meaningful best-side rise + best-side absolute floor + 1000ms dwell
 *   - Quality (asymmetry, strict 132° floor, stability, control) = interpretation only
 *
 * Vocabulary: src/lib/camera/overhead/overhead-truth-vocabulary.ts
 *
 * THIS MODULE MUST NOT INCLUDE:
 *   - confidence threshold
 *   - capture quality invalid vs low
 *   - pass confirmation window
 *   - UI latch / auto-advance
 *   - retry vs fail routing
 *   - voice playback state
 *
 * Final pass decision (Layer 2) lives in isFinalPassLatched() in auto-progression.ts.
 * Interpretation truth (Layer 3) lives in computeOverheadInternalQuality().
 *
 * WHAT CHANGED IN PR-SIMPLE-PASS-01 vs. prior:
 *   - Asymmetry is NO LONGER a completion gate — quality-only
 *   - Strict 132° top floor is NO LONGER a completion gate — quality-only
 *   - peakCount / stableTopEntry are NO LONGER completion gates — observability
 *   - fallbackTopHold is NO LONGER a completion path — debug compat only
 *   - NEW gate: best-side elevation >= 100° + 1000ms dwell
 */
import { OVERHEAD_REQUIRED_HOLD_MS } from './overhead-constants';
import type { MotionCompletionResult } from '@/lib/camera/types/motion-completion';
import type { OverheadTopHoldFallbackResult } from './overhead-top-hold-fallback';

// ── Simple pass constants ──────────────────────────────────────────────────────

/**
 * PR-SIMPLE-PASS-01: Best-side arm minimum absolute elevation for the simple pass owner.
 * Best-side peak must reach this value for the attempt to be considered a genuine raise.
 * Blocks shrugs (≈60-90°), half-raises, and random noise.
 */
const SIMPLE_PASS_BEST_SIDE_ABSOLUTE_FLOOR_DEG = 100;

/**
 * PR-SIMPLE-PASS-01: Required dwell duration at/above the simple pass floor (ms).
 * 1000ms is enough to confirm an intentional hold without requiring strict 1200ms dwell.
 * Still safely above transient spikes (< 200ms) and casual arm swings.
 */
const SIMPLE_PASS_REQUIRED_HOLD_MS = 1000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type OverheadCompletionMachinePhase =
  | 'idle'
  | 'raising'
  | 'top_unstable'
  | 'stable_top'
  | 'holding'
  | 'completed';

export type OverheadCompletionPassReason = 'top_hold_met' | 'not_confirmed';

export interface OverheadCompletionInput {
  /**
   * Legacy raise-frame counter (phaseHint='raise' frames).
   * Still consumed by `derivePhase` for the 'raising' phase label.
   * NOT a completion gate in PR-SIMPLE-PASS-01.
   */
  raiseCount: number;
  /** Kept for observability. NOT a completion gate. */
  peakCount: number;
  /** Kept for observability (strict avg-elevation peak). NOT a completion gate. */
  peakArmElevationDeg: number;
  armRangeAvgDeg: number;
  /** Strict stable-top dwell at 132° — observability only, NOT a completion gate. */
  holdDurationMs: number;
  topDetectedAtMs?: number;
  stableTopEnteredAtMs?: number;
  holdArmedAtMs?: number;
  holdAccumulationStartedAtMs?: number;
  holdArmingBlockedReason: string | null;
  /**
   * QUALITY-ONLY — NOT a pass gate in PR-SIMPLE-PASS-01.
   * Asymmetry data remains in the quality interpretation layer.
   */
  meanAsymmetryDeg: number | null;
  /**
   * QUALITY-ONLY — NOT a pass gate in PR-SIMPLE-PASS-01.
   */
  maxAsymmetryDeg: number | null;
  /**
   * PR-02: robust rise truth from overhead-rise-truth.ts.
   * When true, the user demonstrably raised their best-side arm ≥ OVERHEAD_RISE_MIN_DELTA_DEG
   * above their starting (baseline) position.
   */
  meaningfulRiseSatisfied: boolean;
  /**
   * PR-02: timestamp when meaningful rise first started.
   * Observability only — not a pass gate.
   */
  riseStartedAtMs?: number;
  /**
   * PR-CAM-11A: jitter-tolerant fallback result.
   * DEBUG/COMPAT ONLY in PR-SIMPLE-PASS-01 — no longer a completion gate.
   */
  fallbackTopHold?: OverheadTopHoldFallbackResult;
  /**
   * PR-SIMPLE-PASS-01: Best-side peak arm elevation (deg).
   * max(armElevationLeft, armElevationRight) peak across valid frames.
   * Primary absolute floor check in the simple completion owner.
   */
  bestSideElevationDeg: number;
  /**
   * PR-SIMPLE-PASS-01: Dwell duration (ms) while best-side elevation >= 100°.
   * Primary hold requirement in the simple completion owner (>= 1000ms to pass).
   */
  simplePassHoldMs: number;
}

export interface OverheadCompletionState extends MotionCompletionResult {
  topDetected: boolean;
  stableTopEntry: boolean;
  holdStarted: boolean;
  holdDurationMs: number;
  /** Strict 1200ms hold at 132° — observability only. */
  holdSatisfied: boolean;
  /** Motion candidate — guardrail·confidence combine after. */
  passLatchedCandidate: boolean;
  completionMachinePhase: OverheadCompletionMachinePhase;
  completionPassReason: OverheadCompletionPassReason;
  /** Kept for compat — no longer a completion gate in PR-SIMPLE-PASS-01. */
  fallbackTopHoldSatisfied: boolean;
  /**
   * PR-SIMPLE-PASS-01: always 'strict' when passed (single owner).
   * null = not passed.
   */
  completionPath: 'strict' | 'fallback' | null;
  /**
   * PR-02: whether the user made a meaningful best-side rise.
   */
  meaningfulRiseSatisfied: boolean;
  /**
   * PR-02: timestamp when meaningful rise first started, or undefined if not detected.
   */
  riseStartedAtMs: number | undefined;
}

function derivePhase(s: {
  raiseCount: number;
  topDetected: boolean;
  stableTopEntry: boolean;
  holdStarted: boolean;
  holdSatisfied: boolean;
  completionSatisfied: boolean;
}): OverheadCompletionMachinePhase {
  if (s.completionSatisfied) return 'completed';
  if (s.holdStarted && !s.holdSatisfied) return 'holding';
  if (s.stableTopEntry) return 'stable_top';
  if (s.topDetected) return 'top_unstable';
  if (s.raiseCount > 0) return 'raising';
  return 'idle';
}

/**
 * PR-SIMPLE-PASS-01: Single simple completion owner.
 *
 * Pass requires ALL of:
 *   1. meaningfulRiseSatisfied — best-side arm traveled ≥ 15° above baseline
 *   2. bestSideElevationDeg >= 100° — minimum usable absolute raise
 *   3. simplePassHoldMs >= 1000ms — intentional hold at the top-near zone
 *
 * Asymmetry, strict 132° floor, stableTopEntry, peakCount:
 *   → QUALITY LAYER only. Not completion gates.
 */
export function evaluateOverheadCompletionState(
  input: OverheadCompletionInput
): OverheadCompletionState {
  const topDetected = input.topDetectedAtMs != null;
  const stableTopEntry = input.stableTopEnteredAtMs != null;
  const holdStarted =
    input.holdArmedAtMs != null && input.holdAccumulationStartedAtMs != null;
  const holdDurationMs = Math.max(0, input.holdDurationMs);
  // holdSatisfied = strict 1200ms dwell at 132° — observability only
  const holdSatisfied = holdStarted && holdDurationMs >= OVERHEAD_REQUIRED_HOLD_MS;

  // ── PR-SIMPLE-PASS-01: Single simple completion owner ──────────────────────
  // Pass = meaningful best-side rise + best-side >= 100° + 1000ms dwell.
  // Asymmetry, 132° strict floor, stable-top entry are NOT completion gates.
  let completionBlockedReason: string | null = null;

  if (!input.meaningfulRiseSatisfied) {
    completionBlockedReason = 'raise_not_satisfied';
  } else if (input.bestSideElevationDeg < SIMPLE_PASS_BEST_SIDE_ABSOLUTE_FLOOR_DEG) {
    completionBlockedReason = 'insufficient_elevation';
  } else if (input.simplePassHoldMs < SIMPLE_PASS_REQUIRED_HOLD_MS) {
    completionBlockedReason = 'hold_short';
  }

  // fallbackTopHold kept for compat/debug — no longer a completion gate
  const fallbackTopHoldSatisfied = input.fallbackTopHold?.fallbackSatisfied === true;
  const completionPath: 'strict' | 'fallback' | null =
    completionBlockedReason == null ? 'strict' : null;

  const completionSatisfied = completionBlockedReason == null;
  const passLatchedCandidate = completionSatisfied;
  const completionPassReason: OverheadCompletionPassReason = completionSatisfied
    ? 'top_hold_met'
    : 'not_confirmed';

  const completionMachinePhase = derivePhase({
    raiseCount: input.raiseCount,
    topDetected,
    stableTopEntry,
    holdStarted,
    holdSatisfied,
    completionSatisfied,
  });

  return {
    topDetected,
    stableTopEntry,
    holdStarted,
    holdDurationMs,
    holdSatisfied,
    passLatchedCandidate,
    completionSatisfied,
    completionBlockedReason,
    completionMachinePhase,
    completionPassReason,
    fallbackTopHoldSatisfied,
    completionPath,
    meaningfulRiseSatisfied: input.meaningfulRiseSatisfied,
    riseStartedAtMs: input.riseStartedAtMs,
  };
}
