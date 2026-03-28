import type { PoseFeaturesFrame, PosePhaseHint } from './pose-features';

export interface QualityWindowSelection {
  frames: PoseFeaturesFrame[];
  warmupExcludedFrameCount: number;
  selectedWindowStartMs: number | null;
  selectedWindowEndMs: number | null;
  selectedWindowScore: number | null;
  qualityFrameCount: number;
}

interface QualityWindowOptions {
  warmupMs: number;
  minWindowMs: number;
  maxWindowMs: number;
}

const MIN_STABLE_STREAK = 3;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function getBboxStability(frames: PoseFeaturesFrame[]): number {
  const areas = frames.map((frame) => frame.bodyBox.area).filter((area) => area > 0);
  if (areas.length < 2) return 0;
  const avg = mean(areas);
  if (avg <= 0) return 0;
  const variance = mean(areas.map((area) => (area - avg) ** 2));
  return clamp(1 - Math.sqrt(variance) / avg);
}

function isSettledFrame(frame: PoseFeaturesFrame): boolean {
  return (
    frame.visibilitySummary.visibleLandmarkRatio >= 0.48 &&
    frame.visibilitySummary.criticalJointsAvailability >= 0.52 &&
    frame.bodyBox.area >= 0.05 &&
    frame.bodyBox.area <= 0.95 &&
    !frame.qualityHints.includes('timestamp_gap')
  );
}

function excludeWarmupFrames(frames: PoseFeaturesFrame[], warmupMs: number): PoseFeaturesFrame[] {
  if (frames.length === 0) return frames;
  const t0 = frames[0]!.timestampMs;
  let stableStreak = 0;
  let settledTimestamp: number | null = null;

  for (const frame of frames) {
    if (isSettledFrame(frame)) {
      stableStreak += 1;
      if (stableStreak >= MIN_STABLE_STREAK) {
        settledTimestamp = frame.timestampMs;
        break;
      }
    } else {
      stableStreak = 0;
    }
  }

  const warmupEndTimestamp = t0 + warmupMs;
  const qualityStartTimestamp =
    settledTimestamp !== null
      ? Math.max(warmupEndTimestamp, settledTimestamp)
      : warmupEndTimestamp;

  return frames.filter((frame) => frame.timestampMs >= qualityStartTimestamp);
}

function getWindowContinuityScore(frames: PoseFeaturesFrame[]): number {
  if (frames.length === 0) return 0;
  const validRatio =
    frames.filter(
      (frame) => !frame.qualityHints.includes('timestamp_gap') && frame.frameValidity !== 'invalid'
    ).length / frames.length;
  const deltaValues = frames
    .map((frame) => frame.timestampDeltaMs)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (deltaValues.length < 2) return validRatio;
  const avg = mean(deltaValues);
  const variance = mean(deltaValues.map((value) => (value - avg) ** 2));
  const timingStability = clamp(1 - Math.sqrt(variance) / Math.max(avg, 1));
  return clamp(validRatio * 0.65 + timingStability * 0.35);
}

function scoreWindow(frames: PoseFeaturesFrame[]): number {
  const visibilityMedian = median(
    frames.map((frame) => frame.visibilitySummary.visibleLandmarkRatio)
  );
  const criticalMedian = median(
    frames.map((frame) => frame.visibilitySummary.criticalJointsAvailability)
  );
  const bboxStability = getBboxStability(frames);
  const continuity = getWindowContinuityScore(frames);
  const landmarkConfidence = median(
    frames
      .map((frame) => frame.visibilitySummary.averageVisibility)
      .filter((value): value is number => typeof value === 'number')
  );

  return clamp(
    visibilityMedian * 0.28 +
      criticalMedian * 0.3 +
      bboxStability * 0.18 +
      continuity * 0.16 +
      landmarkConfidence * 0.08
  );
}

export function selectQualityWindow(
  frames: PoseFeaturesFrame[],
  options: QualityWindowOptions
): QualityWindowSelection {
  const postWarmup = excludeWarmupFrames(frames, options.warmupMs);
  const fallbackFrames = postWarmup.length >= 4 ? postWarmup : frames;

  if (fallbackFrames.length < 4) {
    return {
      frames: fallbackFrames,
      warmupExcludedFrameCount: Math.max(0, frames.length - postWarmup.length),
      selectedWindowStartMs: fallbackFrames[0]?.timestampMs ?? null,
      selectedWindowEndMs: fallbackFrames.at(-1)?.timestampMs ?? null,
      selectedWindowScore: fallbackFrames.length > 0 ? scoreWindow(fallbackFrames) : null,
      qualityFrameCount: fallbackFrames.length,
    };
  }

  let bestScore = -1;
  let bestSlice: PoseFeaturesFrame[] = fallbackFrames;

  for (let i = 0; i < fallbackFrames.length; i++) {
    const startTimestamp = fallbackFrames[i]!.timestampMs;
    let j = i;
    while (
      j < fallbackFrames.length &&
      fallbackFrames[j]!.timestampMs - startTimestamp < options.minWindowMs
    ) {
      j++;
    }
    if (j >= fallbackFrames.length) break;
    while (
      j + 1 < fallbackFrames.length &&
      fallbackFrames[j + 1]!.timestampMs - startTimestamp <= options.maxWindowMs
    ) {
      j++;
    }

    const window = fallbackFrames.slice(i, j + 1);
    if (window.length < 4) continue;

    const score = scoreWindow(window);
    const shouldReplace =
      score > bestScore + 0.015 ||
      (Math.abs(score - bestScore) <= 0.015 && window.length > bestSlice.length);

    if (shouldReplace) {
      bestScore = score;
      bestSlice = window;
    }
  }

  return {
    frames: bestSlice,
    warmupExcludedFrameCount: Math.max(0, frames.length - postWarmup.length),
    selectedWindowStartMs: bestSlice[0]?.timestampMs ?? null,
    selectedWindowEndMs: bestSlice.at(-1)?.timestampMs ?? null,
    selectedWindowScore: bestScore >= 0 ? bestScore : scoreWindow(bestSlice),
    qualityFrameCount: bestSlice.length,
  };
}

export function smoothSignalValue(
  current: number | null,
  previous: number | null,
  alpha: number
): number | null {
  if (typeof current !== 'number') return previous;
  if (typeof previous !== 'number') return current;
  return previous + (current - previous) * alpha;
}

export function stabilizePhaseSequence(
  candidates: PosePhaseHint[],
  minimumStableFrames = 2
): PosePhaseHint[] {
  if (candidates.length === 0) return candidates;

  const stabilized: PosePhaseHint[] = [];
  let active = candidates[0]!;
  let pending = active;
  let pendingCount = 0;

  for (const candidate of candidates) {
    if (candidate === active) {
      pending = candidate;
      pendingCount = 0;
      stabilized.push(active);
      continue;
    }

    if (candidate === pending) {
      pendingCount += 1;
    } else {
      pending = candidate;
      pendingCount = 1;
    }

    if (pendingCount >= minimumStableFrames) {
      active = pending;
      pendingCount = 0;
    }

    stabilized.push(active);
  }

  return stabilized;
}
