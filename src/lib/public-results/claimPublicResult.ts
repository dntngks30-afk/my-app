/**
 * FLOW-05 — Public Result Claim Utility (server-side)
 *
 * anon-owned public result를 인증된 사용자에게 귀속(claim)시킨다.
 * service_role(getServerSupabaseAdmin)을 통해 실행.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - 이 파일은 소유권 attach(claim)만 담당한다.
 * - READ는 getPublicResult.ts (FLOW-02) 범위.
 * - session create는 FLOW-06 범위.
 *
 * ─── Claim 규칙 (SSOT) ──────────────────────────────────────────────────────
 * 성공 조건:
 *   1. row 존재
 *   2. user_id IS NULL (미claim) → user_id = 요청자, claimed_at = now()
 *   3. user_id = 요청자 (이미 동일 사용자가 claim) → 멱등 성공 반환
 *
 * anon_id 검증 (선택):
 *   - anonId가 전달되고 stored anon_id와 일치 → 추가 신뢰
 *   - anonId가 전달되고 불일치 → WARN 후 claim 허용
 *     (id 자체가 UUID obscurity로 충분, anon_id는 advisory)
 *
 * 실패 조건:
 *   - row 없음 → ClaimNotFoundError
 *   - user_id ≠ null AND user_id ≠ 요청자 → ClaimConflictError
 *
 * ─── FLOW-06/07 준비 ────────────────────────────────────────────────────────
 * - claimed_at: session create에서 "결과가 user에 귀속됨" 확인용
 * - returned id/userId/stage: FLOW-06에서 session generation input으로 사용 가능
 *
 * @see supabase/migrations/202603270000_flow01_public_results.sql
 * @see src/lib/public-results/getPublicResult.ts
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface ClaimPublicResultInput {
  /** public_results.id (UUID) */
  publicResultId: string;
  /** 요청 인증 사용자 id */
  userId: string;
  /** 선택적 anon hint (advisory; 불일치 시 warn만) */
  anonId?: string | null;
}

export type ClaimPublicResultOutcome =
  | 'claimed'       // 새로 claim 완료
  | 'already_owned' // 동일 사용자가 이미 claim한 상태 (멱등)

export interface ClaimPublicResultOutput {
  outcome: ClaimPublicResultOutcome;
  id: string;
  userId: string;
  stage: string;
  claimedAt: string;
}

export class ClaimNotFoundError extends Error {
  constructor(id: string) {
    super(`claim 대상 public result를 찾을 수 없습니다: ${id}`);
    this.name = 'ClaimNotFoundError';
  }
}

export class ClaimConflictError extends Error {
  constructor(id: string) {
    super(`이 public result는 다른 사용자에 의해 이미 claim되어 있습니다: ${id}`);
    this.name = 'ClaimConflictError';
  }
}

// ─── Claim 함수 ───────────────────────────────────────────────────────────────

/**
 * claimPublicResult — public result 소유권을 인증된 사용자에게 귀속
 *
 * @throws {ClaimNotFoundError} id에 해당하는 row가 없을 때
 * @throws {ClaimConflictError} 다른 사용자가 이미 claim한 경우
 * @throws {Error} DB 조회/업데이트 실패 시
 */
export async function claimPublicResult(
  input: ClaimPublicResultInput
): Promise<ClaimPublicResultOutput> {
  const { publicResultId, userId, anonId } = input;

  if (!publicResultId || typeof publicResultId !== 'string' || publicResultId.trim() === '') {
    throw new Error('publicResultId는 필수입니다.');
  }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('userId는 필수입니다.');
  }

  const trimmedId = publicResultId.trim();
  const supabase = getServerSupabaseAdmin();

  // 현재 row 조회 (user_id, claimed_at, anon_id, result_stage)
  const { data: row, error: fetchErr } = await supabase
    .from('public_results')
    .select('id, user_id, claimed_at, anon_id, result_stage')
    .eq('id', trimmedId)
    .single();

  if (fetchErr) {
    if (fetchErr.code === 'PGRST116') throw new ClaimNotFoundError(trimmedId);
    throw new Error(`public_results 조회 실패: ${fetchErr.message}`);
  }
  if (!row) throw new ClaimNotFoundError(trimmedId);

  const existingUserId = row.user_id as string | null;

  // anon_id advisory 검증 (불일치 시 warn만; claim 차단 아님)
  if (anonId && typeof anonId === 'string' && row.anon_id !== anonId.trim()) {
    console.warn(
      `[claimPublicResult] anon_id mismatch (id=${trimmedId}). ` +
      `stored=${row.anon_id}, provided=${anonId.trim()}. ` +
      'claim 진행 허용 (id UUID obscurity 기반).'
    );
  }

  // 이미 동일 사용자가 claim한 경우 → 멱등 성공
  if (existingUserId === userId) {
    return {
      outcome:   'already_owned',
      id:        row.id as string,
      userId,
      stage:     row.result_stage as string,
      claimedAt: row.claimed_at as string,
    };
  }

  // 다른 사용자가 claim한 경우 → 충돌 오류
  if (existingUserId !== null) {
    throw new ClaimConflictError(trimmedId);
  }

  // claim 실행: user_id, claimed_at 업데이트
  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('public_results')
    .update({ user_id: userId, claimed_at: now })
    .eq('id', trimmedId)
    .is('user_id', null) // 동시성 안전: 여전히 unclaimed인 경우만 업데이트
    .select('id, user_id, claimed_at, result_stage')
    .single();

  if (updateErr) {
    // PGRST116: 조건 불충족 (concurrent claim으로 다른 user가 먼저 claim)
    if (updateErr.code === 'PGRST116') {
      throw new ClaimConflictError(trimmedId);
    }
    throw new Error(`claim 업데이트 실패: ${updateErr.message}`);
  }

  if (!updated) {
    throw new ClaimConflictError(trimmedId);
  }

  return {
    outcome:   'claimed',
    id:        updated.id as string,
    userId:    updated.user_id as string,
    stage:     updated.result_stage as string,
    claimedAt: updated.claimed_at as string,
  };
}
