/**
 * PR-HMM-03A — 실기기 calibration용 컴팩트 트레이스 빌더 (pass/truth 변경 없음)
 */
import type { SquatCompletionState } from '@/lib/camera/squat-completion-state';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';

/** diagnosis / localStorage 용 짧은 키 — payload 과대화 방지 */
export interface SquatCalibrationTraceCompact {
  rb: string | null;
  fb: string | null;
  ae: boolean;
  aa: boolean;
  asbf: boolean;
  ar: string | null;
  fr: string | null;
  fbnd: string | null;
  hc: number;
  he: number;
  hcnts: { s: number; d: number; b: number; a: number };
  htc: number;
}

export const SQUAT_CALIBRATION_TRACE_COMPACT_KEYS = [
  'rb',
  'fb',
  'ae',
  'aa',
  'asbf',
  'ar',
  'fr',
  'fbnd',
  'hc',
  'he',
  'hcnts',
  'htc',
] as const;

export function buildSquatCalibrationTraceCompact(
  state: SquatCompletionState | undefined,
  hmm: SquatHmmDecodeResult | undefined
): SquatCalibrationTraceCompact {
  return {
    rb: state?.ruleCompletionBlockedReason ?? null,
    fb: state?.postAssistCompletionBlockedReason ?? state?.completionBlockedReason ?? null,
    ae: state?.hmmAssistEligible ?? false,
    aa: state?.hmmAssistApplied ?? false,
    asbf: state?.assistSuppressedByFinalize ?? false,
    ar: state?.hmmAssistReason ?? null,
    fr: state?.standingRecoveryFinalizeReason ?? null,
    fbnd: state?.standingRecoveryBand ?? null,
    hc: hmm?.confidence ?? 0,
    he: hmm?.effectiveExcursion ?? 0,
    hcnts: {
      s: hmm?.dominantStateCounts.standing ?? 0,
      d: hmm?.dominantStateCounts.descent ?? 0,
      b: hmm?.dominantStateCounts.bottom ?? 0,
      a: hmm?.dominantStateCounts.ascent ?? 0,
    },
    htc: hmm?.transitionCount ?? 0,
  };
}
