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

  /**
   * PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01: shallow 전용 — completion 권위 기준 단일 스테이지(디버그 전용).
   * pass/게이트 로직에 사용하지 않는다.
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
  /** 상위(타임라인) 역전 vs completion 권위 역전 불일치 */
  truthMismatch_reversalTopVsCompletion?: boolean;
  /** 상위(타임라인) 복귀 vs completion 권위 복귀 불일치 */
  truthMismatch_recoveryTopVsCompletion?: boolean;
  /** shallow path 입장(admitted) 했으나 닫히지 않고 미통과 */
  truthMismatch_shallowAdmissionVsClosure?: boolean;
  /** provenance 역전 신호는 있는데 권위 역전은 false */
  truthMismatch_provenanceReversalWithoutAuthoritative?: boolean;
  /** standing 밴드(standingRecoveredAtMs)는 잡혔으나 권위 복귀는 false */
  truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery?: boolean;

  /**
   * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: completionBlockedReason 등 권위 결과만으로 정규화된 차단 패밀리.
   */
  shallowNormalizedBlockerFamily?: ShallowNormalizedBlockerFamily;
  /**
   * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: shallow 계약(officialShallowPath*) 기준 단일 권위 상태.
   */
  shallowAuthoritativeContractStatus?: ShallowAuthoritativeContractStatus;
  /**
   * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: Q4 — shallow 권위로 닫혔는지(= officialShallowPathClosed, 의미 동일·명시).
   */
  shallowContractAuthoritativeClosure?: boolean;
  /**
   * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: 계약 체인 요약 한 줄(디버그 전용, 게이트 미사용).
   * 형식: candidate|admitted|reversalAuth|normalizedFamily|contractStatus
   */
  shallowContractAuthorityTrace?: string;
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
}): SquatCompletionFinalizeMode {
  if (!input.completionSatisfied) return 'blocked';
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
    params.standingRecoveryFinalizeSatisfied &&
    recoveryMeetsLowRomStyleFinalizeProof(params.recovery)
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
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract C: `completionPassReason` 단일 결정점.
 * (1) blocked → not_confirmed
 * (2) standard owner 대역 + 비이벤트 descent → standard_cycle
 * (3) official shallow admission + shallow owner 대역 + closure 증거(번들/브리지/역전) → *_cycle
 * (4) evidence/owner-shallow 밴드·derive 잔여
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
    if (params.evidenceLabel === 'ultra_low_rom') return 'ultra_low_rom_cycle';
    return 'low_rom_cycle';
  }

  const standardEvidenceOwnerShallowBand =
    params.evidenceLabel === 'standard' &&
    params.relativeDepthPeak > STANDARD_LABEL_FLOOR + 1e-9 &&
    params.relativeDepthPeak < STANDARD_OWNER_FLOOR;

  if (params.evidenceLabel === 'low_rom') return 'low_rom_cycle';
  if (params.evidenceLabel === 'ultra_low_rom') return 'ultra_low_rom_cycle';
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
  const officialShallowPrimaryDropClosureFallback = shallowClosureOut.officialShallowPrimaryDropClosureFallback;

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
   * PR-CAM-SQUAT-TRAJECTORY-RESCUE-OWNER-SEPARATION-01:
   * owner-authoritative 역전 확정 — strict rule / HMM reversal assist / shallow stream bridge /
   * tail backfill / ultra shallow down-up rescue만 포함한다.
   * trajectory rescue는 trace/provenance 전용으로 여기에 포함하지 않는다.
   */
  const ownerAuthoritativeReversalSatisfied =
    revConf.reversalConfirmed ||
    hmmReversalAssistDecision.assistApplied ||
    officialShallowStreamBridgeApplied ||
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

  const completionBlockedReason = normalizeCompletionBlockedReasonForTerminalStage({
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

  const completionPassReason: SquatCompletionPassReason = resolveSquatCompletionPath({
    completionBlockedReason,
    relativeDepthPeak,
    evidenceLabel,
    eventBasedDescentPath,
    officialShallowPathCandidate,
    officialShallowPathAdmitted: shallowAdmissionContract.admitted,
    shallowRomClosureProofSignals,
  });

  const completionSatisfied = completionPassReason !== 'not_confirmed';

  const officialShallowPathAdmitted = shallowAdmissionContract.admitted;
  const officialShallowPathClosed =
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
  const pr02FinalizeMode = deriveSquatCompletionFinalizeMode({
    completionSatisfied,
    eventCyclePromoted: false,
    assistSourcesWithoutPromotion: pr02AssistSources,
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
      officialShallowStreamBridgeApplied,
    officialShallowPrimaryDropClosureFallback,
    officialShallowReversalSatisfied: reversalConfirmedAfterDescend,
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
      if (
        firstOfficialShallowClosedPrefix == null &&
        sn.officialShallowPathClosed &&
        (sn.completionPassReason === 'low_rom_cycle' || sn.completionPassReason === 'ultra_low_rom_cycle') &&
        sn.relativeDepthPeak < STANDARD_OWNER_FLOOR
      ) {
        firstOfficialShallowClosedPrefix = sn;
        firstOfficialShallowClosedLen = n;
        break;
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

/** PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01: standing/finalize 계열 blocked reason — 임계·규칙 변경 없음(분류만). */
const SHALLOW_OBS_STANDING_FINALIZE_BLOCKERS = new Set<string>([
  'not_standing_recovered',
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
]);

const SHALLOW_OBS_REVERSAL_BLOCKERS = new Set<string>(['no_reversal', 'no_ascend']);

const SHALLOW_OBS_ADMISSION_BLOCKERS = new Set<string>([
  'not_armed',
  'no_descend',
  'insufficient_relative_depth',
  'no_commitment',
]);

const SHALLOW_OBS_POLICY_BLOCKERS = new Set<string>([
  'ultra_low_rom_not_allowed',
  'trajectory_rescue_not_allowed',
  'event_promotion_not_allowed',
]);

/**
 * PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01:
 * completion 권위 필드만으로 shallow 시도 스테이지를 한 곳에 접는다(pass 로직 미사용).
 */
function computeAuthoritativeShallowStageForObservability(
  state: SquatCompletionState
): SquatAuthoritativeShallowStage {
  if (state.completionSatisfied) return 'closed';
  const br = state.completionBlockedReason ?? '';

  if (SHALLOW_OBS_STANDING_FINALIZE_BLOCKERS.has(br)) return 'standing_finalize_blocked';
  if (SHALLOW_OBS_REVERSAL_BLOCKERS.has(br)) return 'reversal_blocked';

  if (SHALLOW_OBS_POLICY_BLOCKERS.has(br)) return 'policy_blocked';

  if (br.startsWith('setup_motion:')) return 'admission_blocked';

  if (SHALLOW_OBS_ADMISSION_BLOCKERS.has(br)) {
    if (br === 'not_armed' && !state.attemptStarted) return 'pre_attempt';
    return 'admission_blocked';
  }

  return 'policy_blocked';
}

/** PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01: 세부 reason → 정규 패밀리(표에 없는 문자열은 `none`). */
const SHALLOW_PR2_ADMISSION_REASONS = new Set<string>([
  'not_armed',
  'no_descend',
  'insufficient_relative_depth',
  'no_commitment',
  /** 실기기에서 completion 과 함께 관측되는 동결/래치 누락 — admission 계열로만 분류(PR-3+에서 쪼갤 수 있음). */
  'freeze_or_latch_missing',
]);

const SHALLOW_PR2_REVERSAL_REASONS = new Set<string>(['no_reversal', 'no_ascend']);

const SHALLOW_PR2_POLICY_REASONS = new Set<string>([
  'ultra_low_rom_not_allowed',
  'trajectory_rescue_not_allowed',
  'event_promotion_not_allowed',
]);

const SHALLOW_PR2_STANDING_FINALIZE_REASONS = new Set<string>([
  'not_standing_recovered',
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
]);

/**
 * PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01:
 * `completionBlockedReason` + `completionSatisfied` 만으로 정규 패밀리를 낸다(임계·차단 로직 미변경).
 */
export function mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
  completionBlockedReason: string | null,
  completionSatisfied: boolean
): ShallowNormalizedBlockerFamily {
  if (completionSatisfied) return 'closed';
  const r = completionBlockedReason;
  if (r == null || r === '') return 'none';
  if (r.startsWith('setup_motion:')) return 'admission';
  if (SHALLOW_PR2_ADMISSION_REASONS.has(r)) return 'admission';
  if (SHALLOW_PR2_REVERSAL_REASONS.has(r)) return 'reversal';
  if (SHALLOW_PR2_POLICY_REASONS.has(r)) return 'policy';
  if (SHALLOW_PR2_STANDING_FINALIZE_REASONS.has(r)) return 'standing_finalize';
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

/**
 * PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01:
 * shallow truth 계층(관측 타임라인 / 권위 completion / provenance)과 불일치 플래그를 부착한다.
 * 기존 pass·blocked·승격 조건은 변경하지 않는다.
 */
export function attachShallowTruthObservabilityAlign01(
  state: SquatCompletionState
): SquatCompletionState {
  const shallowObservationLayerReversalTruth =
    state.committedAtMs != null && state.reversalAtMs != null;
  const shallowAuthoritativeReversalTruth = state.reversalConfirmedAfterDescend === true;
  const shallowObservationLayerRecoveryTruth =
    state.standingRecoveredAtMs != null && state.reversalAtMs != null;
  const shallowAuthoritativeRecoveryTruth = state.recoveryConfirmedAfterReversal === true;

  const shallowProvenanceOnlyReversalEvidence =
    state.trajectoryReversalRescueApplied === true ||
    state.reversalTailBackfillApplied === true ||
    state.ultraShallowMeaningfulDownUpRescueApplied === true ||
    state.officialShallowStreamBridgeApplied === true ||
    state.reversalConfirmedBy === 'trajectory';

  const truthMismatch_reversalTopVsCompletion =
    shallowObservationLayerReversalTruth !== shallowAuthoritativeReversalTruth;
  const truthMismatch_recoveryTopVsCompletion =
    shallowObservationLayerRecoveryTruth !== shallowAuthoritativeRecoveryTruth;
  const truthMismatch_shallowAdmissionVsClosure =
    state.officialShallowPathAdmitted === true &&
    state.officialShallowPathClosed !== true &&
    state.completionSatisfied !== true;
  const truthMismatch_provenanceReversalWithoutAuthoritative =
    shallowProvenanceOnlyReversalEvidence && !shallowAuthoritativeReversalTruth;
  const truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery =
    state.standingRecoveredAtMs != null && !shallowAuthoritativeRecoveryTruth;

  const shallowNormalizedBlockerFamily = mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
    state.completionBlockedReason ?? null,
    state.completionSatisfied === true
  );
  const shallowAuthoritativeContractStatus = deriveShallowAuthoritativeContractStatusForPr2(state);
  const shallowContractAuthoritativeClosure = state.officialShallowPathClosed === true;
  const shallowContractAuthorityTrace = [
    state.officialShallowPathCandidate ? '1' : '0',
    state.officialShallowPathAdmitted ? '1' : '0',
    shallowAuthoritativeReversalTruth ? '1' : '0',
    shallowNormalizedBlockerFamily,
    shallowAuthoritativeContractStatus,
  ].join('|');

  return {
    ...state,
    shallowAuthoritativeStage: computeAuthoritativeShallowStageForObservability(state),
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
    return attachShallowTruthObservabilityAlign01(state);
  }

  /** PR-03: 승격도 공식 *_cycle 로 통일 — residue event_cycle 문자열은 미통과·디버그 경로에만 유지 */
  const promotedPassReason =
    squatEventCycle.band === 'low_rom' ? 'low_rom_cycle' : 'ultra_low_rom_cycle';
  const promotedSource: 'rule' | 'rule_plus_hmm' =
    squatEventCycle.source === 'rule_plus_hmm' ? 'rule_plus_hmm' : 'rule';

  const promotedAssistSources = buildSquatCompletionAssistSources({
    hmmAssistApplied: state.hmmAssistApplied === true,
    hmmReversalAssistApplied: state.hmmReversalAssistApplied === true,
    trajectoryReversalRescueApplied: state.trajectoryReversalRescueApplied === true,
    reversalTailBackfillApplied: state.reversalTailBackfillApplied === true,
    ultraShallowMeaningfulDownUpRescueApplied: state.ultraShallowMeaningfulDownUpRescueApplied === true,
    eventCyclePromoted: true,
  });
  const promotedAssistMode = deriveSquatCompletionAssistMode(promotedAssistSources);

  const promotedOfficialShallowClosed =
    state.officialShallowPathCandidate === true &&
    (promotedPassReason === 'low_rom_cycle' || promotedPassReason === 'ultra_low_rom_cycle');

  return attachShallowTruthObservabilityAlign01({
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
    officialShallowPathClosed: promotedOfficialShallowClosed,
    officialShallowPathBlockedReason: null,
    officialShallowDriftedToStandard: promotedOfficialShallowClosed ? false : (state.officialShallowDriftedToStandard ?? false),
    officialShallowDriftReason: promotedOfficialShallowClosed ? null : (state.officialShallowDriftReason ?? null),
    officialShallowPreferredPrefixFrameCount: state.officialShallowPreferredPrefixFrameCount ?? null,
  });
}
