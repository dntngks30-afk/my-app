/**
 * PR-OH-VISUAL-SNAPSHOT-06C: bounded JPEG snapshots + overlay for overhead visual-truth candidates.
 * Export/diagnostic only — no gate or motion coupling.
 */
import { POSE_LANDMARKS, type PoseFrame, type PoseLandmark } from '@/lib/motion/pose-types';
import type {
  OverheadVisualTruthCandidateExport,
  OverheadVisualTruthCandidatesExport,
  OverheadVisualTruthLandmarksCompact,
} from '@/lib/camera/overhead/visual-truth-candidates';

export const OVERHEAD_VISUAL_SNAPSHOT_EXPORT_VERSION = 'oh-visual-snapshot-06c-1' as const;

/** Skip absurdly large payloads in trace JSON */
const MAX_IMAGE_DATA_URL_CHARS = 320_000;

export type OverheadSnapshotOverlayLandmarks = Pick<
  OverheadVisualTruthLandmarksCompact,
  | 'nose'
  | 'leftEar'
  | 'rightEar'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftHip'
  | 'rightHip'
  | 'derivedHeadTopProxyY'
  | 'headTopProxySource'
>;

export type OverheadVisualTruthSnapshotRecord = {
  version: typeof OVERHEAD_VISUAL_SNAPSHOT_EXPORT_VERSION;
  candidateTag: OverheadVisualTruthCandidateExport['tag'];
  frameIndex: number;
  timestampMs: number;
  insideSelectedWindow: boolean;
  imageMimeType: 'image/jpeg';
  imageMaxEdgePx: number;
  imageDataUrl: string;
  metricsEcho: {
    rawArmElevationAvgDeg: number | null;
    smoothedArmElevationAvgDeg: number | null;
    rawWristAboveNoseAvgNorm: number | null;
    smoothedWristAboveNoseAvgNorm: number | null;
    rawWristAboveEarAvgNorm: number | null;
    smoothedWristAboveEarAvgNorm: number | null;
    rawWristAboveHeadTopProxyAvgNorm: number | null;
    smoothedWristAboveHeadTopProxyAvgNorm: number | null;
  };
  overlayLandmarks: OverheadSnapshotOverlayLandmarks;
};

export type OverheadVisualTruthSnapshotBundle = {
  version: typeof OVERHEAD_VISUAL_SNAPSHOT_EXPORT_VERSION;
  maxSnapshots: number;
  /** Linked to `visualTruthCandidates` tags / indices for the same attempt */
  linkedVisualTruthVersion: OverheadVisualTruthCandidatesExport['version'] | null;
  snapshots: OverheadVisualTruthSnapshotRecord[];
};

function headTopProxyYFromPoseLandmarks(lms: PoseLandmark[] | null | undefined): number | null {
  if (!lms || lms.length < 9) return null;
  const ys: number[] = [];
  const push = (i: number) => {
    const y = lms[i]?.y;
    if (typeof y === 'number' && Number.isFinite(y)) ys.push(y);
  };
  push(POSE_LANDMARKS.NOSE);
  push(POSE_LANDMARKS.LEFT_EAR);
  push(POSE_LANDMARKS.RIGHT_EAR);
  if (ys.length === 0) return null;
  return Math.min(...ys);
}

function pickLm(lms: PoseLandmark[] | null | undefined, i: number): PoseLandmark | null {
  if (!lms || i < 0 || i >= lms.length) return null;
  const lm = lms[i]!;
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return null;
  return lm;
}

function drawOverheadDiagnosticOverlay(
  ctx: CanvasRenderingContext2D,
  lms: PoseLandmark[] | null | undefined,
  w: number,
  h: number
) {
  if (!lms || lms.length < 25) return;

  const keyIdx = [
    POSE_LANDMARKS.NOSE,
    POSE_LANDMARKS.LEFT_EAR,
    POSE_LANDMARKS.RIGHT_EAR,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.RIGHT_ELBOW,
    POSE_LANDMARKS.LEFT_WRIST,
    POSE_LANDMARKS.RIGHT_WRIST,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
  ];

  const headY = headTopProxyYFromPoseLandmarks(lms);
  if (headY !== null) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.55)';
    ctx.lineWidth = Math.max(1, Math.round(w * 0.004));
    ctx.setLineDash([6, 4]);
    const yPx = headY * h;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, yPx);
    ctx.lineTo(w * 0.88, yPx);
    ctx.stroke();
    ctx.restore();
  }

  const nose = pickLm(lms, POSE_LANDMARKS.NOSE);
  ctx.lineWidth = Math.max(1, Math.round(w * 0.003));
  for (const i of keyIdx) {
    const lm = pickLm(lms, i);
    if (!lm) continue;
    const vis =
      typeof lm.visibility === 'number' && Number.isFinite(lm.visibility) ? lm.visibility : 0.75;
    const px = lm.x * w;
    const py = lm.y * h;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 220, 80, ${0.35 + vis * 0.45})`;
    ctx.arc(px, py, Math.max(2, w * 0.009), 0, Math.PI * 2);
    ctx.fill();
  }

  if (nose) {
    const nx = nose.x * w;
    const ny = nose.y * h;
    for (const wi of [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST]) {
      const wlm = pickLm(lms, wi);
      if (!wlm) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(wlm.x * w, wlm.y * h);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** PR-OH-DISTAL-HAND-OBS-07B: fingertip overlay (diagnostic snapshot only) */
  const distalIdx = [
    POSE_LANDMARKS.LEFT_INDEX,
    POSE_LANDMARKS.RIGHT_INDEX,
    POSE_LANDMARKS.LEFT_PINKY,
    POSE_LANDMARKS.RIGHT_PINKY,
    POSE_LANDMARKS.LEFT_THUMB,
    POSE_LANDMARKS.RIGHT_THUMB,
  ];
  for (const i of distalIdx) {
    const lm = pickLm(lms, i);
    if (!lm) continue;
    const vis =
      typeof lm.visibility === 'number' && Number.isFinite(lm.visibility) ? lm.visibility : 0.75;
    const px = lm.x * w;
    const py = lm.y * h;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 100, 220, ${0.35 + vis * 0.45})`;
    ctx.arc(px, py, Math.max(2, w * 0.007), 0, Math.PI * 2);
    ctx.fill();
  }
}

export type CaptureOverheadTruthSnapshotOptions = {
  maxEdgePx?: number;
  jpegQuality?: number;
};

/**
 * Captures the current video bitmap plus a minimal overhead landmark overlay (same instant as hook pose).
 * Returns null if the video is not ready or canvas export fails.
 */
export function captureOverheadTruthSnapshotDataUrl(
  video: HTMLVideoElement,
  poseFrame: PoseFrame,
  options?: CaptureOverheadTruthSnapshotOptions
): string | null {
  try {
    if (typeof document === 'undefined') return null;
    if (video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const maxEdge = options?.maxEdgePx ?? 360;
    const q = options?.jpegQuality ?? 0.72;
    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    const cw = Math.max(1, Math.round(vw * scale));
    const ch = Math.max(1, Math.round(vh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, cw, ch);
    drawOverheadDiagnosticOverlay(ctx, poseFrame.landmarks, cw, ch);

    const dataUrl = canvas.toDataURL('image/jpeg', q);
    if (!dataUrl.startsWith('data:image/jpeg') || dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
      return null;
    }
    return dataUrl;
  } catch {
    return null;
  }
}

function overlayFromCandidate(
  c: OverheadVisualTruthCandidateExport
): OverheadSnapshotOverlayLandmarks {
  const lc = c.landmarksCompact;
  if (!lc) {
    return {
      nose: null,
      leftEar: null,
      rightEar: null,
      leftWrist: null,
      rightWrist: null,
      leftElbow: null,
      rightElbow: null,
      leftShoulder: null,
      rightShoulder: null,
      leftHip: null,
      rightHip: null,
      derivedHeadTopProxyY: null,
      headTopProxySource: 'min_nose_leftEar_rightEar_y',
    };
  }
  return {
    nose: lc.nose,
    leftEar: lc.leftEar,
    rightEar: lc.rightEar,
    leftWrist: lc.leftWrist,
    rightWrist: lc.rightWrist,
    leftElbow: lc.leftElbow,
    rightElbow: lc.rightElbow,
    leftShoulder: lc.leftShoulder,
    rightShoulder: lc.rightShoulder,
    leftHip: lc.leftHip,
    rightHip: lc.rightHip,
    derivedHeadTopProxyY: lc.derivedHeadTopProxyY,
    headTopProxySource: lc.headTopProxySource,
  };
}

function metricsEchoFromCandidate(c: OverheadVisualTruthCandidateExport) {
  return {
    rawArmElevationAvgDeg: c.rawArmElevationAvgDeg,
    smoothedArmElevationAvgDeg: c.smoothedArmElevationAvgDeg,
    rawWristAboveNoseAvgNorm: c.rawWristAboveNoseAvgNorm,
    smoothedWristAboveNoseAvgNorm: c.smoothedWristAboveNoseAvgNorm,
    rawWristAboveEarAvgNorm: c.rawWristAboveEarAvgNorm,
    smoothedWristAboveEarAvgNorm: c.smoothedWristAboveEarAvgNorm,
    rawWristAboveHeadTopProxyAvgNorm: c.rawWristAboveHeadTopProxyAvgNorm,
    smoothedWristAboveHeadTopProxyAvgNorm: c.smoothedWristAboveHeadTopProxyAvgNorm,
  };
}

export type BuildOverheadVisualTruthSnapshotBundleOptions = {
  maxSnapshots?: number;
  /** When true, include earliestNearGlobalPeakArm if it differs from prior picks */
  includeEarliestNearPeak?: boolean;
  imageMaxEdgePx?: number;
};

/**
 * Maps 06B candidates to parallel hook-accepted JPEG ring buffer entries by `frameIndex`.
 */
export function buildOverheadVisualTruthSnapshotBundle(
  visualTruth: OverheadVisualTruthCandidatesExport | null | undefined,
  parallelDataUrlsByFrameIndex: readonly string[],
  opts?: BuildOverheadVisualTruthSnapshotBundleOptions
): OverheadVisualTruthSnapshotBundle | null {
  if (!visualTruth) return null;

  const maxSnapshots = Math.min(4, Math.max(2, opts?.maxSnapshots ?? 4));
  const includeEarliest = opts?.includeEarliestNearPeak !== false;
  const imageMaxEdgePx = opts?.imageMaxEdgePx ?? 360;

  const ordered: OverheadVisualTruthCandidateExport[] = [];
  const push = (c: OverheadVisualTruthCandidateExport | null) => {
    if (!c) return;
    ordered.push(c);
  };

  push(visualTruth.selectedWindowBest);
  push(visualTruth.globalBestArmElevation);
  push(visualTruth.globalBestHeadRelative);
  if (includeEarliest) {
    push(visualTruth.earliestNearGlobalPeakArm);
  }

  const seen = new Set<number>();
  const snapshots: OverheadVisualTruthSnapshotRecord[] = [];

  for (const c of ordered) {
    if (snapshots.length >= maxSnapshots) break;
    if (seen.has(c.frameIndex)) continue;
    const url = parallelDataUrlsByFrameIndex[c.frameIndex];
    if (typeof url !== 'string' || url.length === 0) continue;
    if (url.length > MAX_IMAGE_DATA_URL_CHARS) continue;

    seen.add(c.frameIndex);
    snapshots.push({
      version: OVERHEAD_VISUAL_SNAPSHOT_EXPORT_VERSION,
      candidateTag: c.tag,
      frameIndex: c.frameIndex,
      timestampMs: c.timestampMs,
      insideSelectedWindow: c.insideSelectedWindow,
      imageMimeType: 'image/jpeg',
      imageMaxEdgePx,
      imageDataUrl: url,
      metricsEcho: metricsEchoFromCandidate(c),
      overlayLandmarks: overlayFromCandidate(c),
    });
  }

  if (snapshots.length === 0) return null;

  return {
    version: OVERHEAD_VISUAL_SNAPSHOT_EXPORT_VERSION,
    maxSnapshots,
    linkedVisualTruthVersion: visualTruth.version,
    snapshots,
  };
}

/** Merge helper for `recordAttemptSnapshot` options */
export function buildOverheadVisualTruthSnapshotRecordAttemptOptions(
  visualTruth: OverheadVisualTruthCandidatesExport | null | undefined,
  parallelDataUrlsByFrameIndex: readonly string[],
  opts?: BuildOverheadVisualTruthSnapshotBundleOptions
): { overheadVisualTruthSnapshots: OverheadVisualTruthSnapshotBundle } | undefined {
  const bundle = buildOverheadVisualTruthSnapshotBundle(
    visualTruth,
    parallelDataUrlsByFrameIndex,
    opts
  );
  return bundle ? { overheadVisualTruthSnapshots: bundle } : undefined;
}
