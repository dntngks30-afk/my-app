/**
 * PR-CAM-SQUAT-RESULT-SEVERITY-01: 통과 truth·품질 truth만으로 결과 severity 표면화(엔진·판정 로직 없음).
 *
 * PR-B: pass/fail 정본은 PR-A에서 동결된 최종 패스 표면(`finalPassGranted`)이다.
 * `completionTruthPassed`는 레거시 폴백으로만 남음 — 새 소비자는 `finalPassGranted`를 사용할 것.
 * 두 인자가 모두 존재하면 `finalPassGranted`가 우선한다.
 */

export type SquatPassSeverity =
  | 'clean_pass'
  | 'warning_pass'
  | 'low_quality_pass'
  | 'failed';

export type SquatResultInterpretation =
  | 'movement_completed_clean'
  | 'movement_completed_with_warnings'
  | 'movement_completed_but_quality_limited'
  | 'movement_not_completed';

export interface SquatResultSeveritySummary {
  passSeverity: SquatPassSeverity;
  resultInterpretation: SquatResultInterpretation;
  qualityTier: string | null;
  qualityWarningCount: number;
  limitationCount: number;
}

export function buildSquatResultSeveritySummary(args: {
  /**
   * PR-B: 스쿼트 최종 패스 표면(PR-A `SquatFinalPassTruthSurface.finalPassGranted`과 동치).
   * 존재하면 항상 `completionTruthPassed`보다 우선한다.
   */
  finalPassGranted?: boolean;
  /**
   * PR-04D1 레거시 — `finalPassGranted`가 없을 때만 사용.
   * 신규 소비자는 `finalPassGranted`를 명시적으로 전달할 것.
   * @deprecated Use `finalPassGranted` instead.
   */
  completionTruthPassed?: boolean;
  captureQuality: string;
  qualityOnlyWarnings?: string[];
  qualityTier?: string | null;
  limitations?: string[];
}): SquatResultSeveritySummary {
  const qualityWarningCount = args.qualityOnlyWarnings?.length ?? 0;
  const limitations = args.limitations ?? [];
  const limitationCount = limitations.length;
  const qualityTier = args.qualityTier ?? null;

  // PR-B: `finalPassGranted`가 존재하면 항상 정본으로 사용.
  // 없으면 레거시 `completionTruthPassed`로 폴백(기존 스모크·이전 소비자 유지).
  const passed =
    typeof args.finalPassGranted === 'boolean'
      ? args.finalPassGranted
      : args.completionTruthPassed === true;

  if (passed !== true) {
    return {
      passSeverity: 'failed',
      resultInterpretation: 'movement_not_completed',
      qualityTier,
      qualityWarningCount,
      limitationCount,
    };
  }

  if (
    args.captureQuality === 'low' ||
    args.qualityTier === 'low' ||
    qualityWarningCount >= 1
  ) {
    return {
      passSeverity: 'low_quality_pass',
      resultInterpretation: 'movement_completed_but_quality_limited',
      qualityTier,
      qualityWarningCount,
      limitationCount,
    };
  }

  if (limitationCount >= 1) {
    return {
      passSeverity: 'warning_pass',
      resultInterpretation: 'movement_completed_with_warnings',
      qualityTier,
      qualityWarningCount,
      limitationCount,
    };
  }

  return {
    passSeverity: 'clean_pass',
    resultInterpretation: 'movement_completed_clean',
    qualityTier,
    qualityWarningCount,
    limitationCount,
  };
}
