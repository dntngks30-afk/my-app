/**
 * PASS-WINDOW-RESET-01 / DESCENT-TRUTH-RESET-01: Squat pass authority core.
 *
 * This module is the ONLY owner of squat motion pass truth.
 * It derives pass truth from pass-window-owned inputs, NOT from completionFrames
 * or completion-state verdict fields.
 *
 * DESCENT-TRUTH-RESET-01 key change:
 *   Peak finding and descent detection are now delegated to the shared descent truth
 *   module (squat-descent-truth.ts). This eliminates the independent descent definition
 *   that previously diverged from completion-state and event-cycle.
 *   - Peak anchoring: latest-equal-max (§4.5) — preserves pre-peak descent window.
 *   - Descent check: global pre-peak excursion (§4.4) — not per-frame increments.
 *   - A pre-computed sharedDescentTruth may be injected via input (from evaluators/squat.ts)
 *     or computed internally if not provided (backward compat / direct call sites).
 *
 * Design contract (unchanged):
 * - Reads pass-window-owned depth stream + pass-window-owned baseline.
 * - Does NOT read: completionSatisfied, completionBlockedReason, official_shallow_cycle,
 *   low_rom_cycle, ultra_low_rom_cycle, canonical shallow contract, ultra-low policy.
 * - Setup bypass REMOVED: setup motion blocks pass unconditionally per SSOT §4.3.
 * - Cycle duration measured from descent epoch (not from stream start).
 *
 * After this module runs, downstream layers (evaluator, policy, UI) may:
 *   - classify (shallow / low / standard)
 *   - warn / explain
 *   - gate UI latch / celebration timing
 * but may NOT flip passDetected from true to false.
 *
 * References:
 *   docs/PASS_AUTHORITY_RESET_02_SSOT_20260404.md
 *   docs/PASS_WINDOW_RESET_01_SSOT_20260404.md
 *   docs/DESCENT_TRUTH_RESET_01_SSOT_20260404.md
 */

import {
  computeSquatDescentTruth,
  type SquatDescentTruthResult,
} from '@/lib/camera/squat/squat-descent-truth';

// ── Constants ─────────────────────────────────────────────────────────────────

// DESCENT-TRUTH-RESET-01: MIN_DESCENT_DEPTH_DELTA is no longer used for the primary
// descent gate — that is now owned by squat-descent-truth.ts (MIN_SHARED_DESCENT_RELATIVE_PEAK).
// Kept here only as a named reference constant in case future callers need it.
/** @deprecated Use computeSquatDescentTruth for descent checks. */
const MIN_DESCENT_DEPTH_DELTA = 0.025;

/** After peak, depth must decrease by >= REVERSAL_FRACTION × relativePeak to confirm reversal. */
const REVERSAL_FRACTION = 0.20;

/**
 * After reversal, depth must return to
 *   <= baselineStandingDepth + STANDING_RECOVERY_FRACTION × relativePeak
 * to confirm standing recovery.
 */
const STANDING_RECOVERY_FRACTION = 0.40;

/**
 * Peak must be sustained by >= MIN_PEAK_HOLD_FRAMES frames within the
 * PEAK_NEIGHBORHOOD_FRACTION band of the peak (anti-single-spike).
 */
const MIN_PEAK_HOLD_FRAMES = 2;

/** Depth tolerance band for "near peak": max(PEAK_NEIGHBORHOOD_FLOOR, relativePeak × this). */
const PEAK_NEIGHBORHOOD_FRACTION = 0.15;
const PEAK_NEIGHBORHOOD_FLOOR = 0.004;

/** Minimum total cycle duration (ms) — blocks micro-bounces / too-fast dips. */
const MIN_CYCLE_DURATION_MS = 350;

/** Maximum total cycle duration (ms). */
const MAX_CYCLE_DURATION_MS = 14000;

/** Maximum reversal-to-standing time (ms) — anti-cross-rep ownership. */
const MAX_REVERSAL_TO_STANDING_MS = 10000;

/** Minimum depth frame count for evaluation. */
const MIN_DEPTH_FRAMES = 4;

/**
 * PASS-WINDOW-RESET-01: cycle duration is measured from the descent epoch start.
 * Kept as a named constant for documentation. The actual epoch start is now
 * computed by squat-descent-truth.ts (DESCENT-TRUTH-RESET-01).
 * @deprecated epoch computation delegated to squat-descent-truth.ts
 */
const DESCENT_EPOCH_REL_THRESHOLD = 0.10;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Single depth sample from the pass window. */
export interface SquatPassCoreDepthFrame {
  /** Raw or blended squatDepthProxy value. */
  depth: number;
  /** Frame timestamp (ms). */
  timestampMs: number;
}

/**
 * PASS-WINDOW-RESET-01 / DESCENT-TRUTH-RESET-01 pass-core input.
 * Primary authority source: depthFrames from pass-window.ts + passWindowBaseline.
 * completionFrames and completion-state verdict fields are NOT inputs.
 */
export interface SquatPassCoreInput {
  /**
   * Depth stream from the pass window (full valid stream, not arming-clipped completionFrames).
   * PRIMARY AUTHORITY SOURCE — provided by pass-window.ts.
   */
  depthFrames: SquatPassCoreDepthFrame[];

  /**
   * Pass-window-owned baseline: min depth of first 8 valid frames (readiness dwell standing).
   * NOT completion-state.baselineStandingDepth. Owned by pass-window.ts.
   */
  baselineStandingDepth: number;

  /** True when evaluator detected setup camera motion in the capture window. */
  setupMotionBlocked: boolean;

  /** Human-readable reason for setup block (trace only). */
  setupMotionBlockReason: string | null;

  /**
   * DESCENT-TRUTH-RESET-01: Pre-computed shared descent truth from squat-descent-truth.ts.
   * When provided (injected by evaluators/squat.ts), pass-core uses this for peak anchoring
   * and descent detection instead of computing them independently. This makes pass-core
   * a consumer of the shared descent truth rather than an independent descent authority.
   * When not provided, pass-core computes descent truth internally (backward compat).
   */
  sharedDescentTruth?: SquatDescentTruthResult;

  /**
   * Optional trace hints from completion state — NOT final authority.
   * May be undefined for shallow reps where completion machine did not close. Expected.
   */
  descendConfirmed?: boolean;
  downwardCommitmentDelta?: number;
  squatReversalToStandingMs?: number;
  descendStartAtMs?: number;
  /** Completion machine reversal/standing timestamps — may be undefined for shallow. Trace only. */
  completionStateReversalAtMs?: number;
  completionStateStandingAtMs?: number;
  cycleDurationMs?: number;
}

/** RESET-02 pass-core result — per PASS_AUTHORITY_RESET_02_SSOT_20260404 §7. */
export interface SquatPassCoreResult {
  /**
   * SINGLE MOTION PASS AUTHORITY.
   * true = valid squat rep happened (meaningful descent → reversal → standing recovery,
   *        same rep, setup clear, anti-spike clear).
   * Once true, no downstream module may set this to false.
   */
  passDetected: boolean;

  /** Null when passDetected=true. First blocking reason when false. */
  passBlockedReason: string | null;

  /**
   * Lightweight rep ID derived from standing recovery timestamp.
   * Non-null only when passDetected=true.
   */
  repId: string | null;

  // ── Gate results (per RESET-02 SSOT §7) ──
  setupClear: boolean;
  readinessClear: boolean;
  baselineEstablished: boolean;
  peakLatched: boolean;

  descentDetected: boolean;
  reversalDetected: boolean;
  standingRecovered: boolean;

  sameRepOwnershipClear: boolean;
  antiSpikeClear: boolean;
  /** Raw setup-motion check (before bypass). antiSetupClear = !setupMotionBlocked. */
  antiSetupClear: boolean;

  // ── Timing (derived from depth stream) ──
  descentStartAtMs?: number;
  peakAtMs?: number;
  reversalAtMs?: number;
  standingRecoveredAtMs?: number;
  cycleDurationMs?: number;

  // ── Depth observability ──
  depthPeak?: number;

  /** Machine-readable trace string for device debugging. */
  trace: string;
}

// ── Implementation ────────────────────────────────────────────────────────────

interface BuildResultArgs {
  passDetected: boolean;
  passBlockedReason: string | null;
  readinessClear: boolean;
  baselineEstablished: boolean;
  peakLatched: boolean;
  descentDetected: boolean;
  reversalDetected: boolean;
  standingRecovered: boolean;
  sameRepOwnershipClear: boolean;
  antiSpikeClear: boolean;
  antiSetupClear: boolean;
  setupClear: boolean;
  descentStartAtMs?: number;
  peakAtMs?: number;
  reversalAtMs?: number;
  standingRecoveredAtMs?: number;
  cycleDurationMs?: number;
  depthPeak?: number;
  input: SquatPassCoreInput;
}

function buildResult(args: BuildResultArgs): SquatPassCoreResult {
  const {
    passDetected,
    passBlockedReason,
    readinessClear,
    baselineEstablished,
    peakLatched,
    descentDetected,
    reversalDetected,
    standingRecovered,
    sameRepOwnershipClear,
    antiSpikeClear,
    antiSetupClear,
    setupClear,
    descentStartAtMs,
    peakAtMs,
    reversalAtMs,
    standingRecoveredAtMs,
    cycleDurationMs,
    depthPeak,
    input,
  } = args;

  const trace = [
    `ready=${readinessClear ? 1 : 0}`,
    `baseline=${baselineEstablished ? 1 : 0}`,
    `desc=${descentDetected ? 1 : 0}`,
    `peak=${peakLatched ? 1 : 0}`,
    `rev=${reversalDetected ? 1 : 0}`,
    `stand=${standingRecovered ? 1 : 0}`,
    `spike=${antiSpikeClear ? 1 : 0}`,
    `own=${sameRepOwnershipClear ? 1 : 0}`,
    `setup=${setupClear ? 1 : 0}`,
    `pass=${passDetected ? 1 : 0}`,
    passBlockedReason != null ? `blocked=${passBlockedReason}` : null,
    depthPeak != null ? `peak_d=${Math.round(depthPeak * 1000) / 1000}` : null,
    cycleDurationMs != null ? `cycle=${cycleDurationMs}ms` : null,
    input.descendConfirmed != null ? `cs_desc=${input.descendConfirmed ? 1 : 0}` : null,
  ]
    .filter(Boolean)
    .join('|');

  return {
    passDetected,
    passBlockedReason,
    repId: passDetected ? `rep_${standingRecoveredAtMs ?? 0}` : null,
    setupClear,
    readinessClear,
    baselineEstablished,
    peakLatched,
    descentDetected,
    reversalDetected,
    standingRecovered,
    sameRepOwnershipClear,
    antiSpikeClear,
    antiSetupClear,
    descentStartAtMs,
    peakAtMs,
    reversalAtMs,
    standingRecoveredAtMs,
    cycleDurationMs,
    depthPeak,
    trace,
  };
}

/**
 * PASS-WINDOW-RESET-01 / DESCENT-TRUTH-RESET-01: Derive immutable squat pass truth.
 *
 * Called by evaluators/squat.ts BEFORE applyUltraLowPolicyLock and late-setup annotation.
 * The result is stored in evaluatorResult.debug.squatPassCore and consumed by auto-progression.
 *
 * DESCENT-TRUTH-RESET-01 key change:
 *   Peak finding and descent detection now delegate to computeSquatDescentTruth (shared).
 *   input.sharedDescentTruth is pre-computed by evaluators/squat.ts and injected here so that
 *   pass-core, completion-state, and event-cycle all use the SAME descent truth.
 *   If not provided, computed freshly (backward compat).
 *
 * Hard pass criteria (all must be true in one continuous depth stream):
 *  1. Sufficient depth frames + valid baseline (readiness)
 *  2. Meaningful descent: shared descent truth detects descent (global excursion >= 0.025)
 *  3. Peak sustained >= MIN_PEAK_HOLD_FRAMES (anti-single-spike), peak not first frame
 *  4. Reversal: depth decreased by >= REVERSAL_FRACTION × relativePeak after peak
 *  5. Standing recovery: depth returned to <= baseline + STANDING_RECOVERY_FRACTION × relativePeak
 *  6. Anti-spike timing: cycle >= MIN_CYCLE_DURATION_MS and <= MAX_CYCLE_DURATION_MS
 *     (cycle measured from descent epoch start)
 *  7. Same-rep ownership: reversal-to-standing <= MAX_REVERSAL_TO_STANDING_MS
 *  8. Setup clear — NO BYPASS: setup motion blocks pass unconditionally
 */
export function evaluateSquatPassCore(input: SquatPassCoreInput): SquatPassCoreResult {
  const { depthFrames, baselineStandingDepth, setupMotionBlocked, setupMotionBlockReason } = input;

  const antiSetupClear = !setupMotionBlocked;

  // ── 1. Readiness / baseline ──
  const readinessClear = depthFrames.length >= MIN_DEPTH_FRAMES;
  const baselineEstablished =
    typeof baselineStandingDepth === 'number' &&
    Number.isFinite(baselineStandingDepth) &&
    baselineStandingDepth >= 0;

  if (!readinessClear || !baselineEstablished) {
    return buildResult({
      passDetected: false,
      passBlockedReason: !readinessClear ? 'insufficient_depth_frames' : 'baseline_not_established',
      readinessClear,
      baselineEstablished,
      peakLatched: false,
      descentDetected: false,
      reversalDetected: false,
      standingRecovered: false,
      sameRepOwnershipClear: false,
      antiSpikeClear: false,
      antiSetupClear,
      setupClear: false,
      input,
    });
  }

  // ── DESCENT-TRUTH-RESET-01: use shared descent truth ──
  // Use pre-computed sharedDescentTruth when provided (injected by evaluators/squat.ts).
  // Fall back to fresh computation when called directly (backward compat / tests).
  // This makes pass-core a consumer of the shared descent authority, not an independent owner.
  const descentTruth: SquatDescentTruthResult =
    input.sharedDescentTruth ??
    computeSquatDescentTruth({ frames: depthFrames, baseline: baselineStandingDepth });

  const peakIndex = descentTruth.peakIndex ?? 0;
  const peakDepth = descentTruth.peakDepth;
  const peakTs =
    descentTruth.peakAtMs ?? depthFrames[peakIndex]!.timestampMs;
  const relativePeak = descentTruth.relativePeak;
  // Descent epoch start: from shared truth (latest-equal-max anchored, epoch threshold applied).
  const descentEpochStartTs =
    descentTruth.descentStartAtMs ?? depthFrames[0]!.timestampMs;

  // ── 3. Descent check (delegated to shared descent truth) ──
  const descentDetected = descentTruth.descentDetected;

  if (!descentDetected) {
    return buildResult({
      passDetected: false,
      passBlockedReason: descentTruth.descentBlockedReason ?? 'no_meaningful_descent',
      readinessClear,
      baselineEstablished,
      peakLatched: false,
      descentDetected: false,
      reversalDetected: false,
      standingRecovered: false,
      sameRepOwnershipClear: false,
      antiSpikeClear: false,
      antiSetupClear,
      setupClear: false,
      peakAtMs: peakTs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── 4. Peak hold (anti-single-spike) ──
  // Peak must be present in >= MIN_PEAK_HOLD_FRAMES frames near the top,
  // and peak cannot be the very first frame (there must be some descent before it).
  const peakNeighborhood = Math.max(PEAK_NEIGHBORHOOD_FLOOR, relativePeak * PEAK_NEIGHBORHOOD_FRACTION);
  const peakThreshold = peakDepth - peakNeighborhood;
  let peakHoldFrames = 0;
  for (let i = 0; i < depthFrames.length; i++) {
    if (depthFrames[i]!.depth >= peakThreshold) peakHoldFrames++;
  }
  const peakLatched = peakHoldFrames >= MIN_PEAK_HOLD_FRAMES && peakIndex > 0;

  if (!peakLatched) {
    return buildResult({
      passDetected: false,
      passBlockedReason: 'peak_not_latched',
      readinessClear,
      baselineEstablished,
      peakLatched: false,
      descentDetected,
      reversalDetected: false,
      standingRecovered: false,
      sameRepOwnershipClear: false,
      antiSpikeClear: false,
      antiSetupClear,
      setupClear: false,
      peakAtMs: peakTs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── 5. Reversal check (after peak) ──
  // Depth must decrease by >= REVERSAL_FRACTION × relativePeak from the peak.
  const reversalDropRequired = relativePeak * REVERSAL_FRACTION;
  let reversalAtMs: number | undefined;
  let reversalDetected = false;
  let fullReversalIndex = -1;

  for (let i = peakIndex + 1; i < depthFrames.length; i++) {
    const drop = peakDepth - depthFrames[i]!.depth;
    // Mark the halfway point as the estimated reversal-start timestamp.
    if (reversalAtMs === undefined && drop >= reversalDropRequired * 0.5) {
      reversalAtMs = depthFrames[i]!.timestampMs;
    }
    if (drop >= reversalDropRequired) {
      reversalDetected = true;
      fullReversalIndex = i;
      break;
    }
  }

  if (!reversalDetected) {
    return buildResult({
      passDetected: false,
      passBlockedReason: 'no_reversal_after_peak',
      readinessClear,
      baselineEstablished,
      peakLatched,
      descentDetected,
      reversalDetected: false,
      standingRecovered: false,
      sameRepOwnershipClear: false,
      antiSpikeClear: false,
      antiSetupClear,
      setupClear: false,
      peakAtMs: peakTs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── 6. Standing recovery check ──
  // After reversal, depth must return to <= baseline + STANDING_RECOVERY_FRACTION × relativePeak.
  const standingThreshold = baselineStandingDepth + STANDING_RECOVERY_FRACTION * relativePeak;
  let standingRecovered = false;
  let standingRecoveredAtMs: number | undefined;
  const scanStart = fullReversalIndex >= 0 ? fullReversalIndex : peakIndex + 1;

  for (let i = scanStart; i < depthFrames.length; i++) {
    if (depthFrames[i]!.depth <= standingThreshold) {
      standingRecovered = true;
      standingRecoveredAtMs = depthFrames[i]!.timestampMs;
      break;
    }
  }

  if (!standingRecovered) {
    return buildResult({
      passDetected: false,
      passBlockedReason: 'no_standing_recovery',
      readinessClear,
      baselineEstablished,
      peakLatched,
      descentDetected,
      reversalDetected,
      standingRecovered: false,
      sameRepOwnershipClear: false,
      antiSpikeClear: false,
      antiSetupClear,
      setupClear: false,
      peakAtMs: peakTs,
      reversalAtMs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── 7. Anti-spike timing (cycle duration) ──
  // PASS-WINDOW-RESET-01: measure from descent epoch start, not stream start.
  // With the wider valid stream, descentEpochStartTs ≈ when person started moving from standing.
  const cycleDurationMs =
    standingRecoveredAtMs != null
      ? standingRecoveredAtMs - descentEpochStartTs
      : depthFrames[depthFrames.length - 1]!.timestampMs - descentEpochStartTs;

  const antiSpikeClear =
    peakLatched &&
    cycleDurationMs >= MIN_CYCLE_DURATION_MS &&
    cycleDurationMs <= MAX_CYCLE_DURATION_MS;

  if (!antiSpikeClear) {
    const reason =
      cycleDurationMs < MIN_CYCLE_DURATION_MS
        ? 'cycle_too_short'
        : cycleDurationMs > MAX_CYCLE_DURATION_MS
          ? 'cycle_too_long'
          : 'peak_not_latched';
    return buildResult({
      passDetected: false,
      passBlockedReason: reason,
      readinessClear,
      baselineEstablished,
      peakLatched,
      descentDetected,
      reversalDetected,
      standingRecovered,
      sameRepOwnershipClear: false,
      antiSpikeClear: false,
      antiSetupClear,
      setupClear: false,
      peakAtMs: peakTs,
      reversalAtMs,
      standingRecoveredAtMs,
      cycleDurationMs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── 8. Same-rep ownership (reversal-to-standing timing) ──
  const reversalToStandingMs =
    reversalAtMs != null && standingRecoveredAtMs != null
      ? standingRecoveredAtMs - reversalAtMs
      : undefined;

  const sameRepOwnershipClear =
    reversalToStandingMs == null || reversalToStandingMs <= MAX_REVERSAL_TO_STANDING_MS;

  if (!sameRepOwnershipClear) {
    return buildResult({
      passDetected: false,
      passBlockedReason: 'same_rep_ownership_broken',
      readinessClear,
      baselineEstablished,
      peakLatched,
      descentDetected,
      reversalDetected,
      standingRecovered,
      sameRepOwnershipClear: false,
      antiSpikeClear,
      antiSetupClear,
      setupClear: false,
      peakAtMs: peakTs,
      reversalAtMs,
      standingRecoveredAtMs,
      cycleDurationMs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── 9. Setup gate — NO BYPASS (PASS-WINDOW-RESET-01 §4.3) ──
  // Setup motion blocks pass unconditionally.
  // Rationale: if setup motion was detected in the valid stream, the depth cycle may be
  // caused by or contaminated by the framing change, not by a genuine squat rep.
  // A pass may only open after a stable ready segment and a full same-rep cycle after that.
  // The allMotionGatesClear bypass from RESET-02 is removed here.
  const setupClear = !setupMotionBlocked;

  if (!setupClear) {
    return buildResult({
      passDetected: false,
      passBlockedReason: `setup_motion_blocked:${setupMotionBlockReason ?? 'blocked'}`,
      readinessClear,
      baselineEstablished,
      peakLatched,
      descentDetected,
      reversalDetected,
      standingRecovered,
      sameRepOwnershipClear,
      antiSpikeClear,
      antiSetupClear: false,
      setupClear: false,
      peakAtMs: peakTs,
      reversalAtMs,
      standingRecoveredAtMs,
      cycleDurationMs,
      depthPeak: peakDepth,
      input,
    });
  }

  // ── PASS ──
  // descentStartAtMs: use descent epoch start for accurate trace (PASS-WINDOW-RESET-01).
  const descentStartAtMs = descentEpochStartTs;
  return buildResult({
    passDetected: true,
    passBlockedReason: null,
    readinessClear,
    baselineEstablished,
    peakLatched,
    descentDetected,
    reversalDetected,
    standingRecovered,
    sameRepOwnershipClear,
    antiSpikeClear,
    antiSetupClear,
    setupClear,
    descentStartAtMs,
    peakAtMs: peakTs,
    reversalAtMs,
    standingRecoveredAtMs,
    cycleDurationMs,
    depthPeak: peakDepth,
    input,
  });
}
