/**
 * PR-6: 카메라 결과 → 사용자용 설명 브릿지
 * - 실제 신호 기반, 비의료 언어
 * - 1~2개 핵심 이유 + 다음 행동 제안
 */
import type { NormalizedCameraResult } from './normalize';
import type { EvaluatorMetric } from './evaluators/types';

export interface ResultBridgeExplanation {
  headline: string;
  explanation: string;
  reasons: string[];
  action: string;
  primaryCtaLabel: string;
  primaryCtaPath: string;
}

const METRIC_TO_REASON: Record<string, string> = {
  depth: '깊이 구간이 충분히 확보되지 않았어요',
  arm_range: '팔을 올리는 구간이 충분히 확보되지 않았어요',
  lumbar_extension: '동작 중 몸통 보상이 함께 나타났어요',
  trunk_lean: '상체가 과하게 숙이는 경향이 보였어요',
  knee_alignment_trend: '하단 자세에서 무릎 정렬이 조금 불안정했어요',
  sway: '하단 자세에서 안정성이 조금 부족했어요',
};

const MOVEMENT_TYPE_HEADLINES: Record<string, string> = {
  kangaroo: '허리 쪽이 먼저 개입하는 패턴이 보여요',
  hedgehog: '상체 가동성이 다소 제한된 패턴이 보여요',
  crab: '좌우 균형이 조금 불균형한 패턴이 보여요',
  monkey: '전반적으로 균형이 잘 잡힌 패턴이 보여요',
};

function getConcernReasons(metrics: EvaluatorMetric[]): string[] {
  const reasons: string[] = [];
  for (const m of metrics) {
    if (m.trend === 'concern' && m.name && METRIC_TO_REASON[m.name]) {
      const msg = METRIC_TO_REASON[m.name];
      if (!reasons.includes(msg)) reasons.push(msg);
    }
  }
  return reasons.slice(0, 2);
}

function getExplanationFromResults(
  result: NormalizedCameraResult
): string {
  const valid = result.evaluatorResults?.filter((r) => !r.insufficientSignal) ?? [];
  if (valid.length === 0) return result.patternSummary;

  const hasSquat = valid.some((r) => r.stepId === 'squat');
  const hasOverhead = valid.some((r) => r.stepId === 'overhead-reach');
  const parts: string[] = [];

  if (hasSquat && hasOverhead) {
    parts.push('스쿼트와 팔 올리기 동작에서');
  } else if (hasSquat) {
    parts.push('스쿼트 동작에서');
  } else if (hasOverhead) {
    parts.push('팔 올리기 동작에서');
  }

  const concernMetrics = valid.flatMap((r) => r.metrics ?? []).filter((m) => m.trend === 'concern');
  const armRange = concernMetrics.find((m) => m.name === 'arm_range');
  const lumbar = concernMetrics.find((m) => m.name === 'lumbar_extension');
  const depth = concernMetrics.find((m) => m.name === 'depth');
  const trunk = concernMetrics.find((m) => m.name === 'trunk_lean');

  if (armRange) parts.push('팔을 끝까지 올리는 구간');
  if (lumbar) parts.push('몸통 보상 패턴');
  if (depth) parts.push('앉는 깊이');
  if (trunk) parts.push('상체 기울기');
  if (parts.length > 1) {
    return `${parts.slice(0, 2).join('과 ')}이 함께 보였습니다.`;
  }
  if (parts.length === 1) {
    return `${parts[0]}이 보였습니다.`;
  }

  return result.patternSummary;
}

/**
 * NormalizedCameraResult → 사용자용 설명 브릿지
 */
export function getResultBridgeExplanation(
  result: NormalizedCameraResult
): ResultBridgeExplanation {
  if (result.insufficientSignal || result.captureQuality === 'invalid') {
    return {
      headline: '촬영 신호가 충분하지 않았어요',
      explanation: result.patternSummary,
      reasons: [],
      action: result.resetAction,
      primaryCtaLabel: '다시 촬영하기',
      primaryCtaPath: '/movement-test/camera',
    };
  }

  const allMetrics = (result.evaluatorResults ?? []).flatMap((r) => r.metrics ?? []);
  const reasons = getConcernReasons(allMetrics);
  const headline = MOVEMENT_TYPE_HEADLINES[result.movementType] ?? '움직임 패턴이 확인되었어요';
  const explanation = getExplanationFromResults(result);

  return {
    headline,
    explanation,
    reasons,
    action: result.resetAction,
    primaryCtaLabel: '리셋부터 시작하기',
    primaryCtaPath: '/app/auth?next=/app/home',
  };
}
