/**
 * FLOW-02 — Public Result Read API
 *
 * GET /api/public-results/[id]
 *
 * 저장된 public result를 id로 조회한다.
 * 인증 불필요 — UUID obscurity 기반 접근 (public-first 설계).
 *
 * ─── 요청 계약 ──────────────────────────────────────────────────────────────
 * GET /api/public-results/{id}?anonId={optional}
 *
 * path param:
 *   id      : string (UUID) — public_results.id
 *
 * query param (선택):
 *   anonId  : string — advisory anon hint. 현재 접근 제한에 사용 안 함.
 *
 * ─── 응답 계약 ──────────────────────────────────────────────────────────────
 * 200 OK:
 * {
 *   success: true,
 *   id: string (UUID),
 *   anonId: string,
 *   stage: 'baseline' | 'refined',
 *   result: UnifiedDeepResultV2,
 *   createdAt: string (ISO),
 *   isClaimed: boolean
 * }
 *
 * ─── 에러 응답 ──────────────────────────────────────────────────────────────
 * 400: id 누락 / 포맷 오류
 * 404: 결과 없음
 * 500: DB 조회 실패 / 페이로드 무결성 오류
 *
 * ─── 소유권 전략 ─────────────────────────────────────────────────────────────
 * - UUID id 자체가 접근 키 (추측 불가 수준)
 * - anonId는 advisory hint (로그/FLOW-05 claim 준비용)
 * - FLOW-05에서 claim 시 anon_id ↔ user_id 검증 추가 예정
 *
 * ─── FLOW 경계 ──────────────────────────────────────────────────────────────
 * - 이 라우트는 READ만 담당
 * - POST(create)는 route.ts (FLOW-01) 범위
 * - claim/patch는 FLOW-05 범위
 *
 * @see src/lib/public-results/getPublicResult.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicResult,
  PublicResultNotFoundError,
  PublicResultInvalidPayloadError,
} from '@/lib/public-results/getPublicResult';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        { error: 'id가 필요합니다.' },
        { status: 400 }
      );
    }

    // 간단한 UUID 포맷 체크 (완전 검증 아님, 서버 로직에서 Not Found로 처리됨)
    const trimmedId = id.trim();
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(trimmedId)) {
      return NextResponse.json(
        { error: '유효하지 않은 id 포맷입니다.' },
        { status: 400 }
      );
    }

    // anonId advisory hint (선택)
    const anonId = request.nextUrl.searchParams.get('anonId') ?? null;

    const output = await getPublicResult({ id: trimmedId, anonId });

    return NextResponse.json({
      success:   true,
      id:        output.id,
      anonId:    output.anonId,
      stage:     output.stage,
      result:    output.result,
      createdAt: output.createdAt,
      isClaimed: output.isClaimed,
    });
  } catch (error) {
    if (error instanceof PublicResultNotFoundError) {
      return NextResponse.json(
        { error: '결과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (error instanceof PublicResultInvalidPayloadError) {
      console.error('[/api/public-results/[id]] payload 무결성 오류:', error);
      return NextResponse.json(
        { error: '저장된 결과 데이터에 문제가 있습니다.' },
        { status: 500 }
      );
    }

    console.error('[/api/public-results/[id]] GET error:', error);
    return NextResponse.json(
      { error: '결과 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
