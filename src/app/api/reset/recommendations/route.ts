/**
 * PR-RESET-BE-02 — GET /api/reset/recommendations
 * Read-only; readiness 소비만(판정 순서 변경 없음).
 */
import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import type { SessionReadinessResultSummary } from '@/lib/readiness/types';
import { getSessionReadiness } from '@/lib/readiness/get-session-readiness';
import { buildResetRecommendationPayload } from '@/lib/reset/recommend-reset';
import type { ResetRecommendationPatternInput } from '@/lib/reset/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);

    if (!userId) {
      return ok(
        buildResetRecommendationPayload({
          pattern: null,
          metaSource: 'fallback',
          resultSummarySourceMode: null,
        })
      );
    }

    const readiness = await getSessionReadiness(userId);
    const summary = readiness.result_summary ?? null;

    if (!summary) {
      return ok(
        buildResetRecommendationPayload({
          pattern: null,
          metaSource: 'fallback',
          resultSummarySourceMode: null,
        })
      );
    }

    const pattern = mapSummaryToPattern(summary);

    return ok(
      buildResetRecommendationPayload({
        pattern,
        metaSource: 'readiness',
        resultSummarySourceMode: summary.source_mode,
      })
    );
  } catch (err) {
    console.error('[GET /api/reset/recommendations]', err);
    return fail(
      500,
      ApiErrorCode.INTERNAL_ERROR,
      '리셋 추천 조회 중 오류가 발생했습니다.'
    );
  }
}

function mapSummaryToPattern(
  summary: SessionReadinessResultSummary
): ResetRecommendationPatternInput {
  return {
    primary_type: summary.primary_type,
    secondary_type: summary.secondary_type ?? null,
    priority_vector: summary.priority_vector,
    pain_mode: summary.pain_mode ?? null,
  };
}
