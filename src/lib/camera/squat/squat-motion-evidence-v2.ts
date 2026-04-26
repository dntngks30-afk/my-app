import type {
  SquatMotionEvidenceDecisionV2,
  SquatMotionEvidenceFrameV2,
  SquatMotionPatternV2,
  SquatMotionRomBandV2,
  SquatV2AttemptState,
} from './squat-motion-evidence-v2.types';

type NormalizedFrame = {
  timestampMs: number;
  depth: number;
  bodyVisible: boolean;
  lowerBodyVisible: boolean;
  setupPhase: boolean;
  lowerPoint: { x: number; y: number } | null;
  upperPoint: { x: number; y: number } | null;
  explicitUpperSignal: number | null;
};

const MICRO_ROM_MAX = 0.025;
const MEANINGFUL_DESCENT_MIN = 0.035;
const SHALLOW_ROM_MAX = 0.12;
const STANDARD_ROM_MAX = 0.32;
const RETURN_TOLERANCE_MIN = 0.018;
const STABLE_RETURN_FRAMES = 2;
const MAX_REP_FRAME_GAP_MS = 750;
/**
 * Maximum total cycle duration (start→return) for a single current squat attempt.
 * Tightened from 8000ms: the real-device false-positive had returnMs ~4800ms which
 * the old 8000ms guard missed. Real squats complete in 1-4 seconds; anything longer
 * signals stale buffer contamination from setup/positioning or a prior attempt.
 * This is NOT a speed/depth constraint — it is purely a staleness guard.
 */
const MAX_SQUAT_CYCLE_MS = 4500;
/**
 * Maximum allowed time (ms) between stableAfterReturnFrameIndex and the last input frame.
 * If the closure was detected more than this many ms before the latest frame, the cycle
 * was completed in the past (stale closure reuse). The user's current motion is AFTER the
 * closure — e.g. new descent after setup positioning — and must not be counted as passing.
 * 400ms ≈ 4 frames at 10fps: tight enough to reject 2600ms/1700ms false positives,
 * loose enough to not reject squats that completed one or two frames before the eval tick.
 */
const MAX_TAIL_CLOSURE_LAG_MS = 400;
/**
 * Minimum number of frames that must precede descentStartFrameIndex.
 * Tracked as evidence only (not a hard blocker alone); the tail freshness check
 * is the primary guard. startIndex=0 means the window has no pre-descent baseline.
 */
const MIN_PRE_DESCENT_BASELINE_FRAMES = 3;

/** PR-V2-INPUT-02: translation lock — all must hold; single metric never vetoes alone. */
const TRANSLATION_DELTA_SAMPLES_MIN = 5;
const TRANSLATION_CORR_MIN = 0.91;
const TRANSLATION_PATH_TRAVEL_RATIO_MIN = 0.78;
const TRANSLATION_NET_MAG_MIN = MEANINGFUL_DESCENT_MIN * 0.85;
const TRANSLATION_NET_RATIO_MIN = 0.72;
/** Setup bleed band: below notSetupPhase threshold (0.5) but material; avoids duplicating pure setup-only block. */
const TRANSLATION_SETUP_BLEED_MIN = 0.2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function min(values: number[]): number {
  return values.length > 0 ? Math.min(...values) : 0;
}

function readNestedNumber(frame: SquatMotionEvidenceFrameV2, path: readonly string[]): number | null {
  let cursor: unknown = frame;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[key];
  }
  return finiteNumber(cursor);
}

function readDepth(frame: SquatMotionEvidenceFrameV2): number | null {
  return (
    finiteNumber(frame.depth) ??
    finiteNumber(frame.lowerBodySignal) ??
    readNestedNumber(frame, ['derived', 'squatDepthProxyBlended']) ??
    readNestedNumber(frame, ['derived', 'squatDepthProxy']) ??
    readNestedNumber(frame, ['derived', 'squatDepthProxyRaw'])
  );
}

function pointVisible(point: { visibility?: number | null } | null | undefined): boolean {
  if (!point) return false;
  return typeof point.visibility === 'number' ? point.visibility >= 0.45 : true;
}

function midpoint(
  a: { x: number; y: number; visibility?: number | null } | null | undefined,
  b: { x: number; y: number; visibility?: number | null } | null | undefined
): { x: number; y: number } | null {
  if (!pointVisible(a) || !pointVisible(b) || !a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function averagePoint(points: Array<{ x: number; y: number; visibility?: number | null } | null | undefined>) {
  const visible = points.filter((point): point is { x: number; y: number; visibility?: number | null } =>
    pointVisible(point)
  );
  if (visible.length === 0) return null;
  return {
    x: mean(visible.map((point) => point.x)),
    y: mean(visible.map((point) => point.y)),
  };
}

function readJointPoint(frame: SquatMotionEvidenceFrameV2, key: string) {
  return frame.joints?.[key] ?? null;
}

function lowerPoint(frame: SquatMotionEvidenceFrameV2): { x: number; y: number } | null {
  if (frame.joints) {
    return averagePoint([
      readJointPoint(frame, 'leftHip'),
      readJointPoint(frame, 'rightHip'),
      readJointPoint(frame, 'leftKnee'),
      readJointPoint(frame, 'rightKnee'),
      readJointPoint(frame, 'leftAnkle'),
      readJointPoint(frame, 'rightAnkle'),
    ]);
  }
  const lms = frame.landmarks;
  if (!lms) return null;
  return averagePoint([lms[23], lms[24], lms[25], lms[26], lms[27], lms[28]]);
}

function upperPoint(frame: SquatMotionEvidenceFrameV2): { x: number; y: number } | null {
  if (frame.joints) {
    return averagePoint([
      readJointPoint(frame, 'leftShoulder'),
      readJointPoint(frame, 'rightShoulder'),
      readJointPoint(frame, 'leftElbow'),
      readJointPoint(frame, 'rightElbow'),
      readJointPoint(frame, 'leftWrist'),
      readJointPoint(frame, 'rightWrist'),
    ]);
  }
  const lms = frame.landmarks;
  if (!lms) return null;
  return averagePoint([lms[11], lms[12], lms[13], lms[14], lms[15], lms[16]]);
}

function lowerBodyVisibleEnough(frame: SquatMotionEvidenceFrameV2): boolean {
  if (frame.lowerBodyVisibleEnough === false) return false;
  if (frame.bodyVisibleEnough === false) return false;
  const critical = frame.visibilitySummary?.criticalJointsAvailability;
  if (typeof critical === 'number') return critical >= 0.6;
  if (frame.joints) {
    const keys = ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'];
    return mean(keys.map((key) => (pointVisible(frame.joints?.[key]) ? 1 : 0))) >= 0.65;
  }
  if (frame.landmarks) {
    const lower = [frame.landmarks[23], frame.landmarks[24], frame.landmarks[25], frame.landmarks[26], frame.landmarks[27], frame.landmarks[28]];
    return mean(lower.map((point) => (pointVisible(point) ? 1 : 0))) >= 0.65;
  }
  return true;
}

function bodyVisibleEnough(frame: SquatMotionEvidenceFrameV2): boolean {
  if (frame.bodyVisibleEnough === false) return false;
  if (frame.isValid === false) return false;
  if (frame.frameValidity === 'invalid' || frame.frameValidity === 'low_visibility') return false;
  const ratio = frame.visibilitySummary?.visibleLandmarkRatio;
  if (typeof ratio === 'number' && ratio < 0.45) return false;
  const avg = frame.visibilitySummary?.averageVisibility;
  if (typeof avg === 'number' && avg < 0.45) return false;
  return lowerBodyVisibleEnough(frame);
}

function isSetupPhase(frame: SquatMotionEvidenceFrameV2): boolean {
  if (frame.setupPhase === true) return true;
  const phase = String(frame.phaseHint ?? '').toLowerCase();
  return phase === 'setup' || phase === 'readiness' || phase === 'align' || phase === 'alignment';
}

function normalizeFrames(input: readonly SquatMotionEvidenceFrameV2[]): NormalizedFrame[] {
  return input.map((frame, index) => {
    const timestamp = finiteNumber(frame.timestampMs) ?? finiteNumber(frame.timestamp) ?? index * (1000 / 30);
    return {
      timestampMs: timestamp,
      depth: clamp01(readDepth(frame) ?? 0),
      bodyVisible: bodyVisibleEnough(frame),
      lowerBodyVisible: lowerBodyVisibleEnough(frame),
      setupPhase: isSetupPhase(frame),
      lowerPoint: lowerPoint(frame),
      upperPoint: upperPoint(frame),
      explicitUpperSignal: finiteNumber(frame.upperBodySignal),
    };
  });
}

function smoothDepths(frames: readonly NormalizedFrame[]): number[] {
  return frames.map((frame, index) => {
    const start = Math.max(0, index - 1);
    const end = Math.min(frames.length, index + 2);
    return median(frames.slice(start, end).map((item) => item.depth));
  });
}

function estimateFps(frames: readonly NormalizedFrame[]): number | undefined {
  const deltas: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    const delta = frames[i]!.timestampMs - frames[i - 1]!.timestampMs;
    if (Number.isFinite(delta) && delta > 0 && delta < 2000) deltas.push(delta);
  }
  if (deltas.length === 0) return undefined;
  return Math.round((1000 / median(deltas)) * 10) / 10;
}

function pointTravel(points: Array<{ x: number; y: number } | null>): number {
  let travel = 0;
  let previous: { x: number; y: number } | null = null;
  for (const point of points) {
    if (!point) continue;
    if (previous) {
      travel += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    previous = point;
  }
  return travel;
}

function signalAmplitude(values: readonly number[]): number {
  return values.length > 0 ? max([...values]) - min([...values]) : 0;
}

/**
 * PR-V2-INPUT-02: preserves the exact boolean outcome of legacy `lowerMotionDominant()`,
 * adds compact diagnostics only.
 */
function analyzeLowerBodyDominance(frames: readonly NormalizedFrame[], depths: readonly number[]) {
  const depthAmplitude = signalAmplitude(depths);
  const lowerTravel = pointTravel(frames.map((frame) => frame.lowerPoint));
  const lowerMotion = Math.max(depthAmplitude, lowerTravel);
  const explicitUpper = frames
    .map((frame) => frame.explicitUpperSignal)
    .filter((value): value is number => value != null);
  const upperMotion = explicitUpper.length > 0
    ? signalAmplitude(explicitUpper)
    : pointTravel(frames.map((frame) => frame.upperPoint));

  let dominant: boolean;
  if (lowerMotion < MEANINGFUL_DESCENT_MIN && upperMotion < MEANINGFUL_DESCENT_MIN) {
    dominant = true;
  } else if (upperMotion >= MEANINGFUL_DESCENT_MIN && lowerMotion < upperMotion * 0.75) {
    dominant = false;
  } else {
    dominant = lowerMotion >= Math.max(MICRO_ROM_MAX, upperMotion * 0.45);
  }

  const denom = lowerMotion + upperMotion;
  const score = denom > 1e-9 ? lowerMotion / denom : 0.5;
  const ratio = upperMotion > 1e-9 ? lowerMotion / upperMotion : lowerMotion > 1e-9 ? 99 : 1;

  return {
    dominant,
    lowerMotionAmp: lowerMotion,
    upperMotionAmp: upperMotion,
    ratio,
    score,
    dominanceBlockReason: dominant ? null : ('lower_body_motion_not_dominant' as const),
  };
}

function pearsonCorrelation(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 4) return null;
  const mx = mean([...xs]);
  const my = mean([...ys]);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const vx = xs[i]! - mx;
    const vy = ys[i]! - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  if (dx < 1e-14 || dy < 1e-14) return null;
  return num / Math.sqrt(dx * dy);
}

function collectAlignedVerticalDeltas(frames: readonly NormalizedFrame[]): { lower: number[]; upper: number[] } {
  const lower: number[] = [];
  const upper: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    const p0 = frames[i - 1]!;
    const p1 = frames[i]!;
    if (!p0.lowerPoint || !p1.lowerPoint || !p0.upperPoint || !p1.upperPoint) continue;
    lower.push(p1.lowerPoint.y - p0.lowerPoint.y);
    upper.push(p1.upperPoint.y - p0.upperPoint.y);
  }
  return { lower, upper };
}

function firstLastNetY(points: Array<{ x: number; y: number } | null>): { first: number; last: number } | null {
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < points.length; i += 1) {
    if (points[i]) {
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
    }
  }
  if (firstIdx < 0 || lastIdx < 0 || firstIdx === lastIdx) return null;
  return { first: points[firstIdx]!.y, last: points[lastIdx]!.y };
}

type TranslationMotionGate = {
  meaningfulDescent: boolean;
  reversal: boolean;
  nearStartReturn: boolean;
  stableAfterReturn: boolean;
};

/**
 * Conservative whole-body / setup-bleed translation lock from normalized landmark motion only.
 * No legacy compat fields, no depth-source-specific rules.
 */
function analyzeTranslationDominance(
  frames: readonly NormalizedFrame[],
  motion: TranslationMotionGate,
  setupFraction: number
): {
  suspicionScore: number;
  translationDominant: boolean;
  translationReason: 'whole_body_translation_dominant' | 'setup_translation_dominant' | null;
} {
  const structuralSquatExempt =
    motion.meaningfulDescent &&
    motion.reversal &&
    motion.nearStartReturn &&
    motion.stableAfterReturn;

  const lowerPts = frames.map((f) => f.lowerPoint);
  const upperPts = frames.map((f) => f.upperPoint);
  const lowerTravel = pointTravel(lowerPts);
  const upperTravel = pointTravel(upperPts);

  const travelMeaningful =
    lowerTravel >= MEANINGFUL_DESCENT_MIN && upperTravel >= MEANINGFUL_DESCENT_MIN;
  const maxT = Math.max(lowerTravel, upperTravel);
  const pathTravelRatio = maxT > 1e-9 ? Math.min(lowerTravel, upperTravel) / maxT : 0;
  const pathOk = travelMeaningful && pathTravelRatio >= TRANSLATION_PATH_TRAVEL_RATIO_MIN;

  const { lower: dLower, upper: dUpper } = collectAlignedVerticalDeltas(frames);
  const corr = pearsonCorrelation(dLower, dUpper);
  const corrOk = corr != null && corr >= TRANSLATION_CORR_MIN && dLower.length >= TRANSLATION_DELTA_SAMPLES_MIN;

  const netL = firstLastNetY(lowerPts);
  const netU = firstLastNetY(upperPts);
  let netOk = false;
  let netRatio = 0;
  if (netL && netU) {
    const nL = netL.last - netL.first;
    const nU = netU.last - netU.first;
    const aL = Math.abs(nL);
    const aU = Math.abs(nU);
    const sameSign = nL * nU > 0;
    const magOk = aL >= TRANSLATION_NET_MAG_MIN && aU >= TRANSLATION_NET_MAG_MIN;
    const maxN = Math.max(aL, aU);
    netRatio = maxN > 1e-9 ? Math.min(aL, aU) / maxN : 0;
    netOk = sameSign && magOk && netRatio >= TRANSLATION_NET_RATIO_MIN;
  }

  const translationDominant =
    !structuralSquatExempt && pathOk && corrOk && netOk;

  let translationReason: 'whole_body_translation_dominant' | 'setup_translation_dominant' | null = null;
  if (translationDominant) {
    const setupBleed =
      setupFraction >= TRANSLATION_SETUP_BLEED_MIN && setupFraction < 0.5;
    translationReason = setupBleed ? 'setup_translation_dominant' : 'whole_body_translation_dominant';
  }

  const corrClamped = corr != null ? clamp01((corr - 0.75) / 0.25) : 0;
  const pathClamped = clamp01((pathTravelRatio - 0.55) / 0.35);
  const netClamped = clamp01((netRatio - 0.5) / 0.35);
  const suspicionScore = translationDominant
    ? 1
    : clamp01((corrClamped * 0.45 + pathClamped * 0.3 + netClamped * 0.25));

  return { suspicionScore, translationDominant, translationReason };
}

function classifyRomBand(relativePeak: number): SquatMotionRomBandV2 {
  if (relativePeak < MEANINGFUL_DESCENT_MIN) return 'micro';
  if (relativePeak < SHALLOW_ROM_MAX) return 'shallow';
  if (relativePeak < STANDARD_ROM_MAX) return 'standard';
  return 'deep';
}

function qualityWarnings(romBand: SquatMotionRomBandV2): string[] {
  return romBand === 'shallow' ? ['low_rom'] : [];
}

function findMotionWindow(frames: readonly NormalizedFrame[], depths: readonly number[]) {
  const initialWindow = depths.slice(0, Math.min(4, depths.length));
  const startReference = initialWindow.length > 0 ? median(initialWindow) : depths[0] ?? 0;
  let startIndex = 0;
  let peakIndex = 0;
  let peakDepth = startReference;

  for (let i = 0; i < depths.length; i += 1) {
    const priorMin = min(depths.slice(0, i + 1));
    const futurePeak = max(depths.slice(i));
    if (futurePeak - priorMin >= MEANINGFUL_DESCENT_MIN) {
      startIndex = Math.max(0, i - 1);
      break;
    }
  }

  const startDepth = Math.min(startReference, depths[startIndex] ?? startReference);
  for (let i = startIndex; i < depths.length; i += 1) {
    if (depths[i]! > peakDepth) {
      peakDepth = depths[i]!;
      peakIndex = i;
    }
  }

  const relativePeak = Math.max(0, peakDepth - startDepth);
  const postPeak = depths.slice(peakIndex + 1);
  const bestReturnDepth = postPeak.length > 0 ? min(postPeak) : peakDepth;
  const returnTolerance = Math.max(RETURN_TOLERANCE_MIN, relativePeak * 0.35);
  let returnIndex: number | null = null;
  for (let i = peakIndex + 1; i < depths.length; i += 1) {
    if (depths[i]! <= startDepth + returnTolerance) {
      returnIndex = i;
      break;
    }
  }

  let stableAfterReturnIndex: number | null = null;
  let stableAfterReturn = false;
  if (returnIndex != null) {
    const stableSlice = depths.slice(returnIndex, returnIndex + STABLE_RETURN_FRAMES);
    const stableOk =
      stableSlice.length >= STABLE_RETURN_FRAMES &&
      max(stableSlice) <= startDepth + Math.max(RETURN_TOLERANCE_MIN * 1.25, relativePeak * 0.45);
    if (stableOk) {
      stableAfterReturn = true;
      stableAfterReturnIndex = returnIndex + STABLE_RETURN_FRAMES - 1;
    }
  }

  let reversalFrameIndex: number | null = null;
  let reversal = false;
  for (let i = peakIndex + 1; i < depths.length; i += 1) {
    const drop = peakDepth - depths[i]!;
    const previous = depths[i - 1] ?? peakDepth;
    const twoFrameDrop = i + 1 < depths.length ? previous - depths[i + 1]! : 0;
    if (drop >= Math.max(0.014, relativePeak * 0.25) && previous >= depths[i]! && twoFrameDrop >= 0) {
      reversal = true;
      reversalFrameIndex = i;
      break;
    }
  }

  const meaningfulDescent = relativePeak >= MEANINGFUL_DESCENT_MIN;
  const descent = meaningfulDescent ? relativePeak >= MICRO_ROM_MAX : false;

  // nearStartReturn requires: (1) meaningful descent occurred, (2) reversal after peak, (3) depth returned to near-start.
  // It must NOT be satisfied merely by initial standing frames before any descent.
  const nearStartReturn = meaningfulDescent && reversal && returnIndex != null;
  stableAfterReturn = meaningfulDescent && reversal && stableAfterReturn;
  reversal = meaningfulDescent && reversal;
  const returnDeltaToStart = Math.max(0, bestReturnDepth - startDepth);

  // sameRepOwnership validates that the complete descent→reversal→return cycle
  // originated from the same continuous motion window (startIndex < peakIndex,
  // no large temporal gaps, no setup-phase frames within the window).
  // Note: reversalFrameIndex can equal returnIndex on steep recovery (valid).
  let sameRepOwnership = meaningfulDescent && reversal && nearStartReturn && stableAfterReturn && startIndex < peakIndex;
  const endIndex = returnIndex ?? frames.length - 1;
  for (let i = startIndex + 1; i <= endIndex; i += 1) {
    if (frames[i]!.timestampMs - frames[i - 1]!.timestampMs > MAX_REP_FRAME_GAP_MS) {
      sameRepOwnership = false;
    }
  }
  if (frames.slice(startIndex, endIndex + 1).some((frame) => frame.setupPhase)) {
    sameRepOwnership = false;
  }

  return {
    startIndex,
    peakIndex,
    reversalFrameIndex,
    returnIndex,
    stableAfterReturnIndex,
    startDepth,
    peakDepth,
    relativePeak,
    returnDeltaToStart,
    descent,
    meaningfulDescent,
    reversal,
    nearStartReturn,
    stableAfterReturn,
    sameRepOwnership,
  };
}

function emptyDecision(
  motionPattern: SquatMotionPatternV2,
  romBand: SquatMotionRomBandV2,
  blockReason: string | null,
  overrides: Partial<SquatMotionEvidenceDecisionV2['evidence']> = {},
  metrics: SquatMotionEvidenceDecisionV2['metrics'] = {}
): SquatMotionEvidenceDecisionV2 {
  const evidence: SquatMotionEvidenceDecisionV2['evidence'] = {
    bodyVisibleEnough: false,
    lowerBodyMotionDominant: false,
    descent: false,
    meaningfulDescent: false,
    reversal: false,
    nearStartReturn: false,
    stableAfterReturn: false,
    sameRepOwnership: false,
    notSetupPhase: false,
    notUpperBodyOnly: false,
    notMicroBounce: false,
    temporalClosureSatisfied: false,
    activeAttemptWindowSatisfied: false,
    closureFreshAtTail: false,
    preDescentBaselineSatisfied: false,
    ...overrides,
  };
  return {
    usableMotionEvidence: false,
    motionPattern,
    romBand,
    blockReason,
    qualityWarnings: qualityWarnings(romBand),
    evidence,
    metrics,
  };
}

function buildDecision(
  usableMotionEvidence: boolean,
  motionPattern: SquatMotionPatternV2,
  romBand: SquatMotionRomBandV2,
  blockReason: string | null,
  evidence: SquatMotionEvidenceDecisionV2['evidence'],
  metrics: SquatMotionEvidenceDecisionV2['metrics']
): SquatMotionEvidenceDecisionV2 {
  return {
    usableMotionEvidence,
    motionPattern,
    romBand,
    blockReason,
    qualityWarnings: qualityWarnings(romBand),
    evidence,
    metrics,
  };
}

/** Micro movement threshold already used in standing_only vs micro_bounce labeling (diagnostic reuse only). */
const V2_ATTEMPT_EARLY_DESCENT_RELATIVE_PEAK = 0.004;

type SquatV2AttemptProgressStage = Exclude<
  SquatV2AttemptState,
  'pass' | 'blocked'
>;

const V2_ATTEMPT_PROGRESS_RANK: Record<SquatV2AttemptProgressStage, number> = {
  idle: 0,
  baseline_ready: 1,
  descent_committed: 2,
  peak_latched: 3,
  reversal_confirmed: 4,
  return_confirmed: 5,
  stable_recovery: 6,
};

function computeV2AttemptFurthestProgressStage(
  evidence: SquatMotionEvidenceDecisionV2['evidence'],
  metrics: SquatMotionEvidenceDecisionV2['metrics']
): SquatV2AttemptProgressStage {
  if (
    !evidence.bodyVisibleEnough ||
    !evidence.notSetupPhase ||
    !evidence.lowerBodyMotionDominant
  ) {
    return 'idle';
  }
  const relativePeak = metrics.relativePeak ?? 0;
  if (!evidence.meaningfulDescent) {
    if (relativePeak > V2_ATTEMPT_EARLY_DESCENT_RELATIVE_PEAK) return 'descent_committed';
    return 'baseline_ready';
  }
  if (!evidence.reversal) return 'peak_latched';
  if (!evidence.nearStartReturn) return 'reversal_confirmed';
  if (!evidence.stableAfterReturn) return 'return_confirmed';
  return 'stable_recovery';
}

function buildV2AttemptStageTimestamps(
  metrics: SquatMotionEvidenceDecisionV2['metrics'],
  frames: readonly NormalizedFrame[]
): SquatMotionEvidenceDecisionV2['metrics']['v2AttemptStageTimestamps'] {
  const tsAt = (idx: number | null | undefined): number | null => {
    if (idx == null || idx < 0 || idx >= frames.length) return null;
    const t = frames[idx]?.timestampMs;
    return typeof t === 'number' && Number.isFinite(t) ? t : null;
  };
  return {
    descentStartMs: tsAt(metrics.descentStartFrameIndex),
    peakMs: tsAt(metrics.peakFrameIndex),
    reversalMs: tsAt(metrics.reversalFrameIndex),
    returnMs: tsAt(metrics.nearStartReturnFrameIndex),
    stableMs: tsAt(metrics.stableAfterReturnFrameIndex),
  };
}

/**
 * PR-V2-INPUT-03: post-decision metrics only. Does not read or write pass/fail authority.
 */
function finalizeV2AttemptDiagnostics(
  decision: SquatMotionEvidenceDecisionV2,
  frames: readonly NormalizedFrame[]
): SquatMotionEvidenceDecisionV2 {
  const { evidence, metrics, usableMotionEvidence, blockReason } = decision;
  const furthestProgress = computeV2AttemptFurthestProgressStage(evidence, metrics);
  const rank = V2_ATTEMPT_PROGRESS_RANK[furthestProgress];

  let v2AttemptState: SquatV2AttemptState;
  let v2AttemptFurthestStage: SquatV2AttemptState | string;
  let v2AttemptBlockedAt: SquatV2AttemptState | string | null = null;
  let v2AttemptStateReason: string | null = null;
  let v2AttemptStateIndex: number;

  if (usableMotionEvidence) {
    v2AttemptState = 'pass';
    v2AttemptFurthestStage = 'pass';
    v2AttemptStateReason = null;
    v2AttemptStateIndex = 100 + rank;
  } else {
    v2AttemptState = 'blocked';
    v2AttemptFurthestStage = furthestProgress;
    v2AttemptBlockedAt = furthestProgress;
    v2AttemptStateReason = blockReason;
    v2AttemptStateIndex = 200 + rank;
  }

  return {
    ...decision,
    metrics: {
      ...metrics,
      v2AttemptState,
      v2AttemptStateReason,
      v2AttemptStateIndex,
      v2AttemptBlockedAt,
      v2AttemptFurthestStage,
      v2AttemptStageTimestamps: buildV2AttemptStageTimestamps(metrics, frames),
    },
  };
}

export function evaluateSquatMotionEvidenceV2(
  framesInput: readonly SquatMotionEvidenceFrameV2[]
): SquatMotionEvidenceDecisionV2 {
  const frames = normalizeFrames(framesInput);
  const estimatedFps = estimateFps(frames);
  const inputFrameCount = frames.length;
  const inputWindowDurationMs =
    frames.length > 1
      ? frames[frames.length - 1]!.timestampMs - frames[0]!.timestampMs
      : 0;
  const metricsBase = estimatedFps ? { estimatedFps } : {};

  if (frames.length < 4) {
    return finalizeV2AttemptDiagnostics(
      emptyDecision('none', 'micro', 'body_not_visible', {}, { ...metricsBase, inputFrameCount, inputWindowDurationMs }),
      frames
    );
  }

  const visibleRatio = mean(frames.map((frame) => (frame.bodyVisible && frame.lowerBodyVisible ? 1 : 0)));
  const bodyVisible = visibleRatio >= 0.65;
  const setupFraction = mean(frames.map((frame) => (frame.setupPhase ? 1 : 0)));
  const notSetupPhase = setupFraction < 0.5;
  const depths = frames.map((frame) => frame.depth);
  const dominance = analyzeLowerBodyDominance(frames, depths);
  const lowerDominant = dominance.dominant;
  const motion = findMotionWindow(frames, depths);
  const translation = analyzeTranslationDominance(frames, motion, setupFraction);
  const romBand = classifyRomBand(motion.relativePeak);
  const notMicroBounce = motion.relativePeak >= MEANINGFUL_DESCENT_MIN;
  const notUpperBodyOnly = lowerDominant;

  const returnMs =
    motion.returnIndex != null
      ? frames[motion.returnIndex]!.timestampMs - frames[motion.startIndex]!.timestampMs
      : undefined;

  // ── Tail closure freshness guard ─────────────────────────────────────────
  // stableAfterReturnFrameIndex must be within MAX_TAIL_CLOSURE_LAG_MS of the
  // last input frame. If the stable-after-return frame is far in the past, the
  // detected cycle is a STALE CLOSURE from setup/positioning (not the current
  // active attempt). The user's current motion (new descent) is AFTER the closure.
  // Real-device false positive: tailDistance=2600ms/1700ms → both must fail.
  const lastFrameIndex = frames.length - 1;
  const lastFrameTimestampMs = frames[lastFrameIndex]!.timestampMs;
  const stableAfterReturnTimestampMs =
    motion.stableAfterReturnIndex != null ? frames[motion.stableAfterReturnIndex]!.timestampMs : null;
  const tailDistanceFrames =
    motion.stableAfterReturnIndex != null ? lastFrameIndex - motion.stableAfterReturnIndex : null;
  const tailDistanceMs =
    stableAfterReturnTimestampMs != null ? lastFrameTimestampMs - stableAfterReturnTimestampMs : null;
  const closureFreshAtTail = tailDistanceMs != null && tailDistanceMs <= MAX_TAIL_CLOSURE_LAG_MS;

  // ── Pre-descent baseline tracking ────────────────────────────────────────
  // Tracked as evidence (informational). descentStartFrameIndex=0 means the
  // rolling window has no stable baseline before the detected descent started.
  const preDescentBaselineSatisfied = motion.startIndex >= MIN_PRE_DESCENT_BASELINE_FRAMES;

  // ── Attempt duration cap ──────────────────────────────────────────────────
  // The cycle duration (start→return) must not exceed MAX_SQUAT_CYCLE_MS.
  // This is a secondary staleness guard for cases where the closure is at the
  // tail but the cycle itself spans an implausibly long time window.
  //
  // PR04C — Slow-descent exception:
  // A genuine slow squat (descent > 4.5s) can have returnMs > MAX_SQUAT_CYCLE_MS
  // while still being a valid live attempt. The exception fires when ALL three
  // conditions hold:
  //   1. motion.startDepth <= MEANINGFUL_DESCENT_MIN * 0.5 (≈0.0175)
  //      → The input window's first frames were at near-standing depth.
  //      → Active-epoch windows start before the descent → startDepth ≈ 0.003-0.006.
  //      → Rolling-fallback windows can start mid-descent → startDepth ≈ 0.05+.
  //      → This is a more reliable proxy than preDescentBaselineSatisfied, which
  //        is always false because findMotionWindow sets startIndex=0 when any
  //        baseline depth is included (futurePeak - priorMin >= 0.035 at i=0).
  //   2. peakToReturnMs <= MAX_SQUAT_CYCLE_MS
  //      → The ascent portion (peak→return) is within normal bounds.
  //   3. closureFreshAtTail → closure just happened (not a stale historical cycle)
  // Together: safely unlocks slow genuine squats without re-opening stale false-positives.
  // Guards B, C, A still apply (they execute before/after this check).
  const peakToReturnMs =
    motion.returnIndex != null
      ? frames[motion.returnIndex]!.timestampMs - frames[motion.peakIndex]!.timestampMs
      : null;

  const activeAttemptWindowSatisfied =
    returnMs == null ||
    returnMs <= MAX_SQUAT_CYCLE_MS ||
    // Slow-descent exception: long total cycle but window started from standing + normal ascent + fresh closure
    (motion.startDepth <= MEANINGFUL_DESCENT_MIN * 0.5 &&
      peakToReturnMs != null &&
      peakToReturnMs <= MAX_SQUAT_CYCLE_MS &&
      closureFreshAtTail);

  // ── PR6-FIX-01B: Peak-to-tail diagnostics ────────────────────────────────
  // Used for Guard B (same-frame reversal/return) and Guard C (short post-peak).
  // peakDistanceFromTailFrames < 3 or peakDistanceFromTailMs < 250ms indicates
  // the post-peak window is too short for reliable reversal/return detection.
  const peakFrameTs = frames[motion.peakIndex]!.timestampMs;
  const peakDistanceFromTailFramesInternal = lastFrameIndex - motion.peakIndex;
  const peakDistanceFromTailMsInternal = lastFrameTimestampMs - peakFrameTs;

  // closureBlockedReason: first applicable guard that blocks the pass.
  const closureBlockedReason: string | null =
    motion.stableAfterReturn && !closureFreshAtTail
      ? 'stale_closure_not_at_tail'
      : !activeAttemptWindowSatisfied
      ? 'attempt_duration_out_of_scope'
      : null;

  // temporalClosureSatisfied: all structural AND temporal conditions satisfied.
  const temporalClosureSatisfied =
    activeAttemptWindowSatisfied &&
    closureFreshAtTail &&
    motion.meaningfulDescent &&
    motion.reversal &&
    motion.nearStartReturn &&
    motion.stableAfterReturn;

  const evidence: SquatMotionEvidenceDecisionV2['evidence'] = {
    bodyVisibleEnough: bodyVisible,
    lowerBodyMotionDominant: lowerDominant,
    descent: motion.descent,
    meaningfulDescent: motion.meaningfulDescent,
    reversal: motion.reversal,
    nearStartReturn: motion.nearStartReturn,
    stableAfterReturn: motion.stableAfterReturn,
    sameRepOwnership: motion.sameRepOwnership,
    notSetupPhase,
    notUpperBodyOnly,
    notMicroBounce,
    temporalClosureSatisfied,
    activeAttemptWindowSatisfied,
    closureFreshAtTail,
    preDescentBaselineSatisfied,
  };
  const metrics: SquatMotionEvidenceDecisionV2['metrics'] = {
    ...metricsBase,
    inputFrameCount,
    inputWindowDurationMs,
    relativePeak: motion.relativePeak,
    descentMagnitude: motion.relativePeak,
    returnDeltaToStart: motion.returnDeltaToStart,
    descentMs: frames[motion.peakIndex]!.timestampMs - frames[motion.startIndex]!.timestampMs,
    ascentMs:
      motion.returnIndex != null
        ? frames[motion.returnIndex]!.timestampMs - frames[motion.peakIndex]!.timestampMs
        : undefined,
    returnMs,
    descentStartFrameIndex: motion.startIndex,
    peakFrameIndex: motion.peakIndex,
    reversalFrameIndex: motion.reversalFrameIndex,
    nearStartReturnFrameIndex: motion.returnIndex,
    stableAfterReturnFrameIndex: motion.stableAfterReturnIndex,
    tailDistanceFrames,
    tailDistanceMs,
    closureBlockedReason,
    // PR6-FIX-01B: Peak-to-tail metrics (computed internally for guard logic + diagnostics)
    peakDistanceFromTailFrames: peakDistanceFromTailFramesInternal,
    peakDistanceFromTailMs: peakDistanceFromTailMsInternal,
    framesAfterPeak: peakDistanceFromTailFramesInternal,
    msAfterPeak: peakDistanceFromTailMsInternal,
    // PR04C: explicit post-peak frame count (same as framesAfterPeak — separate named field)
    postPeakFrameCount: peakDistanceFromTailFramesInternal,
    // PR04C: peak-to-return duration (ascent portion only)
    peakToReturnMs,
    v2LowerBodyDominanceScore: dominance.score,
    v2LowerBodyMotionAmplitude: dominance.lowerMotionAmp,
    v2UpperBodyMotionAmplitude: dominance.upperMotionAmp,
    v2LowerUpperMotionRatio: dominance.ratio,
    v2TranslationSuspicionScore: translation.suspicionScore,
    v2TranslationDominant: translation.translationDominant,
    v2DominanceBlockReason: dominance.dominanceBlockReason,
    v2TranslationReason: translation.translationReason,
  };

  if (!bodyVisible) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'none', romBand, 'body_not_visible', evidence, metrics), frames);
  }
  if (!notSetupPhase) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'setup_only', romBand, 'setup_phase_only', evidence, metrics), frames);
  }
  if (!lowerDominant) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'upper_body_only', romBand, 'lower_body_motion_not_dominant', evidence, metrics), frames);
  }
  if (translation.translationDominant && translation.translationReason) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'standing_only', romBand, translation.translationReason, evidence, metrics), frames);
  }
  if (!motion.meaningfulDescent) {
    const medianDepth = median(depths);
    const pattern: SquatMotionPatternV2 = medianDepth >= STANDARD_ROM_MAX ? 'bottom_hold' : 'standing_only';
    const reason = pattern === 'bottom_hold' ? 'no_return_to_start' : 'no_meaningful_descent';
    if (pattern === 'standing_only' && motion.relativePeak > 0.004) {
      return finalizeV2AttemptDiagnostics(buildDecision(false, 'standing_only', 'micro', 'micro_bounce', evidence, metrics), frames);
    }
    return finalizeV2AttemptDiagnostics(buildDecision(false, pattern, romBand, reason, evidence, metrics), frames);
  }
  if (!notMicroBounce) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'standing_only', 'micro', 'micro_bounce', evidence, metrics), frames);
  }
  if (!motion.reversal) {
    const tail = depths.slice(-Math.min(3, depths.length));
    const tailDepth = mean(tail);
    const tailRange = signalAmplitude(tail);
    const heldNearPeak = tailDepth >= motion.startDepth + motion.relativePeak * 0.65 && tailRange <= 0.012;
    return finalizeV2AttemptDiagnostics(
      buildDecision(
        false,
        heldNearPeak ? 'bottom_hold' : 'descent_only',
        romBand,
        heldNearPeak ? 'no_return_to_start' : 'no_reversal',
        evidence,
        metrics
      ),
      frames
    );
  }
  if (!motion.nearStartReturn) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'incomplete_return', romBand, 'incomplete_return', evidence, metrics), frames);
  }
  if (!motion.stableAfterReturn) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'incomplete_return', romBand, 'incomplete_return', evidence, metrics), frames);
  }
  // ── Guard B (PR6-FIX-01B): Return must follow reversal (distinct frames) ──
  // If nearStartReturnFrameIndex <= reversalFrameIndex, both reversal AND return
  // were detected in the same frame — physically impossible for a real squat,
  // indicating measurement noise or drift artifact. A real squat requires at
  // least one frame of ascent between the peak reversal and the standing return.
  // Real-device false positive (JSON 3): ascentMs ≈ 92ms (1 frame), same-frame.
  //
  // Restricted to shallow/micro romBand:
  //   - Deep/standard squats have high return thresholds (≥ 0.11 from startDepth)
  //     that naturally prevent same-frame reversal+return for genuine movement.
  //   - All observed real-device false positives are shallow/micro depth signals.
  //   - Applying to deep/standard would break high-fps golden fixtures where
  //     33ms frame intervals can land reversal and return on the same index even
  //     for valid squats (interpolation artifact, not a real single-frame return).
  if ((romBand === 'shallow') &&
      motion.reversalFrameIndex !== null &&
      motion.returnIndex !== null &&
      motion.returnIndex <= motion.reversalFrameIndex) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'incomplete_return', romBand, 'return_not_after_reversal', evidence, metrics), frames);
  }
  // ── Tail closure check (PRIMARY staleness guard) ──────────────────────────
  // stableAfterReturn is true but the closure is far from the current tail.
  // This means the complete cycle happened in the PAST (old positioning motion)
  // while the current input tail shows the user in a different state (new descent).
  // Real-device false positive primary cause: tailDistanceMs = 2600ms / 1700ms.
  if (!closureFreshAtTail) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'none', romBand, 'stale_closure_not_at_tail', evidence, metrics), frames);
  }
  // ── Attempt duration cap (SECONDARY staleness guard) ─────────────────────
  // Even if the closure is at the tail, the cycle must not span too long a time.
  if (!activeAttemptWindowSatisfied) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'none', romBand, 'attempt_duration_out_of_scope', evidence, metrics), frames);
  }
  if (!motion.sameRepOwnership) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'none', romBand, 'same_rep_ownership_failed', evidence, metrics), frames);
  }

  // ── Guard C (PR6-FIX-01B): Insufficient post-peak evidence for shallow ───
  // Ultra-short post-peak window makes reversal/return detection unreliable.
  // Real-device false positive (JSON 3): peakDistanceFromTailFrames=2, peakDistanceFromTailMs≈184ms.
  // Valid shallow pass baseline: peakDistanceFromTailFrames=5+, peakDistanceFromTailMs≥400ms.
  //
  // BOTH conditions must be true (AND) to avoid false-negative on high-fps devices where
  // 5 frames at 30fps = 166ms (would incorrectly block at 30fps with OR logic).
  // At real-device fps (~10fps): 2 frames = 200ms → both conditions true → blocked.
  // At 30fps valid shallow: 5 frames = 166ms → frames≥3 → first condition false → not blocked.
  //
  // Applies only to shallow/low_rom squats (deep/standard have larger ROM signal
  // that is naturally harder to fake with single-frame artifacts).
  if (romBand === 'shallow' &&
      peakDistanceFromTailFramesInternal < 3 &&
      peakDistanceFromTailMsInternal < 250) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'none', romBand, 'insufficient_post_peak_evidence', evidence, metrics), frames);
  }

  // ── Guard A (PR6-FIX-01B): Slow-descent shallow without pre-descent baseline
  // If no pre-descent baseline AND the descent fills ≥85% of the evaluation window,
  // the standing baseline was not captured — cannot verify the starting position.
  // Fast squats (low ratio) are exempt: their entire cycle fits in the window.
  // Real-device false positive (JSON 3): descentFillRatio ≈ 0.96 > 0.85.
  // Valid fast shallow pass: descentFillRatio ≈ 0.41 < 0.85 → not blocked.
  const descentDuration = frames[motion.peakIndex]!.timestampMs - frames[motion.startIndex]!.timestampMs;
  const descentFillRatio = inputWindowDurationMs > 0 ? descentDuration / inputWindowDurationMs : 0;
  if (romBand === 'shallow' && !preDescentBaselineSatisfied && descentFillRatio > 0.85) {
    return finalizeV2AttemptDiagnostics(buildDecision(false, 'descent_only', romBand, 'no_pre_descent_baseline', evidence, metrics), frames);
  }

  return finalizeV2AttemptDiagnostics(buildDecision(true, 'down_up_return', romBand, null, evidence, metrics), frames);
}
