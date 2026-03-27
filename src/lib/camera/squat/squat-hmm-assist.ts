/**
 * PR-HMM-02B — HMM shadow evidence를 blocked-reason assist로만 사용.
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

const HMM_MIN_CONFIDENCE = 0.45;
const HMM_MIN_DESCENT = 2;
const HMM_MIN_ASCENT = 2;
const HMM_MIN_EXCURSION = 0.02;

/**
 * HMM이 “강한 사이클 후보”인지 — assist 후보의 1차 필터.
 */
export function hmmMeetsStrongAssistEvidence(hmm: SquatHmmDecodeResult | undefined): boolean {
  if (hmm == null) return false;
  return (
    hmm.completionCandidate === true &&
    hmm.confidence >= HMM_MIN_CONFIDENCE &&
    hmm.dominantStateCounts.descent >= HMM_MIN_DESCENT &&
    hmm.dominantStateCounts.ascent >= HMM_MIN_ASCENT &&
    hmm.effectiveExcursion >= HMM_MIN_EXCURSION
  );
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
  return isAssistableBlockedReason(completionBlockedReason) && hmmMeetsStrongAssistEvidence(hmm);
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
    if (blocked != null && isAssistableBlockedReason(blocked) && !hmmMeetsStrongAssistEvidence(hmm)) {
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
