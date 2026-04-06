/**
 * Capture quality / confidence guardrail 레이어
 * evaluator 위에서 입력 품질과 재촬영 권장 여부를 판단한다.
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import {
  computeOverheadStableTopDwell,
  OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG,
} from './evaluators/overhead-reach';
import {
  buildOverheadReachFeatureFramesPreDerivedStabilize,
  buildPoseFeaturesFrames,
  getSmoothedPoseLandmarksSequence,
} from './pose-features';
import type { PoseFeaturesFrame } from './pose-features';
import {
  buildOverheadVisualTruthCandidatesExport,
  type OverheadVisualTruthCandidatesExport,
} from './overhead/visual-truth-candidates';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import { HOOK_QUALITY_THRESHOLDS, OVERHEAD_HOOK_QUALITY_THRESHOLDS } from '@/lib/motion/pose-types';
import type { EvaluatorResult } from './evaluators/types';
import type { PoseCaptureStats, PoseHookFirstRejectionSample, PoseHookAdaptorFailureDiag } from './use-pose-capture';
import { selectQualityWindow } from './stability';

export type CaptureQuality = 'ok' | 'low' | 'invalid';
export type CameraFallbackMode = 'survey' | 'retry' | null;
export type CameraGuardrailFlag =
  | 'insufficient_signal'
  | 'framing_invalid'
  | 'landmark_confidence_low'
  | 'valid_frames_too_few'
  | 'rep_incomplete'
  | 'hold_too_short'
  | 'left_side_missing'
  | 'right_side_missing'
  | 'soft_partial'
  | 'hard_partial'
  | 'unstable_frame_timing'
  | 'unstable_bbox'
  | 'unstable_landmarks'
  | 'unilateral_joint_dropout';

type CompletionStatus = 'complete' | 'partial' | 'insufficient';

interface StepMetrics {
  visibleJointsRatio: number;
  averageLandmarkConfidence: number | null;
  criticalJointsAvailability: number;
  bboxSizeStability: number;
  validFrameCount: number;
  droppedFrameRatio: number;
  noisyFrameRatio: number;
  leftSideCompleteness: number;
  rightSideCompleteness: number;
  motionCompleteness: number;
  completionStatus: CompletionStatus;
}

export interface StepGuardrailDebug extends StepMetrics {
  sampledFrameCount: number;
  droppedFrameCount: number;
  captureDurationMs: number;
  metricSufficiency: number;
  timestampDiscontinuityCount?: number;
  warmupExcludedFrameCount?: number;
  qualityFrameCount?: number;
  selectedWindowStartMs?: number | null;
  selectedWindowEndMs?: number | null;
  selectedWindowScore?: number | null;
  /** PR-2: per-step 진단 (evaluator에서 전달, additive) */
  perStepDiagnostics?: Record<string, unknown>;
  /**
   * 발목 Y 좌표 평균 (visibility >= 0.35 인 발목 랜드마크 기준).
   * null = 충분한 가시성의 발목 랜드마크 없음 (화면 밖 또는 미감지).
   * live-readiness 에서 전신 화면 포함 여부 판단에 사용.
   */
  ankleYMean?: number | null;
  /** PR shallow: guardrail partial 시 이유 */
  guardrailPartialReason?: string;
  /** PR squat-state: guardrail complete 시 evidence label (standard | low_rom | ultra_low_rom) */
  guardrailCompletePath?: string;
  /**
   * OBS: overhead 전용 컴팩트 입력 truth 맵(진단·export 전용, 판정 임계 변경 없음).
   * squat 및 다른 스텝에는 설정하지 않는다.
   */
  overheadInputTruthMap?: OverheadInputTruthMap;
  /**
   * PR-OH-VISUAL-TRUTH-OBS-06B: selected-window vs global top-like frame evidence (export-only).
   */
  visualTruthCandidates?: OverheadVisualTruthCandidatesExport | null;
}

/** OBS: overhead 스냅샷·JSON에서 샘플링→훅→feature→가드레일 집계를 분리 표기 */
export interface OverheadInputTruthMap {
  layer1_rawSampled: {
    sampledFrameCount: number;
    captureDurationMs: number;
    timestampDiscontinuityCount: number;
  };
  layer2_hookAcceptance: {
    hookAcceptedFrameCount: number;
    droppedFrameCount: number;
    /** use-pose-capture 훅 경로 기반 compact count-only 분해 */
    poseRejectionBreakdown: Record<string, number>;
    /** OBS: exact threshold values used by getPoseFrameQuality — single source of truth */
    hookThresholdEcho: {
      minCoreVisibilityRatio: number;
      perJointVisibilityThreshold: number;
      coreJointCount: number;
      minBodyBoxArea: number;
      maxBodyBoxArea: number | null;
      /** OH-INPUT-01: which quality profile was active for this session */
      hookQualityMode: 'default' | 'overhead-reach';
    };
    /** OBS: compact measured values from the first rejection that involved core_joints_missing or body_box_invalid */
    hookFirstRejectionSample: PoseHookFirstRejectionSample | null;
    /** OBS: truthful pre-quality diagnostic for landmark/adaptor failure path */
    hookFirstAdaptorFailureDiag: PoseHookAdaptorFailureDiag | null;
  };
  layer3_featureValidity: {
    featureFrameCount: number;
    guardrailValidFrameCount: number;
    invalidFeatureFrameCount: number;
    featureValidityBreakdown: Record<string, number>;
    /**
     * OH-READINESS-02: frames that failed default `isValid` (missing_keypoints) but were
     * admitted by the overhead-specific `isOverheadFrameAnalyzable` check because at least
     * one arm elevation triplet (hip + shoulder + elbow) was usable at the 0.20 threshold.
     * Non-zero value indicates the overhead extended-validity path was exercised.
     */
    overheadExtendedAnalyzableCount: number;
    /**
     * PR-OH-INPUT-READINESS-HARDEN-09A: count of 'missing_keypoints' frames that ALSO failed
     * the overhead arm triplet check at 0.20 visibility threshold.
     * Derived as: frameValidity_missing_keypoints - overheadExtendedAnalyzableCount.
     * Non-zero means even the relaxed arm-triplet path could not admit most frames —
     * the arm-core joints were below 0.20 visibility, indicating a genuine input/setup failure.
     * Diagnostic only — not a gate.
     */
    armTripletCheckFailCount: number;
  };
  layer4_readinessMotion: {
    guardrailValidFrameCount: number;
    qualityWindowVisibleJointsRatio: number;
    qualityWindowCriticalJointsAvailability: number;
    captureQuality: CaptureQuality;
    motionCompletenessStatus: CompletionStatus;
    /**
     * PR-OH-INPUT-READINESS-HARDEN-09A: true when guardrailValidFrameCount >= MIN_VALID_FRAMES.
     * Explicit boundary marker separating "valid overhead input established" from
     * "raw sampling started." Motion evaluation is only meaningful when this is true.
     * When false, the attempt failed before entering motion-truth territory.
     * Diagnostic only — not a gate.
     */
    validInputEstablished: boolean;
    /**
     * PR-OH-INPUT-READINESS-HARDEN-09A: pre-motion input layer outcome classification.
     * Disambiguates input/setup failures from motion-truth failures in the exported trace.
     *
     * 'input_never_established'        — guardrailValidFrameCount < MIN_VALID_FRAMES;
     *                                    motion evaluation is not meaningful for this attempt.
     * 'input_established_motion_failed' — valid input reached, but motion was partial/insufficient.
     * 'input_established_complete'      — valid input + motion completion satisfied.
     *
     * Diagnostic only — not a gate.
     */
    inputLayerOutcome:
      | 'input_never_established'
      | 'input_established_motion_failed'
      | 'input_established_complete';
    /** attempt 스냅샷 시 camera-trace가 readinessSummary에서 병합 */
    readinessState?: string;
    readinessBlocker?: string | null;
  };
}

export interface StepGuardrailResult {
  stepId: CameraStepId;
  captureQuality: CaptureQuality;
  confidence: number;
  flags: CameraGuardrailFlag[];
  retryRecommended: boolean;
  fallbackMode: CameraFallbackMode;
  completionStatus: CompletionStatus;
  debug: StepGuardrailDebug;
}

const MIN_VALID_FRAMES = 8;
/** PR G9: noise floor 0.10 — 이하만 partial. shallower valid cycle complete 허용 */
const SQUAT_NOISE_FLOOR = 0.1;
/** PR G11: low-ROM floor 0.07 — 7–10% excursion with strict recovery can complete */
const SQUAT_LOW_ROM_FLOOR = 0.07;
/** Ultra-low-ROM floor 0.02 — 2–7% excursion with very strict recovery. Real cycle proof only. */
const SQUAT_ULTRA_LOW_ROM_FLOOR = 0.02;
/** PR-A5: guarded ultra-low-ROM floor 0.01 — 1–2% with very strict recovery + persistence. */
const SQUAT_ULTRA_LOW_ROM_GUARDED_FLOOR = 0.01;
/** PR-A6: emergency disable — standing false positive 차단. guarded path 임시 비활성화. */
const ULTRA_LOW_ROM_GUARDED_DISABLED = true;
const WARMUP_MS = 500;
const BEST_WINDOW_MIN_MS = 800;
const BEST_WINDOW_MAX_MS = 1200;
const JITTER_PENALTY_CAP = 0.12;
const FRAMING_PENALTY_CAP = 0.08;
const LANDMARK_PENALTY_CAP = 0.06;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getVisibleJointsRatio(frames: PoseFeaturesFrame[]): number {
  if (frames.length === 0) return 0;
  return mean(frames.map((frame) => frame.visibilitySummary.visibleLandmarkRatio));
}

function getAverageLandmarkConfidence(frames: PoseFeaturesFrame[]): number | null {
  const values = frames
    .map((frame) => frame.visibilitySummary.averageVisibility)
    .filter((value): value is number => typeof value === 'number');
  return values.length > 0 ? mean(values) : null;
}

function getCriticalAvailability(frames: PoseFeaturesFrame[]): number {
  if (frames.length === 0) return 0;
  return mean(frames.map((frame) => frame.visibilitySummary.criticalJointsAvailability));
}

function getSideCompleteness(
  frames: PoseFeaturesFrame[],
  side: 'left' | 'right'
): number {
  if (frames.length === 0) return 0;
  return mean(
    frames.map((frame) =>
      side === 'left'
        ? frame.visibilitySummary.leftSideCompleteness
        : frame.visibilitySummary.rightSideCompleteness
    )
  );
}

function getBboxStability(frames: PoseFeaturesFrame[]): number {
  const areas = frames.map((frame) => frame.bodyBox.area).filter((area) => area > 0);
  if (areas.length < 2) return 0;
  const avg = mean(areas);
  if (avg <= 0) return 0;
  const variance = mean(areas.map((area) => (area - avg) ** 2));
  const stdDev = Math.sqrt(variance);
  return clamp(1 - stdDev / avg);
}

/**
 * visibility >= 0.35 인 발목 랜드마크의 Y 좌표 평균을 반환한다.
 * 반환값이 null 이면 확인 가능한 발목 랜드마크가 없음을 의미한다.
 */
function getAnkleYMean(frames: PoseFeaturesFrame[]): number | null {
  const ys: number[] = [];
  for (const frame of frames) {
    const left = frame.joints.leftAnkle;
    const right = frame.joints.rightAnkle;
    // visibility 미제공 시 1로 간주 (레거시 프레임 호환)
    if (left && (left.visibility ?? 1) >= 0.35) ys.push(left.y);
    if (right && (right.visibility ?? 1) >= 0.35) ys.push(right.y);
  }
  return ys.length > 0 ? mean(ys) : null;
}

function countNoisyFrames(frames: PoseFeaturesFrame[]): number {
  return frames.filter((frame) => {
    return (
      frame.frameValidity !== 'valid' ||
      frame.bodyBox.area < 0.05 ||
      frame.bodyBox.area > 0.95 ||
      frame.qualityHints.includes('timestamp_gap')
    );
  }).length;
}

// ---------------------------------------------------------------------------
// OH-READINESS-02: Overhead-specific feature-validity helpers
// ---------------------------------------------------------------------------
// These helpers are scoped exclusively to overhead-reach. They do NOT modify
// the global getFrameValidity / isValid semantics used by squat and other steps.

/** Minimum per-joint visibility for overhead arm triplet eligibility. */
const OVERHEAD_ARM_TRIPLET_VIS_MIN = 0.20;

/**
 * Returns true when a landmark has sufficient visibility for use in the
 * overhead arm-elevation triplet check. Lower than the global 0.45 threshold
 * to tolerate frame-edge positions during the arm-raise phase.
 */
function isOverheadJointUsable(joint: PoseLandmark | null): boolean {
  if (!joint) return false;
  if (typeof joint.visibility === 'number') return joint.visibility >= OVERHEAD_ARM_TRIPLET_VIS_MIN;
  return true; // no visibility data → treat as usable (legacy frame compat)
}

/**
 * OH-READINESS-02: Overhead-specific frame analyzability guard.
 *
 * The global `frame.isValid` (criticalJointsAvailability >= 0.35 over 8 overhead
 * critical joints including wrists) can reject legitimate overhead frames where
 * wrists / ankles drift to the frame edge during the arm-raise phase.
 *
 * A frame is overhead-analyzable when:
 *   1. frameValidity !== 'invalid' (has 33+ landmarks — already ensured by hook)
 *   2. At least one side's arm-elevation triplet is usable:
 *      hip + shoulder + elbow with per-joint visibility >= 0.20
 *
 * This guarantees `armElevationAvg` can be computed for the frame, which is the
 * primary signal for overhead motion detection.
 *
 * Squat and all other steps use the unmodified `frame.isValid` path.
 */
function isOverheadFrameAnalyzable(frame: PoseFeaturesFrame): boolean {
  if (frame.frameValidity === 'invalid') return false;
  if (frame.isValid) return true; // already passes default criteria

  const { joints } = frame;
  const leftUsable =
    isOverheadJointUsable(joints.leftHip) &&
    isOverheadJointUsable(joints.leftShoulder) &&
    isOverheadJointUsable(joints.leftElbow);
  const rightUsable =
    isOverheadJointUsable(joints.rightHip) &&
    isOverheadJointUsable(joints.rightShoulder) &&
    isOverheadJointUsable(joints.rightElbow);

  return leftUsable || rightUsable;
}

/** Visibility threshold for arm-core critical availability metric (overhead only). */
const OVERHEAD_ARM_CORE_VIS_THRESHOLD = 0.35;

/**
 * OH-READINESS-02: Overhead arm-core critical joint availability.
 *
 * Computes joint availability using only the 6 joints essential for arm-elevation
 * measurement (shoulders + elbows + hips), excluding wrists that commonly exit
 * the frame at full overhead extension.
 *
 * Uses a slightly lower visibility threshold (0.35 vs global 0.45) to accommodate
 * joints at the boundary of the camera frame.
 *
 * This value replaces `criticalJointsAvailability` in the guardrail debug for
 * overhead-reach so that readiness is not falsely blocked by off-screen wrists.
 */
function getOverheadArmCoreAvailability(frame: PoseFeaturesFrame): number {
  const armCoreJoints: Array<PoseLandmark | null> = [
    frame.joints.leftShoulder,
    frame.joints.rightShoulder,
    frame.joints.leftElbow,
    frame.joints.rightElbow,
    frame.joints.leftHip,
    frame.joints.rightHip,
  ];
  const visibleCount = armCoreJoints.filter((joint) => {
    if (!joint) return false;
    if (typeof joint.visibility === 'number') return joint.visibility >= OVERHEAD_ARM_CORE_VIS_THRESHOLD;
    return true;
  }).length;
  return visibleCount / armCoreJoints.length;
}
// ---------------------------------------------------------------------------

function getMotionCompleteness(
  stepId: CameraStepId,
  frames: PoseFeaturesFrame[],
  stats: PoseCaptureStats,
  flags: Set<CameraGuardrailFlag>,
  evaluatorResult?: EvaluatorResult
): { score: number; status: CompletionStatus; partialReason?: string; completePath?: string } {
  if (frames.length < MIN_VALID_FRAMES) {
    flags.add('insufficient_signal');
    flags.add('valid_frames_too_few');
    return { score: 0, status: 'insufficient', partialReason: 'valid_frames_too_few' };
  }

  if (stepId === 'squat') {
    const depthWithIndex = frames
      .map((f, i) => ({ i, d: f.derived.squatDepthProxy }))
      .filter((x): x is { i: number; d: number } => typeof x.d === 'number');
    const depthValues = depthWithIndex.map((x) => x.d);
    const peakDepth = depthValues.length > 0 ? Math.max(...depthValues) : 0;

    /**
     * GUARDRAIL-DECOUPLE-RESET-01: single squat motion-completion owner is pass-core.
     * Do not let legacy highlightedMetrics.completionSatisfied (completion-state) veto
     * guardrail.completionStatus when squatPassCore.passDetected is already true.
     * captureQuality invalid / framing / insufficient valid frames still apply above this branch.
     *
     * Ref: docs/GUARDRAIL_DECOUPLE_RESET_01_TRUTH_MAP_20260404.md
     */
    const passCoreDetected = evaluatorResult?.debug?.squatPassCore?.passDetected === true;
    if (passCoreDetected) {
      return {
        score: clamp(0.45 + peakDepth * 0.55),
        status: 'complete',
        completePath: 'pass_core_motion',
      };
    }

    if (depthValues.length < MIN_VALID_FRAMES) {
      flags.add('rep_incomplete');
      return { score: 0.2, status: 'partial', partialReason: 'depth_values_too_few' };
    }
    const hm = evaluatorResult?.debug?.highlightedMetrics;
    const completionSatisfied =
      hm?.completionSatisfied === true || hm?.completionSatisfied === 1;
    const completionBlockedReason =
      typeof hm?.completionBlockedReason === 'string'
        ? hm.completionBlockedReason
        : 'completion_not_satisfied';
    const evidenceLabel =
      typeof hm?.evidenceLabel === 'string' ? hm.evidenceLabel : 'insufficient_signal';

    if (completionSatisfied) {
      return {
        score: clamp(0.45 + peakDepth * 0.55),
        status: 'complete',
        completePath: evidenceLabel,
      };
    }

    flags.add('rep_incomplete');
    return {
      score: clamp(peakDepth),
      status: 'partial',
      partialReason: completionBlockedReason,
    };
  }

  if (stepId === 'wall-angel') {
    const armElevations = frames
      .map((frame) => frame.derived.armElevationAvg)
      .filter((value): value is number => typeof value === 'number');
    const raiseCount = frames.filter((frame) => frame.phaseHint === 'raise').length;
    const peakCount = frames.filter((frame) => frame.phaseHint === 'peak').length;
    const lowerCount = frames.filter((frame) => frame.phaseHint === 'lower').length;
    const peakElevation = armElevations.length > 0 ? Math.max(...armElevations) : 0;

    if (frames.length < 12 || peakElevation < 95 || raiseCount === 0 || peakCount === 0 || lowerCount === 0) {
      flags.add('rep_incomplete');
      return { score: clamp(peakElevation / 140), status: 'partial' };
    }
    return { score: clamp(peakElevation / 155), status: 'complete' };
  }

  /* PR overhead-dwell: evaluator와 동일한 hold truth — 연속 stable-top dwell time. */
  const OVERHEAD_HOLD_COMPLETE_MS = 1200;
  if (stepId === 'overhead-reach') {
    const hm = evaluatorResult?.debug?.highlightedMetrics;

    // PR-SIMPLE-PASS-01: Primary completion owner check first.
    // If the evaluator's simple rise-hold owner says satisfied, return 'complete' immediately.
    // This prevents old strict/easy/lowRom/humane flags from blocking the new single owner.
    const simplePassSatisfied = hm?.completionSatisfied === true || hm?.completionSatisfied === 1;

    const armElevations = frames
      .map((frame) => frame.derived.armElevationAvg)
      .filter((value): value is number => typeof value === 'number');
    const raiseCount = frames.filter((frame) => frame.phaseHint === 'raise').length;
    const peakElevation = armElevations.length > 0 ? Math.max(...armElevations) : 0;

    if (simplePassSatisfied) {
      const raiseScoreMul = raiseCount === 0 ? 0.95 : 1.0;
      return {
        score: clamp(Math.min(peakElevation / 160, 0.75) * raiseScoreMul),
        status: 'complete',
        completePath: 'simple_pass',
      };
    }

    // Fallback: strict top-zone check (for edge cases and signal coherence)
    const dwellResult = computeOverheadStableTopDwell(frames);
    const holdDurationMs = dwellResult.holdDurationMs;
    const peakCount = frames.filter((f) => f.phaseHint === 'peak').length;
    const stableTopEntered = dwellResult.stableTopEnteredAtMs !== undefined;

    if (
      frames.length < 10 ||
      peakElevation < OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG ||
      raiseCount === 0 ||
      peakCount === 0 ||
      !stableTopEntered
    ) {
      flags.add('rep_incomplete');
      return { score: clamp(peakElevation / 150), status: 'partial' };
    }
    if (holdDurationMs < OVERHEAD_HOLD_COMPLETE_MS) {
      flags.add('hold_too_short');
      return { score: clamp(Math.max(peakElevation / 155, holdDurationMs / 1400)), status: 'partial' };
    }
    return {
      score: clamp(Math.min(peakElevation / 160, Math.max(holdDurationMs / 900, 0.75))),
      status: 'complete',
    };
  }

  const holdFrames = frames.filter(
    (frame) => frame.phaseHint === 'hold_start' || frame.phaseHint === 'hold_ongoing'
  );
  const breakCount = frames.filter((frame) => frame.phaseHint === 'break').length;
  const firstHalf = Math.floor(holdFrames.length / 2);
  const secondHalf = holdFrames.length - firstHalf;

  if (firstHalf < 12) flags.add('left_side_missing');
  if (secondHalf < 12) flags.add('right_side_missing');
  if (firstHalf < 12 || secondHalf < 12) flags.add('hard_partial');
  if (stats.captureDurationMs < 6000 || frames.length < 45) {
    flags.add('hold_too_short');
  }

  const holdDurationMs =
    holdFrames.length > 1 ? holdFrames[holdFrames.length - 1]!.timestampMs - holdFrames[0]!.timestampMs : 0;
  const halfScore = clamp(Math.min(firstHalf, secondHalf) / 35);
  if (flags.has('left_side_missing') || flags.has('right_side_missing')) {
    return { score: clamp(halfScore * 0.7), status: 'partial' };
  }
  if (flags.has('hold_too_short') || holdFrames.length === 0 || breakCount > 0) {
    return { score: clamp(Math.max(holdDurationMs / 9000, holdFrames.length / 70)), status: 'partial' };
  }
  return { score: clamp(Math.min(holdDurationMs / 9000, holdFrames.length / 80)), status: 'complete' };
}

function getMetricSufficiency(stepId: CameraStepId, evaluatorResult: EvaluatorResult): number {
  const expectedMetricsByStep: Record<CameraStepId, number> = {
    squat: 4,
    'overhead-reach': 3,
    'wall-angel': 3,
    'single-leg-balance': 4,
  };
  return clamp(evaluatorResult.metrics.length / expectedMetricsByStep[stepId]);
}

function buildOverheadInputTruthMap(args: {
  featureFrames: PoseFeaturesFrame[];
  stats: PoseCaptureStats;
  guardrailValidFrameCount: number;
  visibleJointsRatio: number;
  criticalJointsAvailability: number;
  captureQuality: CaptureQuality;
  motionCompletenessStatus: CompletionStatus;
}): OverheadInputTruthMap {
  const {
    featureFrames,
    stats,
    guardrailValidFrameCount,
    visibleJointsRatio,
    criticalJointsAvailability,
    captureQuality,
    motionCompletenessStatus,
  } = args;

  const featureFrameCount = featureFrames.length;
  const invalidFeatureFrameCount = Math.max(0, featureFrameCount - guardrailValidFrameCount);

  // OH-READINESS-02: frames that were admitted by the overhead extended path but would
  // have been rejected by the global isValid check (missing_keypoints category).
  const defaultValidFrameCount = featureFrames.filter((f) => f.isValid).length;
  const overheadExtendedAnalyzableCount = Math.max(0, guardrailValidFrameCount - defaultValidFrameCount);

  // PR-OH-INPUT-READINESS-HARDEN-09A: count frames with 'missing_keypoints' that still
  // failed the extended arm triplet check. These are frames where even the relaxed
  // 0.20 visibility threshold could not admit an arm triplet — pure input/setup failure.
  const missingKeypointsCount = featureFrames.filter((f) => f.frameValidity === 'missing_keypoints').length;
  const armTripletCheckFailCount = Math.max(0, missingKeypointsCount - overheadExtendedAnalyzableCount);

  // PR-OH-INPUT-READINESS-HARDEN-09A: explicit input-layer boundary marker.
  const validInputEstablished = guardrailValidFrameCount >= MIN_VALID_FRAMES;
  const inputLayerOutcome: OverheadInputTruthMap['layer4_readinessMotion']['inputLayerOutcome'] =
    !validInputEstablished
      ? 'input_never_established'
      : motionCompletenessStatus === 'complete'
        ? 'input_established_complete'
        : 'input_established_motion_failed';

  const featureValidityBreakdown: Record<string, number> = {};
  for (const f of featureFrames) {
    const fk = `frameValidity_${f.frameValidity}`;
    featureValidityBreakdown[fk] = (featureValidityBreakdown[fk] ?? 0) + 1;
    for (const h of f.qualityHints) {
      const hk = `qualityHint_${h}`;
      featureValidityBreakdown[hk] = (featureValidityBreakdown[hk] ?? 0) + 1;
    }
  }

  const poseRejectionBreakdown: Record<string, number> = {
    landmark_or_adaptor_failed: stats.landmarkOrAdaptorFailedFrameCount ?? 0,
    low_visibility: stats.hookRejectLowVisibilityFrameCount ?? 0,
    core_joints_missing: stats.hookRejectCoreJointsMissingFrameCount ?? 0,
    body_box_invalid: stats.hookRejectBodyBoxInvalidFrameCount ?? 0,
    unstable_frame_flagged: stats.unstableFrameCount,
  };

  return {
    layer1_rawSampled: {
      sampledFrameCount: stats.sampledFrameCount,
      captureDurationMs: stats.captureDurationMs,
      timestampDiscontinuityCount: stats.timestampDiscontinuityCount,
    },
    layer2_hookAcceptance: {
      hookAcceptedFrameCount: stats.validFrameCount,
      droppedFrameCount: stats.droppedFrameCount,
      poseRejectionBreakdown,
      hookThresholdEcho: stats.hookQualityMode === 'overhead-reach'
        ? { ...OVERHEAD_HOOK_QUALITY_THRESHOLDS, hookQualityMode: 'overhead-reach' as const }
        : { ...HOOK_QUALITY_THRESHOLDS, hookQualityMode: 'default' as const },
      hookFirstRejectionSample: stats.hookFirstRejectionSample ?? null,
      hookFirstAdaptorFailureDiag: stats.hookFirstAdaptorFailureDiag ?? null,
    },
    layer3_featureValidity: {
      featureFrameCount,
      guardrailValidFrameCount,
      invalidFeatureFrameCount,
      featureValidityBreakdown,
      overheadExtendedAnalyzableCount,
      armTripletCheckFailCount,
    },
    layer4_readinessMotion: {
      guardrailValidFrameCount,
      qualityWindowVisibleJointsRatio: visibleJointsRatio,
      qualityWindowCriticalJointsAvailability: criticalJointsAvailability,
      captureQuality,
      motionCompletenessStatus,
      validInputEstablished,
      inputLayerOutcome,
    },
  };
}

export function assessStepGuardrail(
  stepId: CameraStepId,
  frames: PoseLandmarks[],
  stats: PoseCaptureStats,
  evaluatorResult: EvaluatorResult
): StepGuardrailResult {
  const featureFrames = buildPoseFeaturesFrames(stepId, frames);
  // OH-READINESS-02: overhead-reach uses an extended analyzability check so that
  // frames with wrists/ankles at frame edges during arm raise are not prematurely
  // rejected. All other steps retain the unmodified isValid path.
  const validFrames = stepId === 'overhead-reach'
    ? featureFrames.filter(isOverheadFrameAnalyzable)
    : featureFrames.filter((frame) => frame.isValid);
  const flags = new Set<CameraGuardrailFlag>();

  const qualitySelection = selectQualityWindow(validFrames, {
    warmupMs: WARMUP_MS,
    minWindowMs: BEST_WINDOW_MIN_MS,
    maxWindowMs: BEST_WINDOW_MAX_MS,
  });
  const qualityFrames = qualitySelection.frames;

  const visibleJointsRatio = getVisibleJointsRatio(qualityFrames);
  const averageLandmarkConfidence = getAverageLandmarkConfidence(qualityFrames);
  // OH-READINESS-02: overhead uses arm-core availability (shoulders + elbows + hips,
  // no wrists) at a slightly relaxed per-joint threshold. This prevents off-screen
  // wrists during arm raise from falsely triggering insufficient_signal / invalid
  // captureQuality and blocking readiness. Squat and other steps are unchanged.
  const criticalJointsAvailability = stepId === 'overhead-reach'
    ? mean(qualityFrames.map(getOverheadArmCoreAvailability))
    : getCriticalAvailability(qualityFrames);
  const bboxSizeStability = getBboxStability(qualityFrames);
  const validFrameCount = validFrames.length;
  const droppedFrameRatio =
    stats.sampledFrameCount > 0 ? stats.droppedFrameCount / stats.sampledFrameCount : 1;
  const noisyFrameRatio =
    validFrameCount > 0 ? countNoisyFrames(validFrames) / validFrameCount : 1;
  const leftSideCompleteness = getSideCompleteness(qualityFrames, 'left');
  const rightSideCompleteness = getSideCompleteness(qualityFrames, 'right');

  if (validFrameCount < MIN_VALID_FRAMES) {
    flags.add('insufficient_signal');
    flags.add('valid_frames_too_few');
  }
  if (visibleJointsRatio < 0.45) flags.add('framing_invalid');
  if (averageLandmarkConfidence !== null && averageLandmarkConfidence < 0.45) {
    flags.add('landmark_confidence_low');
  }
  if (leftSideCompleteness < 0.55) flags.add('left_side_missing');
  if (rightSideCompleteness < 0.55) flags.add('right_side_missing');
  if (Math.abs(leftSideCompleteness - rightSideCompleteness) > 0.35) {
    flags.add('unilateral_joint_dropout');
  }
  const perStep = evaluatorResult.debug?.perStepDiagnostics;
  if (perStep && typeof perStep === 'object') {
    const steps = Object.values(perStep) as Array<{
      missingCriticalJoints?: string[];
      criticalJointAvailability?: number;
      leftSideCompleteness?: number;
      rightSideCompleteness?: number;
    }>;
    const hasHardPartial = steps.some(
      (s) =>
        (s.missingCriticalJoints?.length ?? 0) >= 2 ||
        (s.leftSideCompleteness ?? 1) < 0.55 ||
        (s.rightSideCompleteness ?? 1) < 0.55
    );
    const hasSoftPartial = steps.some(
      (s) =>
        ((s.missingCriticalJoints?.length ?? 0) === 1 && (s.criticalJointAvailability ?? 0) >= 0.6) ||
        ((s.leftSideCompleteness ?? 0) >= 0.55 && (s.leftSideCompleteness ?? 0) < 0.7) ||
        ((s.rightSideCompleteness ?? 0) >= 0.55 && (s.rightSideCompleteness ?? 0) < 0.7)
    );
    if (hasHardPartial) flags.add('hard_partial');
    else if (hasSoftPartial) flags.add('soft_partial');
  } else {
    if (leftSideCompleteness < 0.55 || rightSideCompleteness < 0.55) {
      flags.add('hard_partial');
    }
    if (
      (leftSideCompleteness >= 0.55 && leftSideCompleteness < 0.7) ||
      (rightSideCompleteness >= 0.55 && rightSideCompleteness < 0.7)
    ) {
      flags.add('soft_partial');
    }
  }
  if (droppedFrameRatio > 0.45 || stats.timestampDiscontinuityCount > 0) {
    flags.add('unstable_frame_timing');
  }
  if (bboxSizeStability < 0.45) flags.add('unstable_bbox');
  if (noisyFrameRatio > 0.35) flags.add('unstable_landmarks');

  const motion = getMotionCompleteness(stepId, validFrames, stats, flags, evaluatorResult);
  const metricSufficiency = getMetricSufficiency(stepId, evaluatorResult);

  let captureQuality: CaptureQuality = 'ok';
  if (
    validFrameCount < MIN_VALID_FRAMES ||
    criticalJointsAvailability < 0.4 ||
    visibleJointsRatio < 0.35 ||
    motion.status === 'insufficient'
  ) {
    captureQuality = 'invalid';
  } else if (
    validFrameCount < 16 ||
    criticalJointsAvailability < 0.7 ||
    droppedFrameRatio > 0.25 ||
    noisyFrameRatio > 0.25 ||
    motion.status === 'partial' ||
    leftSideCompleteness < 0.8 ||
    rightSideCompleteness < 0.8
  ) {
    captureQuality = 'low';
  }

  const qualityScore = captureQuality === 'ok' ? 1 : captureQuality === 'low' ? 0.65 : 0.2;
  const validFrameScore = clamp(validFrameCount / 30);
  const sideScore = Math.min(leftSideCompleteness, rightSideCompleteness);

  const jitterRaw =
    (flags.has('unstable_frame_timing') ? droppedFrameRatio * 0.08 : 0) +
    (flags.has('unstable_landmarks') ? noisyFrameRatio * 0.06 : 0);
  const framingRaw =
    (flags.has('soft_partial') ? 0.04 : 0) + (flags.has('hard_partial') ? 0.06 : 0);
  const landmarkRaw =
    averageLandmarkConfidence !== null && averageLandmarkConfidence < 0.45 ? 0.1 : 0;
  const confidencePenalty =
    Math.min(jitterRaw, JITTER_PENALTY_CAP) +
    Math.min(framingRaw, FRAMING_PENALTY_CAP) +
    Math.min(landmarkRaw, LANDMARK_PENALTY_CAP);

  const confidence = round(
    clamp(
      qualityScore * 0.3 +
        validFrameScore * 0.18 +
        motion.score * 0.22 +
        criticalJointsAvailability * 0.15 +
        sideScore * 0.08 +
        bboxSizeStability * 0.04 +
        metricSufficiency * 0.03 -
        confidencePenalty
    )
  );

  const retryRecommended =
    captureQuality !== 'ok' || confidence < 0.72 || flags.has('hard_partial');
  const fallbackMode: CameraFallbackMode =
    captureQuality === 'invalid' ? 'survey' : retryRecommended ? 'retry' : null;

  const overheadInputTruthMap =
    stepId === 'overhead-reach'
      ? buildOverheadInputTruthMap({
          featureFrames,
          stats,
          guardrailValidFrameCount: validFrameCount,
          visibleJointsRatio,
          criticalJointsAvailability,
          captureQuality,
          motionCompletenessStatus: motion.status,
        })
      : undefined;

  const visualTruthCandidates: OverheadVisualTruthCandidatesExport | null | undefined =
    stepId === 'overhead-reach'
      ? buildOverheadVisualTruthCandidatesExport({
          preStabilizeFrames: buildOverheadReachFeatureFramesPreDerivedStabilize(frames),
          smoothedFeatureFrames: featureFrames,
          smoothedHookAcceptedLandmarks: getSmoothedPoseLandmarksSequence(frames),
          selectedWindowStartMs: qualitySelection.selectedWindowStartMs,
          selectedWindowEndMs: qualitySelection.selectedWindowEndMs,
          stats,
          isOverheadAnalyzableFrame: isOverheadFrameAnalyzable,
        })
      : undefined;

  return {
    stepId,
    captureQuality,
    confidence,
    flags: Array.from(flags),
    retryRecommended,
    fallbackMode,
    completionStatus: motion.status,
    debug: {
      visibleJointsRatio: round(visibleJointsRatio),
      averageLandmarkConfidence:
        averageLandmarkConfidence === null ? null : round(averageLandmarkConfidence),
      criticalJointsAvailability: round(criticalJointsAvailability),
      bboxSizeStability: round(bboxSizeStability),
      validFrameCount,
      droppedFrameRatio: round(droppedFrameRatio),
      noisyFrameRatio: round(noisyFrameRatio),
      leftSideCompleteness: round(leftSideCompleteness),
      rightSideCompleteness: round(rightSideCompleteness),
      motionCompleteness: round(motion.score),
      completionStatus: motion.status,
      sampledFrameCount: stats.sampledFrameCount,
      droppedFrameCount: stats.droppedFrameCount,
      captureDurationMs: Math.round(stats.captureDurationMs),
      metricSufficiency: round(metricSufficiency),
      timestampDiscontinuityCount: stats.timestampDiscontinuityCount,
      warmupExcludedFrameCount: qualitySelection.warmupExcludedFrameCount,
      qualityFrameCount: qualitySelection.qualityFrameCount,
      selectedWindowStartMs: qualitySelection.selectedWindowStartMs,
      selectedWindowEndMs: qualitySelection.selectedWindowEndMs,
      selectedWindowScore: qualitySelection.selectedWindowScore === null
        ? null
        : round(qualitySelection.selectedWindowScore),
      perStepDiagnostics: evaluatorResult.debug?.perStepDiagnostics,
      ankleYMean: getAnkleYMean(qualityFrames),
      guardrailPartialReason: motion.status !== 'complete' ? (motion as { partialReason?: string }).partialReason : undefined,
      guardrailCompletePath: motion.status === 'complete' ? (motion as { completePath?: string }).completePath : undefined,
      overheadInputTruthMap,
      visualTruthCandidates,
    },
  };
}
