/**
 * PR-FLOW-06 — UnifiedDeepResultV2 → 세션 준비용 최소 요약 (표현만, 재해석 없음)
 */

import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';
import type { PublicResultStageLabel, SessionReadinessResultSummary } from './types';

/**
 * 클레임된 공개 결과 한 건에서 readiness용 최소 요약만 추출한다.
 * source_mode에는 DB result_stage(baseline|refined)를 넣는다 (V2의 source_mode와 혼동 금지).
 */
export function extractSessionReadinessResultSummary(
  publicStage: PublicResultStageLabel,
  result: UnifiedDeepResultV2
): SessionReadinessResultSummary {
  const pv = result.priority_vector;
  const priority_vector =
    pv && typeof pv === 'object' && !Array.isArray(pv)
      ? Object.keys(pv).sort()
      : undefined;

  return {
    source_mode: publicStage,
    primary_type: result.primary_type,
    secondary_type: result.secondary_type ?? null,
    priority_vector,
    pain_mode: result.pain_mode ?? null,
  };
}
