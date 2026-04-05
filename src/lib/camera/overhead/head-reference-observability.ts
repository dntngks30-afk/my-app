/**
 * PR-OH-HEAD-REFERENCE-OBS-08B: parallel head-reference families vs wrist / best-visible distal.
 * Diagnostic export only — not gates, motion, readiness, or pass logic.
 *
 * Keeps production `overheadHeadTopProxyY` (min nose/ears y) unchanged; alternative refs are explicit candidates.
 */
import { overheadHeadTopProxyY } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { OverheadWristSideSplitExport } from './distal-hand-observability';

export const OVERHEAD_HEAD_REFERENCE_OBS_VERSION = 'oh-head-reference-obs-08b-1' as const;

/** Same geometry floor as 04E / 07B */
const TORSO_SCALE_FLOOR = 0.04;

const DISTAL_VIS_MIN = 0.2;

export type OverheadHeadRefFamilyStrip = {
  referenceY: number | null;
  referenceType: string;
  referenceSource: string;
  diagnosticOnly: true;
  wristAboveRef: OverheadWristSideSplitExport;
  distalHandAboveRef: OverheadWristSideSplitExport;
};

export type OverheadHeadReferenceObservabilityExport = {
  version: typeof OVERHEAD_HEAD_REFERENCE_OBS_VERSION;
  noseOnly: OverheadHeadRefFamilyStrip;
  earOnly: OverheadHeadRefFamilyStrip;
  currentHeadTopProxy: OverheadHeadRefFamilyStrip;
  relaxedHeadTopProxyCandidate: OverheadHeadRefFamilyStrip;
  faceCenterCandidate: OverheadHeadRefFamilyStrip;
};

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

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

type DistalWhich = 'index' | 'pinky' | 'thumb';

function pickBestVisibleDistal(
  lms: PoseLandmark[],
  side: 'left' | 'right'
): { which: DistalWhich | null; lm: PoseLandmark | null } {
  const idxMap: { which: DistalWhich; idx: number }[] =
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

  let best: { which: DistalWhich; lm: PoseLandmark } | null = null;
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
  const left = ls && lh && lw ? normJointAboveHeadTopY(ls, lh, headTopY, lw) : null;
  const right = rs && rh && rw ? normJointAboveHeadTopY(rs, rh, headTopY, rw) : null;
  return { left, right };
}

function wristScalarRefLeftRight(
  joints: PoseFeaturesFrame['joints'],
  refY: number | null
): { left: number | null; right: number | null } {
  if (refY === null || !Number.isFinite(refY)) return { left: null, right: null };
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const lw = joints.leftWrist;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;
  const rw = joints.rightWrist;
  const left = ls && lh && lw ? normJointAboveHeadTopY(ls, lh, refY, lw) : null;
  const right = rs && rh && rw ? normJointAboveHeadTopY(rs, rh, refY, rw) : null;
  return { left, right };
}

function distalBestSideNormsForLandmarkRef(
  lms: PoseLandmark[],
  joints: PoseFeaturesFrame['joints'],
  ref: PoseLandmark | null,
  mode: 'shared_ref' | 'same_side_ear'
): { left: number | null; right: number | null } {
  const le = joints.leftEar;
  const re = joints.rightEar;
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;
  const leftPick = pickBestVisibleDistal(lms, 'left');
  const rightPick = pickBestVisibleDistal(lms, 'right');

  let left: number | null = null;
  let right: number | null = null;

  if (mode === 'shared_ref' && ref && ls && lh && rs && rh) {
    if (leftPick.lm) left = normJointAboveRef(ls, lh, ref, leftPick.lm);
    if (rightPick.lm) right = normJointAboveRef(rs, rh, ref, rightPick.lm);
  }
  if (mode === 'same_side_ear') {
    if (leftPick.lm && le && ls && lh) left = normJointAboveRef(ls, lh, le, leftPick.lm);
    if (rightPick.lm && re && rs && rh) right = normJointAboveRef(rs, rh, re, rightPick.lm);
  }

  return { left, right };
}

function distalBestSideNormsForScalarRef(
  lms: PoseLandmark[],
  joints: PoseFeaturesFrame['joints'],
  refY: number | null
): { left: number | null; right: number | null } {
  if (refY === null || !Number.isFinite(refY)) return { left: null, right: null };
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;
  const leftPick = pickBestVisibleDistal(lms, 'left');
  const rightPick = pickBestVisibleDistal(lms, 'right');
  const left =
    leftPick.lm && ls && lh ? normJointAboveHeadTopY(ls, lh, refY, leftPick.lm) : null;
  const right =
    rightPick.lm && rs && rh ? normJointAboveHeadTopY(rs, rh, refY, rightPick.lm) : null;
  return { left, right };
}

function meanEarY(joints: PoseFeaturesFrame['joints']): number | null {
  const le = joints.leftEar;
  const re = joints.rightEar;
  const ly = le && finite(le.y) ? le.y : null;
  const ry = re && finite(re.y) ? re.y : null;
  if (finite(ly) && finite(ry)) return (ly! + ry!) / 2;
  if (finite(ly)) return ly!;
  if (finite(ry)) return ry!;
  return null;
}

function relaxedHeadTopCandidateY(joints: PoseFeaturesFrame['joints']): number | null {
  const ys: number[] = [];
  const n = joints.nose;
  const le = joints.leftEar;
  const re = joints.rightEar;
  if (n && finite(n.y)) ys.push(n.y);
  if (le && finite(le.y)) ys.push(le.y);
  if (re && finite(re.y)) ys.push(re.y);
  if (ys.length === 0) return null;
  return Math.max(...ys);
}

function faceCenterMeanY(joints: PoseFeaturesFrame['joints']): number | null {
  const ys: number[] = [];
  const n = joints.nose;
  const le = joints.leftEar;
  const re = joints.rightEar;
  if (n && finite(n.y)) ys.push(n.y);
  if (le && finite(le.y)) ys.push(le.y);
  if (re && finite(re.y)) ys.push(re.y);
  if (ys.length === 0) return null;
  return ys.reduce((a, b) => a + b, 0) / ys.length;
}

/**
 * Builds parallel head-reference observability for one representative frame.
 * Aligns with 07B: same torso norm, same best-visible distal pick, same production wrist norms where applicable.
 */
export function buildOverheadHeadReferenceObservabilityExport(
  smoothedLandmarkFrame: PoseLandmarks | null | undefined,
  featureFrame: PoseFeaturesFrame
): OverheadHeadReferenceObservabilityExport | null {
  const lms = smoothedLandmarkFrame?.landmarks;
  if (!lms || lms.length <= POSE_LANDMARKS.RIGHT_THUMB) return null;

  const joints = featureFrame.joints;
  const sd = featureFrame.derived;
  const nose = joints.nose;

  const wristNose = sideSplit(
    sd.wristAboveNoseLeftNorm ?? null,
    sd.wristAboveNoseRightNorm ?? null,
    sd.wristAboveNoseAvgNorm ?? null
  );
  const wristEar = sideSplit(
    sd.wristAboveEarLeftNorm ?? null,
    sd.wristAboveEarRightNorm ?? null,
    sd.wristAboveEarAvgNorm ?? null
  );
  const ht = wristHeadTopLeftRight(joints);
  const wristHeadTop = sideSplit(ht.left, ht.right, sd.wristAboveHeadTopProxyAvgNorm ?? null);

  const relaxedY = relaxedHeadTopCandidateY(joints);
  const wristRelaxed = sideSplit(
    ...(() => {
      const w = wristScalarRefLeftRight(joints, relaxedY);
      return [w.left, w.right, null] as const;
    })()
  );

  const faceY = faceCenterMeanY(joints);
  const wristFace = sideSplit(
    ...(() => {
      const w = wristScalarRefLeftRight(joints, faceY);
      return [w.left, w.right, null] as const;
    })()
  );

  const noseRefY = nose && finite(nose.y) ? nose.y : null;
  const distalNose = distalBestSideNormsForLandmarkRef(lms, joints, nose, 'shared_ref');
  /** Nose-only: wrist uses derived; distal uses nose landmark (same 04E geometry as 07B nose mode). */
  const noseOnly: OverheadHeadRefFamilyStrip = {
    referenceY: noseRefY,
    referenceType: 'nose_only_y',
    referenceSource: 'joints.nose.y; wrist from derived wristAboveNose*; distal best-visible vs nose',
    diagnosticOnly: true,
    wristAboveRef: wristNose,
    distalHandAboveRef: sideSplit(distalNose.left, distalNose.right, null),
  };

  const earYMeta = meanEarY(joints);
  const distalEar = distalBestSideNormsForLandmarkRef(lms, joints, null, 'same_side_ear');
  const earOnly: OverheadHeadRefFamilyStrip = {
    referenceY: earYMeta,
    referenceType: 'same_side_ear_y',
    referenceSource:
      'left wrist vs leftEar, right vs rightEar; meta.referenceY mean(leftEar,rightEar) when both',
    diagnosticOnly: true,
    wristAboveRef: wristEar,
    distalHandAboveRef: sideSplit(distalEar.left, distalEar.right, null),
  };

  const currentY = overheadHeadTopProxyY(joints);
  const distalHeadMin = distalBestSideNormsForScalarRef(lms, joints, currentY);
  const currentHeadTopProxy: OverheadHeadRefFamilyStrip = {
    referenceY: currentY,
    referenceType: 'current_head_top_proxy_min_nose_ears_y',
    referenceSource: 'overheadHeadTopProxyY (min nose, leftEar, rightEar); matches production 04E headTopProxy',
    diagnosticOnly: true,
    wristAboveRef: wristHeadTop,
    distalHandAboveRef: sideSplit(distalHeadMin.left, distalHeadMin.right, null),
  };

  const distalRelaxed = distalBestSideNormsForScalarRef(lms, joints, relaxedY);
  const relaxedHeadTopProxyCandidate: OverheadHeadRefFamilyStrip = {
    referenceY: relaxedY,
    referenceType: 'relaxed_head_top_max_nose_ears_y_candidate',
    referenceSource:
      'diagnostic-only: max(nose,leftEar,rightEar) y — lower barrier than min() proxy; not a gate',
    diagnosticOnly: true,
    wristAboveRef: wristRelaxed,
    distalHandAboveRef: sideSplit(distalRelaxed.left, distalRelaxed.right, null),
  };

  const distalFace = distalBestSideNormsForScalarRef(lms, joints, faceY);
  const faceCenterCandidate: OverheadHeadRefFamilyStrip = {
    referenceY: faceY,
    referenceType: 'face_center_mean_nose_ears_y_candidate',
    referenceSource:
      'diagnostic-only: mean y of available nose/ears; bounded alternative to min headTopProxy',
    diagnosticOnly: true,
    wristAboveRef: wristFace,
    distalHandAboveRef: sideSplit(distalFace.left, distalFace.right, null),
  };

  return {
    version: OVERHEAD_HEAD_REFERENCE_OBS_VERSION,
    noseOnly,
    earOnly,
    currentHeadTopProxy,
    relaxedHeadTopProxyCandidate,
    faceCenterCandidate,
  };
}
