/**
 * 스쿼트 evaluator
 * metrics: depth, knee alignment trend, trunk lean, asymmetry
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import {
  buildPoseFeaturesFrames,
  getSquatRecoverySignal,
  hasGuardedShallowSquatAscent,
} from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import {
  attachShallowTruthObservabilityAlign01,
  evaluateSquatCompletionState,
  applyUltraLowPolicyLock,
} from '@/lib/camera/squat-completion-state';
import { evaluateSquatPassCore, type SquatPassCoreDepthFrame } from '@/lib/camera/squat/pass-core';
import { buildSquatPassWindow } from '@/lib/camera/squat/pass-window';
import { evaluateSquatMotionEvidenceV2 } from '@/lib/camera/squat/squat-motion-evidence-v2';
import type { SquatMotionEvidenceFrameV2 } from '@/lib/camera/squat/squat-motion-evidence-v2.types';
import {
  computeSquatDescentTruth,
} from '@/lib/camera/squat/squat-descent-truth';
import {
  computeSquatCompletionArming,
  findPreArmingKinematicDescentEpoch,
  mergeArmingDepthObservability,
  type CompletionArmingState,
} from '@/lib/camera/squat/squat-completion-arming';
import { getSquatHmmArmingAssistDecision } from '@/lib/camera/squat/squat-arming-assist';
import {
  computeShallowEpochAcquisitionDecision,
  type ShallowEpochAcquisitionDecision,
} from '@/lib/camera/squat/squat-shallow-epoch-acquisition';
import {
  computeSquatInternalQuality,
  squatInternalQualityInsufficientSignal,
} from '@/lib/camera/squat/squat-internal-quality';
import { getSquatPerStepDiagnostics } from '@/lib/camera/step-joint-spec';
import { decodeSquatHmm } from '@/lib/camera/squat/squat-hmm';
import type {
  EvaluatorResult,
  EvaluatorMetric,
  SquatCalibrationDebug,
  SquatDepthCalibrationDebug,
  SquatReversalCalibrationDebug,
} from './types';
import {
  readSquatCompletionDepth,
  computeSquatReadinessStableDwell,
  computeSquatSetupMotionBlock,
} from '@/lib/camera/squat-completion-state';
import {
  STANDARD_OWNER_FLOOR,
  squatCompletionBlockedReasonToCode,
} from '@/lib/camera/squat/squat-completion-core';

const MIN_VALID_FRAMES = 8;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function getNumbers(values: Array<number | null>): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

function countPhases(frames: PoseFeaturesFrame[], phase: PoseFeaturesFrame['phaseHint']): number {
  return frames.filter((frame) => frame.phaseHint === phase).length;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function runtimeV2Depth(frame: PoseFeaturesFrame): number {
  return (
    finite(frame.derived.squatDepthProxyBlended) ??
    finite(frame.derived.squatDepthProxy) ??
    finite(frame.derived.squatDepthProxyRaw) ??
    0
  );
}

// ── PR04D: V2 depth source selection policy ──────────────────────────────────
// Root cause (PR04D): for shallow squats, squatDepthProxyBlended can be
// collapsed near-zero (1e-8) or a tail-spike-only series, preventing V2 from
// seeing the actual shallow descent curve. squatDepthProxy (EMA primary) or
// squatDepthProxyRaw may provide a better continuous signal.
// Policy: analyse all three series, select the one that gives V2 the most
// usable depth curve. Pass decision is NOT changed here — V2 still owns it.

/** Below this → "near-zero machine epsilon" (not a meaningful depth reading). */
const V2_DEPTH_EPS = 1e-6;
/** Minimum depth value to count a frame as "meaningful" for series quality. */
const V2_DEPTH_MEANINGFUL_MIN = 0.018;
/** Minimum meaningful frames required for a series to be considered "usable". */
const V2_DEPTH_MIN_USABLE_FRAMES = 3;
/**
 * Peak within this many frames from tail → "tail spike only" (no post-peak room).
 * At 10fps, 2 frames = 200ms — too short for reversal/return detection.
 */
const V2_DEPTH_TAIL_SPIKE_MAX_DIST = 2;

type V2DepthSeriesStats = {
  max: number;
  meaningfulFrameCount: number;
  nonZeroFrameCount: number;
  peakFrameIndex: number;
  framesAfterPeak: number;
  collapsedNearZero: boolean;
  tailSpikeOnly: boolean;
  hasUsableCurve: boolean;
  hasPostPeakDrop: boolean;
};

function computeV2DepthSeriesStats(depths: number[]): V2DepthSeriesStats {
  const n = depths.length;
  let max = 0;
  let peakFrameIndex = 0;
  let meaningfulFrameCount = 0;
  let nonZeroFrameCount = 0;

  for (let i = 0; i < n; i++) {
    const d = depths[i]!;
    if (d > max) {
      max = d;
      peakFrameIndex = i;
    }
    if (d >= V2_DEPTH_MEANINGFUL_MIN) meaningfulFrameCount++;
    if (d > V2_DEPTH_EPS) nonZeroFrameCount++;
  }

  const framesAfterPeak = n - 1 - peakFrameIndex;

  // collapsedNearZero: the entire series never exceeds machine-epsilon range.
  // All "meaningful" values are essentially noise.
  const collapsedNearZero = max < V2_DEPTH_EPS * 1000; // max < ~1e-3

  // tailSpikeOnly: very few meaningful frames AND peak is right at the tail.
  // Indicates a single-frame or 2-frame spike with no post-peak descent info.
  const tailSpikeOnly =
    !collapsedNearZero &&
    meaningfulFrameCount <= V2_DEPTH_MIN_USABLE_FRAMES - 1 &&
    framesAfterPeak <= V2_DEPTH_TAIL_SPIKE_MAX_DIST;

  // hasPostPeakDrop: depth after peak drops meaningfully (indicates actual ascent).
  let hasPostPeakDrop = false;
  if (framesAfterPeak >= 1) {
    const nextDepth = depths[peakFrameIndex + 1] ?? max;
    // reversalThreshold mirrors V2's own: max(0.009, relativePeak * 0.13)
    const reversalThreshold = Math.max(0.009, max * 0.13);
    hasPostPeakDrop = max - nextDepth >= reversalThreshold;
  }

  // hasUsableCurve: series has enough structure for V2 reversal/return detection.
  const hasUsableCurve =
    !collapsedNearZero &&
    !tailSpikeOnly &&
    meaningfulFrameCount >= V2_DEPTH_MIN_USABLE_FRAMES &&
    framesAfterPeak >= 2;

  return {
    max,
    meaningfulFrameCount,
    nonZeroFrameCount,
    peakFrameIndex,
    framesAfterPeak,
    collapsedNearZero,
    tailSpikeOnly,
    hasUsableCurve,
    hasPostPeakDrop,
  };
}

type SelectedV2DepthSeries = {
  depths: number[];
  source: 'blended' | 'proxy' | 'raw' | 'fallback_zero';
  policy: string;
  switchReason: string | null;
  stats: {
    blended: V2DepthSeriesStats;
    proxy: V2DepthSeriesStats;
    raw: V2DepthSeriesStats;
  };
};

/**
 * PR04D: Analyse all three depth candidates (blended / proxy / raw) across the
 * full v2EvalFrames window and return the series that gives V2 the best input.
 *
 * Selection priority:
 *   1. blended (squatDepthProxyBlended) — default, best for deep squats
 *   2. proxy   (squatDepthProxy)        — when blended is collapsed or tail-spike
 *   3. raw     (squatDepthProxyRaw)     — when proxy is also poor
 *   4. fallback to blended              — when all alternatives are also poor
 *
 * IMPORTANT: source selection does NOT change the V2 pass contract.
 * V2's evidence thresholds, guards (A/B/C), and owner decision are unchanged.
 */
function selectRuntimeV2DepthSeries(frames: PoseFeaturesFrame[]): SelectedV2DepthSeries {
  const blendedDepths = frames.map((f) => finite(f.derived.squatDepthProxyBlended) ?? 0);
  const proxyDepths = frames.map((f) => finite(f.derived.squatDepthProxy) ?? 0);
  const rawDepths = frames.map((f) => finite(f.derived.squatDepthProxyRaw) ?? 0);

  const blendedStats = computeV2DepthSeriesStats(blendedDepths);
  const proxyStats = computeV2DepthSeriesStats(proxyDepths);
  const rawStats = computeV2DepthSeriesStats(rawDepths);
  const stats = { blended: blendedStats, proxy: proxyStats, raw: rawStats };

  // Case 1: blended series has a usable curve → use it (normal path).
  if (blendedStats.hasUsableCurve) {
    return { depths: blendedDepths, source: 'blended', policy: 'blended_usable', switchReason: null, stats };
  }

  // Case 2/3/4/5: blended is collapsed or tail-spike → try alternatives.
  const blendedNotUsable = blendedStats.collapsedNearZero || blendedStats.tailSpikeOnly;
  if (blendedNotUsable) {
    const reason = blendedStats.collapsedNearZero ? 'blended_collapsed_near_zero' : 'blended_tail_spike_only';
    const collapsePrefix = blendedStats.collapsedNearZero ? 'blended_collapsed' : 'tail_spike';

    if (proxyStats.hasUsableCurve) {
      return {
        depths: proxyDepths,
        source: 'proxy',
        policy: `${collapsePrefix}_proxy_selected`,
        switchReason: reason,
        stats,
      };
    }

    if (rawStats.hasUsableCurve) {
      return {
        depths: rawDepths,
        source: 'raw',
        policy: `${collapsePrefix}_raw_selected`,
        switchReason: reason,
        stats,
      };
    }

    // All alternatives also poor → keep blended (with diagnostic).
    return {
      depths: blendedDepths,
      source: 'blended',
      policy: 'fallback_blended',
      switchReason: `${reason}_no_alternative_usable`,
      stats,
    };
  }

  // blended not usable but not clearly collapsed/spike → keep blended.
  return { depths: blendedDepths, source: 'blended', policy: 'fallback_blended', switchReason: 'blended_not_usable', stats };
}

function runtimeV2UpperBodySignal(frame: PoseFeaturesFrame): number {
  const arm = finite(frame.derived.armElevationAvg);
  const trunk = finite(frame.derived.trunkLeanDeg);
  const armNorm = arm == null ? 0 : Math.min(1, Math.max(0, arm / 180));
  const trunkNorm = trunk == null ? 0 : Math.min(1, Math.abs(trunk) / 90);
  return Math.max(armNorm, trunkNorm);
}

function toSquatMotionEvidenceV2Frames(
  frames: PoseFeaturesFrame[],
  selectedDepths?: number[]
): SquatMotionEvidenceFrameV2[] {
  return frames.map((frame, i) => {
    const depth = selectedDepths != null ? (selectedDepths[i] ?? runtimeV2Depth(frame)) : runtimeV2Depth(frame);
    return {
      timestampMs: frame.timestampMs,
      depth,
      lowerBodySignal: depth,
      upperBodySignal: runtimeV2UpperBodySignal(frame),
      bodyVisibleEnough: frame.isValid && frame.frameValidity === 'valid',
      lowerBodyVisibleEnough: frame.visibilitySummary.criticalJointsAvailability >= 0.6,
      phaseHint: frame.phaseHint,
      isValid: frame.isValid,
      frameValidity: frame.frameValidity,
      visibilitySummary: frame.visibilitySummary,
      derived: frame.derived,
      joints: frame.joints,
    };
  });
}

/**
 * Rolling fallback window for V2 when no active attempt epoch can be computed.
 * PR6-FIX-01: this is a FALLBACK only; the primary window is activeAttemptEpochStartMs.
 */
const MAX_V2_EVAL_WINDOW_MS = 5000;

/**
 * Maximum lookback (ms) when searching for the current descent candidate.
 * Prevents very old stale motion from being misidentified as the current attempt.
 */
const MAX_EPOCH_LOOKBACK_MS = 8000;

/**
 * How many ms before the detected descent start to include as pre-descent baseline.
 * These stable standing frames allow V2 to compute the correct startDepth and
 * measure the full relativePeak, preventing romBand downgrade (shallow mis-classification).
 * Range 300–700ms per spec; 500ms chosen as midpoint.
 */
const PRE_DESCENT_BASELINE_MS = 500;

/**
 * Minimum meaningful depth to identify a descent candidate.
 * Matches V2's MEANINGFUL_DESCENT_MIN constant.
 */
const EPOCH_DESCENT_THRESHOLD = 0.035;

/**
 * PR6-FIX-01 — Active Attempt Epoch Window
 *
 * Replaces the fixed latestValidTs−5000ms rolling window as the primary V2 input bound.
 *
 * Root cause of post-PR5/PR6 real-device failures:
 *   - validRaw is filtered to the last 5 s, so a slow squat (>3 s descent) fills the
 *     entire window with the descent phase: descentStartFrameIndex=0, peak at tail,
 *     no room for reversal/return detection.
 *   - After the user ascends, the new 5 s window starts mid-descent → startDepth is
 *     high (mid-descent, not standing) → relativePeak ≈ small → romBand='shallow'
 *     even for deep squats.
 *
 * Fix: detect when the current descent started from the FULL validRaw buffer.
 *   epochStartMs = descentStartMs − PRE_DESCENT_BASELINE_MS
 *   V2 receives frames from epochStartMs forward, giving it:
 *     (a) pre-descent baseline for correct startDepth, and
 *     (b) the full descent→reversal→return cycle within one window.
 *
 * Setup/framing translation exclusion: if a setup-phase frame appears between
 * epochStart and descentStart, the epoch is clipped to after the last setup frame.
 */
function computeActiveAttemptEpoch(
  validRaw: PoseFeaturesFrame[],
  latestTs: number
): {
  epochStartMs: number;
  epochSource: string;
  usedRollingFallback: boolean;
  activeAttemptEpochStartMs: number | null;
  activeAttemptEpochSource: string | null;
  epochResetReason: string | null;
} {
  const rollingFallback = {
    epochStartMs: latestTs - MAX_V2_EVAL_WINDOW_MS,
    epochSource: 'rolling_window_fallback',
    usedRollingFallback: true,
    activeAttemptEpochStartMs: null,
    activeAttemptEpochSource: 'rolling_fallback' as string | null,
    epochResetReason: null as string | null,
  };

  if (validRaw.length < 4) return rollingFallback;

  // Restrict lookback to MAX_EPOCH_LOOKBACK_MS to avoid ancient stale motion.
  const lookbackCutMs = latestTs - MAX_EPOCH_LOOKBACK_MS;
  const recentFrames = validRaw.filter((f) => f.timestampMs >= lookbackCutMs);
  if (recentFrames.length < 4) return rollingFallback;

  // Build depth signal for recent frames.
  const depths = recentFrames.map((f) => runtimeV2Depth(f));

  // ── Find depth peak in recent frames ────────────────────────────────────
  // The peak represents the bottom of the current squat.
  let peakDepth = 0;
  let peakIdx = 0;
  for (let i = 0; i < depths.length; i++) {
    if (depths[i]! > peakDepth) {
      peakDepth = depths[i]!;
      peakIdx = i;
    }
  }

  // No meaningful motion → rolling fallback (user standing or micro-bounce only).
  if (peakDepth < EPOCH_DESCENT_THRESHOLD) return rollingFallback;

  // ── Find descent start: local minimum before peak ────────────────────────
  // Scan backward from peak to find the frame with minimum depth
  // (standing baseline just before the user started descending).
  let descentStartIdx = 0;
  let minDepthBeforePeak = depths[peakIdx]!;
  for (let i = peakIdx; i >= 0; i--) {
    if (depths[i]! <= minDepthBeforePeak) {
      minDepthBeforePeak = depths[i]!;
      descentStartIdx = i;
    }
  }

  // ── Setup/framing translation clip ──────────────────────────────────────
  // If a setup-phase frame appears between descentStartIdx and the beginning,
  // clip the epoch to start AFTER the last setup frame (exclude old setup motion).
  let epochResetReason: string | null = null;
  let setupClipIdx = 0;
  for (let i = descentStartIdx; i >= 0; i--) {
    const ph = String(recentFrames[i]!.phaseHint ?? '').toLowerCase();
    if (ph === 'setup' || ph === 'readiness' || ph === 'align' || ph === 'alignment') {
      setupClipIdx = i + 1;
      epochResetReason = 'setup_phase_excluded';
      break;
    }
  }

  const effectiveStartIdx = Math.max(setupClipIdx, descentStartIdx);
  const descentStartMs = recentFrames[effectiveStartIdx]!.timestampMs;

  // ── Apply pre-descent baseline offset ───────────────────────────────────
  const rawEpochStartMs = descentStartMs - PRE_DESCENT_BASELINE_MS;
  const bufferStartMs = recentFrames[0]!.timestampMs;
  const epochStartMs = Math.max(rawEpochStartMs, bufferStartMs);

  // Time-based check: did we include any time before the descent start?
  // Note: this is a heuristic label. The definitive label is corrected in
  // evaluateSquatFromPoseFrames after reading V2's actual descentStartFrameIndex.
  const hasPreDescentBaseline = epochStartMs < descentStartMs;
  const epochSource = hasPreDescentBaseline
    ? 'active_attempt_epoch_with_pre_descent_baseline'
    : 'active_attempt_epoch_without_baseline';

  return {
    epochStartMs,
    epochSource,
    usedRollingFallback: false,
    activeAttemptEpochStartMs: epochStartMs,
    activeAttemptEpochSource: 'first_descent_candidate',
    epochResetReason,
  };
}

/**
 * PR04D: Export for smoke testing. Callers may pass minimal frame-like objects
 * that only need the `derived` sub-fields used by the depth selection policy.
 */
export { selectRuntimeV2DepthSeries };
export type { SelectedV2DepthSeries, V2DepthSeriesStats };

export function evaluateSquatFromPoseFrames(frames: PoseFeaturesFrame[]): EvaluatorResult {
  const validRaw = frames.filter((frame) => frame.isValid);

  // ── PR6-FIX-01: Active Attempt Epoch Window ──────────────────────────────
  // Primary: bound V2 input to the current active squat attempt epoch.
  // Fallback: rolling MAX_V2_EVAL_WINDOW_MS window (when no descent detected).
  //
  // This replaces latestValidTs−5000ms as the primary window source.
  // Rationale: the rolling 5s window causes descentStartFrameIndex=0 when the user
  // squats slowly; the peak lands at the tail with no reversal/return frames visible.
  // By anchoring to the detected descent start, V2 always sees:
  //   (a) stable pre-descent baseline → correct startDepth → correct romBand
  //   (b) the full descent→peak→reversal→return cycle → reversal detection works
  const latestValidTs = validRaw[validRaw.length - 1]?.timestampMs ?? 0;
  const activeEpoch = computeActiveAttemptEpoch(validRaw, latestValidTs);
  const v2EvalFrames = validRaw.filter((f) => f.timestampMs >= activeEpoch.epochStartMs);

  // ── PR04D: V2 depth source selection ──────────────────────────────────────
  // Analyse blended/proxy/raw series; use the best curve for V2 input.
  // Does NOT change V2 pass thresholds — only which depth series V2 reads.
  const v2DepthSelection = selectRuntimeV2DepthSeries(v2EvalFrames);

  const squatMotionEvidenceV2 = evaluateSquatMotionEvidenceV2(
    toSquatMotionEvidenceV2Frames(v2EvalFrames, v2DepthSelection.depths)
  );

  // ── Annotate V2 metrics with epoch context and PR6-FIX-01 diagnostics ───
  if (squatMotionEvidenceV2.metrics) {
    const m = squatMotionEvidenceV2.metrics as Record<string, unknown>;
    const vm = squatMotionEvidenceV2.metrics;

    // Epoch provenance (initial; corrected below after reading V2's descentStartFrameIndex)
    m.v2EpochStartMs = v2EvalFrames[0]?.timestampMs;
    m.usedRollingFallback = activeEpoch.usedRollingFallback;
    m.activeAttemptEpochStartMs = activeEpoch.activeAttemptEpochStartMs;
    m.activeAttemptEpochSource = activeEpoch.activeAttemptEpochSource;
    m.epochResetReason = activeEpoch.epochResetReason;
    m.latestFrameTimestampMs = latestValidTs;

    // Cycle duration candidate: from descentStart to latest frame.
    // Warns when the current descent may exceed MAX_SQUAT_CYCLE_MS before return.
    const descentStartFrameIndex = vm.descentStartFrameIndex ?? null;
    const descentStartFrameTs =
      descentStartFrameIndex != null
        ? (v2EvalFrames[descentStartFrameIndex]?.timestampMs ?? null)
        : null;
    const cycleDurationCandidateMs =
      descentStartFrameTs != null ? latestValidTs - descentStartFrameTs : null;
    m.cycleDurationCandidateMs = cycleDurationCandidateMs;
    m.cycleCapExceeded =
      cycleDurationCandidateMs != null && cycleDurationCandidateMs > 4500
        ? true
        : vm.returnMs != null && vm.returnMs > 4500
        ? true
        : false;

    // ── PR6-FIX-01B: Pre-descent baseline ground truth from V2 ───────────
    // V2's descentStartFrameIndex is the authoritative source: it reflects the
    // actual number of frames V2 treated as pre-descent baseline.
    // computeActiveAttemptEpoch's hasPreDescentBaseline is time-based and may
    // label the epoch as 'with_pre_descent_baseline' even when V2's
    // findMotionWindow sets startIndex=0 (baseline frames included but not
    // recognized as pre-descent by V2's algorithm).
    const actualPreDescentBaselineCount = descentStartFrameIndex ?? 0;
    const hasActualPreDescentBaseline = actualPreDescentBaselineCount >= 3;
    m.preDescentBaselineFrameCount = actualPreDescentBaselineCount;

    // Corrected epoch source: use V2's actual baseline count as ground truth.
    // If computeActiveAttemptEpoch claimed 'with_pre_descent_baseline' but V2
    // reports descentStartFrameIndex=0 (<3), correct to 'without_baseline'.
    const correctedEpochSource = hasActualPreDescentBaseline
      ? 'active_attempt_epoch_with_pre_descent_baseline'
      : activeEpoch.usedRollingFallback
      ? 'rolling_window_fallback'
      : 'active_attempt_epoch_without_baseline';
    m.v2EpochSource = correctedEpochSource;

    // ── PR6-FIX-01B: Pass cache/latch verification trace (debug only) ────
    // These fields help verify that prior squat passes are NOT being cached/
    // replayed. They MUST NOT influence pass logic.
    // v2InputStartMs / v2InputEndMs: timestamps of the V2 evaluation window.
    // validRawBufferOldestMs / validRawBufferNewestMs: full raw buffer bounds.
    // previousSquatPassLatchedInSession / previousSquatPassAtMs: require session-
    //   level wiring (auto-progression.ts). Set to null here (stateless evaluator).
    m.v2InputStartMs = v2EvalFrames[0]?.timestampMs ?? null;
    m.v2InputEndMs = latestValidTs;
    m.v2InputFrameCount = v2EvalFrames.length;
    m.validRawBufferOldestMs = validRaw[0]?.timestampMs ?? null;
    m.validRawBufferNewestMs = latestValidTs;
    m.validRawFrameCount = validRaw.length;
    // Populated by auto-progression.ts if session tracking is available.
    m.previousSquatPassLatchedInSession = null;
    m.previousSquatPassAtMs = null;
    m.v2InputIncludesFramesBeforeLastPass = null;
    m.squatCaptureSessionId = null;

    // ── PR04C: Peak-at-tail stall detection ────────────────────────────
    // peakAtTailStall=true means V2's peak frame is the last frame in the
    // evaluation window. The user is still descending or just reached the
    // bottom. V2 correctly returns no_reversal — this is NOT a terminal
    // failure, it is an awaiting_ascent_after_peak transient state.
    // Do NOT reset the epoch to rolling fallback when this flag is true.
    const peakFrameIndex_v2 = vm.peakFrameIndex ?? null;
    const inputFrameCount_v2 = vm.inputFrameCount ?? v2EvalFrames.length;
    const peakAtTailStall =
      peakFrameIndex_v2 !== null &&
      (peakFrameIndex_v2 >= inputFrameCount_v2 - 1 ||
        (vm.framesAfterPeak ?? 0) <= 0 ||
        (vm.peakDistanceFromTailFrames ?? 0) <= 0);
    m.peakAtTailStall = peakAtTailStall;

    // Stall duration estimate (approximate — no persistent state):
    // When peak is at the tail, the stall started approximately when depth
    // stopped increasing meaningfully. Use cycleDurationCandidateMs as an
    // upper bound; actual stall may be shorter (user is still descending).
    const cycleDurationMs = cycleDurationCandidateMs ?? 0;
    const descentMs_v2 = vm.descentMs ?? cycleDurationMs;
    const peakAtTailStallDurationMs = peakAtTailStall
      ? Math.max(0, cycleDurationMs - descentMs_v2)
      : null;
    m.peakAtTailStallSinceMs = peakAtTailStall ? (latestValidTs - descentMs_v2) : null;
    m.peakAtTailStallDurationMs = peakAtTailStallDurationMs;

    // postPeakFrameCount = explicit alias for framesAfterPeak
    m.postPeakFrameCount = vm.framesAfterPeak ?? 0;

    // ── PR04C: Active attempt state machine (stateless derivation) ─────
    // State is derived from V2 outputs + evaluator context on each tick.
    // No persistent module state — state machine is re-derived per eval.
    //
    // State transition rules:
    //   usableMotionEvidence=true         → returned (pass confirmed)
    //   peakAtTailStall=true              → awaiting_ascent_after_peak
    //   descent_only/bottom_hold + no reversal yet → descending
    //   incomplete_return + reversal seen → ascending
    //   attempt_duration_out_of_scope but reversal seen → ascending (slow squat)
    //   otherwise                         → idle
    let activeAttemptState: string;
    let activeAttemptStillLive: boolean;
    let awaitingAscentAfterPeak: boolean;

    if (squatMotionEvidenceV2.usableMotionEvidence) {
      activeAttemptState = 'returned';
      activeAttemptStillLive = false;
      awaitingAscentAfterPeak = false;
    } else if (peakAtTailStall) {
      activeAttemptState = 'awaiting_ascent_after_peak';
      activeAttemptStillLive = true;
      awaitingAscentAfterPeak = true;
    } else if (
      squatMotionEvidenceV2.motionPattern === 'descent_only' ||
      squatMotionEvidenceV2.motionPattern === 'bottom_hold'
    ) {
      activeAttemptState = 'descending';
      activeAttemptStillLive = true;
      awaitingAscentAfterPeak = false;
    } else if (
      squatMotionEvidenceV2.motionPattern === 'incomplete_return' ||
      (squatMotionEvidenceV2.blockReason === 'attempt_duration_out_of_scope' &&
        vm.reversalFrameIndex != null)
    ) {
      activeAttemptState = 'ascending';
      activeAttemptStillLive = true;
      awaitingAscentAfterPeak = false;
    } else if (
      squatMotionEvidenceV2.blockReason === 'attempt_duration_out_of_scope' ||
      squatMotionEvidenceV2.blockReason === 'no_reversal' ||
      squatMotionEvidenceV2.blockReason === 'no_return_to_start'
    ) {
      // Descent with no reversal yet (but not peak-at-tail — this case uses
      // the non-stall descending path)
      activeAttemptState = 'descending';
      activeAttemptStillLive = true;
      awaitingAscentAfterPeak = false;
    } else {
      activeAttemptState = 'idle';
      activeAttemptStillLive = false;
      awaitingAscentAfterPeak = false;
    }

    m.awaitingAscentAfterPeak = awaitingAscentAfterPeak;
    m.activeAttemptState = activeAttemptState;
    m.activeAttemptStillLive = activeAttemptStillLive;

    // Approximate state-since timestamp:
    //   For 'awaiting_ascent_after_peak': since cycleDurationCandidateMs - descentMs
    //   For 'ascending': since the peak timestamp
    //   For others: approximate from descent start
    const peakFrameTs_v2 =
      peakFrameIndex_v2 != null
        ? (v2EvalFrames[peakFrameIndex_v2]?.timestampMs ?? null)
        : null;
    let activeAttemptStateSinceMs: number | null = null;
    if (activeAttemptState === 'awaiting_ascent_after_peak') {
      activeAttemptStateSinceMs = peakFrameTs_v2 ?? latestValidTs;
    } else if (activeAttemptState === 'ascending') {
      activeAttemptStateSinceMs = peakFrameTs_v2;
    } else if (activeAttemptState === 'descending') {
      const descentStartFrameIndex_v2 = vm.descentStartFrameIndex ?? 0;
      activeAttemptStateSinceMs =
        v2EvalFrames[descentStartFrameIndex_v2]?.timestampMs ?? null;
    }
    m.activeAttemptStateSinceMs = activeAttemptStateSinceMs;

    // ── PR04C: Cycle cap vs live attempt distinction ────────────────────
    // cycleCapExceededButLiveAttempt=true means the attempt is identified as
    // a slow genuine squat (not stale), not a reason to discard the attempt.
    const cycleCapExceededButLiveAttempt =
      m.cycleCapExceeded === true && activeAttemptStillLive;
    const staleWindowRejected =
      squatMotionEvidenceV2.blockReason === 'stale_closure_not_at_tail';
    m.cycleCapExceededButLiveAttempt = cycleCapExceededButLiveAttempt;
    m.staleWindowRejected = staleWindowRejected;

    // ── PR04C: Window recovery annotation ──────────────────────────────
    // windowRecoveryApplied=true when the evaluator adjusted the V2 window
    // to ensure post-peak frames are included.
    // The V2 slow-descent exception (preDescentBaselineSatisfied + peakToReturnMs
    // + closureFreshAtTail) provides the primary recovery mechanism within V2.
    // No separate second V2 call is needed when this exception covers the case.
    let windowRecoveryApplied = false;
    let windowRecoveryReason: string | null = null;

    if (
      cycleCapExceededButLiveAttempt &&
      squatMotionEvidenceV2.usableMotionEvidence &&
      squatMotionEvidenceV2.blockReason === null
    ) {
      // V2's slow-descent exception fired — recovery happened inside V2
      windowRecoveryApplied = true;
      windowRecoveryReason = 'slow_descent_cycle_cap_v2_exception';
    } else if (peakAtTailStall && activeEpoch.usedRollingFallback === false) {
      // Epoch preserved at descent-start anchor despite peak being at tail
      windowRecoveryApplied = true;
      windowRecoveryReason = 'peak_at_tail_stall_epoch_preserved';
    }
    m.windowRecoveryApplied = windowRecoveryApplied;
    m.windowRecoveryReason = windowRecoveryReason;
    m.epochResetReason_v2 = activeEpoch.epochResetReason;

    // ── PR04C: Debug depth sample (debug only — NOT used in pass logic) ─
    // PR04D: v2DepthsSrc now reflects the SELECTED depth series (not always blended).
    const v2DepthsSrc = v2DepthSelection.depths;
    const peakIdxDebug = peakFrameIndex_v2 ?? 0;
    const aroundStart = Math.max(0, peakIdxDebug - 5);
    const aroundEnd = Math.min(v2EvalFrames.length, peakIdxDebug + 6);
    m.v2EvalDepthsSample = {
      first10: v2DepthsSrc.slice(0, 10),
      aroundPeak: v2DepthsSrc.slice(aroundStart, aroundEnd),
      last10: v2DepthsSrc.slice(-10),
      timestampsFirst10: v2EvalFrames.slice(0, 10).map((f) => f.timestampMs ?? 0),
      timestampsAroundPeak: v2EvalFrames
        .slice(aroundStart, aroundEnd)
        .map((f) => f.timestampMs ?? 0),
      timestampsLast10: v2EvalFrames.slice(-10).map((f) => f.timestampMs ?? 0),
    };

    // ── PR04D: Depth source selection policy metrics (debug only) ──────────
    m.runtimeV2DepthEffectiveSource = v2DepthSelection.source;
    m.runtimeV2DepthPolicy = v2DepthSelection.policy;
    m.v2DepthSourceSwitchReason = v2DepthSelection.switchReason;
    m.v2DepthSourceStats = {
      blended: v2DepthSelection.stats.blended,
      proxy: v2DepthSelection.stats.proxy,
      raw: v2DepthSelection.stats.raw,
    };
    m.selectedV2DepthFirst10 = v2DepthsSrc.slice(0, 10);
    m.selectedV2DepthAroundPeak = v2DepthsSrc.slice(aroundStart, aroundEnd);
    m.selectedV2DepthLast10 = v2DepthsSrc.slice(-10);
  }
  if (validRaw.length < MIN_VALID_FRAMES) {
    const emptyDiag = {
      criticalJointAvailability: 0,
      missingCriticalJoints: [] as string[],
      leftSideCompleteness: 0,
      rightSideCompleteness: 0,
      leftRightAsymmetry: 0,
      metricSufficiency: 0,
      frameCount: 0,
      instabilityFlags: [] as string[],
    };
    return {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['rep_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: validRaw.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        highlightedMetrics: {
          validFrameCount: validRaw.length,
          completionMachinePhase: 'idle',
          completionPassReason: 'not_confirmed',
          completionSatisfied: false,
        },
        perStepDiagnostics: { descent: emptyDiag, bottom: emptyDiag, ascent: emptyDiag },
        squatInternalQuality: squatInternalQualityInsufficientSignal(),
        squatMotionEvidenceV2,
      },
    };
  }

  /** Setup false-pass lock: dwell 충족 지점 이후만 rep 파이프라인에 넣는다. */
  const dwell = computeSquatReadinessStableDwell(validRaw);
  const valid = dwell.satisfied ? validRaw.slice(dwell.firstSliceStartIndexInValid) : [];
  const squatSetupPhaseTrace = {
    readinessStableDwellSatisfied: dwell.satisfied,
    setupMotionBlocked: false as boolean,
    setupMotionBlockReason: null as string | null,
    attemptStartedAfterReady: dwell.satisfied && valid.length >= MIN_VALID_FRAMES,
  };

  if (valid.length < MIN_VALID_FRAMES) {
    const emptyDiag = {
      criticalJointAvailability: 0,
      missingCriticalJoints: [] as string[],
      leftSideCompleteness: 0,
      rightSideCompleteness: 0,
      leftRightAsymmetry: 0,
      metricSufficiency: 0,
      frameCount: 0,
      instabilityFlags: [] as string[],
    };
    const qh = new Set(validRaw.flatMap((frame) => frame.qualityHints));
    if (!dwell.satisfied) qh.add('readiness_dwell_not_met');
    return {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: !dwell.satisfied ? '캡처 준비 연속 구간 부족' : '프레임 부족',
      qualityHints: [...qh],
      completionHints: ['rep_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: validRaw.length,
        validFrameCountAfterReadinessDwell: valid.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        squatSetupPhaseTrace,
        highlightedMetrics: {
          validFrameCount: validRaw.length,
          completionMachinePhase: 'idle',
          completionPassReason: 'not_confirmed',
          completionSatisfied: false,
        },
        perStepDiagnostics: { descent: emptyDiag, bottom: emptyDiag, ascent: emptyDiag },
        squatInternalQuality: squatInternalQualityInsufficientSignal(),
        squatMotionEvidenceV2,
      },
    };
  }

  const setupBlock = computeSquatSetupMotionBlock(valid);
  squatSetupPhaseTrace.setupMotionBlocked = setupBlock.blocked;
  squatSetupPhaseTrace.setupMotionBlockReason = setupBlock.reason;

  const metrics: EvaluatorMetric[] = [];
  const rawMetrics: EvaluatorMetric[] = [];
  const interpretedSignals: string[] = [];
  const qualityHints = [...new Set(valid.flatMap((frame) => frame.qualityHints))];
  const completionHints: string[] = [];
  const depthValues = getNumbers(valid.map((frame) => frame.derived.squatDepthProxy));
  const kneeTracking = getNumbers(valid.map((frame) => frame.derived.kneeTrackingRatio));
  const trunkLeanValues = getNumbers(valid.map((frame) => frame.derived.trunkLeanDeg)).map((value) =>
    Math.abs(value)
  );
  const asymmetryValues = getNumbers(valid.map((frame) => frame.derived.kneeAngleGap));
  const weightShiftValues = getNumbers(valid.map((frame) => frame.derived.weightShiftRatio));
  const bottomFrames = valid.filter((frame) => frame.phaseHint === 'bottom');
  const bottomDepths = getNumbers(bottomFrames.map((frame) => frame.derived.squatDepthProxy));

  const bottomStability =
    bottomDepths.length > 1
      ? clamp(1 - (Math.max(...bottomDepths) - Math.min(...bottomDepths)) / 0.2)
      : 0;
  const startCount = countPhases(valid, 'start');
  const descentCount = countPhases(valid, 'descent');
  const bottomCount = countPhases(valid, 'bottom');
  const ascentCount = countPhases(valid, 'ascent');
  const recovery = getSquatRecoverySignal(valid);
  const ascentSatisfied = ascentCount > 0 || recovery.recovered;

  const unstableHintHits = qualityHints.filter((h) =>
    ['unstable_bbox', 'unstable_landmarks', 'timestamp_gap'].includes(h)
  ).length;
  const signalIntegrityMultiplier = Math.max(0.55, 1 - unstableHintHits * 0.14);

  /** PR-COMP-03: completion 상태 **이전**에 계산 — gate·completion과 무관 */
  const squatInternalQuality = computeSquatInternalQuality({
    peakDepthProxy: depthValues.length > 0 ? Math.max(...depthValues) : 0,
    meanDepthProxy: depthValues.length > 0 ? mean(depthValues) : 0,
    bottomStability,
    trunkLeanDegMeanAbs: trunkLeanValues.length > 0 ? mean(trunkLeanValues) : null,
    kneeTrackingMean: kneeTracking.length > 0 ? mean(kneeTracking) : null,
    asymmetryDegMean: asymmetryValues.length > 0 ? mean(asymmetryValues) : null,
    weightShiftMean: weightShiftValues.length > 0 ? mean(weightShiftValues) : null,
    validFrameRatio: frames.length > 0 ? valid.length / frames.length : 0,
    descentCount,
    bottomCount,
    ascentCount,
    recoveryDropRatio: recovery.recoveryDropRatio,
    returnContinuityFrames: recovery.returnContinuityFrames,
    signalIntegrityMultiplier,
  });

  /** PR-HOTFIX-02: 서 있기 안정 구간 이후에만 completion 상태기에 프레임 전달 */
  // PR-X1: make the existing shared descent surface available before arming.
  // This is timing stabilization only; pass-core remains a downstream consumer.
  const passWindow = buildSquatPassWindow(valid);
  const sharedDescentTruth = passWindow.usable
    ? computeSquatDescentTruth({
        frames: passWindow.passWindowFrames,
        baseline: passWindow.passWindowBaseline,
      })
    : null;

  const { arming: baseArming, completionFrames: naturalCompletionFrames } = computeSquatCompletionArming(valid);

  /** PR-HMM-04A: 동일 버퍼로 HMM decode → arming 보조 판단 (final gate 아님) */
  const hmmOnValid = decodeSquatHmm(valid);
  const armingAssistDec = getSquatHmmArmingAssistDecision(valid, hmmOnValid, { armed: baseArming.armed });
  const sharedDescentArmingStabilizationApplied =
    !baseArming.armed &&
    armingAssistDec.assistApplied !== true &&
    setupBlock.blocked !== true &&
    passWindow.usable === true &&
    sharedDescentTruth?.descentDetected === true &&
    sharedDescentTruth.descentStartAtMs != null &&
    sharedDescentTruth.peakAtMs != null &&
    sharedDescentTruth.peakIndex != null &&
    sharedDescentTruth.peakIndex > 0 &&
    sharedDescentTruth.relativePeak > 0 &&
    sharedDescentTruth.relativePeak < STANDARD_OWNER_FLOOR;

  /**
   * PR-X2-A — Shallow Epoch Acquisition Contract.
   *
   * Structured acquisition decision derived from the same observability inputs
   * as the existing arming paths. This closes the `not_armed` family gap where
   * `shallowCandidateObserved + downwardCommitmentReached` are both true but
   * no existing arm fires. The decision is additive and never relaxes the
   * setup / readiness / static-only guards. Final pass ownership remains
   * `completion`; this path only contributes to `effectiveArmed`.
   */
  const shallowEpochAcquisition: ShallowEpochAcquisitionDecision =
    computeShallowEpochAcquisitionDecision({
      valid,
      ruleArmed: baseArming.armed === true,
      hmmArmingAssistApplied: armingAssistDec.assistApplied === true,
      sharedDescentArmingStabilizationApplied,
      setupMotionBlocked: setupBlock.blocked === true,
      readinessStableDwellSatisfied: dwell.satisfied === true,
      passWindow,
      sharedDescentTruth,
    });

  const effectiveArmed =
    baseArming.armed ||
    armingAssistDec.assistApplied ||
    sharedDescentArmingStabilizationApplied ||
    shallowEpochAcquisition.acquisitionApplied;
  const completionFrames = !effectiveArmed ? [] : baseArming.armed ? naturalCompletionFrames : valid;

  const squatHmm =
    !effectiveArmed
      ? hmmOnValid
      : baseArming.armed && naturalCompletionFrames.length > 0
        ? decodeSquatHmm(naturalCompletionFrames)
        : hmmOnValid;

  let completionArming: CompletionArmingState = {
    ...baseArming,
    hmmArmingAssistEligible: armingAssistDec.assistEligible,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    hmmArmingAssistReason: armingAssistDec.assistReason,
    effectiveArmed,
    ...(armingAssistDec.assistApplied && !baseArming.armed
      ? {
          completionSliceStartIndex: 0,
          baselineCaptured: valid.length >= 6,
          stableFrames: 0,
          armingStandingWindowRange: undefined,
          armingFallbackUsed: undefined,
          armingPeakAnchored: undefined,
        }
      : {}),
    ...(sharedDescentArmingStabilizationApplied
      ? {
          completionSliceStartIndex: 0,
          baselineCaptured: true,
          stableFrames: 0,
          armingStandingWindowRange: undefined,
          armingFallbackUsed: undefined,
          armingPeakAnchored: undefined,
          sharedDescentArmingStabilizationApplied: true,
          sharedDescentArmingStabilizationReason: 'shared_descent_truth_pre_attempt_stabilization',
        }
      : {}),
    /**
     * PR-X2-A: when this path is the one that upgraded `effectiveArmed`, treat
     * it the same way as shared-descent stabilization for slicing (no upstream
     * arming-truncation slice; completion re-derives the baseline).
     */
    ...(shallowEpochAcquisition.acquisitionApplied &&
    !baseArming.armed &&
    !armingAssistDec.assistApplied &&
    !sharedDescentArmingStabilizationApplied
      ? {
          completionSliceStartIndex: 0,
          baselineCaptured: true,
          stableFrames: 0,
          armingStandingWindowRange: undefined,
          armingFallbackUsed: undefined,
          armingPeakAnchored: undefined,
        }
      : {}),
    shallowEpochAcquisitionApplied: shallowEpochAcquisition.acquisitionApplied,
    shallowEpochAcquisitionEligible: shallowEpochAcquisition.acquisitionEligible,
    shallowEpochAcquisitionReason: shallowEpochAcquisition.acquisitionReason,
    shallowEpochAcquisitionBlockedReason: shallowEpochAcquisition.acquisitionBlockedReason,
    shallowEpochObservationStage: shallowEpochAcquisition.observationStage,
  };
  completionArming = mergeArmingDepthObservability(valid, completionArming);

  const primaryDepthCalib = getNumbers(valid.map((frame) => frame.derived.squatDepthProxy));
  const blendedDepthCalib = getNumbers(
    valid.map((frame) =>
      typeof frame.derived.squatDepthProxyBlended === 'number'
        ? frame.derived.squatDepthProxyBlended
        : frame.derived.squatDepthProxy
    )
  );
  const maxPrimaryCalib = primaryDepthCalib.length > 0 ? Math.max(...primaryDepthCalib) : 0;
  const maxBlendedCalib = blendedDepthCalib.length > 0 ? Math.max(...blendedDepthCalib) : 0;

  /** PR-CAM-29: depth source chain 관측(pass/fail·completion 로직 미변경) */
  let depthBlendObsFallbackPeak = 0;
  let depthBlendObsTravelPeak = 0;
  let squatDepthBlendOfferedCount = 0;
  let squatDepthBlendCapHitCount = 0;
  let squatDepthBlendActiveFrameCount = 0;
  let squatDepthSourceFlipCount = 0;
  let prevDepthSourceKey: string | null = null;
  for (const fr of valid) {
    const d = fr.derived;
    if (typeof d.squatDepthFallbackPeakFrame === 'number' && Number.isFinite(d.squatDepthFallbackPeakFrame)) {
      depthBlendObsFallbackPeak = Math.max(depthBlendObsFallbackPeak, d.squatDepthFallbackPeakFrame);
    }
    if (typeof d.squatDepthBlendEvidence === 'number' && Number.isFinite(d.squatDepthBlendEvidence)) {
      depthBlendObsTravelPeak = Math.max(depthBlendObsTravelPeak, d.squatDepthBlendEvidence);
    }
    if (d.squatDepthBlendOffered) squatDepthBlendOfferedCount += 1;
    if (d.squatDepthBlendCapped) squatDepthBlendCapHitCount += 1;
    if (d.squatDepthBlendActive) squatDepthBlendActiveFrameCount += 1;
    const src = d.squatDepthSource ?? 'primary';
    if (prevDepthSourceKey != null && prevDepthSourceKey !== src) squatDepthSourceFlipCount += 1;
    prevDepthSourceKey = src;
  }

  /**
   * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP:
   * pre-arming standing window 의 `kneeAngleAvg` median 을 완료 코어로 seed 한다.
   *
   * arming (`computeSquatCompletionArming`) 은 standing 이후 프레임만 잘라 `completionFrames`
   * 로 전달하므로, 완료 코어가 내부에서 `depthFrames.slice(0, 6)` 의 knee median 을 뽑으면
   * representative shallow fixture 에서는 descent 프레임이 섞인 median (≈96°) 이 되어
   * source #4 (`legitimateKinematicShallowDescentOnsetFrame`) 가 항상 null 이 된다.
   *
   * 여기서는 **arming truncation 이전** 의 `valid` 버퍼 앞 6프레임에서 동일한 median 규칙
   * (median, not mean — design SSOT §4.1 clause 3) 으로 한 번만 계산해 seed 로 넘긴다.
   * threshold/authority-law/fixture 는 건드리지 않으며, arming 이 없거나 pre-arming 버퍼가
   * 짧으면 seed 는 `undefined` 로 남아 완료 코어의 기존 slice-local fallback 이 그대로 쓰인다.
   */
  const BASELINE_WINDOW_EVAL_KNEE = 6;
  const MIN_BASELINE_KNEE_SAMPLES = 4;
  const kneeBaselineSamples = valid
    .slice(0, BASELINE_WINDOW_EVAL_KNEE)
    .map((f) => f.derived?.kneeAngleAvg ?? null)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  let seedBaselineKneeAngleAvg: number | undefined;
  if (kneeBaselineSamples.length >= MIN_BASELINE_KNEE_SAMPLES) {
    const mid = kneeBaselineSamples.length >> 1;
    seedBaselineKneeAngleAvg =
      kneeBaselineSamples.length % 2 === 0
        ? (kneeBaselineSamples[mid - 1]! + kneeBaselineSamples[mid]!) / 2
        : kneeBaselineSamples[mid]!;
  }
  const preArmingKinematicDescentEpoch = findPreArmingKinematicDescentEpoch(valid, {
    baselineKneeAngleAvg: seedBaselineKneeAngleAvg,
    completionSliceStartIndex: completionArming.completionSliceStartIndex,
    baselineWindowStartValidIndex: 0,
    baselineWindowEndValidIndex: BASELINE_WINDOW_EVAL_KNEE - 1,
  });

  let state = evaluateSquatCompletionState(completionFrames, {
    hmm: squatHmm,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    seedBaselineStandingDepthPrimary: completionArming.armingBaselineStandingDepthPrimary,
    seedBaselineStandingDepthBlended: completionArming.armingBaselineStandingDepthBlended,
    seedBaselineKneeAngleAvg,
    completionSliceStartIndex: completionArming.completionSliceStartIndex,
    preArmingKinematicDescentEpoch: preArmingKinematicDescentEpoch ?? undefined,
    setupMotionBlocked: setupBlock.blocked,
    // DESCENT-TRUTH-RESET-01: shared descent truth aligns descendConfirmed to pass-window truth.
    sharedDescentTruth: sharedDescentTruth ?? undefined,
  });

  /**
   * PASS-AUTHORITY-RESET-01 / DESCENT-TRUTH-RESET-01: Evaluator post-completion pipeline.
   *
   * The evaluator sequencing below operates on the finalized completion truth
   * returned by evaluateSquatCompletionState. The sequence is:
   *
   *   1. Stamp setup-phase context fields (readiness, setupMotionBlocked) onto state —
   *      additive observability only, not completion truth.
   *
   *   PASS-CORE: Derive immutable pass truth BEFORE any policy or late-setup rewrite.
   *      pass-core.ts is the ONLY owner of squat motion pass truth.
   *      sharedDescentTruth is injected so pass-core uses the same peak anchor and
   *      descent result as completion-state and event-cycle.
   *      Result stored in squatPassCore; consumed by auto-progression.
   *
   *   2. Late-setup suppression — ANNOTATION ONLY (PASS-AUTHORITY-RESET-01).
   *      Completion truth (completionSatisfied / completionPassReason / completionBlockedReason)
   *      is NO LONGER rewritten by this check. The pass-core's lateSetupSuppressed gate
   *      handles setup rejection before pass opens. This block now only stamps
   *      standingFinalizeSuppressedByLateSetup for observability.
   *
   *   3. attachShallowTruthObservabilityAlign01 — pure observability re-stamp.
   *
   *   4. applyUltraLowPolicyLock — ANNOTATION ONLY (PASS-AUTHORITY-RESET-01).
   *      Policy fields (ultraLowPolicyBlocked, trace) are set for observability.
   *      Does NOT rewrite completionSatisfied / completionPassReason / completionBlockedReason.
   */

  // ── Step 1: stamp setup-phase context ──
  let standingFinalizeSuppressedByLateSetup = false;
  const preserveProvisionalTerminalAuthorityAgainstLateSetup =
    setupBlock.blocked === true &&
    state.sameEvalShallowTerminalAuthorityFreezeApplied === true &&
    state.provisionalShallowTerminalAuthority === true;
  const setupMotionBlockedForCompletionState =
    preserveProvisionalTerminalAuthorityAgainstLateSetup ? false : setupBlock.blocked;

  state = {
    ...state,
    readinessStableDwellSatisfied: dwell.satisfied,
    setupMotionBlocked: setupMotionBlockedForCompletionState,
    setupMotionBlockReason: setupBlock.reason,
    attemptStartedAfterReady: dwell.satisfied,
    lateSetupMotionBlockedAfterProvisionalAuthority:
      state.lateSetupMotionBlockedAfterProvisionalAuthority === true ||
      preserveProvisionalTerminalAuthorityAgainstLateSetup,
  };

  // ── PASS-CORE: derive immutable pass truth (before policy lock and late-setup annotation) ──
  // DESCENT-TRUTH-RESET-01: pass-core receives the pre-computed sharedDescentTruth so it
  // uses the SAME peak anchor and descent result as completion-state. This eliminates the
  // independent descent authority that previously diverged across modules.
  const squatPassCore = evaluateSquatPassCore({
    depthFrames: passWindow.passWindowFrames,
    baselineStandingDepth: passWindow.passWindowBaseline,
    setupMotionBlocked: setupBlock.blocked,
    setupMotionBlockReason: setupBlock.reason,
    // DESCENT-TRUTH-RESET-01: pre-computed shared truth (same instance as completion-state used)
    sharedDescentTruth: sharedDescentTruth ?? undefined,
    // Trace hints from completion state (non-authoritative — observability only)
    descendConfirmed: state.descendConfirmed,
    downwardCommitmentDelta: state.downwardCommitmentDelta,
    squatReversalToStandingMs: state.squatReversalToStandingMs,
    descendStartAtMs: state.descendStartAtMs,
    completionStateReversalAtMs: state.reversalAtMs,
    completionStateStandingAtMs: state.standingRecoveredAtMs,
    cycleDurationMs: state.cycleDurationMs,
  });

  // ── PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01: rep-identity stale guard ──
  //
  // pass-core evaluates passWindowFrames (ALL valid) while completion-state evaluates
  // completionFrames (arming slice). When the arming re-anchors to a LATER standing
  // segment (e.g. post-rep standing), completionFrames no longer includes the old rep,
  // and completion enters idle/not_armed — but passWindowFrames still contains the full
  // old rep cycle → passCore.passDetected=true (stale).
  //
  // Detection: if passCore.standingRecoveredAtMs is strictly before the first frame of
  // completionFrames (or completionFrames is empty), the pass-core result belongs to a
  // prior rep window and must be suppressed to prevent the contradiction:
  //   passCore.passDetected=true  +  completion=idle/not_armed  →  completion_truth_not_passed
  //
  // Suppression is safe: it cannot open a genuine blocked rep (genuinely blocked reps
  // have passDetected=false already). It only resets a stale positive to false so that
  // the debug observable and the downstream gate are coherent.
  //
  // This guard is sink-only for the passCoreStale flag; it does NOT become a gate owner.
  const squatPassCoreFinal: typeof squatPassCore = (() => {
    if (!squatPassCore.passDetected) return squatPassCore;
    if (squatPassCore.standingRecoveredAtMs == null) return squatPassCore;
    const completionWindowStartTs =
      completionFrames.length > 0 ? completionFrames[0]!.timestampMs : null;
    const isStale =
      completionWindowStartTs == null ||
      squatPassCore.standingRecoveredAtMs < completionWindowStartTs;
    if (!isStale) return squatPassCore;
    return {
      ...squatPassCore,
      passDetected: false,
      passBlockedReason: 'stale_prior_rep',
      repId: null,
      passCoreStale: true,
    };
  })();

  // ── DESCENT-TRUTH-RESET-01: align event-cycle descentDetected to shared descent truth ──
  // event-cycle uses per-frame increments (>= 0.002) which can undercount with smoothing.
  // If the shared descent truth confirms descent but event-cycle's local rule misses it,
  // override event-cycle's descentDetected/descentFrames with the shared truth.
  // This is alignment-only — event-cycle remains a trace/debug surface, not a pass gate.
  if (
    sharedDescentTruth?.descentDetected === true &&
    state.squatEventCycle != null &&
    !state.squatEventCycle.descentDetected
  ) {
    state = {
      ...state,
      squatEventCycle: {
        ...state.squatEventCycle,
        descentDetected: true,
        // Use shared descentFrameCount as the minimum bound to eliminate false "descentFrames=0"
        descentFrames: Math.max(
          state.squatEventCycle.descentFrames,
          sharedDescentTruth.descentFrameCount
        ),
        notes: [
          ...state.squatEventCycle.notes,
          'descent_aligned_to_shared_truth',
        ],
      },
    };
  }

  // ── Step 2: late-setup — ANNOTATION ONLY, no completion truth rewrite ──
  if (state.completionSatisfied && setupBlock.blocked) {
    /**
     * PASS-AUTHORITY-RESET-01: This block now only computes standingFinalizeSuppressedByLateSetup
     * for observability. completionSatisfied, completionPassReason, completionBlockedReason are NOT
     * rewritten here. Setup rejection is handled inside evaluateSquatPassCore (lateSetupSuppressed).
     *
     * Bypass criteria preserved for observability annotation consistency.
     */
    const trajectoryBridgeClosedCycle =
      state.shallowTrajectoryBridgeSatisfied === true &&
      state.descendConfirmed === true &&
      state.attemptStarted === true &&
      state.currentSquatPhase === 'standing_recovered';

    const guardedClosureProofClosedCycle =
      state.guardedShallowTrajectoryClosureProofSatisfied === true &&
      state.completionPassReason === 'official_shallow_cycle' &&
      state.descendConfirmed === true &&
      state.attemptStarted === true &&
      state.currentSquatPhase === 'standing_recovered';

    const bypassLateSetupForClosedCycle =
      trajectoryBridgeClosedCycle ||
      guardedClosureProofClosedCycle ||
      (state.descendConfirmed === true &&
        state.attemptStarted === true &&
        state.ownerAuthoritativeReversalSatisfied === true &&
        state.ownerAuthoritativeRecoverySatisfied === true &&
        state.currentSquatPhase === 'standing_recovered');

    if (bypassLateSetupForClosedCycle) {
      standingFinalizeSuppressedByLateSetup = false;
    } else {
      // Annotation only: mark for observability but do NOT rewrite completion truth.
      standingFinalizeSuppressedByLateSetup = true;
    }
  }

  state = {
    ...state,
    standingFinalizeSuppressedByLateSetup,
  };

  // ── Step 3: re-stamp observability to reflect final state (including late-setup adjustment) ──
  state = attachShallowTruthObservabilityAlign01(state);

  // ── Step 4: product policy — applied exactly once, after canonical closer + late-setup check ──
  state = applyUltraLowPolicyLock(state);

  /** PR-CAM-29B: pose-features guarded shallow ascent — additive observability only */
  let guardedShallowAscentDetected = 0;
  for (let i = 0; i < frames.length; i++) {
    if (hasGuardedShallowSquatAscent(frames, i)) {
      guardedShallowAscentDetected = 1;
      break;
    }
  }

  const lastCompletionFrame =
    completionFrames.length > 0 ? completionFrames[completionFrames.length - 1]! : null;
  const latestSquatDepthProxy =
    lastCompletionFrame != null &&
    typeof lastCompletionFrame.derived.squatDepthProxy === 'number' &&
    Number.isFinite(lastCompletionFrame.derived.squatDepthProxy)
      ? Math.round(lastCompletionFrame.derived.squatDepthProxy * 1000) / 1000
      : null;

  const squatDepthCalibration: SquatDepthCalibrationDebug = {
    maxPrimaryDepth: Math.round(maxPrimaryCalib * 1000) / 1000,
    maxBlendedDepth: Math.round(maxBlendedCalib * 1000) / 1000,
    blendedDepthUsed: maxBlendedCalib > maxPrimaryCalib + 0.006,
    armingDepthSource: completionArming.armingDepthSource ?? null,
    rawDepthPeakPrimary:
      state.rawDepthPeakPrimary != null
        ? Math.round(state.rawDepthPeakPrimary * 1000) / 1000
        : undefined,
    rawDepthPeakBlended:
      state.rawDepthPeakBlended != null
        ? Math.round(state.rawDepthPeakBlended * 1000) / 1000
        : undefined,
    relativeDepthPeakSource: state.relativeDepthPeakSource ?? null,
  };

  const BASELINE_WINDOW_EVAL = 6;
  const compWin = completionFrames.slice(0, BASELINE_WINDOW_EVAL);
  const primBs = getNumbers(compWin.map((f) => f.derived.squatDepthProxy));
  const minPrimB = primBs.length > 0 ? Math.min(...primBs) : 0;
  const blendBaselineCandidates = compWin.map((f) => {
    const r = readSquatCompletionDepth(f);
    const p = f.derived.squatDepthProxy;
    if (r != null && Number.isFinite(r)) return r;
    if (typeof p === 'number' && Number.isFinite(p)) return p;
    return Number.NaN;
  });
  const blendMins = blendBaselineCandidates.filter((x) => Number.isFinite(x));
  const minBlendB = blendMins.length > 0 ? Math.min(...blendMins) : minPrimB;
  const relPeakPrimPct =
    state.rawDepthPeakPrimary != null && Number.isFinite(minPrimB)
      ? Math.max(0, state.rawDepthPeakPrimary - minPrimB) * 100
      : null;
  const relPeakBlendPct =
    state.rawDepthPeakBlended != null && Number.isFinite(minBlendB)
      ? Math.max(0, state.rawDepthPeakBlended - minBlendB) * 100
      : null;

  let squatCompletionPeakIndex: number | null = null;
  let completionPeakDepthScan = -Infinity;
  const depthSrc = state.relativeDepthPeakSource ?? 'primary';
  for (let i = 0; i < completionFrames.length; i++) {
    const f = completionFrames[i]!;
    const p = f.derived.squatDepthProxy;
    if (typeof p !== 'number' || !Number.isFinite(p)) continue;
    const off = depthSrc === 'blended' ? (readSquatCompletionDepth(f) ?? p) : p;
    if (off > completionPeakDepthScan) {
      completionPeakDepthScan = off;
      squatCompletionPeakIndex = i;
    }
  }
  const squatReversalCalibration: SquatReversalCalibrationDebug = {
    reversalConfirmedBy: state.reversalConfirmedBy ?? null,
    reversalDepthDrop: state.reversalDepthDrop ?? null,
    reversalFrameCount: state.reversalFrameCount ?? null,
    peakDepth: state.rawDepthPeak,
    peakIndex: squatCompletionPeakIndex,
  };

  /** PR-HMM-03A: calibration 전용 묶음 — pass/truth 변경 없음 */
  const squatCalibration: SquatCalibrationDebug = {
    ruleCompletionBlockedReason: state.ruleCompletionBlockedReason ?? null,
    postAssistCompletionBlockedReason: state.postAssistCompletionBlockedReason ?? null,
    hmmAssistEligible: state.hmmAssistEligible ?? false,
    hmmAssistApplied: state.hmmAssistApplied ?? false,
    hmmAssistReason: state.hmmAssistReason ?? null,
    assistSuppressedByFinalize: state.assistSuppressedByFinalize ?? false,
    standingRecoveryFinalizeReason: state.standingRecoveryFinalizeReason,
    standingRecoveryBand: state.standingRecoveryBand,
    hmmConfidence: squatHmm.confidence,
    hmmExcursion: squatHmm.effectiveExcursion,
    hmmTransitionCount: squatHmm.transitionCount,
    hmmDominantStateCounts: { ...squatHmm.dominantStateCounts },
    hmmExcursionScore: squatHmm.confidenceBreakdown.excursionScore,
    hmmSequenceScore: squatHmm.confidenceBreakdown.sequenceScore,
    hmmCoverageScore: squatHmm.confidenceBreakdown.coverageScore,
    hmmNoisePenalty: squatHmm.confidenceBreakdown.noisePenalty,
  };

  const globalMaxDepthProxy = depthValues.length > 0 ? Math.max(...depthValues) : 0;
  const completionSliceDepthValues = getNumbers(
    completionFrames.map((frame) => frame.derived.squatDepthProxy)
  );
  const completionSliceMaxDepthProxy =
    completionSliceDepthValues.length > 0 ? Math.max(...completionSliceDepthValues) : 0;
  /** PR-CAM-28: 슬라이스 최댓값이 전역 피크보다 유의하게 낮으면 tail-only 등 mismatch */
  const DEPTH_TRUTH_MISMATCH_EPS = 0.015;
  const depthTruthWindowMismatch =
    effectiveArmed && globalMaxDepthProxy - completionSliceMaxDepthProxy > DEPTH_TRUTH_MISMATCH_EPS
      ? 1
      : 0;
  const sliceMissedMotionCode = !effectiveArmed
    ? 2
    : depthTruthWindowMismatch === 1
      ? 1
      : 0;

  const phaseScan = effectiveArmed ? completionFrames : [];
  const offset = completionArming.completionSliceStartIndex;
  const toGlobalIdx = (idxInSlice: number) =>
    idxInSlice >= 0 ? offset + idxInSlice : -1;
  const firstStartIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'start'));
  const firstDescentIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'descent'));
  const firstBottomIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'bottom'));
  const firstAscentIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'ascent'));
  const firstDescentIdxGlobal = valid.findIndex((f) => f.phaseHint === 'descent');
  const repCountEstimate = state.completionSatisfied ? 1 : 0;

  if (!effectiveArmed) {
    completionHints.push('completion_not_armed');
  }

  if (!state.attemptStarted || !ascentSatisfied) {
    completionHints.push('rep_phase_incomplete');
  } else if (!state.completionSatisfied) {
    completionHints.push(state.completionBlockedReason ?? 'recovery_not_confirmed');
  } else {
    interpretedSignals.push('descend-commit-ascend-standing_recovered pattern detected');
  }

  /** PR G6: depthBand — completion과 분리된 quality 해석. shallow(<35%), moderate(35-55%), deep(>=55%) */
  const depthBand =
    depthValues.length > 0
      ? (() => {
          const peakPct = Math.max(...depthValues) * 100;
          return peakPct >= 55 ? 2 : peakPct >= 35 ? 1 : 0;
        })()
      : 0;

  if (depthValues.length > 0) {
    const avgDepth = mean(depthValues) * 100;
    const peakDepth = Math.max(...depthValues) * 100;
    metrics.push({
      name: 'depth',
      value: Math.round(avgDepth),
      unit: '%',
      trend: peakDepth >= 68 ? 'good' : peakDepth >= 48 ? 'neutral' : 'concern',
    });
    rawMetrics.push({
      name: 'bottom_stability_proxy',
      value: Math.round(bottomStability * 100),
      unit: '%',
      trend: bottomStability >= 0.65 ? 'good' : bottomStability >= 0.45 ? 'neutral' : 'concern',
    });
  }

  if (kneeTracking.length > 0) {
    const avg = mean(kneeTracking);
    metrics.push({
      name: 'knee_alignment_trend',
      value: Math.round(avg * 100) / 100,
      trend: avg > 0.88 && avg < 1.12 ? 'good' : avg > 0.8 && avg < 1.2 ? 'neutral' : 'concern',
    });
  }

  if (trunkLeanValues.length > 0) {
    const avg = mean(trunkLeanValues);
    metrics.push({
      name: 'trunk_lean',
      value: Math.round(avg * 10) / 10,
      unit: 'deg',
      trend: avg < 15 ? 'good' : avg < 24 ? 'neutral' : 'concern',
    });
  }

  if (asymmetryValues.length > 0) {
    const asym = mean(asymmetryValues);
    metrics.push({
      name: 'asymmetry',
      value: Math.round(asym * 10) / 10,
      unit: 'deg',
      trend: asym < 10 ? 'good' : asym < 18 ? 'neutral' : 'concern',
    });
  }

  if (weightShiftValues.length > 0) {
    rawMetrics.push({
      name: 'left_right_weight_shift_proxy',
      value: Math.round(mean(weightShiftValues) * 100),
      unit: '%',
      trend: mean(weightShiftValues) < 0.22 ? 'good' : mean(weightShiftValues) < 0.35 ? 'neutral' : 'concern',
    });
  }

  const perStepDiagnostics = getSquatPerStepDiagnostics(valid, metrics.length);
  const perStepRecord: Record<string, typeof perStepDiagnostics.descent> = {
    descent: perStepDiagnostics.descent,
    bottom: perStepDiagnostics.bottom,
    ascent: perStepDiagnostics.ascent,
  };

  /**
   * PR-3-EVALUATOR-BOUNDARY-CLEANUP: Packaging.
   *
   * buildSquatEvaluatorHighlightedMetrics assembles the read-only debug/observability
   * surface from finalized completion truth. It does NOT write to completion fields.
   * It reads from `state` which at this point has already passed through:
   *   evaluateSquatCompletionState → late-setup check → attachShallowTruthObservabilityAlign01
   *   → applyUltraLowPolicyLock
   */
  const highlightedMetrics = buildSquatEvaluatorHighlightedMetrics({
    state,
    frames,
    valid,
    completionFrames,
    completionArming,
    effectiveArmed,
    squatHmm,
    depthValues,
    globalMaxDepthProxy,
    completionSliceMaxDepthProxy,
    maxPrimaryCalib,
    maxBlendedCalib,
    firstDescentIdx,
    firstDescentIdxGlobal,
    firstBottomIdx,
    firstAscentIdx,
    firstStartIdx,
    depthTruthWindowMismatch,
    sliceMissedMotionCode,
    relPeakPrimPct,
    relPeakBlendPct,
    latestSquatDepthProxy,
    guardedShallowAscentDetected,
    depthBlendObsFallbackPeak,
    depthBlendObsTravelPeak,
    squatDepthBlendOfferedCount,
    squatDepthBlendCapHitCount,
    squatDepthBlendActiveFrameCount,
    squatDepthSourceFlipCount,
    bottomStability,
    startCount,
    descentCount,
    bottomCount,
    ascentCount,
    recovery,
    depthBand,
    repCountEstimate,
  });

  return {
    stepId: 'squat',
    metrics,
    insufficientSignal: false,
    rawMetrics,
    interpretedSignals,
    qualityHints,
    completionHints,
    debug: {
      frameCount: frames.length,
      validFrameCount: valid.length,
      phaseHints: Array.from(new Set(valid.map((frame) => frame.phaseHint))),
      squatCompletionArming: completionArming,
      squatDepthCalibration,
      squatReversalCalibration,
      squatInternalQuality,
      /** PR-CAM-09: typed completion state — auto-progression reads this directly */
      squatCompletionState: state,
      /**
       * PASS-AUTHORITY-RESET-01 / PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01:
       * Stale-guarded motion pass authority result.
       *
       * squatPassCore is the raw pass-core result; squatPassCoreFinal is the
       * rep-identity-guarded version. A result is stale when pass-core's
       * standingRecoveredAtMs is strictly before the current completion window's
       * first frame (or when there are no completion frames at all — unarmed/idle).
       * In that case passDetected is reset to false and passBlockedReason is
       * set to 'stale_prior_rep', preventing the observable contradiction:
       *   passCore.passDetected=true  +  completion_truth_not_passed
       *
       * auto-progression reads squatPassCore.passDetected as final motion pass truth.
       */
      squatPassCore: squatPassCoreFinal,
      /**
       * PASS-WINDOW-RESET-01: pass window build result.
       * Observability only — shows the frame window and baseline pass-core actually used.
       */
      squatPassWindow: passWindow,
      /** Setup false-pass lock: dwell / framing-motion observation (auto-progression / trace) */
      squatSetupPhaseTrace,
      highlightedMetrics,
      perStepDiagnostics: perStepRecord,
      /** PR-HMM-01B: shadow decoder full result — debug only */
      squatHmm,
      squatCalibration,
      /** PR-04E3B: shallow event-cycle helper — populated by completion-state */
      squatEventCycle: state.squatEventCycle,
      /** PR-SQUAT-V2-02: runtime owner decision; legacy pass/completion fields are debug/compat only. */
      squatMotionEvidenceV2,
    },
  };
}

/**
 * PR-3-EVALUATOR-BOUNDARY-CLEANUP: Evaluator packaging helper.
 *
 * Converts finalized completion truth + evaluator-local context into the
 * highlightedMetrics debug surface consumed by auto-progression and debug tooling.
 *
 * OWNERSHIP: Pure packaging — reads from finalized state, produces scalar/code fields.
 * Does NOT write to completionSatisfied, completionPassReason, completionBlockedReason,
 * or any other completion truth field.
 *
 * All fields produced here are observability/debug — NOT gate inputs for auto-progression.
 */
function buildSquatEvaluatorHighlightedMetrics(p: {
  state: ReturnType<typeof evaluateSquatCompletionState> & {
    standingFinalizeSuppressedByLateSetup?: boolean;
  };
  frames: PoseFeaturesFrame[];
  valid: PoseFeaturesFrame[];
  completionFrames: PoseFeaturesFrame[];
  completionArming: ReturnType<typeof mergeArmingDepthObservability>;
  effectiveArmed: boolean;
  squatHmm: ReturnType<typeof decodeSquatHmm>;
  depthValues: number[];
  globalMaxDepthProxy: number;
  completionSliceMaxDepthProxy: number;
  maxPrimaryCalib: number;
  maxBlendedCalib: number;
  firstDescentIdx: number;
  firstDescentIdxGlobal: number;
  firstBottomIdx: number;
  firstAscentIdx: number;
  firstStartIdx: number;
  depthTruthWindowMismatch: number;
  sliceMissedMotionCode: number;
  relPeakPrimPct: number | null;
  relPeakBlendPct: number | null;
  latestSquatDepthProxy: number | null;
  guardedShallowAscentDetected: number;
  depthBlendObsFallbackPeak: number;
  depthBlendObsTravelPeak: number;
  squatDepthBlendOfferedCount: number;
  squatDepthBlendCapHitCount: number;
  squatDepthBlendActiveFrameCount: number;
  squatDepthSourceFlipCount: number;
  bottomStability: number;
  startCount: number;
  descentCount: number;
  bottomCount: number;
  ascentCount: number;
  recovery: ReturnType<typeof getSquatRecoverySignal>;
  depthBand: number;
  repCountEstimate: number;
}) {
  const { state, completionArming, effectiveArmed, squatHmm } = p;

  return {
    depthPeak: p.depthValues.length > 0 ? Math.round(Math.max(...p.depthValues) * 100) : null,
    completionArmingArmed: completionArming.armed ? 1 : 0,
    effectiveArmed: effectiveArmed ? 1 : 0,
    hmmArmingAssistEligible: completionArming.hmmArmingAssistEligible ? 1 : 0,
    hmmArmingAssistApplied: completionArming.hmmArmingAssistApplied ? 1 : 0,
    hmmArmingAssistReason: completionArming.hmmArmingAssistReason ?? null,
    sharedDescentArmingStabilizationApplied:
      completionArming.sharedDescentArmingStabilizationApplied ? 1 : 0,
    sharedDescentArmingStabilizationReason:
      completionArming.sharedDescentArmingStabilizationReason ?? null,
    /** PR-X2-A: shallow epoch acquisition diagnostic surface — trace/debug only, not a gate. */
    shallowEpochAcquisitionApplied: completionArming.shallowEpochAcquisitionApplied ? 1 : 0,
    shallowEpochAcquisitionEligible: completionArming.shallowEpochAcquisitionEligible ? 1 : 0,
    shallowEpochAcquisitionReason: completionArming.shallowEpochAcquisitionReason ?? null,
    shallowEpochAcquisitionBlockedReason:
      completionArming.shallowEpochAcquisitionBlockedReason ?? null,
    shallowEpochObservationStage: completionArming.shallowEpochObservationStage ?? null,
    completionArmingBaselineCaptured: completionArming.baselineCaptured ? 1 : 0,
    completionArmingStableFrames: completionArming.stableFrames,
    completionArmingSliceStart: completionArming.completionSliceStartIndex,
    completionSliceEndIndex: effectiveArmed ? p.valid.length - 1 : -1,
    globalDepthPeak: Math.round(p.globalMaxDepthProxy * 1000) / 1000,
    completionSliceDepthPeak: Math.round(p.completionSliceMaxDepthProxy * 1000) / 1000,
    firstDescentIdxGlobal: p.firstDescentIdxGlobal >= 0 ? p.firstDescentIdxGlobal : -1,
    depthTruthWindowMismatch: p.depthTruthWindowMismatch,
    sliceMissedMotionCode: p.sliceMissedMotionCode,
    completionArmingFallbackUsed: completionArming.armingFallbackUsed ? 1 : 0,
    squatDepthPeakPrimary: Math.round(p.maxPrimaryCalib * 100),
    squatDepthPeakBlended: Math.round(p.maxBlendedCalib * 100),
    squatArmingDepthBlendAssisted: completionArming.armingDepthBlendAssisted ? 1 : 0,
    completionArmingPeakAnchored: completionArming.armingPeakAnchored ? 1 : 0,
    armingRetroApplied: completionArming.armingRetroApplied ? 1 : 0,
    ra: completionArming.armingRetroApplied ?? false,
    completionArmingStandingWindowRange:
      completionArming.armingStandingWindowRange != null
        ? Math.round(completionArming.armingStandingWindowRange * 1000) / 1000
        : null,
    armingBaselineStandingDepthPrimary:
      completionArming.armingBaselineStandingDepthPrimary != null
        ? Math.round(completionArming.armingBaselineStandingDepthPrimary * 100) / 100
        : null,
    armingBaselineStandingDepthBlended:
      completionArming.armingBaselineStandingDepthBlended != null
        ? Math.round(completionArming.armingBaselineStandingDepthBlended * 100) / 100
        : null,
    completionBaselineSeeded: state.baselineSeeded === true ? 1 : 0,
    baselineStandingDepth: Math.round(state.baselineStandingDepth * 100) / 100,
    rawDepthPeak: Math.round(state.rawDepthPeak * 100) / 100,
    relativeDepthPeak: Math.round(state.relativeDepthPeak * 100) / 100,
    latestSquatDepthProxy: p.latestSquatDepthProxy,
    squatRelativeDepthPeakPrimary:
      p.relPeakPrimPct != null ? Math.round(p.relPeakPrimPct * 10) / 10 : null,
    squatRelativeDepthPeakBlended:
      p.relPeakBlendPct != null ? Math.round(p.relPeakBlendPct * 10) / 10 : null,
    squatRelativeDepthSourceCode:
      state.relativeDepthPeakSource === 'primary'
        ? 1
        : state.relativeDepthPeakSource === 'blended'
          ? 2
          : 0,
    guardedShallowAscentDetected: p.guardedShallowAscentDetected,
    squatDepthObsFallbackPeak: Math.round(p.depthBlendObsFallbackPeak * 1000) / 1000,
    squatDepthObsTravelPeak: Math.round(p.depthBlendObsTravelPeak * 1000) / 1000,
    squatDepthBlendOfferedCount: p.squatDepthBlendOfferedCount,
    squatDepthBlendCapHitCount: p.squatDepthBlendCapHitCount,
    squatDepthBlendActiveFrameCount: p.squatDepthBlendActiveFrameCount,
    squatDepthSourceFlipCount: p.squatDepthSourceFlipCount,
    firstDescentIdx: p.firstDescentIdx,
    firstBottomIdx: p.firstBottomIdx,
    firstAscentIdx: p.firstAscentIdx,
    depthBand: p.depthBand,
    bottomStability: Math.round(p.bottomStability * 100),
    startCount: p.startCount,
    descentCount: p.descentCount,
    bottomCount: p.bottomCount,
    ascentCount: p.ascentCount,
    ascentRecovered: p.recovery.recovered ? 1 : 0,
    ascentRecoveredLowRom: p.recovery.lowRomRecovered ? 1 : 0,
    ascentRecoveredUltraLowRom: p.recovery.ultraLowRomRecovered ? 1 : 0,
    ascentRecoveredUltraLowRomGuarded: p.recovery.ultraLowRomGuardedRecovered ? 1 : 0,
    recoveryDrop: Math.round(p.recovery.recoveryDrop * 100),
    attemptStarted: state.attemptStarted,
    currentSquatPhase: state.currentSquatPhase,
    descendConfirmed: state.descendConfirmed,
    committedAtMs: state.committedAtMs ?? null,
    ascendConfirmed: state.ascendConfirmed,
    standingRecoveredAtMs: state.standingRecoveredAtMs ?? null,
    standingRecoveryHoldMs: state.standingRecoveryHoldMs,
    standingRecoveryFrameCount: state.standingRecoveryFrameCount,
    standingRecoveryThreshold: Math.round(state.standingRecoveryThreshold * 100) / 100,
    standingRecoveryMinFramesUsed: state.standingRecoveryMinFramesUsed,
    standingRecoveryMinHoldMsUsed: state.standingRecoveryMinHoldMsUsed,
    standingRecoveryBand: state.standingRecoveryBand,
    standingRecoveryFinalizeReason: state.standingRecoveryFinalizeReason,
    squatStandingBandHit: state.standingRecoveredAtMs != null ? 1 : 0,
    squatFinalizeGateOk:
      state.standingRecoveryFinalizeReason === 'standing_hold_met' ||
      state.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize' ||
      state.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize'
        ? 1
        : 0,
    successPhaseAtOpen: state.successPhaseAtOpen ?? null,
    evidenceLabel: state.evidenceLabel,
    completionBlockedReason: state.completionBlockedReason,
    completionSatisfied: state.completionSatisfied,
    shallowProofStage: state.shallowClosureProofTrace?.stage ?? null,
    shallowProofBlockedReason: state.shallowClosureProofTrace?.proofBlockedReason ?? null,
    shallowConsumptionBlockedReason:
      state.shallowClosureProofTrace?.consumptionBlockedReason ?? null,
    completionMachinePhase: state.completionMachinePhase,
    completionPassReason: state.completionPassReason,
    contractA_officialShallowCandidate: state.officialShallowPathCandidate ? 1 : 0,
    contractA_officialShallowAdmitted: state.officialShallowPathAdmitted ? 1 : 0,
    contractB_officialShallowReversal: state.officialShallowReversalSatisfied ? 1 : 0,
    contractB_officialShallowAscentEquiv: state.officialShallowAscentEquivalentSatisfied ? 1 : 0,
    contractC_officialShallowClosed: state.officialShallowPathClosed ? 1 : 0,
    contractC_closureProof: state.officialShallowClosureProofSatisfied ? 1 : 0,
    provisionalShallowTerminalAuthority: state.provisionalShallowTerminalAuthority ? 1 : 0,
    provisionalShallowTerminalAuthorityBlockedReason:
      state.provisionalShallowTerminalAuthorityBlockedReason ?? null,
    provisionalShallowTerminalAuthoritySource:
      state.provisionalShallowTerminalAuthoritySource ?? null,
    provisionalShallowTerminalAuthorityFirstFrameCount:
      state.provisionalShallowTerminalAuthorityFirstFrameCount ?? null,
    sameEvalShallowTerminalAuthorityFreezeApplied:
      state.sameEvalShallowTerminalAuthorityFreezeApplied ? 1 : 0,
    sameEvalShallowTerminalAuthorityFreezeRecoveredFrom:
      state.sameEvalShallowTerminalAuthorityFreezeRecoveredFrom ?? null,
    lateSetupMotionBlockedAfterProvisionalAuthority:
      state.lateSetupMotionBlockedAfterProvisionalAuthority ? 1 : 0,
    contractC_shallowDriftedToStandard: state.officialShallowDriftedToStandard ? 1 : 0,
    recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
    recoveryTrailingDepthCount: state.recoveryTrailingDepthCount,
    recoveryDropRatio:
      state.recoveryDropRatio != null
        ? Math.round(state.recoveryDropRatio * 100) / 100
        : undefined,
    lowRomRecoveryReason: state.lowRomRecoveryReason,
    ultraLowRomRecoveryReason: state.ultraLowRomRecoveryReason,
    repCount: p.repCountEstimate,
    cycleComplete: state.cycleComplete ? 1 : 0,
    startBeforeBottom: state.startBeforeBottom ? 1 : 0,
    descendStartAtMs: state.descendStartAtMs,
    peakAtMs: state.peakAtMs,
    reversalAtMs: state.reversalAtMs ?? null,
    ascendStartAtMs: state.ascendStartAtMs,
    recoveryAtMs: state.standingRecoveredAtMs ?? null,
    cycleDurationMs: state.cycleDurationMs,
    preArmingKinematicDescentEpochAccepted:
      state.preArmingKinematicDescentEpochAccepted === true ? 1 : 0,
    preArmingKinematicDescentEpochRejectedReason:
      state.preArmingKinematicDescentEpochRejectedReason ?? null,
    preArmingKinematicDescentEpochValidIndex:
      state.preArmingKinematicDescentEpochValidIndex ?? null,
    selectedCanonicalDescentTimingEpochSource:
      state.selectedCanonicalDescentTimingEpochSource ?? null,
    selectedCanonicalDescentTimingEpochValidIndex:
      state.selectedCanonicalDescentTimingEpochValidIndex ?? null,
    normalizedDescentAnchorCoherent:
      state.normalizedDescentAnchorCoherent === false ? 0 : 1,
    canonicalTemporalEpochOrderSatisfied:
      state.canonicalTemporalEpochOrderSatisfied === true ? 1 : 0,
    canonicalTemporalEpochOrderBlockedReason:
      state.canonicalTemporalEpochOrderBlockedReason ?? null,
    selectedCanonicalPeakEpochValidIndex:
      state.selectedCanonicalPeakEpochValidIndex ?? null,
    selectedCanonicalPeakEpochAtMs:
      state.selectedCanonicalPeakEpochAtMs ?? null,
    selectedCanonicalPeakEpochSource:
      state.selectedCanonicalPeakEpochSource ?? null,
    selectedCanonicalReversalEpochValidIndex:
      state.selectedCanonicalReversalEpochValidIndex ?? null,
    selectedCanonicalReversalEpochAtMs:
      state.selectedCanonicalReversalEpochAtMs ?? null,
    selectedCanonicalReversalEpochSource:
      state.selectedCanonicalReversalEpochSource ?? null,
    selectedCanonicalRecoveryEpochValidIndex:
      state.selectedCanonicalRecoveryEpochValidIndex ?? null,
    selectedCanonicalRecoveryEpochAtMs:
      state.selectedCanonicalRecoveryEpochAtMs ?? null,
    selectedCanonicalRecoveryEpochSource:
      state.selectedCanonicalRecoveryEpochSource ?? null,
    temporalEpochOrderTrace:
      state.temporalEpochOrderTrace ?? null,
    downwardCommitmentDelta: Math.round(state.downwardCommitmentDelta * 100) / 100,
    squatReversalDropRequiredPct:
      state.squatReversalDropRequired != null
        ? Math.round(state.squatReversalDropRequired * 1000) / 10
        : null,
    squatReversalDropAchievedPct:
      state.squatReversalDropAchieved != null
        ? Math.round(state.squatReversalDropAchieved * 1000) / 10
        : null,
    squatDescentToPeakMs: state.squatDescentToPeakMs ?? null,
    squatReversalToStandingMs: state.squatReversalToStandingMs ?? null,
    hmmConfidence: squatHmm.confidence,
    hmmExcursionScore: Math.round(squatHmm.confidenceBreakdown.excursionScore * 1000) / 1000,
    hmmSequenceScore: Math.round(squatHmm.confidenceBreakdown.sequenceScore * 1000) / 1000,
    hmmCoverageScore: Math.round(squatHmm.confidenceBreakdown.coverageScore * 1000) / 1000,
    hmmNoisePenalty: Math.round(squatHmm.confidenceBreakdown.noisePenalty * 1000) / 1000,
    hmmCompletionCandidate: squatHmm.completionCandidate ? 1 : 0,
    hmmStandingCount: squatHmm.dominantStateCounts.standing,
    hmmDescentCount: squatHmm.dominantStateCounts.descent,
    hmmBottomCount: squatHmm.dominantStateCounts.bottom,
    hmmAscentCount: squatHmm.dominantStateCounts.ascent,
    hmmExcursion: squatHmm.effectiveExcursion,
    hmmAssistEligible: state.hmmAssistEligible ? 1 : 0,
    hmmAssistApplied: state.hmmAssistApplied ? 1 : 0,
    ruleCompletionBlockedReasonCode: squatCompletionBlockedReasonToCode(
      state.ruleCompletionBlockedReason ?? null
    ),
    postAssistCompletionBlockedReasonCode: squatCompletionBlockedReasonToCode(
      state.postAssistCompletionBlockedReason ?? null
    ),
    assistSuppressedByFinalize: state.assistSuppressedByFinalize ? 1 : 0,
    hmmTransitionCount: squatHmm.transitionCount,
    hmmReversalAssistEligible: state.hmmReversalAssistEligible ? 1 : 0,
    hmmReversalAssistApplied: state.hmmReversalAssistApplied ? 1 : 0,
    hmmReversalAssistReason: state.hmmReversalAssistReason ?? null,
    squatReversalSourceCode:
      state.reversalConfirmedBy === 'rule'
        ? 1
        : state.reversalConfirmedBy === 'rule_plus_hmm'
          ? 2
          : 0,
    squatReversalDepthDrop:
      state.reversalDepthDrop != null
        ? Math.round(state.reversalDepthDrop * 1000) / 1000
        : null,
    squatReversalFrameCount: state.reversalFrameCount ?? null,
    squatBaselineFrozen: state.baselineFrozen ? 1 : 0,
    squatPeakLatched: state.peakLatched ? 1 : 0,
    squatPeakLatchedAtIndex: state.peakLatchedAtIndex ?? null,
    baselineFrozenDepth:
      state.baselineFrozenDepth != null && Number.isFinite(state.baselineFrozenDepth)
        ? Math.round(state.baselineFrozenDepth * 1000) / 1000
        : null,
    squatEventCycleDetected: state.squatEventCycle?.detected ? 1 : 0,
    squatEventCycleBandCode:
      state.squatEventCycle?.band === 'low_rom'
        ? 1
        : state.squatEventCycle?.band === 'ultra_low_rom'
          ? 2
          : 0,
    squatEventCyclePromoted: state.eventCyclePromoted ? 1 : 0,
    squatEventCycleSourceCode:
      state.eventCycleSource === 'rule'
        ? 1
        : state.eventCycleSource === 'rule_plus_hmm'
          ? 2
          : 0,
    shallowAuthoritativeStage: state.shallowAuthoritativeStage ?? null,
    shallowObservationLayerReversalTruth: state.shallowObservationLayerReversalTruth ? 1 : 0,
    shallowAuthoritativeReversalTruth: state.shallowAuthoritativeReversalTruth ? 1 : 0,
    shallowObservationLayerRecoveryTruth: state.shallowObservationLayerRecoveryTruth ? 1 : 0,
    shallowAuthoritativeRecoveryTruth: state.shallowAuthoritativeRecoveryTruth ? 1 : 0,
    shallowProvenanceOnlyReversalEvidence: state.shallowProvenanceOnlyReversalEvidence ? 1 : 0,
    truthMismatch_reversalTopVsCompletion: state.truthMismatch_reversalTopVsCompletion ? 1 : 0,
    truthMismatch_recoveryTopVsCompletion: state.truthMismatch_recoveryTopVsCompletion ? 1 : 0,
    truthMismatch_shallowAdmissionVsClosure: state.truthMismatch_shallowAdmissionVsClosure ? 1 : 0,
    truthMismatch_provenanceReversalWithoutAuthoritative:
      state.truthMismatch_provenanceReversalWithoutAuthoritative ? 1 : 0,
    truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery:
      state.truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery ? 1 : 0,
    shallowNormalizedBlockerFamily: state.shallowNormalizedBlockerFamily ?? null,
    shallowAuthoritativeContractStatus: state.shallowAuthoritativeContractStatus ?? null,
    shallowContractAuthoritativeClosure: state.shallowContractAuthoritativeClosure ? 1 : 0,
    shallowContractAuthorityTrace: state.shallowContractAuthorityTrace ?? null,
    ultraLowPolicyScope: state.ultraLowPolicyScope ? 1 : 0,
    ultraLowPolicyDecisionReady: state.ultraLowPolicyDecisionReady ? 1 : 0,
    ultraLowPolicyBlocked: state.ultraLowPolicyBlocked ? 1 : 0,
    ultraLowPolicyTrace: state.ultraLowPolicyTrace ?? null,
    ownerTruthSource: state.ownerTruthSource ?? 'none',
    ownerTruthStage: state.ownerTruthStage ?? null,
    ownerTruthBlockedBy: state.ownerTruthBlockedBy ?? null,
    standingFinalizeSatisfied: state.standingFinalizeSatisfied ? 1 : 0,
    standingFinalizeSuppressedByLateSetup: state.standingFinalizeSuppressedByLateSetup ? 1 : 0,
    standingFinalizeReadyAtMs: state.standingFinalizeReadyAtMs ?? null,
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateSquatFromPoseFrames(buildPoseFeaturesFrames('squat', landmarks));
}

/** CAM-OBS: pass_snapshot JSON 행 — snake_case·camelCase 혼합은 제품 스펙 4.3과 동일 */
export type SquatPassSnapshotObservabilityInput = {
  frameIdx: number;
  passReason: string | null | undefined;
  completionOwner: string | null | undefined;
  eventCyclePromoted: boolean;
  passLatched: boolean;
  descentConfirmed: boolean;
  reversalConfirmedAfterDescend: boolean;
  recoveryConfirmedAfterReversal: boolean;
  peakLatchedAtIndex: number | null;
  bottomPeakTs: number | null | undefined;
  relativeDepthPeak: number;
  currentDepth: number;
  stillSeatedAtPass: boolean;
};

export function formatSquatPassSnapshotObservabilityRow(
  p: SquatPassSnapshotObservabilityInput
): Record<string, unknown> {
  return {
    frame_idx: p.frameIdx,
    pass_reason: p.passReason ?? '',
    completion_owner: p.completionOwner ?? '',
    eventCyclePromoted: p.eventCyclePromoted,
    passLatched: p.passLatched,
    descentConfirmed: p.descentConfirmed,
    reversalConfirmedAfterDescend: p.reversalConfirmedAfterDescend,
    recoveryConfirmedAfterReversal: p.recoveryConfirmedAfterReversal,
    peakLatchedAtIndex: p.peakLatchedAtIndex,
    bottomPeakTs: p.bottomPeakTs ?? null,
    relativeDepthPeak: p.relativeDepthPeak,
    currentDepth: p.currentDepth,
    stillSeatedAtPass: p.stillSeatedAtPass,
  };
}
