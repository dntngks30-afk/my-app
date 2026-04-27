/**
 * PR-PILOT-ENTITLEMENT-02 — Client helper for POST /api/pilot/redeem
 */

'use client';

import { clearPilotContext, readPilotContext } from '@/lib/pilot/pilot-context';

export type PilotRedeemClientResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; outcome: 'redeemed' | 'already_redeemed' }
  | { ok: false; retryable: boolean; code: string; message: string };

type ApiSuccess = {
  ok: true;
  outcome: 'redeemed' | 'already_redeemed';
  plan_status?: string;
};

type ApiErrorBody = {
  ok: false;
  error?: { code?: string; message?: string };
};

function isRetryableStatus(status: number): boolean {
  if (status === 0) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Redeems pilot code from moveRePilotContext:v1 using the given access token.
 * Does not call getSession when token is already known (e.g. session-preparing).
 */
export async function redeemPilotAccessClient(accessToken: string): Promise<PilotRedeemClientResult> {
  const ctx = readPilotContext();
  if (!ctx) {
    return { ok: true, skipped: true };
  }

  const metadata = {
    pilot_entered_at: ctx.enteredAt,
    pilot_version: ctx.version,
    pilot_source: ctx.source,
  };

  let res: Response;
  try {
    res = await fetch('/api/pilot/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        code: ctx.code,
        source: 'pilot_redeem_v1',
        metadata,
      }),
    });
  } catch {
    return {
      ok: false,
      retryable: true,
      code: 'NETWORK_ERROR',
      message:
        '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  const json = (await res.json().catch(() => ({}))) as ApiSuccess | ApiErrorBody;

  if (res.ok && json && 'ok' in json && json.ok === true) {
    const outcome = json.outcome;
    if (outcome === 'redeemed' || outcome === 'already_redeemed') {
      clearPilotContext();
      return { ok: true, skipped: false, outcome };
    }
  }

  if (isRetryableStatus(res.status)) {
    return {
      ok: false,
      retryable: true,
      code: 'REDEEM_FAILED',
      message:
        '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  const err = json && typeof json === 'object' && 'error' in json ? json.error : undefined;
  const code = typeof err?.code === 'string' ? err.code : 'REDEEM_FAILED';
  const message =
    typeof err?.message === 'string'
      ? err.message
      : '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.';

  return { ok: false, retryable: false, code, message };
}
