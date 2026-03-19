/**
 * FLOW-05 — Public Result Claim Client 훅
 *
 * 브라우저에서 POST /api/public-results/[id]/claim을 호출한다.
 * best-effort: 실패 시 UX 블로킹 없음.
 *
 * @see src/app/api/public-results/[id]/claim/route.ts
 * @see src/lib/public-results/public-result-bridge.ts
 */

'use client';

import { useCallback, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';

export type ClaimOutcome = 'claimed' | 'already_owned';

export interface ClaimResult {
  ok: true;
  outcome: ClaimOutcome;
  id: string;
  stage: string;
  claimedAt: string;
}

export interface ClaimFailure {
  ok: false;
  reason: string;
  /** HTTP status code if available */
  status?: number;
}

export type ClaimPublicResultResult = ClaimResult | ClaimFailure;

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
    return { ok: false, reason: 'publicResultId_missing' };
  }

  try {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) {
      return { ok: false, reason: 'unauthenticated' };
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
      };
    }

    if (
      !json.success ||
      !json.id ||
      (json.outcome !== 'claimed' && json.outcome !== 'already_owned')
    ) {
      return { ok: false, reason: 'unexpected_response' };
    }

    return {
      ok:        true,
      outcome:   json.outcome as ClaimOutcome,
      id:        json.id,
      stage:     json.stage ?? '',
      claimedAt: json.claimedAt ?? '',
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'unknown_error',
    };
  }
}
