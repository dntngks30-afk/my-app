/**
 * PR-HMM-02B — HMM shadow evidence를 blocked-reason assist로만 사용.
 * PR-HMM-04 — reason별 assist threshold 분리 (finalize·completion 소유권 불변).
 *
 * - completionSatisfied 최종 소유권은 rule/state machine 유지
 * - HMM은 no_descend / descent_span_too_short / no_reversal 에 한해 blocked reason 완화만
 * - recovery / finalize 계열은 절대 override 금지
 */

import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';

/** HMM assist가 허용되는 completionBlockedReason 값만 */
export const HMM_ASSISTABLE_BLOCKED_REASONS = [
  'no_descend',
  'descent_span_too_short',
  'no_reversal',
] as const;

export type HmmAssistableBlockedReason = (typeof HMM_ASSISTABLE_BLOCKED_REASONS)[number];

function isAssistableBlockedReason(s: string | null): s is HmmAssistableBlockedReason {
  return s != null && (HMM_ASSISTABLE_BLOCKED_REASONS as readonly string[]).includes(s);
}

/** recovery / finalize / standing 미복귀 등 — HMM으로 절대 열지 않음 */
const NON_ASSIST_RECOVERY_OR_FINALIZE: readonly string[] = [
  'not_standing_recovered',
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
];

/** PR-HMM-04: assist 정책 임계 — reason별 분기, magic number 분산 금지 */
export interface SquatHmmAssistThresholds {
  minHmmConfidence: number;
  minHmmExcursion: number;
  minDescentCount: number;
  minAscentCount: number;
}

/**
 * descent_span: timing-only shallow에서 HMM이 약간 낮아도 사이클 후보는 살림 (false negative 완화).
 * no_reversal: phase/rule 불일치 시 오개방 방지 — confidence·excursion 약간 상향.
 * no_descend: PR-HMM-02B 기본 바와 동일.
 */
export const SQUAT_HMM_ASSIST_THRESHOLDS: Record<HmmAssistableBlockedReason, SquatHmmAssistThresholds> = {
  descent_span_too_short: {
    minHmmConfidence: 0.42,
    minHmmExcursion: 0.018,
    minDescentCount: 2,
    minAscentCount: 2,
  },
  no_descend: {
    minHmmConfidence: 0.45,
    minHmmExcursion: 0.02,
    minDescentCount: 2,
    minAscentCount: 2,
  },
  no_reversal: {
    minHmmConfidence: 0.5,
    minHmmExcursion: 0.021,
    minDescentCount: 2,
    minAscentCount: 2,
  },
};

/** assistSuppressedByFinalize 등 — PR-03A 이전과 동일한 “강한 HMM” 바 (단일 막대) */
const HMM_STRONG_EVIDENCE_FOR_SUPPRESSION: SquatHmmAssistThresholds = {
  minHmmConfidence: 0.45,
  minHmmExcursion: 0.02,
  minDescentCount: 2,
  minAscentCount: 2,
};

export interface HmmAssistContext {
  completionBlockedReason: string | null;
  relativeDepthPeak: number;
  standingRecoveredAtMs?: number | null;
  /** getStandingRecoveryFinalizeGate().finalizeSatisfied 와 동일 */
  standingRecoveryFinalizeSatisfied: boolean;
  ascendConfirmed: boolean;
  downwardCommitmentReached: boolean;
  attemptAdmissionSatisfied: boolean;
  committedFrameExists: boolean;
}

export interface HmmAssistDecision {
  assistEligible: boolean;
  assistApplied: boolean;
  assistReason: string | null;
  /** assist 적용 시 null(해당 blocker 제거), 미적용 시 원래 blocked reason */
  nextBlockedReason: string | null;
  notes: string[];
}

/**
 * calibration / compact trace용: 현재 rule blocked reason에 대응하는 적용 임계 스냅샷.
 * assist 불가 reason이면 null.
 */
export function getSquatHmmAssistThresholdSnapshot(
  ruleCompletionBlockedReason: string | null
): SquatHmmAssistThresholds | null {
  if (!isAssistableBlockedReason(ruleCompletionBlockedReason)) return null;
  return SQUAT_HMM_ASSIST_THRESHOLDS[ruleCompletionBlockedReason];
}

function meetsThresholds(hmm: SquatHmmDecodeResult, t: SquatHmmAssistThresholds): boolean {
  return (
    hmm.completionCandidate === true &&
    hmm.confidence >= t.minHmmConfidence &&
    hmm.dominantStateCounts.descent >= t.minDescentCount &&
    hmm.dominantStateCounts.ascent >= t.minAscentCount &&
    hmm.effectiveExcursion >= t.minHmmExcursion
  );
}

/**
 * 특정 assistable blocked reason에 대한 HMM 증거 충족 여부 (정책 게이트).
 */
export function hmmMeetsAssistThresholdForBlockedReason(
  hmm: SquatHmmDecodeResult | undefined,
  completionBlockedReason: string | null
): boolean {
  if (hmm == null || completionBlockedReason == null) return false;
  if (!isAssistableBlockedReason(completionBlockedReason)) return false;
  const t = SQUAT_HMM_ASSIST_THRESHOLDS[completionBlockedReason];
  return meetsThresholds(hmm, t);
}

/**
 * HMM이 “강한 사이클 후보”인지 — assistSuppressedByFinalize 등 **관측용** 단일 막대 (PR-03A 유지).
 * assist 적용 여부는 reason별 `hmmMeetsAssistThresholdForBlockedReason`를 쓴다.
 */
export function hmmMeetsStrongAssistEvidence(hmm: SquatHmmDecodeResult | undefined): boolean {
  if (hmm == null) return false;
  return meetsThresholds(hmm, HMM_STRONG_EVIDENCE_FOR_SUPPRESSION);
}

/**
 * 해당 blocked reason + HMM이 assist 정책상 “후보”인지 (post gate 전).
 */
export function shouldUseHmmAssistForBlockedReason(
  completionBlockedReason: string | null,
  hmm: SquatHmmDecodeResult | undefined
): boolean {
  if (completionBlockedReason == null) return false;
  if (NON_ASSIST_RECOVERY_OR_FINALIZE.includes(completionBlockedReason)) return false;
  return (
    isAssistableBlockedReason(completionBlockedReason) &&
    hmmMeetsAssistThresholdForBlockedReason(hmm, completionBlockedReason)
  );
}

/**
 * 초중반 segmentation blocker만 HMM으로 완화. 후반 gate는 ctx로 재검증.
 */
export function getHmmAssistDecision(
  hmm: SquatHmmDecodeResult | undefined,
  ctx: HmmAssistContext
): HmmAssistDecision {
  const notes: string[] = [];
  const blocked = ctx.completionBlockedReason;

  if (blocked != null && NON_ASSIST_RECOVERY_OR_FINALIZE.includes(blocked)) {
    notes.push('non_assist_recovery_or_finalize');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      nextBlockedReason: blocked,
      notes,
    };
  }

  const assistEligible = shouldUseHmmAssistForBlockedReason(blocked, hmm);

  if (!assistEligible) {
    if (
      blocked != null &&
      isAssistableBlockedReason(blocked) &&
      !hmmMeetsAssistThresholdForBlockedReason(hmm, blocked)
    ) {
      notes.push('hmm_evidence_below_assist_threshold');
    }
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      nextBlockedReason: blocked,
      notes,
    };
  }

  // descent_span_too_short: rule 체인상 이미 standing finalize 통과한 뒤 타이밍만 막힘
  if (blocked === 'descent_span_too_short') {
    notes.push('assist_descent_span_timing');
    return {
      assistEligible: true,
      assistApplied: true,
      assistReason: 'hmm_assist_descent_span_too_short',
      nextBlockedReason: null,
      notes,
    };
  }

  /**
   * no_descend / no_reversal: rule이 앞 단계에서만 막은 경우.
   * attemptAdmission 등은 체인 순서상 앞에서 이미 통과했거나, phaseHint 누락과 괴리가 날 수 있어
   * standing 복귀·finalize·상승 확인만 강제한다 (HMM 단독 pass 금지).
   */
  const postGatesOkEarlyAssist =
    ctx.ascendConfirmed &&
    ctx.standingRecoveredAtMs != null &&
    ctx.standingRecoveryFinalizeSatisfied;

  if (!postGatesOkEarlyAssist) {
    notes.push('post_phase_gates_not_met_for_early_blocker_assist');
    return {
      assistEligible: true,
      assistApplied: false,
      assistReason: null,
      nextBlockedReason: blocked,
      notes,
    };
  }

  if (blocked === 'no_descend') {
    notes.push('assist_no_descend_with_post_gates');
    return {
      assistEligible: true,
      assistApplied: true,
      assistReason: 'hmm_assist_no_descend',
      nextBlockedReason: null,
      notes,
    };
  }

  if (blocked === 'no_reversal') {
    notes.push('assist_no_reversal_with_post_gates');
    return {
      assistEligible: true,
      assistApplied: true,
      assistReason: 'hmm_assist_no_reversal',
      nextBlockedReason: null,
      notes,
    };
  }

  notes.push('unexpected_assist_branch');
  return {
    assistEligible: false,
    assistApplied: false,
    assistReason: null,
    nextBlockedReason: blocked,
    notes,
  };
}
