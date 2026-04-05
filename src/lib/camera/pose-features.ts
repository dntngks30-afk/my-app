/**
 * Raw pose landmarks를 evaluator-friendly feature frame으로 변환한다.
 * landmark index 의존은 이 파일 내부에만 가둔다.
 */
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import type { CameraStepId } from '@/lib/public/camera-test';
import { smoothSignalValue, stabilizePhaseSequence } from './stability';
import { buildSquatDepthSignal, SQUAT_DEPTH_PRIMARY_NEAR_FLAT, PRIMARY_STRONG_MIN } from './squat/squat-depth-signal';

export type PoseFrameValidity = 'valid' | 'low_visibility' | 'missing_keypoints' | 'invalid';
export type PosePhaseHint =
  | 'start'
  | 'descent'
  | 'bottom'
  | 'ascent'
  | 'raise'
  | 'peak'
  | 'lower'
  | 'hold_start'
  | 'hold_ongoing'
  | 'break'
  | 'unknown';

type JointKey =
  | 'nose'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'
  | 'torsoCenter'
  | 'shoulderCenter'
  | 'hipCenter'
  | 'ankleCenter';

export interface PoseFeaturesFrame {
  timestampMs: number;
  stepId: CameraStepId;
  frameValidity: PoseFrameValidity;
  phaseHint: PosePhaseHint;
  eventHints: string[];
  qualityHints: string[];
  timestampDeltaMs: number | null;
  isValid: boolean;
  visibilitySummary: {
    visibleLandmarkRatio: number;
    averageVisibility: number | null;
    leftSideCompleteness: number;
    rightSideCompleteness: number;
    criticalJointsAvailability: number;
  };
  bodyBox: {
    area: number;
    width: number;
    height: number;
  };
  joints: Record<JointKey, PoseLandmark | null>;
  derived: {
    kneeAngleLeft: number | null;
    kneeAngleRight: number | null;
    kneeAngleAvg: number | null;
    kneeAngleGap: number | null;
    squatDepthProxy: number | null;
    /** PR-04E1: 스무딩 직전 knee-logistic primary (관측) */
    squatDepthProxyRaw?: number | null;
    /** PR-04E1: arming·phase shallow 가드용 blended depth (primary 보조) */
    squatDepthProxyBlended?: number | null;
    /** PR-04E1: 'primary' | 'fallback' | 'blended' */
    squatDepthSource?: string | null;
    /** PR-CAM-29: cap 전 blended 후보·증거(temporal/진단 전용, optional) */
    squatDepthBlendRaw?: number | null;
    squatDepthBlendEvidence?: number | null;
    squatDepthBlendCapped?: boolean;
    /** temporal 게이트 통과 후 실제 blended 출력이 나간 프레임 */
    squatDepthBlendActive?: boolean;
    squatDepthBlendTemporalSuppressed?: boolean;
    squatDepthFallbackPeakFrame?: number | null;
    /** raw 신호가 blended 를 제안했는지(temporal 전) */
    squatDepthBlendOffered?: boolean;
    kneeTrackingRatio: number | null;
    trunkLeanDeg: number | null;
    torsoExtensionDeg: number | null;
    weightShiftRatio: number | null;
    armElevationLeft: number | null;
    armElevationRight: number | null;
    armElevationAvg: number | null;
    armElevationGap: number | null;
    /**
     * PR-OH-KINEMATIC-SIGNAL-04B — Overhead-only candidate kinematics (null unless stepId is overhead-reach).
     * shoulderWrist*: 2D ∠(hip→shoulder→wrist) in image plane (deg), x/y only — full arm vs torso proxy; not a gate signal.
     * wristAboveShoulder*: (shoulder.y − wrist.y) / max(|shoulder.y − hip.y|, floor); + when wrist above shoulder; unitless; z unused.
     * elbowAboveShoulder*: same for elbow vs shoulder — “upper joint above shoulder line” proxy.
     */
    shoulderWristElevationLeftDeg: number | null;
    shoulderWristElevationRightDeg: number | null;
    shoulderWristElevationAvgDeg: number | null;
    wristAboveShoulderLeftNorm: number | null;
    wristAboveShoulderRightNorm: number | null;
    wristAboveShoulderAvgNorm: number | null;
    elbowAboveShoulderLeftNorm: number | null;
    elbowAboveShoulderRightNorm: number | null;
    elbowAboveShoulderAvgNorm: number | null;
    elbowAngleLeft: number | null;
    elbowAngleRight: number | null;
    wristElbowAlignmentLeft: number | null;
    wristElbowAlignmentRight: number | null;
    shoulderSymmetry: number | null;
    pelvicDrop: number | null;
    swayAmplitude: number | null;
    holdBalance: number | null;
    footHeightGap: number | null;
    footDownDetected: boolean;
    torsoCorrectionDetected: boolean;
  };
}

export interface SquatRecoverySignal {
  peakDepth: number;
  tailDepth: number;
  recoveryDrop: number;
  recovered: boolean;
  /** PR G11: low-ROM path — peak 7–10%, stricter recovery proof. Blocks tiny dip. */
  lowRomRecovered: boolean;
  /** Ultra-low-ROM path — peak 2–7%, very strict recovery (50%). Real cycle proof, blocks micro bend. */
  ultraLowRomRecovered: boolean;
  /** PR-A5: guarded ultra-low-ROM — peak 1–2%, 60% recovery, 5+ trailing frames. Stricter than ultraLowRom. */
  ultraLowRomGuardedRecovered: boolean;
  /** PR squat-low-rom: trace — return-to-standing continuity */
  recoveryPeakDepth?: number;
  recoveryDropRatio?: number;
  trailingDepthCount?: number;
  returnContinuityFrames?: number;
  lowRomRecoveryReason?: string;
  ultraLowRomRecoveryReason?: string;
}

const VISIBILITY_THRESHOLD = 0.45;
const SMOOTHING_ALPHA = 0.4;
const LOW_VISIBILITY_SMOOTHING_ALPHA = 0.18;
const OUTLIER_SMOOTHING_ALPHA = 0.24;
const HIGH_CONFIDENCE_SMOOTHING_ALPHA = 0.5;
const JITTER_DISTANCE_THRESHOLD = 0.025;
const OUTLIER_DISTANCE_THRESHOLD = 0.18;
const TIMESTAMP_GAP_MS = 700;

const STEP_CRITICAL_JOINTS: Record<CameraStepId, JointKey[]> = {
  squat: [
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
    'leftShoulder',
    'rightShoulder',
  ],
  'overhead-reach': [
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
  ],
  'wall-angel': [
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
  ],
  'single-leg-balance': [
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
    'leftShoulder',
    'rightShoulder',
  ],
};

const LEFT_SIDE_KEYS: JointKey[] = [
  'leftShoulder',
  'leftElbow',
  'leftWrist',
  'leftHip',
  'leftKnee',
  'leftAnkle',
];

const RIGHT_SIDE_KEYS: JointKey[] = [
  'rightShoulder',
  'rightElbow',
  'rightWrist',
  'rightHip',
  'rightKnee',
  'rightAnkle',
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * PR-CAM-21: on-device knee angle 기반 squat depth proxy 재보정.
 *
 * 기존 선형식 `(175 - kneeAngleAvg) / 85` 는 90도 전후의 "보통 깊이" 스쿼트도
 * 너무 빨리 1에 가까워져 moderate 시도가 deep/standard로 과분류됐다.
 *
 * 이번 식은 입력은 그대로 kneeAngleAvg 하나만 쓰되, 늦게 올라가는 S-curve로 바꿔
 * 중간 ROM 포화를 늦춘다.
 *
 * 기준점:
 * - standing (~170도): 거의 0
 * - moderate (~90도): 0.09 전후
 * - deep (~60도): 0.9 전후
 *
 * 이렇게 하면 standing/sway baseline 은 낮게 유지되고, 실기기 moderate squat 이
 * relativeDepthPeak ~= 1로 포화되는 문제를 줄이면서, 진짜 deep squat 은 여전히
 * deep band까지 도달할 수 있다.
 */
const SQUAT_DEPTH_LOGISTIC_MID_KNEE_ANGLE_DEG = 75;
const SQUAT_DEPTH_LOGISTIC_SCALE_DEG = 6.5;

function toSquatDepthProxy(kneeAngleAvg: number | null): number | null {
  if (typeof kneeAngleAvg !== 'number') return null;
  const logistic = 1 / (1 + Math.exp((kneeAngleAvg - SQUAT_DEPTH_LOGISTIC_MID_KNEE_ANGLE_DEG) / SQUAT_DEPTH_LOGISTIC_SCALE_DEG));
  return clamp(logistic);
}

/**
 * PR squat-low-rom: return-to-standing continuity.
 * Count consecutive frames at tail where depth <= peak * (1 - minRecoveryRatio).
 * When continuity >= 3, accept slightly relaxed recoveryDrop for low/ultra-low.
 */
function getReturnContinuityFrames(
  trailingDepths: number[],
  peakDepth: number,
  minRecoveryRatio: number
): number {
  let count = 0;
  for (let i = trailingDepths.length - 1; i >= 0; i--) {
    if (trailingDepths[i]! <= peakDepth * (1 - minRecoveryRatio)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

export function getSquatRecoverySignal(frames: PoseFeaturesFrame[]): SquatRecoverySignal {
  const depthSeries = frames
    .map((frame, index) => ({
      index,
      depth: frame.derived.squatDepthProxy,
    }))
    .filter((entry): entry is { index: number; depth: number } => typeof entry.depth === 'number');

  const emptyResult = (peakDepth: number, tailDepth: number, recoveryDrop: number) => ({
    peakDepth,
    tailDepth,
    recoveryDrop,
    recovered: false,
    lowRomRecovered: false,
    ultraLowRomRecovered: false,
    ultraLowRomGuardedRecovered: false,
    recoveryPeakDepth: peakDepth,
    recoveryDropRatio: peakDepth > 0 ? recoveryDrop / peakDepth : 0,
    trailingDepthCount: 0,
    returnContinuityFrames: 0,
    lowRomRecoveryReason: 'trailing_too_few' as const,
    ultraLowRomRecoveryReason: 'trailing_too_few' as const,
  });

  if (depthSeries.length < 4) {
    return { ...emptyResult(0, 0, 0), trailingDepthCount: depthSeries.length };
  }

  const peakSample = depthSeries.reduce((best, entry) => (entry.depth > best.depth ? entry : best));
  const trailingDepths = depthSeries
    .filter((entry) => entry.index > peakSample.index)
    .map((entry) => entry.depth);

  const trailingDepthCount = trailingDepths.length;

  if (trailingDepths.length < 2) {
    return {
      ...emptyResult(peakSample.depth, peakSample.depth, 0),
      trailingDepthCount,
      recoveryDropRatio: 0,
    };
  }

  const tailWindow = trailingDepths.slice(-Math.min(6, trailingDepths.length));
  const tailDepth = mean(tailWindow);
  const recoveryDrop = peakSample.depth - tailDepth;
  const dropRatio = peakSample.depth > 0 ? recoveryDrop / peakSample.depth : 0;

  /** PR squat-low-rom: return-to-standing continuity — consecutive frames at tail below peak*0.6 */
  const returnContinuityFrames = getReturnContinuityFrames(trailingDepths, peakSample.depth, 0.4);
  const hasReturnContinuity = returnContinuityFrames >= 3;

  /** PR G9: allow shallower valid cycle. Min 10% depth. 복귀: recoveryDrop >= peakDepth * 0.25 */
  const recovered =
    peakSample.depth >= 0.1 && recoveryDrop >= peakSample.depth * 0.25;

  /** PR G11: low-ROM path. Min 7% excursion. Stricter recovery (40%) OR continuity bonus (35% when 3+ return frames). */
  const lowRomDropOk = recoveryDrop >= peakSample.depth * 0.4;
  const lowRomContinuityOk =
    hasReturnContinuity && recoveryDrop >= peakSample.depth * 0.35;
  const lowRomRecovered =
    peakSample.depth >= 0.07 &&
    peakSample.depth < 0.1 &&
    (lowRomDropOk || lowRomContinuityOk);

  const lowRomRecoveryReason = !(peakSample.depth >= 0.07 && peakSample.depth < 0.1)
    ? 'peak_out_of_range'
    : lowRomRecovered
      ? lowRomDropOk
        ? 'recovery_drop_40'
        : 'return_continuity_35'
      : lowRomContinuityOk
        ? 'recovery_drop_below_35'
        : 'recovery_drop_below_40';

  /** Ultra-low-ROM path. Min 2% excursion, 50% recovery OR continuity bonus (45% when 3+ return frames). */
  const ultraDropOk = recoveryDrop >= peakSample.depth * 0.5;
  const ultraContinuityOk =
    hasReturnContinuity && recoveryDrop >= peakSample.depth * 0.45;
  const ultraLowRomRecovered =
    peakSample.depth >= 0.02 &&
    peakSample.depth < 0.07 &&
    (ultraDropOk || ultraContinuityOk);

  const ultraLowRomRecoveryReason = !(peakSample.depth >= 0.02 && peakSample.depth < 0.07)
    ? 'peak_out_of_range'
    : ultraLowRomRecovered
      ? ultraDropOk
        ? 'recovery_drop_50'
        : 'return_continuity_45'
      : ultraContinuityOk
        ? 'recovery_drop_below_45'
        : 'recovery_drop_below_50';

  /** PR-A5: guarded ultra-low-ROM — peak 1–2%, 60% recovery, 5+ trailing frames. Anti-tiny-dip. */
  const ultraLowRomGuardedRecovered =
    peakSample.depth >= 0.01 &&
    peakSample.depth < 0.02 &&
    recoveryDrop >= peakSample.depth * 0.6 &&
    trailingDepths.length >= 5;

  return {
    peakDepth: peakSample.depth,
    tailDepth,
    recoveryDrop,
    recovered,
    lowRomRecovered,
    ultraLowRomRecovered,
    ultraLowRomGuardedRecovered,
    recoveryPeakDepth: peakSample.depth,
    recoveryDropRatio: dropRatio,
    trailingDepthCount,
    returnContinuityFrames,
    lowRomRecoveryReason,
    ultraLowRomRecoveryReason,
  };
}

function angle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  return Math.abs((rad * 180) / Math.PI);
}

function midpoint(a: PoseLandmark | null, b: PoseLandmark | null): PoseLandmark | null {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: typeof a.z === 'number' && typeof b.z === 'number' ? (a.z + b.z) / 2 : undefined,
    visibility:
      typeof a.visibility === 'number' && typeof b.visibility === 'number'
        ? (a.visibility + b.visibility) / 2
        : a.visibility ?? b.visibility,
  };
}

function getVisibleRatio(landmark: PoseLandmark | null): number {
  if (!landmark) return 0;
  if (typeof landmark.visibility === 'number') {
    return landmark.visibility >= VISIBILITY_THRESHOLD ? 1 : 0;
  }
  return 1;
}

function getLandmark(frame: PoseLandmarks, index: number): PoseLandmark | null {
  return frame.landmarks[index] ?? null;
}

function smoothLandmark(current: PoseLandmark | null, previous: PoseLandmark | null): PoseLandmark | null {
  if (!current && !previous) return null;
  if (!current) return previous;
  if (!previous) return current;

  const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
  const visibility = typeof current.visibility === 'number' ? current.visibility : 1;
  let alpha = SMOOTHING_ALPHA;

  if (visibility < 0.35) {
    alpha = LOW_VISIBILITY_SMOOTHING_ALPHA;
  } else if (distance < JITTER_DISTANCE_THRESHOLD) {
    alpha = HIGH_CONFIDENCE_SMOOTHING_ALPHA;
  }

  if (distance > OUTLIER_DISTANCE_THRESHOLD && visibility < 0.65) {
    alpha = Math.min(alpha, OUTLIER_SMOOTHING_ALPHA);
  }

  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    z:
      typeof current.z === 'number' && typeof previous.z === 'number'
        ? previous.z + (current.z - previous.z) * alpha
        : current.z ?? previous.z,
    visibility:
      typeof current.visibility === 'number' && typeof previous.visibility === 'number'
        ? previous.visibility + (current.visibility - previous.visibility) * alpha
        : current.visibility ?? previous.visibility,
  };
}

function smoothFrames(frames: PoseLandmarks[]): PoseLandmarks[] {
  let previousSmoothed: PoseLandmark[] | null = null;

  return frames.map((frame) => {
    if (!frame.landmarks || frame.landmarks.length === 0) {
      return frame;
    }

    const smoothedLandmarks = frame.landmarks.map((landmark, index) =>
      smoothLandmark(landmark ?? null, previousSmoothed?.[index] ?? null)
    );

    previousSmoothed = smoothedLandmarks.map((landmark) => landmark ?? { x: 0, y: 0 });

    return {
      ...frame,
      landmarks: smoothedLandmarks.filter((landmark): landmark is PoseLandmark => Boolean(landmark)),
    };
  });
}

function buildJointMap(frame: PoseLandmarks): Record<JointKey, PoseLandmark | null> {
  const joints: Record<JointKey, PoseLandmark | null> = {
    nose: getLandmark(frame, POSE_LANDMARKS.NOSE),
    leftShoulder: getLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER),
    rightShoulder: getLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER),
    leftElbow: getLandmark(frame, POSE_LANDMARKS.LEFT_ELBOW),
    rightElbow: getLandmark(frame, POSE_LANDMARKS.RIGHT_ELBOW),
    leftWrist: getLandmark(frame, POSE_LANDMARKS.LEFT_WRIST),
    rightWrist: getLandmark(frame, POSE_LANDMARKS.RIGHT_WRIST),
    leftHip: getLandmark(frame, POSE_LANDMARKS.LEFT_HIP),
    rightHip: getLandmark(frame, POSE_LANDMARKS.RIGHT_HIP),
    leftKnee: getLandmark(frame, POSE_LANDMARKS.LEFT_KNEE),
    rightKnee: getLandmark(frame, POSE_LANDMARKS.RIGHT_KNEE),
    leftAnkle: getLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE),
    rightAnkle: getLandmark(frame, POSE_LANDMARKS.RIGHT_ANKLE),
    torsoCenter: null,
    shoulderCenter: null,
    hipCenter: null,
    ankleCenter: null,
  };

  joints.shoulderCenter = midpoint(joints.leftShoulder, joints.rightShoulder);
  joints.hipCenter = midpoint(joints.leftHip, joints.rightHip);
  joints.ankleCenter = midpoint(joints.leftAnkle, joints.rightAnkle);
  joints.torsoCenter = midpoint(joints.shoulderCenter, joints.hipCenter);

  return joints;
}

function getJointCompleteness(joints: Record<JointKey, PoseLandmark | null>, keys: JointKey[]): number {
  return mean(keys.map((key) => getVisibleRatio(joints[key])));
}

function getAverageVisibility(frame: PoseLandmarks): number | null {
  const values = frame.landmarks
    .map((landmark) => landmark.visibility)
    .filter((value): value is number => typeof value === 'number');

  return values.length > 0 ? mean(values) : null;
}

function getBodyBox(frame: PoseLandmarks) {
  const xs = frame.landmarks.map((landmark) => landmark.x);
  const ys = frame.landmarks.map((landmark) => landmark.y);

  if (xs.length === 0 || ys.length === 0) {
    return { area: 0, width: 0, height: 0 };
  }

  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  return {
    area: width * height,
    width,
    height,
  };
}

function toTrunkLeanDeg(shoulderCenter: PoseLandmark | null, hipCenter: PoseLandmark | null): number | null {
  if (!shoulderCenter || !hipCenter) return null;
  return Math.atan2(shoulderCenter.x - hipCenter.x, hipCenter.y - shoulderCenter.y) * (180 / Math.PI);
}

function toTorsoExtensionDeg(
  shoulderCenter: PoseLandmark | null,
  hipCenter: PoseLandmark | null
): number | null {
  if (!shoulderCenter || !hipCenter) return null;
  return Math.atan2(hipCenter.y - shoulderCenter.y, hipCenter.x - shoulderCenter.x) * (180 / Math.PI);
}

/** Same-side torso scale floor for overhead norm (normalized coords). */
const OVERHEAD_KINEMATIC_TORSO_SCALE_MIN = 0.04;

/**
 * PR-OH-KINEMATIC-SIGNAL-04B: vertical “above shoulder” proxy, x/y only (z ignored).
 * Image y increases downward → positive when joint.y < shoulder.y.
 */
function overheadJointAboveShoulderNorm(
  shoulder: PoseLandmark,
  joint: PoseLandmark,
  hip: PoseLandmark
): number | null {
  const scale = Math.abs(shoulder.y - hip.y);
  if (!Number.isFinite(scale) || scale < 1e-8) return null;
  const denom = Math.max(scale, OVERHEAD_KINEMATIC_TORSO_SCALE_MIN);
  return (shoulder.y - joint.y) / denom;
}

/** PR-OH-KINEMATIC-SIGNAL-04B: candidate signals for overhead reach diagnostics only (not gating). */
function computeOverheadCandidateKinematics(joints: Record<JointKey, PoseLandmark | null>): Pick<
  PoseFeaturesFrame['derived'],
  | 'shoulderWristElevationLeftDeg'
  | 'shoulderWristElevationRightDeg'
  | 'shoulderWristElevationAvgDeg'
  | 'wristAboveShoulderLeftNorm'
  | 'wristAboveShoulderRightNorm'
  | 'wristAboveShoulderAvgNorm'
  | 'elbowAboveShoulderLeftNorm'
  | 'elbowAboveShoulderRightNorm'
  | 'elbowAboveShoulderAvgNorm'
> {
  const lh = joints.leftHip;
  const ls = joints.leftShoulder;
  const le = joints.leftElbow;
  const lw = joints.leftWrist;
  const rh = joints.rightHip;
  const rs = joints.rightShoulder;
  const re = joints.rightElbow;
  const rw = joints.rightWrist;

  const shoulderWristElevationLeftDeg =
    lh && ls && lw ? angle(lh, ls, lw) : null;
  const shoulderWristElevationRightDeg =
    rh && rs && rw ? angle(rh, rs, rw) : null;
  const shoulderWristElevationAvgDeg =
    typeof shoulderWristElevationLeftDeg === 'number' &&
    typeof shoulderWristElevationRightDeg === 'number'
      ? (shoulderWristElevationLeftDeg + shoulderWristElevationRightDeg) / 2
      : shoulderWristElevationLeftDeg ?? shoulderWristElevationRightDeg;

  const wristAboveShoulderLeftNorm =
    ls && lw && lh ? overheadJointAboveShoulderNorm(ls, lw, lh) : null;
  const wristAboveShoulderRightNorm =
    rs && rw && rh ? overheadJointAboveShoulderNorm(rs, rw, rh) : null;
  const wristAboveShoulderAvgNorm =
    typeof wristAboveShoulderLeftNorm === 'number' &&
    typeof wristAboveShoulderRightNorm === 'number'
      ? (wristAboveShoulderLeftNorm + wristAboveShoulderRightNorm) / 2
      : wristAboveShoulderLeftNorm ?? wristAboveShoulderRightNorm;

  const elbowAboveShoulderLeftNorm =
    ls && le && lh ? overheadJointAboveShoulderNorm(ls, le, lh) : null;
  const elbowAboveShoulderRightNorm =
    rs && re && rh ? overheadJointAboveShoulderNorm(rs, re, rh) : null;
  const elbowAboveShoulderAvgNorm =
    typeof elbowAboveShoulderLeftNorm === 'number' &&
    typeof elbowAboveShoulderRightNorm === 'number'
      ? (elbowAboveShoulderLeftNorm + elbowAboveShoulderRightNorm) / 2
      : elbowAboveShoulderLeftNorm ?? elbowAboveShoulderRightNorm;

  return {
    shoulderWristElevationLeftDeg,
    shoulderWristElevationRightDeg,
    shoulderWristElevationAvgDeg,
    wristAboveShoulderLeftNorm,
    wristAboveShoulderRightNorm,
    wristAboveShoulderAvgNorm,
    elbowAboveShoulderLeftNorm,
    elbowAboveShoulderRightNorm,
    elbowAboveShoulderAvgNorm,
  };
}

function emptyOverheadCandidateKinematics(): ReturnType<typeof computeOverheadCandidateKinematics> {
  return {
    shoulderWristElevationLeftDeg: null,
    shoulderWristElevationRightDeg: null,
    shoulderWristElevationAvgDeg: null,
    wristAboveShoulderLeftNorm: null,
    wristAboveShoulderRightNorm: null,
    wristAboveShoulderAvgNorm: null,
    elbowAboveShoulderLeftNorm: null,
    elbowAboveShoulderRightNorm: null,
    elbowAboveShoulderAvgNorm: null,
  };
}

function buildDerivedMetrics(
  joints: Record<JointKey, PoseLandmark | null>,
  previousFrame: PoseFeaturesFrame | null,
  stepId: CameraStepId
): PoseFeaturesFrame['derived'] {
  const kneeAngleLeft =
    joints.leftHip && joints.leftKnee && joints.leftAnkle
      ? angle(joints.leftHip, joints.leftKnee, joints.leftAnkle)
      : null;
  const kneeAngleRight =
    joints.rightHip && joints.rightKnee && joints.rightAnkle
      ? angle(joints.rightHip, joints.rightKnee, joints.rightAnkle)
      : null;
  const kneeAngleAvg =
    typeof kneeAngleLeft === 'number' && typeof kneeAngleRight === 'number'
      ? (kneeAngleLeft + kneeAngleRight) / 2
      : kneeAngleLeft ?? kneeAngleRight;
  const kneeAngleGap =
    typeof kneeAngleLeft === 'number' && typeof kneeAngleRight === 'number'
      ? Math.abs(kneeAngleLeft - kneeAngleRight)
      : null;

  const hipWidth =
    joints.leftHip && joints.rightHip ? Math.abs(joints.leftHip.x - joints.rightHip.x) : null;
  const kneeWidth =
    joints.leftKnee && joints.rightKnee ? Math.abs(joints.leftKnee.x - joints.rightKnee.x) : null;

  const squatDepthProxy = toSquatDepthProxy(kneeAngleAvg);
  const kneeTrackingRatio =
    typeof hipWidth === 'number' && typeof kneeWidth === 'number' && hipWidth > 0 ? kneeWidth / hipWidth : null;
  const trunkLeanDeg = toTrunkLeanDeg(joints.shoulderCenter, joints.hipCenter);
  const torsoExtensionDeg = toTorsoExtensionDeg(joints.shoulderCenter, joints.hipCenter);

  const ankleWidth =
    joints.leftAnkle && joints.rightAnkle ? Math.abs(joints.leftAnkle.x - joints.rightAnkle.x) : null;
  const weightShiftRatio =
    joints.hipCenter && joints.ankleCenter && typeof ankleWidth === 'number' && ankleWidth > 0
      ? Math.abs(joints.hipCenter.x - joints.ankleCenter.x) / ankleWidth
      : null;

  const armElevationLeft =
    joints.leftHip && joints.leftShoulder && joints.leftElbow
      ? angle(joints.leftHip, joints.leftShoulder, joints.leftElbow)
      : null;
  const armElevationRight =
    joints.rightHip && joints.rightShoulder && joints.rightElbow
      ? angle(joints.rightHip, joints.rightShoulder, joints.rightElbow)
      : null;
  const armElevationAvg =
    typeof armElevationLeft === 'number' && typeof armElevationRight === 'number'
      ? (armElevationLeft + armElevationRight) / 2
      : armElevationLeft ?? armElevationRight;
  const armElevationGap =
    typeof armElevationLeft === 'number' && typeof armElevationRight === 'number'
      ? Math.abs(armElevationLeft - armElevationRight)
      : null;

  const elbowAngleLeft =
    joints.leftShoulder && joints.leftElbow && joints.leftWrist
      ? angle(joints.leftShoulder, joints.leftElbow, joints.leftWrist)
      : null;
  const elbowAngleRight =
    joints.rightShoulder && joints.rightElbow && joints.rightWrist
      ? angle(joints.rightShoulder, joints.rightElbow, joints.rightWrist)
      : null;

  const wristElbowAlignmentLeft =
    joints.leftWrist && joints.leftElbow ? Math.abs(joints.leftWrist.x - joints.leftElbow.x) : null;
  const wristElbowAlignmentRight =
    joints.rightWrist && joints.rightElbow ? Math.abs(joints.rightWrist.x - joints.rightElbow.x) : null;

  const shoulderSymmetry =
    joints.leftShoulder && joints.rightShoulder
      ? Math.abs(joints.leftShoulder.y - joints.rightShoulder.y)
      : null;

  const pelvicDrop =
    joints.leftHip && joints.rightHip ? Math.abs(joints.leftHip.y - joints.rightHip.y) : null;

  const swayAmplitude =
    joints.torsoCenter && previousFrame?.joints.torsoCenter
      ? Math.abs(joints.torsoCenter.x - previousFrame.joints.torsoCenter.x)
      : null;
  const holdBalance =
    joints.nose && joints.torsoCenter ? clamp(1 - Math.abs(joints.nose.x - joints.torsoCenter.x) / 0.14) : null;

  const footHeightGap =
    joints.leftAnkle && joints.rightAnkle ? Math.abs(joints.leftAnkle.y - joints.rightAnkle.y) : null;
  const footDownDetected = typeof footHeightGap === 'number' ? footHeightGap < 0.035 : false;

  const torsoCorrectionDetected =
    typeof trunkLeanDeg === 'number' && typeof previousFrame?.derived.trunkLeanDeg === 'number'
      ? Math.abs(trunkLeanDeg - previousFrame.derived.trunkLeanDeg) > 4
      : false;

  const overheadKinematics =
    stepId === 'overhead-reach'
      ? computeOverheadCandidateKinematics(joints)
      : emptyOverheadCandidateKinematics();

  return {
    kneeAngleLeft,
    kneeAngleRight,
    kneeAngleAvg,
    kneeAngleGap,
    squatDepthProxy,
    kneeTrackingRatio,
    trunkLeanDeg,
    torsoExtensionDeg,
    weightShiftRatio,
    armElevationLeft,
    armElevationRight,
    armElevationAvg,
    armElevationGap,
    ...overheadKinematics,
    elbowAngleLeft,
    elbowAngleRight,
    wristElbowAlignmentLeft,
    wristElbowAlignmentRight,
    shoulderSymmetry,
    pelvicDrop,
    swayAmplitude,
    holdBalance,
    footHeightGap,
    footDownDetected,
    torsoCorrectionDetected,
  };
}

function getFrameValidity(
  stepId: CameraStepId,
  frame: PoseLandmarks,
  joints: Record<JointKey, PoseLandmark | null>,
  visibleLandmarkRatio: number,
  criticalJointsAvailability: number,
  timestampDeltaMs: number | null
): { frameValidity: PoseFrameValidity; qualityHints: string[]; isValid: boolean } {
  const qualityHints: string[] = [];

  if (timestampDeltaMs !== null && timestampDeltaMs > TIMESTAMP_GAP_MS) {
    qualityHints.push('timestamp_gap');
  }
  if (visibleLandmarkRatio < 0.45) {
    qualityHints.push('low_visibility');
  }
  if (criticalJointsAvailability < 0.5) {
    qualityHints.push('critical_joints_missing');
  }

  const leftSideCompleteness = getJointCompleteness(joints, LEFT_SIDE_KEYS);
  const rightSideCompleteness = getJointCompleteness(joints, RIGHT_SIDE_KEYS);
  if (leftSideCompleteness < 0.5) qualityHints.push('left_side_partial');
  if (rightSideCompleteness < 0.5) qualityHints.push('right_side_partial');

  if (frame.landmarks.length < 33) {
    return { frameValidity: 'invalid', qualityHints, isValid: false };
  }

  if (criticalJointsAvailability < 0.35) {
    return { frameValidity: 'missing_keypoints', qualityHints, isValid: false };
  }

  if (visibleLandmarkRatio < 0.45) {
    return { frameValidity: 'low_visibility', qualityHints, isValid: true };
  }

  if (stepId === 'single-leg-balance' && qualityHints.includes('timestamp_gap')) {
    return { frameValidity: 'low_visibility', qualityHints, isValid: true };
  }

  return { frameValidity: 'valid', qualityHints, isValid: true };
}

function stabilizeDerivedSignals(frames: PoseFeaturesFrame[]): PoseFeaturesFrame[] {
  let previousDepth: number | null = null;
  let previousArmElevation: number | null = null;
  let previousArmElevationLeft: number | null = null;
  let previousArmElevationRight: number | null = null;
  let previousTrunkLean: number | null = null;
  let previousKneeTracking: number | null = null;
  /** PR-OH-KINEMATIC-SIGNAL-04B: temporal smooth for overhead candidate signals (diagnostic parity with armElevation). */
  let prevOhSwL: number | null = null;
  let prevOhSwR: number | null = null;
  let prevOhSwAvg: number | null = null;
  let prevOhWristL: number | null = null;
  let prevOhWristR: number | null = null;
  let prevOhWristAvg: number | null = null;
  let prevOhElbowL: number | null = null;
  let prevOhElbowR: number | null = null;
  let prevOhElbowAvg: number | null = null;

  return frames.map((frame) => {
    const rawDepthIn = frame.derived.squatDepthProxy;
    const squatDepthProxy = smoothSignalValue(frame.derived.squatDepthProxy, previousDepth, 0.46);
    const armElevationAvg = smoothSignalValue(frame.derived.armElevationAvg, previousArmElevation, 0.42);
    const armElevationLeft = smoothSignalValue(
      frame.derived.armElevationLeft,
      previousArmElevationLeft,
      0.42
    );
    const armElevationRight = smoothSignalValue(
      frame.derived.armElevationRight,
      previousArmElevationRight,
      0.42
    );
    const trunkLeanDeg = smoothSignalValue(frame.derived.trunkLeanDeg, previousTrunkLean, 0.4);
    const kneeTrackingRatio = smoothSignalValue(
      frame.derived.kneeTrackingRatio,
      previousKneeTracking,
      0.4
    );

    const shoulderWristElevationLeftDeg = smoothSignalValue(
      frame.derived.shoulderWristElevationLeftDeg,
      prevOhSwL,
      0.42
    );
    const shoulderWristElevationRightDeg = smoothSignalValue(
      frame.derived.shoulderWristElevationRightDeg,
      prevOhSwR,
      0.42
    );
    const shoulderWristElevationAvgDeg = smoothSignalValue(
      frame.derived.shoulderWristElevationAvgDeg,
      prevOhSwAvg,
      0.42
    );
    const wristAboveShoulderLeftNorm = smoothSignalValue(
      frame.derived.wristAboveShoulderLeftNorm,
      prevOhWristL,
      0.42
    );
    const wristAboveShoulderRightNorm = smoothSignalValue(
      frame.derived.wristAboveShoulderRightNorm,
      prevOhWristR,
      0.42
    );
    const wristAboveShoulderAvgNorm = smoothSignalValue(
      frame.derived.wristAboveShoulderAvgNorm,
      prevOhWristAvg,
      0.42
    );
    const elbowAboveShoulderLeftNorm = smoothSignalValue(
      frame.derived.elbowAboveShoulderLeftNorm,
      prevOhElbowL,
      0.42
    );
    const elbowAboveShoulderRightNorm = smoothSignalValue(
      frame.derived.elbowAboveShoulderRightNorm,
      prevOhElbowR,
      0.42
    );
    const elbowAboveShoulderAvgNorm = smoothSignalValue(
      frame.derived.elbowAboveShoulderAvgNorm,
      prevOhElbowAvg,
      0.42
    );

    previousDepth = squatDepthProxy;
    previousArmElevation = armElevationAvg;
    previousArmElevationLeft = armElevationLeft;
    previousArmElevationRight = armElevationRight;
    previousTrunkLean = trunkLeanDeg;
    previousKneeTracking = kneeTrackingRatio;
    prevOhSwL = shoulderWristElevationLeftDeg;
    prevOhSwR = shoulderWristElevationRightDeg;
    prevOhSwAvg = shoulderWristElevationAvgDeg;
    prevOhWristL = wristAboveShoulderLeftNorm;
    prevOhWristR = wristAboveShoulderRightNorm;
    prevOhWristAvg = wristAboveShoulderAvgNorm;
    prevOhElbowL = elbowAboveShoulderLeftNorm;
    prevOhElbowR = elbowAboveShoulderRightNorm;
    prevOhElbowAvg = elbowAboveShoulderAvgNorm;

    return {
      ...frame,
      derived: {
        ...frame.derived,
        squatDepthProxyRaw: typeof rawDepthIn === 'number' && Number.isFinite(rawDepthIn) ? rawDepthIn : null,
        squatDepthProxy,
        armElevationAvg,
        armElevationLeft,
        armElevationRight,
        shoulderWristElevationLeftDeg,
        shoulderWristElevationRightDeg,
        shoulderWristElevationAvgDeg,
        wristAboveShoulderLeftNorm,
        wristAboveShoulderRightNorm,
        wristAboveShoulderAvgNorm,
        elbowAboveShoulderLeftNorm,
        elbowAboveShoulderRightNorm,
        elbowAboveShoulderAvgNorm,
        trunkLeanDeg,
        kneeTrackingRatio,
      },
    };
  });
}

/** PR-04E1: phase / arming 에 쓰는 유효 depth (blended 우선) */
function squatPhaseDepthRead(frame: PoseFeaturesFrame): number {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : 0;
}

const SHALLOW_DESCENT_DEPTH_MIN = 0.03;
const SHALLOW_DESCENT_DEPTH_MAX = 0.08;
const SHALLOW_DESCENT_EXCURSION_MIN = 0.015;
const SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES = 3;
const SHALLOW_DESCENT_MIN_DELTA_PER_FRAME = 0.003;

/**
 * PR-CAM-29: raw depth 신호 → temporal 확인 → blended 기록.
 * - blendOffered 가 연속 SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES 프레임 이상일 때만 blended 를 살린다(단발 스파이크 억제).
 * - primary 가 near-flat 으로 빠르게 복귀하면(standing 쪽) streak 리셋 → blended 빨리 소멸.
 * - phaseHint 는 이후 applyPhaseHints 에서만 확정되므로 여기서는 primary 깊이 추세만 사용.
 */
export function applySquatDepthBlendPass(frames: PoseFeaturesFrame[]): PoseFeaturesFrame[] {
  const rawSignals = frames.map((frame, i) =>
    buildSquatDepthSignal(frame, i > 0 ? frames[i - 1]! : null)
  );

  let blendOfferStreak = 0;
  const out: PoseFeaturesFrame[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const sig = rawSignals[i]!;
    const prevFrame = i > 0 ? frames[i - 1]! : null;
    const prevPrimary =
      prevFrame && typeof prevFrame.derived.squatDepthProxy === 'number'
        ? prevFrame.derived.squatDepthProxy
        : null;
    const primaryNow =
      typeof frame.derived.squatDepthProxy === 'number' && Number.isFinite(frame.derived.squatDepthProxy)
        ? frame.derived.squatDepthProxy
        : 0;

    const offered = sig.blendOffered === true;
    if (offered) blendOfferStreak += 1;
    else blendOfferStreak = 0;

    const rapidShallowing =
      prevPrimary != null &&
      primaryNow <= SQUAT_DEPTH_PRIMARY_NEAR_FLAT &&
      prevPrimary > primaryNow + SHALLOW_DESCENT_MIN_DELTA_PER_FRAME;
    if (rapidShallowing) blendOfferStreak = 0;

    const allowBlendedOutput = offered && blendOfferStreak >= SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES;
    const temporalSuppressed = offered && !allowBlendedOutput;

    const primaryOut =
      typeof sig.primaryDepth === 'number' && Number.isFinite(sig.primaryDepth)
        ? sig.primaryDepth
        : primaryNow;

    let depthOut = sig.depthValue;
    let sourceOut = sig.source;
    if (temporalSuppressed) {
      depthOut = primaryOut;
      sourceOut = 'primary';
    }

    /**
     * PR-CAM-SHALLOW-DEPTH-TRUTH-ALIGN-01: raw peak capture.
     *
     * 문제: stabilizeDerivedSignals 의 EMA(alpha=0.46)가 shallow 하강 중 실제 무릎 깊이를
     * 0~3 프레임 지연시킨다. 예: 실제 raw = 0.090 → EMA-smoothed = 0.068 → blended = 0.068.
     * LOW_ROM_LABEL_FLOOR(0.07) 미달 → evidenceLabel = ultra_low_rom.
     *
     * 해결: EMA가 이미 PRIMARY_STRONG_MIN(0.045)까지 축적됐을 때 — 실제 지속 하강(jitter 아님) —
     * raw 값이 더 높으면(EMA 지연 상태) squatDepthProxyBlended 를 raw 값으로 올린다.
     *
     * 안전 조건:
     * - primaryNow >= PRIMARY_STRONG_MIN: jitter 스파이크에서는 EMA가 0.045까지 쌓이지 않는다.
     * - rawPeakCapture > depthOut: 상승 구간에서는 raw < smoothed(EMA가 위에서 지연)이므로
     *   이 조건은 false → 상승·서 있는 구간에 영향 없음.
     * - 신규 수치 threshold 없음: PRIMARY_STRONG_MIN 은 squat-depth-signal 의 기존 상수.
     */
    const rawPeakCapture =
      typeof frame.derived.squatDepthProxyRaw === 'number' &&
      Number.isFinite(frame.derived.squatDepthProxyRaw)
        ? frame.derived.squatDepthProxyRaw
        : null;
    if (rawPeakCapture !== null && rawPeakCapture > depthOut && primaryNow >= PRIMARY_STRONG_MIN) {
      depthOut = rawPeakCapture;
    }

    const blendActive = allowBlendedOutput && sourceOut === 'blended';

    out.push({
      ...frame,
      derived: {
        ...frame.derived,
        squatDepthProxyBlended: depthOut,
        squatDepthSource: sourceOut,
        squatDepthBlendRaw:
          sig.blendCandidateRaw != null && Number.isFinite(sig.blendCandidateRaw)
            ? sig.blendCandidateRaw
            : null,
        squatDepthBlendEvidence:
          typeof sig.travelEvidence === 'number' && Number.isFinite(sig.travelEvidence)
            ? sig.travelEvidence
            : null,
        squatDepthBlendCapped: sig.blendCapped === true,
        squatDepthBlendActive: blendActive,
        squatDepthBlendTemporalSuppressed: temporalSuppressed ? true : undefined,
        squatDepthFallbackPeakFrame:
          typeof sig.fallbackDepth === 'number' && Number.isFinite(sig.fallbackDepth)
            ? sig.fallbackDepth
            : null,
        squatDepthBlendOffered: offered,
      },
    });
  }

  return out;
}

/**
 * PR-B: ultra-shallow 사이클(peak < SHALLOW_DESCENT_DEPTH_MAX)에서 피크 근방 프레임에
 * 'bottom' 레이블을 부여하기 위한 비율.
 * 글로벌 maxDepth의 이 비율 이상인 프레임 = "사이클 최저점 근방"으로 판단.
 * sway/noise 차단: maxDepth >= SHALLOW_DESCENT_DEPTH_MIN 조건 아래서만 적용.
 */
const ULTRA_SHALLOW_BOTTOM_RATIO = 0.78;

/**
 * Very shallow squat은 절대 depth band 대신 짧은 하강 연속성으로 관측한다.
 * 단일 프레임 스파이크를 막기 위해 연속 frame trend + excursion 둘 다 요구한다.
 */
/** PR-03: completion-state·스모크에서 동일 guarded descent 정의를 재사용할 수 있도록 export */
export function hasGuardedShallowSquatDescent(
  frames: PoseFeaturesFrame[],
  index: number,
  sessionMinDepth: number
): boolean {
  if (index < SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES) return false;
  const recentDepths: number[] = [];

  for (let i = index - SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES; i <= index; i += 1) {
    const depth = squatPhaseDepthRead(frames[i]!);
    if (typeof depth !== 'number' || !Number.isFinite(depth)) return false;
    recentDepths.push(depth);
  }

  const currentDepth = recentDepths[recentDepths.length - 1]!;
  if (currentDepth < SHALLOW_DESCENT_DEPTH_MIN || currentDepth >= SHALLOW_DESCENT_DEPTH_MAX) {
    return false;
  }

  const deltas = recentDepths.slice(1).map((depth, depthIndex) => depth - recentDepths[depthIndex]!);
  const hasConsistentDownwardTrend = deltas.every(
    (delta) => delta >= SHALLOW_DESCENT_MIN_DELTA_PER_FRAME
  );
  if (!hasConsistentDownwardTrend) return false;

  const excursion = currentDepth - sessionMinDepth;
  const totalTrendDelta = currentDepth - recentDepths[0]!;
  return (
    excursion >= SHALLOW_DESCENT_EXCURSION_MIN &&
    totalTrendDelta >= SHALLOW_DESCENT_EXCURSION_MIN
  );
}

/**
 * PR-CAM-29B: hasGuardedShallowSquatDescent 와 대칭 — 얕은 밴드에서 피크 이후 일관된 상승(깊이 감소).
 * SHALLOW_DESCENT_* 상수만 재사용(신규 수치 없음). standing sway / flat bottom 은 연속 감소·excursion 에서 걸러짐.
 */
export function hasGuardedShallowSquatAscent(frames: PoseFeaturesFrame[], index: number): boolean {
  if (index < SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES) return false;
  const depthSlice = frames
    .slice(0, index + 1)
    .map((f) => squatPhaseDepthRead(f))
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
  if (depthSlice.length === 0) return false;
  const sessionPeak = Math.max(...depthSlice);
  if (sessionPeak < SHALLOW_DESCENT_DEPTH_MIN || sessionPeak >= SHALLOW_DESCENT_DEPTH_MAX) {
    return false;
  }

  const recentDepths: number[] = [];
  for (let i = index - SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES; i <= index; i += 1) {
    const depth = squatPhaseDepthRead(frames[i]!);
    if (typeof depth !== 'number' || !Number.isFinite(depth)) return false;
    recentDepths.push(depth);
  }

  const currentDepth = recentDepths[recentDepths.length - 1]!;
  if (currentDepth < SHALLOW_DESCENT_DEPTH_MIN || currentDepth >= SHALLOW_DESCENT_DEPTH_MAX) {
    return false;
  }

  const dropFromPeak = sessionPeak - currentDepth;
  if (dropFromPeak < SHALLOW_DESCENT_EXCURSION_MIN) return false;

  const deltas = recentDepths.slice(1).map((depth, depthIndex) => depth - recentDepths[depthIndex]!);
  const hasConsistentUpwardTrend = deltas.every(
    (delta) => delta <= -SHALLOW_DESCENT_MIN_DELTA_PER_FRAME
  );
  if (!hasConsistentUpwardTrend) return false;

  const totalTrendDelta = recentDepths[0]! - currentDepth;
  return totalTrendDelta >= SHALLOW_DESCENT_EXCURSION_MIN;
}

function applyPhaseHints(stepId: CameraStepId, frames: PoseFeaturesFrame[]): PoseFeaturesFrame[] {
  if (frames.length === 0) return frames;

  if (stepId === 'squat') {
    const maxDepth = Math.max(...frames.map((frame) => squatPhaseDepthRead(frame)));
    /** PR G10: bottom = 30% of excursion. Shallower real cycle can get bottom phase. */
    const bottomThreshold = maxDepth * 0.3;
    /** PR squat-low-rom: shallow range (5–12%) uses lower delta for descent/ascent. Standing (<5%) keeps 0.008. */
    const isShallowRange = maxDepth >= 0.05 && maxDepth < 0.12;
    const descentDelta = isShallowRange ? 0.006 : 0.008;
    const ascentDelta = isShallowRange ? 0.006 : 0.008;
    /**
     * PR-HOTFIX-01: 버퍼 시작~현재 프레임 최소 depth 대비 굴곡이 이 값 미만이면 descent 라벨 불가.
     * completion 상태기는 그대로 두고, 조기 `descent` 오탐(실제 하강 없이 통과)만 차단한다.
     */
    const MIN_EXCURSION_FOR_DESCENT_LABEL = 0.022;
    const candidates = frames.map((frame, index) => {
      const previousDepth = index > 0 ? squatPhaseDepthRead(frames[index - 1]!) : null;
      const currentDepth = squatPhaseDepthRead(frame);
      let phaseHint: PosePhaseHint = 'unknown';

      if (typeof currentDepth === 'number' && Number.isFinite(currentDepth)) {
        const depthSlice = frames
          .slice(0, index + 1)
          .map((f) => squatPhaseDepthRead(f))
          .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
        const sessionMinDepth = depthSlice.length > 0 ? Math.min(...depthSlice) : currentDepth;
        const excursion = currentDepth - sessionMinDepth;

        const depthDelta = typeof previousDepth === 'number' ? currentDepth - previousDepth : 0;
        const guardedShallowDescent = hasGuardedShallowSquatDescent(
          frames,
          index,
          sessionMinDepth
        );
        const guardedShallowAscent = hasGuardedShallowSquatAscent(frames, index);

        if (guardedShallowDescent) {
          phaseHint = 'descent';
        } else if (guardedShallowAscent) {
          phaseHint = 'ascent';
        } else if (currentDepth < SHALLOW_DESCENT_DEPTH_MAX && !guardedShallowDescent) {
          // PR-B: ultra-shallow 사이클(peak >= 0.03, peak < 0.08)에서
          // 피크 근방 프레임은 'start' 대신 'bottom'으로 레이블해 cycleDetection truth 개선.
          // sway/jitter 보호: maxDepth < SHALLOW_DESCENT_DEPTH_MIN이면 적용하지 않는다.
          if (
            maxDepth >= SHALLOW_DESCENT_DEPTH_MIN &&
            currentDepth >= maxDepth * ULTRA_SHALLOW_BOTTOM_RATIO
          ) {
            phaseHint = 'bottom';
          } else {
            phaseHint = 'start';
          }
        } else if (currentDepth >= bottomThreshold && Math.abs(depthDelta) < 0.022) {
          phaseHint = 'bottom';
        } else if (depthDelta > descentDelta && excursion >= MIN_EXCURSION_FOR_DESCENT_LABEL) {
          phaseHint = 'descent';
        } else if (depthDelta < -ascentDelta) {
          phaseHint = 'ascent';
        }
      }

      return phaseHint;
    });
    const stabilized = stabilizePhaseSequence(candidates, 2);

    return frames.map((frame, index) => {
      const phaseHint = stabilized[index] ?? 'unknown';
      const eventHints = [...frame.eventHints];
      if (phaseHint === 'bottom') eventHints.push('bottom_reached');
      return { ...frame, phaseHint, eventHints };
    });
  }

  if (stepId === 'wall-angel') {
    const maxElevation = Math.max(
      ...frames.map((frame) => frame.derived.armElevationAvg ?? 0)
    );

    return frames.map((frame, index) => {
      const previousElevation = index > 0 ? frames[index - 1]!.derived.armElevationAvg : null;
      const currentElevation = frame.derived.armElevationAvg;
      let phaseHint: PosePhaseHint = 'unknown';
      const eventHints = [...frame.eventHints];

      if (typeof currentElevation === 'number') {
        const delta =
          typeof previousElevation === 'number' ? currentElevation - previousElevation : 0;

        if (currentElevation < 35) {
          phaseHint = 'lower';
        } else if (currentElevation >= maxElevation * 0.9 && Math.abs(delta) < 4) {
          phaseHint = 'peak';
        } else if (delta > 3) {
          phaseHint = 'raise';
        } else if (delta < -3) {
          phaseHint = 'lower';
        }
      }

      if (phaseHint === 'peak') {
        eventHints.push('peak_reached');
      }

      return { ...frame, phaseHint, eventHints };
    });
  }

  if (stepId === 'overhead-reach') {
    /** PR overhead-hold: absolute top floor only. relative max 회귀 금지 — reach-only pass 차단. */
    const ABSOLUTE_TOP_FLOOR_DEG = 132;
    const candidates = frames.map((frame, index) => {
      const previousElevation = index > 0 ? frames[index - 1]!.derived.armElevationAvg : null;
      const currentElevation = frame.derived.armElevationAvg;
      let phaseHint: PosePhaseHint = 'unknown';

      if (typeof currentElevation === 'number') {
        const delta = typeof previousElevation === 'number' ? currentElevation - previousElevation : 0;

        if (currentElevation < 40) {
          phaseHint = 'start';
        } else if (currentElevation >= ABSOLUTE_TOP_FLOOR_DEG && Math.abs(delta) < 2.6) {
          phaseHint = 'peak';
        } else if (delta > 2.2) {
          phaseHint = 'raise';
        } else if (delta < -2.2) {
          phaseHint = 'lower';
        }
      }

      return phaseHint;
    });
    const stabilized = stabilizePhaseSequence(candidates, 2);

    return frames.map((frame, index) => {
      const phaseHint = stabilized[index] ?? 'unknown';
      const eventHints = [...frame.eventHints];
      if (phaseHint === 'peak') eventHints.push('peak_reached');
      return { ...frame, phaseHint, eventHints };
    });
  }

  let holdStarted = false;

  return frames.map((frame) => {
    const phaseHintBase = frame.phaseHint;
    const eventHints = [...frame.eventHints];
    let phaseHint: PosePhaseHint = phaseHintBase;

    if (typeof frame.derived.footHeightGap === 'number' && frame.derived.footHeightGap > 0.05) {
      if (!holdStarted) {
        holdStarted = true;
        phaseHint = 'hold_start';
        eventHints.push('hold_started');
      } else {
        phaseHint = 'hold_ongoing';
      }
    } else if (holdStarted) {
      phaseHint = 'break';
      eventHints.push('hold_broken');
    } else {
      phaseHint = 'start';
    }

    return { ...frame, phaseHint, eventHints };
  });
}

export function buildPoseFeaturesFrames(
  stepId: CameraStepId,
  frames: PoseLandmarks[]
): PoseFeaturesFrame[] {
  const smoothedFrames = smoothFrames(frames);
  const features: PoseFeaturesFrame[] = [];

  for (const frame of smoothedFrames) {
    const joints = buildJointMap(frame);
    const visibleLandmarkRatio = mean(frame.landmarks.map((landmark) => getVisibleRatio(landmark)));
    const averageVisibility = getAverageVisibility(frame);
    const leftSideCompleteness = getJointCompleteness(joints, LEFT_SIDE_KEYS);
    const rightSideCompleteness = getJointCompleteness(joints, RIGHT_SIDE_KEYS);
    const criticalJointsAvailability = getJointCompleteness(joints, STEP_CRITICAL_JOINTS[stepId]);
    const bodyBox = getBodyBox(frame);
    const previousFrame = features.length > 0 ? features[features.length - 1]! : null;
    const timestampMs = frame.timestamp ?? 0;
    const timestampDeltaMs =
      previousFrame && previousFrame.timestampMs > 0 ? timestampMs - previousFrame.timestampMs : null;
    const derived = buildDerivedMetrics(joints, previousFrame, stepId);
    const { frameValidity, qualityHints, isValid } = getFrameValidity(
      stepId,
      frame,
      joints,
      visibleLandmarkRatio,
      criticalJointsAvailability,
      timestampDeltaMs
    );

    features.push({
      timestampMs,
      stepId,
      frameValidity,
      phaseHint: 'unknown',
      eventHints: [],
      qualityHints,
      timestampDeltaMs,
      isValid,
      visibilitySummary: {
        visibleLandmarkRatio,
        averageVisibility,
        leftSideCompleteness,
        rightSideCompleteness,
        criticalJointsAvailability,
      },
      bodyBox,
      joints,
      derived,
    });
  }

  const stabilized = stabilizeDerivedSignals(features);
  const depthReady = stepId === 'squat' ? applySquatDepthBlendPass(stabilized) : stabilized;
  return applyPhaseHints(stepId, depthReady);
}
