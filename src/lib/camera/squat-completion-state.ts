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
  evaluateOfficialShallowCompletionStreamBridge,
  readSquatCompletionDepthForReversal,
} from '@/lib/camera/squat/squat-reversal-confirmation';
import {
  detectSquatEventCycle,
  type SquatEventCycleResult,
} from '@/lib/camera/squat/squat-event-cycle';
import {
  deriveSquatOwnerTruthTrace,
  type SquatOwnerTruthSource,
  type SquatOwnerTruthStage,
} from '@/lib/camera/squat/squat-owner-trace';
import {
  deriveCanonicalShallowCompletionContract,
  type CanonicalShallowCompletionContractBlockedReason,
  type CanonicalShallowCompletionContractStage,
} from '@/lib/camera/squat/shallow-completion-contract';

/** PR-04E3B: 첫 attemptStarted 시점에 고정한 스트림·baseline — 동일 버퍼 내 재평가 없음 */
type SquatDepthFreezeConfig = {
  lockedRelativeDepthPeakSource: 'primary' | 'blended';
  frozenBaselineStandingDepth: number;
};

/** PR-04E3A: completion peak / relative depth / 밴드 — PR-04E1 blended 우선 (arming·reversal 과 동일 read) */
export function readSquatCompletionDepth(frame: PoseFeaturesFrame): number | null {
  return readSquatCompletionDepthForReversal(frame);
}

/**
 * Setup false-pass lock: 연속 N프레임이 capture-ready 프록시를 만족해야 rep 파이프라인에 진입.
 * (live-readiness MIN_READY_* 와 정렬 — 단일 프레임 스파이크로 attempt 열리지 않게)
 */
export const SQUAT_READINESS_STABLE_DWELL_FRAMES = 12;

const CAPTURE_READY_VISIBLE_RATIO = 0.7;
const CAPTURE_READY_CRITICAL_AVAIL = 0.65;
const CAPTURE_READY_AREA_MIN = 0.05;
const CAPTURE_READY_AREA_MAX = 0.95;
const CAPTURE_READY_ANKLE_Y_MIN = 0.55;
const CAPTURE_READY_ANKLE_VIS = 0.35;

/** 단일 프레임이 “캡처 준비(전신·가시성)” 프록시를 만족하는지 — live-readiness blockers 와 동일 축 */
export function poseFrameMeetsCaptureReadyProxy(frame: PoseFeaturesFrame): boolean {
  if (!frame.isValid) return false;
  if (frame.visibilitySummary.visibleLandmarkRatio < CAPTURE_READY_VISIBLE_RATIO) return false;
  if (frame.visibilitySummary.criticalJointsAvailability < CAPTURE_READY_CRITICAL_AVAIL) return false;
  const a = frame.bodyBox.area;
  if (a < CAPTURE_READY_AREA_MIN || a > CAPTURE_READY_AREA_MAX) return false;
  const ankle = frame.joints.ankleCenter;
  if (!ankle || (ankle.visibility ?? 0) < CAPTURE_READY_ANKLE_VIS) return false;
  if (typeof ankle.y !== 'number' || !Number.isFinite(ankle.y)) return false;
  if (ankle.y < CAPTURE_READY_ANKLE_Y_MIN) return false;
  return true;
}

export type SquatReadinessStableDwellResult = {
  satisfied: boolean;
  /** dwell 윈도우가 끝나는 valid 내 인덱스(포함). 미충족 시 -1 */
  dwellEndIndexInValid: number;
  /** rep 파이프라인에 쓸 valid 슬라이스 시작 인덱스(포함). 미충족 시 0 */
  firstSliceStartIndexInValid: number;
};

/**
 * 첫 번째 연속 dwell 구간이 끝난 뒤부터만 completion/arming 입력으로 사용한다.
 */
export function computeSquatReadinessStableDwell(
  valid: PoseFeaturesFrame[]
): SquatReadinessStableDwellResult {
  const min = SQUAT_READINESS_STABLE_DWELL_FRAMES;
  if (valid.length < min) {
    return { satisfied: false, dwellEndIndexInValid: -1, firstSliceStartIndexInValid: 0 };
  }
  for (let end = min - 1; end < valid.length; end++) {
    let allOk = true;
    for (let k = 0; k < min; k++) {
      const fr = valid[end - min + 1 + k];
      if (!fr || !poseFrameMeetsCaptureReadyProxy(fr)) {
        allOk = false;
        break;
      }
    }
    if (allOk) {
      return {
        satisfied: true,
        dwellEndIndexInValid: end,
        firstSliceStartIndexInValid: end - min + 1,
      };
    }
  }
  return { satisfied: false, dwellEndIndexInValid: -1, firstSliceStartIndexInValid: 0 };
}

function meanSafe(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function meanHipCenter(
  frames: PoseFeaturesFrame[]
): { x: number; y: number } | null {
  const pts = frames
    .map((f) => f.joints.hipCenter)
    .filter((j): j is NonNullable<typeof j> => j != null && (j.visibility ?? 0) >= 0.35);
  if (pts.length === 0) return null;
  return {
    x: meanSafe(pts.map((p) => p.x)),
    y: meanSafe(pts.map((p) => p.y)),
  };
}

/**
 * setup 전용 대형 프레이밍 이동(뒤로/가까이/좌우 시프트) — 실제 rep 와 분리.
 * completion truth 가 true 였어도 evaluator 에서 상위에서 막는다.
 */
export function computeSquatSetupMotionBlock(validPipeline: PoseFeaturesFrame[]): {
  blocked: boolean;
  reason: string | null;
} {
  if (validPipeline.length < 14) return { blocked: false, reason: null };
  let maxIdx = 0;
  let maxD = -Infinity;
  for (let i = 0; i < validPipeline.length; i++) {
    const d = validPipeline[i]!.derived.squatDepthProxy;
    if (typeof d === 'number' && Number.isFinite(d) && d > maxD) {
      maxD = d;
      maxIdx = i;
    }
  }
  if (maxIdx < 8) return { blocked: false, reason: null };

  const head = validPipeline.slice(0, 4);
  const tail = validPipeline.slice(-4);
  const areasH = head.map((f) => f.bodyBox.area).filter((x) => x > 0);
  const areasT = tail.map((f) => f.bodyBox.area).filter((x) => x > 0);
  const areaEarly = meanSafe(areasH);
  const areaLate = meanSafe(areasT);
  if (areaEarly > 0.03 && areaLate > 0 && areaLate / areaEarly < 0.67) {
    return { blocked: true, reason: 'step_back_or_camera_tilt_area_shrink' };
  }
  if (areaEarly > 0.03 && areaLate / areaEarly > 1.55) {
    return { blocked: true, reason: 'step_in_or_camera_close_area_spike' };
  }
  const hipEarly = meanHipCenter(head);
  const hipLate = meanHipCenter(tail);
  if (hipEarly && hipLate) {
    const dx = hipLate.x - hipEarly.x;
    const dy = hipLate.y - hipEarly.y;
    if (Math.hypot(dx, dy) > 0.138) {
      return { blocked: true, reason: 'large_framing_translation' };
    }
  }
  return { blocked: false, reason: null };
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
 * PR-2-SHALLOW-CONTRACT-NORMALIZATION: ROM band for the shallow completion contract.
 *
 * Per SSOT §shallow/low ROM 원칙: standard, low_rom, ultra_low_rom are admission bands
 * within the same completion contract — not separate pass owners.
 *
 * SquatShallowContractBand = SquatEvidenceLabel restricted to the valid shallow zones.
 * Use this type when a parameter or field specifically represents the contract band,
 * rather than the full evidence label (which also includes 'insufficient_signal').
 */
export type SquatShallowContractBand = Extract<SquatEvidenceLabel, 'standard' | 'low_rom' | 'ultra_low_rom'>;

/**
 * PR-02 Assist lock: completion 이 어떻게 최종 확정됐는지(관측·trace 전용).
 * success owner 가 아님 — PR-01 owner 는 completion truth 라인age 별도.
 */
export type SquatCompletionFinalizeMode =
  | 'blocked'
  | 'rule_finalized'
  | 'assist_augmented_finalized'
  | 'event_promoted_finalized'
  /** PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04: 공식 shallow 권위 종료 계약으로만 닫힘 */
  | 'official_shallow_finalized';

/** PR-02: 어떤 assist 채널이 개입했는지(OR 목록) */
export type SquatCompletionAssistSource =
  | 'hmm_blocked_reason'
  | 'hmm_reversal'
  | 'trajectory_reversal_rescue'
  | 'standing_tail_backfill'
  /** PR-DOWNUP-GUARANTEE-03: ultra-shallow에서 closure 번들 없이도 finalize+복귀+primary 되돌림으로 progression 앵커 보강 */
  | 'ultra_shallow_meaningful_down_up_rescue'
  | 'event_cycle_promotion';

/** PR-02: assist 축 단일 요약(복수면 mixed) */
export type SquatCompletionAssistMode =
  | 'none'
  | 'hmm_segmentation'
  | 'hmm_reversal'
  | 'reversal_trajectory'
  | 'reversal_tail'
  | 'reversal_ultra_shallow_down_up'
  | 'event_promotion'
  | 'mixed';

/**
 * PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01: shallow 시도 단계 라벨(권위 completion truth 기반, 디버그 전용).
 */
export type SquatAuthoritativeShallowStage =
  | 'pre_attempt'
  | 'admission_blocked'
  | 'reversal_blocked'
  | 'policy_blocked'
  | 'standing_finalize_blocked'
  | 'closed';

/**
 * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: 세부 completionBlockedReason 을 6가지 패밀리로만 접는다(분류 전용).
 */
export type ShallowNormalizedBlockerFamily =
  | 'admission'
  | 'reversal'
  | 'policy'
  | 'standing_finalize'
  | 'closed'
  | 'none';

/**
 * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: 공식 shallow 계약 축 단일 상태(권위는 completion-state 만).
 */
export type ShallowAuthoritativeContractStatus =
  | 'not_in_shallow_contract'
  | 'admission_blocked'
  | 'reversal_blocked'
  | 'policy_blocked'
  | 'standing_finalize_blocked'
  | 'closed';

/** PR-02: 역전 앵커 증거 출처 — pass owner 아님 */
export type SquatReversalEvidenceProvenance =
  | 'strict_rule'
  | 'rule_plus_hmm_detection'
  | 'hmm_reversal_assist'
  | 'trajectory_anchor_rescue'
  | 'standing_tail_backfill'
  /** PR-03 rework: 공식 shallow path 전용 — completion depth 스트림 post-peak return + guarded finalize 증거 */
  | 'official_shallow_stream_bridge'
  /** PR-DOWNUP-GUARANTEE-03: ultra-low 전용 — finalize+복귀 증거로 strict 역전/closure 번들 없이 앵커 확정 */
  | 'ultra_shallow_meaningful_down_up_rescue';

/** PR-CAM-SHALLOW-PROOF-TRACE-11: shallow proof 생성 관측 트레이스 — `SquatCompletionState` 필드가 참조(타입 선행). */
export type ShallowClosureProofTraceStage =
  | 'pre_admission'
  | 'admitted'
  | 'bridge'
  | 'suffix'
  | 'proof'
  | 'consumption';

/**
 * PR-CAM-SHALLOW-TICKET-UNIFICATION-12: shallow 완료 단일 권위 티켓(증명·소비는 티켓의 투영).
 * 이벤트 승격·trajectory 전역 권위화·딥 임계 변경 아님.
 */
export type ShallowCompletionTicket = {
  eligible: boolean;
  satisfied: boolean;
  blockedReason: string | null;
  admissionSatisfied: boolean;
  attemptSatisfied: boolean;
  descendSatisfied: boolean;
  commitmentSatisfied: boolean;
  lateRecoveredSuffixSatisfied: boolean;
  antiFalsePassGuardsSatisfied: boolean;
  proofSatisfied: boolean;
  consumptionSatisfied: boolean;
  /** 디버그: 첫 미충족 축(admission|attempt|…|finalize_bundle) */
  firstFailedStage?: string | null;
};

export type ShallowClosureProofTrace = {
  stage: ShallowClosureProofTraceStage;
  eligible: boolean;
  satisfied: boolean;
  blockedReason: string | null;
  firstDecisiveBlockedReason: string | null;
  proofBlockedReason: string | null;
  consumptionBlockedReason: string | null;

  admission: {
    candidate: boolean;
    admitted: boolean;
    relativeDepthPeak: number;
    inShallowOwnerZone: boolean;
  };

  attempt: {
    attemptStarted: boolean;
    descendConfirmed: boolean;
    downwardCommitmentReached: boolean;
    armedLike: boolean;
  };

  peak: {
    peakLatched: boolean;
    peakLatchedAtIndex: number | null;
    peakAnchorTruth: string | null;
    localPeakFound: boolean;
    localPeakIndex: number | null;
    localPeakBlockedReason: string | null;
  };

  bridge: {
    trajectoryRescue: boolean;
    provenance: string | null;
    eventCycleDetected: boolean;
    reversalDetected: boolean;
    recoveryDetected: boolean;
    nearStandingRecovered: boolean;
    eventCycleNotes: string[];
    eligible: boolean;
    satisfied: boolean;
    bridgeBlockedReason: string | null;
    guardedClosureProofSatisfied: boolean;
    guardedClosureProofBlockedReason: string | null;
  };

  suffix: {
    completionMachinePhase: string | null;
    recoveryConfirmedAfterReversal: boolean;
    standingRecoveredAtMs: number | null;
    finalizeSatisfied: boolean;
    finalizeReason: string | null;
    finalizeBand: string | null;
    continuityOk: boolean;
    recoveredSuffixEligible: boolean;
    recoveredSuffixSatisfied: boolean;
    recoveredSuffixBlockedReason: string | null;
    recoveredSuffixEvaluatorApplied: boolean;
    recoveredSuffixBlockedSummary: string | null;
  };

  proof: {
    officialShallowReversalSatisfied: boolean;
    officialShallowClosureProofSatisfied: boolean;
    officialShallowPrimaryDropClosureFallback: boolean;
    guardedTrajectoryClosureProofSatisfied: boolean;
    guardedRecoveredSuffixSatisfied: boolean;
    proofBlockedReason: string | null;
  };

  consumption: {
    eligible: boolean;
    satisfied: boolean;
    blockedReason: string | null;
    ineligibilityFirstReason: string | null;
    completionPassReason: string | null;
    completionBlockedReason: string | null;
    completionSatisfied: boolean;
  };
};

/**
 * PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04 — `SquatCompletionState` 필드 묶음(읽기 순서):
 * (1) completion truth / active runtime
 * (2) PRIMARY_CANONICAL — `canonicalShallowContract*` (+ closer applied/source)
 * (3) owner / policy trace — `ownerTruth*`, `ultraLowPolicy*`, authoritative reversal/recovery provenance
 * (4) LEGACY_COMPAT — PR-ALIGN-01 / PR-2 축 (`shallowAuthoritativeStage`, `truthMismatch_*`, …)
 * (5) evidence / trajectory / proof / bridge — evaluator·late-setup 연결 필드 유지
 */
export interface SquatCompletionState extends MotionCompletionResult {
  // ── (1) Completion truth / active runtime ──
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
  /**
   * PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS:
   * revConf.reversalConfirmed || hmmReversalAssistDecision.assistApplied
   * (officialShallowStreamBridgeApplied 제외).
   * true → rule 또는 HMM이 역전을 확인. stream bridge만으로는 true가 되지 않는다.
   * false → rule·HMM 역전 없음 — bridge만 있는 경우. weak-event gate를 우회할 수 없다.
   * canonical shallow contract의 weakEventProofSubstitutionBlocked 게이트 강화 입력.
   */
  reversalConfirmedByRuleOrHmm?: boolean;
  /** PR-CAM-REVERSAL-TAIL-BACKFILL-01: standing tail 증거로 역전 앵커만 늦게 backfill (성공 게이트 아님) */
  reversalTailBackfillApplied?: boolean;
  /** PR-DOWNUP-GUARANTEE-03: ultra-shallow에서 closure 번들 없이 finalize+되돌림으로 progression 앵커 보강 */
  ultraShallowMeaningfulDownUpRescueApplied?: boolean;
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
  /**
   * PR-CAM-EVENT-OWNER-DOWNGRADE-01: 구 승격 게이트 조건 충족(관측) — 성공 클로저·소유권 아님.
   */
  eventCyclePromotionCandidate?: boolean;
  /**
   * PR-CAM-EVENT-OWNER-DOWNGRADE-01: 미충족 사유 또는 `event_promotion_owner_disabled`(후보인데 승격 비활성).
   */
  eventCyclePromotionBlockedReason?: string | null;
  /**
   * PR-CAM-18: phaseHint descent 없이 trajectory 폴백으로 하강 인정 시 true.
   * PR-03: 통과 시 pass reason 은 공식 *_cycle 로 정리 — 본 플래그는 관측·승격 입력용으로 유지.
   */
  eventBasedDescentPath?: boolean;
  /** PR-03: low/ultra-low ROM 공식 completion path 후보(신호·밴드) */
  officialShallowPathCandidate?: boolean;
  /** PR-03: 공식 shallow path 로 baseline·무장·하강 승격까지 된 상태 */
  officialShallowPathAdmitted?: boolean;
  /** PR-03: 공식 shallow/ultra-low path 로 low_rom_cycle / ultra_low_rom_cycle 로 닫힘 */
  officialShallowPathClosed?: boolean;
  /** PR-10: 공식 ROM 사이클로 소비 종료(트레이스·camera-trace 정렬용) */
  closedAsOfficialRomCycle?: boolean;
  /** PR-03: 어떤 arming 계약으로 shallow path 에 들어왔는지 */
  officialShallowPathReason?: string | null;
  /** PR-03: 후보인데 아직 닫히지 않았을 때 병목(관측 전용) */
  officialShallowPathBlockedReason?: string | null;
  /** PR-03 rework: primary 역전 미달 시 completion 스트림으로 shallow reversal 앵커 보강 적용 */
  officialShallowStreamBridgeApplied?: boolean;
  /** PR-03 rework: phaseHint ascent 없이 completion return + 0.88×요구량으로 상승 등가 인정 */
  officialShallowAscentEquivalentSatisfied?: boolean;
  /** PR-03 rework: shallow 공식 closure에 필요한 finalize·복귀·post-peak return 번들 충족(관측) */
  officialShallowClosureProofSatisfied?: boolean;
  /**
   * PR-03 shallow closure final: completion-stream 꼬리가 짧을 때 primary 0.88×역전량으로 번들만 성립했는지(관측).
   * 게이트로 사용하지 않음.
   */
  officialShallowPrimaryDropClosureFallback?: boolean;
  /** PR-03 final: progression 역전 truth — shallow closure 판정·트레이스용 명시 축 */
  officialShallowReversalSatisfied?: boolean;
  /**
   * PR-03 final: 관측 전용 — 프레임 버퍼 후반 깊어져 standard_cycle 로 닫힌 뒤잦음이 shallow 입장 이후였는지.
   * 게이트·판정 변경에 사용하지 않음.
   */
  officialShallowDriftedToStandard?: boolean;
  officialShallowDriftReason?: string | null;
  /** PR-03 final: full 버퍼 대신 최소 프리픽스로 shallow closure 채택 시 유효 프레임 수(없으면 null) */
  officialShallowPreferredPrefixFrameCount?: number | null;
  /**
   * PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04: 공식 shallow 권위 종료 계약으로 completion 이 닫혔는지(provenance·이벤트 승격과 별개).
   * Runtime / completion-truth 인접 플래그 — shallow primary debug 는 `canonicalShallowContract*`.
   */
  ownerAuthoritativeShallowClosureSatisfied?: boolean;
  /** Setup false-pass lock: 연속 capture-ready dwell 충족 후에만 rep 파이프라인 사용 */
  readinessStableDwellSatisfied?: boolean;
  /** Setup false-pass lock: 대형 프레이밍 이동(뒤로/세우기/좌우) 감지 시 차단 */
  setupMotionBlocked?: boolean;
  setupMotionBlockReason?: string | null;
  /** dwell 이후 슬라이스에서 attempt 가 열린 경우 true(관측) */
  attemptStartedAfterReady?: boolean;
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

  /** PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03: finalize 게이트 충족 여부(관측). */
  standingFinalizeSatisfied?: boolean;
  /** PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03: 늦은 setup_motion 이 성공을 덮어쓴 경우(평가기에서 설정). */
  standingFinalizeSuppressedByLateSetup?: boolean;
  /** PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03: standard 경로에서 최소 tail 만족 시각(없으면 null). */
  standingFinalizeReadyAtMs?: number | null;

  // ── (2) PRIMARY_CANONICAL shallow contract (derive + closer observability; PR-A/B/D) ──
  /**
   * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: canonical closer 가 이번 평가에서 적용됐는지 + 경로.
   * **Primary shallow debug truth** 축의 일부 — 게이트 직접 입력 아님.
   */
  canonicalShallowContractClosureApplied?: boolean;
  canonicalShallowContractClosureSource?: 'none' | 'canonical_authoritative' | 'canonical_guarded_trajectory';

  /**
   * `deriveCanonicalShallowCompletionContract` 스냅샷 — **shallow 관련 디버그 1차 SSOT**.
   * (resolver 는 mutate 없음; `official_shallow_cycle` 쓰기는 closer 전용.)
   */
  canonicalShallowContractEligible?: boolean;
  canonicalShallowContractAdmissionSatisfied?: boolean;
  canonicalShallowContractAttemptSatisfied?: boolean;
  canonicalShallowContractReversalEvidenceSatisfied?: boolean;
  canonicalShallowContractRecoveryEvidenceSatisfied?: boolean;
  canonicalShallowContractAntiFalsePassClear?: boolean;
  canonicalShallowContractSatisfied?: boolean;
  canonicalShallowContractStage?: CanonicalShallowCompletionContractStage;
  canonicalShallowContractBlockedReason?: CanonicalShallowCompletionContractBlockedReason;
  canonicalShallowContractAuthoritativeClosureWouldBeSatisfied?: boolean;
  canonicalShallowContractProvenanceOnlySignalPresent?: boolean;
  canonicalShallowContractSplitBrainDetected?: boolean;
  canonicalShallowContractTrace?: string;

  // ── (3) Owner / policy projection trace (secondary debug; not deprecated) ──
  /**
   * PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: ultra-low 제품 정책 스코프(권위 evidenceLabel + shallow 후보만).
   * 관측층 reversal/recovery·provenance·event-cycle 로는 켜지지 않는다.
   */
  ultraLowPolicyScope?: boolean;
  /** PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: 정책 판단을 할 수 있는 늦은 단계까지 도달했는지(아래 헬퍼 규칙). */
  ultraLowPolicyDecisionReady?: boolean;
  /** PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: 권위 차단이 `ultra_low_rom_not_allowed` 로 확정 적용됨. */
  ultraLowPolicyBlocked?: boolean;
  /** PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: 스코프/준비/락 적용 요약 트레이스. */
  ultraLowPolicyTrace?: string;

  /** PR-0: completion owner 요약 trace — observability only, no gate changes. */
  ownerTruthSource?: SquatOwnerTruthSource;
  ownerTruthStage?: SquatOwnerTruthStage;
  ownerTruthBlockedBy?: string | null;

  /**
   * PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02: strict reversal / HMM assist / official shallow stream bridge 만 권위 역전.
   */
  ownerAuthoritativeReversalSatisfied?: boolean;
  /**
   * PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02: 권위 역전 + standing 타임스탬프 + finalize 만족(관측·PR-3 입력).
   */
  ownerAuthoritativeRecoverySatisfied?: boolean;
  /**
   * PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02: trajectory rescue / tail backfill / ultra-shallow rescue 등 provenance 전용.
   */
  provenanceReversalEvidencePresent?: boolean;

  // ── (4) LEGACY_COMPAT shallow observability (prefer canonicalShallowContract* for new debug) ──
  /**
   * @deprecated PR-D: PR-ALIGN-01 coarse stage — `canonicalShallowContractStage` / `BlockedReason` 우선.
   * Compat 유지 필드(삭제 아님). pass/게이트 로직에 사용하지 않는다.
   */
  shallowAuthoritativeStage?: SquatAuthoritativeShallowStage;
  /**
   * auto-progression `SquatCycleDebug.reversalConfirmedAfterDescend` 와 동일 휴리스틱:
   * committedAtMs·reversalAtMs 타임라인만으로 역전이 “있어 보이는지”.
   */
  shallowObservationLayerReversalTruth?: boolean;
  /** completion 권위 역전 확정 (= reversalConfirmedAfterDescend) */
  shallowAuthoritativeReversalTruth?: boolean;
  /** 타임라인 기반 복귀 “있어 보임” (= standingRecoveredAtMs && reversalAtMs) */
  shallowObservationLayerRecoveryTruth?: boolean;
  /** completion 권위 복귀 확정 (= recoveryConfirmedAfterReversal) */
  shallowAuthoritativeRecoveryTruth?: boolean;
  /**
   * trajectory/tail/stream-bridge/ultra-shallow rescue 또는 reversalConfirmedBy===trajectory —
   * owner 역전과 혼동하면 안 되는 provenance 전용 신호.
   */
  shallowProvenanceOnlyReversalEvidence?: boolean;
  /** @deprecated PR-D: ALIGN-01 mismatch flag — `canonicalShallowContractSplitBrainDetected` / trace 우선. Compat only. */
  truthMismatch_reversalTopVsCompletion?: boolean;
  /** @deprecated PR-D: compat only — canonical split-brain / stage 우선. */
  truthMismatch_recoveryTopVsCompletion?: boolean;
  /** @deprecated PR-D: compat only — canonical split-brain / stage 우선. */
  truthMismatch_shallowAdmissionVsClosure?: boolean;
  /** @deprecated PR-D: compat only — canonical provenance fields 우선. */
  truthMismatch_provenanceReversalWithoutAuthoritative?: boolean;
  /** @deprecated PR-D: compat only — canonical recovery evidence 우선. */
  truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery?: boolean;

  /**
   * @deprecated PR-D: PR-2 패밀리 접기 — `canonicalShallowContractBlockedReason` 우선. Compat only.
   */
  shallowNormalizedBlockerFamily?: ShallowNormalizedBlockerFamily;
  /**
   * @deprecated PR-D: PR-2 contract enum — `canonicalShallowContractStage` 우선. Compat only.
   */
  shallowAuthoritativeContractStatus?: ShallowAuthoritativeContractStatus;
  /**
   * @deprecated PR-D: `officialShallowPathClosed` 미러 — 직접 플래그 또는 canonical 축 우선. Compat only.
   */
  shallowContractAuthoritativeClosure?: boolean;
  /**
   * @deprecated PR-D: PR-2 파이프 문자열 — `canonicalShallowContractTrace` 우선. Compat only.
   */
  shallowContractAuthorityTrace?: string;

  /**
   * @deprecated PR-D: pre-canonical closure trace reason — `canonicalShallowContract*` + closer 사유 우선. Compat only.
   * PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04 잔존 필드.
   */
  shallowAuthoritativeClosureReason?: string | null;
  /**
   * @deprecated PR-D: pre-canonical blocked detail — `getShallowAuthoritativeClosureDecision` 입력용 legacy 문자열. Compat only.
   */
  shallowAuthoritativeClosureBlockedReason?: string | null;

  // ── (5) Evidence / trajectory / proof / bridge (evaluator late-setup 등 연결 — 삭제 금지) ──
  /**
   * PR-CAM-SHALLOW-TRAJECTORY-BRIDGE-05: 통제된 trajectory-assisted shallow 권위 브리지(관측·결과).
   * provenance 단독 권위화 아님 — `getShallowTrajectoryAuthoritativeBridgeDecision` 단일 게이트.
   */
  shallowTrajectoryBridgeEligible?: boolean;
  shallowTrajectoryBridgeSatisfied?: boolean;
  shallowTrajectoryBridgeBlockedReason?: string | null;

  /**
   * PR-CAM-SHALLOW-CLOSURE-PROOF-NORMALIZE-06: 통제된 trajectory-assisted shallow 가
   * `officialShallowPrimaryDropClosureFallback` 정규화를 받을 자격이 있는지(관측).
   */
  guardedShallowTrajectoryClosureProofSatisfied?: boolean;
  guardedShallowTrajectoryClosureProofBlockedReason?: string | null;

  /** PR-07: 브리지용 국소 shallow 피크 앵커(입장 조건 충족 시에만 스탬프). */
  guardedShallowLocalPeakFound?: boolean;
  guardedShallowLocalPeakBlockedReason?: string | null;
  guardedShallowLocalPeakIndex?: number | null;

  /** PR-08/09: recovered-suffix shallow closure(있을 때만) — PR-10 소비 게이트 입력 */
  guardedShallowRecoveredSuffixSatisfied?: boolean;
  guardedShallowRecoveredSuffixBlockedReason?: string | null;

  /**
   * PR-CAM-SHALLOW-PROOF-TRACE-11: shallow closure **proof 생성·소비** 단계별 진실 그래프(관측 전용).
   * pass/게이트/임계값 로직에서 읽지 않는다.
   */
  shallowClosureProofTrace?: ShallowClosureProofTrace;

  /** PR-CAM-SHALLOW-TICKET-UNIFICATION-12: 단일 shallow 완료 티켓(권위). */
  shallowCompletionTicket?: ShallowCompletionTicket;
  shallowCompletionTicketSatisfied?: boolean;
  shallowCompletionTicketBlockedReason?: string | null;
  /** admission | attempt | descend | commitment | late_suffix | anti_false_pass | finalize_bundle */
  shallowCompletionTicketStage?: string | null;
}

/** PR-CAM-SHALLOW-PROOF-TRACE-11: 명시적 차단 문자열 — JSON 에서 추론 없이 원인 매핑 */
export const SHALLOW_CLOSURE_PROOF_TRACE_REASON = {
  admission_not_reached: 'admission_not_reached',
  admission_not_admitted: 'admission_not_admitted',
  not_armed: 'not_armed',
  no_attempt_or_descend: 'no_attempt_or_descend',
  no_downward_commitment: 'no_downward_commitment',
  outside_shallow_owner_zone: 'outside_shallow_owner_zone',
  peak_anchor_at_series_start: 'peak_anchor_at_series_start',
  local_peak_missing: 'local_peak_missing',
  trajectory_bridge_not_eligible: 'trajectory_bridge_not_eligible',
  trajectory_bridge_no_recovery_pattern: 'trajectory_bridge_no_recovery_pattern',
  recovered_suffix_not_eligible: 'recovered_suffix_not_eligible',
  recovered_suffix_no_finalize_bundle: 'recovered_suffix_no_finalize_bundle',
  proof_closure_bundle_not_satisfied: 'proof_closure_bundle_not_satisfied',
  proof_primary_drop_not_satisfied: 'proof_primary_drop_not_satisfied',
  proof_reversal_not_satisfied: 'proof_reversal_not_satisfied',
  proof_flags_not_set: 'proof_flags_not_set',
  proof_synthesized_but_not_consumed: 'proof_synthesized_but_not_consumed',
  consumption_not_eligible: 'consumption_not_eligible',
  consumption_rejected_by_no_reversal: 'consumption_rejected_by_no_reversal',
  consumption_blocked: 'consumption_blocked',
} as const;

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
  /**
   * PR-CAM-SHALLOW-TRAJECTORY-BRIDGE-05: 평가기에서 이미 계산된 setup 차단 — completion 코어와 독립.
   */
  setupMotionBlocked?: boolean;
  /**
   * PR-08/09: recovered-suffix 2차 코어 — `officialShallowReversalSatisfied` OR 에 합류.
   */
  guardedShallowRecoveredSuffixClosureApply?: boolean;
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

function deriveSquatCompletionFinalizeMode(input: {
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

type GuardedTrajectoryShallowBridgeOpts = {
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
    descentFrame != null || eventBasedDescentPath === true;
  const pr03OfficialShallowArming =
    officialShallowPathCandidate &&
    officialShallowDescentEvidenceForAdmission &&
    !naturalArmed;
  const armed =
    naturalArmed ||
    pr03OfficialShallowArming ||
    Boolean(options?.hmmArmingAssistApplied === true && depthFrames.length >= MIN_BASELINE_FRAMES);
  /** PR-CAM-18: phaseHint 'descent' 미탐지 시 trajectory 폴백 허용 */
  const descendConfirmed = (descentFrame != null || eventBasedDescentPath) && armed;
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
      effectiveDescentStartFrame != null &&
      peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs < minDescentToPeakMsForLowRom
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
      effectiveDescentStartFrame == null ||
      peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs >= minDescentToPeakMsForLowRom) &&
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
    effectiveDescentStartFrame != null
      ? peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs
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
    descendStartAtMs: effectiveDescentStartFrame?.timestampMs,
    peakAtMs: peakFrame.timestampMs,
    ascendStartAtMs: ascentFrame?.timestampMs,
    cycleDurationMs:
      effectiveDescentStartFrame != null && standingRecovery.standingRecoveredAtMs != null
        ? standingRecovery.standingRecoveredAtMs - effectiveDescentStartFrame.timestampMs
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
          buildCanonicalShallowContractInputFromState(sn)
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
 * PR-2-SHALLOW-CONTRACT-NORMALIZATION: Delegate to mapCompletionBlockedReasonToShallowNormalizedBlockerFamily.
 * The old SHALLOW_OBS_* sets are removed; this function now uses SHALLOW_CONTRACT_BLOCKER_* via the
 * family mapper, eliminating the duplicate parallel classification.
 * Output: legacy-compat SquatAuthoritativeShallowStage (deprecated, observability only).
 */
function computeAuthoritativeShallowStageForObservability(
  state: SquatCompletionState
): SquatAuthoritativeShallowStage {
  if (state.completionSatisfied) return 'closed';

  const br = state.completionBlockedReason ?? null;

  // pre_attempt is more specific than admission_blocked: no attempt has fired yet
  if (br === 'not_armed' && !state.attemptStarted) return 'pre_attempt';

  const family = mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(br, false);
  switch (family) {
    case 'admission':
      return 'admission_blocked';
    case 'reversal':
      return 'reversal_blocked';
    case 'standing_finalize':
      return 'standing_finalize_blocked';
    case 'policy':
      return 'policy_blocked';
    case 'closed':
      return 'closed';
    case 'none':
    default:
      return 'policy_blocked'; // preserve existing fallback for unclassified reasons
  }
}

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

/**
 * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01:
 * official shallow 계약 후보/입장/차단 권위만으로 단일 contract status.
 */
function deriveShallowAuthoritativeContractStatusForPr2(
  state: SquatCompletionState
): ShallowAuthoritativeContractStatus {
  if (state.completionSatisfied) return 'closed';
  if (!state.officialShallowPathCandidate) return 'not_in_shallow_contract';
  if (!state.officialShallowPathAdmitted) return 'admission_blocked';

  const fam = mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
    state.completionBlockedReason ?? null,
    false
  );
  if (fam === 'reversal') return 'reversal_blocked';
  if (fam === 'policy') return 'policy_blocked';
  if (fam === 'standing_finalize') return 'standing_finalize_blocked';
  if (fam === 'admission') return 'admission_blocked';
  /**
   * 입장 이후인데 매핑 밖 reason — 복구/마무리 꼬리로만 읽히는 경우가 많아 standing_finalize_blocked 로만 라벨(PR-1과 동일 철학).
   */
  if (fam === 'none') return 'standing_finalize_blocked';
  return 'closed';
}

/** PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: 제품 정책 스코프 — 권위 레이블 + 공식 shallow 후보만. */
function isUltraLowPolicyScope(state: SquatCompletionState): boolean {
  return state.evidenceLabel === 'ultra_low_rom' && state.officialShallowPathCandidate === true;
}

/**
 * PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: 이벤트 승격과 동일한 standing finalize 권위 문자열만 허용(새 휴리스틱 없음).
 */
function isUltraLowPolicyFinalizeTruthSatisfied(state: SquatCompletionState): boolean {
  const r = state.standingRecoveryFinalizeReason;
  return (
    r === 'standing_hold_met' ||
    r === 'low_rom_guarded_finalize' ||
    r === 'ultra_low_rom_guarded_finalize'
  );
}

/**
 * PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01: 늦은 단계에서만 true.
 * provenance·타임라인 관측·event-cycle 은 조건에 넣지 않는다.
 */
function isUltraLowPolicyDecisionReady(state: SquatCompletionState): boolean {
  if (!isUltraLowPolicyScope(state)) return false;
  if (state.officialShallowPathCandidate !== true) return false;
  if (state.officialShallowPathAdmitted !== true) return false;
  if (state.reversalConfirmedAfterDescend !== true) return false;
  if (state.recoveryConfirmedAfterReversal !== true) return false;
  if (!isUltraLowPolicyFinalizeTruthSatisfied(state)) return false;

  const fam = mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
    state.completionBlockedReason ?? null,
    state.completionSatisfied === true
  );
  if (fam === 'admission' || fam === 'reversal') return false;

  return true;
}

const ULTRA_LOW_ROM_POLICY_BLOCK_REASON = 'ultra_low_rom_not_allowed' as const;

/**
 * PR-6-ULTRA-LOW-POLICY-RESCOPE:
 * canonical closer + canonical contract 수준의 증거가 이미 입증된 ultra-low cycle인지 판정.
 *
 * 반환 true = 이미 legitimate cycle이 입증됨 → policy는 owner truth를 존중하고 통과시킨다.
 * 반환 false = 아직 입증되지 않음 → 기존 차단 로직 유지.
 *
 * **사용 신호**: 기존 state 필드만 재사용 — 새 threshold 없음.
 * - completionSatisfied: core가 cycle 확정
 * - officialShallowPathClosed: ultra_low_rom_cycle pass로 core가 공식 shallow path를 닫음
 * - officialShallowClosureProofSatisfied: closure proof bundle 충족 (officialShallowPathClosed의 자연적 결과)
 * - canonicalShallowContractSatisfied: canonical contract가 독립적으로 quality 검증
 *   (trajectory rescue 차단 · provenance-only 차단 · setup 오염 차단 · 권위 reversal/recovery 확인 포함)
 *
 * **아키텍처 안전성**: 이 함수는 success를 새로 만들지 않는다.
 * core + canonical contract가 이미 결정한 truth를 policy가 존중하는지 판정할 뿐이다.
 * single-writer 원칙 유지.
 */
function isUltraLowCycleLegitimateByCanonicalProof(state: SquatCompletionState): boolean {
  // core가 cycle을 확정해야 함
  if (state.completionSatisfied !== true) return false;
  // core가 official shallow path를 닫아야 함 (ultra_low_rom_cycle pass 시 자동 설정)
  if (state.officialShallowPathClosed !== true) return false;
  // closure proof bundle이 충족되어야 함
  if (state.officialShallowClosureProofSatisfied !== true) return false;
  // canonical contract가 품질을 독립적으로 검증해야 함:
  // trajectory rescue, provenance-only, setup 오염이 있으면 이 값이 false
  if (state.canonicalShallowContractSatisfied !== true) return false;
  return true;
}

/**
 * PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01 / PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03 /
 * PR-6-ULTRA-LOW-POLICY-RESCOPE:
 *
 * **PR-6 이후 정책 행동:**
 * - ultra-low scope + legitimate cycle already proven → 통과 (canonical closer의 truth 존중)
 * - ultra-low scope + illegitimate pattern → 차단 (기존과 동일)
 *
 * blanket ultra-low ban이 아닌 illegitimate-ultra-low ban만 적용한다.
 * `ultra_low_rom` band 자체는 실패 사유가 아니다 — meaningful cycle 미입증이 실패 사유다.
 *
 * **레이어**: product policy — completion owner가 아님.
 * completion owner(canonical closer)가 먼저 실행된 뒤 evaluator boundary에서 1회만 호출해야 한다.
 * attachShallowTruthObservabilityAlign01 내부에서 호출하지 않는다.
 */
export function applyUltraLowPolicyLock(state: SquatCompletionState): SquatCompletionState {
  const ultraLowPolicyScope = isUltraLowPolicyScope(state);
  const ultraLowPolicyDecisionReady = isUltraLowPolicyDecisionReady(state);
  // PR-6: legitimate cycle 입증 여부 — canonical closer + canonical contract 수준의 증거 재사용
  const ultraLowLegitimateByCanonical =
    ultraLowPolicyDecisionReady && isUltraLowCycleLegitimateByCanonicalProof(state);
  const ultraLowPolicyTraceBase = [
    `scope=${ultraLowPolicyScope ? '1' : '0'}`,
    `ready=${ultraLowPolicyDecisionReady ? '1' : '0'}`,
    `legitimate_canonical=${ultraLowLegitimateByCanonical ? '1' : '0'}`,
  ].join('|');

  if (!ultraLowPolicyDecisionReady) {
    return {
      ...state,
      ultraLowPolicyScope,
      ultraLowPolicyDecisionReady: false,
      ultraLowPolicyBlocked: false,
      ultraLowPolicyTrace: ultraLowPolicyTraceBase,
    };
  }

  // PR-6: canonical 수준으로 입증된 legitimate cycle — policy는 consumer이므로 owner truth를 존중
  if (ultraLowLegitimateByCanonical) {
    return {
      ...state,
      ultraLowPolicyScope: true,
      ultraLowPolicyDecisionReady: true,
      ultraLowPolicyBlocked: false,
      ultraLowPolicyTrace: `${ultraLowPolicyTraceBase}|blocked=0_legitimate_canonical`,
    };
  }

  // PASS-AUTHORITY-RESET-01: Policy is now ANNOTATION-ONLY.
  // Motion truth fields (completionSatisfied, completionPassReason, completionBlockedReason,
  // cycleComplete, officialShallowPathClosed, etc.) are NOT rewritten here.
  // pass-core.ts determined pass truth before this function ran.
  // ultraLowPolicyBlocked=true is preserved as an interpretation/observability annotation.
  return {
    ...state,
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: true,
    ultraLowPolicyTrace: `${ultraLowPolicyTraceBase}|blocked=policy_illegitimate_annotation_only`,
  };
}

/**
 * PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01 / PR-C / PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04
 *
 * **Pure observability only** — completion 필드를 직접 덮어쓰지 않는다 (no policy writes).
 * Product policy 는 evaluator boundary 에서만 적용한다.
 *
 * **Primary shallow debug truth** 는 state 에 이미 스탬프된 `canonicalShallowContract*` 이다.
 * 이 함수가 채우는 `shallowAuthoritativeStage`, `truthMismatch_*`, PR-2 trace 필드 등은
 * **legacy / compatibility / debug-only** — 새 대시보드·원인 분석은 canonical 축 우선.
 *
 * 함수명은 PR-ALIGN-01 시절 태그 유지(rename 미실시, PR-D).
 */
export function attachShallowTruthObservabilityAlign01(
  state: SquatCompletionState
): SquatCompletionState {
  const stamped = state;

  const shallowObservationLayerReversalTruth =
    stamped.committedAtMs != null && stamped.reversalAtMs != null;
  const shallowAuthoritativeReversalTruth = stamped.reversalConfirmedAfterDescend === true;
  const shallowObservationLayerRecoveryTruth =
    stamped.standingRecoveredAtMs != null && stamped.reversalAtMs != null;
  const shallowAuthoritativeRecoveryTruth = stamped.recoveryConfirmedAfterReversal === true;

  const shallowProvenanceOnlyReversalEvidence =
    stamped.trajectoryReversalRescueApplied === true ||
    stamped.reversalTailBackfillApplied === true ||
    stamped.ultraShallowMeaningfulDownUpRescueApplied === true ||
    stamped.officialShallowStreamBridgeApplied === true ||
    stamped.reversalConfirmedBy === 'trajectory';

  const truthMismatch_reversalTopVsCompletion =
    shallowObservationLayerReversalTruth !== shallowAuthoritativeReversalTruth;
  const truthMismatch_recoveryTopVsCompletion =
    shallowObservationLayerRecoveryTruth !== shallowAuthoritativeRecoveryTruth;
  const truthMismatch_shallowAdmissionVsClosure =
    stamped.officialShallowPathAdmitted === true &&
    stamped.officialShallowPathClosed !== true &&
    stamped.completionSatisfied !== true;
  const truthMismatch_provenanceReversalWithoutAuthoritative =
    shallowProvenanceOnlyReversalEvidence && !shallowAuthoritativeReversalTruth;
  const truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery =
    stamped.standingRecoveredAtMs != null && !shallowAuthoritativeRecoveryTruth;

  const shallowNormalizedBlockerFamily = mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
    stamped.completionBlockedReason ?? null,
    stamped.completionSatisfied === true
  );
  const shallowAuthoritativeContractStatus = deriveShallowAuthoritativeContractStatusForPr2(stamped);
  const shallowContractAuthoritativeClosure = stamped.officialShallowPathClosed === true;
  const shallowContractAuthorityTrace = [
    stamped.officialShallowPathCandidate ? '1' : '0',
    stamped.officialShallowPathAdmitted ? '1' : '0',
    shallowAuthoritativeReversalTruth ? '1' : '0',
    shallowNormalizedBlockerFamily,
    shallowAuthoritativeContractStatus,
  ].join('|');

  const ownerTrace = deriveSquatOwnerTruthTrace({
    completionSatisfied: stamped.completionSatisfied,
    completionBlockedReason: stamped.completionBlockedReason ?? null,
    eventCyclePromoted: stamped.eventCyclePromoted === true,
    attemptStarted: stamped.attemptStarted === true,
    reversalConfirmedAfterDescend: stamped.reversalConfirmedAfterDescend === true,
    recoveryConfirmedAfterReversal: stamped.recoveryConfirmedAfterReversal === true,
  });

  /**
   * PR-D — 반환 스프레드 분류:
   * - PRIMARY: `...stamped` 에 포함된 `canonicalShallowContract*` (변경 없음).
   * - LEGACY_COMPAT: 아래 명시 필드만 이 함수가 덮어쓴다(PR-2/ALIGN-01).
   * - `ownerTruth*`: secondary owner trace(deprecated 아님).
   */
  return {
    ...stamped,
    shallowAuthoritativeStage: computeAuthoritativeShallowStageForObservability(stamped),
    shallowObservationLayerReversalTruth,
    shallowAuthoritativeReversalTruth,
    shallowObservationLayerRecoveryTruth,
    shallowAuthoritativeRecoveryTruth,
    shallowProvenanceOnlyReversalEvidence,
    truthMismatch_reversalTopVsCompletion,
    truthMismatch_recoveryTopVsCompletion,
    truthMismatch_shallowAdmissionVsClosure,
    truthMismatch_provenanceReversalWithoutAuthoritative,
    truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery,
    shallowNormalizedBlockerFamily,
    shallowAuthoritativeContractStatus,
    shallowContractAuthoritativeClosure,
    shallowContractAuthorityTrace,
    ownerTruthSource: ownerTrace.ownerTruthSource,
    ownerTruthStage: ownerTrace.ownerTruthStage,
    ownerTruthBlockedBy: ownerTrace.ownerTruthBlockedBy,
    ownerAuthoritativeReversalSatisfied: stamped.ownerAuthoritativeReversalSatisfied,
    ownerAuthoritativeRecoverySatisfied: stamped.ownerAuthoritativeRecoverySatisfied,
    provenanceReversalEvidencePresent: stamped.provenanceReversalEvidencePresent,
  };
}

/**
 * PR-CAM-EVENT-OWNER-DOWNGRADE-01: 과거 `canEventPromote` 와 동일 조건 순서로 관측 전용 사유만 산출(임계·게이트 변경 없음).
 */
function deriveEventCyclePromotionObservability(input: {
  canPromote: boolean;
  state: SquatCompletionState;
  squatEventCycle: SquatEventCycleResult;
  ruleBlock: string | null;
  finalizeOk: boolean;
  ultraLowRomEventPromotionAllowed: boolean;
}): Pick<SquatCompletionState, 'eventCyclePromotionCandidate' | 'eventCyclePromotionBlockedReason'> {
  if (input.canPromote) {
    return {
      eventCyclePromotionCandidate: true,
      eventCyclePromotionBlockedReason: 'event_promotion_owner_disabled',
    };
  }

  const s = input.state;
  const ec = input.squatEventCycle;

  if (s.completionPassReason !== 'not_confirmed') {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'completion_pass_reason_not_pending',
    };
  }
  if (input.ruleBlock == null) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'no_rule_completion_blocked_reason',
    };
  }
  if (PR_04E3B_NO_EVENT_PROMOTION_BLOCKS.has(input.ruleBlock)) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'rule_block_bars_event_promotion',
    };
  }
  if (!input.finalizeOk) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'standing_finalize_not_satisfied_for_event_gate',
    };
  }
  if (s.standingRecoveredAtMs == null) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'standing_recovered_timestamp_missing',
    };
  }
  if (!ec.detected) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'event_cycle_not_detected',
    };
  }
  if (ec.band == null) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'event_cycle_band_missing',
    };
  }
  if (!(s.relativeDepthPeak < STANDARD_OWNER_FLOOR)) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'relative_depth_not_below_standard_owner_floor',
    };
  }
  if (!input.ultraLowRomEventPromotionAllowed) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'ultra_low_rom_event_promotion_gate_blocked',
    };
  }

  return {
    eventCyclePromotionCandidate: false,
    eventCyclePromotionBlockedReason: 'event_promotion_not_eligible',
  };
}

/** PR-05 entry-tier 차단 사유 — eligible=false 로 스탬프 */
const TRAJECTORY_GUARD_ENTRY_BLOCK_REASONS = new Set<string>([
  'shallow_admission_not_satisfied',
  'no_attempt_descend_or_commitment',
  'peak_not_latched',
  'peak_anchor_at_series_start',
  'outside_shallow_owner_zone',
  'not_armed',
  'no_committed_peak_anchor',
]);

/**
 * PR-06: 통제된 trajectory-assisted shallow 사이클 신호가 **closure proof 정규화**를 받을 수 있는지.
 * 성공 클로저를 직접 열지 않음 — null 이면 전부 통과.
 */
function guardedTrajectoryShallowSignalBlockReason(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: GuardedTrajectoryShallowBridgeOpts
): string | null {
  if (!state.officialShallowPathCandidate || !state.officialShallowPathAdmitted) {
    return 'shallow_admission_not_satisfied';
  }
  if (!state.attemptStarted || !state.descendConfirmed || !state.downwardCommitmentReached) {
    return 'no_attempt_descend_or_commitment';
  }
  const local = opts.guardedShallowLocalPeakAnchor;
  const localAnchorOk =
    local?.found === true &&
    local.localPeakIndex != null &&
    local.localPeakIndex > 0 &&
    local.localPeakFrame != null;

  if (state.peakLatched !== true) {
    return 'peak_not_latched';
  }
  if (!localAnchorOk) {
    const pli = state.peakLatchedAtIndex;
    if (pli == null || pli <= 0) {
      return 'peak_anchor_at_series_start';
    }
    if (state.peakAnchorTruth !== 'committed_or_post_commit_peak') {
      return 'no_committed_peak_anchor';
    }
  }

  if (state.relativeDepthPeak >= STANDARD_OWNER_FLOOR) {
    return 'outside_shallow_owner_zone';
  }

  if (opts.setupMotionBlocked === true) {
    return 'setup_motion_blocked';
  }
  if (state.eventCyclePromoted === true) {
    return 'event_cycle_promoted';
  }
  if (state.currentSquatPhase === 'idle') {
    return 'idle_phase';
  }
  /** PR-06: not_armed 는 시도/하강 여부와 무관하게 브리지·정규화 금지 */
  if (state.completionBlockedReason === 'not_armed') {
    return 'not_armed';
  }

  const notes = ec.notes ?? [];
  if (!localAnchorOk && notes.includes('peak_anchor_at_series_start')) {
    return 'peak_anchor_at_series_start';
  }
  if (notes.includes('series_too_short')) {
    return 'series_too_short';
  }

  const standingSidePhase =
    state.currentSquatPhase === 'standing_recovered' || state.currentSquatPhase === 'ascending';
  if (!standingSidePhase && !ec.nearStandingRecovered) {
    return 'bottom_hold_or_incomplete_cycle';
  }

  if (state.trajectoryReversalRescueApplied !== true) {
    return 'no_trajectory_reversal_rescue';
  }
  if (state.reversalEvidenceProvenance !== 'trajectory_anchor_rescue') {
    return 'reversal_provenance_not_trajectory_anchor';
  }

  if (!ec.reversalDetected || !ec.recoveryDetected || !ec.nearStandingRecovered) {
    return 'no_guarded_bridge_evidence';
  }

  const machinePhase = deriveSquatCompletionMachinePhase({
    completionSatisfied: false,
    currentSquatPhase: state.currentSquatPhase,
    downwardCommitmentReached: state.downwardCommitmentReached,
  });
  if (machinePhase !== 'recovered') {
    return 'completion_machine_phase_not_recovered';
  }

  if (state.standingRecoveredAtMs == null) {
    return 'no_recovery_pattern';
  }
  if (state.standingFinalizeSatisfied !== true) {
    return 'no_recovery_pattern';
  }

  const fr = state.standingRecoveryFinalizeReason;
  const finalizeOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    fr === 'low_rom_tail_guarded_finalize';
  if (!finalizeOk) {
    return 'no_recovery_pattern';
  }

  const recoveryProofOk =
    fr === 'standing_hold_met' ||
    recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
      recoveryDropRatio: state.recoveryDropRatio,
    });
  if (!recoveryProofOk) {
    return 'no_recovery_pattern';
  }

  const req = state.squatReversalDropRequired ?? REVERSAL_DROP_MIN_ABS;
  const minDrop = Math.max(REVERSAL_DROP_MIN_ABS, req * 0.88) - 1e-12;
  const achieved = state.squatReversalDropAchieved ?? 0;
  if (achieved < minDrop) {
    return 'insufficient_post_peak_return';
  }

  return null;
}

/**
 * PR-CAM-SHALLOW-CLOSURE-PROOF-NORMALIZE-06: shallow closure proof 정규화 자격만 판정(직접 통과 아님).
 */
function getGuardedShallowClosureProofFromTrajectoryBridge(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: GuardedTrajectoryShallowBridgeOpts
): { satisfied: boolean; blockedReason: string | null } {
  const br = guardedTrajectoryShallowSignalBlockReason(state, ec, opts);
  return { satisfied: br === null, blockedReason: br };
}

/**
 * PR-CAM-SHALLOW-TRAJECTORY-BRIDGE-05: 공식 shallow 입장·실하강·commitment 이후에만 trajectory rescue 증거를
 * 권위 completion에 예외 연결한다. provenance 전역 승격·이벤트 승격 소유권 복구 아님.
 */
function getShallowTrajectoryAuthoritativeBridgeDecision(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: GuardedTrajectoryShallowBridgeOpts
): { eligible: boolean; satisfied: boolean; blockedReason: string | null } {
  if (state.completionSatisfied === true) {
    return { eligible: false, satisfied: false, blockedReason: null };
  }

  const br = guardedTrajectoryShallowSignalBlockReason(state, ec, opts);
  if (br === null) {
    return { eligible: true, satisfied: true, blockedReason: null };
  }
  const eligible = !TRAJECTORY_GUARD_ENTRY_BLOCK_REASONS.has(br);
  return { eligible, satisfied: false, blockedReason: br };
}

/**
 * PR-CAM-SHALLOW-TICKET-UNIFICATION-12: 브리지 관측 스탬프만 — completion 은 `ShallowCompletionTicket` 단일 권위.
 */
function mergeShallowTrajectoryAuthoritativeBridge(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts?: GuardedTrajectoryShallowBridgeOpts
): SquatCompletionState {
  const dec = getShallowTrajectoryAuthoritativeBridgeDecision(state, ec, {
    setupMotionBlocked: opts?.setupMotionBlocked,
    guardedShallowLocalPeakAnchor: opts?.guardedShallowLocalPeakAnchor,
  });

  return {
    ...state,
    shallowTrajectoryBridgeEligible: dec.eligible,
    shallowTrajectoryBridgeSatisfied: dec.satisfied,
    shallowTrajectoryBridgeBlockedReason: dec.satisfied ? null : dec.blockedReason,
  };
}

/**
 * PR-CAM-SHALLOW-TICKET-UNIFICATION-12: 기존 신호만 모아 shallow 완료 티켓 1장을 만든다(새 증명 축 없음).
 */
function buildShallowCompletionTicket(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: { setupMotionBlocked: boolean }
): ShallowCompletionTicket {
  const s = state;
  const rel = s.relativeDepthPeak ?? 0;
  const inShallowOwnerZone = rel < STANDARD_OWNER_FLOOR;

  const admissionSatisfied =
    s.officialShallowPathCandidate === true &&
    s.officialShallowPathAdmitted === true &&
    inShallowOwnerZone;

  const attemptSatisfied = s.attemptStarted === true;
  const descendSatisfied = s.descendConfirmed === true;
  const commitmentSatisfied = s.downwardCommitmentReached === true;

  const machinePhase = deriveSquatCompletionMachinePhase({
    completionSatisfied: false,
    currentSquatPhase: s.currentSquatPhase,
    downwardCommitmentReached: s.downwardCommitmentReached,
  });
  const machinePhaseOk = machinePhase === 'recovered' || machinePhase === 'completed';

  const trajectorySuffixOk =
    s.trajectoryReversalRescueApplied === true &&
    s.reversalEvidenceProvenance === 'trajectory_anchor_rescue';

  const ecSuffixOk =
    ec.reversalDetected === true &&
    ec.recoveryDetected === true &&
    ec.nearStandingRecovered === true;

  const standingTsOk = s.standingRecoveredAtMs != null;

  const fr = s.standingRecoveryFinalizeReason;
  const finalizeReasonOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    fr === 'low_rom_tail_guarded_finalize';

  const continuityOk = recoveryMeetsLowRomStyleFinalizeProof({
    recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
    recoveryDropRatio: s.recoveryDropRatio,
  });

  const st = s as SquatCompletionState & { standingRecoveryFinalizeSatisfied?: boolean };
  const finalizeBundleOk =
    st.standingRecoveryFinalizeSatisfied === true ||
    finalizeReasonOk ||
    continuityOk ||
    s.standingFinalizeSatisfied === true;

  const recoveryProofOk =
    fr === 'standing_hold_met' ||
    recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
      recoveryDropRatio: s.recoveryDropRatio,
    });

  const req = s.squatReversalDropRequired ?? REVERSAL_DROP_MIN_ABS;
  const minDrop = Math.max(REVERSAL_DROP_MIN_ABS, req * 0.88) - 1e-12;
  const achieved = s.squatReversalDropAchieved ?? 0;
  const postPeakReturnOk = achieved >= minDrop;

  const trajectoryLateSuffixOk =
    machinePhaseOk &&
    trajectorySuffixOk &&
    ecSuffixOk &&
    standingTsOk &&
    finalizeBundleOk &&
    recoveryProofOk &&
    postPeakReturnOk;

  /** 공식 스트림 브리지 — trajectory rescue 없이도 동일 finalize·이벤트 증거가 있으면 접미사로 인정(PR-03 rework). */
  const streamBridgeLateSuffixOk =
    s.officialShallowStreamBridgeApplied === true &&
    machinePhaseOk &&
    ecSuffixOk &&
    standingTsOk &&
    finalizeBundleOk &&
    recoveryProofOk &&
    postPeakReturnOk;

  /** PR-08/09 국소 suffix | trajectory 접미사 | 스트림 브리지 접미사 — 새 증거 축 없음. */
  const lateRecoveredSuffixSatisfied =
    s.guardedShallowRecoveredSuffixSatisfied === true ||
    trajectoryLateSuffixOk ||
    streamBridgeLateSuffixOk;

  const notes = ec.notes ?? [];
  const antiFalsePassGuardsSatisfied =
    opts.setupMotionBlocked !== true &&
    s.eventCyclePromoted !== true &&
    !notes.includes('series_too_short') &&
    !notes.includes('jitter_spike_reject') &&
    s.evidenceLabel !== 'insufficient_signal' &&
    s.completionBlockedReason !== 'no_descend' &&
    s.completionBlockedReason !== 'no_commitment' &&
    s.completionBlockedReason !== 'not_armed' &&
    s.currentSquatPhase !== 'idle';

  const innerSatisfied =
    admissionSatisfied &&
    attemptSatisfied &&
    descendSatisfied &&
    commitmentSatisfied &&
    lateRecoveredSuffixSatisfied &&
    antiFalsePassGuardsSatisfied;

  const eligible =
    s.officialShallowPathCandidate === true &&
    s.officialShallowPathAdmitted === true &&
    inShallowOwnerZone &&
    s.completionPassReason === 'not_confirmed' &&
    s.completionSatisfied !== true &&
    s.eventCyclePromoted !== true &&
    opts.setupMotionBlocked !== true;

  let firstFailedStage: string | null = null;
  if (!admissionSatisfied) firstFailedStage = 'admission';
  else if (!attemptSatisfied) firstFailedStage = 'attempt';
  else if (!descendSatisfied) firstFailedStage = 'descend';
  else if (!commitmentSatisfied) firstFailedStage = 'commitment';
  else if (!lateRecoveredSuffixSatisfied) {
    if (
      machinePhaseOk &&
      trajectorySuffixOk &&
      ecSuffixOk &&
      standingTsOk &&
      !finalizeBundleOk
    ) {
      firstFailedStage = 'finalize_bundle';
    } else {
      firstFailedStage = 'late_suffix';
    }
  } else if (!antiFalsePassGuardsSatisfied) firstFailedStage = 'anti_false_pass';

  const satisfied = eligible && innerSatisfied;
  const blockedReason =
    eligible && !innerSatisfied && firstFailedStage != null
      ? `shallow_ticket_${firstFailedStage}`
      : null;

  const proofSatisfied = satisfied;
  const consumptionSatisfied = satisfied;

  return {
    eligible,
    satisfied,
    blockedReason,
    admissionSatisfied,
    attemptSatisfied,
    descendSatisfied,
    commitmentSatisfied,
    lateRecoveredSuffixSatisfied,
    antiFalsePassGuardsSatisfied,
    proofSatisfied,
    consumptionSatisfied,
    firstFailedStage,
  } satisfies ShallowCompletionTicket;
}

/**
 * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: applyShallowCompletionTicketPatch 및
 * applyShallowCompletionTicketEligibleFailureProjection 은 PR-B 에서 삭제됨.
 * ticket 은 observability 스탬프만 — completion writer 역할은 canonical closer 에 이양.
 */

/** PR-10 레거시 소비 결정 형태 — PR-12 티켓이 합성해 트레이스에 전달한다. */
export type OfficialShallowConsumptionDecision = {
  eligible: boolean;
  satisfied: boolean;
  blockedReason: string | null;
};

/**
 * PR-10 소비 로직은 PR-CAM-SHALLOW-TICKET-UNIFICATION-12 에서 `ShallowCompletionTicket` 단일 권위로 대체됨.
 * 타입·트레이스 헬퍼는 티켓 기준 `shallowConsumption` 합성에 사용한다.
 */

/** PR-CAM-SHALLOW-PROOF-TRACE-11: 구 PR-10 ineligible 체인 순서 미러(관측만). */
function firstOfficialShallowConsumptionIneligibilityReason(
  state: SquatCompletionState,
  setupMotionBlocked: boolean
): string | null {
  const T = SHALLOW_CLOSURE_PROOF_TRACE_REASON;
  if (state.officialShallowPathCandidate !== true) return T.admission_not_reached;
  if (state.officialShallowPathAdmitted !== true) return T.admission_not_admitted;
  if (state.completionSatisfied === true) return null;
  if (state.completionPassReason !== 'not_confirmed') return `${T.consumption_not_eligible}_pass_reason_not_pending`;
  if ((state.relativeDepthPeak ?? 0) >= STANDARD_OWNER_FLOOR) return T.outside_shallow_owner_zone;
  if (state.eventCyclePromoted === true) return `${T.consumption_not_eligible}_event_cycle_promoted`;
  if (setupMotionBlocked) return `${T.consumption_not_eligible}_setup_motion_blocked`;
  return null;
}

/** PR-CAM-SHALLOW-PROOF-TRACE-11: guarded 브리지/정규화 차단을 트레이스 상수로 정규화(게이트 미사용). */
function mapGuardedClosureBlockToTraceReason(blocked: string | null): string | null {
  if (blocked == null) return null;
  const T = SHALLOW_CLOSURE_PROOF_TRACE_REASON;
  if (blocked === 'peak_anchor_at_series_start') return T.peak_anchor_at_series_start;
  if (blocked === 'no_committed_peak_anchor' || blocked === 'peak_not_latched') {
    return T.local_peak_missing;
  }
  if (blocked === 'outside_shallow_owner_zone') return T.outside_shallow_owner_zone;
  if (blocked === 'no_recovery_pattern' || blocked === 'insufficient_post_peak_return') {
    return T.trajectory_bridge_no_recovery_pattern;
  }
  if (blocked === 'no_guarded_bridge_evidence' || blocked === 'no_trajectory_reversal_rescue') {
    return T.trajectory_bridge_no_recovery_pattern;
  }
  if (TRAJECTORY_GUARD_ENTRY_BLOCK_REASONS.has(blocked)) {
    return T.trajectory_bridge_not_eligible;
  }
  return blocked;
}

function computeProofLayerBlockedReason(s: SquatCompletionState): string | null {
  const T = SHALLOW_CLOSURE_PROOF_TRACE_REASON;
  if (s.officialShallowClosureProofSatisfied !== true) return T.proof_closure_bundle_not_satisfied;
  if (s.officialShallowPrimaryDropClosureFallback !== true) return T.proof_primary_drop_not_satisfied;
  if (s.officialShallowReversalSatisfied !== true) return T.proof_reversal_not_satisfied;
  return null;
}

/**
 * PR-CAM-SHALLOW-PROOF-TRACE-11: shallow 소비·증명 체인에서 가장 앞선 결정적 차단(추론 최소화).
 * 기존 필드·소비 결정만 사용 — 새 게이트 없음.
 */
function computeFirstDecisiveShallowProofBlockedReason(input: {
  state: SquatCompletionState;
  shallowConsumption: OfficialShallowConsumptionDecision;
  setupMotionBlocked: boolean;
  bridgeEligible: boolean;
  guardedClosureBlockedReason: string | null;
}): string | null {
  const T = SHALLOW_CLOSURE_PROOF_TRACE_REASON;
  const s = input.state;
  const c = input.shallowConsumption;

  if (!s.officialShallowPathCandidate) return T.admission_not_reached;
  if (!s.officialShallowPathAdmitted) return T.admission_not_admitted;
  if (!s.attemptStarted || !s.descendConfirmed) return T.no_attempt_or_descend;
  if (!s.downwardCommitmentReached) return T.no_downward_commitment;
  if (s.ruleCompletionBlockedReason === 'not_armed' || s.completionBlockedReason === 'not_armed') {
    return T.not_armed;
  }

  const inel = firstOfficialShallowConsumptionIneligibilityReason(s, input.setupMotionBlocked);
  if (inel != null) return inel;

  if (c.eligible && !c.satisfied && c.blockedReason === 'official_shallow_proof_incomplete') {
    const p = computeProofLayerBlockedReason(s);
    return p ?? T.proof_flags_not_set;
  }

  const proofBundleOk =
    s.officialShallowClosureProofSatisfied === true &&
    s.officialShallowPrimaryDropClosureFallback === true &&
    s.officialShallowReversalSatisfied === true;

  if (c.eligible && !c.satisfied && proofBundleOk) {
    return T.proof_synthesized_but_not_consumed;
  }

  if (c.eligible && !c.satisfied && c.blockedReason != null) {
    if (c.blockedReason === 'recovery_finalize_proof_missing') return T.recovered_suffix_no_finalize_bundle;
    if (c.blockedReason === 'recovery_chain_not_satisfied') return T.trajectory_bridge_no_recovery_pattern;
    return `${T.consumption_blocked}:${c.blockedReason}`;
  }

  if (!input.bridgeEligible && input.guardedClosureBlockedReason != null) {
    const mapped = mapGuardedClosureBlockToTraceReason(input.guardedClosureBlockedReason);
    if (mapped != null) return mapped;
  }

  if (
    s.completionBlockedReason === 'no_reversal' &&
    s.officialShallowReversalSatisfied !== true &&
    proofBundleOk
  ) {
    return T.consumption_rejected_by_no_reversal;
  }

  return null;
}

function isShallowClosureProofTraceRelevant(s: SquatCompletionState): boolean {
  const rel = s.relativeDepthPeak ?? 0;
  const shallowObs =
    (s as { shallowCandidateObserved?: boolean }).shallowCandidateObserved === true;
  return (
    shallowObs ||
    s.officialShallowPathCandidate === true ||
    s.officialShallowPathAdmitted === true ||
    rel < STANDARD_OWNER_FLOOR
  );
}

/**
 * PR-CAM-SHALLOW-PROOF-TRACE-11: 1차 `evaluateSquatCompletionState` 종단 스냅샷(판정 로직 변경 없음).
 */
function buildShallowClosureProofTrace(input: {
  finalState: SquatCompletionState;
  ec: SquatEventCycleResult;
  localPeakAnchor: GuardedShallowLocalPeakAnchor;
  bridgeDecisionPreMerge: { eligible: boolean; satisfied: boolean; blockedReason: string | null };
  shallowConsumption: OfficialShallowConsumptionDecision;
  setupMotionBlocked: boolean;
  recoveredSuffixApply: boolean;
}): ShallowClosureProofTrace {
  const T = SHALLOW_CLOSURE_PROOF_TRACE_REASON;
  const s = input.finalState;
  const ec = input.ec;
  const rel = s.relativeDepthPeak ?? 0;
  const inZone = rel < STANDARD_OWNER_FLOOR;
  const guardedSatisfied = s.guardedShallowTrajectoryClosureProofSatisfied === true;
  const guardedBlocked = s.guardedShallowTrajectoryClosureProofBlockedReason ?? null;

  const stFin = s as SquatCompletionState & {
    standingRecoveryFinalizeSatisfied?: boolean;
    standingRecoveryFinalizeBand?: SquatEvidenceLabel;
  };
  const finalizeSatisfied = stFin.standingRecoveryFinalizeSatisfied === true;
  const finalizeBand = stFin.standingRecoveryFinalizeBand ?? s.standingRecoveryBand ?? null;

  const continuityOk = recoveryMeetsLowRomStyleFinalizeProof({
    recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
    recoveryDropRatio: s.recoveryDropRatio,
  });

  const recoveredSuffixEligible =
    s.officialShallowPathCandidate === true &&
    s.officialShallowPathAdmitted === true &&
    inZone &&
    s.attemptStarted === true &&
    s.descendConfirmed === true &&
    s.downwardCommitmentReached === true;

  let recoveredSuffixBlockedSummary: string | null = null;
  if (recoveredSuffixEligible && !input.recoveredSuffixApply) {
    recoveredSuffixBlockedSummary = T.recovered_suffix_not_eligible;
  } else if (
    recoveredSuffixEligible &&
    input.recoveredSuffixApply &&
    s.guardedShallowRecoveredSuffixSatisfied !== true
  ) {
    recoveredSuffixBlockedSummary =
      s.guardedShallowRecoveredSuffixBlockedReason ?? T.recovered_suffix_no_finalize_bundle;
  }

  const proofBlockedReason = computeProofLayerBlockedReason(s);

  const ineligibilityFirst = firstOfficialShallowConsumptionIneligibilityReason(
    s,
    input.setupMotionBlocked
  );

  const bridgeBlockedTrace =
    input.bridgeDecisionPreMerge.satisfied
      ? null
      : mapGuardedClosureBlockToTraceReason(input.bridgeDecisionPreMerge.blockedReason) ??
        input.bridgeDecisionPreMerge.blockedReason;

  const stage: ShallowClosureProofTraceStage = (() => {
    if (!s.officialShallowPathCandidate) return 'pre_admission';
    if (!s.officialShallowPathAdmitted) return 'pre_admission';
    if (!input.bridgeDecisionPreMerge.eligible && inZone) return 'bridge';
    if (input.shallowConsumption.eligible && !input.shallowConsumption.satisfied) {
      if (input.shallowConsumption.blockedReason === 'official_shallow_proof_incomplete') return 'proof';
      if (
        input.shallowConsumption.blockedReason === 'recovery_finalize_proof_missing' ||
        input.shallowConsumption.blockedReason === 'recovery_chain_not_satisfied'
      ) {
        return 'suffix';
      }
      return 'consumption';
    }
    if (proofBlockedReason != null && ineligibilityFirst == null) return 'proof';
    return input.shallowConsumption.satisfied ? 'consumption' : 'admitted';
  })();

  const firstDecisive = computeFirstDecisiveShallowProofBlockedReason({
    state: s,
    shallowConsumption: input.shallowConsumption,
    setupMotionBlocked: input.setupMotionBlocked,
    bridgeEligible: input.bridgeDecisionPreMerge.eligible,
    guardedClosureBlockedReason: guardedBlocked,
  });

  const topBlocked =
    firstDecisive ??
    proofBlockedReason ??
    (input.shallowConsumption.eligible ? input.shallowConsumption.blockedReason : ineligibilityFirst);

  const topSatisfied = input.shallowConsumption.satisfied === true;
  const topEligible =
    ineligibilityFirst == null &&
    (input.shallowConsumption.eligible || s.completionSatisfied === true);

  return {
    stage,
    eligible: topEligible,
    satisfied: topSatisfied,
    blockedReason: topSatisfied ? null : topBlocked,
    firstDecisiveBlockedReason: firstDecisive,
    proofBlockedReason,
    consumptionBlockedReason: input.shallowConsumption.eligible
      ? input.shallowConsumption.blockedReason
      : ineligibilityFirst,

    admission: {
      candidate: s.officialShallowPathCandidate === true,
      admitted: s.officialShallowPathAdmitted === true,
      relativeDepthPeak: rel,
      inShallowOwnerZone: inZone,
    },

    attempt: {
      attemptStarted: s.attemptStarted === true,
      descendConfirmed: s.descendConfirmed === true,
      downwardCommitmentReached: s.downwardCommitmentReached === true,
      armedLike:
        s.attemptStarted === true &&
        s.completionBlockedReason !== 'not_armed' &&
        s.ruleCompletionBlockedReason !== 'not_armed',
    },

    peak: {
      peakLatched: s.peakLatched === true,
      peakLatchedAtIndex: s.peakLatchedAtIndex ?? null,
      peakAnchorTruth: s.peakAnchorTruth ?? null,
      localPeakFound: input.localPeakAnchor.found,
      localPeakIndex: input.localPeakAnchor.localPeakIndex,
      localPeakBlockedReason: input.localPeakAnchor.found ? null : input.localPeakAnchor.blockedReason,
    },

    bridge: {
      trajectoryRescue: s.trajectoryReversalRescueApplied === true,
      provenance: s.reversalEvidenceProvenance ?? null,
      eventCycleDetected: ec.detected === true,
      reversalDetected: ec.reversalDetected === true,
      recoveryDetected: ec.recoveryDetected === true,
      nearStandingRecovered: ec.nearStandingRecovered === true,
      eventCycleNotes: ec.notes != null ? [...ec.notes] : [],
      eligible: input.bridgeDecisionPreMerge.eligible,
      satisfied: input.bridgeDecisionPreMerge.satisfied,
      bridgeBlockedReason: bridgeBlockedTrace,
      guardedClosureProofSatisfied: guardedSatisfied,
      guardedClosureProofBlockedReason: guardedBlocked,
    },

    suffix: {
      completionMachinePhase: s.completionMachinePhase ?? null,
      recoveryConfirmedAfterReversal: s.recoveryConfirmedAfterReversal === true,
      standingRecoveredAtMs: s.standingRecoveredAtMs ?? null,
      finalizeSatisfied,
      finalizeReason: s.standingRecoveryFinalizeReason ?? null,
      finalizeBand,
      continuityOk,
      recoveredSuffixEligible,
      recoveredSuffixSatisfied: s.guardedShallowRecoveredSuffixSatisfied === true,
      recoveredSuffixBlockedReason: s.guardedShallowRecoveredSuffixBlockedReason ?? null,
      recoveredSuffixEvaluatorApplied: input.recoveredSuffixApply === true,
      recoveredSuffixBlockedSummary,
    },

    proof: {
      officialShallowReversalSatisfied: s.officialShallowReversalSatisfied === true,
      officialShallowClosureProofSatisfied: s.officialShallowClosureProofSatisfied === true,
      officialShallowPrimaryDropClosureFallback: s.officialShallowPrimaryDropClosureFallback === true,
      guardedTrajectoryClosureProofSatisfied: guardedSatisfied,
      guardedRecoveredSuffixSatisfied: s.guardedShallowRecoveredSuffixSatisfied === true,
      proofBlockedReason,
    },

    consumption: {
      eligible: input.shallowConsumption.eligible,
      satisfied: input.shallowConsumption.satisfied,
      blockedReason: input.shallowConsumption.blockedReason,
      ineligibilityFirstReason: ineligibilityFirst,
      completionPassReason: s.completionPassReason ?? null,
      completionBlockedReason: s.completionBlockedReason ?? null,
      completionSatisfied: s.completionSatisfied === true,
    },
  };
}

/**
 * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY:
 * Minimum cycle duration for official shallow close (descent start → standing recovered).
 *
 * PR-13: Lowered from 1500ms to 800ms.
 * Rationale: the 1500ms floor was derived from SQUAT_ARMING_MS but is too strict for
 * legitimate fast ultra-shallow reps. Real-device telemetry shows 0.05–0.07 relPeak squats
 * complete in ~800–1200ms total (effectiveDescentStartFrame → standingRecoveredAtMs).
 * The 1500ms floor blocked every such attempt, forcing users to deepen into low_rom before
 * passing — the exact symptom targeted by PR-13.
 * Remaining safeguards still prevent micro-bounces:
 *   - 200ms minimum reversal-to-standing span (minReversalToStandingMsForShallow)
 *   - non-degenerate commitment gate (downwardCommitmentDelta > 0)
 *   - reversal by rule/HMM only (reversalConfirmedByRuleOrHmm=true required)
 *   - standing finalize hold (60–160ms minimum)
 * 200ms and 7500ms thresholds are NOT changed (PR-13 SSOT constraint).
 */
const SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS = 800;

/** PR-CAM-CANONICAL-SHALLOW-CONTRACT-01: 이미 계산된 state fact 만 canonical 입력으로 넘긴다. */
function buildCanonicalShallowContractInputFromState(s: SquatCompletionState) {
  /**
   * PR-E1B-PEAK-ANCHOR-CONTAMINATION-01: canonical anti-false-pass 입력 peak index 보정.
   *
   * 글로벌/raw `peakLatchedAtIndex` 는 evaluateSquatCompletionCore 가 전체 버퍼에서 구한 값으로,
   * baseline 앞 시리즈 시작 스파이크 등으로 index=0 이 될 수 있다.
   * 이 경우 canonical contract 의 anti-false-pass(`peakLatchedAtIndex !== 0`) 가 항상 실패해
   * shallow closure 가 영구적으로 차단된다.
   *
   * 해결책: admitted shallow attempt 에서 `getGuardedShallowLocalPeakAnchor` 가 이미
   * 시리즈 시작 오염을 제거한 locally-valid peak(`> 0`)을 찾았다면,
   * canonical 입력에서만 그 인덱스로 대체한다.
   * - 글로벌 `state.peakLatchedAtIndex` 는 변경하지 않는다(debug/trace 용 보존).
   * - 로컬 피크가 없는 경우(shallow admission 미달 또는 진짜 오염만 있는 경우)는 원래 값 사용.
   */
  const rawPeakLatchedAtIndex = s.peakLatchedAtIndex ?? null;
  const localPeakIdx = s.guardedShallowLocalPeakIndex ?? null;
  const canonicalPeakLatchedAtIndex =
    rawPeakLatchedAtIndex === 0 &&
    s.officialShallowPathAdmitted === true &&
    s.guardedShallowLocalPeakFound === true &&
    localPeakIdx != null &&
    localPeakIdx > 0
      ? localPeakIdx
      : rawPeakLatchedAtIndex;

  return {
    relativeDepthPeak: s.relativeDepthPeak ?? 0,
    officialShallowPathCandidate: s.officialShallowPathCandidate === true,
    officialShallowPathAdmitted: s.officialShallowPathAdmitted === true,
    attemptStarted: s.attemptStarted === true,
    descendConfirmed: s.descendConfirmed === true,
    downwardCommitmentReached: s.downwardCommitmentReached === true,
    currentSquatPhase: s.currentSquatPhase,
    completionBlockedReason: s.completionBlockedReason ?? null,
    ownerAuthoritativeReversalSatisfied: s.ownerAuthoritativeReversalSatisfied === true,
    ownerAuthoritativeRecoverySatisfied: s.ownerAuthoritativeRecoverySatisfied === true,
    officialShallowStreamBridgeApplied: s.officialShallowStreamBridgeApplied === true,
    officialShallowAscentEquivalentSatisfied: s.officialShallowAscentEquivalentSatisfied === true,
    officialShallowClosureProofSatisfied: s.officialShallowClosureProofSatisfied === true,
    officialShallowPrimaryDropClosureFallback: s.officialShallowPrimaryDropClosureFallback === true,
    provenanceReversalEvidencePresent: s.provenanceReversalEvidencePresent === true,
    trajectoryReversalRescueApplied: s.trajectoryReversalRescueApplied === true,
    reversalTailBackfillApplied: s.reversalTailBackfillApplied === true,
    ultraShallowMeaningfulDownUpRescueApplied: s.ultraShallowMeaningfulDownUpRescueApplied === true,
    standingFinalizeSatisfied: s.standingFinalizeSatisfied === true,
    standingRecoveryFinalizeReason: s.standingRecoveryFinalizeReason ?? null,
    setupMotionBlocked: s.setupMotionBlocked === true,
    peakLatchedAtIndex: canonicalPeakLatchedAtIndex,
    evidenceLabel: s.evidenceLabel,
    officialShallowPathClosed: s.officialShallowPathClosed === true,
    /** PR-B: guarded trajectory proof — reversal evidence OR 에 합류 */
    guardedShallowTrajectoryClosureProofSatisfied: s.guardedShallowTrajectoryClosureProofSatisfied === true,
    /** PR-B: split-brain 감지 보강용 */
    completionPassReason: s.completionPassReason ?? undefined,

    // ── PR-8: timing + epoch + weak-event gates ──
    /**
     * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: minimum cycle duration.
     * cycleDurationMs is defined when descent start and standing recovered are both known.
     * undefined → gate bypassed (conservative; completionSatisfied would be false anyway).
     */
    minimumCycleDurationSatisfied:
      s.cycleDurationMs != null
        ? s.cycleDurationMs >= SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS
        : undefined,
    /**
     * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: baseline frozen for current rep.
     * false → pre-freeze / pre-attempt epoch — official close blocked.
     * undefined → gate bypassed (state not yet set).
     */
    baselineFrozen: s.baselineFrozen,
    /**
     * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: peak latched for current rep.
     * false → pre-latch epoch — official close blocked.
     * undefined → gate bypassed (state not yet set).
     */
    peakLatched: s.peakLatched,
    /**
     * PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY: event cycle detected.
     * false + descent_weak + descentFrames=0 → proof/bridge cannot substitute for authoritative reversal.
     */
    eventCycleDetected: s.squatEventCycle?.detected,
    /** PR-8: event cycle has descent_weak note — weak descent quality flag. */
    eventCycleHasDescentWeak: s.squatEventCycle?.notes?.includes('descent_weak') ?? false,
    /** PR-8: number of descent frames in event cycle — 0 means no real descent detected. */
    eventCycleDescentFrames: s.squatEventCycle?.descentFrames,
    /**
     * PR-8: event cycle notes include 'freeze_or_latch_missing'.
     * detectSquatEventCycle adds this when baselineFrozen=false or peakLatched=false at
     * evaluation time — a fresh-rep epoch integrity violation at event cycle level.
     */
    eventCycleHasFreezeOrLatchMissing:
      s.squatEventCycle?.notes?.includes('freeze_or_latch_missing') ?? false,

    // ── PR-9: non-degenerate commitment + gold-path reversal integrity ──
    /**
     * PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS: actual descent delta from pre-peak baseline.
     * 0 → no actual descent occurred (standing at rest at depth threshold).
     * undefined → not yet computed (gate bypassed in contract — conservative).
     */
    downwardCommitmentDelta: s.downwardCommitmentDelta,
    /**
     * PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS: rule/HMM reversal confirmed (bridge excluded).
     * Used to tighten weak-event gate: stream bridge alone cannot bypass it.
     * undefined → gate bypassed (state not yet computed).
     */
    reversalConfirmedByRuleOrHmm: s.reversalConfirmedByRuleOrHmm,

    // ── PR-10: current-rep ownership integrity ──
    /**
     * PR-10-REP-SEGMENTATION-OWNERSHIP: time from reversal to standing recovery (ms).
     * squatReversalToStandingMs = standingRecoveredAtMs - reversalAtMs.
     * A large value indicates the reversal came from a prior attempt (repeated shallow
     * aggregation, slow-rise laundering): the reversal evidence is stale.
     * Values exceeding 7500ms (= 5 × SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS) are blocked
     * by the currentRepOwnershipClear gate in the canonical contract.
     * undefined → gate bypassed (reversal or standing not yet established).
     */
    squatReversalToStandingMs: s.squatReversalToStandingMs,
  };
}

/**
 * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: shallow success 를 여는 유일한 writer.
 * canonical shallow contract 가 satisfied 이고 모든 guard 조건이 만족될 때만 official_shallow_cycle 을 연다.
 * 이 helper 외부에서 official_shallow_cycle 을 직접 쓰면 안 된다.
 */
function applyCanonicalShallowClosureFromContract(
  state: SquatCompletionState
): SquatCompletionState {
  if (state.canonicalShallowContractSatisfied !== true) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }
  if (state.completionPassReason !== 'not_confirmed') {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: state.canonicalShallowContractClosureSource ?? 'none',
    };
  }
  if (!(state.relativeDepthPeak < STANDARD_OWNER_FLOOR)) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }
  if (state.officialShallowPathCandidate !== true) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }
  if (state.officialShallowPathAdmitted !== true) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }

  const closureSource = state.canonicalShallowContractClosureSource ?? 'canonical_authoritative';

  const completionFinalizeMode = deriveSquatCompletionFinalizeMode({
    completionSatisfied: true,
    eventCyclePromoted: false,
    assistSourcesWithoutPromotion: state.completionAssistSources ?? [],
    officialShallowAuthoritativeClosure: true,
  });

  /**
   * PR-E1-CANONICAL-SHALLOW-OWNER-CLOSURE-01:
   * `computeSquatCompletionOwnerTruth()` 가 owner truth 를 읽는 필드와 완전히 정렬한다.
   * - currentSquatPhase: 'standing_recovered' — owner truth 의 3번째 gate
   * - completionMachinePhase: 'completed'   — completionSatisfied=true 스냅샷 정합
   * closer 외부에서 이 두 필드를 덮어쓰지 않는다(attachShallowTruthObservabilityAlign01 포함).
   */
  return {
    ...state,
    completionPassReason: 'official_shallow_cycle',
    completionSatisfied: true,
    completionBlockedReason: null,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'completed',
    successPhaseAtOpen: 'standing_recovered',
    officialShallowPathClosed: true,
    officialShallowPathBlockedReason: null,
    ownerAuthoritativeShallowClosureSatisfied: true,
    shallowAuthoritativeClosureReason:
      closureSource === 'canonical_guarded_trajectory'
        ? 'canonical_shallow_contract_guarded_trajectory'
        : 'canonical_shallow_contract',
    shallowAuthoritativeClosureBlockedReason: null,
    completionFinalizeMode,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractClosureApplied: true,
    canonicalShallowContractClosureSource: closureSource,
  };
}

/**
 * PR-1-COMPLETION-STATE-SLIMMING: Pre-canonical observability layer.
 *
 * Stamps all observability facts that must exist before canonical contract derivation.
 * This function ONLY ADDS fields to state — it never modifies the completion truth fields
 * (completionSatisfied, completionBlockedReason, completionPassReason, currentSquatPhase,
 * completionMachinePhase, reversalConfirmedAfterDescend, recoveryConfirmedAfterReversal).
 *
 * Fields stamped here are then consumed as inputs by buildCanonicalShallowContractInputFromState.
 * The canonical contract derivation and single truth writer (applyCanonicalShallowClosureFromContract)
 * are called by evaluateSquatCompletionState AFTER this function returns.
 *
 * Ownership boundary: observability / pre-canonical input preparation only.
 */
function stampPreCanonicalObservability(
  state: SquatCompletionState,
  frames: PoseFeaturesFrame[],
  options: EvaluateSquatCompletionStateOptions | undefined
): SquatCompletionState {
  const validForEventFrames =
    state.officialShallowPreferredPrefixFrameCount != null
      ? frames.slice(0, state.officialShallowPreferredPrefixFrameCount)
      : frames;
  const validForEvent = validForEventFrames.filter((f) => f.isValid);
  const squatEventCycle = detectSquatEventCycle(validForEvent, {
    hmm: options?.hmm ?? undefined,
    baselineFrozenDepth: state.baselineFrozenDepth ?? state.baselineStandingDepth,
    lockedSource: state.relativeDepthPeakSource ?? null,
    baselineFrozen: state.baselineFrozen === true,
    peakLatched: state.peakLatched === true,
    peakLatchedAtIndex: state.peakLatchedAtIndex ?? null,
  });

  state = { ...state, squatEventCycle };

  const localPeakAnchor = getGuardedShallowLocalPeakAnchor({
    state,
    validFrames: validForEvent,
  });
  const shallowLocalPeakObsEligible =
    state.officialShallowPathCandidate === true &&
    state.officialShallowPathAdmitted === true &&
    state.attemptStarted === true &&
    state.descendConfirmed === true &&
    state.downwardCommitmentReached === true;

  const bridgeOpts: GuardedTrajectoryShallowBridgeOpts = {
    setupMotionBlocked: options?.setupMotionBlocked,
    guardedShallowLocalPeakAnchor: localPeakAnchor,
  };

  const guardedClosureProof = getGuardedShallowClosureProofFromTrajectoryBridge(
    state,
    squatEventCycle,
    bridgeOpts
  );

  state = {
    ...state,
    guardedShallowTrajectoryClosureProofSatisfied: guardedClosureProof.satisfied,
    guardedShallowTrajectoryClosureProofBlockedReason: guardedClosureProof.satisfied
      ? null
      : guardedClosureProof.blockedReason,
  };

  /**
   * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: guarded trajectory proof 는 canonical contract 의
   * input fact 로만 사용. synthetic re-run(core 재실행으로 closure proof 주입) 경로 제거.
   * guardedShallowTrajectoryClosureProofSatisfied 는 이미 위에서 state 에 stamped 됨.
   */

  if (shallowLocalPeakObsEligible) {
    state = {
      ...state,
      guardedShallowLocalPeakFound: localPeakAnchor.found,
      guardedShallowLocalPeakBlockedReason: localPeakAnchor.found
        ? null
        : localPeakAnchor.blockedReason,
      guardedShallowLocalPeakIndex: localPeakAnchor.localPeakIndex,
    };
  }

  const stateBeforeMerge = state;
  const bridgeDecisionPreMerge = getShallowTrajectoryAuthoritativeBridgeDecision(
    stateBeforeMerge,
    squatEventCycle,
    bridgeOpts
  );

  state = mergeShallowTrajectoryAuthoritativeBridge(state, squatEventCycle, bridgeOpts);

  const setupMotionBlockedFlag = options?.setupMotionBlocked === true;
  const shallowCompletionTicket = buildShallowCompletionTicket(state, squatEventCycle, {
    setupMotionBlocked: setupMotionBlockedFlag,
  });

  /**
   * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: ticket 은 observability 스탬프만 — completion writer 아님.
   * 모든 branch 에서 shallowCompletionTicket* 필드만 설정. completion/passReason/proof 변경 금지.
   */
  if (shallowCompletionTicket.eligible && shallowCompletionTicket.satisfied) {
    state = {
      ...state,
      shallowCompletionTicket,
      shallowCompletionTicketSatisfied: true,
      shallowCompletionTicketBlockedReason: null,
      shallowCompletionTicketStage: null,
    };
  } else if (shallowCompletionTicket.eligible && !shallowCompletionTicket.satisfied) {
    state = {
      ...state,
      shallowCompletionTicket,
      shallowCompletionTicketSatisfied: false,
      shallowCompletionTicketBlockedReason: shallowCompletionTicket.blockedReason,
      shallowCompletionTicketStage: shallowCompletionTicket.firstFailedStage ?? null,
    };
  } else {
    state = {
      ...state,
      shallowCompletionTicket,
      shallowCompletionTicketSatisfied: false,
      shallowCompletionTicketBlockedReason: null,
      shallowCompletionTicketStage: null,
    };
  }

  /** PR-10 호환: proof-trace 레이어는 티켓 결과를 소비 결정으로만 투영(별도 재판정 없음). */
  const shallowConsumption: OfficialShallowConsumptionDecision = {
    eligible: shallowCompletionTicket.eligible,
    satisfied: shallowCompletionTicket.eligible && shallowCompletionTicket.satisfied,
    blockedReason:
      shallowCompletionTicket.eligible && !shallowCompletionTicket.satisfied
        ? shallowCompletionTicket.blockedReason
        : null,
  };

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

  const promoObs = deriveEventCyclePromotionObservability({
    canPromote: canEventPromote,
    state,
    squatEventCycle,
    ruleBlock,
    finalizeOk,
    ultraLowRomEventPromotionAllowed,
  });

  const shallowClosureProofTrace = isShallowClosureProofTraceRelevant(state)
    ? buildShallowClosureProofTrace({
        finalState: state,
        ec: squatEventCycle,
        localPeakAnchor,
        bridgeDecisionPreMerge,
        shallowConsumption,
        setupMotionBlocked: options?.setupMotionBlocked === true,
        recoveredSuffixApply: options?.guardedShallowRecoveredSuffixClosureApply === true,
      })
    : undefined;

  return {
    ...state,
    eventCyclePromotionCandidate: promoObs.eventCyclePromotionCandidate,
    eventCyclePromotionBlockedReason: promoObs.eventCyclePromotionBlockedReason,
    eventCyclePromoted: false,
    ...(shallowClosureProofTrace != null ? { shallowClosureProofTrace } : {}),
  };
}

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

  let state = resolveStandardDriftAfterShallowAdmission(
    evaluateSquatCompletionCore(frames, options, depthFreeze),
    frames,
    options,
    depthFreeze
  );

  /**
   * PR-1-COMPLETION-STATE-SLIMMING: Observability stamps before canonical contract.
   * stampPreCanonicalObservability adds observability fields only — completion truth
   * (completionSatisfied / completionBlockedReason / completionPassReason) is not modified.
   */
  state = stampPreCanonicalObservability(state, frames, options);

  /**
   * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: canonical contract derive — 정확히 1회.
   * derive 이전 snapshot 기준으로 계산하며, 결과를 state 에 merge 한 뒤
   * applyCanonicalShallowClosureFromContract() 를 정확히 1회 호출해 shallow success 를 연다.
   * attachShallowTruthObservabilityAlign01() 은 그 이후에 호출.
   */
  const canonicalShallowContract = deriveCanonicalShallowCompletionContract(
    buildCanonicalShallowContractInputFromState(state)
  );

  state = {
    ...state,
    canonicalShallowContractEligible: canonicalShallowContract.eligible,
    canonicalShallowContractAdmissionSatisfied: canonicalShallowContract.admissionSatisfied,
    canonicalShallowContractAttemptSatisfied: canonicalShallowContract.attemptSatisfied,
    canonicalShallowContractReversalEvidenceSatisfied:
      canonicalShallowContract.reversalEvidenceSatisfied,
    canonicalShallowContractRecoveryEvidenceSatisfied:
      canonicalShallowContract.recoveryEvidenceSatisfied,
    canonicalShallowContractAntiFalsePassClear: canonicalShallowContract.antiFalsePassClear,
    canonicalShallowContractSatisfied: canonicalShallowContract.satisfied,
    canonicalShallowContractStage: canonicalShallowContract.stage,
    canonicalShallowContractBlockedReason: canonicalShallowContract.blockedReason,
    canonicalShallowContractAuthoritativeClosureWouldBeSatisfied:
      canonicalShallowContract.authoritativeClosureWouldBeSatisfied,
    canonicalShallowContractProvenanceOnlySignalPresent:
      canonicalShallowContract.provenanceOnlySignalPresent,
    canonicalShallowContractSplitBrainDetected: canonicalShallowContract.splitBrainDetected,
    canonicalShallowContractTrace: canonicalShallowContract.trace,
    canonicalShallowContractClosureSource: canonicalShallowContract.closureSource,
  };

  state = applyCanonicalShallowClosureFromContract(state);

  /**
   * PR-CAM-EVENT-OWNER-DOWNGRADE-01: 이벤트 사이클은 탐지·관측만 — canonical closer 가 성공 클로저의 유일 경로.
   * PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03: attach 는 pure observability.
   * product policy(applyUltraLowPolicyLock) 는 이 함수 내부에서 호출하지 않는다.
   * → evaluator boundary(evaluators/squat.ts) 에서 1회 적용한다.
   */
  return attachShallowTruthObservabilityAlign01(state);
}
