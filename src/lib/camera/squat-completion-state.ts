import type { PoseFeaturesFrame } from './pose-features';
import { getSquatRecoverySignal } from './pose-features';
import {
  deriveSquatCompletionMachinePhase,
  deriveSquatCompletionPassReason,
  type SquatCompletionMachinePhase,
  type SquatCompletionPassReason,
} from '@/lib/camera/squat-completion-machine';
import type { MotionCompletionResult } from '@/lib/camera/types/motion-completion';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';
import { getHmmAssistDecision, hmmMeetsStrongAssistEvidence } from '@/lib/camera/squat/squat-hmm-assist';
import { getSquatHmmReversalAssistDecision } from '@/lib/camera/squat/squat-reversal-assist';
import {
  detectSquatReversalConfirmation,
  readSquatCompletionDepthForReversal,
} from '@/lib/camera/squat/squat-reversal-confirmation';
import {
  detectSquatEventCycle,
  type SquatEventCycleResult,
} from '@/lib/camera/squat/squat-event-cycle';

/** PR-04E3B: 첫 attemptStarted 시점에 고정한 스트림·baseline — 동일 버퍼 내 재평가 없음 */
type SquatDepthFreezeConfig = {
  lockedRelativeDepthPeakSource: 'primary' | 'blended';
  frozenBaselineStandingDepth: number;
};

/** PR-04E3A: completion peak / relative depth / 밴드 — PR-04E1 blended 우선 (arming·reversal 과 동일 read) */
export function readSquatCompletionDepth(frame: PoseFeaturesFrame): number | null {
  return readSquatCompletionDepthForReversal(frame);
}

export type SquatCompletionPhase =
  | 'idle'
  | 'armed'
  | 'descending'
  | 'committed_bottom_or_downward_commitment'
  | 'ascending'
  | 'standing_recovered';

export type SquatEvidenceLabel =
  | 'standard'
  | 'low_rom'
  | 'ultra_low_rom'
  | 'insufficient_signal';

/**
 * PR-02 Assist lock: completion 이 어떻게 최종 확정됐는지(관측·trace 전용).
 * success owner 가 아님 — PR-01 owner 는 completion truth 라인age 별도.
 */
export type SquatCompletionFinalizeMode =
  | 'blocked'
  | 'rule_finalized'
  | 'assist_augmented_finalized'
  | 'event_promoted_finalized';

/** PR-02: 어떤 assist 채널이 개입했는지(OR 목록) */
export type SquatCompletionAssistSource =
  | 'hmm_blocked_reason'
  | 'hmm_reversal'
  | 'trajectory_reversal_rescue'
  | 'standing_tail_backfill'
  | 'event_cycle_promotion';

/** PR-02: assist 축 단일 요약(복수면 mixed) */
export type SquatCompletionAssistMode =
  | 'none'
  | 'hmm_segmentation'
  | 'hmm_reversal'
  | 'reversal_trajectory'
  | 'reversal_tail'
  | 'event_promotion'
  | 'mixed';

/** PR-02: 역전 앵커 증거 출처 — pass owner 아님 */
export type SquatReversalEvidenceProvenance =
  | 'strict_rule'
  | 'rule_plus_hmm_detection'
  | 'hmm_reversal_assist'
  | 'trajectory_anchor_rescue'
  | 'standing_tail_backfill';

export interface SquatCompletionState extends MotionCompletionResult {
  baselineStandingDepth: number;
  rawDepthPeak: number;
  relativeDepthPeak: number;
  currentSquatPhase: SquatCompletionPhase;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  downwardCommitmentReached: boolean;
  committedAtMs?: number;
  reversalAtMs?: number;
  ascendConfirmed: boolean;
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs: number;
  successPhaseAtOpen?: 'standing_recovered';
  evidenceLabel: SquatEvidenceLabel;
  startBeforeBottom: boolean;
  bottomDetected: boolean;
  recoveryDetected: boolean;
  cycleComplete: boolean;
  descendStartAtMs?: number;
  peakAtMs?: number;
  ascendStartAtMs?: number;
  cycleDurationMs?: number;
  downwardCommitmentDelta: number;
  standingRecoveryFrameCount: number;
  standingRecoveryThreshold: number;
  standingRecoveryMinFramesUsed: number;
  standingRecoveryMinHoldMsUsed: number;
  standingRecoveryBand: SquatEvidenceLabel;
  standingRecoveryFinalizeReason: string | null;
  lowRomRecoveryReason: string | null;
  ultraLowRomRecoveryReason: string | null;
  recoveryReturnContinuityFrames?: number;
  recoveryTrailingDepthCount?: number;
  recoveryDropRatio?: number;
  /** PR-CAM-02: 역전에 요구된 depth 하락량( squatDepthProxy 단위 ) */
  squatReversalDropRequired?: number;
  /** PR-CAM-02: 피크 이후 실제 관측 최대 하락량 */
  squatReversalDropAchieved?: number;
  /** PR-CAM-02: 첫 하강~피크 시간 */
  squatDescentToPeakMs?: number;
  /** PR-CAM-02: 역전(피크) 시각~서 있기 복귀 시각 */
  squatReversalToStandingMs?: number;
  /** PR-COMP-01: 트레이스용 completion 상태기계 단계 */
  completionMachinePhase: SquatCompletionMachinePhase;
  /** PR-COMP-01: 통과 시 ROM 사이클 분류 / 미통과 not_confirmed */
  completionPassReason: SquatCompletionPassReason;
  /** PR-HMM-02B: HMM blocked-reason assist trace (pass gate 소유권은 rule 유지) */
  hmmAssistEligible?: boolean;
  hmmAssistApplied?: boolean;
  hmmAssistReason?: string | null;
  /** PR-HMM-03A: assist 적용 전 순수 rule 체인 blocked reason */
  ruleCompletionBlockedReason?: string | null;
  /** PR-HMM-03A: assist 반영 후 최종 blocked (= completionBlockedReason 과 동일 의미, 명시 보존) */
  postAssistCompletionBlockedReason?: string | null;
  /**
   * PR-HMM-03A: HMM assist 임계는 충족했으나 rule이 지목한 차단이 recovery/finalize 계열.
   * segmentation assist로는 열 수 없음 — shallow 실기기 calibration 구분용.
   */
  assistSuppressedByFinalize?: boolean;
  /** PR-HMM-04B: 깊은 no_reversal 시 HMM ascent 역전 보조 */
  hmmReversalAssistEligible?: boolean;
  hmmReversalAssistApplied?: boolean;
  hmmReversalAssistReason?: string | null;
  /** PR-04E2: 역전 확정 경로 — completion-state 소유, HMM assist와 별도 rule_plus_hmm bridge 가능 */
  /** PR-CAM-31: 명시 역전 미탐 시 guarded trajectory 구조 보조( finalize·복귀 증거 잠금 후에만 ) */
  reversalConfirmedBy?: 'rule' | 'rule_plus_hmm' | 'trajectory' | null;
  /** PR-CAM-REVERSAL-TAIL-BACKFILL-01: standing tail 증거로 역전 앵커만 늦게 backfill (성공 게이트 아님) */
  reversalTailBackfillApplied?: boolean;
  reversalDepthDrop?: number | null;
  reversalFrameCount?: number | null;
  /** PR-04E3A: primary 스트림 피크(관측) — relative 선택과 독립 */
  rawDepthPeakPrimary?: number;
  rawDepthPeakBlended?: number;
  /** PR-04E3A: relativeDepthPeak·rawDepthPeak 계산에 쓴 스트림 */
  relativeDepthPeakSource?: 'primary' | 'blended';
  /** PR-04E3B: attempt 시작 후 baseline 고정 적용 여부 */
  baselineFrozen?: boolean;
  baselineFrozenDepth?: number | null;
  peakLatched?: boolean;
  peakLatchedAtIndex?: number | null;
  /** PR-CAM-PEAK-ANCHOR-INTEGRITY-02: event-cycle·trace용 — 피크 래치가 commitment-safe 앵커일 때만 */
  peakAnchorTruth?: 'committed_or_post_commit_peak';
  /** PR-CAM-ARMING-BASELINE-HANDOFF-01: arming standing primary baseline 이 completion 에 seed 됨 */
  baselineSeeded?: boolean;
  eventCyclePromoted?: boolean;
  eventCycleSource?: 'rule' | 'rule_plus_hmm' | null;
  /** PR-04E3B: shallow event-cycle 헬퍼 결과(관측·승격 판단 입력) */
  squatEventCycle?: SquatEventCycleResult;
  /** PR-CAM-18: phaseHint descent 없이 trajectory 폴백으로 하강 인정 시 true — pass reason *_event_cycle 구분 */
  eventBasedDescentPath?: boolean;
  /**
   * PR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01: progression 역전 프레임 존재 — ultra-low event 승격 게이트 입력.
   * (JSON/트레이스 `reversalConfirmedAfterDescend` 와 동일 의미로 유지)
   */
  reversalConfirmedAfterDescend?: boolean;
  /**
   * PR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01: 역전 이후 서 있기 복귀 — 트레이스 보존.
   */
  recoveryConfirmedAfterReversal?: boolean;
  /** PR-02: guarded trajectory rescue 가 역전 앵커를 열었는지(assist provenance) */
  trajectoryReversalRescueApplied?: boolean;
  /** PR-02: finalize / assist 축 — JSON 에서 owner 와 분리해 읽기 */
  completionFinalizeMode?: SquatCompletionFinalizeMode;
  completionAssistApplied?: boolean;
  completionAssistSources?: SquatCompletionAssistSource[];
  completionAssistMode?: SquatCompletionAssistMode;
  /**
   * PR-02: event promotion 직전 rule 단계 blocked reason(승격 시에만 채움).
   * assist 가 owner 처럼 막힌 이유를 지운 것이 아니라, 어떤 rule 에서 승격했는지 추적.
   */
  promotionBaseRuleBlockedReason?: string | null;
  /** PR-02: 역전 증거 레인 — trajectory/tail/HMM 구분 */
  reversalEvidenceProvenance?: SquatReversalEvidenceProvenance | null;
}

/** PR-HMM-02B: optional HMM shadow 입력 — completion truth는 rule 우선 */
export type EvaluateSquatCompletionStateOptions = {
  hmm?: SquatHmmDecodeResult;
  /**
   * PR-HMM-04A: HOTFIX arming이 synthetic일 때만 evaluator가 넘김.
   * 내부 `armed` 게이트만 OR — finalize·pass 소유권·HMM blocked assist와 무관.
   */
  hmmArmingAssistApplied?: boolean;
  /**
   * PR-CAM-ARMING-BASELINE-HANDOFF-01: 검증된 standing 윈도우 baseline — slice 앞 6프레임 재추정보다 우선.
   */
  seedBaselineStandingDepthPrimary?: number;
  seedBaselineStandingDepthBlended?: number;
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
  eventCyclePromoted: boolean;
}): SquatCompletionAssistSource[] {
  const out: SquatCompletionAssistSource[] = [];
  if (input.hmmAssistApplied) out.push('hmm_blocked_reason');
  if (input.hmmReversalAssistApplied) out.push('hmm_reversal');
  if (input.trajectoryReversalRescueApplied) out.push('trajectory_reversal_rescue');
  if (input.reversalTailBackfillApplied) out.push('standing_tail_backfill');
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
    if (u === 'event_cycle_promotion') return 'event_promotion';
  }
  return 'mixed';
}

function deriveSquatCompletionFinalizeMode(input: {
  completionSatisfied: boolean;
  eventCyclePromoted: boolean;
  assistSourcesWithoutPromotion: SquatCompletionAssistSource[];
}): SquatCompletionFinalizeMode {
  if (!input.completionSatisfied) return 'blocked';
  if (input.eventCyclePromoted) return 'event_promoted_finalized';
  if (input.assistSourcesWithoutPromotion.length === 0) return 'rule_finalized';
  return 'assist_augmented_finalized';
}

function deriveSquatReversalEvidenceProvenance(input: {
  trajectoryReversalRescueApplied: boolean;
  reversalTailBackfillApplied: boolean;
  hmmReversalAssistApplied: boolean;
  revConfReversalConfirmed: boolean;
  revConfSource: 'rule' | 'rule_plus_hmm' | 'none';
}): SquatReversalEvidenceProvenance | null {
  if (input.trajectoryReversalRescueApplied) return 'trajectory_anchor_rescue';
  if (input.reversalTailBackfillApplied) return 'standing_tail_backfill';
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

function buildSquatCompletionDepthRows(validFrames: PoseFeaturesFrame[]): SquatCompletionDepthRow[] {
  const depthRows: SquatCompletionDepthRow[] = [];
  for (let vi = 0; vi < validFrames.length; vi++) {
    const frame = validFrames[vi]!;
    const p = frame.derived.squatDepthProxy;
    if (typeof p !== 'number' || !Number.isFinite(p)) continue;
    const cRead = readSquatCompletionDepth(frame);
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

const BASELINE_WINDOW = 6;
const MIN_BASELINE_FRAMES = 4;
const LEGACY_ATTEMPT_FLOOR = 0.02;
const GUARDED_ULTRA_LOW_ROM_FLOOR = 0.01;
const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_LABEL_FLOOR = 0.1;
/**
 * PR-CAM-22: standard owner는 evidence label보다 더 깊은 성공에만 부여한다.
 *
 * evidenceLabel 은 interpretation/quality 범주라 0.10부터 broad하게 standard를 허용하지만,
 * pass owner는 더 보수적으로 잡아 observed shallow/moderate success(relativeDepthPeak ~0.30)가
 * standard_cycle을 너무 일찍 먹지 않게 한다.
 */
const STANDARD_OWNER_FLOOR = 0.4;
const STANDING_RECOVERY_TOLERANCE_FLOOR = 0.015;
const STANDING_RECOVERY_TOLERANCE_RATIO = 0.18;
const MIN_STANDING_RECOVERY_FRAMES = 2;
const MIN_STANDING_RECOVERY_HOLD_MS = 160;
const LOW_ROM_STANDING_RECOVERY_MIN_FRAMES = 2;
const LOW_ROM_STANDING_RECOVERY_MIN_HOLD_MS = 60;
const LOW_ROM_STANDING_FINALIZE_MIN_RETURN_CONTINUITY_FRAMES = 3;
const LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO = 0.45;
/** PR-CAM-02: 절대 최소 되돌림(미세 노이즈 역전 차단) */
const REVERSAL_DROP_MIN_ABS = 0.007;
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
function recoveryMeetsLowRomStyleFinalizeProof(
  recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>
): boolean {
  return (
    (recovery.recoveryReturnContinuityFrames ?? 0) >= LOW_ROM_STANDING_FINALIZE_MIN_RETURN_CONTINUITY_FRAMES &&
    (recovery.recoveryDropRatio ?? 0) >= LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO
  );
}

/**
 * PR-CAM-ASCENT-INTEGRITY-RESCUE-01: trajectory rescue는 reversal 앵커만 줄 수 있고, ascent truth 는
 * 명시 상승 증거 또는 (finalize + low-ROM 복귀 증거 + 역전→스탠딩 타이밍)을 만족할 때만 true.
 * 새 threshold 없음 — `recoveryMeetsLowRomStyleFinalizeProof` 및 호출부 `minReversalToStandingMs` 재사용.
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
  if (
    args.committedFrame != null &&
    args.attemptStarted &&
    args.downwardCommitmentReached &&
    finalizeOk &&
    recoveryMeetsLowRomStyleFinalizeProof(args.recovery) &&
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
}): string | null {
  if (args.completionSatisfied) return null;

  const cur = args.completionBlockedReason;

  if (args.standingRecoveredAtMs != null) {
    const allowedStanding = new Set([
      'recovery_hold_too_short',
      'low_rom_standing_finalize_not_satisfied',
      'ultra_low_rom_standing_finalize_not_satisfied',
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

function evaluateSquatCompletionCore(
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
      eventBasedDescentPath: false,
      baselineSeeded: false,
      reversalTailBackfillApplied: false,
      trajectoryReversalRescueApplied: false,
      completionFinalizeMode: 'blocked',
      completionAssistApplied: false,
      completionAssistSources: [],
      completionAssistMode: 'none',
      promotionBaseRuleBlockedReason: null,
      reversalEvidenceProvenance: null,
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

  const effectiveDescentStartFrame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  } | undefined =
    descentFrame != null && trajectoryDescentStartFrame != null
      ? descentFrame.index <= trajectoryDescentStartFrame.index
        ? descentFrame
        : trajectoryDescentStartFrame
      : descentFrame ?? trajectoryDescentStartFrame;

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
  const evidenceLabel = getSquatEvidenceLabel(relativeDepthPeak, attemptAdmissionSatisfied);
  /** PR-SHALLOW-SQUAT-FINALIZE-BAND-01: finalize gate는 evidenceLabel 대신 별도 band 사용 */
  const standingRecoveryFinalizeBand = getStandingRecoveryFinalizeBand(
    relativeDepthPeak,
    attemptAdmissionSatisfied
  );
  const standingRecoveryFinalize = getStandingRecoveryFinalizeGate(
    standingRecoveryFinalizeBand,
    standingRecovery,
    {
      recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
      recoveryDropRatio: recovery.recoveryDropRatio,
    }
  );
  const qualifiesForRelaxedLowRomTiming =
    (evidenceLabel === 'low_rom' || evidenceLabel === 'ultra_low_rom') &&
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
  const armed =
    naturalArmed ||
    Boolean(options?.hmmArmingAssistApplied === true && depthFrames.length >= MIN_BASELINE_FRAMES);
  /** PR-CAM-18: phaseHint 'descent' 미탐지 시 trajectory 폴백 허용 */
  const descendConfirmed = (descentFrame != null || eventBasedDescentPath) && armed;
  const attemptStarted = descendConfirmed && downwardCommitmentReached;
  const bottomDetected = bottomFrame != null;
  const recoveryDetected = standingRecovery.standingRecoveredAtMs != null;

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
      effectiveDescentStartFrame != null &&
      peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs < minDescentToPeakMsForLowRom
    ) {
      return 'descent_span_too_short';
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

  const progressionReversalFrame =
    trajectoryRescue.trajectoryReversalFrame ?? tailBackfill.backfilledReversalFrame;

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
      ruleCompletionBlockedReason = computeBlockedAfterCommitment(rf, ascendForProgression);
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

  const reversalConfirmedAfterDescend = progressionReversalFrame != null;

  const completionBlockedReason = normalizeCompletionBlockedReasonForTerminalStage({
    completionSatisfied: rawPostAssistCompletionBlockedReason == null,
    attemptStarted,
    downwardCommitmentReached,
    reversalConfirmedAfterDescend,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryFinalizeReason: standingRecoveryFinalize.finalizeReason,
    completionBlockedReason: rawPostAssistCompletionBlockedReason,
  });

  const postAssistCompletionBlockedReason = rawPostAssistCompletionBlockedReason;
  const assistSuppressedByFinalize =
    options?.hmm != null &&
    hmmMeetsStrongAssistEvidence(options.hmm) &&
    isRecoveryFinalizeFamilyRuleBlocked(ruleCompletionBlockedReason);

  /** PR-CAM-18: phaseHint 기반 descentFrame이 없을 때 effectiveDescentStartFrame으로 폴백 */
  const squatDescentToPeakMs =
    effectiveDescentStartFrame != null
      ? peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs
      : undefined;
  const squatReversalToStandingMs =
    progressionReversalFrame != null && standingRecovery.standingRecoveredAtMs != null
      ? standingRecovery.standingRecoveredAtMs - progressionReversalFrame.timestampMs
      : undefined;

  /**
   * PR-CAM-21: completion owner는 evidenceLabel이 아니라 "실제 통과 경로"에서 고른다.
   *
   * PR-CAM-CORE-PASS-REASON-ALIGN-01: pass reason taxonomy 는 `deriveSquatCompletionPassReason` 에 위임하고,
   * ordinary shallow(phase descent 살아 있음)는 *_cycle, trajectory 이벤트 폴백만 *_event_cycle.
   */
  const standardPathWon =
    completionBlockedReason == null &&
    eventBasedDescentPath === false &&
    relativeDepthPeak >= STANDARD_OWNER_FLOOR;

  /**
   * PR-CAM-CORE: `standard_cycle` / `not_confirmed` 는 위에서 분기.
   * evidenceLabel `standard` 인데 owner 미달이면 ROM 밴드는 low 와 동일하게 `deriveSquatCompletionPassReason('low_rom', …)` 에 맡긴다.
   */
  const passReasonEvidenceLabel: SquatEvidenceLabel =
    evidenceLabel === 'standard' ? 'low_rom' : evidenceLabel;
  const completionPassReason: SquatCompletionPassReason =
    completionBlockedReason != null
      ? 'not_confirmed'
      : standardPathWon
        ? 'standard_cycle'
        : deriveSquatCompletionPassReason({
            completionSatisfied: true,
            evidenceLabel: passReasonEvidenceLabel,
            eventBasedDescentPath,
          });

  const completionSatisfied = completionPassReason !== 'not_confirmed';

  let reversalConfirmedBy: 'rule' | 'rule_plus_hmm' | 'trajectory' | null =
    hmmReversalAssistDecision.assistApplied
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
  }
  const reversalDepthDrop = hmmReversalAssistDecision.assistApplied
    ? squatReversalDropAchieved
    : revConf.reversalConfirmed
      ? revConf.reversalDepthDrop
      : null;
  const reversalFrameCount = hmmReversalAssistDecision.assistApplied
    ? 2
    : revConf.reversalConfirmed
      ? revConf.reversalFrameCount
      : null;

  const trajectoryReversalRescueApplied = trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory';
  const reversalTailApplied = tailBackfill.backfillApplied;
  const pr02AssistSources = buildSquatCompletionAssistSources({
    hmmAssistApplied: hmmAssistDecision.assistApplied,
    hmmReversalAssistApplied: hmmReversalAssistDecision.assistApplied,
    trajectoryReversalRescueApplied,
    reversalTailBackfillApplied: reversalTailApplied,
    eventCyclePromoted: false,
  });
  const pr02FinalizeMode = deriveSquatCompletionFinalizeMode({
    completionSatisfied,
    eventCyclePromoted: false,
    assistSourcesWithoutPromotion: pr02AssistSources,
  });
  const pr02AssistMode = deriveSquatCompletionAssistMode(pr02AssistSources);
  const pr02ReversalProv = deriveSquatReversalEvidenceProvenance({
    trajectoryReversalRescueApplied,
    reversalTailBackfillApplied: reversalTailApplied,
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
    standingRecoveryHoldMs: standingRecovery.standingRecoveryHoldMs,
    successPhaseAtOpen: completionSatisfied ? 'standing_recovered' : undefined,
    evidenceLabel,
    completionBlockedReason,
    completionSatisfied,
    startBeforeBottom,
    bottomDetected,
    recoveryDetected,
    cycleComplete: completionSatisfied,
    /** PR-CAM-18: phaseHint 'descent' 없는 경우 effectiveDescentStartFrame 타임스탬프로 폴백 */
    descendStartAtMs: effectiveDescentStartFrame?.timestampMs,
    peakAtMs: peakFrame.timestampMs,
    ascendStartAtMs: ascentFrame?.timestampMs,
    cycleDurationMs:
      effectiveDescentStartFrame != null && standingRecovery.standingRecoveredAtMs != null
        ? standingRecovery.standingRecoveredAtMs - effectiveDescentStartFrame.timestampMs
        : undefined,
    downwardCommitmentDelta,
    standingRecoveryFrameCount: standingRecovery.standingRecoveryFrameCount,
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
    eventBasedDescentPath,
    baselineSeeded: hasFiniteSeedPrimary,
    trajectoryReversalRescueApplied,
    completionFinalizeMode: pr02FinalizeMode,
    completionAssistApplied: pr02AssistSources.length > 0,
    completionAssistSources: pr02AssistSources,
    completionAssistMode: pr02AssistMode,
    promotionBaseRuleBlockedReason: null,
    reversalEvidenceProvenance: pr02ReversalProv,
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

/** PR-04E3B: event-cycle 승격이 타임·finalize 계약을 덮어쓰지 않도록 차단 */
const PR_04E3B_NO_EVENT_PROMOTION_BLOCKS = new Set<string>([
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
]);

export function evaluateSquatCompletionState(
  frames: PoseFeaturesFrame[],
  options?: EvaluateSquatCompletionStateOptions
): SquatCompletionState {
  let depthFreeze: SquatDepthFreezeConfig | null = null;
  const MIN_PREFIX = Math.max(8, MIN_BASELINE_FRAMES + 2);
  if (frames.length >= MIN_PREFIX) {
    for (let n = MIN_PREFIX; n <= frames.length; n++) {
      const partial = evaluateSquatCompletionCore(frames.slice(0, n), options, null);
      if (partial.attemptStarted) {
        const validFull = frames.filter((f) => f.isValid);
        const fullRows = buildSquatCompletionDepthRows(validFull);
        if (fullRows.length >= BASELINE_WINDOW) {
          const win = fullRows.slice(0, BASELINE_WINDOW);
          const src = partial.relativeDepthPeakSource ?? 'primary';
          const opt = options;
          const seedP = opt?.seedBaselineStandingDepthPrimary;
          const seedB = opt?.seedBaselineStandingDepthBlended;
          const finiteP = typeof seedP === 'number' && Number.isFinite(seedP);
          const finiteB = typeof seedB === 'number' && Number.isFinite(seedB);
          const frozenBaseline =
            src === 'blended'
              ? finiteB
                ? seedB
                : finiteP
                  ? seedP
                  : Math.min(...win.map((r) => r.depthCompletion))
              : finiteP
                ? seedP
                : Math.min(...win.map((r) => r.depthPrimary));
          depthFreeze = {
            lockedRelativeDepthPeakSource: src,
            frozenBaselineStandingDepth: frozenBaseline,
          };
        }
        break;
      }
    }
  }

  let state = evaluateSquatCompletionCore(frames, options, depthFreeze);

  const validForEvent = frames.filter((f) => f.isValid);
  const squatEventCycle = detectSquatEventCycle(validForEvent, {
    hmm: options?.hmm ?? undefined,
    baselineFrozenDepth: state.baselineFrozenDepth ?? state.baselineStandingDepth,
    lockedSource: state.relativeDepthPeakSource ?? null,
    baselineFrozen: state.baselineFrozen === true,
    peakLatched: state.peakLatched === true,
    peakLatchedAtIndex: state.peakLatchedAtIndex ?? null,
  });

  state = { ...state, squatEventCycle };

  const ruleBlock = state.ruleCompletionBlockedReason ?? null;
  const finalizeOk =
    state.standingRecoveryFinalizeReason === 'standing_hold_met' ||
    state.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize' ||
    state.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize';

  const ultraLowRomEventCandidate =
    squatEventCycle.detected && squatEventCycle.band === 'ultra_low_rom';

  /**
   * 이벤트 윈도우(locked primary) 상대 피크는 ultra 밴드인데, completion evidence는 blended 등으로
   * 이미 low_rom 이상이면 PR JSON 클래스(ultra evidence + 앉은 자세 FP)가 아니다 — 승격을 막지 않는다.
   */
  const ultraLowRomEventPromotionAllowed =
    !ultraLowRomEventCandidate ||
    state.evidenceLabel !== 'ultra_low_rom' ||
    ultraLowRomEventPromotionMeetsAscentIntegrity(state);

  const canEventPromote =
    state.completionPassReason === 'not_confirmed' &&
    ruleBlock != null &&
    !PR_04E3B_NO_EVENT_PROMOTION_BLOCKS.has(ruleBlock) &&
    finalizeOk &&
    state.standingRecoveredAtMs != null &&
    squatEventCycle.detected &&
    squatEventCycle.band != null &&
    state.relativeDepthPeak < STANDARD_OWNER_FLOOR &&
    ultraLowRomEventPromotionAllowed;

  if (!canEventPromote) {
    return state;
  }

  const promotedPassReason =
    squatEventCycle.band === 'low_rom' ? 'low_rom_event_cycle' : 'ultra_low_rom_event_cycle';
  const promotedSource: 'rule' | 'rule_plus_hmm' =
    squatEventCycle.source === 'rule_plus_hmm' ? 'rule_plus_hmm' : 'rule';

  const promotedAssistSources = buildSquatCompletionAssistSources({
    hmmAssistApplied: state.hmmAssistApplied === true,
    hmmReversalAssistApplied: state.hmmReversalAssistApplied === true,
    trajectoryReversalRescueApplied: state.trajectoryReversalRescueApplied === true,
    reversalTailBackfillApplied: state.reversalTailBackfillApplied === true,
    eventCyclePromoted: true,
  });
  const promotedAssistMode = deriveSquatCompletionAssistMode(promotedAssistSources);

  return {
    ...state,
    completionBlockedReason: null,
    completionSatisfied: true,
    completionPassReason: promotedPassReason,
    cycleComplete: true,
    successPhaseAtOpen: 'standing_recovered',
    completionMachinePhase: deriveSquatCompletionMachinePhase({
      completionSatisfied: true,
      currentSquatPhase: state.currentSquatPhase,
      downwardCommitmentReached: state.downwardCommitmentReached,
    }),
    eventCyclePromoted: true,
    eventCycleSource: promotedSource,
    postAssistCompletionBlockedReason: null,
    completionFinalizeMode: 'event_promoted_finalized',
    completionAssistApplied: promotedAssistSources.length > 0,
    completionAssistSources: promotedAssistSources,
    completionAssistMode: promotedAssistMode,
    promotionBaseRuleBlockedReason: ruleBlock,
  };
}
