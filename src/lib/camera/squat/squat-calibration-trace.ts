/**
 * PR-HMM-03A — 실기기 calibration용 컴팩트 트레이스 빌더 (pass/truth 변경 없음)
 * PR-HMM-04 — `t`: 현재 rule blocked reason에 매핑된 assist 임계 스냅샷 (짧은 키)
 */
import type { SquatCompletionState } from '@/lib/camera/squat-completion-state';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';
import { getSquatHmmAssistThresholdSnapshot } from '@/lib/camera/squat/squat-hmm-assist';

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
  /** 적용 assist 임계: c=confidence, e=excursion, d/a=dominant descent·ascent 최소 */
  t: { c: number; e: number; d: number; a: number } | null;
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
  't',
] as const;

export function buildSquatCalibrationTraceCompact(
  state: SquatCompletionState | undefined,
  hmm: SquatHmmDecodeResult | undefined
): SquatCalibrationTraceCompact {
  const thr = getSquatHmmAssistThresholdSnapshot(state?.ruleCompletionBlockedReason ?? null);
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
    t: thr
      ? {
          c: thr.minHmmConfidence,
          e: thr.minHmmExcursion,
          d: thr.minDescentCount,
          a: thr.minAscentCount,
        }
      : null,
  };
}
