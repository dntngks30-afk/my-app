/**
 * 재검사 결과 비교 로직
 * 
 * 원본 검사와 재검사 결과를 비교하여 변화를 분석합니다.
 */

import type { MainTypeCode } from '@/types/movement-test';

/**
 * 검사 결과 인터페이스
 */
export interface TestResultData {
  id: string;
  main_type: string;
  sub_type: string;
  confidence: number;
  type_scores: Record<string, number>; // {D: 10, N: 5, B: 3, H: 2}
  imbalance_severity?: 'none' | 'mild' | 'strong';
  completed_at: string;
}

/**
 * 비교 결과 인터페이스
 */
export interface ComparisonResult {
  // 타입 변화
  typeChanged: boolean;
  originalMainType: string;
  newMainType: string;
  typeChangeDirection?: 'improved' | 'worsened' | 'neutral';

  // 점수 변화
  scoreChanges: {
    type: string;
    original: number;
    new: number;
    change: number;
    changePercent: number;
  }[];

  // Confidence 변화
  confidenceChange: {
    original: number;
    new: number;
    change: number;
  };

  // 불균형 변화
  imbalanceChange?: {
    original: 'none' | 'mild' | 'strong';
    new: 'none' | 'mild' | 'strong';
    improved: boolean;
  };

  // 전체 평가
  overallTrend: 'improved' | 'worsened' | 'stable';
  improvementPoints: string[];
  areasToFocus: string[];

  // 요약
  summary: string;
}

/**
 * 메인 타입 코드 매핑
 */
const MAIN_TYPE_MAP: Record<string, MainTypeCode> = {
  담직: 'D',
  날림: 'N',
  버팀: 'B',
  흘림: 'H',
};

/**
 * 타입 우선순위 (개선 방향)
 * 낮은 번호가 더 "안정적"인 타입으로 간주
 */
const TYPE_PRIORITY: Record<MainTypeCode, number> = {
  D: 1, // 담직형 (가장 안정적)
  B: 2, // 버팀형
  H: 3, // 흘림형
  N: 4, // 날림형 (가장 불안정)
};

/**
 * 재검사 결과 비교
 */
export function compareTestResults(
  original: TestResultData,
  retest: TestResultData
): ComparisonResult {
  const originalMainTypeCode = MAIN_TYPE_MAP[original.main_type] || 'D';
  const newMainTypeCode = MAIN_TYPE_MAP[retest.main_type] || 'D';

  // 1. 타입 변화 확인
  const typeChanged = original.main_type !== retest.main_type;
  let typeChangeDirection: 'improved' | 'worsened' | 'neutral' | undefined;

  if (typeChanged) {
    const originalPriority = TYPE_PRIORITY[originalMainTypeCode];
    const newPriority = TYPE_PRIORITY[newMainTypeCode];

    if (newPriority < originalPriority) {
      typeChangeDirection = 'improved'; // 더 안정적인 타입으로 변화
    } else if (newPriority > originalPriority) {
      typeChangeDirection = 'worsened'; // 더 불안정한 타입으로 변화
    } else {
      typeChangeDirection = 'neutral';
    }
  }

  // 2. 점수 변화 분석
  const scoreChanges = Object.keys(original.type_scores || {}).map((type) => {
    const originalScore = original.type_scores[type] || 0;
    const newScore = retest.type_scores[type] || 0;
    const change = newScore - originalScore;
    const changePercent =
      originalScore > 0 ? Math.round((change / originalScore) * 100) : 0;

    return {
      type,
      original: originalScore,
      new: newScore,
      change,
      changePercent,
    };
  });

  // 3. Confidence 변화
  const confidenceChange = {
    original: original.confidence,
    new: retest.confidence,
    change: retest.confidence - original.confidence,
  };

  // 4. 불균형 변화
  let imbalanceChange: ComparisonResult['imbalanceChange'] | undefined;
  if (original.imbalance_severity && retest.imbalance_severity) {
    const severityOrder = { none: 0, mild: 1, strong: 2 };
    const originalSeverity = severityOrder[original.imbalance_severity];
    const newSeverity = severityOrder[retest.imbalance_severity];
    const improved = newSeverity < originalSeverity;

    imbalanceChange = {
      original: original.imbalance_severity,
      new: retest.imbalance_severity,
      improved,
    };
  }

  // 5. 개선 포인트 분석
  const improvementPoints: string[] = [];
  const areasToFocus: string[] = [];

  // 타입이 개선된 경우
  if (typeChangeDirection === 'improved') {
    improvementPoints.push(
      `운동 패턴이 더 안정적인 "${retest.main_type}" 타입으로 변화했습니다.`
    );
  }

  // Confidence가 증가한 경우
  if (confidenceChange.change > 10) {
    improvementPoints.push(
      `검사 결과의 명확도가 ${confidenceChange.change}% 향상되었습니다.`
    );
  }

  // 불균형이 개선된 경우
  if (imbalanceChange?.improved) {
    improvementPoints.push(
      `불균형 강도가 "${imbalanceChange.original}"에서 "${imbalanceChange.new}"로 개선되었습니다.`
    );
  }

  // 점수가 크게 감소한 타입 (개선)
  scoreChanges.forEach((change) => {
    if (change.change < -5 && change.original > 10) {
      // 해당 타입의 점수가 크게 감소 = 개선
      const typeName = getTypeName(change.type);
      improvementPoints.push(`${typeName} 관련 점수가 ${Math.abs(change.change)}점 감소했습니다.`);
    }
  });

  // 점수가 크게 증가한 타입 (주의 필요)
  scoreChanges.forEach((change) => {
    if (change.change > 5 && change.new > 15) {
      const typeName = getTypeName(change.type);
      areasToFocus.push(
        `${typeName} 관련 점수가 ${change.change}점 증가했습니다. 추가 주의가 필요합니다.`
      );
    }
  });

  // 6. 전체 추세 판단
  let overallTrend: 'improved' | 'worsened' | 'stable' = 'stable';

  const improvementCount =
    (typeChangeDirection === 'improved' ? 1 : 0) +
    (confidenceChange.change > 5 ? 1 : 0) +
    (imbalanceChange?.improved ? 1 : 0) +
    scoreChanges.filter((c) => c.change < -3).length;

  const worseningCount =
    (typeChangeDirection === 'worsened' ? 1 : 0) +
    (confidenceChange.change < -5 ? 1 : 0) +
    (imbalanceChange && !imbalanceChange.improved ? 1 : 0) +
    scoreChanges.filter((c) => c.change > 5).length;

  if (improvementCount > worseningCount + 1) {
    overallTrend = 'improved';
  } else if (worseningCount > improvementCount + 1) {
    overallTrend = 'worsened';
  }

  // 7. 요약 생성
  const summary = generateSummary(
    typeChanged,
    typeChangeDirection,
    overallTrend,
    confidenceChange,
    improvementPoints.length,
    areasToFocus.length
  );

  return {
    typeChanged,
    originalMainType: original.main_type,
    newMainType: retest.main_type,
    typeChangeDirection,
    scoreChanges,
    confidenceChange,
    imbalanceChange,
    overallTrend,
    improvementPoints,
    areasToFocus,
    summary,
  };
}

/**
 * 타입 코드를 한글명으로 변환
 */
function getTypeName(typeCode: string): string {
  const names: Record<string, string> = {
    D: '담직형',
    N: '날림형',
    B: '버팀형',
    H: '흘림형',
  };
  return names[typeCode] || typeCode;
}

/**
 * 비교 결과 요약 생성
 */
function generateSummary(
  typeChanged: boolean,
  typeChangeDirection: 'improved' | 'worsened' | 'neutral' | undefined,
  overallTrend: 'improved' | 'worsened' | 'stable',
  confidenceChange: { original: number; new: number; change: number },
  improvementCount: number,
  focusCount: number
): string {
  const parts: string[] = [];

  if (typeChanged) {
    if (typeChangeDirection === 'improved') {
      parts.push('운동 패턴이 더 안정적인 방향으로 변화했습니다.');
    } else if (typeChangeDirection === 'worsened') {
      parts.push('운동 패턴에 변화가 있습니다. 지속적인 관찰이 필요합니다.');
    } else {
      parts.push('운동 패턴 타입이 변경되었습니다.');
    }
  }

  if (confidenceChange.change > 10) {
    parts.push('검사 결과의 명확도가 크게 향상되었습니다.');
  } else if (confidenceChange.change < -10) {
    parts.push('검사 결과의 명확도가 다소 감소했습니다.');
  }

  if (overallTrend === 'improved') {
    parts.push('전반적으로 개선된 모습을 보입니다.');
  } else if (overallTrend === 'worsened') {
    parts.push('일부 영역에서 주의가 필요합니다.');
  } else {
    parts.push('전반적으로 안정적인 상태를 유지하고 있습니다.');
  }

  if (improvementCount > 0) {
    parts.push(`${improvementCount}가지 개선 사항이 확인되었습니다.`);
  }

  if (focusCount > 0) {
    parts.push(`${focusCount}가지 영역에 추가 집중이 필요합니다.`);
  }

  return parts.join(' ') || '재검사 결과를 확인했습니다.';
}

/**
 * 비교 리포트 생성 (상세)
 */
export interface ComparisonReport {
  comparison: ComparisonResult;
  recommendations: string[];
  nextSteps: string[];
}

export function generateComparisonReport(
  original: TestResultData,
  retest: TestResultData
): ComparisonReport {
  const comparison = compareTestResults(original, retest);

  const recommendations: string[] = [];
  const nextSteps: string[] = [];

  // 개선된 경우
  if (comparison.overallTrend === 'improved') {
    recommendations.push('현재 운동 루틴을 지속적으로 수행하세요.');
    recommendations.push('정기적인 재검사로 변화를 추적하세요.');
    nextSteps.push('7일 후 다시 재검사를 받아 지속적인 개선을 확인하세요.');
  }

  // 악화된 경우
  if (comparison.overallTrend === 'worsened') {
    recommendations.push('운동 루틴을 재검토하고 필요시 조정하세요.');
    recommendations.push('일상 생활 습관을 점검하세요.');
    nextSteps.push('코치와 상담하여 운동 루틴을 개선하세요.');
  }

  // 주의 영역이 있는 경우
  if (comparison.areasToFocus.length > 0) {
    recommendations.push('특정 영역에 집중한 운동을 추가하세요.');
    nextSteps.push('새로운 맞춤 운동 루틴을 생성하세요.');
  }

  // 불균형이 개선되지 않은 경우
  if (
    comparison.imbalanceChange &&
    !comparison.imbalanceChange.improved &&
    comparison.imbalanceChange.new !== 'none'
  ) {
    recommendations.push('불균형 교정 운동에 더 집중하세요.');
  }

  return {
    comparison,
    recommendations: recommendations.length > 0 ? recommendations : ['현재 루틴을 계속 수행하세요.'],
    nextSteps: nextSteps.length > 0 ? nextSteps : ['정기적인 재검사로 변화를 추적하세요.'],
  };
}
