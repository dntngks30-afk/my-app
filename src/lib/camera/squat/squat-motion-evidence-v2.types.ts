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
  };
  metrics: {
    relativePeak?: number;
    descentMagnitude?: number;
    returnDeltaToStart?: number;
    descentMs?: number;
    ascentMs?: number;
    returnMs?: number;
    estimatedFps?: number;
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
