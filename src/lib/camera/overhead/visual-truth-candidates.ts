/**
 * PR-OH-VISUAL-TRUTH-OBS-06B: export-only overhead visual-truth candidate diagnostics.
 * Does not participate in gates, thresholds, or window selection policy.
 */
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import { overheadHeadTopProxyY } from '@/lib/camera/pose-features';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseCaptureStats } from '@/lib/camera/use-pose-capture';
import {
  buildOverheadDistalHandObservabilityExport,
  type OverheadDistalHandObservabilityExport,
} from './distal-hand-observability';

export type { OverheadDistalHandObservabilityExport } from './distal-hand-observability';

export const OVERHEAD_VISUAL_TRUTH_EXPORT_VERSION = 'oh-visual-truth-obs-06b-1' as const;

export type VisualTruthCompactLandmark = {
  x: number;
  y: number;
  visibility: number | null;
};

export type OverheadVisualTruthLandmarksCompact = {
  nose: VisualTruthCompactLandmark | null;
  leftEar: VisualTruthCompactLandmark | null;
  rightEar: VisualTruthCompactLandmark | null;
  leftWrist: VisualTruthCompactLandmark | null;
  rightWrist: VisualTruthCompactLandmark | null;
  leftElbow: VisualTruthCompactLandmark | null;
  rightElbow: VisualTruthCompactLandmark | null;
  leftShoulder: VisualTruthCompactLandmark | null;
  rightShoulder: VisualTruthCompactLandmark | null;
  leftHip: VisualTruthCompactLandmark | null;
  rightHip: VisualTruthCompactLandmark | null;
  derivedHeadTopProxyY: number | null;
  headTopProxySource: 'min_nose_leftEar_rightEar_y';
  torsoScaleLeft: number | null;
  torsoScaleRight: number | null;
};

export type OverheadVisualTruthCandidateTag =
  | 'selectedWindowBest'
  | 'globalBestArmElevation'
  | 'globalBestHeadRelative'
  | 'bestArmElevationOutsideSelectedWindow'
  | 'earliestNearGlobalPeakArm';

export type OverheadVisualTruthCandidateExport = {
  tag: OverheadVisualTruthCandidateTag;
  frameIndex: number;
  timestampMs: number;
  insideSelectedWindow: boolean;
  /** Buffer frames are hook-admitted; always true here when index is in-range */
  survivedHookAcceptance: true;
  survivedFeatureValidity: boolean;
  rawArmElevationAvgDeg: number | null;
  smoothedArmElevationAvgDeg: number | null;
  rawWristAboveNoseAvgNorm: number | null;
  smoothedWristAboveNoseAvgNorm: number | null;
  rawWristAboveEarAvgNorm: number | null;
  smoothedWristAboveEarAvgNorm: number | null;
  rawWristAboveHeadTopProxyAvgNorm: number | null;
  smoothedWristAboveHeadTopProxyAvgNorm: number | null;
  rawShoulderWristElevationAvgDeg: number | null;
  smoothedShoulderWristElevationAvgDeg: number | null;
  landmarksCompact: OverheadVisualTruthLandmarksCompact | null;
  /** PR-OH-DISTAL-HAND-OBS-07B: fingertip + wrist side-split vs nose/ear/headTop (export-only) */
  distalHandObservability?: OverheadDistalHandObservabilityExport | null;
};

export type OverheadVisualTruthNearTopLossSummary = {
  bufferFrameCount: number;
  sampledFrameCount: number;
  hookDroppedFrameCount: number;
  landmarkOrAdaptorFailedFrameCount: number;
  timestampDiscontinuityCount: number;
  timestampGapHintsInTopNeighborhood: number;
  unstableLandmarkHintsInTopNeighborhood: number;
  unstableBboxHintsInTopNeighborhood: number;
  strongestArmElevationOutsideSelectedWindow: boolean;
  strongestHeadRelativeOutsideSelectedWindow: boolean;
  /**
   * True when some hook-admitted frame fails overhead analyzability but has higher
   * raw (pre-derived-stabilize) arm elevation than the selected-window best (smoothed).
   */
  hasStrongerNonAnalyzableRawArmThanSelectedWindowBestSmoothed: boolean;
};

export type OverheadVisualTruthCandidatesExport = {
  version: typeof OVERHEAD_VISUAL_TRUTH_EXPORT_VERSION;
  selectedWindowStartMs: number | null;
  selectedWindowEndMs: number | null;
  selectedWindowBest: OverheadVisualTruthCandidateExport | null;
  globalBestArmElevation: OverheadVisualTruthCandidateExport | null;
  globalBestHeadRelative: OverheadVisualTruthCandidateExport | null;
  bestArmElevationOutsideSelectedWindow: OverheadVisualTruthCandidateExport | null;
  /** First chronologically (among analyzable frames) reaching ≥85% of global smoothed arm peak */
  earliestNearGlobalPeakArm: OverheadVisualTruthCandidateExport | null;
  /** Up to 5 unique frames for compact logs */
  representativeCandidates: OverheadVisualTruthCandidateExport[];
  nearTopLossSummary: OverheadVisualTruthNearTopLossSummary;
};

function compactLm(lm: PoseLandmark | null): VisualTruthCompactLandmark | null {
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return null;
  const visibility =
    typeof lm.visibility === 'number' && Number.isFinite(lm.visibility) ? lm.visibility : null;
  return { x: lm.x, y: lm.y, visibility };
}

function buildLandmarksCompact(joints: PoseFeaturesFrame['joints']): OverheadVisualTruthLandmarksCompact {
  const ls = joints.leftShoulder;
  const lh = joints.leftHip;
  const rs = joints.rightShoulder;
  const rh = joints.rightHip;
  const torsoScaleLeft =
    ls && lh && Number.isFinite(ls.y) && Number.isFinite(lh.y) ? Math.abs(ls.y - lh.y) : null;
  const torsoScaleRight =
    rs && rh && Number.isFinite(rs.y) && Number.isFinite(rh.y) ? Math.abs(rs.y - rh.y) : null;
  return {
    nose: compactLm(joints.nose),
    leftEar: compactLm(joints.leftEar),
    rightEar: compactLm(joints.rightEar),
    leftWrist: compactLm(joints.leftWrist),
    rightWrist: compactLm(joints.rightWrist),
    leftElbow: compactLm(joints.leftElbow),
    rightElbow: compactLm(joints.rightElbow),
    leftShoulder: compactLm(ls),
    rightShoulder: compactLm(rs),
    leftHip: compactLm(lh),
    rightHip: compactLm(rh),
    derivedHeadTopProxyY: overheadHeadTopProxyY(joints),
    headTopProxySource: 'min_nose_leftEar_rightEar_y',
    torsoScaleLeft,
    torsoScaleRight,
  };
}

function inSelectedWindow(
  ts: number,
  start: number | null | undefined,
  end: number | null | undefined
): boolean {
  if (start == null || end == null) return false;
  return ts >= start && ts <= end;
}

function pickArgMax(
  indices: number[],
  score: (i: number) => number | null
): number | null {
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const i of indices) {
    const s = score(i);
    if (typeof s !== 'number' || !Number.isFinite(s)) continue;
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

function buildCandidate(
  tag: OverheadVisualTruthCandidateTag,
  index: number | null,
  pre: PoseFeaturesFrame[],
  smoothed: PoseFeaturesFrame[],
  windowStart: number | null | undefined,
  windowEnd: number | null | undefined,
  isOverheadAnalyzableFrame: (f: PoseFeaturesFrame) => boolean,
  withLandmarks: boolean,
  smoothedHookAcceptedLandmarks: PoseLandmarks[] | null
): OverheadVisualTruthCandidateExport | null {
  if (index === null || index < 0 || index >= smoothed.length || index >= pre.length) return null;
  const s = smoothed[index]!;
  const p = pre[index]!;
  const ts = s.timestampMs;
  const inside = inSelectedWindow(ts, windowStart, windowEnd);
  const pd = p.derived;
  const sd = s.derived;
  const hookLm =
    smoothedHookAcceptedLandmarks &&
    index >= 0 &&
    index < smoothedHookAcceptedLandmarks.length
      ? smoothedHookAcceptedLandmarks[index]!
      : null;
  const distalHandObservability = hookLm
    ? buildOverheadDistalHandObservabilityExport(hookLm, s)
    : null;
  return {
    tag,
    frameIndex: index,
    timestampMs: ts,
    insideSelectedWindow: inside,
    survivedHookAcceptance: true,
    survivedFeatureValidity: isOverheadAnalyzableFrame(s),
    rawArmElevationAvgDeg: pd.armElevationAvg,
    smoothedArmElevationAvgDeg: sd.armElevationAvg,
    rawWristAboveNoseAvgNorm: pd.wristAboveNoseAvgNorm ?? null,
    smoothedWristAboveNoseAvgNorm: sd.wristAboveNoseAvgNorm ?? null,
    rawWristAboveEarAvgNorm: pd.wristAboveEarAvgNorm ?? null,
    smoothedWristAboveEarAvgNorm: sd.wristAboveEarAvgNorm ?? null,
    rawWristAboveHeadTopProxyAvgNorm: pd.wristAboveHeadTopProxyAvgNorm ?? null,
    smoothedWristAboveHeadTopProxyAvgNorm: sd.wristAboveHeadTopProxyAvgNorm ?? null,
    rawShoulderWristElevationAvgDeg: pd.shoulderWristElevationAvgDeg ?? null,
    smoothedShoulderWristElevationAvgDeg: sd.shoulderWristElevationAvgDeg ?? null,
    landmarksCompact: withLandmarks ? buildLandmarksCompact(s.joints) : null,
    distalHandObservability,
  };
}

export type BuildOverheadVisualTruthCandidatesInput = {
  preStabilizeFrames: PoseFeaturesFrame[];
  smoothedFeatureFrames: PoseFeaturesFrame[];
  /** Same length as feature frames; landmark-smoothed hook buffer (aligns with buildPoseFeaturesFrames input). */
  smoothedHookAcceptedLandmarks?: PoseLandmarks[] | null;
  selectedWindowStartMs: number | null | undefined;
  selectedWindowEndMs: number | null | undefined;
  stats: PoseCaptureStats;
  isOverheadAnalyzableFrame: (f: PoseFeaturesFrame) => boolean;
};

/**
 * Builds bounded diagnostic export. Call only for overhead-reach from guardrail context.
 */
export function buildOverheadVisualTruthCandidatesExport(
  input: BuildOverheadVisualTruthCandidatesInput
): OverheadVisualTruthCandidatesExport | null {
  const { preStabilizeFrames, smoothedFeatureFrames, stats } = input;
  const n = smoothedFeatureFrames.length;
  if (n === 0 || preStabilizeFrames.length !== n) return null;
  const hookLm =
    input.smoothedHookAcceptedLandmarks != null &&
    input.smoothedHookAcceptedLandmarks.length === n
      ? input.smoothedHookAcceptedLandmarks
      : null;

  const windowStart = input.selectedWindowStartMs ?? null;
  const windowEnd = input.selectedWindowEndMs ?? null;
  const isA = input.isOverheadAnalyzableFrame;

  const allIndices = smoothedFeatureFrames.map((_, i) => i);
  const analyzableIndices = allIndices.filter((i) => isA(smoothedFeatureFrames[i]!));

  const armSmoothed = (i: number) => smoothedFeatureFrames[i]!.derived.armElevationAvg;
  const headRelSmoothed = (i: number) => smoothedFeatureFrames[i]!.derived.wristAboveNoseAvgNorm;

  const inWin = (i: number) =>
    inSelectedWindow(smoothedFeatureFrames[i]!.timestampMs, windowStart, windowEnd);

  const analyzableInWindow = analyzableIndices.filter(inWin);

  const idxSelectedBest =
    analyzableInWindow.length > 0
      ? pickArgMax(analyzableInWindow, (i) => armSmoothed(i))
      : null;

  const idxGlobalArm =
    analyzableIndices.length > 0 ? pickArgMax(analyzableIndices, (i) => armSmoothed(i)) : null;

  const idxGlobalHead =
    analyzableIndices.length > 0 ? pickArgMax(analyzableIndices, (i) => headRelSmoothed(i)) : null;

  const outsidePool = analyzableIndices.filter((i) => !inWin(i));
  const idxBestArmOutside =
    outsidePool.length > 0 ? pickArgMax(outsidePool, (i) => armSmoothed(i)) : null;

  let idxEarliestNearPeak: number | null = null;
  if (idxGlobalArm !== null) {
    const peak = armSmoothed(idxGlobalArm);
    if (typeof peak === 'number' && Number.isFinite(peak) && peak > 1e-6) {
      const threshold = peak * 0.85;
      const ordered = [...analyzableIndices].sort(
        (a, b) => smoothedFeatureFrames[a]!.timestampMs - smoothedFeatureFrames[b]!.timestampMs
      );
      for (const i of ordered) {
        const v = armSmoothed(i);
        if (typeof v === 'number' && v >= threshold) {
          idxEarliestNearPeak = i;
          break;
        }
      }
    }
  }

  const selectedBestSmoothedArm =
    idxSelectedBest !== null ? armSmoothed(idxSelectedBest) : null;

  let maxNonAnalyzableRaw = -Infinity;
  for (let i = 0; i < n; i++) {
    if (isA(smoothedFeatureFrames[i]!)) continue;
    const raw = preStabilizeFrames[i]!.derived.armElevationAvg;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > maxNonAnalyzableRaw) {
      maxNonAnalyzableRaw = raw;
    }
  }

  const hasStrongerNonAnalyzable =
    typeof selectedBestSmoothedArm === 'number' &&
    Number.isFinite(selectedBestSmoothedArm) &&
    maxNonAnalyzableRaw > selectedBestSmoothedArm;

  const globalArmIdx = idxGlobalArm;
  const globalHeadIdx = idxGlobalHead;
  const topNeighborhood = new Set<number>();
  if (globalArmIdx !== null) {
    for (let d = -3; d <= 3; d++) {
      const j = globalArmIdx + d;
      if (j >= 0 && j < n) topNeighborhood.add(j);
    }
  }

  let timestampGapHintsInTopNeighborhood = 0;
  let unstableLandmarkHintsInTopNeighborhood = 0;
  let unstableBboxHintsInTopNeighborhood = 0;
  for (const j of topNeighborhood) {
    const hints = smoothedFeatureFrames[j]!.qualityHints;
    if (hints.includes('timestamp_gap')) timestampGapHintsInTopNeighborhood += 1;
    if (hints.includes('unstable_landmarks')) unstableLandmarkHintsInTopNeighborhood += 1;
    if (hints.includes('unstable_bbox')) unstableBboxHintsInTopNeighborhood += 1;
  }

  const withLms = (tag: OverheadVisualTruthCandidateTag, idx: number | null) =>
    buildCandidate(
      tag,
      idx,
      preStabilizeFrames,
      smoothedFeatureFrames,
      windowStart,
      windowEnd,
      isA,
      true,
      hookLm
    );

  const selectedWindowBest = withLms('selectedWindowBest', idxSelectedBest);
  const globalBestArmElevation = withLms('globalBestArmElevation', idxGlobalArm);
  const globalBestHeadRelative = withLms('globalBestHeadRelative', idxGlobalHead);
  const bestArmElevationOutsideSelectedWindow = withLms(
    'bestArmElevationOutsideSelectedWindow',
    idxBestArmOutside
  );
  const earliestNearGlobalPeakArm = withLms('earliestNearGlobalPeakArm', idxEarliestNearPeak);

  const repMap = new Map<number, OverheadVisualTruthCandidateExport>();
  const pushRep = (c: OverheadVisualTruthCandidateExport | null) => {
    if (!c) return;
    if (!repMap.has(c.frameIndex)) repMap.set(c.frameIndex, { ...c, landmarksCompact: c.landmarksCompact });
  };
  pushRep(selectedWindowBest);
  pushRep(globalBestArmElevation);
  pushRep(globalBestHeadRelative);
  pushRep(bestArmElevationOutsideSelectedWindow);
  pushRep(earliestNearGlobalPeakArm);
  const representativeCandidates = Array.from(repMap.values()).slice(0, 5);

  return {
    version: OVERHEAD_VISUAL_TRUTH_EXPORT_VERSION,
    selectedWindowStartMs: windowStart,
    selectedWindowEndMs: windowEnd,
    selectedWindowBest,
    globalBestArmElevation,
    globalBestHeadRelative,
    bestArmElevationOutsideSelectedWindow,
    earliestNearGlobalPeakArm,
    representativeCandidates,
    nearTopLossSummary: {
      bufferFrameCount: n,
      sampledFrameCount: stats.sampledFrameCount,
      hookDroppedFrameCount: stats.droppedFrameCount,
      landmarkOrAdaptorFailedFrameCount: stats.landmarkOrAdaptorFailedFrameCount ?? 0,
      timestampDiscontinuityCount: stats.timestampDiscontinuityCount ?? 0,
      timestampGapHintsInTopNeighborhood,
      unstableLandmarkHintsInTopNeighborhood,
      unstableBboxHintsInTopNeighborhood,
      strongestArmElevationOutsideSelectedWindow:
        globalBestArmElevation !== null && !globalBestArmElevation.insideSelectedWindow,
      strongestHeadRelativeOutsideSelectedWindow:
        globalBestHeadRelative !== null && !globalBestHeadRelative.insideSelectedWindow,
      hasStrongerNonAnalyzableRawArmThanSelectedWindowBestSmoothed: hasStrongerNonAnalyzable,
    },
  };
}
