/**
 * PR-OH-DISTAL-HAND-OBS-07B: overhead-only distal-hand vs wrist head-relative observability.
 * Diagnostic export only — not used for gates or motion.
 */
import { overheadHeadTopProxyY } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';

export const OVERHEAD_DISTAL_HAND_OBS_VERSION = 'oh-distal-hand-obs-07b-1' as const;

/** Mirror pose-features OVERHEAD_KINEMATIC_TORSO_SCALE_MIN for 04E-comparable norms */
const TORSO_SCALE_FLOOR = 0.04;

/** Loose visibility for optional fingertips (diagnostic only) */
const DISTAL_VIS_MIN = 0.2;

export type OverheadDistalHandWhich = 'index' | 'pinky' | 'thumb';

export type OverheadWristSideSplitExport = {
  leftNorm: number | null;
  rightNorm: number | null;
  meanNorm: number | null;
  bestSideNorm: number | null;
  bestSide: 'left' | 'right' | 'tie' | null;
};

export type DistalHandHeadRefVectorExport = {
  leftIndexNorm: number | null;
  rightIndexNorm: number | null;
  leftPinkyNorm: number | null;
  rightPinkyNorm: number | null;
  leftThumbNorm: number | null;
  rightThumbNorm: number | null;
  meanBestVisibleDistalNorm: number | null;
  bestSideBestVisibleDistalNorm: number | null;
};

export type OverheadDistalHandObservabilityExport = {
  version: typeof OVERHEAD_DISTAL_HAND_OBS_VERSION;
  bestVisibleDistalPointLeft: OverheadDistalHandWhich | null;
  bestVisibleDistalPointRight: OverheadDistalHandWhich | null;
  /** Side with higher above-nose norm for the per-side best-visible distal point */
  bestSideByBestVisibleDistalAboveNose: 'left' | 'right' | 'tie' | null;
  wristAboveNose: OverheadWristSideSplitExport;
  wristAboveEar: OverheadWristSideSplitExport;
  wristAboveHeadTopProxy: OverheadWristSideSplitExport;
  distalHandAboveNose: DistalHandHeadRefVectorExport;
  distalHandAboveEar: DistalHandHeadRefVectorExport;
  distalHandAboveHeadTopProxy: DistalHandHeadRefVectorExport;
};

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Same geometry as 04E `overheadJointAboveHeadRefNorm` (image y, ref above joint → positive). */
function normJointAboveRef(
  shoulder: PoseLandmark,
  hip: PoseLandmark,
  ref: PoseLandmark,
  joint: PoseLandmark
): number | null {
  const scale = Math.abs(shoulder.y - hip.y);
  if (!Number.isFinite(scale) || scale < 1e-8) return null;
  const denom = Math.max(scale, TORSO_SCALE_FLOOR);
  return (ref.y - joint.y) / denom;
}

function normJointAboveHeadTopY(
  shoulder: PoseLandmark,
  hip: PoseLandmark,
  headTopY: number,
  joint: PoseLandmark
): number | null {
  const scale = Math.abs(shoulder.y - hip.y);
  if (!Number.isFinite(scale) || scale < 1e-8) return null;
  const denom = Math.max(scale, TORSO_SCALE_FLOOR);
  return (headTopY - joint.y) / denom;
}

function getLm(lms: PoseLandmark[] | null | undefined, idx: number): PoseLandmark | null {
  if (!lms || idx < 0 || idx >= lms.length) return null;
  const lm = lms[idx]!;
  if (!lm || !finite(lm.x) || !finite(lm.y)) return null;
  return lm;
}

function visOk(lm: PoseLandmark): boolean {
  if (typeof lm.visibility !== 'number' || !Number.isFinite(lm.visibility)) return true;
  return lm.visibility >= DISTAL_VIS_MIN;
}

function pickBestVisibleDistal(
  lms: PoseLandmark[],
  side: 'left' | 'right'
): { which: OverheadDistalHandWhich | null; lm: PoseLandmark | null } {
  const idxMap: { which: OverheadDistalHandWhich; idx: number }[] =
    side === 'left'
      ? [
          { which: 'index', idx: POSE_LANDMARKS.LEFT_INDEX },
          { which: 'pinky', idx: POSE_LANDMARKS.LEFT_PINKY },
          { which: 'thumb', idx: POSE_LANDMARKS.LEFT_THUMB },
        ]
      : [
          { which: 'index', idx: POSE_LANDMARKS.RIGHT_INDEX },
          { which: 'pinky', idx: POSE_LANDMARKS.RIGHT_PINKY },
          { which: 'thumb', idx: POSE_LANDMARKS.RIGHT_THUMB },
        ];

  let best: { which: OverheadDistalHandWhich; lm: PoseLandmark } | null = null;
  for (const { which, idx } of idxMap) {
    const lm = getLm(lms, idx);
    if (!lm || !visOk(lm)) continue;
    if (!best || lm.y < best.lm.y) {
      best = { which, lm };
    }
  }
  return best ? { which: best.which, lm: best.lm } : { which: null, lm: null };
}

function sideSplit(
  left: number | null,
  right: number | null,
  meanFallback: number | null
): OverheadWristSideSplitExport {
  const meanNorm =
    finite(left) && finite(right)
      ? (left! + right!) / 2
      : finite(left)
        ? left
        : finite(right)
          ? right
          : meanFallback;

  let bestSideNorm: number | null = null;
  if (finite(left) && finite(right)) {
    bestSideNorm = Math.max(left!, right!);
  } else if (finite(left)) {
    bestSideNorm = left!;
  } else if (finite(right)) {
    bestSideNorm = right!;
  }

  let bestSide: 'left' | 'right' | 'tie' | null = null;
  if (finite(left) && finite(right)) {
    const d = left! - right!;
    if (Math.abs(d) < 1e-9) bestSide = 'tie';
    else bestSide = d > 0 ? 'left' : 'right';
  } else if (finite(left)) bestSide = 'left';
  else if (finite(right)) bestSide = 'right';

  return {
    leftNorm: finite(left) ? left : null,
    rightNorm: finite(right) ? right : null,
    meanNorm: finite(meanNorm) ? meanNorm : null,
    bestSideNorm,
    bestSide,
  };
}

function wristHeadTopLeftRight(joints: PoseFeaturesFrame['joints']): {
  left: number | null;
  right: number | null;
} {
  const headTopY = overheadHeadTopProxyY(joints);
  if (headTopY === null || !Number.isFinite(headTopY)) return { left: null, right: null };
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const lw = joints.leftWrist;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;
  const rw = joints.rightWrist;
  const left =
    ls && lh && lw ? normJointAboveHeadTopY(ls, lh, headTopY, lw) : null;
  const right =
    rs && rh && rw ? normJointAboveHeadTopY(rs, rh, headTopY, rw) : null;
  return { left, right };
}

function buildDistalRefVector(
  lms: PoseLandmark[],
  joints: PoseFeaturesFrame['joints'],
  mode: 'nose' | 'ear' | 'headTop'
): DistalHandHeadRefVectorExport {
  const nose = joints.nose;
  const le = joints.leftEar;
  const re = joints.rightEar;
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;

  const headTopY = mode === 'headTop' ? overheadHeadTopProxyY(joints) : null;

  const normFor = (joint: PoseLandmark | null, side: 'left' | 'right'): number | null => {
    if (!joint) return null;
    if (mode === 'nose' && nose && ls && lh && rs && rh) {
      return side === 'left'
        ? normJointAboveRef(ls, lh, nose, joint)
        : normJointAboveRef(rs, rh, nose, joint);
    }
    if (mode === 'ear' && le && re && ls && lh && rs && rh) {
      return side === 'left'
        ? le && ls && lh
          ? normJointAboveRef(ls, lh, le, joint)
          : null
        : re && rs && rh
          ? normJointAboveRef(rs, rh, re, joint)
          : null;
    }
    if (mode === 'headTop' && headTopY !== null && ls && lh && rs && rh) {
      return side === 'left'
        ? normJointAboveHeadTopY(ls, lh, headTopY, joint)
        : normJointAboveHeadTopY(rs, rh, headTopY, joint);
    }
    return null;
  };

  const li = getLm(lms, POSE_LANDMARKS.LEFT_INDEX);
  const ri = getLm(lms, POSE_LANDMARKS.RIGHT_INDEX);
  const lp = getLm(lms, POSE_LANDMARKS.LEFT_PINKY);
  const rp = getLm(lms, POSE_LANDMARKS.RIGHT_PINKY);
  const lt = getLm(lms, POSE_LANDMARKS.LEFT_THUMB);
  const rt = getLm(lms, POSE_LANDMARKS.RIGHT_THUMB);

  const leftIndexNorm = normFor(li, 'left');
  const rightIndexNorm = normFor(ri, 'right');
  const leftPinkyNorm = normFor(lp, 'left');
  const rightPinkyNorm = normFor(rp, 'right');
  const leftThumbNorm = normFor(lt, 'left');
  const rightThumbNorm = normFor(rt, 'right');

  const leftPick = pickBestVisibleDistal(lms, 'left');
  const rightPick = pickBestVisibleDistal(lms, 'right');

  const leftBestNorm = normFor(leftPick.lm, 'left');
  const rightBestNorm = normFor(rightPick.lm, 'right');

  const meanBestVisibleDistalNorm =
    finite(leftBestNorm) && finite(rightBestNorm)
      ? (leftBestNorm! + rightBestNorm!) / 2
      : finite(leftBestNorm)
        ? leftBestNorm
        : finite(rightBestNorm)
          ? rightBestNorm
          : null;

  const bestSideBestVisibleDistalNorm =
    finite(leftBestNorm) && finite(rightBestNorm)
      ? Math.max(leftBestNorm!, rightBestNorm!)
      : finite(leftBestNorm)
        ? leftBestNorm
        : finite(rightBestNorm)
          ? rightBestNorm
          : null;

  return {
    leftIndexNorm,
    rightIndexNorm,
    leftPinkyNorm,
    rightPinkyNorm,
    leftThumbNorm,
    rightThumbNorm,
    meanBestVisibleDistalNorm,
    bestSideBestVisibleDistalNorm,
  };
}

function normFingerAboveNose(
  joint: PoseLandmark | null,
  side: 'left' | 'right',
  joints: PoseFeaturesFrame['joints']
): number | null {
  const nose = joints.nose;
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;
  if (!joint || !nose) return null;
  if (side === 'left' && ls && lh) return normJointAboveRef(ls, lh, nose, joint);
  if (side === 'right' && rs && rh) return normJointAboveRef(rs, rh, nose, joint);
  return null;
}

/**
 * Builds distal-hand + wrist side-split observability for one representative frame.
 * `smoothedLandmarkFrame` must align with `featureFrame` (same pipeline index).
 */
export function buildOverheadDistalHandObservabilityExport(
  smoothedLandmarkFrame: PoseLandmarks | null | undefined,
  featureFrame: PoseFeaturesFrame
): OverheadDistalHandObservabilityExport | null {
  const lms = smoothedLandmarkFrame?.landmarks;
  if (!lms || lms.length <= POSE_LANDMARKS.RIGHT_THUMB) return null;

  const joints = featureFrame.joints;
  const sd = featureFrame.derived;

  const leftPick = pickBestVisibleDistal(lms, 'left');
  const rightPick = pickBestVisibleDistal(lms, 'right');

  const ln = normFingerAboveNose(leftPick.lm, 'left', joints);
  const rn = normFingerAboveNose(rightPick.lm, 'right', joints);
  const bestSideByBestVisibleDistalAboveNose = sideSplit(ln, rn, null).bestSide;

  const wristAboveNose = sideSplit(
    sd.wristAboveNoseLeftNorm ?? null,
    sd.wristAboveNoseRightNorm ?? null,
    sd.wristAboveNoseAvgNorm ?? null
  );
  const wristAboveEar = sideSplit(
    sd.wristAboveEarLeftNorm ?? null,
    sd.wristAboveEarRightNorm ?? null,
    sd.wristAboveEarAvgNorm ?? null
  );
  const ht = wristHeadTopLeftRight(joints);
  const wristAboveHeadTopProxy = sideSplit(ht.left, ht.right, sd.wristAboveHeadTopProxyAvgNorm ?? null);

  return {
    version: OVERHEAD_DISTAL_HAND_OBS_VERSION,
    bestVisibleDistalPointLeft: leftPick.which,
    bestVisibleDistalPointRight: rightPick.which,
    bestSideByBestVisibleDistalAboveNose,
    wristAboveNose,
    wristAboveEar,
    wristAboveHeadTopProxy,
    distalHandAboveNose: buildDistalRefVector(lms, joints, 'nose'),
    distalHandAboveEar: buildDistalRefVector(lms, joints, 'ear'),
    distalHandAboveHeadTopProxy: buildDistalRefVector(lms, joints, 'headTop'),
  };
}
