/**
 * FLOW-05 — Public Result Claim API
 *
 * POST /api/public-results/[id]/claim
 *
 * anon-owned public result를 인증된 사용자에게 귀속시킨다.
 * 인증 필수 — Bearer token.
 *
 * ─── 요청 계약 ──────────────────────────────────────────────────────────────
 * POST /api/public-results/{id}/claim
 *
 * Body (선택):
 * {
 *   anonId?: string  — advisory anon hint
 * }
 *
 * ─── 응답 계약 ──────────────────────────────────────────────────────────────
 * 200 OK (신규 claim):
 * { success: true, outcome: 'claimed', id, userId, stage, claimedAt }
 *
 * 200 OK (멱등 - 동일 사용자 재claim):
 * { success: true, outcome: 'already_owned', id, userId, stage, claimedAt }
 *
 * ─── 에러 응답 ──────────────────────────────────────────────────────────────
 * 401: 인증 없음
 * 400: id 포맷 오류
 * 404: 결과 없음
 * 409: 다른 사용자가 이미 claim
 * 500: DB 오류
 *
 * ─── FLOW-06/07 경계 ────────────────────────────────────────────────────────
 * - 이 라우트는 claim(소유권 attach)만 담당
 * - session create는 FLOW-06 범위
 * - readiness 확인은 FLOW-07 범위
 *
 * @see src/lib/public-results/claimPublicResult.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { logAnalyticsEvent } from '@/lib/analytics/logAnalyticsEvent';
import {
  claimPublicResult,
  ClaimNotFoundError,
  ClaimConflictError,
} from '@/lib/public-results/claimPublicResult';
import { linkPublicTestRunToUserByPublicResult } from '@/lib/public-test-runs/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 필수
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 2. path param 검증
    const { id } = await params;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        { error: 'id가 필요합니다.' },
        { status: 400 }
      );
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id.trim())) {
      return NextResponse.json(
        { error: '유효하지 않은 id 포맷입니다.' },
        { status: 400 }
      );
    }

    // 3. body (선택)
    let anonId: string | null = null;
    try {
      const body = await request.json() as { anonId?: unknown };
      if (typeof body.anonId === 'string') anonId = body.anonId;
    } catch {
      // body 없음도 허용
    }

    // 4. claim 실행
    const output = await claimPublicResult({
      publicResultId: id.trim(),
      userId,
      anonId,
    });

    try {
      const linkOutcome = await linkPublicTestRunToUserByPublicResult({
        publicResultId: output.id,
        userId,
        claimedAtIso: output.claimedAt,
      });

      if (!linkOutcome.ok) {
        console.warn('[public-test-runs] claim user link skipped', linkOutcome.reason);
      }
    } catch (error) {
      console.warn('[public-test-runs] failed to link user_id after claim', error);
    }

    void logAnalyticsEvent({
      event_name: 'public_result_claim_success',
      user_id: userId,
      anon_id: anonId,
      public_result_id: output.id,
      route_path: '/api/public-results/[id]/claim',
      route_group: 'public_result_claim',
      dedupe_key: `public_result_claim_success:${userId}:${output.id}`,
      props: {
        public_result_id: output.id,
        outcome: output.outcome,
        anon_id_present: Boolean(anonId),
      },
    });

    return NextResponse.json({
      success:   true,
      outcome:   output.outcome,
      id:        output.id,
      userId:    output.userId,
      stage:     output.stage,
      claimedAt: output.claimedAt,
    });
  } catch (error) {
    if (error instanceof ClaimNotFoundError) {
      return NextResponse.json(
        { error: 'claim 대상 결과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (error instanceof ClaimConflictError) {
      return NextResponse.json(
        { error: '이 결과는 이미 다른 사용자에 의해 claim되어 있습니다.' },
        { status: 409 }
      );
    }

    console.error('[/api/public-results/[id]/claim] POST error:', error);
    return NextResponse.json(
      { error: 'claim 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
