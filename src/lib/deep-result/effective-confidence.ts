/**
 * effective_confidence SSOT helper (PR-P1-2)
 *
 * Consumer는 이 함수 결과만 사용. confidence 재계산 금지.
 * - new-style: confidence_breakdown.final_confidence
 * - old-style: legacy confidence fallback
 */

import type { ConfidenceBreakdown } from '@/lib/deep-test/types';

/** attempt 또는 derived 형태. confidence + optional confidence_breakdown */
export interface ConfidenceSource {
  confidence?: number | null;
  confidence_breakdown?: ConfidenceBreakdown | null;
  /** scores.derived.explainability.confidence_breakdown 등 중첩 지원 */
  explainability?: { confidence_breakdown?: ConfidenceBreakdown } | null;
}

/**
 * attempt(scores+confidence) 또는 derived에서 ConfidenceSource 추출
 */
export function toConfidenceSource(
  attempt: { confidence?: number | null; scores?: { derived?: Record<string, unknown> } } | null | undefined
): ConfidenceSource {
  if (!attempt) return {};
  const derived = attempt.scores?.derived as Record<string, unknown> | undefined;
  const expl = derived?.explainability as { confidence_breakdown?: ConfidenceBreakdown } | undefined;
  const breakdown = (derived?.confidence_breakdown ?? expl?.confidence_breakdown) as
    | ConfidenceBreakdown
    | undefined;
  return {
    confidence: attempt.confidence ?? undefined,
    confidence_breakdown: breakdown ?? undefined,
    explainability: expl ?? undefined,
  };
}

/**
 * demo derived (localStorage) 전용
 */
export function toConfidenceSourceFromDerived(
  derived: Record<string, unknown> | null | undefined
): ConfidenceSource {
  if (!derived || typeof derived !== 'object') return {};
  const expl = derived.explainability as { confidence_breakdown?: ConfidenceBreakdown } | undefined;
  const breakdown = (derived.confidence_breakdown ?? expl?.confidence_breakdown) as
    | ConfidenceBreakdown
    | undefined;
  return {
    confidence: typeof derived.confidence === 'number' ? derived.confidence : undefined,
    confidence_breakdown: breakdown ?? undefined,
    explainability: expl ?? undefined,
  };
}

/**
 * SSOT: UI/summary/session consumer가 사용할 최종 confidence.
 * B안: confidence 유지, effective_confidence 추가. consumer는 effective_confidence만 사용.
 */
export function getEffectiveConfidence(source: ConfidenceSource | null | undefined): number {
  if (!source) return 0;
  const breakdown =
    source.confidence_breakdown ??
    source.explainability?.confidence_breakdown;
  const final = typeof breakdown?.final_confidence === 'number' ? breakdown.final_confidence : null;
  if (final != null && !Number.isNaN(final)) return Math.max(0, Math.min(1, final));
  const legacy = typeof source.confidence === 'number' ? source.confidence : null;
  if (legacy != null && !Number.isNaN(legacy)) return Math.max(0, Math.min(1, legacy));
  return 0;
}
