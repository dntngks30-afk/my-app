/**
 * PASS-WINDOW-RESET-01 / DESCENT-TRUTH-RESET-01 / REVERSAL-STANDING-RESET-01:
 * Squat pass authority core.
 *
 * This module is the ONLY owner of squat motion pass truth.
 * It derives pass truth from pass-window-owned inputs, NOT from completionFrames
 * or completion-state verdict fields.
 *
 * REVERSAL-STANDING-RESET-01 key changes:
 *   Reversal is now confirmed only after a STRUCTURED post-peak ascent segment
 *   (MIN_REVERSAL_FRAMES consecutive ascending frames), not on a single scalar
 *   threshold crossing. Standing recovery scan starts strictly AFTER the reversal
 *   confirmation index, making same-frame reversal+standing structurally impossible.
 *   New trace fields expose the reversal and standing proof details for real-device
 *   diagnostics: reversalCandidateStartAtMs, reversalConfirmedAtMs, reversalFrameCount,
 *   reversalSpanMs, standingCandidateAtMs, standingRecoveryFrameCount, standingRecoveryHoldMs.
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
 * REVERSAL-TRUTH-RESET-01: Minimum consecutive ascending frames (depth strictly decreasing)
 * required to confirm reversal. Prevents single-frame post-peak collapse from counting as reversal.
 * "Ascending" = depth[i] < depth[i-1] strictly, which means person is moving upward.
 */
const MIN_REVERSAL_FRAMES = 3;

/**
 * REVERSAL-TRUTH-RESET-01: Depth increase larger than this tolerance resets the ascending streak.
 * Small noisy re-descents within this band do NOT reset the streak (noise gate).
 */
const REVERSAL_NOISE_FLOOR = 0.005;

/**
 * After reversal, depth must return to
 *   <= baselineStandingDepth + STANDING_RECOVERY_FRACTION × relativePeak
 * to confirm standing recovery.
 */
const STANDING_RECOVERY_FRACTION = 0.40;

/**
 * STANDING-RECOVERY-RESET-01: Minimum consecutive frames at or below standing threshold
 * required to confirm standing recovery. Prevents a single threshold-touch from counting.
 * Standing scan starts strictly AFTER fullReversalIndex, making same-frame reversal+standing
 * structurally impossible.
 */
const MIN_STANDING_FRAMES = 2;

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

  // ── REVERSAL-TRUTH-RESET-01 trace ──
  /** Timestamp when ascending streak began (first strictly-downward depth frame post-peak). */
  reversalCandidateStartAtMs?: number;
  /** Timestamp when reversal was structurally confirmed (after MIN_REVERSAL_FRAMES upward frames). */
  reversalConfirmedAtMs?: number;
  /** Number of consecutive ascending frames that confirmed reversal. */
  reversalFrameCount?: number;
  /** Time span (ms) from reversalCandidateStart to reversalConfirmed. */
  reversalSpanMs?: number;
  /** 'structured' when confirmed, else blocked reason string. */
  reversalSource?: 'structured' | string;
  /** Non-null when reversalDetected=false. Explains why structured reversal was not confirmed. */
  reversalBlockedReason?: string;

  // ── STANDING-RECOVERY-RESET-01 trace ──
  /** Timestamp of the first frame at or below standing threshold post-reversal. */
  standingCandidateAtMs?: number;
  /** Number of consecutive frames below standing threshold that confirmed standing. */
  standingRecoveryFrameCount?: number;
  /** Time held at or below standing threshold (ms) when confirmed. */
  standingRecoveryHoldMs?: number;
  /** Non-null when standingRecovered=false. Explains why standing recovery was not confirmed. */
  standingRecoveryBlockedReason?: string;

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
  // REVERSAL-TRUTH-RESET-01 trace
  reversalCandidateStartAtMs?: number;
  reversalConfirmedAtMs?: number;
  reversalFrameCount?: number;
  reversalSpanMs?: number;
  reversalBlockedReason?: string;
  // STANDING-RECOVERY-RESET-01 trace
  standingCandidateAtMs?: number;
  standingRecoveryFrameCount?: number;
  standingRecoveryHoldMs?: number;
  standingRecoveryBlockedReason?: string;
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
    reversalCandidateStartAtMs,
    reversalConfirmedAtMs,
    reversalFrameCount,
    reversalSpanMs,
    reversalBlockedReason,
    standingCandidateAtMs,
    standingRecoveryFrameCount,
    standingRecoveryHoldMs,
    standingRecoveryBlockedReason,
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
    // REVERSAL-TRUTH-RESET-01 trace fields
    reversalFrameCount != null ? `rev_fr=${reversalFrameCount}` : null,
    reversalSpanMs != null ? `rev_span=${reversalSpanMs}ms` : null,
    reversalBlockedReason != null ? `rev_block=${reversalBlockedReason}` : null,
    // STANDING-RECOVERY-RESET-01 trace fields
    standingRecoveryFrameCount != null ? `std_fr=${standingRecoveryFrameCount}` : null,
    standingRecoveryBlockedReason != null ? `std_block=${standingRecoveryBlockedReason}` : null,
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
    // REVERSAL-TRUTH-RESET-01 trace
    reversalCandidateStartAtMs,
    reversalConfirmedAtMs,
    reversalFrameCount,
    reversalSpanMs,
    reversalSource: reversalDetected ? 'structured' : reversalBlockedReason,
    reversalBlockedReason,
    // STANDING-RECOVERY-RESET-01 trace
    standingCandidateAtMs,
    standingRecoveryFrameCount,
    standingRecoveryHoldMs,
    standingRecoveryBlockedReason,
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

  // ── 5. REVERSAL-TRUTH-RESET-01: Structured reversal check (after peak) ──
  //
  // Reversal must be confirmed by a genuine post-peak ascending segment, NOT a single
  // scalar threshold crossing. A one-frame depth collapse (the false-pass root cause)
  // cannot satisfy MIN_REVERSAL_FRAMES = 3 consecutive ascending frames.
  //
  // Algorithm:
  //   - Scan post-peak frames for consecutive "ascending" frames (depth[i] < depth[i-1]).
  //   - Streak is reset if depth re-ascends by more than REVERSAL_NOISE_FLOOR (noise gate).
  //   - Flat frames (depth[i] >= depth[i-1] but within noise) do not count as ascending
  //     AND do not reset the streak — allowing brief sensor noise pauses.
  //   - Reversal is confirmed when ascendStreak >= MIN_REVERSAL_FRAMES AND
  //     total depth drop from peak >= reversalDropRequired.
  //
  // Gate result: fullReversalIndex is the LAST ascending frame in the confirming segment.
  // Same-frame reversal+standing is made impossible in step 6 (standing scan starts at
  // fullReversalIndex + 1, i.e., strictly AFTER this confirmation frame).
  const reversalDropRequired = relativePeak * REVERSAL_FRACTION;

  let reversalCandidateStartAtMs: number | undefined;
  let reversalConfirmedAtMs: number | undefined;
  let reversalAtMs: number | undefined;       // backward-compat: = reversalCandidateStartAtMs
  let reversalDetected = false;
  let fullReversalIndex = -1;
  let reversalFrameCount = 0;
  let reversalSpanMs = 0;
  let reversalBlockedReason: string | undefined;

  let _ascendStreak = 0;      // consecutive ascending frames since candidate start
  let _ascendStartIdx = -1;   // index of first frame in current ascending streak

  for (let i = peakIndex + 1; i < depthFrames.length; i++) {
    const prevDepth = depthFrames[i - 1]!.depth;
    const currDepth = depthFrames[i]!.depth;

    if (currDepth < prevDepth) {
      // Ascending frame: depth decreasing = person moving upward
      if (_ascendStartIdx < 0) _ascendStartIdx = i;
      _ascendStreak++;

      const totalDrop = peakDepth - currDepth;
      const span = depthFrames[i]!.timestampMs - depthFrames[_ascendStartIdx]!.timestampMs;

      if (_ascendStreak >= MIN_REVERSAL_FRAMES && totalDrop >= reversalDropRequired) {
        reversalDetected = true;
        fullReversalIndex = i;
        reversalCandidateStartAtMs = depthFrames[_ascendStartIdx]!.timestampMs;
        reversalConfirmedAtMs = depthFrames[i]!.timestampMs;
        reversalAtMs = reversalCandidateStartAtMs;
        reversalFrameCount = _ascendStreak;
        reversalSpanMs = span;
        break;
      }
    } else if (currDepth > prevDepth + REVERSAL_NOISE_FLOOR) {
      // Significant re-descent: reset ascending streak
      _ascendStreak = 0;
      _ascendStartIdx = -1;
    }
    // Flat or within noise tolerance: keep streak (don't increment, don't reset)
  }

  if (!reversalDetected) {
    reversalBlockedReason =
      _ascendStreak > 0
        ? `reversal_streak_insufficient:${_ascendStreak}<${MIN_REVERSAL_FRAMES}`
        : 'no_post_peak_ascending_segment';
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
      reversalBlockedReason,
      input,
    });
  }

  // ── 6. STANDING-RECOVERY-RESET-01: Structured standing recovery check ──
  //
  // Standing recovery scan starts STRICTLY AFTER fullReversalIndex (fullReversalIndex + 1).
  // This is the hard same-frame prohibition: since standing scan cannot include the reversal
  // confirmation frame, reversalConfirmedAtMs === standingRecoveredAtMs is structurally
  // impossible regardless of depth values.
  //
  // Additionally, MIN_STANDING_FRAMES consecutive frames at or below the standing threshold
  // are required. A single threshold-touch is no longer sufficient proof of standing recovery.
  // Standing candidate is reset if depth rises above threshold again.
  const standingThreshold = baselineStandingDepth + STANDING_RECOVERY_FRACTION * relativePeak;
  let standingRecovered = false;
  let standingRecoveredAtMs: number | undefined;
  let standingCandidateAtMs: number | undefined;
  let standingCandidateIdx = -1;
  let standingRecoveryFrameCount = 0;
  let standingRecoveryHoldMs = 0;
  let standingRecoveryBlockedReason: string | undefined;

  // Hard same-frame prohibition: scan starts at fullReversalIndex + 1, NOT fullReversalIndex.
  // This guarantees reversalConfirmedAtMs < standingRecoveredAtMs by at least one frame interval.
  const scanStart = fullReversalIndex + 1;

  for (let i = scanStart; i < depthFrames.length; i++) {
    if (depthFrames[i]!.depth <= standingThreshold) {
      if (standingCandidateIdx < 0) {
        standingCandidateIdx = i;
        standingCandidateAtMs = depthFrames[i]!.timestampMs;
      }
      standingRecoveryFrameCount++;
      standingRecoveryHoldMs =
        depthFrames[i]!.timestampMs - (standingCandidateAtMs ?? depthFrames[i]!.timestampMs);

      if (standingRecoveryFrameCount >= MIN_STANDING_FRAMES) {
        standingRecovered = true;
        standingRecoveredAtMs = depthFrames[i]!.timestampMs;
        break;
      }
    } else {
      // Depth rose above threshold — reset standing candidate
      standingCandidateIdx = -1;
      standingCandidateAtMs = undefined;
      standingRecoveryFrameCount = 0;
      standingRecoveryHoldMs = 0;
    }
  }

  if (!standingRecovered) {
    standingRecoveryBlockedReason =
      standingRecoveryFrameCount > 0
        ? `standing_frames_insufficient:${standingRecoveryFrameCount}<${MIN_STANDING_FRAMES}`
        : 'no_standing_threshold_reached_post_reversal';
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
      reversalCandidateStartAtMs,
      reversalConfirmedAtMs,
      reversalFrameCount,
      reversalSpanMs,
      standingCandidateAtMs,
      standingRecoveryFrameCount,
      standingRecoveryHoldMs,
      standingRecoveryBlockedReason,
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
      reversalCandidateStartAtMs,
      reversalConfirmedAtMs,
      reversalFrameCount,
      reversalSpanMs,
      standingCandidateAtMs,
      standingRecoveryFrameCount,
      standingRecoveryHoldMs,
      input,
    });
  }

  // ── 8. Same-rep ownership (reversal-to-standing timing) ──
  // Use reversalConfirmedAtMs (structural confirmation point) for ownership check,
  // not reversalCandidateStartAtMs (earlier start of ascending segment).
  const reversalToStandingMs =
    reversalConfirmedAtMs != null && standingRecoveredAtMs != null
      ? standingRecoveredAtMs - reversalConfirmedAtMs
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
      reversalCandidateStartAtMs,
      reversalConfirmedAtMs,
      reversalFrameCount,
      reversalSpanMs,
      standingCandidateAtMs,
      standingRecoveryFrameCount,
      standingRecoveryHoldMs,
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
      reversalCandidateStartAtMs,
      reversalConfirmedAtMs,
      reversalFrameCount,
      reversalSpanMs,
      standingCandidateAtMs,
      standingRecoveryFrameCount,
      standingRecoveryHoldMs,
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
    reversalCandidateStartAtMs,
    reversalConfirmedAtMs,
    reversalFrameCount,
    reversalSpanMs,
    standingCandidateAtMs,
    standingRecoveryFrameCount,
    standingRecoveryHoldMs,
    input,
  });
}
