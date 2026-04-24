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
    /** Description of which epoch source was used to bound V2 input frames. */
    v2EpochSource?: string;
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
