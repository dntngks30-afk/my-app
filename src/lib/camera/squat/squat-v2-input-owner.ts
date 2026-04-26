/**
 * PR-V2-INPUT-01 — Explicit owner for squat V2 input frame construction.
 *
 * Owns depth / lowerBodySignal selection and diagnostics only.
 * Pass authority remains solely in evaluateSquatMotionEvidenceV2().
 */
import type { PoseLandmark } from '@/lib/motion/pose-types';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { SquatMotionEvidenceFrameV2 } from '@/lib/camera/squat/squat-motion-evidence-v2.types';

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function midpoint(a: PoseLandmark | null, b: PoseLandmark | null): PoseLandmark | null {
  if (a == null || b == null) return null;
  const va = a.visibility ?? 1;
  const vb = b.visibility ?? 1;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: a.z != null && b.z != null ? (a.z + b.z) / 2 : undefined,
    visibility: Math.min(va, vb),
  };
}

// ── PR04D curve quality (unchanged semantics) ─────────────────────────────
/** Below this → "near-zero machine epsilon" (not a meaningful depth reading). */
export const V2_DEPTH_EPS = 1e-6;
/** Minimum depth value to count a frame as "meaningful" for series quality. */
export const V2_DEPTH_MEANINGFUL_MIN = 0.018;
/** Minimum meaningful frames required for a series to be considered "usable". */
export const V2_DEPTH_MIN_USABLE_FRAMES = 3;
/** Peak within this many frames from tail → "tail spike only". */
export const V2_DEPTH_TAIL_SPIKE_MAX_DIST = 2;

export type V2DepthSeriesStats = {
  max: number;
  meaningfulFrameCount: number;
  nonZeroFrameCount: number;
  peakFrameIndex: number;
  framesAfterPeak: number;
  collapsedNearZero: boolean;
  tailSpikeOnly: boolean;
  hasUsableCurve: boolean;
  hasPostPeakDrop: boolean;
};

export function computeV2DepthSeriesStats(depths: number[]): V2DepthSeriesStats {
  const n = depths.length;
  let max = 0;
  let peakFrameIndex = 0;
  let meaningfulFrameCount = 0;
  let nonZeroFrameCount = 0;

  for (let i = 0; i < n; i++) {
    const d = depths[i]!;
    if (d > max) {
      max = d;
      peakFrameIndex = i;
    }
    if (d >= V2_DEPTH_MEANINGFUL_MIN) meaningfulFrameCount++;
    if (d > V2_DEPTH_EPS) nonZeroFrameCount++;
  }

  const framesAfterPeak = n - 1 - peakFrameIndex;
  const collapsedNearZero = max < V2_DEPTH_EPS * 1000;
  const tailSpikeOnly =
    !collapsedNearZero &&
    meaningfulFrameCount <= V2_DEPTH_MIN_USABLE_FRAMES - 1 &&
    framesAfterPeak <= V2_DEPTH_TAIL_SPIKE_MAX_DIST;

  let hasPostPeakDrop = false;
  if (framesAfterPeak >= 1) {
    const nextDepth = depths[peakFrameIndex + 1] ?? max;
    const reversalThreshold = Math.max(0.009, max * 0.13);
    hasPostPeakDrop = max - nextDepth >= reversalThreshold;
  }

  const hasUsableCurve =
    !collapsedNearZero &&
    !tailSpikeOnly &&
    meaningfulFrameCount >= V2_DEPTH_MIN_USABLE_FRAMES &&
    framesAfterPeak >= 2;

  return {
    max,
    meaningfulFrameCount,
    nonZeroFrameCount,
    peakFrameIndex,
    framesAfterPeak,
    collapsedNearZero,
    tailSpikeOnly,
    hasUsableCurve,
    hasPostPeakDrop,
  };
}

export type SelectedV2DepthSeries = {
  depths: number[];
  source: 'blended' | 'proxy' | 'raw' | 'fallback_zero';
  policy: string;
  switchReason: string | null;
  stats: {
    blended: V2DepthSeriesStats;
    proxy: V2DepthSeriesStats;
    raw: V2DepthSeriesStats;
  };
};

/**
 * PR04D legacy triple (blended / proxy / raw) — preserved for smoke compatibility.
 */
export function selectRuntimeV2DepthSeries(frames: PoseFeaturesFrame[]): SelectedV2DepthSeries {
  const blendedDepths = frames.map((f) => finite(f.derived.squatDepthProxyBlended) ?? 0);
  const proxyDepths = frames.map((f) => finite(f.derived.squatDepthProxy) ?? 0);
  const rawDepths = frames.map((f) => finite(f.derived.squatDepthProxyRaw) ?? 0);

  const blendedStats = computeV2DepthSeriesStats(blendedDepths);
  const proxyStats = computeV2DepthSeriesStats(proxyDepths);
  const rawStats = computeV2DepthSeriesStats(rawDepths);
  const stats = { blended: blendedStats, proxy: proxyStats, raw: rawStats };

  if (blendedStats.hasUsableCurve) {
    return { depths: blendedDepths, source: 'blended', policy: 'blended_usable', switchReason: null, stats };
  }

  const blendedNotUsable = blendedStats.collapsedNearZero || blendedStats.tailSpikeOnly;
  if (blendedNotUsable) {
    const reason = blendedStats.collapsedNearZero ? 'blended_collapsed_near_zero' : 'blended_tail_spike_only';
    const collapsePrefix = blendedStats.collapsedNearZero ? 'blended_collapsed' : 'tail_spike';

    if (proxyStats.hasUsableCurve) {
      return {
        depths: proxyDepths,
        source: 'proxy',
        policy: `${collapsePrefix}_proxy_selected`,
        switchReason: reason,
        stats,
      };
    }

    if (rawStats.hasUsableCurve) {
      return {
        depths: rawDepths,
        source: 'raw',
        policy: `${collapsePrefix}_raw_selected`,
        switchReason: reason,
        stats,
      };
    }

    return {
      depths: blendedDepths,
      source: 'blended',
      policy: 'fallback_blended',
      switchReason: `${reason}_no_alternative_usable`,
      stats,
    };
  }

  return { depths: blendedDepths, source: 'blended', policy: 'fallback_blended', switchReason: 'blended_not_usable', stats };
}

// ── PR-V2-INPUT-01 landmark / proxy gates (conservative) ────────────────────

const HIP_VIS_MIN = 0.35;
const EARLY_FRAMES_MAX = 8;
const MIN_EARLY_HIP_SAMPLES = 3;
const BASELINE_RANGE_OVER_SCALE_MAX = 0.1;
const EARLY_DESCENT_DRIFT_OVER_SCALE_MAX = 0.07;
const MAX_EARLY_GAP_MS = 450;
const MIN_TORSO_SCALE = 0.06;
const HIP_NULL_FRAC_MAX = 0.28;
const WINDOW_CRITICAL_JOINTS_MIN = 0.45;

const PELVIS_RAW_AMP_MIN = 0.018;
const PELVIS_FINITE_RATIO_MIN = 0.65;

const KNEE_ANGLE_RANGE_MIN_DEG = 10;
const KNEE_FINITE_RATIO_MIN = 0.65;

export type SquatV2OwnedDepthSource =
  | 'hip_center_baseline'
  | 'pelvis_proxy'
  | 'knee_flex_proxy'
  | 'legacy_primary'
  | 'legacy_raw'
  | 'none';

export type SquatV2InputOwnerResult = {
  frames: SquatMotionEvidenceFrameV2[];
  selectedDepthSource: SquatV2OwnedDepthSource;
  depthCurveUsable: boolean;
  finiteButUselessDepthRejected: boolean;
  sourceStats: Record<string, unknown>;
  /** When legacy triple wins, non-null for PR04D metric mirror. */
  legacyDepthSelection: SelectedV2DepthSeries | null;
  v2InputSwitchReason: string | null;
};

function getHip(frame: PoseFeaturesFrame): PoseLandmark | null {
  const j = frame.joints;
  return j.hipCenter ?? midpoint(j.leftHip, j.rightHip);
}

function getShoulderCenter(frame: PoseFeaturesFrame): PoseLandmark | null {
  const j = frame.joints;
  return j.shoulderCenter ?? midpoint(j.leftShoulder, j.rightShoulder);
}

function runtimeV2UpperBodySignal(frame: PoseFeaturesFrame): number {
  const arm = finite(frame.derived.armElevationAvg);
  const trunk = finite(frame.derived.trunkLeanDeg);
  const armNorm = arm == null ? 0 : Math.min(1, Math.max(0, arm / 180));
  const trunkNorm = trunk == null ? 0 : Math.min(1, Math.abs(trunk) / 90);
  return Math.max(armNorm, trunkNorm);
}

function buildEvidenceFrames(
  frames: PoseFeaturesFrame[],
  depthSeries: number[]
): SquatMotionEvidenceFrameV2[] {
  return frames.map((frame, i) => {
    const depth = depthSeries[i] ?? 0;
    return {
      timestampMs: frame.timestampMs,
      depth,
      lowerBodySignal: depth,
      upperBodySignal: runtimeV2UpperBodySignal(frame),
      bodyVisibleEnough: frame.isValid && frame.frameValidity === 'valid',
      lowerBodyVisibleEnough: frame.visibilitySummary.criticalJointsAvailability >= 0.6,
      phaseHint: frame.phaseHint,
      isValid: frame.isValid,
      frameValidity: frame.frameValidity,
      visibilitySummary: frame.visibilitySummary,
      derived: frame.derived,
      joints: frame.joints,
    };
  });
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

type HipAttempt = { depths: number[]; stats: Record<string, unknown>; rejectedReason?: string };

function tryHipCenterSeries(frames: PoseFeaturesFrame[]): HipAttempt {
  const n = frames.length;
  if (n < 4) {
    return { depths: [], stats: { hip: 'too_few_frames' }, rejectedReason: 'too_few_frames' };
  }

  const earlyEnd = Math.min(EARLY_FRAMES_MAX, n);
  const hipYs: number[] = [];
  const earlyTs: number[] = [];

  for (let i = 0; i < earlyEnd; i++) {
    const f = frames[i]!;
    const hip = getHip(f);
    if (
      hip != null &&
      (hip.visibility ?? 1) >= HIP_VIS_MIN &&
      f.isValid &&
      f.frameValidity === 'valid' &&
      f.visibilitySummary.criticalJointsAvailability >= WINDOW_CRITICAL_JOINTS_MIN
    ) {
      hipYs.push(hip.y);
      earlyTs.push(f.timestampMs);
    }
  }

  if (hipYs.length < MIN_EARLY_HIP_SAMPLES) {
    return { depths: [], stats: { hip: 'early_samples_insufficient' }, rejectedReason: 'early_samples_insufficient' };
  }

  for (let i = 1; i < earlyTs.length; i++) {
    if (earlyTs[i]! - earlyTs[i - 1]! > MAX_EARLY_GAP_MS) {
      return { depths: [], stats: { hip: 'early_frame_gap' }, rejectedReason: 'early_frame_gap' };
    }
  }

  const yFirst = median(hipYs.slice(0, Math.min(3, hipYs.length)));
  const yLastEarly = median(hipYs.slice(-Math.min(3, hipYs.length)));
  const shoulder0 = getShoulderCenter(frames[0]!);
  const hip0 = getHip(frames[0]!);
  if (shoulder0 == null || hip0 == null) {
    return { depths: [], stats: { hip: 'torso_scale_missing' }, rejectedReason: 'torso_scale_missing' };
  }
  const scale0 = Math.max(Math.abs(shoulder0.y - hip0.y), MIN_TORSO_SCALE);
  if (yLastEarly - yFirst > EARLY_DESCENT_DRIFT_OVER_SCALE_MAX * scale0) {
    return { depths: [], stats: { hip: 'early_descent_suspected' }, rejectedReason: 'early_descent_suspected' };
  }

  const earlyRange = Math.max(...hipYs) - Math.min(...hipYs);
  if (earlyRange / scale0 > BASELINE_RANGE_OVER_SCALE_MAX) {
    return { depths: [], stats: { hip: 'baseline_unstable' }, rejectedReason: 'baseline_unstable' };
  }

  let badEarlyPhase = 0;
  for (let i = 0; i < Math.min(3, n); i++) {
    const ph = frames[i]!.phaseHint;
    if (ph === 'descent' || ph === 'bottom' || ph === 'ascent') badEarlyPhase++;
  }
  if (badEarlyPhase >= 2) {
    return { depths: [], stats: { hip: 'phase_contamination' }, rejectedReason: 'phase_contamination' };
  }

  const y0 = median(hipYs);

  const depths: number[] = [];
  let nulls = 0;
  let lastD = 0;

  for (let i = 0; i < n; i++) {
    const f = frames[i]!;
    const hip = getHip(f);
    const shoulder = getShoulderCenter(f);
    if (
      hip == null ||
      (hip.visibility ?? 0) < HIP_VIS_MIN ||
      shoulder == null ||
      (shoulder.visibility ?? 0) < HIP_VIS_MIN
    ) {
      nulls++;
      depths.push(lastD);
      continue;
    }
    const scale = Math.max(Math.abs(shoulder.y - hip.y), MIN_TORSO_SCALE);
    const d = clamp01((hip.y - y0) / scale);
    depths.push(d);
    lastD = d;
  }

  if (nulls / n > HIP_NULL_FRAC_MAX) {
    return {
      depths: [],
      stats: { hip: 'too_many_null_hips', nullFrac: nulls / n },
      rejectedReason: 'too_many_null_hips',
    };
  }

  const curveStats = computeV2DepthSeriesStats(depths);
  const stats: Record<string, unknown> = {
    hip: 'series_built',
    baselineY0: y0,
    earlyHipSamples: hipYs.length,
    curveStats,
  };

  if (!curveStats.hasUsableCurve) {
    return { depths, stats: { ...stats, hip: 'curve_not_usable' }, rejectedReason: 'curve_not_usable' };
  }

  return { depths, stats };
}

type SeriesAttempt = { depths: number[]; stats: Record<string, unknown>; rejectedReason?: string };

function tryPelvisSeries(frames: PoseFeaturesFrame[]): SeriesAttempt {
  const raw: (number | null)[] = frames.map((f) => finite(f.derived.pelvicDrop));
  const finiteVals = raw.filter((v): v is number => v != null);
  if (finiteVals.length < frames.length * PELVIS_FINITE_RATIO_MIN) {
    return { depths: [], stats: { pelvis: 'finite_ratio_low' }, rejectedReason: 'finite_ratio_low' };
  }

  let minV = Infinity;
  let maxV = -Infinity;
  for (const v of finiteVals) {
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const amp = maxV - minV;
  if (!Number.isFinite(amp) || amp < PELVIS_RAW_AMP_MIN) {
    return { depths: [], stats: { pelvis: 'raw_amplitude_too_small', amp }, rejectedReason: 'raw_amplitude_too_small' };
  }

  const depths = raw.map((v) => (v == null ? 0 : clamp01((v - minV) / amp)));
  const curveStats = computeV2DepthSeriesStats(depths);
  if (!curveStats.hasUsableCurve) {
    return { depths, stats: { pelvis: 'curve_not_usable', curveStats, amp }, rejectedReason: 'curve_not_usable' };
  }

  return { depths, stats: { pelvis: 'ok', curveStats, rawAmplitude: amp } };
}

function tryKneeFlexSeries(frames: PoseFeaturesFrame[]): SeriesAttempt {
  const raw: (number | null)[] = frames.map((f) => finite(f.derived.kneeAngleAvg));
  const finiteIdx: number[] = [];
  const finiteVals: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v != null) {
      finiteIdx.push(i);
      finiteVals.push(v);
    }
  }
  if (finiteVals.length < frames.length * KNEE_FINITE_RATIO_MIN) {
    return { depths: [], stats: { knee: 'finite_ratio_low' }, rejectedReason: 'finite_ratio_low' };
  }

  const maxAngle = Math.max(...finiteVals);
  const minAngle = Math.min(...finiteVals);
  const angleRange = maxAngle - minAngle;
  if (angleRange < KNEE_ANGLE_RANGE_MIN_DEG) {
    return { depths: [], stats: { knee: 'angle_range_too_small', angleRange }, rejectedReason: 'angle_range_too_small' };
  }

  const depths: number[] = new Array(frames.length).fill(0);
  for (let k = 0; k < finiteIdx.length; k++) {
    const i = finiteIdx[k]!;
    const ang = finiteVals[k]!;
    depths[i] = clamp01((maxAngle - ang) / angleRange);
  }
  let last = 0;
  for (let i = 0; i < depths.length; i++) {
    if (raw[i] != null) last = depths[i]!;
    else depths[i] = last;
  }

  const curveStats = computeV2DepthSeriesStats(depths);
  if (!curveStats.hasUsableCurve) {
    return { depths, stats: { knee: 'curve_not_usable', curveStats, angleRange }, rejectedReason: 'curve_not_usable' };
  }

  return { depths, stats: { knee: 'ok', curveStats, angleRangeDeg: angleRange } };
}

function mapLegacySource(sel: SelectedV2DepthSeries): SquatV2OwnedDepthSource {
  if (sel.source === 'raw') return 'legacy_raw';
  return 'legacy_primary';
}

function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

function noteFiniteUseless(reason: string | undefined): boolean {
  return (
    reason === 'curve_not_usable' ||
    reason === 'raw_amplitude_too_small' ||
    reason === 'angle_range_too_small'
  );
}

/**
 * Build V2 input frames with explicit source priority:
 * hip_center_baseline → pelvis_proxy → knee_flex_proxy → legacy (PR04D) → none (zeros).
 */
export function buildSquatV2OwnedInputFrames(frames: PoseFeaturesFrame[]): SquatV2InputOwnerResult {
  const n = frames.length;
  const sourceStats: Record<string, unknown> = {
    candidatesTried: [] as string[],
  };
  let finiteButUselessDepthRejected = false;
  let v2InputSwitchReason: string | null = null;
  const tried = (sourceStats.candidatesTried as string[]).push.bind(sourceStats.candidatesTried);

  // 1) Hip center
  tried('hip_center_baseline');
  const hipTry = tryHipCenterSeries(frames);
  if (!hipTry.rejectedReason && hipTry.depths.length === n) {
    sourceStats.hip_center_baseline = hipTry.stats;
    return {
      frames: buildEvidenceFrames(frames, hipTry.depths),
      selectedDepthSource: 'hip_center_baseline',
      depthCurveUsable: true,
      finiteButUselessDepthRejected,
      sourceStats,
      legacyDepthSelection: null,
      v2InputSwitchReason: null,
    };
  }
  if (hipTry.rejectedReason) {
    if (noteFiniteUseless(hipTry.rejectedReason)) finiteButUselessDepthRejected = true;
    v2InputSwitchReason = `hip_rejected:${hipTry.rejectedReason}`;
    sourceStats.hip_center_baseline = { ...hipTry.stats, rejectedReason: hipTry.rejectedReason };
  }

  // 2) Pelvis
  tried('pelvis_proxy');
  const pelvisTry = tryPelvisSeries(frames);
  if (!pelvisTry.rejectedReason && pelvisTry.depths.length === n) {
    sourceStats.pelvis_proxy = pelvisTry.stats;
    return {
      frames: buildEvidenceFrames(frames, pelvisTry.depths),
      selectedDepthSource: 'pelvis_proxy',
      depthCurveUsable: true,
      finiteButUselessDepthRejected,
      sourceStats,
      legacyDepthSelection: null,
      v2InputSwitchReason: v2InputSwitchReason ?? 'fell_through_from_hip',
    };
  }
  if (pelvisTry.rejectedReason) {
    if (noteFiniteUseless(pelvisTry.rejectedReason)) finiteButUselessDepthRejected = true;
    if (!v2InputSwitchReason) v2InputSwitchReason = `pelvis_rejected:${pelvisTry.rejectedReason}`;
    sourceStats.pelvis_proxy = { ...pelvisTry.stats, rejectedReason: pelvisTry.rejectedReason };
  }

  // 3) Knee flex
  tried('knee_flex_proxy');
  const kneeTry = tryKneeFlexSeries(frames);
  if (!kneeTry.rejectedReason && kneeTry.depths.length === n) {
    sourceStats.knee_flex_proxy = kneeTry.stats;
    return {
      frames: buildEvidenceFrames(frames, kneeTry.depths),
      selectedDepthSource: 'knee_flex_proxy',
      depthCurveUsable: true,
      finiteButUselessDepthRejected,
      sourceStats,
      legacyDepthSelection: null,
      v2InputSwitchReason: v2InputSwitchReason ?? 'fell_through_from_hip_pelvis',
    };
  }
  if (kneeTry.rejectedReason) {
    if (noteFiniteUseless(kneeTry.rejectedReason)) finiteButUselessDepthRejected = true;
    if (!v2InputSwitchReason) v2InputSwitchReason = `knee_rejected:${kneeTry.rejectedReason}`;
    sourceStats.knee_flex_proxy = { ...kneeTry.stats, rejectedReason: kneeTry.rejectedReason };
  }

  // 4) Legacy PR04D
  tried('legacy_pr04d');
  const legacy = selectRuntimeV2DepthSeries(frames);
  sourceStats.legacy_pr04d = {
    policy: legacy.policy,
    switchReason: legacy.switchReason,
    stats: legacy.stats,
  };

  const legacyStats = computeV2DepthSeriesStats(legacy.depths);
  if (legacyStats.hasUsableCurve) {
    sourceStats.actualLegacySeries = legacy.source;
    return {
      frames: buildEvidenceFrames(frames, legacy.depths),
      selectedDepthSource: mapLegacySource(legacy),
      depthCurveUsable: true,
      finiteButUselessDepthRejected,
      sourceStats,
      legacyDepthSelection: legacy,
      v2InputSwitchReason: legacy.switchReason ?? v2InputSwitchReason ?? 'legacy_selected',
    };
  }

  finiteButUselessDepthRejected = true;
  sourceStats.legacy_pr04d = {
    ...((sourceStats.legacy_pr04d as object) ?? {}),
    rejected: true,
    legacyCurveStats: legacyStats,
  };

  sourceStats.none = {
    reason: 'all_candidates_unusable',
    legacyPolicy: legacy.policy,
    legacyCurveStats: legacyStats,
  };

  return {
    frames: buildEvidenceFrames(frames, zeros(n)),
    selectedDepthSource: 'none',
    depthCurveUsable: false,
    finiteButUselessDepthRejected,
    sourceStats,
    legacyDepthSelection: legacy,
    v2InputSwitchReason: v2InputSwitchReason ?? 'all_unusable_explicit_none',
  };
}
