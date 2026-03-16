/**
 * Step별 critical joint spec 및 per-step 진단 유틸
 * PR-2: 신호 구조 명확화용 경량 레이어
 */
import type { PoseFeaturesFrame } from './pose-features';
import type { CameraStepId } from '@/lib/public/camera-test';

/** Joint key (pose-features와 동일) */
export type JointKey =
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'torsoCenter'
  | 'shoulderCenter'
  | 'hipCenter'
  | 'ankleCenter';

/** Squat phase: descent, bottom, ascent */
export type SquatPhase = 'descent' | 'bottom' | 'ascent';

/** Overhead reach phase: raise, hold (hold = peak frames) */
export type OverheadReachPhase = 'raise' | 'hold';

/** Step phase별 critical joints (trunk = shoulderCenter + hipCenter) */
export const SQUAT_PHASE_JOINTS: Record<SquatPhase, JointKey[]> = {
  descent: ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle', 'shoulderCenter', 'hipCenter'],
  bottom: ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle', 'shoulderCenter', 'hipCenter'],
  ascent: ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle', 'shoulderCenter', 'hipCenter'],
};

export const OVERHEAD_PHASE_JOINTS: Record<OverheadReachPhase, JointKey[]> = {
  raise: ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'shoulderCenter', 'hipCenter'],
  hold: ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'shoulderCenter', 'hipCenter'],
};

const VISIBILITY_THRESHOLD = 0.45;

function getVisibleRatio(landmark: { visibility?: number } | null): number {
  if (!landmark) return 0;
  if (typeof landmark.visibility === 'number') {
    return landmark.visibility >= VISIBILITY_THRESHOLD ? 1 : 0;
  }
  return 1;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Per-step 진단 결과 */
export interface PerStepDiagnostic {
  criticalJointAvailability: number;
  missingCriticalJoints: string[];
  leftSideCompleteness: number;
  rightSideCompleteness: number;
  leftRightAsymmetry: number;
  metricSufficiency: number;
  frameCount: number;
  instabilityFlags: string[];
}

/** Squat per-step 진단 */
export interface SquatPerStepDiagnostics {
  descent: PerStepDiagnostic;
  bottom: PerStepDiagnostic;
  ascent: PerStepDiagnostic;
}

/** Overhead reach per-step 진단 */
export interface OverheadPerStepDiagnostics {
  raise: PerStepDiagnostic;
  hold: PerStepDiagnostic;
}

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

function computePerPhaseDiagnostic(
  frames: PoseFeaturesFrame[],
  phase: SquatPhase | OverheadReachPhase,
  phaseHint: PoseFeaturesFrame['phaseHint'],
  criticalJoints: JointKey[],
  metricCount: number,
  expectedMetrics: number
): PerStepDiagnostic {
  const phaseFrames = frames.filter((f) => f.phaseHint === phaseHint);
  const instabilityFlags: string[] = [];
  let leftSideCompleteness = 0;
  let rightSideCompleteness = 0;
  let criticalJointAvailability = 0;
  const missingJoints = new Set<string>();

  if (phaseFrames.length > 0) {
    const availPerJoint = criticalJoints.map((key) => {
      const ratios = phaseFrames.map((f) => getVisibleRatio(f.joints[key]));
      const avg = mean(ratios);
      if (avg < 0.5) missingJoints.add(key);
      return avg;
    });
    criticalJointAvailability = mean(availPerJoint);

    const leftJoints = LEFT_SIDE_KEYS.filter((k) => criticalJoints.includes(k));
    const rightJoints = RIGHT_SIDE_KEYS.filter((k) => criticalJoints.includes(k));
    const leftRatios = phaseFrames.map((f) =>
      leftJoints.length > 0 ? mean(leftJoints.map((k) => getVisibleRatio(f.joints[k]))) : 0
    );
    const rightRatios = phaseFrames.map((f) =>
      rightJoints.length > 0 ? mean(rightJoints.map((k) => getVisibleRatio(f.joints[k]))) : 0
    );
    leftSideCompleteness = mean(leftRatios);
    rightSideCompleteness = mean(rightRatios);

    const areas = phaseFrames.map((f) => f.bodyBox.area).filter((a) => a > 0);
    if (areas.length >= 2) {
      const avg = mean(areas);
      const variance = mean(areas.map((a) => (a - avg) ** 2));
      if (Math.sqrt(variance) / Math.max(avg, 0.01) > 0.35) {
        instabilityFlags.push('unstable_bbox');
      }
    }
  }

  const leftRightAsymmetry = Math.abs(leftSideCompleteness - rightSideCompleteness);
  const metricSufficiency = expectedMetrics > 0 ? Math.min(1, metricCount / expectedMetrics) : 0;

  return {
    criticalJointAvailability,
    missingCriticalJoints: Array.from(missingJoints),
    leftSideCompleteness,
    rightSideCompleteness,
    leftRightAsymmetry,
    metricSufficiency,
    frameCount: phaseFrames.length,
    instabilityFlags,
  };
}

/** Squat per-step 진단 계산 */
export function getSquatPerStepDiagnostics(
  frames: PoseFeaturesFrame[],
  metricCount: number
): SquatPerStepDiagnostics {
  const expectedMetrics = 4;
  return {
    descent: computePerPhaseDiagnostic(
      frames,
      'descent',
      'descent',
      SQUAT_PHASE_JOINTS.descent,
      metricCount,
      expectedMetrics
    ),
    bottom: computePerPhaseDiagnostic(
      frames,
      'bottom',
      'bottom',
      SQUAT_PHASE_JOINTS.bottom,
      metricCount,
      expectedMetrics
    ),
    ascent: computePerPhaseDiagnostic(
      frames,
      'ascent',
      'ascent',
      SQUAT_PHASE_JOINTS.ascent,
      metricCount,
      expectedMetrics
    ),
  };
}

/** Overhead reach per-step 진단 계산 */
export function getOverheadPerStepDiagnostics(
  frames: PoseFeaturesFrame[],
  metricCount: number
): OverheadPerStepDiagnostics {
  const expectedMetrics = 3;
  return {
    raise: computePerPhaseDiagnostic(
      frames,
      'raise',
      'raise',
      OVERHEAD_PHASE_JOINTS.raise,
      metricCount,
      expectedMetrics
    ),
    hold: computePerPhaseDiagnostic(
      frames,
      'hold',
      'peak',
      OVERHEAD_PHASE_JOINTS.hold,
      metricCount,
      expectedMetrics
    ),
  };
}
