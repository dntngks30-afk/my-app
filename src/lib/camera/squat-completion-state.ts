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
import {
  buildCanonicalShallowContractInputFromState as buildCanonicalShallowContractInputFromStateImpl,
  mergeCanonicalShallowContractResult,
  applyCanonicalShallowClosureFromContract as applyCanonicalShallowClosureFromContractImpl,
} from '@/lib/camera/squat/squat-completion-canonical';
import {
  stampPreCanonicalObservability as stampPreCanonicalObservabilityImpl,
  attachShallowTruthObservabilityAlign01 as attachShallowTruthObservabilityAlign01Impl,
} from '@/lib/camera/squat/squat-completion-observability';
import { applyUltraLowPolicyLock as applyUltraLowPolicyLockImpl } from '@/lib/camera/squat/squat-completion-policy';
import type {
  ShallowAuthoritativeContractStatus,
  ShallowClosureProofTraceStage,
  ShallowNormalizedBlockerFamily,
  SquatAuthoritativeShallowStage,
} from '@/lib/camera/squat/squat-completion-debug-types';
// RF-09B: core helper graph relocated to squat-completion-core
import {
  type SquatDepthFreezeConfig,
  type GuardedTrajectoryShallowBridgeOpts,
  type GuardedShallowLocalPeakAnchor,
  BASELINE_WINDOW,
  MIN_BASELINE_FRAMES,
  STANDARD_OWNER_FLOOR,
  REVERSAL_DROP_MIN_ABS,
  getGuardedShallowLocalPeakAnchor,
  buildSquatCompletionDepthRows,
  recoveryMeetsLowRomStyleFinalizeProof,
  mapCompletionBlockedReasonToShallowNormalizedBlockerFamily,
  deriveSquatCompletionFinalizeMode,
  ultraLowRomEventPromotionMeetsAscentIntegrity,
  evaluateSquatCompletionCore,
  resolveStandardDriftAfterShallowAdmission,
} from './squat/squat-completion-core';


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
 * PR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01
 *
 * Single diagnostic label for why `applyCanonicalShallowClosureFromContract` did not apply a shallow
 * authoritative close write. **Sink-only** — not a product pass/block authority surface.
 */
export type OfficialShallowOwnerWriteMissReason =
  | 'not_admitted'
  | 'descend_not_confirmed'
  | 'reversal_not_confirmed'
  | 'recovery_not_confirmed'
  | 'closure_proof_not_satisfied'
  | 'ascent_equivalent_not_satisfied'
  | 'temporal_order_not_satisfied'
  | 'setup_not_clear'
  | 'stale_or_mixed_rep_guard'
  | 'descent_span_guard_failed'
  | 'ascent_recovery_span_guard_failed'
  | 'peak_latch_anchor_guard_failed'
  | 'shallow_close_not_pending'
  | 'writer_guard_unknown';

export type OfficialShallowWriterAnchorSource =
  | 'peak_latched'
  | 'guarded_shallow_local_peak'
  | null;

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

/**
 * PR-CAM-SHALLOW-TICKET-UNIFICATION-12: shallow 완료 단일 권위 티켓(증명·소비는 티켓의 투영).
 * 이벤트 승격·trajectory 전역 권위화·딥 임계 변경 아님.
 */
type ShallowCompletionTicket = {
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

type ShallowClosureProofTrace = {
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
  /**
   * PR-3 — Official Shallow Admission Promotion (SSOT §4.2).
   * Admission-level anti-false-pass guard family that rejected the attempt
   * (`setup_motion_blocked` / `standing_still_or_jitter_only` /
   * `seated_hold_without_descent`), or `null` when no admission guard fired.
   * Diagnostic / sink-only — admission closure / pass logic read `admitted`.
   */
  officialShallowPathAdmissionGuardFamily?:
    | 'setup_motion_blocked'
    | 'standing_still_or_jitter_only'
    | 'seated_hold_without_descent'
    | null;
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
  canonicalShallowContractClosureSource?:
    | 'none'
    | 'canonical_authoritative'
    | 'canonical_guarded_trajectory'
    | 'same_rep_official_shallow_owner_write';

  /**
   * PR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01
   *
   * **Sink-only / diagnostic-only.** Emitted only at `applyCanonicalShallowClosureFromContract`.
   * Do not consume as grant truth, opener input, registry signal, or final-pass authority.
   */
  officialShallowOwnerWriteCandidate?: boolean;
  officialShallowOwnerWriteApplied?: boolean;
  officialShallowOwnerWriteMissReason?: OfficialShallowOwnerWriteMissReason | null;
  officialShallowWriterAnchorAligned?: boolean;
  officialShallowWriterAnchorIndex?: number | null;
  officialShallowWriterAnchorSource?: OfficialShallowWriterAnchorSource;
  writerSawOfficialShallowPathAdmitted?: boolean;
  writerSawDescendConfirmed?: boolean;
  writerSawReversalConfirmedAfterDescend?: boolean;
  writerSawRecoveryConfirmedAfterReversal?: boolean;
  writerSawOfficialShallowReversalSatisfied?: boolean;
  writerSawOfficialShallowAscentEquivalentSatisfied?: boolean;
  writerSawOfficialShallowClosureProofSatisfied?: boolean;
  writerSawSetupMotionBlocked?: boolean;
  writerSawTemporalOrderSatisfied?: boolean;
  writerSawPeakLatched?: boolean;
  writerSawBaselineFrozen?: boolean;
  writerSawStaleOrMixedRepBlocked?: boolean;
  writerSawDescentSpanSatisfied?: boolean;
  writerSawAscentRecoverySpanSatisfied?: boolean;

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
  guardedShallowLocalPeakAtMs?: number | null;

  /** PR-08/09: recovered-suffix shallow closure(있을 때만) — PR-10 소비 게이트 입력 */
  guardedShallowRecoveredSuffixSatisfied?: boolean;
  guardedShallowRecoveredSuffixBlockedReason?: string | null;

  /**
   * PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01:
   * Same-rep shallow admission was recovered inside completion-state ownership.
   * Observability only; final pass still requires canonical shallow contract close.
   */
  sameRepShallowAdmissionRecovered?: boolean;
  sameRepShallowAdmissionRecoveryReason?: string | null;
  /**
   * PR-SHALLOW-UPSTREAM-CURRENT-REP-EPOCH-STABILITY-01:
   * A legitimately opened shallow current-rep epoch was kept from regressing to
   * pre-attempt classification inside the same acquisition buffer. Observability
   * only; this never grants completion or clears terminal blockers.
   */
  upstreamCurrentRepEpochStabilityApplied?: boolean;
  upstreamCurrentRepEpochStabilityRecoveredFrom?:
    | 'not_armed'
    | 'freeze_or_latch_missing'
    | 'baseline_not_frozen'
    | 'peak_not_latched'
    | 'admission_dropped'
    | null;
  upstreamCurrentRepEpochStabilitySource?: 'prefix_official_shallow_admission' | null;
  /**
   * PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01:
   * An already admitted shallow current-rep epoch had missing/stale peak-owner
   * provenance rebound to the guarded current-rep local peak. This is upstream
   * acquisition/provenance alignment only; it never grants completion or rewrites
   * terminal blocker policy.
   */
  shallowAcquisitionPeakProvenanceUnified?: boolean;
  shallowAcquisitionPeakProvenanceUnifiedFrom?:
    | 'missing_latched_anchor'
    | 'series_start_anchor'
    | 'unlatched_anchor'
    | 'baseline_not_frozen'
    | 'peak_anchor_truth_missing'
    | 'peak_timestamp_missing'
    | null;
  shallowAcquisitionPeakProvenanceUnifiedSource?: 'guarded_shallow_local_peak' | null;
  shallowAcquisitionPeakProvenanceUnifiedIndex?: number | null;
  shallowAcquisitionPeakProvenanceUnifiedAtMs?: number | null;
  /**
   * PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01:
   * Same-rep shallow close recovered from a narrow timing blocker after closure proof
   * was already satisfied. Observability only; canonical closer remains the only writer.
   */
  sameRepShallowCloseRecovered?: boolean;
  sameRepShallowCloseRecoveredFrom?:
    | 'descent_span_too_short'
    | 'ascent_recovery_span_too_short'
    | 'no_reversal'
    | null;
  /**
   * PR-SHALLOW-ADMITTED-TO-CLOSED-CONTRACT-ALIGN-01:
   * Explicit upstream same-rep contract stamp for an admitted official shallow rep that
   * has genuine close truth but is still carrying a legacy residual close blocker.
   * Observability/contract input only; final pass still opens only through the canonical writer.
   */
  officialShallowAdmittedToClosedContractSatisfied?: boolean;
  officialShallowAdmittedToClosedContractRecoveredFrom?:
    | 'descent_span_too_short'
    | 'ascent_recovery_span_too_short'
    | 'no_reversal'
    | null;
  officialShallowAdmittedToClosedContractSource?:
    | 'same_rep_official_shallow_bridge_closure'
    | 'same_rep_rule_or_hmm_shallow_closure'
    | null;
  /**
   * PR-SHALLOW-ANCHOR-PROVENANCE-RESET-AND-SPAN-ALIGN-01:
   * An admitted official shallow rep with full same-rep close truth may rebind a
   * stale/missing series-start peak anchor to the guarded current-rep local peak.
   * Diagnostic/contract-alignment only; final pass still opens only through the
   * canonical completion-owner writer.
   */
  currentRepShallowAnchorProvenanceResetApplied?: boolean;
  currentRepShallowAnchorProvenanceResetFrom?:
    | 'series_start_anchor'
    | 'missing_latched_anchor'
    | 'unlatched_anchor'
    | 'baseline_not_frozen'
    | 'peak_anchor_truth_missing'
    | null;
  currentRepShallowAnchorProvenanceResetSource?: OfficialShallowWriterAnchorSource;
  currentRepShallowAnchorProvenanceResetIndex?: number | null;
  sameRepShallowSpanAlignedToCurrentAnchor?: boolean;
  sameRepShallowSpanAlignedFrom?:
    | 'descent_span_too_short'
    | 'ascent_recovery_span_too_short'
    | null;
  /**
   * PR-SHALLOW-AUTHORITATIVE-CLOSE-OWNERSHIP-RECOVERY-01:
   * Same-rep official shallow close proof was consumed by the final canonical
   * close writer. This is owner-write recovery, not an alternate opener.
   */
  sameRepShallowAuthoritativeCloseOwnershipRecovered?: boolean;
  sameRepShallowAuthoritativeCloseOwnershipRecoveredFrom?:
    | 'descent_span_too_short'
    | 'ascent_recovery_span_too_short'
    | 'no_reversal'
    | null;

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

  // ── PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION (Branch B §7) ──
  // Additive diagnostics for the 4th `effectiveDescentStartFrame` candidate
  // `legitimateKinematicShallowDescentOnsetFrame`. All fields are observation-
  // only per design SSOT §6.1 SL-1/SL-2 (the source never opens final pass
  // by itself and never writes to any `completionOwner*` field).
  /** Source #4 onset frame index (null when source did not fire). */
  legitimateKinematicShallowDescentOnsetFrameIndex?: number | null;
  /** Source #4 onset timestampMs (null when source did not fire). */
  legitimateKinematicShallowDescentOnsetAtMs?: number | null;
  /** `kneeAngleAvg` at the onset frame (null when source did not fire). */
  legitimateKinematicShallowDescentOnsetKneeAngleAvg?: number | null;
  /**
   * Median `kneeAngleAvg` over the baseline window used to compute the
   * onset threshold. Null when fewer than MIN_BASELINE_FRAMES finite
   * samples were available.
   */
  legitimateKinematicShallowDescentBaselineKneeAngleAvg?: number | null;
  /**
   * Which source currently anchors `effectiveDescentStartFrame`. Null when
   * no candidate fired. Values are drawn from design SSOT §4.2:
   *   'phase_hint_descent' | 'trajectory_descent_start' |
   *   'shared_descent_epoch' | 'legitimate_kinematic_shallow_descent_onset'.
   */
  effectiveDescentStartFrameSource?:
    | 'phase_hint_descent'
    | 'trajectory_descent_start'
    | 'shared_descent_epoch'
    | 'legitimate_kinematic_shallow_descent_onset'
    | 'pre_arming_kinematic_descent_epoch'
    | null;
  /**
   * Split-brain guard CL-1 (design SSOT §6.4): every non-null candidate's
   * index is ≥ `effectiveDescentStartFrame.index` (i.e., the earliest-wins
   * rule actually picked the minimum). True when no source fired.
   */
  descentAnchorCoherent?: boolean;
  preArmingKinematicDescentEpochValidIndex?: number | null;
  preArmingKinematicDescentEpochAtMs?: number | null;
  preArmingKinematicDescentEpochAccepted?: boolean;
  preArmingKinematicDescentEpochRejectedReason?: string | null;
  preArmingKinematicDescentEpochCompletionSliceStartIndex?: number | null;
  preArmingKinematicDescentEpochPeakGuardValidIndex?: number | null;
  preArmingKinematicDescentEpochProof?: {
    monotonicSustainSatisfied: true;
    baselineBeforeOnset: true;
    onsetBeforeCompletionSlicePeak: true;
    noStandingRecoveryBetweenOnsetAndSlice: true;
  } | null;
  selectedCanonicalDescentTimingEpochSource?:
    | 'phase_hint_descent'
    | 'trajectory_descent_start'
    | 'shared_descent_epoch'
    | 'legitimate_kinematic_shallow_descent_onset'
    | 'pre_arming_kinematic_descent_epoch'
    | null;
  selectedCanonicalDescentTimingEpochValidIndex?: number | null;
  selectedCanonicalDescentTimingEpochAtMs?: number | null;
  normalizedDescentAnchorCoherent?: boolean;
  canonicalTemporalEpochOrderSatisfied?: boolean;
  canonicalTemporalEpochOrderBlockedReason?: string | null;
  selectedCanonicalPeakEpochValidIndex?: number | null;
  selectedCanonicalPeakEpochAtMs?: number | null;
  selectedCanonicalPeakEpochSource?: 'completion_core_peak' | null;
  selectedCanonicalReversalEpochValidIndex?: number | null;
  selectedCanonicalReversalEpochAtMs?: number | null;
  selectedCanonicalReversalEpochSource?: 'rule_or_hmm_reversal_epoch' | null;
  selectedCanonicalRecoveryEpochValidIndex?: number | null;
  selectedCanonicalRecoveryEpochAtMs?: number | null;
  selectedCanonicalRecoveryEpochSource?: 'standing_recovery_finalize_epoch' | null;
  temporalEpochOrderTrace?: string | null;
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
   * PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP:
   * pre-arming standing window 의 `kneeAngleAvg` 중앙값. arming이 앞쪽 standing 프레임을
   * 잘라내면 `evaluateSquatCompletionCore` 가 받는 slice 는 이미 하강 구간에서 시작하므로
   * 내부의 `computeBaselineKneeAngleAvgMedian(depthFrames.slice(0,6))` 는 descent 프레임을
   * 기준으로 median 을 뽑아 source #4 (`legitimateKinematicShallowDescentOnsetFrame`) 의
   * 기준선이 true standing 에서 벗어난다 — representative shallow fixture 에서 소스가 null 이
   * 되는 원인.
   *
   * 이 옵션은 evaluator 에서 pre-arming `valid` 버퍼의 standing window kneeAngleAvg median 을
   * 계산해 넘겨주는 additive seed 다. 완료-코어는 finite seed 가 있으면 slice 지역 median 대신
   * 이 값을 사용해 source #4 의 threshold 를 standing 기준선으로 정합시킨다.
   * threshold/authority-law/fixture 는 변경하지 않는다 — design SSOT §4.1 이 명시한 "standing-
   * baseline window" 를 arming 절단 이전 경계에서 취한다는 동일 의미를 복원하는 플러밍이다.
   */
  seedBaselineKneeAngleAvg?: number;
  completionSliceStartIndex?: number;
  preArmingKinematicDescentEpoch?: import('@/lib/camera/squat/squat-completion-arming').PreArmingKinematicDescentEpoch;
  /**
   * PR-CAM-SHALLOW-TRAJECTORY-BRIDGE-05: 평가기에서 이미 계산된 setup 차단 — completion 코어와 독립.
   */
  setupMotionBlocked?: boolean;
  /**
   * PR-08/09: recovered-suffix 2차 코어 — `officialShallowReversalSatisfied` OR 에 합류.
   */
  guardedShallowRecoveredSuffixClosureApply?: boolean;
  /**
   * DESCENT-TRUTH-RESET-01: Shared descent truth from pass-window-owned frames.
   * When provided, completion-state aligns its descendConfirmed and arming evidence
   * to the shared truth instead of relying solely on phaseHint-based detection.
   * This prevents split-brain where completion-state says descendConfirmed=false
   * while pass-core (which owns the single pass authority) says descentDetected=true.
   */
  sharedDescentTruth?: import('@/lib/camera/squat/squat-descent-truth').SquatDescentTruthResult;
};


/** PR-04E3B: event-cycle 승격이 타임·finalize 계약을 덮어쓰지 않도록 차단 */
const PR_04E3B_NO_EVENT_PROMOTION_BLOCKS = new Set<string>([
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
  return applyUltraLowPolicyLockImpl(state, {
    mapCompletionBlockedReasonToShallowNormalizedBlockerFamily,
  });
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
  return attachShallowTruthObservabilityAlign01Impl(state, {
    mapCompletionBlockedReasonToShallowNormalizedBlockerFamily,
    standardOwnerFloor: STANDARD_OWNER_FLOOR,
    reversalDropMinAbs: REVERSAL_DROP_MIN_ABS,
    recoveryMeetsLowRomStyleFinalizeProof,
    getGuardedShallowLocalPeakAnchor,
    ultraLowRomEventPromotionMeetsAscentIntegrity,
    shallowClosureProofTraceReason: SHALLOW_CLOSURE_PROOF_TRACE_REASON,
  });
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
const DISABLED_SHALLOW_OWNER_REOPEN_ULTRA_LOW_FLOOR = 0.07;

function isSameRepShallowTimingCloseBlocker(
  reason: string | null | undefined
): reason is 'descent_span_too_short' | 'ascent_recovery_span_too_short' {
  return reason === 'descent_span_too_short' || reason === 'ascent_recovery_span_too_short';
}

function isOfficialShallowAdmittedToClosedResidualBlocker(
  reason: string | null | undefined
): reason is 'descent_span_too_short' | 'ascent_recovery_span_too_short' | 'no_reversal' {
  return (
    reason === 'descent_span_too_short' ||
    reason === 'ascent_recovery_span_too_short' ||
    reason === 'no_reversal'
  );
}

function officialShallowCloseCommitCanBePending(
  reason: string | null | undefined
): boolean {
  return reason == null || isOfficialShallowAdmittedToClosedResidualBlocker(reason);
}

function shallowRecoverySetupClear(
  state: SquatCompletionState,
  options: EvaluateSquatCompletionStateOptions | undefined
): boolean {
  return state.setupMotionBlocked !== true && options?.setupMotionBlocked !== true;
}

function shallowRecoveryReadinessClear(state: SquatCompletionState): boolean {
  return (
    state.readinessStableDwellSatisfied !== false &&
    state.attemptStartedAfterReady !== false
  );
}

function shallowRecoveryShallowBandEligible(state: SquatCompletionState): boolean {
  return (
    state.officialShallowPathCandidate === true &&
    (state.relativeDepthPeak ?? 0) < STANDARD_OWNER_FLOOR &&
    state.evidenceLabel !== 'insufficient_signal'
  );
}

function shallowRecoveryHasAttemptDescendCommitment(state: SquatCompletionState): boolean {
  return (
    state.attemptStarted === true &&
    state.descendConfirmed === true &&
    state.downwardCommitmentReached === true &&
    (state.downwardCommitmentDelta ?? 0) > 0
  );
}

function shallowRecoveryHasNoKnownStaleOrMixedRep(state: SquatCompletionState): boolean {
  const br = state.canonicalTemporalEpochOrderBlockedReason ?? null;
  return (
    br !== 'mixed_rep_epoch_contamination' &&
    br !== 'stale_prior_rep_epoch' &&
    br !== 'recovery_not_after_reversal' &&
    br !== 'reversal_not_after_peak' &&
    br !== 'peak_not_after_descent'
  );
}

type SameRepShallowAnchorProvenance = {
  aligned: boolean;
  index: number | null;
  source: OfficialShallowWriterAnchorSource;
};

function readSameRepShallowAnchorProvenance(
  state: SquatCompletionState
): SameRepShallowAnchorProvenance {
  const latchedIndex = state.peakLatchedAtIndex ?? null;
  if (latchedIndex != null && latchedIndex > 0) {
    return { aligned: true, index: latchedIndex, source: 'peak_latched' };
  }

  const localIndex = state.guardedShallowLocalPeakIndex ?? null;
  const localAnchorAligned =
    state.guardedShallowLocalPeakFound === true &&
    state.guardedShallowLocalPeakBlockedReason == null &&
    localIndex != null &&
    localIndex > 0 &&
    state.officialShallowStreamBridgeApplied === true &&
    state.officialShallowClosureProofSatisfied === true;

  if (localAnchorAligned) {
    return { aligned: true, index: localIndex, source: 'guarded_shallow_local_peak' };
  }

  return { aligned: false, index: null, source: null };
}

function shallowRecoveryHasSameRepPeakAnchor(state: SquatCompletionState): boolean {
  return readSameRepShallowAnchorProvenance(state).aligned;
}

function currentRepAnchorResetReason(
  state: SquatCompletionState
): SquatCompletionState['currentRepShallowAnchorProvenanceResetFrom'] {
  const latchedIndex = state.peakLatchedAtIndex ?? null;
  if (latchedIndex === 0) return 'series_start_anchor';
  if (latchedIndex == null) return 'missing_latched_anchor';
  if (state.peakLatched !== true) return 'unlatched_anchor';
  if (state.baselineFrozen !== true) return 'baseline_not_frozen';
  if (state.peakAnchorTruth !== 'committed_or_post_commit_peak') {
    return 'peak_anchor_truth_missing';
  }
  return null;
}

function needsCurrentRepAnchorProvenanceReset(state: SquatCompletionState): boolean {
  return currentRepAnchorResetReason(state) != null;
}

type ShallowCurrentRepEpochSnapshot = {
  baselineFrozenDepth: number | null | undefined;
  peakLatchedAtIndex: number | null | undefined;
  peakAnchorTruth: SquatCompletionState['peakAnchorTruth'];
  completionBlockedReason: string | null | undefined;
  officialShallowPathBlockedReason: string | null | undefined;
  descendStartAtMs: number | undefined;
  peakAtMs: number | undefined;
  committedAtMs: number | undefined;
  selectedCanonicalDescentTimingEpochAtMs: number | null | undefined;
  selectedCanonicalDescentTimingEpochValidIndex: number | null | undefined;
  selectedCanonicalPeakEpochAtMs: number | null | undefined;
  selectedCanonicalPeakEpochValidIndex: number | null | undefined;
  relativeDepthPeak: number;
  evidenceLabel: SquatEvidenceLabel;
};

function isShallowCurrentRepEpochResidualBlocker(reason: string | null | undefined): boolean {
  return (
    reason === 'no_reversal' ||
    reason === 'not_standing_recovered' ||
    reason === 'descent_span_too_short' ||
    reason === 'ascent_recovery_span_too_short' ||
    reason === 'recovery_hold_too_short' ||
    reason === 'low_rom_standing_finalize_not_satisfied' ||
    reason === 'ultra_low_rom_standing_finalize_not_satisfied'
  );
}

function shallowCurrentRepEpochSnapshotEligible(state: SquatCompletionState): boolean {
  if (state.completionSatisfied === true) return false;
  if (!shallowRecoveryShallowBandEligible(state)) return false;
  if (!shallowRecoveryHasAttemptDescendCommitment(state)) return false;
  if (state.officialShallowPathAdmitted !== true) return false;
  if (state.baselineFrozen !== true) return false;
  if (state.peakLatched !== true) return false;
  if ((state.peakLatchedAtIndex ?? -1) <= 0) return false;
  if (state.peakAnchorTruth !== 'committed_or_post_commit_peak') return false;
  if (!shallowRecoveryReadinessClear(state)) return false;
  if (!shallowRecoveryHasNoKnownStaleOrMixedRep(state)) return false;
  if (state.eventCyclePromoted === true) return false;
  return true;
}

function captureShallowCurrentRepEpochSnapshot(
  state: SquatCompletionState
): ShallowCurrentRepEpochSnapshot | null {
  if (!shallowCurrentRepEpochSnapshotEligible(state)) return null;
  return {
    baselineFrozenDepth: state.baselineFrozenDepth,
    peakLatchedAtIndex: state.peakLatchedAtIndex,
    peakAnchorTruth: state.peakAnchorTruth,
    completionBlockedReason: state.completionBlockedReason,
    officialShallowPathBlockedReason: state.officialShallowPathBlockedReason,
    descendStartAtMs: state.descendStartAtMs,
    peakAtMs: state.peakAtMs,
    committedAtMs: state.committedAtMs,
    selectedCanonicalDescentTimingEpochAtMs: state.selectedCanonicalDescentTimingEpochAtMs,
    selectedCanonicalDescentTimingEpochValidIndex:
      state.selectedCanonicalDescentTimingEpochValidIndex,
    selectedCanonicalPeakEpochAtMs: state.selectedCanonicalPeakEpochAtMs,
    selectedCanonicalPeakEpochValidIndex: state.selectedCanonicalPeakEpochValidIndex,
    relativeDepthPeak: state.relativeDepthPeak,
    evidenceLabel: state.evidenceLabel,
  };
}

function readCurrentRepEpochDriftReason(
  state: SquatCompletionState
): SquatCompletionState['upstreamCurrentRepEpochStabilityRecoveredFrom'] {
  if (state.completionBlockedReason === 'not_armed') return 'not_armed';
  if (state.completionBlockedReason === 'freeze_or_latch_missing') {
    return 'freeze_or_latch_missing';
  }
  if (state.baselineFrozen !== true) return 'baseline_not_frozen';
  if (state.peakLatched !== true) return 'peak_not_latched';
  if (state.officialShallowPathAdmitted !== true) return 'admission_dropped';
  return null;
}

export function applyShallowCurrentRepEpochStability(
  state: SquatCompletionState,
  snapshot: ShallowCurrentRepEpochSnapshot | null,
  options?: EvaluateSquatCompletionStateOptions
): SquatCompletionState {
  if (snapshot == null) return state;
  if (state.completionSatisfied === true) return state;
  if (!shallowRecoverySetupClear(state, options)) return state;
  if (!shallowRecoveryReadinessClear(state)) return state;
  if (!shallowRecoveryHasNoKnownStaleOrMixedRep(state)) return state;
  if (state.eventCyclePromoted === true) return state;
  if (state.evidenceLabel === 'standard' || (state.relativeDepthPeak ?? 0) >= STANDARD_OWNER_FLOOR) {
    return state;
  }
  if (snapshot.evidenceLabel === 'standard' || snapshot.relativeDepthPeak >= STANDARD_OWNER_FLOOR) {
    return state;
  }

  const driftReason = readCurrentRepEpochDriftReason(state);
  if (driftReason == null) return state;

  const snapshotBlocker = isShallowCurrentRepEpochResidualBlocker(snapshot.completionBlockedReason)
    ? snapshot.completionBlockedReason
    : isShallowCurrentRepEpochResidualBlocker(snapshot.officialShallowPathBlockedReason)
      ? snapshot.officialShallowPathBlockedReason
      : null;
  const currentBlockerIsPreAttempt =
    state.completionBlockedReason === 'not_armed' ||
    state.completionBlockedReason === 'freeze_or_latch_missing';

  return {
    ...state,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathReason:
      state.officialShallowPathReason ?? 'prefix_official_shallow_admission',
    officialShallowPathBlockedReason:
      snapshotBlocker != null &&
      (state.officialShallowPathBlockedReason === 'not_armed' ||
        state.officialShallowPathBlockedReason === 'freeze_or_latch_missing')
        ? snapshotBlocker
        : state.officialShallowPathBlockedReason,
    completionBlockedReason:
      currentBlockerIsPreAttempt && snapshotBlocker != null
        ? snapshotBlocker
        : state.completionBlockedReason,
    baselineFrozen: true,
    baselineFrozenDepth: state.baselineFrozenDepth ?? snapshot.baselineFrozenDepth,
    peakLatched: true,
    peakLatchedAtIndex: state.peakLatchedAtIndex ?? snapshot.peakLatchedAtIndex,
    peakAnchorTruth: state.peakAnchorTruth ?? snapshot.peakAnchorTruth,
    descendStartAtMs: state.descendStartAtMs ?? snapshot.descendStartAtMs,
    peakAtMs: state.peakAtMs ?? snapshot.peakAtMs,
    committedAtMs: state.committedAtMs ?? snapshot.committedAtMs,
    selectedCanonicalDescentTimingEpochAtMs:
      state.selectedCanonicalDescentTimingEpochAtMs ??
      snapshot.selectedCanonicalDescentTimingEpochAtMs,
    selectedCanonicalDescentTimingEpochValidIndex:
      state.selectedCanonicalDescentTimingEpochValidIndex ??
      snapshot.selectedCanonicalDescentTimingEpochValidIndex,
    selectedCanonicalPeakEpochAtMs:
      state.selectedCanonicalPeakEpochAtMs ?? snapshot.selectedCanonicalPeakEpochAtMs,
    selectedCanonicalPeakEpochValidIndex:
      state.selectedCanonicalPeakEpochValidIndex ?? snapshot.selectedCanonicalPeakEpochValidIndex,
    upstreamCurrentRepEpochStabilityApplied: true,
    upstreamCurrentRepEpochStabilityRecoveredFrom: driftReason,
    upstreamCurrentRepEpochStabilitySource: 'prefix_official_shallow_admission',
  };
}

type ShallowAcquisitionPeakProvenanceDriftReason = NonNullable<
  SquatCompletionState['shallowAcquisitionPeakProvenanceUnifiedFrom']
>;

function readShallowAcquisitionPeakProvenanceDriftReason(
  state: SquatCompletionState
): ShallowAcquisitionPeakProvenanceDriftReason | null {
  const peakLatchedAtIndex = state.peakLatchedAtIndex ?? null;
  if (peakLatchedAtIndex === 0) return 'series_start_anchor';
  if (peakLatchedAtIndex == null) return 'missing_latched_anchor';
  if (state.peakLatched !== true) return 'unlatched_anchor';
  if (state.baselineFrozen !== true) return 'baseline_not_frozen';
  if (state.peakAnchorTruth !== 'committed_or_post_commit_peak') {
    return 'peak_anchor_truth_missing';
  }
  if (typeof state.peakAtMs !== 'number' || !Number.isFinite(state.peakAtMs)) {
    return 'peak_timestamp_missing';
  }
  return null;
}

export function applyShallowAcquisitionPeakProvenanceUnification(
  state: SquatCompletionState,
  options?: EvaluateSquatCompletionStateOptions
): SquatCompletionState {
  if (state.completionSatisfied === true) return state;
  if (!shallowRecoverySetupClear(state, options)) return state;
  if (!shallowRecoveryReadinessClear(state)) return state;
  if (!shallowRecoveryHasNoKnownStaleOrMixedRep(state)) return state;
  if (state.eventCyclePromoted === true) return state;
  if (state.evidenceLabel === 'standard') return state;
  if (!shallowRecoveryShallowBandEligible(state)) return state;
  if (!shallowRecoveryHasAttemptDescendCommitment(state)) return state;
  if (state.officialShallowPathCandidate !== true) return state;
  if (state.officialShallowPathAdmitted !== true) return state;
  if (state.guardedShallowLocalPeakFound !== true) return state;
  if (state.guardedShallowLocalPeakBlockedReason != null) return state;

  const localPeakIndex = state.guardedShallowLocalPeakIndex ?? null;
  const localPeakAtMs = state.guardedShallowLocalPeakAtMs ?? null;
  if (localPeakIndex == null || localPeakIndex <= 0) return state;
  if (typeof localPeakAtMs !== 'number' || !Number.isFinite(localPeakAtMs)) return state;

  const driftReason = readShallowAcquisitionPeakProvenanceDriftReason(state);
  if (driftReason == null) return state;

  const baselineFrozenDepth = state.baselineFrozenDepth ?? state.baselineStandingDepth ?? null;
  if (typeof baselineFrozenDepth !== 'number' || !Number.isFinite(baselineFrozenDepth)) {
    return state;
  }

  return {
    ...state,
    baselineFrozen: true,
    baselineFrozenDepth,
    peakLatched: true,
    peakLatchedAtIndex: localPeakIndex,
    peakAtMs: localPeakAtMs,
    peakAnchorTruth: 'committed_or_post_commit_peak',
    selectedCanonicalPeakEpochAtMs: localPeakAtMs,
    selectedCanonicalPeakEpochValidIndex: localPeakIndex,
    selectedCanonicalPeakEpochSource: 'completion_core_peak',
    shallowAcquisitionPeakProvenanceUnified: true,
    shallowAcquisitionPeakProvenanceUnifiedFrom: driftReason,
    shallowAcquisitionPeakProvenanceUnifiedSource: 'guarded_shallow_local_peak',
    shallowAcquisitionPeakProvenanceUnifiedIndex: localPeakIndex,
    shallowAcquisitionPeakProvenanceUnifiedAtMs: localPeakAtMs,
  };
}

function sameRepShallowAdmissionRecoveryEligible(
  state: SquatCompletionState,
  options: EvaluateSquatCompletionStateOptions | undefined
): boolean {
  if (state.completionSatisfied === true) return false;
  if (state.officialShallowPathAdmitted === true) return false;
  if (!shallowRecoveryShallowBandEligible(state)) return false;
  if (!shallowRecoveryHasAttemptDescendCommitment(state)) return false;
  if (!shallowRecoveryReadinessClear(state)) return false;
  if (!shallowRecoverySetupClear(state, options)) return false;
  if (!shallowRecoveryHasNoKnownStaleOrMixedRep(state)) return false;
  if (state.eventCyclePromoted === true) return false;

  const currentBlock = state.completionBlockedReason ?? state.officialShallowPathBlockedReason ?? null;
  const notes = state.squatEventCycle?.notes ?? [];
  const hasResidualAdmissionSignature =
    currentBlock === 'not_armed' ||
    currentBlock === 'freeze_or_latch_missing' ||
    notes.includes('freeze_or_latch_missing') ||
    state.baselineFrozen === false ||
    state.peakLatched === false;
  if (!hasResidualAdmissionSignature) return false;

  const eventDescendEvidence =
    state.squatEventCycle?.descentDetected === true ||
    (state.squatEventCycle?.descentFrames ?? 0) > 0 ||
    state.selectedCanonicalDescentTimingEpochAtMs != null ||
    state.legitimateKinematicShallowDescentOnsetAtMs != null;
  return eventDescendEvidence;
}

function sameRepShallowCloseRecoveryEligible(
  state: SquatCompletionState,
  options: EvaluateSquatCompletionStateOptions | undefined
): boolean {
  if (state.completionSatisfied === true) return false;
  if (state.completionPassReason !== 'not_confirmed') return false;
  if (!isSameRepShallowTimingCloseBlocker(state.completionBlockedReason)) return false;
  if (!shallowRecoveryShallowBandEligible(state)) return false;
  if (state.officialShallowPathAdmitted !== true) return false;
  if (!shallowRecoveryHasAttemptDescendCommitment(state)) return false;
  if (!shallowRecoveryReadinessClear(state)) return false;
  if (!shallowRecoverySetupClear(state, options)) return false;
  if (state.eventCyclePromoted === true) return false;

  if (state.reversalConfirmedAfterDescend !== true) return false;
  if (state.recoveryConfirmedAfterReversal !== true) return false;
  if (state.officialShallowReversalSatisfied !== true) return false;
  if (state.officialShallowAscentEquivalentSatisfied !== true) return false;
  if (state.officialShallowClosureProofSatisfied !== true) return false;
  if (state.reversalConfirmedByRuleOrHmm !== true) return false;

  if (state.canonicalTemporalEpochOrderSatisfied !== true) return false;
  if (!shallowRecoveryHasNoKnownStaleOrMixedRep(state)) return false;
  if (state.standingRecoveredAtMs == null) return false;
  if (state.peakLatchedAtIndex == null || state.peakLatchedAtIndex <= 0) return false;

  return true;
}

function officialShallowAdmittedToClosedContractEligible(
  state: SquatCompletionState,
  options: EvaluateSquatCompletionStateOptions | undefined
): boolean {
  if (state.completionSatisfied === true) return false;
  if (state.completionPassReason !== 'not_confirmed') return false;
  if (!officialShallowCloseCommitCanBePending(state.completionBlockedReason)) return false;
  if (!shallowRecoveryShallowBandEligible(state)) return false;
  if (state.officialShallowPathAdmitted !== true) return false;
  if (!shallowRecoveryHasAttemptDescendCommitment(state)) return false;
  if (!shallowRecoveryReadinessClear(state)) return false;
  if (!shallowRecoverySetupClear(state, options)) return false;
  if (state.eventCyclePromoted === true) return false;

  const closeTruthSourcePresent =
    state.reversalConfirmedByRuleOrHmm === true ||
    state.officialShallowStreamBridgeApplied === true;
  if (!closeTruthSourcePresent) return false;
  if (state.reversalConfirmedAfterDescend !== true) return false;
  if (state.recoveryConfirmedAfterReversal !== true) return false;
  if (state.officialShallowReversalSatisfied !== true) return false;
  if (state.officialShallowAscentEquivalentSatisfied !== true) return false;
  if (state.officialShallowClosureProofSatisfied !== true) return false;
  if (state.ownerAuthoritativeRecoverySatisfied !== true) return false;

  if (state.canonicalTemporalEpochOrderSatisfied !== true) return false;
  if (!shallowRecoveryHasNoKnownStaleOrMixedRep(state)) return false;
  if (state.standingRecoveredAtMs == null) return false;
  if (!shallowRecoveryHasSameRepPeakAnchor(state)) return false;

  return true;
}

export function applySameRepShallowAdmissionCloseRecovery(
  state: SquatCompletionState,
  options?: EvaluateSquatCompletionStateOptions
): SquatCompletionState {
  let next = state;

  if (sameRepShallowAdmissionRecoveryEligible(next, options)) {
    next = {
      ...next,
      officialShallowPathAdmitted: true,
      officialShallowPathReason: next.officialShallowPathReason ?? 'same_rep_shallow_admission_recovery',
      officialShallowPathBlockedReason: null,
      sameRepShallowAdmissionRecovered: true,
      sameRepShallowAdmissionRecoveryReason: next.completionBlockedReason ?? 'freeze_or_latch_missing',
    };
  }

  if (sameRepShallowCloseRecoveryEligible(next, options)) {
    const recoveredFrom = isSameRepShallowTimingCloseBlocker(state.completionBlockedReason)
      ? state.completionBlockedReason
      : null;
    next = {
      ...next,
      completionBlockedReason: null,
      sameRepShallowCloseRecovered: true,
      sameRepShallowCloseRecoveredFrom: recoveredFrom,
    };
  }

  if (officialShallowAdmittedToClosedContractEligible(next, options)) {
    const recoveredFrom = isOfficialShallowAdmittedToClosedResidualBlocker(
      state.completionBlockedReason
    )
      ? state.completionBlockedReason
      : isOfficialShallowAdmittedToClosedResidualBlocker(next.completionBlockedReason)
        ? next.completionBlockedReason
        : null;
    const anchorProvenance = readSameRepShallowAnchorProvenance(next);
    const anchorResetFrom = currentRepAnchorResetReason(next);
    const shouldResetAnchor =
      anchorProvenance.aligned === true &&
      anchorProvenance.index != null &&
      needsCurrentRepAnchorProvenanceReset(next);
    const spanAlignedFrom = isSameRepShallowTimingCloseBlocker(next.completionBlockedReason)
      ? next.completionBlockedReason
      : null;
    next = {
      ...next,
      ...(anchorProvenance.aligned === true
        ? {
            baselineFrozen: shouldResetAnchor ? true : next.baselineFrozen,
            peakLatched: shouldResetAnchor ? true : next.peakLatched,
            peakLatchedAtIndex:
              shouldResetAnchor && anchorProvenance.index != null
                ? anchorProvenance.index
                : next.peakLatchedAtIndex,
            peakAnchorTruth:
              shouldResetAnchor
                ? 'committed_or_post_commit_peak'
                : next.peakAnchorTruth,
            currentRepShallowAnchorProvenanceResetApplied: shouldResetAnchor,
            currentRepShallowAnchorProvenanceResetFrom: shouldResetAnchor
              ? anchorResetFrom
              : next.currentRepShallowAnchorProvenanceResetFrom ?? null,
            currentRepShallowAnchorProvenanceResetSource: anchorProvenance.source,
            currentRepShallowAnchorProvenanceResetIndex: anchorProvenance.index,
          }
        : {}),
      completionBlockedReason: spanAlignedFrom != null ? null : next.completionBlockedReason,
      officialShallowPathBlockedReason:
        spanAlignedFrom != null ? null : next.officialShallowPathBlockedReason,
      officialShallowAdmittedToClosedContractSatisfied: true,
      officialShallowAdmittedToClosedContractRecoveredFrom: recoveredFrom,
      officialShallowAdmittedToClosedContractSource:
        next.reversalConfirmedByRuleOrHmm === true
          ? 'same_rep_rule_or_hmm_shallow_closure'
          : 'same_rep_official_shallow_bridge_closure',
      sameRepShallowCloseRecovered: true,
      sameRepShallowCloseRecoveredFrom: next.sameRepShallowCloseRecoveredFrom ?? recoveredFrom,
      sameRepShallowSpanAlignedToCurrentAnchor:
        spanAlignedFrom != null ? true : next.sameRepShallowSpanAlignedToCurrentAnchor,
      sameRepShallowSpanAlignedFrom: next.sameRepShallowSpanAlignedFrom ?? spanAlignedFrom,
    };
  }

  return next;
}

function disabledCompletionOwnerShallowAdmissibilityReopen(
  state: SquatCompletionState
): SquatCompletionState {
  if (state.completionSatisfied === true) return state;
  if (state.completionPassReason !== 'not_confirmed') return state;
  if (state.currentSquatPhase !== 'standing_recovered') return state;
  if (state.standingRecoveredAtMs == null) return state;
  if (state.attemptStarted !== true) return state;
  if (state.descendConfirmed !== true) return state;
  if (state.downwardCommitmentReached !== true) return state;
  if (state.recoveryConfirmedAfterReversal !== true) return state;
  if (state.eventCyclePromoted === true) return state;
  if (state.officialShallowPathAdmitted !== true) return state;
  if (state.officialShallowClosureProofSatisfied !== true) return state;
  if (state.officialShallowAscentEquivalentSatisfied !== true) return state;
  if (state.officialShallowReversalSatisfied !== true) return state;
  if (state.reversalConfirmedByRuleOrHmm !== true) return state;
  if (state.setupMotionBlocked === true) return state;
  if (state.completionBlockedReason === 'not_armed') return state;

  const ownerReason =
    (state.relativeDepthPeak ?? 0) < DISABLED_SHALLOW_OWNER_REOPEN_ULTRA_LOW_FLOOR
      ? 'ultra_low_rom_complete_rule'
      : 'shallow_complete_rule';
  const passReason =
    ownerReason === 'ultra_low_rom_complete_rule' ? 'ultra_low_rom_cycle' : 'low_rom_cycle';

  return {
    ...state,
    completionSatisfied: true,
    completionBlockedReason: null,
    completionPassReason: passReason,
    completionMachinePhase: 'completed',
    cycleComplete: true,
    successPhaseAtOpen: 'standing_recovered',
  };
}

/** PR-CAM-CANONICAL-SHALLOW-CONTRACT-01: 이미 계산된 state fact 만 canonical 입력으로 넘긴다. */
function buildCanonicalShallowContractInputFromState(s: SquatCompletionState) {
  return buildCanonicalShallowContractInputFromStateImpl(s);
}

/**
 * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: shallow success 를 여는 유일한 writer.
 * canonical shallow contract 가 satisfied 이고 모든 guard 조건이 만족될 때만 official_shallow_cycle 을 연다.
 * 이 helper 외부에서 official_shallow_cycle 을 직접 쓰면 안 된다.
 */
function applyCanonicalShallowClosureFromContract(
  state: SquatCompletionState,
  options?: EvaluateSquatCompletionStateOptions
): SquatCompletionState {
  return applyCanonicalShallowClosureFromContractImpl(state, {
    standardOwnerFloor: STANDARD_OWNER_FLOOR,
    deriveSquatCompletionFinalizeMode,
    setupMotionBlocked: state.setupMotionBlocked === true || options?.setupMotionBlocked === true,
  });
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
  return stampPreCanonicalObservabilityImpl(state, frames, options, {
    mapCompletionBlockedReasonToShallowNormalizedBlockerFamily,
    standardOwnerFloor: STANDARD_OWNER_FLOOR,
    reversalDropMinAbs: REVERSAL_DROP_MIN_ABS,
    recoveryMeetsLowRomStyleFinalizeProof,
    getGuardedShallowLocalPeakAnchor,
    ultraLowRomEventPromotionMeetsAscentIntegrity,
    shallowClosureProofTraceReason: SHALLOW_CLOSURE_PROOF_TRACE_REASON,
  });
}

export function evaluateSquatCompletionState(
  frames: PoseFeaturesFrame[],
  options?: EvaluateSquatCompletionStateOptions
): SquatCompletionState {
  let depthFreeze: SquatDepthFreezeConfig | null = null;
  let currentRepEpochSnapshot: ShallowCurrentRepEpochSnapshot | null = null;
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
          const frozenPartial = evaluateSquatCompletionCore(
            frames.slice(0, n),
            options,
            depthFreeze
          );
          currentRepEpochSnapshot = captureShallowCurrentRepEpochSnapshot(frozenPartial);
        }
        break;
      }
    }
  }

  /**
   * PR-CAM-CURRENT-REP-OWNERSHIP-REALIGN-01: Late depth freeze for ultra-shallow reps.
   *
   * The prefix loop above may fail to find attemptStarted=true for ultra-shallow reps
   * whose admission requires recovery evidence (guardedUltraLowAttemptEligible). In
   * early prefixes, recovery is not yet visible → attemptAdmissionSatisfied=false →
   * downwardCommitmentReached=false → attemptStarted=false → depthFreeze stays null.
   *
   * When this happens, the full-frame evaluation produces attemptStarted=true (recovery
   * IS detected) but baselineFrozen=false / peakLatched=false because depthFreeze is
   * null. The canonical contract then blocks with rep_epoch_integrity_blocked.
   *
   * Fix: if the prefix loop failed but the full evaluation succeeds, retroactively
   * compute depthFreeze from the full context and re-evaluate. This does NOT change
   * any threshold — it ensures the freeze mechanism fires for the same motion that
   * already earned attemptStarted=true.
   */
  let initialState = evaluateSquatCompletionCore(frames, options, depthFreeze);

  if (depthFreeze === null && initialState.attemptStarted === true) {
    const validFull = frames.filter((f) => f.isValid);
    const fullRows = buildSquatCompletionDepthRows(validFull);
    if (fullRows.length >= BASELINE_WINDOW) {
      const win = fullRows.slice(0, BASELINE_WINDOW);
      const src = initialState.relativeDepthPeakSource ?? 'primary';
      const seedP = options?.seedBaselineStandingDepthPrimary;
      const seedB = options?.seedBaselineStandingDepthBlended;
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
      initialState = evaluateSquatCompletionCore(frames, options, depthFreeze);
      currentRepEpochSnapshot =
        currentRepEpochSnapshot ?? captureShallowCurrentRepEpochSnapshot(initialState);
    }
  }

  let state = resolveStandardDriftAfterShallowAdmission(
    initialState,
    frames,
    options,
    depthFreeze
  );

  state = applyShallowCurrentRepEpochStability(state, currentRepEpochSnapshot, options);

  /**
   * PR-RF-STRUCT-12 REP-REBIND-01: Hard-reset ghost rep timestamps at rep boundary.
   *
   * `evaluateSquatCompletionCore` always sets `peakAtMs` (global max-depth frame timestamp)
   * regardless of whether a proper attempt was detected. When `attemptStarted=false`, that
   * timestamp is a "ghost peak" — a frame-level artifact with no rep identity — and MUST
   * NOT be readable by downstream layers as if it belonged to a real rep.
   *
   * Mixed-rep rule: all rep-bound timestamp fields must belong to the same rep identity
   * or be undefined. `attemptStarted=false` is the reliable signal that no rep epoch
   * has been established; clearing timestamps here makes it impossible for downstream
   * code to combine a ghost `peakAtMs` from a pre-attempt frame with `reversalAtMs` or
   * `standingRecoveredAtMs` from a later evaluation context.
   *
   * Fields cleared: descendStartAtMs, peakAtMs (the main ghost risk), committedAtMs,
   * reversalAtMs, ascendStartAtMs, standingRecoveredAtMs.
   * Completion truth fields (completionSatisfied, completionBlockedReason, etc.) are
   * not touched — this is pure rep-bound timestamp hygiene.
   */
  if (state.attemptStarted !== true) {
    state = {
      ...state,
      descendStartAtMs: undefined,
      peakAtMs: undefined,
      committedAtMs: undefined,
      reversalAtMs: undefined,
      ascendStartAtMs: undefined,
      standingRecoveredAtMs: undefined,
    };
  }

  /**
   * PR-1-COMPLETION-STATE-SLIMMING: Observability stamps before canonical contract.
   * stampPreCanonicalObservability adds observability fields only — completion truth
   * (completionSatisfied / completionBlockedReason / completionPassReason) is not modified.
   */
  state = stampPreCanonicalObservability(state, frames, options);
  state = applyShallowAcquisitionPeakProvenanceUnification(state, options);

  state = applySameRepShallowAdmissionCloseRecovery(state, options);

  /**
   * PR-CAM-CANONICAL-SHALLOW-CLOSER-02: canonical contract derive — 정확히 1회.
   * derive 이전 snapshot 기준으로 계산하며, 결과를 state 에 merge 한 뒤
   * applyCanonicalShallowClosureFromContract() 를 정확히 1회 호출해 shallow success 를 연다.
   * attachShallowTruthObservabilityAlign01() 은 그 이후에 호출.
   */
  const canonicalShallowContract = deriveCanonicalShallowCompletionContract(
    buildCanonicalShallowContractInputFromState(state)
  );

  state = mergeCanonicalShallowContractResult(state, canonicalShallowContract);

  state = applyCanonicalShallowClosureFromContract(state, options);

  /**
   * PR-CAM-EVENT-OWNER-DOWNGRADE-01: 이벤트 사이클은 탐지·관측만 — canonical closer 가 성공 클로저의 유일 경로.
   * PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03: attach 는 pure observability.
   * product policy(applyUltraLowPolicyLock) 는 이 함수 내부에서 호출하지 않는다.
   * → evaluator boundary(evaluators/squat.ts) 에서 1회 적용한다.
   */
  return attachShallowTruthObservabilityAlign01(state);
}
