/**
 * Raw pose landmarks를 evaluator-friendly feature frame으로 변환한다.
 * landmark index 의존은 이 파일 내부에만 가둔다.
 */
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import type { CameraStepId } from '@/lib/public/camera-test';
import { smoothSignalValue, stabilizePhaseSequence } from './stability';

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
    kneeTrackingRatio: number | null;
    trunkLeanDeg: number | null;
    torsoExtensionDeg: number | null;
    weightShiftRatio: number | null;
    armElevationLeft: number | null;
    armElevationRight: number | null;
    armElevationAvg: number | null;
    armElevationGap: number | null;
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

export function getSquatRecoverySignal(frames: PoseFeaturesFrame[]): SquatRecoverySignal {
  const depthSeries = frames
    .map((frame, index) => ({
      index,
      depth: frame.derived.squatDepthProxy,
    }))
    .filter((entry): entry is { index: number; depth: number } => typeof entry.depth === 'number');

  if (depthSeries.length < 4) {
    return {
      peakDepth: 0,
      tailDepth: 0,
      recoveryDrop: 0,
      recovered: false,
      lowRomRecovered: false,
      ultraLowRomRecovered: false,
      ultraLowRomGuardedRecovered: false,
    };
  }

  const peakSample = depthSeries.reduce((best, entry) => (entry.depth > best.depth ? entry : best));
  const trailingDepths = depthSeries
    .filter((entry) => entry.index > peakSample.index)
    .map((entry) => entry.depth);

  if (trailingDepths.length < 3) {
    return {
      peakDepth: peakSample.depth,
      tailDepth: peakSample.depth,
      recoveryDrop: 0,
      recovered: false,
      lowRomRecovered: false,
      ultraLowRomRecovered: false,
      ultraLowRomGuardedRecovered: false,
    };
  }

  const tailWindow = trailingDepths.slice(-Math.min(6, trailingDepths.length));
  const tailDepth = mean(tailWindow);
  const recoveryDrop = peakSample.depth - tailDepth;

  /** PR G9: allow shallower valid cycle. Min 10% depth (was 12%). 복귀: recoveryDrop >= peakDepth * 0.25 */
  const recovered =
    peakSample.depth >= 0.1 && recoveryDrop >= peakSample.depth * 0.25;

  /** PR G11: low-ROM path. Min 7% excursion, stricter recovery (40%). Blocks tiny dip. */
  const lowRomRecovered =
    peakSample.depth >= 0.07 &&
    recoveryDrop >= peakSample.depth * 0.4;

  /** Ultra-low-ROM path. Min 2% excursion (above tiny-dip), 50% recovery. Real cycle proof. */
  const ultraLowRomRecovered =
    peakSample.depth >= 0.02 &&
    peakSample.depth < 0.07 &&
    recoveryDrop >= peakSample.depth * 0.5;

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

function buildDerivedMetrics(
  joints: Record<JointKey, PoseLandmark | null>,
  previousFrame: PoseFeaturesFrame | null
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

  const squatDepthProxy =
    typeof kneeAngleAvg === 'number' ? clamp((175 - kneeAngleAvg) / 85) : null;
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

  return frames.map((frame) => {
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

    previousDepth = squatDepthProxy;
    previousArmElevation = armElevationAvg;
    previousArmElevationLeft = armElevationLeft;
    previousArmElevationRight = armElevationRight;
    previousTrunkLean = trunkLeanDeg;
    previousKneeTracking = kneeTrackingRatio;

    return {
      ...frame,
      derived: {
        ...frame.derived,
        squatDepthProxy,
        armElevationAvg,
        armElevationLeft,
        armElevationRight,
        trunkLeanDeg,
        kneeTrackingRatio,
      },
    };
  });
}

function applyPhaseHints(stepId: CameraStepId, frames: PoseFeaturesFrame[]): PoseFeaturesFrame[] {
  if (frames.length === 0) return frames;

  if (stepId === 'squat') {
    const maxDepth = Math.max(...frames.map((frame) => frame.derived.squatDepthProxy ?? 0));
    /** PR G10: bottom = 30% of excursion. Shallower real cycle can get bottom phase. */
    const bottomThreshold = maxDepth * 0.3;
    const candidates = frames.map((frame, index) => {
      const previousDepth = index > 0 ? frames[index - 1]!.derived.squatDepthProxy : null;
      const currentDepth = frame.derived.squatDepthProxy;
      let phaseHint: PosePhaseHint = 'unknown';

      if (typeof currentDepth === 'number') {
        const depthDelta = typeof previousDepth === 'number' ? currentDepth - previousDepth : 0;

        if (currentDepth < 0.08) {
          phaseHint = 'start';
        } else if (currentDepth >= bottomThreshold && Math.abs(depthDelta) < 0.022) {
          phaseHint = 'bottom';
        } else if (depthDelta > 0.008) {
          phaseHint = 'descent';
        } else if (depthDelta < -0.008) {
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
    const derived = buildDerivedMetrics(joints, previousFrame);
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

  return applyPhaseHints(stepId, stabilizeDerivedSignals(features));
}
