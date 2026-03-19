/**
 * FLOW-07 — Canonical User Readiness API
 *
 * GET /api/readiness
 *
 * 현재 인증 사용자의 canonical 실행 준비 상태를 반환한다.
 * FLOW-08에서 /app entry 리와이어링의 기반으로 사용됨.
 *
 * ─── 요청 계약 ──────────────────────────────────────────────────────────────
 * GET /api/readiness
 * Authorization: Bearer <token>
 *
 * ─── 응답 계약 ──────────────────────────────────────────────────────────────
 * 200 OK (인증됨):
 * {
 *   ok: true,
 *   data: CanonicalUserReadiness
 * }
 *
 * 200 OK (미인증 - unauthenticated readiness 반환):
 * {
 *   ok: true,
 *   data: UNAUTHENTICATED_READINESS
 * }
 *
 * 500: 서버 오류
 *
 * ─── 미인증 처리 전략 ────────────────────────────────────────────────────────
 * - 401을 반환하는 대신 unauthenticated readiness 객체를 반환한다.
 * - FLOW-08 /app entry에서 로그인 여부와 무관하게 단일 패턴으로 소비 가능.
 * - next_action.code === 'login' → 로그인 유도.
 *
 * ─── FLOW-08 경계 ─────────────────────────────────────────────────────────
 * - 이 라우트는 READ ONLY.
 * - /app entry 리와이어링은 FLOW-08.
 *
 * @see src/lib/readiness/getCanonicalUserReadiness.ts
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import {
  getCanonicalUserReadiness,
  UNAUTHENTICATED_READINESS,
} from '@/lib/readiness/getCanonicalUserReadiness';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);

    // 미인증: unauthenticated readiness 반환 (401 아님)
    if (!userId) {
      return ok(UNAUTHENTICATED_READINESS);
    }

    const readiness = await getCanonicalUserReadiness(userId);
    return ok(readiness);
  } catch (err) {
    console.error('[GET /api/readiness]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '준비 상태 조회 중 오류가 발생했습니다.');
  }
}
