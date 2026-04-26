/**
 * PR-V2-INPUT-05: shallow squat — second V2 evaluation on `validRaw` sliding windows
 * when primary epoch input is none / tail-spike / unusable curve (trigger from primary V2 + owner only).
 * Replacement is allowed only when PR04B consumption guard passes (shared module).
 *
 * PR-V2-INPUT-05B: recovery-only safety lock — candidate-local setup + dominance + micro/limb;
 * full-buffer setup is diagnostic / overlap support only (not a lone veto).
 *
 * PR-V2-INPUT-05C: usable curve but wrong active-epoch window — same search/accept pipeline,
 * gated by independent lower-body evidence on full validRaw (no arm-only recovery).
 */
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { SquatMotionEvidenceDecisionV2 } from '@/lib/camera/squat/squat-motion-evidence-v2.types';
import {
  buildSquatV2OwnedInputFrames,
  computeV2DepthSeriesStats,
  type SquatV2InputOwnerResult,
} from '@/lib/camera/squat/squat-v2-input-owner';
import { evaluateSquatMotionEvidenceV2 } from '@/lib/camera/squat/squat-motion-evidence-v2';
import { evaluateSquatV2RuntimeOwnerSafetyConsumption } from '@/lib/camera/squat/squat-v2-pr04b-consumption-guard';
import {
  computeSquatSetupMotionBlock,
  findFirstSquatSetupMotionBlockObservation,
  type SquatSetupMotionBlockObservation,
  type SquatSetupMotionBlockResult,
} from '@/lib/camera/squat/squat-setup-motion-window';

const MIN_VALID_RAW_FOR_SEARCH = 28;
const MIN_WINDOW_FRAMES = 36;
const MAX_WINDOW_FRAMES_CAP = 220;
const WINDOW_LEN_STEP = 6;
const WINDOW_START_STEP = 4;

/** PR05C: primary shows usable curve but epoch window is wrong — observability + search gate. */
export const TRIGGER_USABLE_CURVE_WRONG_WINDOW = 'usable_curve_wrong_window_recovery';
export const WRONG_WINDOW_NO_INDEPENDENT_LOWER_BODY_EVIDENCE =
  'wrong_window_no_independent_lower_body_evidence';

/** PR05 legacy path trigger labels (diagnostics only). */
export const TRIGGER_PR05_SOURCE_NONE_OR_UNUSABLE = 'pr05_recovery_source_none_or_unusable';
export const TRIGGER_PR05_TAIL_SPIKE = 'pr05_recovery_tail_spike';
export const TRIGGER_PR05_KNEE_FLEX_SHORT_TAIL = 'pr05_recovery_knee_flex_short_after_peak';
export const TRIGGER_PR05_LEGACY_TAIL_SPIKE = 'pr05_recovery_legacy_tail_spike';

export const RECOVERY_SETUP_MOTION_BLOCKED = 'recovery_setup_motion_blocked';
export const RECOVERY_MICRO_OR_LIMB_MOTION = 'recovery_micro_or_limb_motion';
export const RECOVERY_LOWER_BODY_NOT_DOMINANT_ENOUGH = 'recovery_lower_body_not_dominant_enough';

export type SquatV2ShallowRecoverySafetySnapshot = {
  safetyBlocked: boolean;
  safetyBlockedReason: string | null;
  safetyVersion: 'v2-shallow-recovery-safety-05b';
  lowerUpperRatio: number | null;
  lowerBodyAmplitude: number | null;
  upperBodyAmplitude: number | null;
  setupBlockedFullRaw: boolean;
  setupBlockReasonFullRaw: string | null;
  candidateSetupBlocked: boolean;
  candidateSetupBlockReason: string | null;
};

export type SquatV2ShallowRecoveryDiagnostics = {
  attempted: boolean;
  applied: boolean;
  primaryBlockReason: string | null;
  blockedReason: string | null;
  reason: string | null;
  windowStartMs: number | null;
  windowEndMs: number | null;
  windowFrameCount: number | null;
  candidatesTried: number;
  /** Last PR05B safety evaluation (PR04B-pass candidate); null if none reached safety stage. */
  recoverySafety: SquatV2ShallowRecoverySafetySnapshot | null;
  /** PR05C */
  triggerReason?: string | null;
  wrongWindowDetected?: boolean;
  primaryPeakAtStart?: boolean;
  primaryLowerUpperRatio?: number | null;
  primaryRelativePeak?: number | null;
  independentLowerBodyEvidence?: boolean | null;
  independentLowerBodyEvidenceReason?: string | null;
};

function finiteN(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fullBufferSetupOverlapsCandidate(
  firstObs: SquatSetupMotionBlockObservation,
  candidateStartIndex: number,
  candidateLen: number
): boolean {
  if (!firstObs.blocked || firstObs.firstBlockedValidIndex == null) return false;
  const fi = firstObs.firstBlockedValidIndex;
  return candidateStartIndex <= fi && fi < candidateStartIndex + candidateLen;
}

/**
 * PR05B: recovery acceptance only. Priority when multiple: A → C → B → D (D reserved).
 */
export function evaluateShallowRecoverySafety05b(p: {
  decision: SquatMotionEvidenceDecisionV2;
  candidateSlice: PoseFeaturesFrame[];
  candidateStartIndexInValidRaw: number;
  fullRawSetup: SquatSetupMotionBlockResult;
  fullRawFirstSetupObs: SquatSetupMotionBlockObservation;
}): { ok: boolean; snapshot: SquatV2ShallowRecoverySafetySnapshot } {
  const { decision, candidateSlice, candidateStartIndexInValidRaw, fullRawSetup, fullRawFirstSetupObs } =
    p;
  const setupOnCandidate = computeSquatSetupMotionBlock(candidateSlice);

  const lockAFromCandidate = setupOnCandidate.blocked === true;
  const lockAFromFullRawOverlap =
    fullRawSetup.blocked === true &&
    fullBufferSetupOverlapsCandidate(
      fullRawFirstSetupObs,
      candidateStartIndexInValidRaw,
      candidateSlice.length
    );
  const lockA = lockAFromCandidate || lockAFromFullRawOverlap;

  const m = decision.metrics ?? {};
  const ratioRaw = m.v2LowerUpperMotionRatio;
  const ratio = typeof ratioRaw === 'number' && Number.isFinite(ratioRaw) ? ratioRaw : null;
  const lowerAmpRaw = m.v2LowerBodyMotionAmplitude;
  const lowerAmp =
    typeof lowerAmpRaw === 'number' && Number.isFinite(lowerAmpRaw) ? lowerAmpRaw : null;
  const upperAmpRaw = m.v2UpperBodyMotionAmplitude;
  const upperAmp =
    typeof upperAmpRaw === 'number' && Number.isFinite(upperAmpRaw) ? upperAmpRaw : null;

  const romBand = decision.romBand;
  const peakRaw = m.relativePeak;
  const relativePeak =
    typeof peakRaw === 'number' && Number.isFinite(peakRaw) ? peakRaw : null;

  const lockC =
    romBand === 'shallow' &&
    relativePeak != null &&
    relativePeak < 0.05 &&
    ratio != null &&
    ratio < 1.5 &&
    lowerAmp != null &&
    lowerAmp < 0.1;

  const lockB = ratio != null && ratio < 1.35;

  let safetyBlockedReason: string | null = null;
  if (lockA) safetyBlockedReason = RECOVERY_SETUP_MOTION_BLOCKED;
  else if (lockC) safetyBlockedReason = RECOVERY_MICRO_OR_LIMB_MOTION;
  else if (lockB) safetyBlockedReason = RECOVERY_LOWER_BODY_NOT_DOMINANT_ENOUGH;

  const snapshot: SquatV2ShallowRecoverySafetySnapshot = {
    safetyBlocked: safetyBlockedReason != null,
    safetyBlockedReason,
    safetyVersion: 'v2-shallow-recovery-safety-05b',
    lowerUpperRatio: ratio,
    lowerBodyAmplitude: lowerAmp,
    upperBodyAmplitude: upperAmp,
    setupBlockedFullRaw: fullRawSetup.blocked === true,
    setupBlockReasonFullRaw: fullRawSetup.reason,
    candidateSetupBlocked: setupOnCandidate.blocked === true,
    candidateSetupBlockReason: setupOnCandidate.reason,
  };

  return { ok: safetyBlockedReason == null, snapshot };
}

function peakAtTailStall(
  decision: SquatMotionEvidenceDecisionV2,
  v2EvalFrameCount: number
): boolean {
  const m = decision.metrics;
  if (!m) return false;
  const peakFrameIndex_v2 = m.peakFrameIndex ?? null;
  const inputFrameCount_v2 = m.inputFrameCount ?? v2EvalFrameCount;
  return (
    peakFrameIndex_v2 !== null &&
    (peakFrameIndex_v2 >= inputFrameCount_v2 - 1 ||
      (m.framesAfterPeak ?? 0) <= 0 ||
      (m.peakDistanceFromTailFrames ?? 0) <= 0)
  );
}

function readSelectedTailSpikeOnly(owned: SquatV2InputOwnerResult): boolean {
  const src = owned.selectedDepthSource;
  if (src === 'none') return true;
  const bag = owned.sourceStats?.[src];
  if (bag == null || typeof bag !== 'object') return false;
  return (bag as Record<string, unknown>).tailSpikeOnly === true;
}

/** PR05 standard triggers (unchanged semantics). */
function computeLegacyPr05RecoveryTrigger(owned: SquatV2InputOwnerResult): {
  triggered: boolean;
  reason: string | null;
} {
  if (owned.selectedDepthSource === 'none' || !owned.depthCurveUsable) {
    return { triggered: true, reason: TRIGGER_PR05_SOURCE_NONE_OR_UNUSABLE };
  }
  if (readSelectedTailSpikeOnly(owned)) {
    return { triggered: true, reason: TRIGGER_PR05_TAIL_SPIKE };
  }
  const kneeBag = owned.sourceStats?.['knee_flex_proxy'];
  if (owned.selectedDepthSource === 'knee_flex_proxy' && kneeBag && typeof kneeBag === 'object') {
    const fap = (kneeBag as Record<string, unknown>).framesAfterPeak;
    if (typeof fap === 'number' && fap <= 2) {
      return { triggered: true, reason: TRIGGER_PR05_KNEE_FLEX_SHORT_TAIL };
    }
  }
  const legacy = owned.sourceStats?.['legacy_pr04d'];
  if (legacy && typeof legacy === 'object') {
    const lcs = (legacy as Record<string, unknown>).legacyCurveStats as
      | Record<string, unknown>
      | undefined;
    if (lcs?.tailSpikeOnly === true) {
      return { triggered: true, reason: TRIGGER_PR05_LEGACY_TAIL_SPIKE };
    }
  }
  return { triggered: false, reason: null };
}

/**
 * Usable source + curve but primary V2 window looks like a wrong-phase fragment.
 * Does NOT imply independent lower-body motion (arm-only can match).
 */
function detectWrongWindowSymptomBundle(
  decision: SquatMotionEvidenceDecisionV2,
  owned: SquatV2InputOwnerResult
): boolean {
  if (owned.selectedDepthSource === 'none' || !owned.depthCurveUsable) return false;
  if (
    decision.blockReason !== 'lower_body_motion_not_dominant' &&
    decision.motionPattern !== 'upper_body_only'
  ) {
    return false;
  }
  const m = decision.metrics ?? {};
  const peakIx = m.peakFrameIndex ?? 999;
  const descentStart = m.descentStartFrameIndex ?? 999;
  const peakAtVeryStart = peakIx <= 1;
  const descentAtZeroWithEarlyPeak = descentStart <= 0 && peakIx <= 1;
  if (!peakAtVeryStart && !descentAtZeroWithEarlyPeak) return false;

  const rel = finiteN(m.relativePeak);
  const ratio = finiteN(m.v2LowerUpperMotionRatio);
  const microOrRatio = (rel != null && rel < 0.035) || (ratio != null && ratio < 1);
  return microOrRatio;
}

function readPrimaryRecoveryFields(decision: SquatMotionEvidenceDecisionV2): {
  primaryPeakAtStart: boolean;
  primaryLowerUpperRatio: number | null;
  primaryRelativePeak: number | null;
} {
  const m = decision.metrics ?? {};
  const peakIx = m.peakFrameIndex ?? null;
  return {
    primaryPeakAtStart: peakIx !== null && peakIx <= 1,
    primaryLowerUpperRatio: finiteN(m.v2LowerUpperMotionRatio),
    primaryRelativePeak: finiteN(m.relativePeak),
  };
}

/** PR05C option A — full-buffer depth series (blended / proxy / raw), conservative local gates. */
const EVIDENCE_DEPTH_PEAK_MIN = 0.035;
const EVIDENCE_MIN_PRE_PEAK_FRAMES = 2;
const EVIDENCE_MIN_POST_PEAK_FRAMES = 6;

function depthSeriesIndependentEvidence(frames: PoseFeaturesFrame[]): { ok: boolean; reason: string } {
  const blendedDepths = frames.map((f) => finiteN(f.derived.squatDepthProxyBlended) ?? 0);
  const proxyDepths = frames.map((f) => finiteN(f.derived.squatDepthProxy) ?? 0);
  const rawDepths = frames.map((f) => finiteN(f.derived.squatDepthProxyRaw) ?? 0);

  const check = (depths: number[], label: string): { ok: boolean; reason: string } => {
    const n = depths.length;
    if (n < MIN_VALID_RAW_FOR_SEARCH) return { ok: false, reason: `${label}_buffer_short` };
    const st = computeV2DepthSeriesStats(depths);
    if (st.max < EVIDENCE_DEPTH_PEAK_MIN) return { ok: false, reason: `${label}_peak_below_min` };
    if (st.peakFrameIndex < EVIDENCE_MIN_PRE_PEAK_FRAMES) {
      return { ok: false, reason: `${label}_peak_first_only` };
    }
    if (st.peakFrameIndex > n - EVIDENCE_MIN_POST_PEAK_FRAMES - 1) {
      return { ok: false, reason: `${label}_peak_tail_only` };
    }
    if (st.framesAfterPeak < EVIDENCE_MIN_POST_PEAK_FRAMES) {
      return { ok: false, reason: `${label}_post_peak_short` };
    }
    if (!st.hasPostPeakDrop) return { ok: false, reason: `${label}_no_post_peak_drop` };
    if (st.tailSpikeOnly) return { ok: false, reason: `${label}_tail_spike` };
    return { ok: true, reason: `${label}_depth_evidence_ok` };
  };

  for (const [depths, lab] of [
    [blendedDepths, 'blended'],
    [proxyDepths, 'proxy'],
    [rawDepths, 'raw'],
  ] as const) {
    const r = check(depths, lab);
    if (r.ok) return r;
  }
  return { ok: false, reason: 'all_depth_series_failed_evidence' };
}

function midpointLandmark(
  a: { y: number; visibility?: number | null } | null | undefined,
  b: { y: number; visibility?: number | null } | null | undefined
): { y: number; visibility?: number | null } | null {
  if (a == null || b == null) return null;
  const va = a.visibility ?? 1;
  const vb = b.visibility ?? 1;
  return { y: (a.y + b.y) / 2, visibility: Math.min(va, vb) };
}

function hipY(frame: PoseFeaturesFrame): number | null {
  const j = frame.joints;
  const h = j.hipCenter ?? midpointLandmark(j.leftHip, j.rightHip);
  if (h == null) return null;
  const vis = h.visibility ?? 1;
  if (vis < 0.35) return null;
  return h.y;
}

function shoulderY(frame: PoseFeaturesFrame): number | null {
  const j = frame.joints;
  const s = j.shoulderCenter ?? midpointLandmark(j.leftShoulder, j.rightShoulder);
  if (s == null) return null;
  const vis = s.visibility ?? 1;
  if (vis < 0.35) return null;
  return s.y;
}

/** PR05C option B — hip/pelvis vertical travel vs shoulder (no wrist/elbow). */
const HIP_TRAVEL_AMP_MIN = 0.022;
const HIP_FINITE_FRAC_MIN = 0.65;
const HIP_MIN_FINITE_COUNT = 20;
const HIP_POST_PEAK_DROP_MIN = 0.008;
const HIP_LOWER_DOMINANCE_VS_SHOULDER = 0.98;

function hipTravelIndependentEvidence(frames: PoseFeaturesFrame[]): { ok: boolean; reason: string } {
  const n = frames.length;
  if (n < MIN_VALID_RAW_FOR_SEARCH) return { ok: false, reason: 'hip_buffer_short' };
  const ys: Array<number | null> = frames.map((f) => hipY(f));
  const finiteCount = ys.filter((y) => y != null && Number.isFinite(y)).length;
  if (finiteCount / n < HIP_FINITE_FRAC_MIN) return { ok: false, reason: 'hip_finite_ratio_low' };
  if (finiteCount < HIP_MIN_FINITE_COUNT) return { ok: false, reason: 'hip_finite_count_low' };

  const values = ys.map((y) => (y != null && Number.isFinite(y) ? y : null));
  const finiteVals = values.filter((y): y is number => y != null);
  const minY = Math.min(...finiteVals);
  const maxY = Math.max(...finiteVals);
  const amp = maxY - minY;
  if (amp < HIP_TRAVEL_AMP_MIN) return { ok: false, reason: 'hip_amp_low' };

  let peakIdx = -1;
  for (let i = 0; i < n; i++) {
    const y = values[i];
    if (y == null) continue;
    if (peakIdx < 0 || y > values[peakIdx]!) peakIdx = i;
  }
  if (peakIdx < 0) return { ok: false, reason: 'hip_no_peak' };
  if (peakIdx <= 0) return { ok: false, reason: 'hip_peak_at_start' };
  if (peakIdx >= n - 3) return { ok: false, reason: 'hip_peak_at_tail' };

  let minAfter = Infinity;
  for (let i = peakIdx + 1; i < n; i++) {
    const y = values[i];
    if (y != null && Number.isFinite(y) && y < minAfter) minAfter = y;
  }
  if (!Number.isFinite(minAfter) || minAfter > maxY - HIP_POST_PEAK_DROP_MIN) {
    return { ok: false, reason: 'hip_no_post_peak_drop' };
  }

  const shoulderYs = frames.map((f) => shoulderY(f)).filter((y): y is number => y != null);
  if (shoulderYs.length < 10) return { ok: false, reason: 'shoulder_finite_low' };
  const sAmp = Math.max(...shoulderYs) - Math.min(...shoulderYs);
  if (sAmp <= 0 || amp < sAmp * HIP_LOWER_DOMINANCE_VS_SHOULDER) {
    return { ok: false, reason: 'hip_not_dominant_vs_shoulder' };
  }

  return { ok: true, reason: 'hip_travel_evidence_ok' };
}

/**
 * Independent lower-body evidence on full validRaw (PR05C).
 * Option A: depth series. Option B: hip vs shoulder travel. No arm/wrist-only paths.
 */
export function hasIndependentLowerBodyEvidence(validRaw: PoseFeaturesFrame[]): {
  ok: boolean;
  reason: string;
} {
  const d = depthSeriesIndependentEvidence(validRaw);
  if (d.ok) return d;
  const h = hipTravelIndependentEvidence(validRaw);
  if (h.ok) return h;
  return { ok: false, reason: `no_evidence:${d.reason}|${h.reason}` };
}

export type ShallowV2RecoveryAttemptResolution = {
  shouldRunSlidingSearch: boolean;
  wrongWindowDetected: boolean;
  triggerReason: string | null;
  independentLowerBodyEvidence: boolean | null;
  independentLowerBodyEvidenceReason: string | null;
  primaryPeakAtStart: boolean;
  primaryLowerUpperRatio: number | null;
  primaryRelativePeak: number | null;
};

/**
 * Resolves whether to run sliding-window recovery and attaches PR05C observability fields.
 * Returns null when no recovery class applies (same early exits as legacy shouldAttempt).
 */
export function resolveShallowV2RecoveryAttempt(p: {
  validRaw: PoseFeaturesFrame[];
  validRawLength: number;
  decision: SquatMotionEvidenceDecisionV2;
  owned: SquatV2InputOwnerResult;
  v2EvalFrameCount: number;
}): ShallowV2RecoveryAttemptResolution | null {
  if (p.validRawLength < MIN_VALID_RAW_FOR_SEARCH) return null;
  if (p.decision.usableMotionEvidence) return null;
  if (!p.decision.metrics) return null;
  if (peakAtTailStall(p.decision, p.v2EvalFrameCount)) return null;

  const legacy = computeLegacyPr05RecoveryTrigger(p.owned);
  const wrongWindow = detectWrongWindowSymptomBundle(p.decision, p.owned);
  if (!legacy.triggered && !wrongWindow) return null;

  const primary = readPrimaryRecoveryFields(p.decision);
  let evidence: { ok: boolean; reason: string };
  if (wrongWindow) {
    if (p.validRaw.length < MIN_VALID_RAW_FOR_SEARCH) {
      evidence = { ok: false, reason: 'valid_raw_too_short_for_evidence' };
    } else {
      evidence = hasIndependentLowerBodyEvidence(p.validRaw);
    }
  } else {
    evidence = { ok: true, reason: 'legacy_pr05_no_wrong_window_evidence_gate' };
  }

  const shouldRunSlidingSearch = legacy.triggered || (wrongWindow && evidence.ok);

  let triggerReason: string | null = null;
  if (wrongWindow) {
    triggerReason = TRIGGER_USABLE_CURVE_WRONG_WINDOW;
  } else if (legacy.triggered) {
    triggerReason = legacy.reason;
  }

  return {
    shouldRunSlidingSearch,
    wrongWindowDetected: wrongWindow,
    triggerReason,
    independentLowerBodyEvidence: wrongWindow ? evidence.ok : null,
    independentLowerBodyEvidenceReason: wrongWindow ? evidence.reason : null,
    ...primary,
  };
}

export function applyResolutionToDiagnostics(
  diag: SquatV2ShallowRecoveryDiagnostics,
  resolution: ShallowV2RecoveryAttemptResolution
): SquatV2ShallowRecoveryDiagnostics {
  return {
    ...diag,
    triggerReason: resolution.triggerReason,
    wrongWindowDetected: resolution.wrongWindowDetected,
    primaryPeakAtStart: resolution.primaryPeakAtStart,
    primaryLowerUpperRatio: resolution.primaryLowerUpperRatio,
    primaryRelativePeak: resolution.primaryRelativePeak,
    independentLowerBodyEvidence: resolution.independentLowerBodyEvidence,
    independentLowerBodyEvidenceReason: resolution.independentLowerBodyEvidenceReason,
  };
}

export function buildWrongWindowSkippedRecoveryDiagnostics(
  resolution: ShallowV2RecoveryAttemptResolution,
  primaryDecision: SquatMotionEvidenceDecisionV2
): SquatV2ShallowRecoveryDiagnostics {
  return applyResolutionToDiagnostics(
    {
      attempted: true,
      applied: false,
      primaryBlockReason: primaryDecision.blockReason,
      blockedReason: WRONG_WINDOW_NO_INDEPENDENT_LOWER_BODY_EVIDENCE,
      reason: null,
      windowStartMs: null,
      windowEndMs: null,
      windowFrameCount: null,
      candidatesTried: 0,
      recoverySafety: null,
    },
    resolution
  );
}

/**
 * Trigger uses primary V2 decision + input owner + primary eval frame count only
 * (no dwell/slice or later pipeline fields).
 * True only when sliding-window search should run (legacy PR05 or wrong-window + evidence).
 */
export function shouldAttemptShallowV2Recovery(p: {
  validRaw: PoseFeaturesFrame[];
  validRawLength: number;
  decision: SquatMotionEvidenceDecisionV2;
  owned: SquatV2InputOwnerResult;
  v2EvalFrameCount: number;
}): boolean {
  const r = resolveShallowV2RecoveryAttempt(p);
  return r?.shouldRunSlidingSearch ?? false;
}

function windowStartSetupContaminated(frames: PoseFeaturesFrame[]): boolean {
  const k = Math.max(1, Math.floor(frames.length * 0.35));
  let bad = 0;
  for (let i = 0; i < k; i++) {
    const ph = String(frames[i]!.phaseHint ?? '').toLowerCase();
    if (ph === 'setup' || ph === 'readiness' || ph === 'align' || ph === 'alignment') bad++;
  }
  return bad >= k * 0.7;
}

export function makeShallowRecoveryActiveEpoch(slice: PoseFeaturesFrame[]): {
  epochStartMs: number;
  epochSource: string;
  usedRollingFallback: boolean;
  activeAttemptEpochStartMs: number | null;
  activeAttemptEpochSource: string | null;
  epochResetReason: string | null;
} {
  const t0 = slice[0]!.timestampMs;
  return {
    epochStartMs: t0,
    epochSource: 'shallow_recovery_window',
    usedRollingFallback: false,
    activeAttemptEpochStartMs: t0,
    activeAttemptEpochSource: 'shallow_recovery_window',
    epochResetReason: null,
  };
}

function acceptShallowRecoveryCandidate(
  decision: SquatMotionEvidenceDecisionV2,
  owned: SquatV2InputOwnerResult
): { ok: boolean; reason: string | null } {
  if (!decision.usableMotionEvidence) {
    return { ok: false, reason: 'candidate_not_usable' };
  }
  if (owned.selectedDepthSource === 'none' || !owned.depthCurveUsable) {
    return { ok: false, reason: 'candidate_input_unusable' };
  }
  if (owned.finiteButUselessDepthRejected && owned.selectedDepthSource === 'knee_flex_proxy') {
    return { ok: false, reason: 'candidate_finite_rejected' };
  }
  if (readSelectedTailSpikeOnly(owned)) {
    return { ok: false, reason: 'candidate_tail_spike' };
  }

  const m = decision.metrics ?? {};
  if (decision.evidence.closureFreshAtTail !== true) {
    return { ok: false, reason: 'candidate_closure_not_fresh_at_tail' };
  }
  if ((m.framesAfterPeak ?? 0) < 6) {
    return { ok: false, reason: 'candidate_insufficient_frames_after_peak' };
  }

  const safety = evaluateSquatV2RuntimeOwnerSafetyConsumption(decision);
  if (!safety.consumptionAllowed) {
    return { ok: false, reason: safety.blockedReason ?? 'pr04b_consumption_blocked' };
  }

  return { ok: true, reason: null };
}

export type ShallowRecoverySearchHit = {
  decision: SquatMotionEvidenceDecisionV2;
  ownedInput: SquatV2InputOwnerResult;
  v2EvalFrames: PoseFeaturesFrame[];
  syntheticEpoch: ReturnType<typeof makeShallowRecoveryActiveEpoch>;
};

const EMPTY_FULL_SETUP: SquatSetupMotionBlockResult = { blocked: false, reason: null };
const EMPTY_FIRST_OBS: SquatSetupMotionBlockObservation = {
  blocked: false,
  reason: null,
  firstBlockedValidIndex: null,
  firstBlockedAtMs: null,
};

/**
 * Search sliding windows over `validRaw` only. First accepted candidate wins.
 * `fullRawSetup` / `fullRawFirstSetupObs` are diagnostic + overlap only; never sole veto.
 */
export function tryFindShallowV2RecoveryWindow(p: {
  validRaw: PoseFeaturesFrame[];
  latestValidTs: number;
  primaryDecision: SquatMotionEvidenceDecisionV2;
  /** Optional: `computeSquatSetupMotionBlock(validRaw)` for observability + overlap Lock A. */
  fullRawSetup?: SquatSetupMotionBlockResult;
  /** Optional: first blocked index in validRaw for overlap; omit if fullRawSetup omitted. */
  fullRawFirstSetupObs?: SquatSetupMotionBlockObservation;
}): { hit: ShallowRecoverySearchHit | null; diagnostics: SquatV2ShallowRecoveryDiagnostics } {
  void p.latestValidTs;
  const { validRaw, primaryDecision } = p;
  const fullRawSetup = p.fullRawSetup ?? EMPTY_FULL_SETUP;
  const fullRawFirstSetupObs = p.fullRawFirstSetupObs ?? EMPTY_FIRST_OBS;

  const diag: SquatV2ShallowRecoveryDiagnostics = {
    attempted: true,
    applied: false,
    primaryBlockReason: primaryDecision.blockReason,
    blockedReason: null,
    reason: null,
    windowStartMs: null,
    windowEndMs: null,
    windowFrameCount: null,
    candidatesTried: 0,
    recoverySafety: null,
  };

  const n = validRaw.length;
  if (n < MIN_VALID_RAW_FOR_SEARCH) {
    diag.blockedReason = 'valid_raw_too_short';
    return { hit: null, diagnostics: diag };
  }

  const maxW = Math.min(n, MAX_WINDOW_FRAMES_CAP);
  let lastReason: string | null = 'no_shallow_candidate';

  for (let w = maxW; w >= MIN_WINDOW_FRAMES; w -= WINDOW_LEN_STEP) {
    for (let start = 0; start + w <= n; start += WINDOW_START_STEP) {
      const slice = validRaw.slice(start, start + w);
      if (slice.length < MIN_WINDOW_FRAMES) continue;
      if (windowStartSetupContaminated(slice)) continue;

      diag.candidatesTried++;
      const ownedInput = buildSquatV2OwnedInputFrames(slice);
      const decision = evaluateSquatMotionEvidenceV2(ownedInput.frames);
      const acc = acceptShallowRecoveryCandidate(decision, ownedInput);
      if (!acc.ok) {
        lastReason = acc.reason;
        continue;
      }

      const safety = evaluateShallowRecoverySafety05b({
        decision,
        candidateSlice: slice,
        candidateStartIndexInValidRaw: start,
        fullRawSetup,
        fullRawFirstSetupObs,
      });
      diag.recoverySafety = safety.snapshot;

      if (!safety.ok) {
        lastReason = safety.snapshot.safetyBlockedReason;
        continue;
      }

      diag.applied = true;
      diag.blockedReason = null;
      diag.reason = 'shallow_recovery_window_accepted';
      diag.windowStartMs = slice[0]!.timestampMs;
      diag.windowEndMs = slice[slice.length - 1]!.timestampMs;
      diag.windowFrameCount = slice.length;

      return {
        hit: {
          decision,
          ownedInput,
          v2EvalFrames: slice,
          syntheticEpoch: makeShallowRecoveryActiveEpoch(slice),
        },
        diagnostics: diag,
      };
    }
  }

  diag.blockedReason = lastReason;
  return { hit: null, diagnostics: diag };
}
