/**
 * PASS-WINDOW-RESET-01: Truly independent squat pass authority core.
 *
 * This module is the ONLY owner of squat motion pass truth.
 * It derives pass truth from pass-window-owned inputs, NOT from completionFrames
 * or completion-state verdict fields.
 *
 * RESET-01 limitation: pass-core still required completionSatisfied as primary gate.
 * RESET-02 fix: all gates derived independently from depthFrames.
 * RESET-02 practical limitation: depthFrames still came from upstream-clipped completionFrames
 *   and baseline came from completion-state.baselineStandingDepth.
 * PASS-WINDOW-RESET-01 fix: depthFrames now come from the full post-readiness valid stream
 *   (built by pass-window.ts), and baseline is pass-window-owned (min of first 8 valid frames).
 *   This ensures the peak is never the first frame and pre-peak descent is always visible.
 *
 * Design contract:
 * - Reads pass-window-owned depth stream + pass-window-owned baseline.
 * - Does NOT read: completionSatisfied, completionBlockedReason, official_shallow_cycle,
 *   low_rom_cycle, ultra_low_rom_cycle, canonical shallow contract, ultra-low policy.
 * - Setup bypass REMOVED: setup motion blocks pass unconditionally per SSOT §4.3.
 * - Cycle duration measured from descent epoch (not from stream start) to handle
 *   long pre-squat standing periods in the wider valid stream.
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
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum relative depth (peak − baseline) for meaningful descent. Blocks standing-only / micro-sway. */
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
 * PASS-WINDOW-RESET-01: cycle duration is measured from the descent epoch start,
 * not from depthFrames[0].timestampMs. The descent epoch starts at the last frame
 * before the peak where depth is within (baseline + DESCENT_EPOCH_REL_THRESHOLD × relativePeak).
 * This correctly handles long pre-squat standing periods in the wider valid stream.
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
 * PASS-WINDOW-RESET-01 pass-core input.
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
 * PASS-WINDOW-RESET-01: Derive immutable squat pass truth from pass-window-owned inputs.
 *
 * Called by evaluators/squat.ts BEFORE applyUltraLowPolicyLock and late-setup annotation.
 * The result is stored in evaluatorResult.debug.squatPassCore and consumed by auto-progression.
 *
 * Hard pass criteria (all must be true in one continuous depth stream):
 *  1. Sufficient depth frames + valid baseline (readiness)
 *  2. Meaningful descent: relativePeak >= MIN_DESCENT_DEPTH_DELTA (0.025)
 *  3. Peak sustained >= MIN_PEAK_HOLD_FRAMES (anti-single-spike), peak not first frame
 *  4. Reversal: depth decreased by >= REVERSAL_FRACTION × relativePeak after peak
 *  5. Standing recovery: depth returned to <= baseline + STANDING_RECOVERY_FRACTION × relativePeak
 *  6. Anti-spike timing: cycle >= MIN_CYCLE_DURATION_MS and <= MAX_CYCLE_DURATION_MS
 *     (cycle measured from descent epoch, not stream start — handles long pre-squat standing)
 *  7. Same-rep ownership: reversal-to-standing <= MAX_REVERSAL_TO_STANDING_MS
 *  8. Setup clear — NO BYPASS: setup motion blocks pass unconditionally (SSOT §4.3)
 *
 * PASS-WINDOW-RESET-01 key changes:
 * - depthFrames now comes from pass-window.ts (full valid stream, not arming-clipped completionFrames)
 * - baselineStandingDepth is pass-window-owned (not completion-state.baselineStandingDepth)
 * - Setup bypass removed: allMotionGatesClear no longer overrides setupMotionBlocked
 * - Cycle duration measured from descent epoch start, not from depthFrames[0].timestampMs
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

  // ── 2. Find peak in depth stream ──
  let peakIndex = 0;
  let peakDepth = depthFrames[0]!.depth;
  for (let i = 1; i < depthFrames.length; i++) {
    if (depthFrames[i]!.depth > peakDepth) {
      peakDepth = depthFrames[i]!.depth;
      peakIndex = i;
    }
  }

  const peakTs = depthFrames[peakIndex]!.timestampMs;
  const relativePeak = peakDepth - baselineStandingDepth;

  // ── 2b. Descent epoch start ──
  // Measure cycle duration from descent epoch (not from stream start).
  // With the wider valid stream, depthFrames[0] could be seconds before the squat motion.
  // Scan backward from peak to find the last frame within DESCENT_EPOCH_REL_THRESHOLD of baseline.
  const descentEpochThreshold = baselineStandingDepth + Math.max(0.005, relativePeak * DESCENT_EPOCH_REL_THRESHOLD);
  let descentEpochStartTs = depthFrames[0]!.timestampMs; // fallback
  for (let i = peakIndex; i >= 0; i--) {
    if (depthFrames[i]!.depth <= descentEpochThreshold) {
      descentEpochStartTs = depthFrames[i]!.timestampMs;
      break;
    }
  }

  // ── 3. Descent check ──
  const descentDetected = relativePeak >= MIN_DESCENT_DEPTH_DELTA;

  if (!descentDetected) {
    return buildResult({
      passDetected: false,
      passBlockedReason: 'no_meaningful_descent',
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
