/**
 * PR-V2-INPUT-03: trace-only squat attempt lifecycle label (diagnostics only).
 * Must not be used as pass/fail input outside V2 metrics decoration.
 */
export type SquatV2AttemptState =
  | 'idle'
  | 'baseline_ready'
  | 'descent_committed'
  | 'peak_latched'
  | 'reversal_confirmed'
  | 'return_confirmed'
  | 'stable_recovery'
  | 'pass'
  | 'blocked';

/** PR-V2-INPUT-04: operator-facing label only; not a pass owner. */
export type SquatV2OperatorOutcome = 'pass' | 'blocked' | 'pending' | 'unknown';

/** PR-V2-INPUT-04: depth curve usability label from injected metrics. */
export type SquatV2OperatorCurveStatus = 'usable' | 'unusable' | 'unknown';

/** PR-V2-INPUT-04: translation suspicion label for summaries only. */
export type SquatV2OperatorTranslationStatus =
  | 'none'
  | 'suspected'
  | 'dominant'
  | 'unknown';

export type SquatMotionPatternV2 =
  | 'none'
  | 'standing_only'
  | 'setup_only'
  | 'upper_body_only'
  | 'descent_only'
  | 'bottom_hold'
  | 'incomplete_return'
  | 'down_up_return';

export type SquatMotionRomBandV2 =
  | 'micro'
  | 'shallow'
  | 'standard'
  | 'deep';

export interface SquatMotionEvidenceDecisionV2 {
  usableMotionEvidence: boolean;
  motionPattern: SquatMotionPatternV2;
  romBand: SquatMotionRomBandV2;
  blockReason: string | null;
  qualityWarnings: string[];
  evidence: {
    bodyVisibleEnough: boolean;
    lowerBodyMotionDominant: boolean;
    descent: boolean;
    meaningfulDescent: boolean;
    reversal: boolean;
    nearStartReturn: boolean;
    stableAfterReturn: boolean;
    sameRepOwnership: boolean;
    notSetupPhase: boolean;
    notUpperBodyOnly: boolean;
    notMicroBounce: boolean;
    /** True only when the full descent→reversal→return cycle occurred within the active attempt window. */
    temporalClosureSatisfied: boolean;
    /** True only when the cycle duration (start→return) is within the expected squat window bounds. */
    activeAttemptWindowSatisfied: boolean;
    /**
     * True when stableAfterReturnFrameIndex is within MAX_TAIL_CLOSURE_LAG_MS of the last input frame.
     * False means the closure was detected far in the past (stale closure reuse from setup/positioning).
     */
    closureFreshAtTail: boolean;
    /**
     * True when there are sufficient stable frames before descentStartFrameIndex (pre-descent baseline).
     * False when descentStartFrameIndex=0, meaning no standing baseline before the descent was captured.
     */
    preDescentBaselineSatisfied: boolean;
  };
  metrics: {
    relativePeak?: number;
    descentMagnitude?: number;
    returnDeltaToStart?: number;
    descentMs?: number;
    ascentMs?: number;
    returnMs?: number;
    estimatedFps?: number;
    /** Total frame count passed to V2 for this evaluation. */
    inputFrameCount?: number;
    /** Duration (ms) spanned by the input frames (lastTs - firstTs). */
    inputWindowDurationMs?: number;
    /** Frame index where meaningful descent was first detected. */
    descentStartFrameIndex?: number;
    /** Frame index of the depth peak (bottom of squat). */
    peakFrameIndex?: number;
    /** Frame index where reversal (upward motion after peak) was confirmed. */
    reversalFrameIndex?: number | null;
    /** Frame index where depth first returned to near-start after reversal. */
    nearStartReturnFrameIndex?: number | null;
    /** Frame index of the first stable frame after return. */
    stableAfterReturnFrameIndex?: number | null;
    /** Distance in frames from stableAfterReturnFrameIndex to the last input frame. */
    tailDistanceFrames?: number | null;
    /** Distance in ms from the stable-after-return timestamp to the last input frame timestamp. */
    tailDistanceMs?: number | null;
    /** Non-null when temporal closure or active-window guard blocked pass. */
    closureBlockedReason?: string | null;
    /** Epoch start timestamp (ms) passed from the evaluator to bound V2 input frames. */
    v2EpochStartMs?: number;
    /**
     * Description of which epoch source was used to bound V2 input frames.
     * PR6-FIX-01: primary sources are 'active_attempt_epoch' / 'active_attempt_epoch_with_pre_descent_baseline'.
     * 'rolling_window_fallback' (formerly 'latestValidTs_minus_5000ms') is fallback only.
     */
    v2EpochSource?: string;
    /**
     * PR6-FIX-01: true when the rolling 5s fallback was used instead of an
     * active attempt epoch. Diagnostic signal: V2 may not see the full
     * current-attempt reversal/return cycle.
     */
    usedRollingFallback?: boolean;
    /**
     * PR6-FIX-01: timestamp (ms) of the computed active attempt epoch start.
     * Set by evaluators/squat.ts based on first descent candidate detection.
     * null when no descent candidate was found (rolling fallback used).
     */
    activeAttemptEpochStartMs?: number | null;
    /**
     * PR6-FIX-01: label for how the active attempt epoch was computed.
     * 'first_descent_candidate' | 'readiness_dwell' | 'rolling_fallback'
     */
    activeAttemptEpochSource?: string | null;
    /**
     * PR6-FIX-01: number of stable baseline frames before descentStartFrameIndex
     * in the V2 input window.
     */
    preDescentBaselineFrameCount?: number;
    /**
     * PR6-FIX-01: frames from peakFrameIndex to the last input frame.
     * When ~0, V2 has no room to detect reversal/return.
     */
    peakDistanceFromTailFrames?: number | null;
    /**
     * PR6-FIX-01: ms from peakFrameIndex to the last input frame.
     * When < ~200ms (2 frames at 10fps), V2 cannot detect reversal.
     */
    peakDistanceFromTailMs?: number | null;
    /**
     * PR6-FIX-01: frames after the detected peak in the V2 input window.
     * Alias for peakDistanceFromTailFrames; used in diagnostic report.
     */
    framesAfterPeak?: number | null;
    /** PR6-FIX-01: ms after the detected peak to end of input window. */
    msAfterPeak?: number | null;
    /**
     * PR6-FIX-01: candidate total cycle duration (descentStartMs→lastFrameMs)
     * when closure has not been confirmed yet. Useful to detect cycles heading
     * toward the 4500ms cap before they are blocked.
     */
    cycleDurationCandidateMs?: number | null;
    /**
     * PR6-FIX-01: true when cycleDurationCandidateMs or returnMs exceeded MAX_SQUAT_CYCLE_MS.
     */
    cycleCapExceeded?: boolean;
    /**
     * PR6-FIX-01: reason for epoch reset if one occurred.
     * 'terminal_pass' | 'terminal_fail' | 'readiness_lost' | 'setup_motion_blocked' | null
     */
    epochResetReason?: string | null;
    /**
     * PR6-FIX-01: timestamp (ms) of the last input frame.
     */
    latestFrameTimestampMs?: number | null;
    // ── PR6-FIX-01B: pass cache/latch verification trace fields ──────────
    // DEBUG/TRACE ONLY. Must not influence pass logic.
    /** Timestamp (ms) of the first frame in the V2 evaluation window. */
    v2InputStartMs?: number | null;
    /** Timestamp (ms) of the last frame in the V2 evaluation window. */
    v2InputEndMs?: number | null;
    /** Number of frames in the V2 evaluation window. */
    v2InputFrameCount?: number;
    /** Timestamp (ms) of the oldest frame in the full validRaw buffer. */
    validRawBufferOldestMs?: number | null;
    /** Timestamp (ms) of the newest frame in the full validRaw buffer. */
    validRawBufferNewestMs?: number | null;
    /** Total count of valid frames in the full raw buffer. */
    validRawFrameCount?: number;
    /**
     * Whether a prior squat pass is latched in this session.
     * Populated by auto-progression.ts; null when wired from stateless evaluator.
     */
    previousSquatPassLatchedInSession?: boolean | null;
    /**
     * Timestamp (ms) of the prior squat pass in this session, if any.
     * Populated by auto-progression.ts; null when wired from stateless evaluator.
     */
    previousSquatPassAtMs?: number | null;
    /**
     * Whether V2 input frames include any frames before the prior pass timestamp.
     * True means the buffer window overlaps with a previous pass — not a cache replay.
     * Populated by auto-progression.ts; null when stateless.
     */
    v2InputIncludesFramesBeforeLastPass?: boolean | null;
    /**
     * Identifier for the current squat/camera capture session.
     * Populated by the calling context; null in stateless evaluator.
     */
    squatCaptureSessionId?: string | null;
    // ── PR04C: Peak-at-tail stall detection ──────────────────────────────
    /**
     * True when the peak (squat bottom) frame is the last frame in the V2 input window.
     * Conditions: peakFrameIndex >= inputFrameCount - 1 OR framesAfterPeak <= 0.
     * Indicates the user is still descending or just reached the bottom —
     * V2 cannot detect reversal/return because post-peak frames haven't arrived yet.
     * This is NOT a terminal failure — it is an awaiting_ascent_after_peak state.
     */
    peakAtTailStall?: boolean;
    /**
     * PR04C: Timestamp (ms) since peak-at-tail stall was first detected.
     * Approximated from cycleDurationCandidateMs when persistent state is unavailable.
     */
    peakAtTailStallSinceMs?: number | null;
    /**
     * PR04C: Duration (ms) the peak has been at the tail (stall duration estimate).
     * null when state history is unavailable.
     */
    peakAtTailStallDurationMs?: number | null;
    /**
     * PR04C: True when the active attempt is in awaiting_ascent_after_peak state.
     * The attempt has descended to peak but post-peak ascent frames haven't arrived.
     * The epoch window should remain anchored — do not reset to rolling fallback.
     */
    awaitingAscentAfterPeak?: boolean;
    /**
     * PR04C: Explicit count of frames after the peak frame in the V2 input window.
     * Same as framesAfterPeak (alias). When 0, reversal detection is impossible.
     */
    postPeakFrameCount?: number | null;
    // ── PR04C: Active attempt state machine ──────────────────────────────
    /**
     * PR04C: Current inferred state of the active squat attempt.
     * Derived stateless from V2 outputs + evaluator context.
     * States: 'idle' | 'descending' | 'awaiting_ascent_after_peak' |
     *         'ascending' | 'returned' | 'terminal_pass' | 'terminal_reset'
     */
    activeAttemptState?: string | null;
    /**
     * PR04C: Estimated timestamp (ms) since the current activeAttemptState began.
     * Approximated — requires persistent state for exact tracking.
     */
    activeAttemptStateSinceMs?: number | null;
    /**
     * PR04C: True when the active attempt is considered still live (not stale/terminal).
     * Live = user is descending, at bottom, or ascending — pass not yet confirmed.
     */
    activeAttemptStillLive?: boolean;
    // ── PR04C: Cycle cap vs live attempt distinction ─────────────────────
    /**
     * PR04C: True when cycleCapExceeded=true AND the attempt is identified as live.
     * A slow genuine squat (descent > 4.5s) can exceed the cycle cap
     * without being stale. This flag distinguishes slow-live from stale.
     */
    cycleCapExceededButLiveAttempt?: boolean;
    /**
     * PR04C: True when the block was caused by a detected stale window
     * (closureFreshAtTail=false or genuinely old cycle).
     */
    staleWindowRejected?: boolean;
    // ── PR04C: Window recovery fields ───────────────────────────────────
    /**
     * PR04C: True when the evaluator applied window recovery to ensure V2
     * can evaluate the full cycle (e.g. slow-descent cycle cap bypass).
     */
    windowRecoveryApplied?: boolean;
    /**
     * PR04C: Reason for window recovery, if applied.
     * e.g. 'slow_descent_cycle_cap_exceeded' | 'peak_at_tail_stall_epoch_preserved'
     */
    windowRecoveryReason?: string | null;
    /**
     * PR04C: Reason for epoch reset if one occurred in this tick.
     * Distinct from epochResetReason (which tracks setup_phase_excluded).
     */
    epochResetReason_v2?: string | null;
    // ── PR04C: Peak-to-return duration ──────────────────────────────────
    /**
     * PR04C: Duration (ms) from peak frame to near-start return frame.
     * Represents the ascent portion of the cycle only.
     * Used to distinguish slow-descent squats from stale cycles:
     *   - Slow genuine squat: peakToReturnMs = 1500-3500ms (normal ascent)
     *   - Stale cycle: blocked by closureFreshAtTail before this matters
     */
    peakToReturnMs?: number | null;
    // ── PR04C: Debug depth sample (debug only — NOT used in pass logic) ──
    /**
     * PR04C: Depth value samples from the V2 evaluation window for diagnostics.
     * DEBUG ONLY. Must not influence pass logic.
     */
    v2EvalDepthsSample?: {
      first10?: number[];
      aroundPeak?: number[];
      last10?: number[];
      timestampsFirst10?: number[];
      timestampsAroundPeak?: number[];
      timestampsLast10?: number[];
    } | null;
    // ── PR04D: V2 depth source selection policy ──────────────────────────
    /**
     * PR04D: Which depth source was ultimately selected for V2 input.
     * 'blended' = squatDepthProxyBlended used (normal path)
     * 'proxy'   = squatDepthProxy used (blended was collapsed/tail-spike)
     * 'raw'     = squatDepthProxyRaw used (blended+proxy both unusable)
     * 'mixed'   = per-frame selection (future)
     * 'fallback_zero' = all sources unusable, V2 received zeros
     */
    runtimeV2DepthEffectiveSource?: 'blended' | 'proxy' | 'raw' | 'mixed' | 'fallback_zero';
    /**
     * PR04D: Source selection policy applied.
     * 'blended_usable'                  = blended series has usable curve
     * 'blended_collapsed_proxy_selected' = blended collapsed near zero → proxy
     * 'blended_collapsed_raw_selected'   = blended collapsed, proxy also poor → raw
     * 'tail_spike_proxy_selected'        = blended tail-spike-only → proxy
     * 'tail_spike_raw_selected'          = blended tail-spike, proxy also poor → raw
     * 'fallback_blended'                 = all alternatives also poor → keep blended
     * 'fallback_zero'                    = no usable series
     */
    runtimeV2DepthPolicy?: string;
    /**
     * PR04D: Why the source was switched (if runtimeV2DepthPolicy != 'blended_usable').
     * null when blended was used without fallback.
     */
    v2DepthSourceSwitchReason?: string | null;
    /**
     * PR04D: Per-source depth series quality statistics (debug only).
     * Contains blended, proxy, and raw stats to diagnose source issues.
     */
    v2DepthSourceStats?: {
      blended?: {
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
      proxy?: {
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
      raw?: {
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
    } | null;
    /**
     * PR04D: Selected V2 depth series samples (first 10 / around peak / last 10).
     * Reflects the depth that was actually fed into V2 (after source selection).
     * DEBUG ONLY. Must not influence pass logic.
     */
    selectedV2DepthFirst10?: number[] | null;
    selectedV2DepthAroundPeak?: number[] | null;
    selectedV2DepthLast10?: number[] | null;
    // ── PR-V2-INPUT-01: explicit V2 input owner diagnostics ───────────────
    /** Selected depth channel (landmark or legacy bucket). */
    v2InputSelectedDepthSource?: string;
    /** True when the chosen series passed INPUT-01 curve-usability gates. */
    v2InputDepthCurveUsable?: boolean;
    /** True when a finite candidate was rejected as collapsed / tail-spike / low amplitude / not usable. */
    v2InputFiniteButUselessDepthRejected?: boolean;
    /** Compact candidate stats + reasons (includes PR04D legacy mirror when present). */
    v2InputSourceStats?: Record<string, unknown> | null;
    /** PR-1: lower-body signal source (same as depth series in PR-1). */
    v2InputLowerBodySignalSource?: string;
    // ── PR-V2-INPUT-02: lower-body dominance + translation diagnostics ───────
    /** 0–1: higher means lower-body motion carries more of the combined motion budget. */
    v2LowerBodyDominanceScore?: number;
    /** Combined lower-body motion amplitude (max(depth amp, lower landmark travel)). */
    v2LowerBodyMotionAmplitude?: number;
    /** Upper-body motion amplitude (explicit signal amp or upper landmark travel). */
    v2UpperBodyMotionAmplitude?: number;
    /** lowerMotion / upperMotion when upperMotion > 0. */
    v2LowerUpperMotionRatio?: number;
    /** 0–1 composite diagnostic for translation-like rigid motion (not pass authority alone). */
    v2TranslationSuspicionScore?: number;
    /** True only when conservative AND-gated translation lock fires (see v2TranslationReason). */
    v2TranslationDominant?: boolean;
    /** Set when lower-body dominance fails; mirrors block reason for traces. */
    v2DominanceBlockReason?: string | null;
    /** Non-null when translation lock selected the block reason. */
    v2TranslationReason?: string | null;
    // ── PR-V2-INPUT-03: V2 attempt state (trace-only; not a pass owner) ─────
    /** Diagnostic label from the already-computed decision only. */
    v2AttemptState?: SquatV2AttemptState;
    /** blockReason mirror or short note; does not drive pass logic. */
    v2AttemptStateReason?: string | null;
    /** Sortable ordinal for traces (scheme internal to PR-03). */
    v2AttemptStateIndex?: number;
    /** When state is blocked, furthest progress milestone reached before failure. */
    v2AttemptBlockedAt?: SquatV2AttemptState | string | null;
    /** Furthest milestone along the happy path (or `pass` when usable). */
    v2AttemptFurthestStage?: SquatV2AttemptState | string;
    /** Optional keyframe timestamps for explanation only (missing → null). */
    v2AttemptStageTimestamps?: {
      descentStartMs?: number | null;
      peakMs?: number | null;
      reversalMs?: number | null;
      returnMs?: number | null;
      stableMs?: number | null;
    } | null;
    // ── PR-V2-INPUT-04: operator observability (evaluator-injected metrics only) ──
    /** Compact one-line summary for real-device JSON; display/debug only. */
    v2OperatorSummary?: string;
    v2OperatorOutcome?: SquatV2OperatorOutcome;
    v2OperatorInputSource?: string | null;
    v2OperatorCurveStatus?: SquatV2OperatorCurveStatus;
    v2OperatorBlockedAt?: string | null;
    v2OperatorBlockedReason?: string | null;
    v2OperatorRomBand?: string | null;
    v2OperatorPeakTailFrames?: number | null;
    v2OperatorEpochSource?: string | null;
    v2OperatorUsedRollingFallback?: boolean | null;
    v2OperatorLowerUpperRatio?: number | null;
    v2OperatorTranslationStatus?: SquatV2OperatorTranslationStatus;
    // ── PR-V2-INPUT-05: shallow epoch recovery (evaluator-injected; observability) ──
    v2ShallowRecoveryAttempted?: boolean;
    v2ShallowRecoveryApplied?: boolean;
    v2ShallowRecoveryPrimaryBlockReason?: string | null;
    v2ShallowRecoveryBlockedReason?: string | null;
    v2ShallowRecoveryReason?: string | null;
    v2ShallowRecoveryWindowStartMs?: number | null;
    v2ShallowRecoveryWindowEndMs?: number | null;
    v2ShallowRecoveryWindowFrameCount?: number | null;
    v2ShallowRecoveryCandidatesTried?: number;
  };
}

export type SquatMotionEvidenceFrameV2 = {
  timestampMs?: number;
  timestamp?: number;
  depth?: number;
  lowerBodySignal?: number;
  upperBodySignal?: number;
  bodyVisibleEnough?: boolean;
  lowerBodyVisibleEnough?: boolean;
  setupPhase?: boolean;
  phaseHint?: string;
  isValid?: boolean;
  frameValidity?: string;
  visibilitySummary?: {
    visibleLandmarkRatio?: number | null;
    averageVisibility?: number | null;
    criticalJointsAvailability?: number | null;
    leftSideCompleteness?: number | null;
    rightSideCompleteness?: number | null;
  };
  derived?: {
    squatDepthProxy?: number | null;
    squatDepthProxyBlended?: number | null;
    squatDepthProxyRaw?: number | null;
  };
  joints?: Record<string, { x: number; y: number; visibility?: number | null } | null | undefined>;
  landmarks?: Array<{ x: number; y: number; visibility?: number | null } | null | undefined>;
  /**
   * PR-V2-INPUT-02: per-frame mirror of owner selection (diagnostic context only).
   * Must not be used as pass/veto authority inside V2 motion evidence.
   */
  v2InputOwnerMeta?: {
    selectedDepthSource: string;
    depthCurveUsable: boolean;
  };
};
