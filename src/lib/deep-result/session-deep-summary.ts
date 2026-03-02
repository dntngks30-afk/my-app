/**
 * session-deep-summary.ts
 *
 * Path B 세션 레일 전용: Deep v2 "최종 결과 요약"을 조회하는 read-only helper.
 *
 * 책임:
 *   - deep_test_attempts 테이블에서 사용자의 최신 final attempt를 조회
 *   - result_type / confidence / focus_tags / avoid_tags / scoring_version 반환
 *   - 결과 없으면 null 반환 (호출 측에서 404 처리)
 *
 * 금지:
 *   - 무거운 알고리즘 재계산 금지 (이미 finalize 시 저장된 값 사용)
 *   - 템플릿 fetch / media sign 금지
 *   - 기존 7일 테이블(routine_*, deep_test_attempts 외) 접근 금지
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type DeepConfidenceLabel = 'high' | 'mid' | 'low';

export interface SessionDeepSummary {
  resultType: string;               // 예: 'LOWER-LIMB', 'LUMBO-PELVIS', 'STABLE' 등
  confidenceRaw: number;            // 0~1 float (DB 저장값)
  confidence: DeepConfidenceLabel;  // 'high'|'mid'|'low' (UI/테마 결정용)
  focusTags: string[];              // 예: ['glute_activation', 'lower_chain_stability']
  avoidTags: string[];              // 예: ['knee_load', 'deep_squat']
  scoringVersion: string;           // 예: 'deep_v2'
}

/**
 * DB rows 중 scores.derived에서 focus_tags/avoid_tags를 안전하게 추출
 */
function extractTags(scores: unknown): { focusTags: string[]; avoidTags: string[] } {
  if (!scores || typeof scores !== 'object') return { focusTags: [], avoidTags: [] };
  const s = scores as Record<string, unknown>;
  const derived = s.derived as Record<string, unknown> | undefined;
  if (!derived || typeof derived !== 'object') return { focusTags: [], avoidTags: [] };

  const focusTags = Array.isArray(derived.focus_tags)
    ? (derived.focus_tags as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const avoidTags = Array.isArray(derived.avoid_tags)
    ? (derived.avoid_tags as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  return { focusTags, avoidTags };
}

/**
 * 0~1 float → 'high'|'mid'|'low'
 * - >= 0.75: high
 * - >= 0.50: mid
 * - < 0.50: low
 */
function toConfidenceLabel(raw: number | null): DeepConfidenceLabel {
  if (raw === null || raw === undefined) return 'low';
  if (raw >= 0.75) return 'high';
  if (raw >= 0.5) return 'mid';
  return 'low';
}

/**
 * 사용자의 최신 final Deep v2 결과 요약을 반환.
 * 없으면 null 반환.
 *
 * 성능 가드:
 *   - SELECT 필드 최소화 (id, result_type, confidence, scores, scoring_version, updated_at)
 *   - LIMIT 1 + ORDER BY updated_at DESC
 *   - 알고리즘/계산 없음 (DB 저장값 그대로 사용)
 */
export async function loadSessionDeepSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionDeepSummary | null> {
  const { data, error } = await supabase
    .from('deep_test_attempts')
    .select('result_type, confidence, scores, scoring_version, updated_at')
    .eq('user_id', userId)
    .eq('scoring_version', 'deep_v2')
    .eq('status', 'final')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[session-deep-summary] query error', error);
    return null;
  }
  if (!data) return null;

  const { focusTags, avoidTags } = extractTags(data.scores);
  const confidenceRaw = typeof data.confidence === 'number' ? data.confidence : 0;

  return {
    resultType: typeof data.result_type === 'string' ? data.result_type : 'UNKNOWN',
    confidenceRaw,
    confidence: toConfidenceLabel(confidenceRaw),
    focusTags,
    avoidTags,
    scoringVersion: typeof data.scoring_version === 'string' ? data.scoring_version : 'deep_v2',
  };
}
