/**
 * PR-CAM-SQUAT-RESULT-SEVERITY-01: 통과 truth·품질 truth만으로 결과 severity 표면화(엔진·판정 로직 없음).
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
  completionTruthPassed: boolean;
  captureQuality: string;
  qualityOnlyWarnings?: string[];
  qualityTier?: string | null;
  limitations?: string[];
}): SquatResultSeveritySummary {
  const qualityWarningCount = args.qualityOnlyWarnings?.length ?? 0;
  const limitations = args.limitations ?? [];
  const limitationCount = limitations.length;
  const qualityTier = args.qualityTier ?? null;

  if (args.completionTruthPassed !== true) {
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
