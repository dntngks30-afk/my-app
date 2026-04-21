// RF09: squat completion core helper graph.
// Runtime owner entry points stay in squat-completion-state.ts; helper/debug consumers may import owned helpers directly.
import type { PoseFeaturesFrame } from '../pose-features';
import { getSquatRecoverySignal } from '../pose-features';
import {
  detectSquatReversalConfirmation,
  evaluateOfficialShallowCompletionStreamBridge,
  readSquatCompletionDepthForReversal,
} from '@/lib/camera/squat/squat-reversal-confirmation';
import {
  deriveSquatCompletionMachinePhase,
  deriveSquatCompletionPassReason,
  type SquatCompletionMachinePhase,
  type SquatCompletionPassReason,
} from '@/lib/camera/squat-completion-machine';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';
import { getHmmAssistDecision, hmmMeetsStrongAssistEvidence } from '@/lib/camera/squat/squat-hmm-assist';
import { getSquatHmmReversalAssistDecision } from '@/lib/camera/squat/squat-reversal-assist';
import {
  deriveCanonicalShallowCompletionContract,
} from '@/lib/camera/squat/shallow-completion-contract';
import {
  buildCanonicalShallowContractInputFromState as buildCanonicalShallowContractInputFromStateImpl,
} from '@/lib/camera/squat/squat-completion-canonical';
import type {
  SquatCompletionState,
  SquatCompletionPhase,
  SquatEvidenceLabel,
  SquatCompletionFinalizeMode,
  SquatCompletionAssistSource,
  SquatCompletionAssistMode,
  SquatReversalEvidenceProvenance,
  EvaluateSquatCompletionStateOptions,
} from '../squat-completion-state';
import type { ShallowNormalizedBlockerFamily } from './squat-completion-debug-types';
import {
  KNEE_DESCENT_ONSET_EPSILON_DEG,
  KNEE_DESCENT_ONSET_SUSTAIN_FRAMES,
  type PreArmingKinematicDescentEpoch,
} from './squat-completion-arming';

/** PR-04E3B: 첫 attemptStarted 시점에 고정한 스트림·baseline — 동일 버퍼 내 재평가 없음 */
export type SquatDepthFreezeConfig = {
  lockedRelativeDepthPeakSource: 'primary' | 'blended';
  frozenBaselineStandingDepth: number;
};


/** PR-HMM-03A: calibration 로그용 안정 정수 코드 (0 = null) */
const SQUAT_COMPLETION_BLOCKED_REASON_CODES: Record<string, number> = {
  not_armed: 1,
  no_descend: 2,
  insufficient_relative_depth: 3,
  no_commitment: 4,
  no_reversal: 5,
  no_ascend: 6,
  not_standing_recovered: 7,
  recovery_hold_too_short: 8,
  low_rom_standing_finalize_not_satisfied: 9,
  ultra_low_rom_standing_finalize_not_satisfied: 10,
  descent_span_too_short: 11,
  ascent_recovery_span_too_short: 12,
};

export function squatCompletionBlockedReasonToCode(reason: string | null): number {
  if (reason == null) return 0;
  return SQUAT_COMPLETION_BLOCKED_REASON_CODES[reason] ?? 99;
}

function isRecoveryFinalizeFamilyRuleBlocked(reason: string | null): boolean {
  if (reason == null) return false;
  return (
    reason === 'not_standing_recovered' ||
    reason === 'recovery_hold_too_short' ||
    reason === 'low_rom_standing_finalize_not_satisfied' ||
    reason === 'ultra_low_rom_standing_finalize_not_satisfied'
  );
}

/** PR-02: assist 채널 목록 — owner 가 아닌 provenance 만 */
function buildSquatCompletionAssistSources(input: {
  hmmAssistApplied: boolean;
  hmmReversalAssistApplied: boolean;
  trajectoryReversalRescueApplied: boolean;
  reversalTailBackfillApplied: boolean;
  ultraShallowMeaningfulDownUpRescueApplied: boolean;
  eventCyclePromoted: boolean;
}): SquatCompletionAssistSource[] {
  const out: SquatCompletionAssistSource[] = [];
  if (input.hmmAssistApplied) out.push('hmm_blocked_reason');
  if (input.hmmReversalAssistApplied) out.push('hmm_reversal');
  if (input.trajectoryReversalRescueApplied) out.push('trajectory_reversal_rescue');
  if (input.reversalTailBackfillApplied) out.push('standing_tail_backfill');
  if (input.ultraShallowMeaningfulDownUpRescueApplied) {
    out.push('ultra_shallow_meaningful_down_up_rescue');
  }
  if (input.eventCyclePromoted) out.push('event_cycle_promotion');
  return out;
}

function deriveSquatCompletionAssistMode(sources: SquatCompletionAssistSource[]): SquatCompletionAssistMode {
  if (sources.length === 0) return 'none';
  const uniq = [...new Set(sources)];
  if (uniq.length === 1) {
    const u = uniq[0]!;
    if (u === 'hmm_blocked_reason') return 'hmm_segmentation';
    if (u === 'hmm_reversal') return 'hmm_reversal';
    if (u === 'trajectory_reversal_rescue') return 'reversal_trajectory';
    if (u === 'standing_tail_backfill') return 'reversal_tail';
    if (u === 'ultra_shallow_meaningful_down_up_rescue') return 'reversal_ultra_shallow_down_up';
    if (u === 'event_cycle_promotion') return 'event_promotion';
  }
  return 'mixed';
}

export function deriveSquatCompletionFinalizeMode(input: {
  completionSatisfied: boolean;
  eventCyclePromoted: boolean;
  assistSourcesWithoutPromotion: SquatCompletionAssistSource[];
  /** PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04 */
  officialShallowAuthoritativeClosure?: boolean;
}): SquatCompletionFinalizeMode {
  if (!input.completionSatisfied) return 'blocked';
  if (input.officialShallowAuthoritativeClosure === true) return 'official_shallow_finalized';
  if (input.eventCyclePromoted) return 'event_promoted_finalized';
  if (input.assistSourcesWithoutPromotion.length === 0) return 'rule_finalized';
  return 'assist_augmented_finalized';
}

function deriveSquatReversalEvidenceProvenance(input: {
  officialShallowStreamBridgeApplied?: boolean;
  trajectoryReversalRescueApplied: boolean;
  reversalTailBackfillApplied: boolean;
  ultraShallowMeaningfulDownUpRescueApplied: boolean;
  hmmReversalAssistApplied: boolean;
  revConfReversalConfirmed: boolean;
  revConfSource: 'rule' | 'rule_plus_hmm' | 'none';
}): SquatReversalEvidenceProvenance | null {
  if (input.officialShallowStreamBridgeApplied === true) return 'official_shallow_stream_bridge';
  if (input.trajectoryReversalRescueApplied) return 'trajectory_anchor_rescue';
  if (input.reversalTailBackfillApplied) return 'standing_tail_backfill';
  if (input.ultraShallowMeaningfulDownUpRescueApplied) {
    return 'ultra_shallow_meaningful_down_up_rescue';
  }
  if (input.hmmReversalAssistApplied) return 'hmm_reversal_assist';
  if (input.revConfReversalConfirmed && input.revConfSource === 'rule_plus_hmm') {
    return 'rule_plus_hmm_detection';
  }
  if (input.revConfReversalConfirmed) return 'strict_rule';
  return null;
}

/** PR-04E3B: depthRows 빌드 — freeze 루프·core 공통 */
type SquatCompletionDepthRow = {
  index: number;
  depthPrimary: number;
  depthCompletion: number;
  timestampMs: number;
  phaseHint: PoseFeaturesFrame['phaseHint'];
};

export function buildSquatCompletionDepthRows(validFrames: PoseFeaturesFrame[]): SquatCompletionDepthRow[] {
  const depthRows: SquatCompletionDepthRow[] = [];
  for (let vi = 0; vi < validFrames.length; vi++) {
    const frame = validFrames[vi]!;
    const p = frame.derived.squatDepthProxy;
    if (typeof p !== 'number' || !Number.isFinite(p)) continue;
    const cRead = readSquatCompletionDepthForReversal(frame);
    const depthCompletion = cRead != null && Number.isFinite(cRead) ? cRead : p;
    depthRows.push({
      index: vi,
      depthPrimary: p,
      depthCompletion,
      timestampMs: frame.timestampMs,
      phaseHint: frame.phaseHint,
    });
  }
  return depthRows;
}

export const BASELINE_WINDOW = 6;
export const MIN_BASELINE_FRAMES = 4;
const LEGACY_ATTEMPT_FLOOR = 0.02;
const GUARDED_ULTRA_LOW_ROM_FLOOR = 0.01;

/**
 * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Branch B implementation.
 *
 * Frozen parameters for the 4th `effectiveDescentStartFrame` candidate family
 * `legitimateKinematicShallowDescentOnsetFrame`. These are the one-shot values
 * picked from the design SSOT §4.4 admissible band and are NOT tuning knobs.
 * Any further movement outside the band requires a new superseding design SSOT
 * per design SSOT §9 item 1 (threshold relaxation prohibition).
 *
 * Chosen within-band values (frozen):
 *   - KNEE_DESCENT_ONSET_EPSILON_DEG   = 5.0  (band [3.0, 7.0])
 *       Matches the representative synthetic shallow fixture's 170°→165° onset
 *       transition exactly while staying ≥ 10× the pose-feature angular noise
 *       floor. Neither extreme of the band is chosen — the midpoint preserves
 *       the synthetic frame-8 anchor without admitting single-frame jitter.
 *   - KNEE_DESCENT_ONSET_SUSTAIN_FRAMES = 2   (band [2, 3])
 *       Minimum sustain = 160 ms at 80 ms step. This rejects single-frame
 *       spikes (`no_real_descent` family) while remaining short enough to fire
 *       on legitimate shallow reps that bottom within ≈ 400 ms of onset.
 */
const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_LABEL_FLOOR = 0.1;
/**
 * PR-CAM-22: standard owner는 evidence label보다 더 깊은 성공에만 부여한다.
 *
 * evidenceLabel 은 interpretation/quality 범주라 0.10부터 broad하게 standard를 허용하지만,
 * pass owner는 더 보수적으로 잡아 observed shallow/moderate success(relativeDepthPeak ~0.30)가
 * standard_cycle을 너무 일찍 먹지 않게 한다.
 */
export const STANDARD_OWNER_FLOOR = 0.4;
const STANDING_RECOVERY_TOLERANCE_FLOOR = 0.015;
const STANDING_RECOVERY_TOLERANCE_RATIO = 0.18;

/**
 * CAM-OBS: standing recovery 윈도우와 동일한 상대 임계(관측·JSON 전용, 판정 로직 미사용).
 * `getStandingRecoveryWindow` 내부 산식과 정합 유지.
 */
export function getSquatStandingRecoveryThresholdForObservability(relativeDepthPeak: number): number {
  return Math.max(
    STANDING_RECOVERY_TOLERANCE_FLOOR,
    relativeDepthPeak * STANDING_RECOVERY_TOLERANCE_RATIO
  );
}
const MIN_STANDING_RECOVERY_FRAMES = 2;
const MIN_STANDING_RECOVERY_HOLD_MS = 160;
const LOW_ROM_STANDING_RECOVERY_MIN_FRAMES = 2;
const LOW_ROM_STANDING_RECOVERY_MIN_HOLD_MS = 60;
const LOW_ROM_STANDING_FINALIZE_MIN_RETURN_CONTINUITY_FRAMES = 3;
const LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO = 0.45;
/** PR-CAM-02: 절대 최소 되돌림(미세 노이즈 역전 차단) */
export const REVERSAL_DROP_MIN_ABS = 0.007;
/** PR-CAM-02: 상대 피크 대비 최소 되돌림 비율 — 깊은 스쿼트에서 0.005만으로 조기 역전 되는 것 방지 */
const REVERSAL_DROP_MIN_FRAC_OF_REL_PEAK = 0.13;
/**
 * PR-CAM-02: relativeDepthPeak < 이 값이면 하강→피크 최소 시간 요구(스파이크/미세 딥 차단).
 * 저ROM 유효 사이클은 유지하되 너무 짧은 excursion은 거부.
 */
const LOW_ROM_TIMING_PEAK_MAX = 0.1;
const MIN_DESCENT_TO_PEAK_MS_LOW_ROM = 200;
const RELAXED_MIN_DESCENT_TO_PEAK_MS_LOW_ROM = 120;
/**
 * PR-CAM-02: 얕은 ROM에서 피크(역전 시점) 이후 서 있기까지 최소 시간 — 미드 라이즈 조기 pass 완화.
 */
const SHALLOW_REVERSAL_TIMING_PEAK_MAX = 0.11;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;
const RELAXED_MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 140;
const RELAXED_LOW_ROM_MIN_CONTINUITY_FRAMES = 4;
const RELAXED_LOW_ROM_MIN_DROP_RATIO = 0.45;
/**
 * PR-04E3A: 이 이상이면 primary relative 를 completion truth 로 유지 (깊은 스쿼트·표준 경로 primary 의미 보존).
 * 그 미만에서 blended 가 시도 플로어를 넘기면 blended 스트림으로 정렬.
 */
const COMPLETION_PRIMARY_DOMINANT_REL_PEAK = 0.12;

/**
 * PR-C: low_ROM finalize와 동일한 “복귀 증거” — ultra_low_rom 에서만 짧은 standing hold(60ms)를 허용할 때 사용.
 * pose-features `getSquatRecoverySignal` 과 같은 continuity/drop 기준으로 shallow 오탐 없이 false negative만 줄인다.
 */
export function recoveryMeetsLowRomStyleFinalizeProof(
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>
): boolean {
  return (
    (recovery.recoveryReturnContinuityFrames ?? 0) >= LOW_ROM_STANDING_FINALIZE_MIN_RETURN_CONTINUITY_FRAMES &&
    (recovery.recoveryDropRatio ?? 0) >= LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO
  );
}

/**
 * PR-SQUAT-ULTRA-LOW-DOWNUP-TIMING-BYPASS-01:
 * ultra-low ROM 에서 "유의미한 down-up cycle"이 이미 완전히 입증된 경우
 * `descent_span_too_short` timing gate 를 조건부 우회한다.
 *
 * 발동 조건 (ALL 필수):
 *   1. relativeDepthPeak < LOW_ROM_LABEL_FLOOR  (ultra_low_rom 대역 < 0.07)
 *   2. evidenceLabel === 'ultra_low_rom'
 *   3. officialShallowPathCandidate === true
 *   4. attemptStarted === true
 *   5. descendConfirmed === true
 *   6. reversalFrameExists === true   (rf != null — 이미 상위 체크에서 보장)
 *   7. ascendForProgression === true  (asc — 이미 상위 체크에서 보장)
 *   8. standingRecoveredAtMs != null  (이미 상위 체크에서 보장)
 *   9. standingRecoveryFinalizeSatisfied === true (이미 상위 체크에서 보장)
 *  10. recoveryMeetsLowRomStyleFinalizeProof(...)  (continuity + drop proof)
 *
 * 새 threshold 없음 — 기존 signal·helper 만 재사용.
 * 이 함수는 standalone 이므로 상위에서 이미 보장된 조건도 재검사한다.
 */
export function shouldBypassUltraLowRomShortDescentTiming(params: {
  relativeDepthPeak: number;
  evidenceLabel: SquatEvidenceLabel;
  officialShallowPathCandidate: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  reversalFrameExists: boolean;
  ascendForProgression: boolean;
  standingRecoveredAtMs: number | null | undefined;
  standingRecoveryFinalizeSatisfied: boolean;
  recoveryReturnContinuityFrames: number | null | undefined;
  recoveryDropRatio: number | null | undefined;
}): boolean {
  if (params.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR) return false;
  if (params.evidenceLabel !== 'ultra_low_rom') return false;
  if (!params.officialShallowPathCandidate) return false;
  if (!params.attemptStarted) return false;
  if (!params.descendConfirmed) return false;
  if (!params.reversalFrameExists) return false;
  if (!params.ascendForProgression) return false;
  if (params.standingRecoveredAtMs == null) return false;
  if (!params.standingRecoveryFinalizeSatisfied) return false;
  if (
    !recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: params.recoveryReturnContinuityFrames ?? undefined,
      recoveryDropRatio: params.recoveryDropRatio ?? undefined,
    })
  ) return false;
  return true;
}

/**
 * PR-CAM-ASCENT-INTEGRITY-RESCUE-01: trajectory rescue는 reversal 앵커만 줄 수 있고, ascent truth 는
 * 명시 상승 증거 또는 (finalize + low-ROM 복귀 증거 + 역전→스탠딩 타이밍)을 만족할 때만 true.
 * 새 threshold 없음 — `recoveryMeetsLowRomStyleFinalizeProof` 및 호출부 `minReversalToStandingMs` 재사용.
 *
 * PR-SQUAT-ULTRA-LOW-FINAL-GATE-03: shallow return proof(bundle/bridge/drop)는 ascent integrity 에
 * 강제하지 않는다 — 얕은 legitimate trajectory rescue 복구. too-early FP 는 auto-progression UI gate 에서만 차단.
 */
export type TrajectoryRescueAscentIntegrityArgs = {
  explicitAscendConfirmed: boolean;
  standingRecoveredAtMs?: number;
  standingRecoveryFinalizeSatisfied: boolean;
  recoveryReturnContinuityFrames?: number;
  recoveryDropRatio?: number;
  reversalAtMs?: number;
  minReversalToStandingMs: number;
};

export function trajectoryRescueMeetsAscentIntegrity(args: TrajectoryRescueAscentIntegrityArgs): boolean {
  if (args.explicitAscendConfirmed === true) return true;
  if (args.standingRecoveredAtMs == null) return false;
  if (args.standingRecoveryFinalizeSatisfied !== true) return false;
  if (
    !recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: args.recoveryReturnContinuityFrames,
      recoveryDropRatio: args.recoveryDropRatio,
    })
  ) {
    return false;
  }
  if (args.reversalAtMs == null) return false;
  if (args.standingRecoveredAtMs <= args.reversalAtMs) return false;
  if (
    args.standingRecoveredAtMs - args.reversalAtMs <
    args.minReversalToStandingMs
  ) {
    return false;
  }
  return true;
}

export type SquatDepthFrameLite = {
  index: number;
  depth: number;
  timestampMs: number;
  phaseHint: PoseFeaturesFrame['phaseHint'];
};

/**
 * PR-07: 가드 shallow trajectory 브리지 전용 — 글로벌 peak 앵커(시리즈 시작 오염)와 별개의 **국소** 피크.
 * 딥/표준 경로·글로벌 피크 잠금 로직을 대체하지 않는다.
 */
export type GuardedShallowLocalPeakAnchor = {
  found: boolean;
  blockedReason: string | null;
  localPeakIndex: number | null;
  localPeakAtMs: number | null;
  localPeakFrame: SquatDepthFrameLite | null;
};

/**
 * PR-07: shallow 입장·실하강·commitment 이후 admitted 윈도우에서만 국소 피크를 찾는다.
 * 기존 depthRows/phaseHint·finalize continuity·되돌림 스케일만 재사용한다.
 */
export function getGuardedShallowLocalPeakAnchor(args: {
  state: SquatCompletionState;
  validFrames: PoseFeaturesFrame[];
}): GuardedShallowLocalPeakAnchor {
  const s = args.state;
  const nil = (blockedReason: string | null): GuardedShallowLocalPeakAnchor => ({
    found: false,
    blockedReason,
    localPeakIndex: null,
    localPeakAtMs: null,
    localPeakFrame: null,
  });

  if (!s.officialShallowPathCandidate || !s.officialShallowPathAdmitted) return nil(null);
  if (!s.attemptStarted || !s.descendConfirmed || !s.downwardCommitmentReached) return nil(null);

  const depthRows = buildSquatCompletionDepthRows(args.validFrames);
  if (depthRows.length < 5) return nil('series_too_short');

  const src = s.relativeDepthPeakSource ?? 'primary';
  const baselineStandingDepth = s.baselineStandingDepth ?? 0;
  const depthFrames: SquatDepthFrameLite[] = depthRows.map((r) => ({
    index: r.index,
    depth: src === 'blended' ? r.depthCompletion : r.depthPrimary,
    timestampMs: r.timestampMs,
    phaseHint: r.phaseHint,
  }));

  const relativeDepthPeak = s.relativeDepthPeak ?? 0;
  const recoverySig = getSquatRecoverySignal(args.validFrames);
  const guardedUltraLowAttemptEligible =
    relativeDepthPeak >= GUARDED_ULTRA_LOW_ROM_FLOOR &&
    relativeDepthPeak < LEGACY_ATTEMPT_FLOOR &&
    recoverySig.ultraLowRomGuardedRecovered === true;
  const attemptAdmissionSatisfied =
    relativeDepthPeak >= LEGACY_ATTEMPT_FLOOR || guardedUltraLowAttemptEligible;
  const attemptAdmissionFloor = guardedUltraLowAttemptEligible
    ? GUARDED_ULTRA_LOW_ROM_FLOOR
    : LEGACY_ATTEMPT_FLOOR;

  if (!attemptAdmissionSatisfied) return nil('no_committed_admitted_window');

  const descentFrame = depthFrames.find((frame) => frame.phaseHint === 'descent');
  const bottomFrame = depthFrames.find((frame) => frame.phaseHint === 'bottom');

  const committedFrame =
    bottomFrame ??
    depthFrames.find(
      (frame) =>
        frame.index >= (descentFrame?.index ?? 0) &&
        frame.depth - baselineStandingDepth >= attemptAdmissionFloor
    );

  if (committedFrame == null) return nil('no_committed_admitted_window');

  const fr0 = s.standingRecoveryFinalizeReason;
  const recoveryContinuityOk =
    fr0 === 'standing_hold_met' ||
    recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
      recoveryDropRatio: s.recoveryDropRatio,
    });
  if (!recoveryContinuityOk) return nil('no_recovery_continuity');

  const windowStart = Math.max(1, committedFrame.index);
  const n = depthFrames.length;
  const depths = depthFrames.map((f) => f.depth);
  if (windowStart > n - 2) return nil('no_committed_admitted_window');

  const localMaxima: number[] = [];
  for (let i = windowStart; i <= n - 2; i++) {
    const d = depths[i]!;
    const left = depths[i - 1]!;
    const right = depths[i + 1]!;
    if (d >= left && d >= right) localMaxima.push(i);
  }

  let bestIdx: number;
  if (localMaxima.length > 0) {
    bestIdx = localMaxima[0]!;
    for (const idx of localMaxima) {
      const di = depths[idx]!;
      const db = depths[bestIdx]!;
      if (di > db + 1e-9 || (Math.abs(di - db) <= 1e-9 && idx > bestIdx)) bestIdx = idx;
    }
  } else {
    bestIdx = windowStart;
    for (let i = windowStart + 1; i <= n - 2; i++) {
      if (depths[i]! > depths[bestIdx]!) bestIdx = i;
    }
  }

  if (bestIdx <= 0) return nil('peak_anchor_series_start_only');

  const peakFrame = depthFrames[bestIdx]!;
  const relAtPeak = peakFrame.depth - baselineStandingDepth;
  if (relAtPeak < attemptAdmissionFloor * 0.85) return nil('insufficient_local_peak_depth');

  const plateauTol = 0.004;
  let nearPeakCount = 0;
  for (let j = 0; j < n; j++) {
    if (depths[j]! >= peakFrame.depth - plateauTol) nearPeakCount++;
  }
  if (nearPeakCount < 2) return nil('one_frame_spike');

  const postPeak = depthFrames.filter((f) => f.index > bestIdx);
  if (postPeak.length < 3) return nil('no_post_peak_return');

  const minPost = Math.min(...postPeak.map((f) => f.depth));
  const drop = peakFrame.depth - minPost;
  const req = s.squatReversalDropRequired ?? REVERSAL_DROP_MIN_ABS;
  const minDropBridge = Math.max(REVERSAL_DROP_MIN_ABS, req * 0.88) - 1e-12;
  if (drop < minDropBridge) return nil('no_post_peak_return');

  const standingTol = getSquatStandingRecoveryThresholdForObservability(relativeDepthPeak);
  if (minPost > baselineStandingDepth + standingTol) return nil('static_crouch_or_seated_hold');

  const prePeak = depthFrames.filter((f) => f.index < bestIdx && f.index >= windowStart);
  const minPre =
    prePeak.length > 0 ? Math.min(...prePeak.map((f) => f.depth)) : baselineStandingDepth;
  if (minPre >= peakFrame.depth - 1e-6) return nil('no_descent_into_peak');

  return {
    found: true,
    blockedReason: null,
    localPeakIndex: peakFrame.index,
    localPeakAtMs: peakFrame.timestampMs,
    localPeakFrame: peakFrame,
  };
}

export type GuardedTrajectoryShallowBridgeOpts = {
  setupMotionBlocked?: boolean;
  /** PR-07: 글로벌 앵커 오염 시 브리지 전용 국소 피크 정규화 */
  guardedShallowLocalPeakAnchor?: GuardedShallowLocalPeakAnchor;
};

/**
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract C: shallow closure 번들(스트림·primary 폴백).
 * admission/reversal 판정 없음 — orchestrator 가 A/B 결과만 넘긴다.
 */
export function computeOfficialShallowClosure(params: {
  officialShallowPathCandidate: boolean;
  attemptStarted: boolean;
  hasValidCommittedPeakAnchor: boolean;
  committedOrPostCommitPeakFrame: SquatDepthFrameLite | undefined;
  standingRecoveryFinalizeBand: SquatEvidenceLabel;
  standingRecoveryFinalizeSatisfied: boolean;
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>;
  depthFrames: SquatDepthFrameLite[];
  relativeDepthPeak: number;
  qualifiesForRelaxedLowRomTiming: boolean;
  squatReversalDropAchieved: number;
  squatReversalDropRequired: number;
}): {
  shallowClosureProofBundleFromStream: boolean;
  officialShallowProofCompletionReturnDrop: number | null;
  officialShallowPrimaryDropClosureFallback: boolean;
} {
  let officialShallowProofCompletionReturnDrop: number | null = null;
  let shallowClosureProofBundleFromStream = false;
  if (
    params.officialShallowPathCandidate &&
    params.attemptStarted &&
    params.hasValidCommittedPeakAnchor &&
    params.committedOrPostCommitPeakFrame != null &&
    isOfficialShallowRomFinalizeBand(params.standingRecoveryFinalizeBand) &&
    params.standingRecoveryFinalizeSatisfied
    // PR-E1C: recoveryMeetsLowRomStyleFinalizeProof 조건 제거.
    // getStandingRecoveryFinalizeGate는 evidenceLabel === 'low_rom' 또는 ultraLowRomUsesGuardedFinalize 일 때만
    // recovery continuity/drop ratio를 검증하고 finalizeSatisfied에 반영한다.
    // evidenceLabel === 'standard' (relativeDepthPeak 0.10~0.39) 구간은 finalize gate가
    // frame+hold만 확인하므로 recoveryMeetsLowRomStyleFinalizeProof가 false여도 finalizeSatisfied = true.
    // 이 불일치로 stream bundle이 항상 차단되어 no_reversal false-negative가 발생했다.
    // standingRecoveryFinalizeSatisfied가 finalize gate의 전체 판정을 이미 포함하므로 여기서 중복 확인하지 않는다.
    // 오탐 방지는 아래 post-peak drop 검사 + stream bridge ascent 검사 + canonical anti-false-pass가 담당.
  ) {
    const anchor = params.committedOrPostCommitPeakFrame;
    const postPeak = params.depthFrames.filter((f) => f.index > anchor.index);
    const minPostPeakFramesForShallowClosure =
      params.officialShallowPathCandidate &&
      params.relativeDepthPeak < STANDARD_OWNER_FLOOR &&
      params.qualifiesForRelaxedLowRomTiming &&
      recoveryMeetsLowRomStyleFinalizeProof(params.recovery)
        ? 2
        : 3;
    if (postPeak.length >= minPostPeakFramesForShallowClosure) {
      const minPost = Math.min(...postPeak.map((f) => f.depth));
      const drop = anchor.depth - minPost;
      officialShallowProofCompletionReturnDrop = drop;
      const shallowStreamReq = Math.max(
        REVERSAL_DROP_MIN_ABS,
        params.squatReversalDropRequired * 0.88
      );
      if (drop >= shallowStreamReq) {
        shallowClosureProofBundleFromStream = true;
      }
    }
  }
  let officialShallowPrimaryDropClosureFallback = false;
  if (
    !shallowClosureProofBundleFromStream &&
    params.officialShallowPathCandidate &&
    params.relativeDepthPeak < STANDARD_OWNER_FLOOR &&
    params.attemptStarted &&
    params.hasValidCommittedPeakAnchor &&
    params.committedOrPostCommitPeakFrame != null &&
    isOfficialShallowRomFinalizeBand(params.standingRecoveryFinalizeBand) &&
    params.standingRecoveryFinalizeSatisfied &&
    recoveryMeetsLowRomStyleFinalizeProof(params.recovery) &&
    params.qualifiesForRelaxedLowRomTiming &&
    params.squatReversalDropAchieved >=
      Math.max(REVERSAL_DROP_MIN_ABS, params.squatReversalDropRequired * 0.88)
  ) {
    shallowClosureProofBundleFromStream = true;
    officialShallowPrimaryDropClosureFallback = true;
    officialShallowProofCompletionReturnDrop = params.squatReversalDropAchieved;
  }
  return {
    shallowClosureProofBundleFromStream,
    officialShallowProofCompletionReturnDrop,
    officialShallowPrimaryDropClosureFallback,
  };
}

/**
 * PR-CAM-PEAK-ANCHOR-INTEGRITY-01: 전역 depth 최대(peakFrame)가 commitment 이전이면 reversal 앵커로 쓰면 안 됨.
 * commitment 이후(포함) 구간에서만 최대 depth 프레임을 반환한다.
 */
function findCommittedOrPostCommitPeakFrame(
  depthFrames: SquatDepthFrameLite[],
  committedFrame: SquatDepthFrameLite | undefined
): SquatDepthFrameLite | undefined {
  if (committedFrame == null) return undefined;
  const subset = depthFrames.filter((f) => f.index >= committedFrame.index);
  if (subset.length === 0) return undefined;
  return subset.reduce((best, frame) => (frame.depth > best.depth ? frame : best));
}

/**
 * PR-CAM-31: 명시 역전(reversalFrame)이 없을 때만, finalize·복귀 증거가 이미 잠긴 shallow/블렌드 궤적에 한해
 * 피크를 역전 앵커로 승격한다. 임계·recovery 윈도·finalize 게이트 수치는 변경하지 않는다.
 */
function getGuardedTrajectoryReversalRescue(args: {
  reversalFrame: SquatDepthFrameLite | undefined;
  committedFrame: SquatDepthFrameLite | undefined;
  attemptStarted: boolean;
  downwardCommitmentReached: boolean;
  standingRecoveryFinalizeReason: string | null;
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>;
  peakFrame: SquatDepthFrameLite;
  /** PR-CAM-PEAK-ANCHOR-INTEGRITY-01: trajectory 승격 앵커는 commitment-safe 피크만 */
  committedOrPostCommitPeakFrame?: SquatDepthFrameLite;
}): {
  trajectoryReversalFrame: SquatDepthFrameLite | undefined;
  trajectoryReversalConfirmedBy: 'trajectory' | null;
} {
  if (args.reversalFrame != null) {
    return {
      trajectoryReversalFrame: args.reversalFrame,
      trajectoryReversalConfirmedBy: null,
    };
  }
  const fr = args.standingRecoveryFinalizeReason;
  const finalizeOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize';
  /**
   * PR-DOWNUP-GUARANTEE-03: low/ultra guarded finalize 는 이미 return continuity·drop ratio 를 통과했으므로
   * 여기서 동일 헬퍼를 이중 요구해 no_reversal 에 남는 틈을 막는다. standing_hold_met 만 별도 증명 유지.
   */
  const recoveryOkForTrajectory =
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    recoveryMeetsLowRomStyleFinalizeProof(args.recovery);
  if (
    args.committedFrame != null &&
    args.attemptStarted &&
    args.downwardCommitmentReached &&
    finalizeOk &&
    recoveryOkForTrajectory &&
    args.committedOrPostCommitPeakFrame != null
  ) {
    return {
      trajectoryReversalFrame: args.committedOrPostCommitPeakFrame,
      trajectoryReversalConfirmedBy: 'trajectory',
    };
  }
  return {
    trajectoryReversalFrame: undefined,
    trajectoryReversalConfirmedBy: null,
  };
}

/**
 * PR-CAM-REVERSAL-TAIL-BACKFILL-01: 명시 역전이 없고 trajectory rescue도 못 열 때만,
 * 서 있기 tail 복귀·되돌림·연속성·타이밍 증거로 역전 앵커를 peak에 backfill한다.
 * finalize 충족 여부는 backfill 게이트에 쓰지 않음 — `no_reversal` 정체 완화용.
 */
export function getGuardedStandingTailReversalBackfill(args: {
  reversalFrame: SquatDepthFrameLite | undefined;
  committedFrame: SquatDepthFrameLite | undefined;
  committedOrPostCommitPeakFrame?: SquatDepthFrameLite;
  attemptStarted: boolean;
  downwardCommitmentReached: boolean;
  standingRecoveredAtMs?: number;
  /** backfill 판단에 사용하지 않음 — 시그니처만 유지 */
  standingRecoveryFinalizeReason: string | null;
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>;
  squatReversalDropRequired: number;
  squatReversalDropAchieved: number;
  minReversalToStandingMsForShallow: number;
}): {
  backfilledReversalFrame: SquatDepthFrameLite | undefined;
  backfillApplied: boolean;
} {
  void args.standingRecoveryFinalizeReason;
  if (args.reversalFrame != null) {
    return { backfilledReversalFrame: args.reversalFrame, backfillApplied: false };
  }
  if (
    args.committedFrame == null ||
    args.committedOrPostCommitPeakFrame == null ||
    args.attemptStarted !== true ||
    args.downwardCommitmentReached !== true ||
    args.standingRecoveredAtMs == null
  ) {
    return { backfilledReversalFrame: undefined, backfillApplied: false };
  }
  /** `0.9 * required` 부동소수 오차로 achieved==경계값이 거부되지 않게 1 ulp 여유 */
  const minDropForTail = args.squatReversalDropRequired * 0.9 - 1e-12;
  if (args.squatReversalDropAchieved < minDropForTail) {
    return { backfilledReversalFrame: undefined, backfillApplied: false };
  }
  if ((args.recovery.recoveryReturnContinuityFrames ?? 0) < 2) {
    return { backfilledReversalFrame: undefined, backfillApplied: false };
  }
  const peakTs = args.committedOrPostCommitPeakFrame.timestampMs;
  if (
    args.standingRecoveredAtMs - peakTs <
    args.minReversalToStandingMsForShallow
  ) {
    return { backfilledReversalFrame: undefined, backfillApplied: false };
  }
  return {
    backfilledReversalFrame: args.committedOrPostCommitPeakFrame,
    backfillApplied: true,
  };
}

/**
 * PR-DOWNUP-GUARANTEE-03: 공식 shallow closure 번들(스트림·primary 폴백)이 아직 없고 strict 역전도 없을 때,
 * ultra-low 에서 guarded finalize + primary 되돌림(0.88×요구)이 성립하면 progression 역전 앵커를 연다.
 * (standing/jitter: admission·finalize·drop 바닥 없으면 발동 안 함)
 */
function shouldApplyUltraShallowMeaningfulDownUpRescue(p: {
  progressionReversalFrame: SquatDepthFrameLite | undefined;
  officialShallowPathCandidate: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  downwardCommitmentReached: boolean;
  evidenceLabel: SquatEvidenceLabel;
  revConfReversalConfirmed: boolean;
  hmmReversalAssistApplied: boolean;
  shallowClosureProofBundleFromStream: boolean;
  hasValidCommittedPeakAnchor: boolean;
  committedOrPostCommitPeakFrame: SquatDepthFrameLite | undefined | null;
  committedFrame: SquatDepthFrameLite | null | undefined;
  standingRecoveredAtMs: number | undefined;
  standingRecoveryFinalizeSatisfied: boolean;
  standingRecoveryFinalizeReason: string | null;
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>;
  squatReversalDropAchieved: number;
  squatReversalDropRequired: number;
}): boolean {
  if (p.progressionReversalFrame != null) return false;
  if (
    !p.officialShallowPathCandidate ||
    !p.attemptStarted ||
    !p.descendConfirmed ||
    !p.downwardCommitmentReached
  ) {
    return false;
  }
  if (p.evidenceLabel !== 'ultra_low_rom') return false;
  if (p.revConfReversalConfirmed || p.hmmReversalAssistApplied) return false;
  if (
    !p.hasValidCommittedPeakAnchor ||
    p.committedOrPostCommitPeakFrame == null ||
    p.committedFrame == null
  ) {
    return false;
  }
  if (p.standingRecoveredAtMs == null || !p.standingRecoveryFinalizeSatisfied) return false;
  const fr = p.standingRecoveryFinalizeReason;
  const finalizeOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize';
  if (!finalizeOk) return false;
  const recoveryOk =
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    recoveryMeetsLowRomStyleFinalizeProof(p.recovery);
  if (!recoveryOk) return false;
  const minDrop = Math.max(REVERSAL_DROP_MIN_ABS, p.squatReversalDropRequired * 0.88) - 1e-12;
  if (p.squatReversalDropAchieved < minDrop) return false;
  if (p.shallowClosureProofBundleFromStream) return false;
  return true;
}

function getStandingRecoveryWindow(
  frames: Array<{ index: number; depth: number; timestampMs: number }>,
  baselineStandingDepth: number,
  relativeDepthPeak: number
): {
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs: number;
  standingRecoveryFrameCount: number;
  standingRecoveryThreshold: number;
} {
  if (frames.length === 0) {
    return {
      standingRecoveryHoldMs: 0,
      standingRecoveryFrameCount: 0,
      standingRecoveryThreshold: STANDING_RECOVERY_TOLERANCE_FLOOR,
    };
  }

  const standingRecoveryThreshold = Math.max(
    STANDING_RECOVERY_TOLERANCE_FLOOR,
    relativeDepthPeak * STANDING_RECOVERY_TOLERANCE_RATIO
  );

  let standingRecoveryFrameCount = 0;
  let standingRecoveredIndex = -1;

  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const relativeDepth = Math.max(0, frames[i]!.depth - baselineStandingDepth);
    if (relativeDepth <= standingRecoveryThreshold) {
      standingRecoveryFrameCount += 1;
      standingRecoveredIndex = i;
    } else {
      break;
    }
  }

  if (standingRecoveredIndex < 0) {
    return {
      standingRecoveryHoldMs: 0,
      standingRecoveryFrameCount,
      standingRecoveryThreshold,
    };
  }

  const standingRecoveredAtMs = frames[standingRecoveredIndex]!.timestampMs;
  const standingRecoveryHoldMs =
    frames[frames.length - 1]!.timestampMs - standingRecoveredAtMs;

  return {
    standingRecoveredAtMs,
    standingRecoveryHoldMs,
    standingRecoveryFrameCount,
    standingRecoveryThreshold,
  };
}

/**
 * PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03:
 * 피크 이후 tail 에서 **끝 프레임까지** 이어지는 standing 밴드 접미사 안에서,
 * `minFrames`·`minHoldMs` 를 만족하는 **가장 짧은** 구간(가장 늦은 시작 인덱스)을 찾는다.
 * 누적 체류(ms)를 줄여 JSON 이 “필요 홀드”를 과대 해석하지 않게 한다(임계 상수 불변).
 */
function computeMinimalQualifyingStandingTailHold(
  frames: Array<{ depth: number; timestampMs: number }>,
  baselineStandingDepth: number,
  relativeDepthPeak: number,
  minFrames: number,
  minHoldMs: number
): { holdMs: number; frameCount: number; recoveredAtMs: number } | null {
  if (frames.length === 0 || minFrames < 1 || minHoldMs < 0) return null;

  const standingRecoveryThreshold = Math.max(
    STANDING_RECOVERY_TOLERANCE_FLOOR,
    relativeDepthPeak * STANDING_RECOVERY_TOLERANCE_RATIO
  );

  let suffixStart = frames.length;
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const relativeDepth = Math.max(0, frames[i]!.depth - baselineStandingDepth);
    if (relativeDepth <= standingRecoveryThreshold) {
      suffixStart = i;
    } else {
      break;
    }
  }

  if (suffixStart >= frames.length) return null;

  const end = frames.length - 1;
  const tEnd = frames[end]!.timestampMs;

  for (let s = end - minFrames + 1; s >= suffixStart; s -= 1) {
    if (s < 0) break;
    const span = end - s + 1;
    if (span < minFrames) continue;
    const tS = frames[s]!.timestampMs;
    if (tEnd - tS >= minHoldMs) {
      return {
        holdMs: tEnd - tS,
        frameCount: span,
        recoveredAtMs: tS,
      };
    }
  }

  return null;
}

function getSquatEvidenceLabel(
  relativeDepthPeak: number,
  attemptAdmissionSatisfied: boolean
): SquatEvidenceLabel {
  if (relativeDepthPeak >= STANDARD_LABEL_FLOOR) return 'standard';
  if (relativeDepthPeak >= LOW_ROM_LABEL_FLOOR) return 'low_rom';
  if (attemptAdmissionSatisfied) return 'ultra_low_rom';
  return 'insufficient_signal';
}

/**
 * PR-7-CORRECTED: ultra-low ROM core direct close 최소 무결성 계약.
 *
 * stream bridge / ascent-equivalent / closure proof 신호는 보조 역할만 한다.
 * 이 함수가 false 를 반환하면 `ultra_low_rom_cycle` 직접 close 는 열리지 않는다.
 *
 * 두 조건이 모두 필요하다:
 *   1. hasValidCommittedPeakAnchor: baseline frozen + peak latched → fresh cycle 앵커
 *   2. reversalConfirmedByRuleOrHmm: rule/HMM 기반 역전 (officialShallowStreamBridgeApplied 제외)
 *
 * 이 함수가 false 를 반환하는 케이스:
 *   - pre-attempt / not_armed / freeze_or_latch_missing 이력 있는 ultra-low
 *   - stream-bridge-only ultra-low (officialShallowStreamBridgeApplied 만 존재)
 *   - eventCycleDetected=false + weak descent ultra-low
 *   - baseline/latch 없는 반복 stale-like shallow ultra-low
 */
export function isUltraLowRomDirectCloseEligible(params: {
  /** committedFrame + committedOrPostCommitPeakFrame 기반 fresh cycle anchor 존재 여부 */
  hasValidCommittedPeakAnchor: boolean;
  /** revConf.reversalConfirmed || hmmReversalAssistApplied — officialShallowStreamBridgeApplied 제외 */
  reversalConfirmedByRuleOrHmm: boolean;
}): boolean {
  return params.hasValidCommittedPeakAnchor === true && params.reversalConfirmedByRuleOrHmm === true;
}

/**
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract C: `completionPassReason` 단일 결정점.
 * (1) blocked → not_confirmed
 * (2) standard owner 대역 + 비이벤트 descent → standard_cycle
 * (3) official shallow admission + shallow owner 대역 + closure 증거(번들/브리지/역전) → *_cycle
 * (4) evidence/owner-shallow 밴드·derive 잔여
 *
 * PR-7-CORRECTED: (3)·(4)에서 ultra_low_rom_cycle 은 ultraLowRomFreshCycleIntegrity=true 일 때만 열린다.
 * stream-bridge-only / pre-attempt / freeze-latch-missing 패턴은 not_confirmed 로 차단된다.
 */
export function resolveSquatCompletionPath(params: {
  completionBlockedReason: string | null;
  relativeDepthPeak: number;
  evidenceLabel: SquatEvidenceLabel;
  eventBasedDescentPath: boolean;
  officialShallowPathCandidate: boolean;
  officialShallowPathAdmitted: boolean;
  /** 번들·stream bridge·strict reversal·progression 앵커 등 shallow ROM 통과 증거 */
  shallowRomClosureProofSignals: boolean;
  /**
   * PR-7-CORRECTED: ultra_low_rom_cycle 직접 close 무결성 플래그.
   * = isUltraLowRomDirectCloseEligible(hasValidCommittedPeakAnchor, reversalConfirmedByRuleOrHmm).
   * false 이면 ultra_low_rom_cycle 은 열리지 않고 not_confirmed 반환.
   */
  ultraLowRomFreshCycleIntegrity: boolean;
}): SquatCompletionPassReason {
  if (params.completionBlockedReason != null) return 'not_confirmed';

  const standardPathWon =
    params.eventBasedDescentPath === false &&
    params.relativeDepthPeak >= STANDARD_OWNER_FLOOR;

  if (standardPathWon) return 'standard_cycle';

  const shallowOwnerZone = params.relativeDepthPeak < STANDARD_OWNER_FLOOR;
  const explicitShallowRomClosure =
    params.officialShallowPathCandidate === true &&
    params.officialShallowPathAdmitted === true &&
    shallowOwnerZone &&
    params.shallowRomClosureProofSignals === true;

  if (explicitShallowRomClosure) {
    if (params.evidenceLabel === 'ultra_low_rom') {
      // PR-7-CORRECTED: fresh cycle integrity 없이는 ultra_low_rom_cycle 을 열 수 없다.
      // stream-bridge-only / pre-attempt / freeze-latch-missing 패턴은 이 gate 에서 차단.
      return params.ultraLowRomFreshCycleIntegrity ? 'ultra_low_rom_cycle' : 'not_confirmed';
    }
    return 'low_rom_cycle';
  }

  const standardEvidenceOwnerShallowBand =
    params.evidenceLabel === 'standard' &&
    params.relativeDepthPeak > STANDARD_LABEL_FLOOR + 1e-9 &&
    params.relativeDepthPeak < STANDARD_OWNER_FLOOR;

  if (params.evidenceLabel === 'low_rom') return 'low_rom_cycle';
  if (params.evidenceLabel === 'ultra_low_rom') {
    // PR-7-CORRECTED: evidence-label fallback path 에서도 동일 gate 적용.
    // explicitShallowRomClosure 가 false 인데 ultra_low_rom 인 경우도 integrity 없이 열면 안 된다.
    return params.ultraLowRomFreshCycleIntegrity ? 'ultra_low_rom_cycle' : 'not_confirmed';
  }
  if (standardEvidenceOwnerShallowBand) return 'low_rom_cycle';
  return deriveSquatCompletionPassReason({
    completionSatisfied: true,
    evidenceLabel: params.evidenceLabel,
    eventBasedDescentPath: params.eventBasedDescentPath,
  });
}

/**
 * PR-SHALLOW-SQUAT-FINALIZE-BAND-01: standing recovery finalize 게이트 전용 밴드.
 *
 * evidenceLabel(STANDARD_LABEL_FLOOR=0.10 기준)과 달리 owner 기준선(STANDARD_OWNER_FLOOR=0.40)으로
 * 'standard'를 구분하므로, 0.10~0.39 구간이 standard finalize hold 대신 low_rom finalize 규칙을 탄다.
 *
 * 주의: evidenceLabel(quality/interpretation 라벨)은 이 함수로 대체되지 않는다.
 * 이 helper는 standing recovery finalize 게이트 호출에만 사용한다.
 */
function getStandingRecoveryFinalizeBand(
  relativeDepthPeak: number,
  attemptAdmissionSatisfied: boolean
): SquatEvidenceLabel {
  if (relativeDepthPeak >= STANDARD_OWNER_FLOOR) return 'standard';
  if (relativeDepthPeak >= LOW_ROM_LABEL_FLOOR) return 'low_rom';
  if (attemptAdmissionSatisfied) return 'ultra_low_rom';
  return 'insufficient_signal';
}

/** PR-03 rework: 공식 shallow 후보는 quality evidenceLabel 이 아닌 finalize ROM 밴드와 정렬 (0.22 + standard 라벨 포함). */
function isOfficialShallowRomFinalizeBand(band: SquatEvidenceLabel): boolean {
  return band === 'low_rom' || band === 'ultra_low_rom';
}

// =============================================================================
// PR-SQUAT-COMPLETION-REARCH-01 — Subcontract A: Attempt Admission Contract
// =============================================================================

/** 공통 rep 시도 게이트(무장·하강·깊이·커밋) — reversal/closure 와 분리 */
export function computeSquatAttemptAdmission(params: {
  armed: boolean;
  descendConfirmed: boolean;
  attemptAdmissionSatisfied: boolean;
  downwardCommitmentReached: boolean;
  committedFrame: SquatDepthFrameLite | undefined;
}): {
  attemptStarted: boolean;
  admissionBlockedReason: string | null;
} {
  const attemptStarted = params.descendConfirmed && params.downwardCommitmentReached;
  if (!params.armed) return { attemptStarted, admissionBlockedReason: 'not_armed' };
  if (!params.descendConfirmed) return { attemptStarted, admissionBlockedReason: 'no_descend' };
  if (!params.attemptAdmissionSatisfied) {
    return { attemptStarted, admissionBlockedReason: 'insufficient_relative_depth' };
  }
  if (!params.downwardCommitmentReached || params.committedFrame == null) {
    return { attemptStarted, admissionBlockedReason: 'no_commitment' };
  }
  return { attemptStarted, admissionBlockedReason: null };
}

export function deriveOfficialShallowCandidate(params: {
  baselineFrameCount: number;
  attemptAdmissionSatisfied: boolean;
  standingRecoveryFinalizeBand: SquatEvidenceLabel;
}): boolean {
  return (
    params.baselineFrameCount >= MIN_BASELINE_FRAMES &&
    params.attemptAdmissionSatisfied &&
    isOfficialShallowRomFinalizeBand(params.standingRecoveryFinalizeBand)
  );
}

export function deriveOfficialShallowAdmission(params: {
  officialShallowPathCandidate: boolean;
  armed: boolean;
  descendConfirmed: boolean;
  attemptStarted: boolean;
}): boolean {
  return (
    params.officialShallowPathCandidate &&
    params.armed &&
    params.descendConfirmed &&
    params.attemptStarted
  );
}

/** Subcontract A: shallow admission 전용 trace shape (closure/reversal 미포함) */
export type SquatOfficialShallowAdmissionContract = {
  candidate: boolean;
  admitted: boolean;
  reason: string | null;
  /** admission 게이트에서 막힌 경우만 — reversal/finalize 병목은 C */
  blockedReason: string | null;
};

export function resolveOfficialShallowAdmissionContract(p: {
  officialShallowPathCandidate: boolean;
  armed: boolean;
  descendConfirmed: boolean;
  attemptStarted: boolean;
  officialShallowDescentEvidenceForAdmission: boolean;
  naturalArmed: boolean;
  hmmArmingAssistApplied: boolean;
  pr03OfficialShallowArming: boolean;
}): SquatOfficialShallowAdmissionContract {
  const admitted = deriveOfficialShallowAdmission({
    officialShallowPathCandidate: p.officialShallowPathCandidate,
    armed: p.armed,
    descendConfirmed: p.descendConfirmed,
    attemptStarted: p.attemptStarted,
  });
  const reason = !p.officialShallowPathCandidate
    ? null
    : p.pr03OfficialShallowArming
      ? 'pr03_official_shallow_contract'
      : p.naturalArmed
        ? 'classic_start_before_bottom'
        : p.hmmArmingAssistApplied
          ? 'hmm_arming_assist'
          : null;

  let blockedReason: string | null = null;
  if (p.officialShallowPathCandidate && !admitted) {
    if (!p.armed) {
      blockedReason = p.officialShallowDescentEvidenceForAdmission
        ? 'not_armed'
        : 'official_shallow_pending_descent_evidence';
    } else if (!p.descendConfirmed) {
      blockedReason = 'no_descend';
    } else if (!p.attemptStarted) {
      blockedReason = 'no_downward_commitment';
    }
  }

  return {
    candidate: p.officialShallowPathCandidate,
    admitted,
    reason,
    blockedReason,
  };
}

function getStandingRecoveryFinalizeGate(
  evidenceLabel: SquatEvidenceLabel,
  standingRecovery: {
    standingRecoveredAtMs?: number;
    standingRecoveryHoldMs: number;
    standingRecoveryFrameCount: number;
  },
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>
): {
  minFramesUsed: number;
  minHoldMsUsed: number;
  finalizeSatisfied: boolean;
  finalizeReason: string | null;
} {
  const ultraLowRomUsesGuardedFinalize =
    evidenceLabel === 'ultra_low_rom' && recoveryMeetsLowRomStyleFinalizeProof(recovery);

  const minFramesUsed =
    evidenceLabel === 'low_rom' || ultraLowRomUsesGuardedFinalize
      ? LOW_ROM_STANDING_RECOVERY_MIN_FRAMES
      : MIN_STANDING_RECOVERY_FRAMES;
  const minHoldMsUsed =
    evidenceLabel === 'low_rom' || ultraLowRomUsesGuardedFinalize
      ? LOW_ROM_STANDING_RECOVERY_MIN_HOLD_MS
      : MIN_STANDING_RECOVERY_HOLD_MS;

  if (evidenceLabel === 'insufficient_signal') {
    return {
      minFramesUsed,
      minHoldMsUsed,
      finalizeSatisfied: false,
      finalizeReason: 'insufficient_signal',
    };
  }

  if (standingRecovery.standingRecoveredAtMs == null) {
    return {
      minFramesUsed,
      minHoldMsUsed,
      finalizeSatisfied: false,
      finalizeReason: 'not_standing_recovered',
    };
  }

  if (standingRecovery.standingRecoveryFrameCount < minFramesUsed) {
    return {
      minFramesUsed,
      minHoldMsUsed,
      finalizeSatisfied: false,
      finalizeReason: 'tail_frames_below_min',
    };
  }

  if (standingRecovery.standingRecoveryHoldMs < minHoldMsUsed) {
    return {
      minFramesUsed,
      minHoldMsUsed,
      finalizeSatisfied: false,
      finalizeReason: 'tail_hold_below_min',
    };
  }

  const needsLowRomStyleProof = evidenceLabel === 'low_rom' || ultraLowRomUsesGuardedFinalize;
  if (needsLowRomStyleProof) {
    if ((recovery.recoveryReturnContinuityFrames ?? 0) < LOW_ROM_STANDING_FINALIZE_MIN_RETURN_CONTINUITY_FRAMES) {
      return {
        minFramesUsed,
        minHoldMsUsed,
        finalizeSatisfied: false,
        finalizeReason: 'return_continuity_below_min',
      };
    }
    if ((recovery.recoveryDropRatio ?? 0) < LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO) {
      return {
        minFramesUsed,
        minHoldMsUsed,
        finalizeSatisfied: false,
        finalizeReason: 'recovery_drop_ratio_below_min',
      };
    }
  }

  return {
    minFramesUsed,
    minHoldMsUsed,
    finalizeSatisfied: true,
    finalizeReason:
      evidenceLabel === 'low_rom'
        ? 'low_rom_guarded_finalize'
        : ultraLowRomUsesGuardedFinalize
          ? 'ultra_low_rom_guarded_finalize'
          : 'standing_hold_met',
  };
}

/**
 * CAM-30: 동일 attempt 안에서 terminal 단계 증거가 이미 쌓인 뒤
 * completionBlockedReason 이 더 이른 단계 사유로 역행하는 것을 막는다(임계·finalize 미변경).
 */
function normalizeCompletionBlockedReasonForTerminalStage(args: {
  completionSatisfied: boolean;
  attemptStarted: boolean;
  downwardCommitmentReached: boolean;
  reversalConfirmedAfterDescend: boolean;
  standingRecoveredAtMs: number | null | undefined;
  standingRecoveryFinalizeReason: string | null;
  completionBlockedReason: string | null;
  /** PR-03 rework: 공식 shallow 입장 시 no_reversal 을 recovery_hold 로 뭉개며 튀는 것 방지 */
  officialShallowPathAdmitted?: boolean;
  /** PR-03 shallow closure final: stream/primary shallow closure 번들 성립 시 no_reversal 정체 완화 */
  officialShallowClosureProofBundle?: boolean;
}): string | null {
  if (args.completionSatisfied) return null;

  const cur = args.completionBlockedReason;

  /** PR-03 final: 역전이 이미 잠겼는데 no_reversal 로 남는 shallow 비일관성 제거 */
  if (
    args.officialShallowPathAdmitted === true &&
    args.reversalConfirmedAfterDescend === true &&
    cur === 'no_reversal'
  ) {
    return 'not_standing_recovered';
  }

  /**
   * PR-03 shallow closure final: 번들·finalize 증거는 있는데 progression 앵커만 아직 rule 체인에 안 붙은 틈 —
   * shallow 전용으로 no_reversal 에 고정되지 않게 한다 (standard/deep 경로는 건드리지 않음).
   */
  if (
    args.officialShallowPathAdmitted === true &&
    args.officialShallowClosureProofBundle === true &&
    args.reversalConfirmedAfterDescend === false &&
    cur === 'no_reversal'
  ) {
    return 'not_standing_recovered';
  }

  if (args.standingRecoveredAtMs != null) {
    if (
      args.officialShallowPathAdmitted === true &&
      args.reversalConfirmedAfterDescend === false &&
      cur === 'no_reversal'
    ) {
      return 'no_reversal';
    }
    const allowedStanding = new Set([
      'recovery_hold_too_short',
      'low_rom_standing_finalize_not_satisfied',
      'ultra_low_rom_standing_finalize_not_satisfied',
      /** PR-03 rework: 타이밍 차단을 잘못 recovery_hold 로 뭉개지 않게 유지 (임계값 불변). */
      'descent_span_too_short',
      'ascent_recovery_span_too_short',
    ]);
    if (cur != null && allowedStanding.has(cur)) return cur;
    return 'recovery_hold_too_short';
  }

  if (args.reversalConfirmedAfterDescend) {
    const allowedReversal = new Set([
      'not_standing_recovered',
      'low_rom_standing_finalize_not_satisfied',
      'ultra_low_rom_standing_finalize_not_satisfied',
    ]);
    if (cur != null && allowedReversal.has(cur)) return cur;
    return 'not_standing_recovered';
  }

  if (args.attemptStarted && args.downwardCommitmentReached) {
    return 'no_reversal';
  }

  return cur;
}

/**
 * PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04: 얕은 스쿼트만 **통제된 권위 종료 계약**으로 닫는다.
 * trajectory/tail/ultra provenance 단독·시리즈 시작 피크 오염·무하강 정적 자세는 통과시키지 않는다.
 */
function getShallowAuthoritativeClosureDecision(p: {
  completionAlreadySatisfied: boolean;
  completionPassReason: SquatCompletionPassReason;
  officialShallowPathCandidate: boolean;
  officialShallowPathAdmitted: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  armed: boolean;
  downwardCommitmentReached: boolean;
  committedFrame: SquatDepthFrameLite | null | undefined;
  relativeDepthPeak: number;
  eventBasedDescentPath: boolean;
  peakLatchedAtIndex: number | null | undefined;
  hasValidCommittedPeakAnchor: boolean;
  committedOrPostCommitPeakFrame: SquatDepthFrameLite | undefined | null;
  ownerAuthoritativeReversalSatisfied: boolean;
  ownerAuthoritativeRecoverySatisfied: boolean;
  officialShallowStreamBridgeApplied: boolean;
  officialShallowAscentEquivalentSatisfied: boolean;
  shallowClosureProofBundleFromStream: boolean;
  officialShallowPrimaryDropClosureFallback: boolean;
  squatReversalDropAchieved: number;
  squatReversalDropRequired: number;
  standingRecoveredAtMs: number | undefined | null;
  standingRecoveryFinalizeSatisfied: boolean;
  standingRecoveryFinalizeReason: string | null;
  standingRecoveryFinalizeBand: SquatEvidenceLabel;
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>;
  provenanceReversalEvidencePresent: boolean;
  /** trajectory rescue / tail / ultra 가 역전 라벨을 trajectory 쪽으로 만든 경우 */
  reversalLabeledTrajectory: boolean;
}): { satisfied: boolean; shallowAuthoritativeClosureBlockedReason: string | null } {
  if (p.completionAlreadySatisfied) {
    return { satisfied: false, shallowAuthoritativeClosureBlockedReason: null };
  }
  if (p.completionPassReason !== 'not_confirmed') {
    return { satisfied: false, shallowAuthoritativeClosureBlockedReason: null };
  }

  const standardPathWouldWin =
    p.eventBasedDescentPath === false && p.relativeDepthPeak >= STANDARD_OWNER_FLOOR;
  if (standardPathWouldWin) {
    return { satisfied: false, shallowAuthoritativeClosureBlockedReason: null };
  }

  if (!p.officialShallowPathCandidate || !p.officialShallowPathAdmitted) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'shallow_admission_not_satisfied',
    };
  }
  if (!p.attemptStarted || !p.descendConfirmed) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'no_attempt_or_descend',
    };
  }
  if (!p.armed) {
    return { satisfied: false, shallowAuthoritativeClosureBlockedReason: 'not_armed' };
  }
  if (!p.downwardCommitmentReached || p.committedFrame == null) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'no_downward_commitment',
    };
  }
  if (p.relativeDepthPeak >= STANDARD_OWNER_FLOOR) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'outside_shallow_owner_zone',
    };
  }
  /** PR-CAM-PEAK-ANCHOR-INTEGRITY: 첫 유효 프레임 피크 래치는 setup/시리즈 시작 오염으로 취급 */
  if (p.peakLatchedAtIndex === 0) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'peak_series_start_contamination',
    };
  }
  if (!p.hasValidCommittedPeakAnchor || p.committedOrPostCommitPeakFrame == null) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'invalid_committed_peak_anchor',
    };
  }

  const explicitClosureProof =
    p.shallowClosureProofBundleFromStream === true ||
    p.officialShallowPrimaryDropClosureFallback === true;
  const minDropForShallowAuth =
    Math.max(REVERSAL_DROP_MIN_ABS, p.squatReversalDropRequired * 0.88) - 1e-12;
  const dropGate = p.squatReversalDropAchieved >= minDropForShallowAuth;

  const shallowAuthoritativeReversal =
    p.ownerAuthoritativeReversalSatisfied === true ||
    p.officialShallowAscentEquivalentSatisfied === true ||
    (explicitClosureProof && dropGate);

  const provenanceOnlyReversalLane =
    p.provenanceReversalEvidencePresent &&
    !p.ownerAuthoritativeReversalSatisfied &&
    !p.officialShallowStreamBridgeApplied &&
    !p.officialShallowAscentEquivalentSatisfied &&
    !(explicitClosureProof && dropGate);

  if (provenanceOnlyReversalLane) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'provenance_only_reversal_lane',
    };
  }

  if (!shallowAuthoritativeReversal) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'shallow_authoritative_reversal_not_satisfied',
    };
  }

  if (
    p.reversalLabeledTrajectory &&
    !p.ownerAuthoritativeReversalSatisfied &&
    !explicitClosureProof
  ) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'trajectory_reversal_without_closure_proof',
    };
  }

  const fr = p.standingRecoveryFinalizeReason;
  const finalizeReasonOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    fr === 'low_rom_tail_guarded_finalize';

  const recoveryProofOk = recoveryMeetsLowRomStyleFinalizeProof(p.recovery);
  const shallowFinalizeBandOk =
    isOfficialShallowRomFinalizeBand(p.standingRecoveryFinalizeBand) ||
    p.standingRecoveryFinalizeReason === 'standing_hold_met';

  const shallowAuthoritativeRecovery =
    p.ownerAuthoritativeRecoverySatisfied === true ||
    (p.standingRecoveredAtMs != null &&
      p.standingRecoveryFinalizeSatisfied &&
      shallowFinalizeBandOk &&
      finalizeReasonOk &&
      recoveryProofOk);

  if (!shallowAuthoritativeRecovery) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'shallow_authoritative_recovery_not_satisfied',
    };
  }

  const closureProofSignal =
    p.ownerAuthoritativeReversalSatisfied === true ||
    p.officialShallowStreamBridgeApplied === true ||
    explicitClosureProof;

  if (!closureProofSignal) {
    return {
      satisfied: false,
      shallowAuthoritativeClosureBlockedReason: 'shallow_closure_proof_missing',
    };
  }

  return { satisfied: true, shallowAuthoritativeClosureBlockedReason: null };
}

/**
 * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Branch B.
 *
 * Compute `baselineKneeAngleAvg` as the median of `kneeAngleAvg` across the
 * first BASELINE_WINDOW valid frames referenced by `depthRowIndices`. Returns
 * null when fewer than MIN_BASELINE_FRAMES finite samples are available, which
 * keeps the source closed on reps whose standing-baseline window never formed
 * (matches design SSOT §4.1 condition (3) and §5.8 seated/quasi-seated proof).
 */
function computeBaselineKneeAngleAvgMedian(
  validFrames: PoseFeaturesFrame[],
  depthRowIndices: readonly number[],
): number | null {
  const windowIndices = depthRowIndices.slice(0, BASELINE_WINDOW);
  if (windowIndices.length < MIN_BASELINE_FRAMES) return null;
  const samples: number[] = [];
  for (const vi of windowIndices) {
    const v = validFrames[vi]?.derived.kneeAngleAvg;
    if (typeof v === 'number' && Number.isFinite(v)) samples.push(v);
  }
  if (samples.length < MIN_BASELINE_FRAMES) return null;
  samples.sort((a, b) => a - b);
  const mid = samples.length >> 1;
  return samples.length % 2 === 0 ? (samples[mid - 1]! + samples[mid]!) / 2 : samples[mid]!;
}

/**
 * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Branch B.
 *
 * **Source #4 candidate** for `effectiveDescentStartFrame`:
 * `legitimateKinematicShallowDescentOnsetFrame` per design SSOT §4.
 *
 * Fires only when **all** of the following hold (design SSOT §4.1):
 *   1. `f.index ≥ baselineFreezeFrameIndex`
 *   2. `f.index < peakFrame.index`
 *   3. `baselineKneeAngleAvg` resolvable from the baseline window (median)
 *   4. `kneeAngleAvg[f] ≤ baselineKneeAngleAvg − KNEE_DESCENT_ONSET_EPSILON_DEG`
 *   5. `kneeAngleAvg[j] − kneeAngleAvg[j+1] ≥ 0` over
 *      `[f, f + KNEE_DESCENT_ONSET_SUSTAIN_FRAMES − 1]` (monotonic non-increase)
 *   6. `baselineFrozen === true`
 *   7. `attemptAdmissionSatisfied === true`
 *   8. `descentConfirmed === true` somewhere in the rep window (automatically
 *      satisfied whenever conditions 1–7 fire because the source itself
 *      contributes to the engine's descent-confirmation ladder via
 *      `eventBasedDescentPath`; design SSOT §4.3 documents this as intent).
 *
 * The returned candidate may only make the descent anchor EARLIER. It never
 * opens final pass by itself (design SSOT §6.1 SL-1); it feeds the canonical
 * shallow contract's cycle-timing gate only. All downstream gates (reversal,
 * recovery, anti-false-pass, minimum-cycle) continue to evaluate independently.
 *
 * **Coexistence deferral (design SSOT §7.4 item 4).** This branch does NOT
 * resolve the `completionOwnerReason === 'pass_core_detected'` authority
 * ambiguity surfaced by the P1 calibration study. The new source is
 * orthogonal to the `completionOwnerReason` pipeline — it never writes to
 * any `completionOwner*` field. Resolving that ambiguity is an
 * authority-law session, not this implementation; the additive diagnostic
 * `canonicalShallowContractDrovePass` (design SSOT §7.4 item 3) is exposed
 * by the auto-progression layer so the authority-law owner can diff canonical
 * shallow passes from assist passes without reading private owner reasons.
 */
function findLegitimateKinematicShallowDescentOnsetFrame(params: {
  validFrames: PoseFeaturesFrame[];
  depthFrames: ReadonlyArray<{
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  }>;
  peakFrameIndex: number;
  baselineFreezeFrameIndex: number | null;
  baselineKneeAngleAvg: number | null;
  baselineFrozen: boolean;
  attemptAdmissionSatisfied: boolean;
}): {
  frame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  };
  kneeAngleAtOnset: number;
  sustainSatisfied: true;
} | null {
  if (!params.baselineFrozen) return null;
  if (!params.attemptAdmissionSatisfied) return null;
  if (params.baselineKneeAngleAvg == null) return null;
  if (params.baselineFreezeFrameIndex == null) return null;

  const { validFrames, depthFrames, peakFrameIndex, baselineFreezeFrameIndex } = params;
  const threshold = params.baselineKneeAngleAvg - KNEE_DESCENT_ONSET_EPSILON_DEG;
  const sustainWindow = Math.max(2, KNEE_DESCENT_ONSET_SUSTAIN_FRAMES);

  for (let i = 0; i < depthFrames.length; i++) {
    const f = depthFrames[i]!;
    if (f.index < baselineFreezeFrameIndex) continue;
    if (f.index >= peakFrameIndex) break;
    const kneeAtI = validFrames[f.index]?.derived.kneeAngleAvg;
    if (typeof kneeAtI !== 'number' || !Number.isFinite(kneeAtI)) continue;
    if (!(kneeAtI <= threshold)) continue;

    if (i + sustainWindow - 1 >= depthFrames.length) break;
    let monotonic = true;
    for (let j = 0; j < sustainWindow - 1; j++) {
      const cur = validFrames[depthFrames[i + j]!.index]?.derived.kneeAngleAvg;
      const nxt = validFrames[depthFrames[i + j + 1]!.index]?.derived.kneeAngleAvg;
      if (typeof cur !== 'number' || !Number.isFinite(cur)) { monotonic = false; break; }
      if (typeof nxt !== 'number' || !Number.isFinite(nxt)) { monotonic = false; break; }
      if (cur - nxt < 0) { monotonic = false; break; }
    }
    if (!monotonic) continue;

    return { frame: f, kneeAngleAtOnset: kneeAtI, sustainSatisfied: true };
  }
  return null;
}

/**
 * PR-1-COMPLETION-STATE-SLIMMING: Completion core truth boundary — SQUAT_REFACTOR_SSOT.md §1.
 *
 * Names only the fields that belong to the completion core per the SSOT definition.
 * evaluateSquatCompletionCore owns these fields as completion truth.
 * All other SquatCompletionState fields are observability / context / assist annotations.
 *
 * This type is intentionally unexported and serves as a living specification boundary.
 * Future PRs (PR-2+) may tighten this into a concrete return type once the boundary
 * is proven stable through regression.
 *
 * Categories (per SSOT §Completion Core):
 *   admission     — attemptStarted, descendConfirmed, downwardCommitmentReached
 *   reversal      — reversalConfirmedAfterDescend, ascendConfirmed
 *   recovery      — recoveryConfirmedAfterReversal
 *   completion    — completionSatisfied, completionBlockedReason, completionPassReason
 *   phase context — completionMachinePhase, currentSquatPhase
 *   depth context — relativeDepthPeak, evidenceLabel (minimum to interpret the above)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _SquatCompletionCoreBoundary = Pick<
  SquatCompletionState,
  | 'attemptStarted'
  | 'descendConfirmed'
  | 'downwardCommitmentReached'
  | 'ascendConfirmed'
  | 'relativeDepthPeak'
  | 'evidenceLabel'
  | 'currentSquatPhase'
  | 'completionMachinePhase'
  | 'completionPassReason'
  | 'reversalConfirmedAfterDescend'
  | 'recoveryConfirmedAfterReversal'
>;

export function evaluateSquatCompletionCore(
  frames: PoseFeaturesFrame[],
  options: EvaluateSquatCompletionStateOptions | undefined,
  depthFreeze: SquatDepthFreezeConfig | null
): SquatCompletionState {
  const validFrames = frames.filter((frame) => frame.isValid);

  const depthRows = buildSquatCompletionDepthRows(validFrames);

  if (depthRows.length === 0) {
    const emptyBase = {
      baselineStandingDepth: 0,
      rawDepthPeak: 0,
      relativeDepthPeak: 0,
      currentSquatPhase: 'idle' as const,
      attemptStarted: false,
      descendConfirmed: false,
      downwardCommitmentReached: false,
      ascendConfirmed: false,
      standingRecoveryHoldMs: 0,
      evidenceLabel: 'insufficient_signal' as const,
      completionBlockedReason: 'not_armed',
      completionSatisfied: false,
      startBeforeBottom: false,
      bottomDetected: false,
      recoveryDetected: false,
      cycleComplete: false,
      downwardCommitmentDelta: 0,
      standingRecoveryFrameCount: 0,
      standingRecoveryThreshold: STANDING_RECOVERY_TOLERANCE_FLOOR,
      standingRecoveryMinFramesUsed: MIN_STANDING_RECOVERY_FRAMES,
      standingRecoveryMinHoldMsUsed: MIN_STANDING_RECOVERY_HOLD_MS,
      standingRecoveryBand: 'insufficient_signal' as const,
      standingRecoveryFinalizeReason: 'insufficient_signal' as const,
      lowRomRecoveryReason: null,
      ultraLowRomRecoveryReason: null,
    };
    return {
      ...emptyBase,
      completionMachinePhase: deriveSquatCompletionMachinePhase(emptyBase),
      completionPassReason: 'not_confirmed' as const,
      hmmAssistEligible: false,
      hmmAssistApplied: false,
      hmmAssistReason: null,
      ruleCompletionBlockedReason: 'not_armed',
      postAssistCompletionBlockedReason: 'not_armed',
      assistSuppressedByFinalize: false,
      hmmReversalAssistEligible: false,
      hmmReversalAssistApplied: false,
      hmmReversalAssistReason: null,
      reversalConfirmedBy: null,
      reversalDepthDrop: null,
      reversalFrameCount: null,
      rawDepthPeakPrimary: 0,
      rawDepthPeakBlended: 0,
      relativeDepthPeakSource: 'primary',
      baselineFrozen: false,
      baselineFrozenDepth: null,
      peakLatched: false,
      peakLatchedAtIndex: null,
      peakAnchorTruth: undefined,
      eventCyclePromoted: false,
      eventCycleSource: null,
      reversalConfirmedAfterDescend: false,
      recoveryConfirmedAfterReversal: false,
      reversalConfirmedByRuleOrHmm: false,
      eventBasedDescentPath: false,
      baselineSeeded: false,
      reversalTailBackfillApplied: false,
      ultraShallowMeaningfulDownUpRescueApplied: false,
      trajectoryReversalRescueApplied: false,
      completionFinalizeMode: 'blocked',
      completionAssistApplied: false,
      completionAssistSources: [],
      completionAssistMode: 'none',
      promotionBaseRuleBlockedReason: null,
      reversalEvidenceProvenance: null,
      officialShallowPathCandidate: false,
      officialShallowPathAdmitted: false,
      officialShallowPathClosed: false,
      officialShallowPathReason: null,
      officialShallowPathBlockedReason: null,
      officialShallowStreamBridgeApplied: false,
      officialShallowAscentEquivalentSatisfied: false,
      officialShallowClosureProofSatisfied: false,
      officialShallowPrimaryDropClosureFallback: false,
      officialShallowReversalSatisfied: false,
      ownerAuthoritativeReversalSatisfied: false,
      ownerAuthoritativeRecoverySatisfied: false,
      provenanceReversalEvidencePresent: false,
      ownerAuthoritativeShallowClosureSatisfied: false,
      shallowAuthoritativeClosureReason: null,
      shallowAuthoritativeClosureBlockedReason: null,
      shallowTrajectoryBridgeEligible: false,
      shallowTrajectoryBridgeSatisfied: false,
      shallowTrajectoryBridgeBlockedReason: null,
      guardedShallowTrajectoryClosureProofSatisfied: false,
      guardedShallowTrajectoryClosureProofBlockedReason: null,
      standingFinalizeSatisfied: false,
      standingFinalizeSuppressedByLateSetup: false,
      standingFinalizeReadyAtMs: null,
      legitimateKinematicShallowDescentOnsetFrameIndex: null,
      legitimateKinematicShallowDescentOnsetAtMs: null,
      legitimateKinematicShallowDescentOnsetKneeAngleAvg: null,
      legitimateKinematicShallowDescentBaselineKneeAngleAvg: null,
      effectiveDescentStartFrameSource: null,
      descentAnchorCoherent: true,
      preArmingKinematicDescentEpochValidIndex: null,
      preArmingKinematicDescentEpochAtMs: null,
      preArmingKinematicDescentEpochAccepted: false,
      preArmingKinematicDescentEpochRejectedReason: 'missing',
      preArmingKinematicDescentEpochCompletionSliceStartIndex: null,
      preArmingKinematicDescentEpochPeakGuardValidIndex: null,
      preArmingKinematicDescentEpochProof: null,
      selectedCanonicalDescentTimingEpochSource: null,
      selectedCanonicalDescentTimingEpochValidIndex: null,
      selectedCanonicalDescentTimingEpochAtMs: null,
      normalizedDescentAnchorCoherent: true,
    };
  }

  const seedPrimary = options?.seedBaselineStandingDepthPrimary;
  const seedBlended = options?.seedBaselineStandingDepthBlended;
  const hasFiniteSeedPrimary = typeof seedPrimary === 'number' && Number.isFinite(seedPrimary);
  const hasFiniteSeedBlended = typeof seedBlended === 'number' && Number.isFinite(seedBlended);

  const windowRows = depthRows.slice(0, BASELINE_WINDOW);
  const baselinePrimaryFromWindow =
    windowRows.length > 0 ? Math.min(...windowRows.map((r) => r.depthPrimary)) : 0;
  const baselineBlendedFromWindow =
    windowRows.length > 0
      ? Math.min(...windowRows.map((r) => r.depthCompletion))
      : baselinePrimaryFromWindow;

  const baselinePrimary = hasFiniteSeedPrimary ? seedPrimary : baselinePrimaryFromWindow;
  const baselineBlended = hasFiniteSeedBlended ? seedBlended : baselinePrimary;

  const rawDepthPeakPrimary = Math.max(...depthRows.map((r) => r.depthPrimary));
  const rawDepthPeakBlended = Math.max(...depthRows.map((r) => r.depthCompletion));

  let relativeDepthPeakSource: 'primary' | 'blended';
  let baselineStandingDepth: number;
  const depthFrames: Array<{
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  }> = [];
  let peakFrame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  };
  let peakRowPrimary: SquatCompletionDepthRow;
  let rawDepthPeak: number;
  let relativeDepthPeak: number;

  if (depthFreeze != null) {
    relativeDepthPeakSource = depthFreeze.lockedRelativeDepthPeakSource;
    baselineStandingDepth = depthFreeze.frozenBaselineStandingDepth;
    for (const r of depthRows) {
      depthFrames.push({
        index: r.index,
        depth: relativeDepthPeakSource === 'blended' ? r.depthCompletion : r.depthPrimary,
        timestampMs: r.timestampMs,
        phaseHint: r.phaseHint,
      });
    }
    peakFrame = depthFrames.reduce((best, frame) => (frame.depth > best.depth ? frame : best));
    peakRowPrimary = depthRows.reduce((best, row) =>
      row.depthPrimary > best.depthPrimary ? row : best
    );
    rawDepthPeak = peakFrame.depth;
    relativeDepthPeak = Math.max(0, rawDepthPeak - baselineStandingDepth);
  } else {
    const relativePrimary = Math.max(0, rawDepthPeakPrimary - baselinePrimary);
    const relativeBlended = Math.max(0, rawDepthPeakBlended - baselineBlended);

    relativeDepthPeakSource =
      relativePrimary >= COMPLETION_PRIMARY_DOMINANT_REL_PEAK
        ? 'primary'
        : relativeBlended >= LEGACY_ATTEMPT_FLOOR && relativeBlended > relativePrimary
          ? 'blended'
          : 'primary';

    for (const r of depthRows) {
      depthFrames.push({
        index: r.index,
        depth: relativeDepthPeakSource === 'blended' ? r.depthCompletion : r.depthPrimary,
        timestampMs: r.timestampMs,
        phaseHint: r.phaseHint,
      });
    }

    peakFrame = depthFrames.reduce((best, frame) => (frame.depth > best.depth ? frame : best));
    peakRowPrimary = depthRows.reduce((best, row) =>
      row.depthPrimary > best.depthPrimary ? row : best
    );

    rawDepthPeak = peakFrame.depth;
    baselineStandingDepth =
      relativeDepthPeakSource === 'blended' ? baselineBlended : baselinePrimary;
    relativeDepthPeak = Math.max(0, rawDepthPeak - baselineStandingDepth);
  }

  const baselineDepths = depthFrames.slice(0, BASELINE_WINDOW).map((frame) => frame.depth);
  const recovery = getSquatRecoverySignal(validFrames);
  const guardedUltraLowAttemptEligible =
    relativeDepthPeak >= GUARDED_ULTRA_LOW_ROM_FLOOR &&
    relativeDepthPeak < LEGACY_ATTEMPT_FLOOR &&
    recovery.ultraLowRomGuardedRecovered === true;
  const attemptAdmissionSatisfied =
    relativeDepthPeak >= LEGACY_ATTEMPT_FLOOR || guardedUltraLowAttemptEligible;
  const attemptAdmissionFloor = guardedUltraLowAttemptEligible
    ? GUARDED_ULTRA_LOW_ROM_FLOOR
    : LEGACY_ATTEMPT_FLOOR;

  /**
   * standing recovery finalize 밴드 — PR-SHALLOW-FINALIZE-BAND-01.
   * PR-03 rework: `officialShallowPathCandidate` 는 이 밴드와 동일 축(피크·admission 만, tail 미사용).
   * rel≈0.22 + quality `evidenceLabel === 'standard'` 도 여기선 low_rom → 공식 shallow 후보로 열림.
   */
  const standingRecoveryFinalizeBand = getStandingRecoveryFinalizeBand(
    relativeDepthPeak,
    attemptAdmissionSatisfied
  );

  /** ROM 밴드(quality 라벨) — pass reason·해석용; shallow 후보는 위 finalize 밴드 사용 */
  const evidenceLabel = getSquatEvidenceLabel(relativeDepthPeak, attemptAdmissionSatisfied);
  const officialShallowPathCandidate = deriveOfficialShallowCandidate({
    baselineFrameCount: baselineDepths.length,
    attemptAdmissionSatisfied,
    standingRecoveryFinalizeBand,
  });

  const descentFrame = depthFrames.find((frame) => frame.phaseHint === 'descent');
  const bottomFrame = depthFrames.find((frame) => frame.phaseHint === 'bottom');
  const ascentFrame = depthFrames.find(
    (frame) => frame.phaseHint === 'ascent' && frame.index > peakFrame.index
  );
  const startFrame = depthFrames.find((frame) => frame.phaseHint === 'start');
  const startBeforeBottom =
    startFrame != null &&
    (bottomFrame == null || startFrame.index < bottomFrame.index);

  /**
   * PR-CAM-18: event-cycle descent 탐지 — low/ultra-low ROM에서 phaseHint='start'가 우선해
   * 'descent'가 절대 배정되지 않는 경우(모든 프레임 depth < 0.08)를 위한 trajectory 기반 폴백.
   *
   * phaseHints 우선순위 구조: `if (currentDepth < 0.08) → 'start'` 가 먼저 평가되므로
   * ultra-low-ROM 사용자(peak depth < 0.08)의 모든 프레임은 'start'만 받고
   * 'descent'/'ascent'/'bottom'이 배정되지 않는다.
   *
   * 수정 범위: 이 변수 쌍 + descendConfirmed + 타이밍 체크 + squatDescentToPeakMs 만.
   * 그 외 evaluator, guardrail, auto-progression, threshold는 일절 변경하지 않는다.
   */
  const trajectoryDescentStartFrame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  } | undefined =
    attemptAdmissionSatisfied
      ? depthFrames.find(
          (f) =>
            f.depth - baselineStandingDepth >= attemptAdmissionFloor * 0.4
        )
      : undefined;

  /**
   * PR-CAM-EPOCH-SOURCE-RESTORE-01: shared descent truth epoch frame — third source.
   *
   * When sharedDescentTruth confirms descent (descentDetected=true) and owns a legal
   * descentStartAtMs, find the nearest pre-peak depthFrame to use as epoch anchor.
   * This resolves the live half-state where descentDetected=true but
   * effectiveDescentStartFrame was null because neither phaseHint='descent' nor
   * trajectoryDescentStartFrame threshold were reached (ultra-shallow plateau reps).
   *
   * Guards:
   * - sharedDescentTruth.descentDetected must be true (owned by shared truth)
   * - sharedDescentTruth.descentStartAtMs must be non-null
   * - chosen frame must be strictly pre-peak (within current legal rep window)
   *
   * This does NOT weaken the canonical temporal contract — it restores the missing
   * input source that the contract requires to pass.
   */
  const sharedDescentEpochFrame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  } | undefined =
    options?.sharedDescentTruth?.descentDetected === true &&
    options.sharedDescentTruth.descentStartAtMs != null
      ? (() => {
          const targetMs = options.sharedDescentTruth!.descentStartAtMs!;
          let best: (typeof depthFrames)[number] | undefined;
          let bestDiff = Infinity;
          for (const f of depthFrames) {
            if (f.index >= peakFrame.index) continue;
            const diff = Math.abs(f.timestampMs - targetMs);
            if (diff < bestDiff) {
              bestDiff = diff;
              best = f;
            }
          }
          return best;
        })()
      : undefined;

  /**
   * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Branch B, source #4.
   *
   * `legitimateKinematicShallowDescentOnsetFrame` — earliest-by-index frame in the
   * pre-peak window whose `kneeAngleAvg` falls ≥ `KNEE_DESCENT_ONSET_EPSILON_DEG`
   * below the standing-baseline median and is sustained (monotonic non-increase)
   * over `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES`. Gated by `baselineFrozen` and
   * `attemptAdmissionSatisfied`. Design SSOT §4.1–§4.3; proof obligations §5;
   * split-brain guards §6; coexistence deferral with `pass_core_detected` §7.
   *
   * NOTE (coexistence deferral — design SSOT §7.4 item 4):
   * this branch does NOT resolve the `pass_core_detected` authority ambiguity
   * surfaced by the P1 calibration study; it only exposes the diagnostics
   * (`canonicalShallowContractDrovePass`, `legitimateKinematicShallowDescentOnset*`)
   * required for a later authority-law session.
   */
  /**
   * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP:
   * baseline-sourcing 정합 (Target 1 / Target 4).
   *
   * `depthFrames` 는 evaluator 의 arming slice (`completionFrames`) 기준이므로
   * shallow 대표 fixture 에서 slice[0] 이 이미 하강 구간이다. 이 경우
   *   (a) `computeBaselineKneeAngleAvgMedian(first 6 rows)` 의 median 이 descent
   *       프레임을 섞어 뽑혀 threshold 가 true standing 기준보다 훨씬 낮아지고,
   *   (b) `baselineFreezeFrameIndex = depthFrames[5].index` 이 peak index 보다
   *       뒤에 있어 `[freezeIdx, peakIdx)` 검색 구간이 공집합이 된다.
   *
   * evaluator 가 pre-arming `valid` 버퍼 기준의 standing kneeAngleAvg median 을
   * `seedBaselineKneeAngleAvg` 로 넘겨주면 baseline 은 true standing 값으로
   * 복원되고, 동시에 baseline 은 slice 시작 이전에 이미 동결된 셈이므로
   * `baselineFreezeFrameIndex` 는 slice 의 가장 앞 depthFrame 으로 정합한다.
   *
   * seed 가 없을 때(직접 호출 / pre-arming 경로)는 기존 동작을 그대로 유지한다 —
   * design SSOT §4.1 의 "standing-baseline window" 의미 자체는 동일하며,
   * threshold 값(5°), sustain 값(2 frames), authority-law 는 전혀 변경되지 않는다.
   */
  const seedBaselineKneeAngleAvgOpt = options?.seedBaselineKneeAngleAvg;
  const hasSeedBaselineKneeAngleAvg =
    typeof seedBaselineKneeAngleAvgOpt === 'number' && Number.isFinite(seedBaselineKneeAngleAvgOpt);
  const baselineKneeAngleAvgValue = hasSeedBaselineKneeAngleAvg
    ? seedBaselineKneeAngleAvgOpt
    : computeBaselineKneeAngleAvgMedian(
        validFrames,
        depthFrames.map((f) => f.index),
      );
  const baselineFreezeFrameIndex =
    depthFreeze != null && depthFrames.length >= MIN_BASELINE_FRAMES
      ? hasSeedBaselineKneeAngleAvg
        ? depthFrames[0]!.index
        : depthFrames[Math.min(BASELINE_WINDOW, depthFrames.length) - 1]!.index
      : null;
  const legitimateKinematicOnset =
    depthFreeze != null
      ? findLegitimateKinematicShallowDescentOnsetFrame({
          validFrames,
          depthFrames,
          peakFrameIndex: peakFrame.index,
          baselineFreezeFrameIndex,
          baselineKneeAngleAvg: baselineKneeAngleAvgValue,
          baselineFrozen: true,
          attemptAdmissionSatisfied,
        })
      : null;
  const legitimateKinematicShallowDescentOnsetFrame = legitimateKinematicOnset?.frame;

  /**
   * PR-CAM-EPOCH-SOURCE-RESTORE-01 + PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION:
   * pick the earliest-by-index frame among the four legal sources. Source #4
   * (`legitimateKinematicShallowDescentOnsetFrame`) is purely additive — it may
   * only move the anchor EARLIER, never later, because resolution is earliest-
   * by-index over the non-null set. Canonical temporal contract is preserved
   * by downstream ordering checks, not by source selection here.
   */
  const effectiveDescentStartFrame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  } | undefined = (() => {
    const candidates = [
      descentFrame,
      trajectoryDescentStartFrame,
      sharedDescentEpochFrame,
      legitimateKinematicShallowDescentOnsetFrame,
    ].filter((f): f is NonNullable<typeof f> => f != null);
    if (candidates.length === 0) return undefined;
    return candidates.reduce((earliest, f) => (f.index < earliest.index ? f : earliest));
  })();

  type DescentTimingEpochSource =
    | 'phase_hint_descent'
    | 'trajectory_descent_start'
    | 'shared_descent_epoch'
    | 'legitimate_kinematic_shallow_descent_onset'
    | 'pre_arming_kinematic_descent_epoch';
  type NormalizedDescentTimingEpoch = {
    source: DescentTimingEpochSource;
    validIndex: number;
    timestampMs: number;
  };

  const preArmingKinematicEpoch = options?.preArmingKinematicDescentEpoch;
  const completionSliceStartIndexForTiming = (() => {
    const optionCompletionSliceStartIndex = options?.completionSliceStartIndex;
    if (
      typeof optionCompletionSliceStartIndex === 'number' &&
      Number.isInteger(optionCompletionSliceStartIndex) &&
      optionCompletionSliceStartIndex >= 0
    ) {
      return optionCompletionSliceStartIndex;
    }
    if (
      preArmingKinematicEpoch != null &&
      Number.isInteger(preArmingKinematicEpoch.completionSliceStartIndex) &&
      preArmingKinematicEpoch.completionSliceStartIndex >= 0
    ) {
      return preArmingKinematicEpoch.completionSliceStartIndex;
    }
    return 0;
  })();
  const corePeakValidIndex = completionSliceStartIndexForTiming + peakFrame.index;
  const validatePreArmingKinematicEpoch = (
    epoch: PreArmingKinematicDescentEpoch | undefined
  ): { timingEpoch: NormalizedDescentTimingEpoch | null; rejectedReason: string | null } => {
    if (epoch == null) return { timingEpoch: null, rejectedReason: 'missing' };
    if (depthFreeze == null) return { timingEpoch: null, rejectedReason: 'core_not_frozen' };
    if (epoch.source !== 'pre_arming_kinematic_descent_epoch') {
      return { timingEpoch: null, rejectedReason: 'invalid_payload' };
    }
    const finitePayload =
      Number.isFinite(epoch.baselineKneeAngleAvg) &&
      Number.isFinite(epoch.descentOnsetAtMs) &&
      Number.isFinite(epoch.descentOnsetKneeAngleAvg) &&
      Number.isFinite(epoch.peakGuardAtMs);
    const integerPayload =
      Number.isInteger(epoch.baselineWindowStartValidIndex) &&
      Number.isInteger(epoch.baselineWindowEndValidIndex) &&
      Number.isInteger(epoch.descentOnsetValidIndex) &&
      Number.isInteger(epoch.completionSliceStartIndex) &&
      Number.isInteger(epoch.peakGuardValidIndex);
    if (!finitePayload || !integerPayload) {
      return { timingEpoch: null, rejectedReason: 'invalid_payload' };
    }
    if (epoch.completionSliceStartIndex !== completionSliceStartIndexForTiming) {
      return { timingEpoch: null, rejectedReason: 'slice_start_mismatch' };
    }
    if (
      epoch.baselineWindowStartValidIndex < 0 ||
      epoch.baselineWindowEndValidIndex < epoch.baselineWindowStartValidIndex ||
      epoch.baselineWindowEndValidIndex >= epoch.descentOnsetValidIndex
    ) {
      return { timingEpoch: null, rejectedReason: 'baseline_not_before_onset' };
    }
    if (epoch.descentOnsetValidIndex >= epoch.completionSliceStartIndex) {
      return { timingEpoch: null, rejectedReason: 'not_pre_arming' };
    }
    if (
      epoch.descentOnsetValidIndex >= corePeakValidIndex ||
      epoch.descentOnsetAtMs >= peakFrame.timestampMs
    ) {
      return { timingEpoch: null, rejectedReason: 'onset_not_before_peak' };
    }
    const proof = epoch.proof;
    if (
      proof?.monotonicSustainSatisfied !== true ||
      proof.baselineBeforeOnset !== true ||
      proof.onsetBeforeCompletionSlicePeak !== true ||
      proof.noStandingRecoveryBetweenOnsetAndSlice !== true
    ) {
      return { timingEpoch: null, rejectedReason: 'proof_failed' };
    }
    return {
      timingEpoch: {
        source: 'pre_arming_kinematic_descent_epoch',
        validIndex: epoch.descentOnsetValidIndex,
        timestampMs: epoch.descentOnsetAtMs,
      },
      rejectedReason: null,
    };
  };
  const preArmingKinematicEpochDecision = validatePreArmingKinematicEpoch(preArmingKinematicEpoch);

  const toLocalTimingEpoch = (
    source: Exclude<DescentTimingEpochSource, 'pre_arming_kinematic_descent_epoch'>,
    frame:
      | {
          index: number;
          timestampMs: number;
        }
      | undefined
  ): NormalizedDescentTimingEpoch | null => {
    if (frame == null) return null;
    return {
      source,
      validIndex: completionSliceStartIndexForTiming + frame.index,
      timestampMs: frame.timestampMs,
    };
  };
  const canonicalDescentTimingEpochs = [
    toLocalTimingEpoch('phase_hint_descent', descentFrame),
    toLocalTimingEpoch('trajectory_descent_start', trajectoryDescentStartFrame),
    toLocalTimingEpoch('shared_descent_epoch', sharedDescentEpochFrame),
    toLocalTimingEpoch(
      'legitimate_kinematic_shallow_descent_onset',
      legitimateKinematicShallowDescentOnsetFrame
    ),
    preArmingKinematicEpochDecision.timingEpoch,
  ].filter((epoch): epoch is NormalizedDescentTimingEpoch => epoch != null);
  const selectedCanonicalDescentTimingEpoch =
    canonicalDescentTimingEpochs.length === 0
      ? null
      : canonicalDescentTimingEpochs.reduce((earliest, epoch) =>
          epoch.validIndex < earliest.validIndex ||
          (epoch.validIndex === earliest.validIndex && epoch.timestampMs < earliest.timestampMs)
            ? epoch
            : earliest
        );
  const normalizedDescentAnchorCoherent =
    selectedCanonicalDescentTimingEpoch == null
      ? true
      : canonicalDescentTimingEpochs.every(
          (epoch) => epoch.validIndex >= selectedCanonicalDescentTimingEpoch.validIndex
        );

  /**
   * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — split-brain
   * guard CL-1 (design SSOT §6.4). `descentAnchorCoherent` is true when every
   * non-null candidate source timestamp equals `effectiveDescentStartFrame`'s
   * timestamp at its own index, OR when the earliest-wins rule correctly
   * surfaces the minimum. We assert the simpler form: the chosen anchor is
   * the minimum-index candidate (observable property). `false` would indicate
   * a downstream consumer mis-selecting a non-earliest candidate — which this
   * function cannot produce by construction, hence true when any source fires.
   */
  const descentAnchorCoherent =
    effectiveDescentStartFrame == null
      ? true
      : [
          descentFrame,
          trajectoryDescentStartFrame,
          sharedDescentEpochFrame,
          legitimateKinematicShallowDescentOnsetFrame,
        ]
          .filter((f): f is NonNullable<typeof f> => f != null)
          .every((f) => f.index >= effectiveDescentStartFrame.index);

  /** phaseHint 기반 descent가 없으면 true — completionPassReason 구분용 */
  const eventBasedDescentPath =
    descentFrame == null &&
    attemptAdmissionSatisfied &&
    effectiveDescentStartFrame != null;

  const prePeakDepths = depthFrames
    .filter((frame) => frame.index < peakFrame.index)
    .map((frame) => frame.depth);
  const minPrePeakDepth =
    prePeakDepths.length > 0 ? Math.min(...prePeakDepths) : baselineStandingDepth;
  const downwardCommitmentDelta = Math.max(0, rawDepthPeak - minPrePeakDepth);
  const downwardCommitmentReached =
    relativeDepthPeak >= attemptAdmissionFloor ||
    downwardCommitmentDelta >= attemptAdmissionFloor ||
    bottomFrame != null;

  const committedFrame =
    bottomFrame ??
    depthFrames.find(
      (frame) =>
        frame.index >= (descentFrame?.index ?? 0) &&
        frame.depth - baselineStandingDepth >= attemptAdmissionFloor
    );

  const committedOrPostCommitPeakFrame = findCommittedOrPostCommitPeakFrame(
    depthFrames,
    committedFrame ?? undefined
  );
  const hasValidCommittedPeakAnchor =
    committedFrame != null &&
    committedOrPostCommitPeakFrame != null &&
    committedOrPostCommitPeakFrame.index >= committedFrame.index &&
    committedOrPostCommitPeakFrame.timestampMs >= committedFrame.timestampMs;

  /** 피크 대비 되돌림 요구량: 깊을수록 큰 상승 구간을 요구해 조기 역전·미드라이즈 오판 감소 */
  const squatReversalDropRequired = Math.max(
    REVERSAL_DROP_MIN_ABS,
    relativeDepthPeak * REVERSAL_DROP_MIN_FRAC_OF_REL_PEAK
  );
  /** PR-04E2: 역전 달성량은 primary 기하만 사용 (reversal 모듈 계약 유지) */
  const postPeakPrimaryDepths = depthRows
    .filter((row) => row.index > peakRowPrimary.index)
    .map((row) => row.depthPrimary);
  const minPostPeakPrimary =
    postPeakPrimaryDepths.length > 0
      ? Math.min(...postPeakPrimaryDepths)
      : peakRowPrimary.depthPrimary;
  const squatReversalDropAchieved = Math.max(
    0,
    peakRowPrimary.depthPrimary - minPostPeakPrimary
  );

  const revConf = detectSquatReversalConfirmation({
    validFrames,
    peakValidIndex: peakRowPrimary.index,
    peakPrimaryDepth: peakRowPrimary.depthPrimary,
    relativeDepthPeak,
    reversalDropRequired: squatReversalDropRequired,
    hmm: options?.hmm ?? null,
  });
  const hasPostPeakDrop = revConf.reversalConfirmed;
  let reversalFrame =
    hasValidCommittedPeakAnchor && hasPostPeakDrop
      ? committedOrPostCommitPeakFrame
      : undefined;

  const computeAscendConfirmed = (rf: typeof peakFrame | undefined): boolean =>
    ascentFrame != null ||
    (rf != null &&
      depthFrames.some(
        (frame) =>
          frame.index > rf.index &&
          frame.depth < peakFrame.depth - squatReversalDropRequired
      ));

  let ascendConfirmed = computeAscendConfirmed(reversalFrame);
  if (committedFrame != null && revConf.reversalConfirmed && !ascendConfirmed) {
    ascendConfirmed =
      revConf.reversalDepthDrop >= squatReversalDropRequired * 0.88 ||
      revConf.reversalFrameCount >= 2;
  }

  const standingRecovery = getStandingRecoveryWindow(
    depthFrames.filter((frame) => frame.index > peakFrame.index),
    baselineStandingDepth,
    relativeDepthPeak
  );
  let standingRecoveryFinalize = getStandingRecoveryFinalizeGate(
    standingRecoveryFinalizeBand,
    standingRecovery,
    {
      recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
      recoveryDropRatio: recovery.recoveryDropRatio,
    }
  );
  const qualifiesForRelaxedLowRomTiming =
    isOfficialShallowRomFinalizeBand(standingRecoveryFinalizeBand) &&
    standingRecoveryFinalize.finalizeSatisfied &&
    (recovery.returnContinuityFrames ?? 0) >= RELAXED_LOW_ROM_MIN_CONTINUITY_FRAMES &&
    (recovery.recoveryDropRatio ?? 0) >= RELAXED_LOW_ROM_MIN_DROP_RATIO;
  const minDescentToPeakMsForLowRom = qualifiesForRelaxedLowRomTiming
    ? RELAXED_MIN_DESCENT_TO_PEAK_MS_LOW_ROM
    : MIN_DESCENT_TO_PEAK_MS_LOW_ROM;
  const minReversalToStandingMsForShallow = qualifiesForRelaxedLowRomTiming
    ? RELAXED_MIN_REVERSAL_TO_STANDING_MS_SHALLOW
    : MIN_REVERSAL_TO_STANDING_MS_SHALLOW;

  const naturalArmed =
    baselineDepths.length >= MIN_BASELINE_FRAMES &&
    startFrame != null &&
    startBeforeBottom;
  /**
   * PR-03: descent-first shallow/ultra-low 사이클은 `startBeforeBottom` 클래식 무장 없이도
   * 하강·궤적 증거가 있으면 공식 completion admission 으로 무장한다 (not_armed 병목 제거).
   * deep/standard 밴드(`standard` evidence)에는 적용하지 않는다.
   */
  const officialShallowDescentEvidenceForAdmission =
    descentFrame != null ||
    eventBasedDescentPath === true ||
    /** DESCENT-TRUTH-RESET-01: shared descent truth confirms descent — treat as evidence */
    options?.sharedDescentTruth?.descentDetected === true;
  const pr03OfficialShallowArming =
    officialShallowPathCandidate &&
    officialShallowDescentEvidenceForAdmission &&
    !naturalArmed;
  const armed =
    naturalArmed ||
    pr03OfficialShallowArming ||
    Boolean(options?.hmmArmingAssistApplied === true && depthFrames.length >= MIN_BASELINE_FRAMES);
  /**
   * DESCENT-TRUTH-RESET-01: align descendConfirmed to the shared descent truth.
   * When shared truth (from pass-window-owned frames) detects descent, descendConfirmed
   * becomes true regardless of phaseHint-based detection gaps.
   * This prevents the split-brain where pass-core sees descent but completion-state does not.
   * Local logic (descentFrame / eventBasedDescentPath) is retained as OR — it can only ADD
   * passes, never revoke. Armed is still required.
   */
  const descendConfirmedLocal = (descentFrame != null || eventBasedDescentPath) && armed;
  const descendConfirmed =
    (options?.sharedDescentTruth?.descentDetected === true && armed)
      ? true
      : descendConfirmedLocal;
  const admissionContract = computeSquatAttemptAdmission({
    armed,
    descendConfirmed,
    attemptAdmissionSatisfied,
    downwardCommitmentReached,
    committedFrame,
  });
  const attemptStarted = admissionContract.attemptStarted;
  const bottomDetected = bottomFrame != null;
  const recoveryDetected = standingRecovery.standingRecoveredAtMs != null;

  /** PR-SQUAT-COMPLETION-REARCH-01 — Subcontract C: shallow closure 번들(로직은 `computeOfficialShallowClosure`) */
  const shallowClosureOut = computeOfficialShallowClosure({
    officialShallowPathCandidate,
    attemptStarted,
    hasValidCommittedPeakAnchor,
    committedOrPostCommitPeakFrame,
    standingRecoveryFinalizeBand,
    standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
    recovery,
    depthFrames,
    relativeDepthPeak,
    qualifiesForRelaxedLowRomTiming,
    squatReversalDropAchieved,
    squatReversalDropRequired,
  });
  let shallowClosureProofBundleFromStream = shallowClosureOut.shallowClosureProofBundleFromStream;
  let officialShallowProofCompletionReturnDrop = shallowClosureOut.officialShallowProofCompletionReturnDrop;
  let officialShallowPrimaryDropClosureFallback = shallowClosureOut.officialShallowPrimaryDropClosureFallback;

  /** commitment 이후 역전·상승·복귀·타이밍 — reversalFrame/ascend 기준 */
  function computeBlockedAfterCommitment(
    rf: typeof peakFrame | undefined,
    asc: boolean
  ): string | null {
    if (rf == null) return 'no_reversal';
    if (!asc) return 'no_ascend';
    if (standingRecovery.standingRecoveredAtMs == null) return 'not_standing_recovered';
    if (!standingRecoveryFinalize.finalizeSatisfied) {
      return standingRecoveryFinalizeBand === 'low_rom'
        ? 'low_rom_standing_finalize_not_satisfied'
        : standingRecoveryFinalizeBand === 'ultra_low_rom'
          ? 'ultra_low_rom_standing_finalize_not_satisfied'
          : 'recovery_hold_too_short';
    }
    if (
      relativeDepthPeak < LOW_ROM_TIMING_PEAK_MAX &&
      selectedCanonicalDescentTimingEpoch != null &&
      peakFrame.timestampMs - selectedCanonicalDescentTimingEpoch.timestampMs < minDescentToPeakMsForLowRom
    ) {
      if (
        !shouldBypassUltraLowRomShortDescentTiming({
          relativeDepthPeak,
          evidenceLabel,
          officialShallowPathCandidate,
          attemptStarted,
          descendConfirmed,
          reversalFrameExists: rf != null,
          ascendForProgression: asc,
          standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
          standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
          recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
          recoveryDropRatio: recovery.recoveryDropRatio,
        })
      ) {
        return 'descent_span_too_short';
      }
    }
    if (
      relativeDepthPeak < SHALLOW_REVERSAL_TIMING_PEAK_MAX &&
      rf != null &&
      standingRecovery.standingRecoveredAtMs != null &&
      standingRecovery.standingRecoveredAtMs - rf.timestampMs < minReversalToStandingMsForShallow
    ) {
      return 'ascent_recovery_span_too_short';
    }
    return null;
  }

  let ruleCompletionBlockedReason: string | null = null;
  if (!armed) {
    ruleCompletionBlockedReason = 'not_armed';
  } else if (!descendConfirmed) {
    ruleCompletionBlockedReason = 'no_descend';
  } else if (!attemptAdmissionSatisfied) {
    ruleCompletionBlockedReason = 'insufficient_relative_depth';
  } else if (!downwardCommitmentReached || committedFrame == null) {
    ruleCompletionBlockedReason = 'no_commitment';
  } else {
    ruleCompletionBlockedReason = computeBlockedAfterCommitment(reversalFrame, ascendConfirmed);
  }

  const hmmReversalAssistDecision = getSquatHmmReversalAssistDecision({
    ruleCompletionBlockedReason,
    relativeDepthPeak,
    evidenceLabel,
    hmm: options?.hmm,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    recovery,
  });

  if (hmmReversalAssistDecision.assistApplied) {
    reversalFrame =
      hasValidCommittedPeakAnchor && committedOrPostCommitPeakFrame != null
        ? committedOrPostCommitPeakFrame
        : undefined;
    ascendConfirmed = true;
    ruleCompletionBlockedReason = computeBlockedAfterCommitment(reversalFrame, ascendConfirmed);
  }

  /** PR-SQUAT-COMPLETION-REARCH-01 — B2: `squat-reversal-confirmation` official shallow stream bridge */
  const streamBridgeOut = evaluateOfficialShallowCompletionStreamBridge({
    reversalFrameFromStrict: reversalFrame,
    hmmReversalAssistApplied: hmmReversalAssistDecision.assistApplied === true,
    shallowClosureProofBundleFromStream,
    officialShallowPathCandidate,
    armed,
    descendConfirmed,
    attemptStarted,
    hasValidCommittedPeakAnchor,
    committedOrPostCommitPeakFrame,
    depthFrames,
    ascentFrame,
    squatReversalDropRequired,
    officialShallowProofCompletionReturnDrop,
  });
  reversalFrame = streamBridgeOut.reversalFrame;
  const officialShallowStreamBridgeApplied = streamBridgeOut.officialShallowStreamBridgeApplied;
  let officialShallowAscentEquivalentSatisfied = streamBridgeOut.officialShallowAscentEquivalentSatisfied;
  const officialShallowStreamCompletionReturnDrop = streamBridgeOut.officialShallowStreamCompletionReturnDrop;
  if (streamBridgeOut.ascendConfirmedOverride != null) {
    ascendConfirmed = streamBridgeOut.ascendConfirmedOverride;
    ruleCompletionBlockedReason = computeBlockedAfterCommitment(reversalFrame, ascendConfirmed);
  }

  const trajectoryRescue = getGuardedTrajectoryReversalRescue({
    reversalFrame,
    committedFrame: committedFrame ?? undefined,
    attemptStarted,
    downwardCommitmentReached,
    standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
    recovery,
    peakFrame,
    committedOrPostCommitPeakFrame,
  });
  const tailBackfill =
    trajectoryRescue.trajectoryReversalFrame == null
      ? getGuardedStandingTailReversalBackfill({
          reversalFrame,
          committedFrame: committedFrame ?? undefined,
          committedOrPostCommitPeakFrame,
          attemptStarted,
          downwardCommitmentReached,
          standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
          standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
          recovery,
          squatReversalDropRequired,
          squatReversalDropAchieved,
          minReversalToStandingMsForShallow,
        })
      : { backfilledReversalFrame: undefined, backfillApplied: false };

  let progressionReversalFrame =
    trajectoryRescue.trajectoryReversalFrame ?? tailBackfill.backfilledReversalFrame;

  const ultraShallowMeaningfulDownUpRescueApplied = shouldApplyUltraShallowMeaningfulDownUpRescue({
    progressionReversalFrame,
    officialShallowPathCandidate,
    attemptStarted,
    descendConfirmed,
    downwardCommitmentReached,
    evidenceLabel,
    revConfReversalConfirmed: revConf.reversalConfirmed,
    hmmReversalAssistApplied: hmmReversalAssistDecision.assistApplied,
    shallowClosureProofBundleFromStream,
    hasValidCommittedPeakAnchor,
    committedOrPostCommitPeakFrame,
    committedFrame,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
    standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
    recovery,
    squatReversalDropAchieved,
    squatReversalDropRequired,
  });
  if (ultraShallowMeaningfulDownUpRescueApplied && committedOrPostCommitPeakFrame != null) {
    progressionReversalFrame = committedOrPostCommitPeakFrame;
  }

  let ascendForProgression = ascendConfirmed;
  if (trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory') {
    const rf = trajectoryRescue.trajectoryReversalFrame;
    if (rf != null) {
      const explicitTrajectoryAscend = computeAscendConfirmed(rf);
      ascendForProgression = trajectoryRescueMeetsAscentIntegrity({
        explicitAscendConfirmed: explicitTrajectoryAscend,
        standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
        standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
        recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
        recoveryDropRatio: recovery.recoveryDropRatio,
        reversalAtMs: rf.timestampMs,
        minReversalToStandingMs: minReversalToStandingMsForShallow,
      });
      /**
       * PR-CAM-SQUAT-TRAJECTORY-RESCUE-OWNER-SEPARATION-01:
       * trajectory rescue는 trace/provenance 전용이므로 ruleCompletionBlockedReason을 직접 변경하지 않는다.
       * ascendForProgression은 위상(ascending/standing_recovered) 표시에만 사용한다.
       * owner truth chain(completionBlockedReason → completionSatisfied)에는 영향을 주지 않는다.
       */
    }
  } else if (tailBackfill.backfillApplied && progressionReversalFrame != null) {
    const explicitTailAscend = computeAscendConfirmed(progressionReversalFrame);
    ascendForProgression = trajectoryRescueMeetsAscentIntegrity({
      explicitAscendConfirmed: explicitTailAscend,
      standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
      standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
      recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
      recoveryDropRatio: recovery.recoveryDropRatio,
      reversalAtMs: progressionReversalFrame.timestampMs,
      minReversalToStandingMs: minReversalToStandingMsForShallow,
    });
    ruleCompletionBlockedReason = computeBlockedAfterCommitment(
      progressionReversalFrame,
      ascendForProgression
    );
  } else if (ultraShallowMeaningfulDownUpRescueApplied && progressionReversalFrame != null) {
    const rf = progressionReversalFrame;
    const explicitRescueAscend = computeAscendConfirmed(rf);
    ascendForProgression = trajectoryRescueMeetsAscentIntegrity({
      explicitAscendConfirmed: explicitRescueAscend,
      standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
      standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
      recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
      recoveryDropRatio: recovery.recoveryDropRatio,
      reversalAtMs: rf.timestampMs,
      minReversalToStandingMs: minReversalToStandingMsForShallow,
    });
    ruleCompletionBlockedReason = computeBlockedAfterCommitment(rf, ascendForProgression);
  }

  /**
   * PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02: 권위 역전 — `detectSquatReversalConfirmation`·HMM reversal assist·
   * `evaluateOfficialShallowCompletionStreamBridge` 만. trajectory/tail/ultra-shallow rescue 는 provenance 전용.
   */
  const ownerAuthoritativeReversalSatisfied =
    revConf.reversalConfirmed ||
    hmmReversalAssistDecision.assistApplied ||
    officialShallowStreamBridgeApplied;

  /** PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02: provenance-only (권위 역전을 단독으로 열지 않음). */
  const provenanceReversalEvidencePresent =
    trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory' ||
    tailBackfill.backfillApplied ||
    ultraShallowMeaningfulDownUpRescueApplied;

  /** PR-03 final: shallow 입장 후 progression 앵커가 있는데 rule 이 no_reversal 로 남는 경우 재정렬.
   * PR-CAM-SQUAT-TRAJECTORY-RESCUE-OWNER-SEPARATION-01: owner-authoritative 역전이 있을 때만 재정렬한다.
   * trajectory-only rescue가 progressionReversalFrame을 채웠을 때 잘못 no_reversal을 해제하지 않도록.
   */
  if (
    officialShallowPathCandidate &&
    attemptStarted &&
    progressionReversalFrame != null &&
    ruleCompletionBlockedReason === 'no_reversal' &&
    ownerAuthoritativeReversalSatisfied
  ) {
    ruleCompletionBlockedReason = computeBlockedAfterCommitment(
      progressionReversalFrame,
      ascendForProgression
    );
  }

  /**
   * PR-CAM-SHALLOW-LOW-ROM-TAIL-FINALIZE-01:
   * Guarded low-rom tail finalize path — activates ONLY when all upstream truth is already
   * locked (descendConfirmed + owner-authoritative strict reversal + standing detected)
   * and the ONLY remaining blocker is the continuity/drop sub-check inside
   * `low_rom_standing_finalize_not_satisfied` (frame/hold minimums were already met).
   *
   * Activation guards (ALL required):
   * - ruleCompletionBlockedReason === 'low_rom_standing_finalize_not_satisfied'
   * - finalizeReason is exactly the continuity or drop sub-check (not frame/hold failures)
   * - relativeDepthPeak in low_rom band: [LOW_ROM_LABEL_FLOOR, STANDARD_OWNER_FLOOR)
   * - descendConfirmed + progressionReversalFrame + ownerAuthoritativeReversalSatisfied
   * - Strict reversal ONLY: revConf.reversalConfirmed || hmmReversalAssistDecision.assistApplied
   * - NOT trajectory rescue / tail backfill / ultra-low meaningful down-up rescue
   * - standingRecoveredAtMs != null (standing actually detected)
   *
   * Uses existing boolean signals and existing thresholds only — no new numeric thresholds added.
   * Sets standingRecoveryFinalizeReason = 'low_rom_tail_guarded_finalize' for observability.
   */
  const lowRomTailFinalizeGuardApplied =
    ruleCompletionBlockedReason === 'low_rom_standing_finalize_not_satisfied' &&
    (standingRecoveryFinalize.finalizeReason === 'return_continuity_below_min' ||
      standingRecoveryFinalize.finalizeReason === 'recovery_drop_ratio_below_min') &&
    relativeDepthPeak >= LOW_ROM_LABEL_FLOOR &&
    relativeDepthPeak < STANDARD_OWNER_FLOOR &&
    descendConfirmed &&
    progressionReversalFrame != null &&
    ownerAuthoritativeReversalSatisfied &&
    (revConf.reversalConfirmed || hmmReversalAssistDecision.assistApplied) &&
    trajectoryRescue.trajectoryReversalConfirmedBy !== 'trajectory' &&
    !tailBackfill.backfillApplied &&
    !ultraShallowMeaningfulDownUpRescueApplied &&
    standingRecovery.standingRecoveredAtMs != null &&
    /**
     * Descent timing integrity: if relativeDepthPeak is in the timing-sensitive zone
     * (< LOW_ROM_TIMING_PEAK_MAX), the descent must have been long enough.
     * Mirrors the `descent_span_too_short` check in `computeBlockedAfterCommitment`
     * (which never ran because finalize failed first).
     * Reuses existing scope variables: no new numeric thresholds.
     */
    (relativeDepthPeak >= LOW_ROM_TIMING_PEAK_MAX ||
      selectedCanonicalDescentTimingEpoch == null ||
      peakFrame.timestampMs - selectedCanonicalDescentTimingEpoch.timestampMs >= minDescentToPeakMsForLowRom) &&
    /**
     * Reversal-to-standing timing integrity: mirrors the `ascent_recovery_span_too_short`
     * check in `computeBlockedAfterCommitment` (also skipped due to early finalize return).
     * Reuses existing scope variables: no new numeric thresholds.
     */
    (relativeDepthPeak >= SHALLOW_REVERSAL_TIMING_PEAK_MAX ||
      standingRecovery.standingRecoveredAtMs - progressionReversalFrame.timestampMs >=
        minReversalToStandingMsForShallow);

  if (lowRomTailFinalizeGuardApplied) {
    ruleCompletionBlockedReason = null;
    standingRecoveryFinalize = {
      ...standingRecoveryFinalize,
      finalizeSatisfied: true,
      finalizeReason: 'low_rom_tail_guarded_finalize',
    };
  }

  /**
   * PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03:
   * standard 밴드에서 finalize 가 이미 true 일 때, 홀드·프레임 수는 “최소 만족 tail” 기준으로 보고한다.
   * 게이트 판정은 기존 `getStandingRecoveryWindow`·`getStandingRecoveryFinalizeGate` 그대로(상수 동일).
   */
  let standingRecoveryHoldMsForOutput = standingRecovery.standingRecoveryHoldMs;
  let standingRecoveryFrameCountForOutput = standingRecovery.standingRecoveryFrameCount;
  let standingFinalizeReadyAtMs: number | null = null;
  if (
    standingRecoveryFinalizeBand === 'standard' &&
    standingRecoveryFinalize.finalizeSatisfied &&
    standingRecovery.standingRecoveredAtMs != null
  ) {
    const postPeakForNorm = depthFrames.filter((frame) => frame.index > peakFrame.index);
    const minimalTail = computeMinimalQualifyingStandingTailHold(
      postPeakForNorm,
      baselineStandingDepth,
      relativeDepthPeak,
      standingRecoveryFinalize.minFramesUsed,
      standingRecoveryFinalize.minHoldMsUsed
    );
    if (minimalTail != null) {
      standingRecoveryHoldMsForOutput = minimalTail.holdMs;
      standingRecoveryFrameCountForOutput = minimalTail.frameCount;
      standingFinalizeReadyAtMs = minimalTail.recoveredAtMs + minimalTail.holdMs;
    }
  }

  let currentSquatPhase: SquatCompletionPhase = 'idle';
  if (armed) currentSquatPhase = 'armed';
  if (descendConfirmed) currentSquatPhase = 'descending';
  if (committedFrame != null && downwardCommitmentReached) {
    currentSquatPhase = 'committed_bottom_or_downward_commitment';
  }
  if (ascendForProgression && progressionReversalFrame != null) {
    currentSquatPhase = 'ascending';
  }
  if (ascendForProgression && standingRecoveryFinalize.finalizeSatisfied) {
    currentSquatPhase = 'standing_recovered';
  }

  /** PR-HMM-02B: rule blocked reason만 HMM으로 완화 — recovery/finalize는 비터치 */
  const hmmAssistDecision = getHmmAssistDecision(options?.hmm, {
    completionBlockedReason: ruleCompletionBlockedReason,
    relativeDepthPeak,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
    ascendConfirmed: ascendForProgression,
    downwardCommitmentReached,
    attemptAdmissionSatisfied,
    committedFrameExists: committedFrame != null,
  });
  const rawPostAssistCompletionBlockedReason = hmmAssistDecision.assistApplied
    ? null
    : ruleCompletionBlockedReason;

  /**
   * PR-CAM-SQUAT-TRAJECTORY-RESCUE-OWNER-SEPARATION-01:
   * trajectory rescue만으로 progressionReversalFrame이 채워진 경우는 owner-authoritative 역전 확정이 아니다.
   * reversalConfirmedAfterDescend는 owner-authoritative 역전이 있을 때만 true로 설정한다.
   * trajectory-only rescue는 trace/provenance 용도로 trajectoryReversalRescueApplied를 통해 관측한다.
   */
  const reversalConfirmedAfterDescend =
    progressionReversalFrame != null && ownerAuthoritativeReversalSatisfied;

  const officialShallowPathAdmittedForNormalize =
    officialShallowPathCandidate && armed && descendConfirmed && attemptStarted;

  let completionBlockedReason = normalizeCompletionBlockedReasonForTerminalStage({
    completionSatisfied: rawPostAssistCompletionBlockedReason == null,
    attemptStarted,
    downwardCommitmentReached,
    reversalConfirmedAfterDescend,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
    completionBlockedReason: rawPostAssistCompletionBlockedReason,
    officialShallowPathAdmitted: officialShallowPathAdmittedForNormalize,
    officialShallowClosureProofBundle: shallowClosureProofBundleFromStream,
  });

  const postAssistCompletionBlockedReason = rawPostAssistCompletionBlockedReason;
  const assistSuppressedByFinalize =
    options?.hmm != null &&
    hmmMeetsStrongAssistEvidence(options.hmm) &&
    isRecoveryFinalizeFamilyRuleBlocked(ruleCompletionBlockedReason);

  /** PR-CAM-18: phaseHint 기반 descentFrame이 없을 때 effectiveDescentStartFrame으로 폴백 */
  const squatDescentToPeakMs =
    selectedCanonicalDescentTimingEpoch != null
      ? peakFrame.timestampMs - selectedCanonicalDescentTimingEpoch.timestampMs
      : undefined;
  const squatReversalToStandingMs =
    progressionReversalFrame != null && standingRecovery.standingRecoveredAtMs != null
      ? standingRecovery.standingRecoveredAtMs - progressionReversalFrame.timestampMs
      : undefined;

  /**
   * Subcontract C: shallow ROM 이 통과 증거를 갖추면 standard derive 보다 먼저 low/ultra_cycle 로 닫는다.
   * (standard owner 대역은 위에서 이미 분기됨)
   */
  const shallowRomClosureProofSignals =
    shallowClosureProofBundleFromStream ||
    officialShallowStreamBridgeApplied ||
    revConf.reversalConfirmed ||
    reversalConfirmedAfterDescend;

  /**
   * PR-7-CORRECTED: ultra_low_rom_cycle 직접 close 무결성 플래그.
   * stream bridge 단독으로는 ultra_low_rom_cycle 을 열 수 없다.
   * - hasValidCommittedPeakAnchor: fresh cycle anchor (baseline frozen + peak latched)
   * - revConf.reversalConfirmed || hmmReversalAssistDecision.assistApplied: rule/HMM 기반 역전만 허용
   *   (officialShallowStreamBridgeApplied 는 ownerAuthoritativeReversalSatisfied 에 포함되지만 여기서 제외)
   */
  const ultraLowRomFreshCycleIntegrity = isUltraLowRomDirectCloseEligible({
    hasValidCommittedPeakAnchor,
    reversalConfirmedByRuleOrHmm:
      revConf.reversalConfirmed || hmmReversalAssistDecision.assistApplied === true,
  });

  const shallowAdmissionContract = resolveOfficialShallowAdmissionContract({
    officialShallowPathCandidate,
    armed,
    descendConfirmed,
    attemptStarted,
    officialShallowDescentEvidenceForAdmission,
    naturalArmed,
    hmmArmingAssistApplied: options?.hmmArmingAssistApplied === true,
    pr03OfficialShallowArming,
  });

  let completionPassReason: SquatCompletionPassReason = resolveSquatCompletionPath({
    completionBlockedReason,
    relativeDepthPeak,
    evidenceLabel,
    eventBasedDescentPath,
    officialShallowPathCandidate,
    officialShallowPathAdmitted: shallowAdmissionContract.admitted,
    shallowRomClosureProofSignals,
    ultraLowRomFreshCycleIntegrity,
  });

  let completionSatisfied = completionPassReason !== 'not_confirmed';

  const officialShallowPathAdmitted = shallowAdmissionContract.admitted;
  let officialShallowPathClosed =
    completionSatisfied &&
    officialShallowPathCandidate &&
    (completionPassReason === 'low_rom_cycle' || completionPassReason === 'ultra_low_rom_cycle');
  const officialShallowPathReason: string | null = shallowAdmissionContract.reason;

  let officialShallowPathBlockedReason: string | null = null;
  if (officialShallowPathCandidate && !officialShallowPathClosed) {
    if (!armed) {
      officialShallowPathBlockedReason = officialShallowDescentEvidenceForAdmission
        ? 'not_armed'
        : 'official_shallow_pending_descent_evidence';
    } else if (!descendConfirmed) {
      officialShallowPathBlockedReason = 'no_descend';
    } else if (!attemptStarted) {
      officialShallowPathBlockedReason = 'no_downward_commitment';
    } else if (completionBlockedReason != null) {
      officialShallowPathBlockedReason = completionBlockedReason;
    }
  }

  let reversalConfirmedBy: 'rule' | 'rule_plus_hmm' | 'trajectory' | null =
    officialShallowStreamBridgeApplied
      ? 'rule'
      : hmmReversalAssistDecision.assistApplied
        ? 'rule_plus_hmm'
        : revConf.reversalConfirmed
          ? revConf.reversalSource === 'rule_plus_hmm'
            ? 'rule_plus_hmm'
            : 'rule'
          : null;
  if (trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory') {
    reversalConfirmedBy = 'trajectory';
  } else if (tailBackfill.backfillApplied) {
    reversalConfirmedBy = 'trajectory';
  } else if (ultraShallowMeaningfulDownUpRescueApplied) {
    reversalConfirmedBy = 'trajectory';
  }
  const reversalDepthDrop = officialShallowStreamBridgeApplied
    ? officialShallowStreamCompletionReturnDrop
    : hmmReversalAssistDecision.assistApplied
      ? squatReversalDropAchieved
      : revConf.reversalConfirmed
        ? revConf.reversalDepthDrop
        : ultraShallowMeaningfulDownUpRescueApplied
          ? squatReversalDropAchieved
          : null;
  const reversalFrameCount = officialShallowStreamBridgeApplied
    ? Math.max(
        3,
        committedOrPostCommitPeakFrame != null
          ? depthFrames.filter((f) => f.index > committedOrPostCommitPeakFrame.index).length
          : 0
      )
    : hmmReversalAssistDecision.assistApplied
      ? 2
      : revConf.reversalConfirmed
        ? revConf.reversalFrameCount
        : ultraShallowMeaningfulDownUpRescueApplied
          ? Math.max(
              3,
              committedOrPostCommitPeakFrame != null
                ? depthFrames.filter((f) => f.index > committedOrPostCommitPeakFrame.index).length
                : 0
            )
          : null;

  const trajectoryReversalRescueApplied = trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory';
  const reversalTailApplied = tailBackfill.backfillApplied;
  const pr02AssistSources = buildSquatCompletionAssistSources({
    hmmAssistApplied: hmmAssistDecision.assistApplied,
    hmmReversalAssistApplied: hmmReversalAssistDecision.assistApplied,
    trajectoryReversalRescueApplied,
    reversalTailBackfillApplied: reversalTailApplied,
    ultraShallowMeaningfulDownUpRescueApplied,
    eventCyclePromoted: false,
  });

  /** PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02: standing 복귀·finalize 권위 축(관측). */
  const ownerAuthoritativeRecoverySatisfied =
    ownerAuthoritativeReversalSatisfied === true &&
    standingRecovery.standingRecoveredAtMs != null &&
    standingRecoveryFinalize.finalizeSatisfied === true;

  const reversalLabeledTrajectoryForShallowClosure =
    trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory' ||
    reversalTailApplied ||
    ultraShallowMeaningfulDownUpRescueApplied;

  const shallowAuthoritativeClosureDecision = getShallowAuthoritativeClosureDecision({
    completionAlreadySatisfied: completionSatisfied,
    completionPassReason,
    officialShallowPathCandidate,
    officialShallowPathAdmitted: shallowAdmissionContract.admitted,
    attemptStarted,
    descendConfirmed,
    armed,
    downwardCommitmentReached,
    committedFrame,
    relativeDepthPeak,
    eventBasedDescentPath,
    peakLatchedAtIndex: committedOrPostCommitPeakFrame?.index ?? null,
    hasValidCommittedPeakAnchor,
    committedOrPostCommitPeakFrame,
    ownerAuthoritativeReversalSatisfied,
    ownerAuthoritativeRecoverySatisfied,
    officialShallowStreamBridgeApplied,
    officialShallowAscentEquivalentSatisfied,
    shallowClosureProofBundleFromStream,
    officialShallowPrimaryDropClosureFallback,
    squatReversalDropAchieved,
    squatReversalDropRequired,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
    standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
    standingRecoveryFinalizeBand,
    recovery,
    provenanceReversalEvidencePresent,
    reversalLabeledTrajectory: reversalLabeledTrajectoryForShallowClosure,
  });

  let ownerAuthoritativeShallowClosureSatisfied = false;
  let shallowAuthoritativeClosureReason: string | null = null;
  let shallowAuthoritativeClosureBlockedReason: string | null =
    shallowAuthoritativeClosureDecision.shallowAuthoritativeClosureBlockedReason;

  /**
   * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: core 내부 direct closer 제거.
   * shallowAuthoritativeClosureDecision 은 이후 canonical contract 의 evidence input 으로만 사용.
   * shallow success write 는 evaluateSquatCompletionState() tail 의
   * applyCanonicalShallowClosureFromContract() 단일 helper 에서만 일어난다.
   */

  const pr02FinalizeMode = deriveSquatCompletionFinalizeMode({
    completionSatisfied,
    eventCyclePromoted: false,
    assistSourcesWithoutPromotion: pr02AssistSources,
    officialShallowAuthoritativeClosure: ownerAuthoritativeShallowClosureSatisfied,
  });
  const pr02AssistMode = deriveSquatCompletionAssistMode(pr02AssistSources);
  const pr02ReversalProv = deriveSquatReversalEvidenceProvenance({
    officialShallowStreamBridgeApplied,
    trajectoryReversalRescueApplied,
    reversalTailBackfillApplied: reversalTailApplied,
    ultraShallowMeaningfulDownUpRescueApplied,
    hmmReversalAssistApplied: hmmReversalAssistDecision.assistApplied,
    revConfReversalConfirmed: revConf.reversalConfirmed,
    revConfSource: revConf.reversalSource,
  });

  return {
    baselineStandingDepth,
    rawDepthPeak,
    relativeDepthPeak,
    currentSquatPhase,
    attemptStarted,
    descendConfirmed,
    downwardCommitmentReached,
    committedAtMs: committedFrame?.timestampMs,
    reversalAtMs: progressionReversalFrame?.timestampMs,
    ascendConfirmed: ascendForProgression,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryHoldMs: standingRecoveryHoldMsForOutput,
    successPhaseAtOpen: completionSatisfied ? 'standing_recovered' : undefined,
    evidenceLabel,
    completionBlockedReason,
    completionSatisfied,
    startBeforeBottom,
    bottomDetected,
    recoveryDetected,
    cycleComplete: completionSatisfied,
    /** PR-CAM-18: phaseHint 'descent' 없는 경우 effectiveDescentStartFrame 타임스탬프로 폴백 */
    descendStartAtMs: selectedCanonicalDescentTimingEpoch?.timestampMs,
    peakAtMs: peakFrame.timestampMs,
    ascendStartAtMs: ascentFrame?.timestampMs,
    cycleDurationMs:
      selectedCanonicalDescentTimingEpoch != null && standingRecovery.standingRecoveredAtMs != null
        ? standingRecovery.standingRecoveredAtMs - selectedCanonicalDescentTimingEpoch.timestampMs
        : undefined,
    downwardCommitmentDelta,
    standingRecoveryFrameCount: standingRecoveryFrameCountForOutput,
    standingRecoveryThreshold: standingRecovery.standingRecoveryThreshold,
    standingRecoveryMinFramesUsed: standingRecoveryFinalize.minFramesUsed,
    standingRecoveryMinHoldMsUsed: standingRecoveryFinalize.minHoldMsUsed,
    standingRecoveryBand: standingRecoveryFinalizeBand,
    standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
    lowRomRecoveryReason: recovery.lowRomRecoveryReason ?? null,
    ultraLowRomRecoveryReason: recovery.ultraLowRomRecoveryReason ?? null,
    recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
    recoveryTrailingDepthCount: recovery.trailingDepthCount,
    recoveryDropRatio: recovery.recoveryDropRatio,
    squatReversalDropRequired,
    squatReversalDropAchieved,
    squatDescentToPeakMs,
    squatReversalToStandingMs,
    completionMachinePhase: deriveSquatCompletionMachinePhase({
      completionSatisfied,
      currentSquatPhase,
      downwardCommitmentReached,
    }),
    completionPassReason,
    hmmAssistEligible: hmmAssistDecision.assistEligible,
    hmmAssistApplied: hmmAssistDecision.assistApplied,
    hmmAssistReason: hmmAssistDecision.assistReason,
    ruleCompletionBlockedReason,
    postAssistCompletionBlockedReason,
    assistSuppressedByFinalize,
    hmmReversalAssistEligible: hmmReversalAssistDecision.assistEligible,
    hmmReversalAssistApplied: hmmReversalAssistDecision.assistApplied,
    hmmReversalAssistReason: hmmReversalAssistDecision.assistReason,
    reversalConfirmedBy,
    reversalTailBackfillApplied: tailBackfill.backfillApplied,
    ultraShallowMeaningfulDownUpRescueApplied,
    reversalDepthDrop,
    reversalFrameCount,
    rawDepthPeakPrimary,
    rawDepthPeakBlended,
    relativeDepthPeakSource,
    baselineFrozen: depthFreeze != null,
    baselineFrozenDepth: depthFreeze != null ? depthFreeze.frozenBaselineStandingDepth : null,
    peakLatched: depthFreeze != null && committedOrPostCommitPeakFrame != null,
    peakLatchedAtIndex: committedOrPostCommitPeakFrame?.index ?? null,
    peakAnchorTruth:
      committedOrPostCommitPeakFrame != null ? 'committed_or_post_commit_peak' : undefined,
    eventCyclePromoted: false,
    eventCycleSource: null,
    reversalConfirmedAfterDescend,
    recoveryConfirmedAfterReversal:
      standingRecovery.standingRecoveredAtMs != null && progressionReversalFrame != null,
    /**
     * PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS: rule/HMM 역전 확인 여부 (bridge 제외).
     * isUltraLowRomDirectCloseEligible의 reversalConfirmedByRuleOrHmm과 동일 계산.
     * canonical shallow contract의 weakEventProofSubstitutionBlocked 게이트 강화용.
     * stream bridge는 ownerAuthoritativeReversalSatisfied를 true로 만들지만,
     * weak-event 패턴(eventCycleDetected=false, descentFrames=0)에서 단독으로
     * 게이트를 통과할 수 없다. rule 또는 HMM 확인이 필요하다.
     */
    reversalConfirmedByRuleOrHmm:
      revConf.reversalConfirmed || hmmReversalAssistDecision.assistApplied === true,
    eventBasedDescentPath,
    baselineSeeded: hasFiniteSeedPrimary,
    trajectoryReversalRescueApplied,
    completionFinalizeMode: pr02FinalizeMode,
    completionAssistApplied: pr02AssistSources.length > 0,
    completionAssistSources: pr02AssistSources,
    completionAssistMode: pr02AssistMode,
    promotionBaseRuleBlockedReason: null,
    reversalEvidenceProvenance: pr02ReversalProv,
    officialShallowPathCandidate,
    officialShallowPathAdmitted,
    officialShallowPathClosed,
    officialShallowPathReason,
    officialShallowPathBlockedReason,
    officialShallowStreamBridgeApplied,
    officialShallowAscentEquivalentSatisfied,
    /**
     * PR-03 shallow closure final: 닫힘·stream 번들·primary 폴백 번들 중 하나면 closure proof 축 true.
     * (strict primary 역전만으로 닫힌 경우 officialShallowPathClosed 와 함께 true)
     */
    officialShallowClosureProofSatisfied:
      officialShallowPathClosed ||
      shallowClosureProofBundleFromStream ||
      officialShallowStreamBridgeApplied ||
      officialShallowPrimaryDropClosureFallback === true,
    officialShallowPrimaryDropClosureFallback,
    officialShallowReversalSatisfied:
      reversalConfirmedAfterDescend ||
      options?.guardedShallowRecoveredSuffixClosureApply === true,
    ownerAuthoritativeReversalSatisfied,
    ownerAuthoritativeRecoverySatisfied,
    provenanceReversalEvidencePresent,
    ownerAuthoritativeShallowClosureSatisfied,
    shallowAuthoritativeClosureReason,
    shallowAuthoritativeClosureBlockedReason,
    shallowTrajectoryBridgeEligible: false,
    shallowTrajectoryBridgeSatisfied: false,
    shallowTrajectoryBridgeBlockedReason: null,
    guardedShallowTrajectoryClosureProofSatisfied: false,
    guardedShallowTrajectoryClosureProofBlockedReason: null,
    standingFinalizeSatisfied: standingRecoveryFinalize.finalizeSatisfied,
    standingFinalizeSuppressedByLateSetup: false,
    standingFinalizeReadyAtMs,
    // PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Branch B §7 additive diagnostics.
    legitimateKinematicShallowDescentOnsetFrameIndex:
      legitimateKinematicShallowDescentOnsetFrame?.index ?? null,
    legitimateKinematicShallowDescentOnsetAtMs:
      legitimateKinematicShallowDescentOnsetFrame?.timestampMs ?? null,
    legitimateKinematicShallowDescentOnsetKneeAngleAvg:
      legitimateKinematicOnset?.kneeAngleAtOnset ?? null,
    legitimateKinematicShallowDescentBaselineKneeAngleAvg: baselineKneeAngleAvgValue,
    effectiveDescentStartFrameSource: selectedCanonicalDescentTimingEpoch?.source ?? null,
    descentAnchorCoherent,
    preArmingKinematicDescentEpochValidIndex:
      preArmingKinematicEpoch?.descentOnsetValidIndex ?? null,
    preArmingKinematicDescentEpochAtMs:
      preArmingKinematicEpoch?.descentOnsetAtMs ?? null,
    preArmingKinematicDescentEpochAccepted:
      preArmingKinematicEpochDecision.timingEpoch != null,
    preArmingKinematicDescentEpochRejectedReason:
      preArmingKinematicEpochDecision.rejectedReason,
    preArmingKinematicDescentEpochCompletionSliceStartIndex:
      preArmingKinematicEpoch?.completionSliceStartIndex ?? null,
    preArmingKinematicDescentEpochPeakGuardValidIndex:
      preArmingKinematicEpoch?.peakGuardValidIndex ?? null,
    preArmingKinematicDescentEpochProof:
      preArmingKinematicEpoch?.proof ?? null,
    selectedCanonicalDescentTimingEpochSource:
      selectedCanonicalDescentTimingEpoch?.source ?? null,
    selectedCanonicalDescentTimingEpochValidIndex:
      selectedCanonicalDescentTimingEpoch?.validIndex ?? null,
    selectedCanonicalDescentTimingEpochAtMs:
      selectedCanonicalDescentTimingEpoch?.timestampMs ?? null,
    normalizedDescentAnchorCoherent,
  };
}

/**
 * PR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01: ultra-low-rom **event promotion** 만 상승/역전 무결성으로 한 번 더 좁힘.
 * (rule completion·reversal 디텍터·임계값은 변경하지 않음)
 */
export function ultraLowRomEventPromotionMeetsAscentIntegrity(
  state: Pick<
    SquatCompletionState,
    | 'relativeDepthPeak'
    | 'evidenceLabel'
    | 'reversalConfirmedAfterDescend'
    | 'recoveryConfirmedAfterReversal'
    | 'ascendConfirmed'
    | 'standingRecoveredAtMs'
    | 'standingRecoveryFinalizeReason'
    | 'squatReversalToStandingMs'
  >
): boolean {
  if (!(state.relativeDepthPeak < LOW_ROM_LABEL_FLOOR)) return false;
  if (state.evidenceLabel !== 'ultra_low_rom') return false;
  if (state.ascendConfirmed !== true) return false;
  if (state.standingRecoveredAtMs == null) return false;

  const finalizeOk =
    state.standingRecoveryFinalizeReason === 'standing_hold_met' ||
    state.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize';

  if (!finalizeOk) return false;

  if (state.reversalConfirmedAfterDescend === true) return true;

  return (
    state.squatReversalToStandingMs != null && state.squatReversalToStandingMs >= 180
  );
}


/**
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract C: full-buffer standard drift vs shallow prefix closure.
 * shallow 가 먼저 닫힌 프리픽스가 있으면 그 truth 를 채택하고 drift 관측을 정리한다.
 *
 * PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03:
 * PR-B 이후 official_shallow_cycle 은 canonical closer(tail) 에서만 열리므로,
 * prefix scan 에서 official_shallow_cycle 문자열 단독 의존은 사실상 dead.
 * 대신 prefix core state 기반으로 canonical contract 를 직접 평가해 shallow closed truth 를 판단한다.
 * → prefix마다 evaluateSquatCompletionState 전체를 재호출하지 않는다(policy/attach/late-patch 제외).
 */
export function resolveStandardDriftAfterShallowAdmission(
  coreState: SquatCompletionState,
  frames: PoseFeaturesFrame[],
  options: EvaluateSquatCompletionStateOptions | undefined,
  depthFreeze: SquatDepthFreezeConfig | null
): SquatCompletionState {
  const MIN_SHALLOW_PREFIX_SCAN = Math.max(8, MIN_BASELINE_FRAMES + 2);
  let firstOfficialShallowClosedPrefix: SquatCompletionState | null = null;
  let firstOfficialShallowClosedLen: number | null = null;
  let sawOfficialShallowAdmissionOnPrefix = false;
  if (frames.length >= MIN_SHALLOW_PREFIX_SCAN) {
    for (let n = MIN_SHALLOW_PREFIX_SCAN; n <= frames.length; n++) {
      const sn = evaluateSquatCompletionCore(frames.slice(0, n), options, depthFreeze);
      if (!sawOfficialShallowAdmissionOnPrefix && sn.officialShallowPathCandidate && sn.officialShallowPathAdmitted) {
        sawOfficialShallowAdmissionOnPrefix = true;
      }
      if (firstOfficialShallowClosedPrefix == null && sn.relativeDepthPeak < STANDARD_OWNER_FLOOR) {
        /**
         * PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03:
         * 1) 기존 low_rom_cycle / ultra_low_rom_cycle core 경로(직접 closed)
         * 2) PR-B 이후 canonical contract satisfied — official_shallow_cycle 문자열 불필요
         */
        const legacyCoreShallowClosed =
          sn.officialShallowPathClosed === true &&
          (sn.completionPassReason === 'low_rom_cycle' ||
            sn.completionPassReason === 'ultra_low_rom_cycle');
        const prefixCanonicalContract = deriveCanonicalShallowCompletionContract(
          buildCanonicalShallowContractInputFromStateImpl(sn)
        );
        const canonicalShallowCloseable = prefixCanonicalContract.satisfied === true;

        if (legacyCoreShallowClosed || canonicalShallowCloseable) {
          firstOfficialShallowClosedPrefix = sn;
          firstOfficialShallowClosedLen = n;
          break;
        }
      }
    }
  }

  let state = coreState;
  let officialShallowDriftedToStandard = false;
  let officialShallowDriftReason: string | null = null;
  let officialShallowPreferredPrefixFrameCount: number | null = null;

  if (
    state.completionSatisfied &&
    state.completionPassReason === 'standard_cycle' &&
    state.relativeDepthPeak >= STANDARD_OWNER_FLOOR - 1e-9 &&
    firstOfficialShallowClosedPrefix != null &&
    firstOfficialShallowClosedLen != null
  ) {
    state = {
      ...firstOfficialShallowClosedPrefix,
      officialShallowDriftedToStandard: false,
      officialShallowDriftReason: null,
      officialShallowPreferredPrefixFrameCount: firstOfficialShallowClosedLen,
    };
  } else {
    const driftObserved =
      state.completionSatisfied &&
      state.completionPassReason === 'standard_cycle' &&
      state.relativeDepthPeak >= STANDARD_OWNER_FLOOR - 1e-9 &&
      sawOfficialShallowAdmissionOnPrefix;
    officialShallowDriftedToStandard = driftObserved;
    officialShallowDriftReason = driftObserved
      ? 'standard_cycle_full_buffer_after_official_shallow_admission'
      : null;
    officialShallowPreferredPrefixFrameCount = null;
    state = {
      ...state,
      officialShallowDriftedToStandard,
      officialShallowDriftReason,
      officialShallowPreferredPrefixFrameCount,
    };
  }

  if (state.officialShallowPathClosed === true) {
    state = {
      ...state,
      officialShallowDriftedToStandard: false,
      officialShallowDriftReason: null,
    };
  }

  return state;
}


/**
 * PR-2-SHALLOW-CONTRACT-NORMALIZATION: Single canonical set of shallow contract blocker families.
 *
 * These four sets are the sole classification source for completionBlockedReason → blocker family.
 * Both mapCompletionBlockedReasonToShallowNormalizedBlockerFamily (active policy gate input)
 * and computeAuthoritativeShallowStageForObservability (legacy compat observability) delegate
 * to the same classification rather than maintaining separate parallel set definitions.
 *
 * The old SHALLOW_OBS_* sets (4 constants) are removed in PR-2.
 * These SHALLOW_CONTRACT_BLOCKER_* sets replace them as the single classification source.
 */

/** admission blockers — attempt not yet started or depth commitment not reached. */
const SHALLOW_CONTRACT_BLOCKER_ADMISSION = new Set<string>([
  'not_armed',
  'no_descend',
  'insufficient_relative_depth',
  'no_commitment',
  /** freeze/latch missing: observed on real device alongside completion; classified admission (can split in PR-3+). */
  'freeze_or_latch_missing',
]);

/** reversal blockers — descent confirmed but reversal or ascent not detected. */
const SHALLOW_CONTRACT_BLOCKER_REVERSAL = new Set<string>(['no_reversal', 'no_ascend']);

/** policy blockers — product-level or rescue-level gate blocked. */
const SHALLOW_CONTRACT_BLOCKER_POLICY = new Set<string>([
  'ultra_low_rom_not_allowed',
  'trajectory_rescue_not_allowed',
  'event_promotion_not_allowed',
]);

/** standing/finalize blockers — reversal seen but standing recovery finalize not met. */
const SHALLOW_CONTRACT_BLOCKER_FINALIZE = new Set<string>([
  'not_standing_recovered',
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
]);


/**
 * PR-2-SHALLOW-CONTRACT-NORMALIZATION / PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01:
 * `completionBlockedReason` + `completionSatisfied` 만으로 정규 패밀리를 낸다(임계·차단 로직 미변경).
 *
 * Single classification source — uses SHALLOW_CONTRACT_BLOCKER_* sets.
 * computeAuthoritativeShallowStageForObservability also delegates here, eliminating parallel sets.
 *
 * Active usage: `applyUltraLowPolicyLock` (via `isUltraLowPolicyDecisionReady`).
 * Legacy compat usage: feeds deprecated `shallowNormalizedBlockerFamily` state field.
 * New debug: prefer `canonicalShallowContractBlockedReason` (PRIMARY axis).
 */
export function mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
  completionBlockedReason: string | null,
  completionSatisfied: boolean
): ShallowNormalizedBlockerFamily {
  if (completionSatisfied) return 'closed';
  const r = completionBlockedReason;
  if (r == null || r === '') return 'none';
  if (r.startsWith('setup_motion:')) return 'admission';
  if (SHALLOW_CONTRACT_BLOCKER_ADMISSION.has(r)) return 'admission';
  if (SHALLOW_CONTRACT_BLOCKER_REVERSAL.has(r)) return 'reversal';
  if (SHALLOW_CONTRACT_BLOCKER_POLICY.has(r)) return 'policy';
  if (SHALLOW_CONTRACT_BLOCKER_FINALIZE.has(r)) return 'standing_finalize';
  return 'none';
}
