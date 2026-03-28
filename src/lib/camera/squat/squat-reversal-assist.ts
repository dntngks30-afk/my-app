/**
 * PR-HMM-04B — 깊은 사이클에서 rule `no_reversal`(기하 역전 미탐)일 때만 HMM ascent 증거로 보조.
 * finalize·pass 소유권 불변; shallow ambiguous 경로는 열지 않음.
 */

import type { SquatRecoverySignal } from '@/lib/camera/pose-features';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';

/** rule relative peak 기준 — moderate/deep만 */
const REVERSAL_ASSIST_MIN_RELATIVE_DEPTH_PEAK = 0.35;
/** 0.35~0.45 애매대역에서 ultra-low 라벨이면 차단 */
const REVERSAL_ASSIST_AMBIGUOUS_PEAK_CAP = 0.45;

const REVERSAL_ASSIST_MIN_HMM_CONFIDENCE = 0.4;
const REVERSAL_ASSIST_MIN_HMM_ASCENT_DOMINANT = 2;
const REVERSAL_ASSIST_MIN_TRANSITION_COUNT = 3;
/** 피크 이후 복귀가 거의 없으면 역전 assist 금지 */
const REVERSAL_ASSIST_MIN_RECOVERY_DROP_RATIO = 0.055;

export interface SquatHmmReversalAssistContext {
  ruleCompletionBlockedReason: string | null;
  relativeDepthPeak: number;
  /** squat evidence 라벨 — insufficient_signal / ultra_low 애매대역 차단용 */
  evidenceLabel: string;
  hmm: SquatHmmDecodeResult | undefined;
  standingRecoveredAtMs: number | undefined | null;
  recovery: SquatRecoverySignal;
}

export interface SquatHmmReversalAssistDecision {
  assistEligible: boolean;
  assistApplied: boolean;
  assistReason: string | null;
  syntheticReversalConfirmed: boolean;
  notes: string[];
}

function hasPostPeakRecoveryEvidence(
  standingRecoveredAtMs: number | undefined | null,
  rec: SquatRecoverySignal
): boolean {
  if (standingRecoveredAtMs != null) return true;
  if (rec.recovered) return true;
  if (rec.lowRomRecovered || rec.ultraLowRomRecovered || rec.ultraLowRomGuardedRecovered) return true;
  if ((rec.returnContinuityFrames ?? 0) >= 1) return true;
  if ((rec.recoveryDropRatio ?? 0) >= REVERSAL_ASSIST_MIN_RECOVERY_DROP_RATIO) return true;
  return false;
}

function meetsHmmReversalEvidence(hmm: SquatHmmDecodeResult | undefined): boolean {
  if (hmm == null) return false;
  return (
    hmm.completionCandidate === true &&
    hmm.confidence >= REVERSAL_ASSIST_MIN_HMM_CONFIDENCE &&
    hmm.dominantStateCounts.ascent >= REVERSAL_ASSIST_MIN_HMM_ASCENT_DOMINANT &&
    hmm.transitionCount >= REVERSAL_ASSIST_MIN_TRANSITION_COUNT
  );
}

/**
 * `ruleCompletionBlockedReason === 'no_reversal'` 일 때만 평가.
 * PR-HMM-04 no_reversal blocked-reason assist threshold는 그대로 두고, 별도 깊이·복귀·HMM 게이트로만 연다.
 */
export function getSquatHmmReversalAssistDecision(
  ctx: SquatHmmReversalAssistContext
): SquatHmmReversalAssistDecision {
  const notes: string[] = [];

  if (ctx.ruleCompletionBlockedReason !== 'no_reversal') {
    notes.push('skip_not_no_reversal_rule');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticReversalConfirmed: false,
      notes,
    };
  }

  if (ctx.relativeDepthPeak < REVERSAL_ASSIST_MIN_RELATIVE_DEPTH_PEAK) {
    notes.push('depth_below_reversal_assist_min');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticReversalConfirmed: false,
      notes,
    };
  }

  if (ctx.evidenceLabel === 'insufficient_signal') {
    notes.push('insufficient_signal_shallow_block');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticReversalConfirmed: false,
      notes,
    };
  }

  if (
    ctx.relativeDepthPeak < REVERSAL_ASSIST_AMBIGUOUS_PEAK_CAP &&
    ctx.evidenceLabel === 'ultra_low_rom'
  ) {
    notes.push('ambiguous_band_ultra_low_block');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticReversalConfirmed: false,
      notes,
    };
  }

  if (!hasPostPeakRecoveryEvidence(ctx.standingRecoveredAtMs, ctx.recovery)) {
    notes.push('no_post_peak_recovery_evidence');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticReversalConfirmed: false,
      notes,
    };
  }

  if (!meetsHmmReversalEvidence(ctx.hmm)) {
    notes.push('hmm_ascent_evidence_below_reversal_assist');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticReversalConfirmed: false,
      notes,
    };
  }

  notes.push('hmm_reversal_assist_deep_cycle');
  return {
    assistEligible: true,
    assistApplied: true,
    assistReason: 'hmm_reversal_assist_deep_cycle',
    syntheticReversalConfirmed: true,
    notes,
  };
}

/** camera-trace compact — hrae, hraa, hrar */
export interface SquatReversalAssistTraceCompact {
  hrae: boolean;
  hraa: boolean;
  hrar: string | null;
}

export function buildSquatReversalAssistTraceCompact(
  eligible: boolean | undefined,
  applied: boolean | undefined,
  reason: string | null | undefined
): SquatReversalAssistTraceCompact {
  return {
    hrae: eligible ?? false,
    hraa: applied ?? false,
    hrar: reason ?? null,
  };
}
