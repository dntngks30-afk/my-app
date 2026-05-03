/**
 * FLOW-01 — Public Result Persistence API
 *
 * POST /api/public-results
 *
 * Public 분석 결과(baseline / refined)를 DB에 저장한다.
 * 인증 불필요 — anon_id 기반 소유권.
 * 인증된 사용자가 있으면 user_id도 첨부 (선택적).
 *
 * ─── 요청 계약 ──────────────────────────────────────────────────────────────
 * {
 *   anonId:       string (필수) — client localStorage UUID
 *   result:       UnifiedDeepResultV2 (필수) — Deep Result V2 contract
 *   stage:        'baseline' | 'refined' (필수)
 *   sourceInputs?: string[] (선택) — ['free_survey'] | ['free_survey','camera'] 등
 * }
 *
 * ─── 응답 계약 ──────────────────────────────────────────────────────────────
 * 201 Created:
 * {
 *   success: true,
 *   id: string (UUID),
 *   anonId: string,
 *   stage: string,
 *   createdAt: string (ISO)
 * }
 *
 * ─── 에러 응답 ──────────────────────────────────────────────────────────────
 * 400: 필수 필드 누락 / Deep Result V2 계약 위반
 * 500: DB write 실패
 *
 * ─── 보안 ────────────────────────────────────────────────────────────────────
 * - 인증 불필요 (public-first 설계)
 * - 인증된 경우 user_id 첨부 (선택)
 * - 결과는 서버에서 Deep Result V2 계약 검증 후 저장
 *
 * ─── FLOW-02/05 경계 ────────────────────────────────────────────────────────
 * - 이 라우트는 CREATE만 담당
 * - GET/read는 FLOW-02에서 추가
 * - claim은 FLOW-05에서 추가
 *
 * @see src/lib/public-results/createPublicResult.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import {
  createPublicResult,
  PublicResultValidationError,
} from '@/lib/public-results/createPublicResult';
import { linkPublicTestProfileToResult } from '@/lib/analytics/public-test-profile';
import { linkPublicTestRunToResult } from '@/lib/public-test-runs/server';
import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      anonId?: unknown;
      result?: unknown;
      stage?: unknown;
      sourceInputs?: unknown;
      publicTestRunId?: unknown;
      publicTestRunAnonId?: unknown;
    };

    const { anonId, result, stage, sourceInputs, publicTestRunId, publicTestRunAnonId } =
      body;

    // 필수 필드 검증
    if (!anonId || typeof anonId !== 'string' || anonId.trim() === '') {
      return NextResponse.json(
        { error: 'anonId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return NextResponse.json(
        { error: 'result 객체가 필요합니다.' },
        { status: 400 }
      );
    }

    if (stage !== 'baseline' && stage !== 'refined') {
      return NextResponse.json(
        { error: "stage는 'baseline' 또는 'refined'여야 합니다." },
        { status: 400 }
      );
    }

    const resolvedSourceInputs: string[] | undefined =
      Array.isArray(sourceInputs)
        ? sourceInputs.filter((s): s is string => typeof s === 'string')
        : undefined;

    // 인증 사용자 선택적 첨부 (있으면 user_id에 기록, 없으면 null)
    const userId = await getCurrentUserId(request).catch(() => null);

    // 저장 (Deep Result V2 계약 검증 포함)
    const trimmedAnonId = anonId.trim();
    const output = await createPublicResult({
      result: result as UnifiedDeepResultV2,
      anonId: trimmedAnonId,
      stage,
      userId,
      sourceInputs: resolvedSourceInputs,
    });

    try {
      if (trimmedAnonId && output?.id) {
        await linkPublicTestProfileToResult({
          anonId: trimmedAnonId,
          publicResultId: output.id,
        });
      }
    } catch (error) {
      console.warn('[public-test-profile] failed to link public_result_id', error);
    }

    try {
      if (
        typeof publicTestRunId === 'string' &&
        typeof publicTestRunAnonId === 'string' &&
        publicTestRunAnonId.trim() === trimmedAnonId &&
        output?.id
      ) {
        await linkPublicTestRunToResult({
          runId: publicTestRunId,
          anonId: trimmedAnonId,
          publicResultId: output.id,
          resultStage: stage,
        });
      }
    } catch (error) {
      console.warn('[public-test-runs] failed to link public_result_id', error);
    }

    return NextResponse.json(
      {
        success: true,
        id: output.id,
        anonId: output.anonId,
        stage: output.stage,
        createdAt: output.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PublicResultValidationError) {
      return NextResponse.json(
        { error: 'Deep Result V2 계약 위반입니다.', details: error.message },
        { status: 400 }
      );
    }

    console.error('[/api/public-results] POST error:', error);
    return NextResponse.json(
      { error: '결과 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
