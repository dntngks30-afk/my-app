/**
 * Evaluator 결과 → 정규화된 result schema
 * result consumer와 호환
 */
import type { EvaluatorResult } from './evaluators/types';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface NormalizedCameraResult {
  movementType: string;
  patternSummary: string;
  avoidItems: string[];
  resetAction: string;
  confidence: ConfidenceLevel;
  insufficientSignal: boolean;
  evaluatorResults: EvaluatorResult[];
}

const INSUFFICIENT_RESULT: NormalizedCameraResult = {
  movementType: 'unknown',
  patternSummary: '촬영 데이터가 부족하여 분석할 수 없습니다.',
  avoidItems: [],
  resetAction: '설문형 테스트를 시도해 보세요.',
  confidence: 'low',
  insufficientSignal: true,
  evaluatorResults: [],
};

/** concern 비율 기반 movement type 매핑 */
function inferMovementType(results: EvaluatorResult[]): string {
  const allMetrics = results.flatMap((r) => r.metrics);
  const concerns = allMetrics.filter((m) => m.trend === 'concern');
  const concernRatio = allMetrics.length > 0 ? concerns.length / allMetrics.length : 0;

  if (concernRatio >= 0.6) return 'kangaroo';
  if (concernRatio >= 0.4) return 'hedgehog';
  if (concernRatio >= 0.2) return 'crab';
  return 'monkey';
}

/** concern 메트릭 → avoid item */
function toAvoidItems(results: EvaluatorResult[]): string[] {
  const items: string[] = [];
  for (const r of results) {
    for (const m of r.metrics) {
      if (m.trend === 'concern') {
        if (m.name === 'depth') items.push('스쿼트 깊이 부족');
        else if (m.name === 'knee_alignment_trend') items.push('무릎 정렬 주의');
        else if (m.name === 'trunk_lean') items.push('상체 기울기');
        else if (m.name === 'arm_range') items.push('팔 가동 범위 제한');
        else if (m.name === 'sway') items.push('한발 서기 흔들림');
      }
    }
  }
  return [...new Set(items)].slice(0, 2);
}

/** reset action 추천 */
function toResetAction(results: EvaluatorResult[]): string {
  const hasSquat = results.some((r) => r.stepId === 'squat' && !r.insufficientSignal);
  const hasWallAngel = results.some((r) => r.stepId === 'wall-angel' && !r.insufficientSignal);
  const hasBalance = results.some((r) => r.stepId === 'single-leg-balance' && !r.insufficientSignal);

  if (hasSquat) return '벽에 등을 대고 천천히 스쿼트 5회 반복해 보세요.';
  if (hasWallAngel) return '문틀에 팔을 걸고 가슴만 앞으로 20초, 2번 해 보세요.';
  if (hasBalance) return '한발로 10초 서기, 좌우 번갈아 연습해 보세요.';
  return '설문형 테스트로 더 정확한 분석을 받아 보세요.';
}

export function normalizeCameraResult(evaluatorResults: EvaluatorResult[]): NormalizedCameraResult {
  const anyInsufficient = evaluatorResults.some((r) => r.insufficientSignal);
  const validResults = evaluatorResults.filter((r) => !r.insufficientSignal);

  if (anyInsufficient && validResults.length < 2) {
    return {
      ...INSUFFICIENT_RESULT,
      evaluatorResults,
    };
  }

  const movementType = inferMovementType(validResults);
  const avoidItems = toAvoidItems(validResults);
  const resetAction = toResetAction(validResults);

  const concernCount = validResults.flatMap((r) => r.metrics).filter((m) => m.trend === 'concern').length;
  const totalMetrics = validResults.flatMap((r) => r.metrics).length;
  const confidence: ConfidenceLevel =
    totalMetrics >= 6 && concernCount > 0 ? 'high' : totalMetrics >= 3 ? 'medium' : 'low';

  const patternSummary =
    validResults.length >= 3
      ? '3가지 동작 분석을 바탕으로 움직임 패턴을 확인했습니다.'
      : `${validResults.length}개 동작 분석 결과입니다.`;

  return {
    movementType,
    patternSummary,
    avoidItems,
    resetAction,
    confidence,
    insufficientSignal: false,
    evaluatorResults,
  };
}
