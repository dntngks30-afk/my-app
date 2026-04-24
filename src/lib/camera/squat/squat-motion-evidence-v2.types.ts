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
};
