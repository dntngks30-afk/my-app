/**
 * FLOW-05 — Public Result Claim Client 훅
 *
 * 브라우저에서 POST /api/public-results/[id]/claim을 호출한다.
 * best-effort: 실패 시 UX 블로킹 없음. 일시 오류(5xx·네트워크)에 한해 소수 재시도.
 *
 * @see src/app/api/public-results/[id]/claim/route.ts
 * @see src/lib/public-results/public-result-bridge.ts
 */

'use client';

import { supabaseBrowser } from '@/lib/supabase';

export type ClaimOutcome = 'claimed' | 'already_owned';

export interface ClaimResult {
  ok: true;
  outcome: ClaimOutcome;
  id: string;
  stage: string;
  claimedAt: string;
  /** 총 시도 횟수 (성공 직전까지, 최소 1) */
  attempts: number;
}

export interface ClaimFailure {
  ok: false;
  reason: string;
  /** HTTP status code if available */
  status?: number;
  /** 마지막 시도까지의 총 시도 횟수 */
  attempts: number;
}

export type ClaimPublicResultResult = ClaimResult | ClaimFailure;

const LOG_PREFIX = '[FLOW-05 claim]';

/** 초기 1회 + 재시도 2회 = 최대 3회 (PR-CLAIM-FLOW-HARDENING-01) */
const MAX_CLAIM_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 5xx 또는 네트워크 계열만 재시도 (401/409/4xx·응답 파싱 오류는 제외) */
function isRetryableFailure(failure: ClaimFailure): boolean {
  if (failure.status !== undefined) {
    return failure.status >= 500 && failure.status < 600;
  }
  if (failure.reason === 'unauthenticated' || failure.reason === 'publicResultId_missing') {
    return false;
  }
  if (failure.reason === 'unexpected_response') {
    return false;
  }
  const transientHints = /Failed to fetch|NetworkError|network|load failed|ECONNRESET|aborted/i;
  return transientHints.test(failure.reason);
}

/**
 * 단일 fetch 시도 (재시도 루프에서 사용)
 */
async function claimPublicResultOnce(
  publicResultId: string,
  anonId?: string | null
): Promise<ClaimPublicResultResult> {
  if (!publicResultId || typeof publicResultId !== 'string') {
    return { ok: false, reason: 'publicResultId_missing', attempts: 1 };
  }

  try {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) {
      return { ok: false, reason: 'unauthenticated', attempts: 1 };
    }

    const body: Record<string, unknown> = {};
    if (anonId && typeof anonId === 'string') body.anonId = anonId;

    const res = await fetch(
      `/api/public-results/${encodeURIComponent(publicResultId)}/claim`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const json = await res.json().catch(() => ({})) as {
      success?: boolean;
      outcome?: string;
      id?: string;
      stage?: string;
      claimedAt?: string;
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        reason: json.error ?? `HTTP ${res.status}`,
        status: res.status,
        attempts: 1,
      };
    }

    if (
      !json.success ||
      !json.id ||
      (json.outcome !== 'claimed' && json.outcome !== 'already_owned')
    ) {
      return { ok: false, reason: 'unexpected_response', attempts: 1 };
    }

    return {
      ok: true,
      outcome: json.outcome as ClaimOutcome,
      id: json.id,
      stage: json.stage ?? '',
      claimedAt: json.claimedAt ?? '',
      attempts: 1,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'unknown_error',
      attempts: 1,
    };
  }
}

/**
 * claimPublicResultClient — 브라우저에서 claim API 호출 (best-effort)
 *
 * @param publicResultId claim 대상 public_results.id
 * @param anonId 선택적 advisory anon hint
 * @returns ClaimPublicResultResult (절대 throw하지 않음)
 */
export async function claimPublicResultClient(
  publicResultId: string,
  anonId?: string | null
): Promise<ClaimPublicResultResult> {
  if (!publicResultId || typeof publicResultId !== 'string') {
    console.info(LOG_PREFIX, { phase: 'skipped', reason: 'publicResultId_missing' });
    return { ok: false, reason: 'publicResultId_missing', attempts: 0 };
  }

  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    const result = await claimPublicResultOnce(publicResultId, anonId);

    if (result.ok) {
      const attempts = attempt + 1;
      console.info(LOG_PREFIX, {
        phase: 'success',
        outcome: result.outcome,
        id: result.id,
        attempts,
      });
      return { ...result, attempts };
    }

    const failure: ClaimFailure = { ...result, attempts: attempt + 1 };

    if (attempt < MAX_CLAIM_ATTEMPTS - 1 && isRetryableFailure(failure)) {
      console.info(LOG_PREFIX, {
        phase: 'retry',
        attempt: attempt + 1,
        maxAttempts: MAX_CLAIM_ATTEMPTS,
        reason: failure.reason,
        status: failure.status,
        delayMs: RETRY_DELAY_MS,
      });
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const phase =
      attempt > 0 && isRetryableFailure(failure) ? 'failed_after_retries' : 'failed';
    console.warn(LOG_PREFIX, {
      phase,
      attempts: failure.attempts,
      reason: failure.reason,
      status: failure.status,
    });
    return failure;
  }

  return { ok: false, reason: 'unexpected_loop_exit', attempts: MAX_CLAIM_ATTEMPTS };
}
