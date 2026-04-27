/**
 * PR-PILOT-ENTITLEMENT-02 — POST /api/pilot/redeem
 * Bearer-authenticated pilot code redeem; server calls redeem_pilot_access RPC (service role).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

const LOG_PREFIX = '[PILOT redeem]';

type RpcResult = {
  ok?: boolean;
  outcome?: string;
  plan_status?: string;
};

function normalizeBodyCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0 || t.length > 64) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return null;
  return t.toLowerCase();
}

function jsonError(
  status: number,
  code: string,
  message: string,
  phase: string
): NextResponse {
  console.info(LOG_PREFIX, phase);
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    console.info(LOG_PREFIX, 'invalid_code');
    return jsonError(400, 'INVALID_CODE', '요청 본문이 올바르지 않습니다.', 'invalid_code');
  }

  const codeRaw = body.code;
  const normalized = normalizeBodyCode(codeRaw);
  if (!normalized) {
    console.info(LOG_PREFIX, 'missing_code');
    return jsonError(400, 'MISSING_CODE', '파일럿 코드가 필요합니다.', 'missing_code');
  }

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    console.info(LOG_PREFIX, 'unauthorized');
    return jsonError(401, 'UNAUTHORIZED', '인증이 필요합니다.', 'unauthorized');
  }

  const supabase = getServerSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user?.id) {
    console.info(LOG_PREFIX, 'unauthorized');
    return jsonError(401, 'UNAUTHORIZED', '인증이 필요합니다.', 'unauthorized');
  }

  const source =
    typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 64)
      : 'pilot_redeem_v1';

  const rawMeta = body.metadata;
  const pMetadata =
    rawMeta != null && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      ? (rawMeta as Record<string, unknown>)
      : {};

  const { data: rawData, error: rpcError } = await supabase.rpc('redeem_pilot_access', {
    p_code: normalized,
    p_user_id: user.id,
    p_actor_email: user.email ?? '',
    p_source: source,
    p_metadata: pMetadata,
  });

  if (rpcError) {
    console.error(LOG_PREFIX, 'rpc_error', rpcError.message);
    return jsonError(
      500,
      'REDEEM_FAILED',
      '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
      'rpc_error'
    );
  }

  const data = rawData as RpcResult | null;
  if (!data || typeof data !== 'object') {
    console.error(LOG_PREFIX, 'rpc_error', 'empty_response');
    return jsonError(
      500,
      'REDEEM_FAILED',
      '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
      'rpc_error'
    );
  }

  if (data.ok === true) {
    const outcome = data.outcome;
    if (outcome === 'redeemed') {
      console.info(LOG_PREFIX, 'redeemed');
      return NextResponse.json({
        ok: true,
        outcome: 'redeemed',
        plan_status: data.plan_status ?? 'active',
      });
    }
    if (outcome === 'already_redeemed') {
      console.info(LOG_PREFIX, 'already_redeemed');
      return NextResponse.json({
        ok: true,
        outcome: 'already_redeemed',
        plan_status: data.plan_status ?? 'active',
      });
    }
    console.error(LOG_PREFIX, 'rpc_error', 'unexpected_ok', outcome);
    return jsonError(
      500,
      'REDEEM_FAILED',
      '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
      'rpc_error'
    );
  }

  const outcome = data.outcome;

  switch (outcome) {
    case 'invalid_code':
      console.info(LOG_PREFIX, 'invalid_code');
      return jsonError(400, 'INVALID_CODE', '유효하지 않은 파일럿 링크입니다.', 'invalid_code');
    case 'code_not_found':
      console.info(LOG_PREFIX, 'code_not_found');
      return jsonError(
        404,
        'CODE_NOT_FOUND',
        '유효하지 않은 파일럿 링크입니다.',
        'code_not_found'
      );
    case 'user_not_found':
      console.info(LOG_PREFIX, 'user_not_found');
      return jsonError(
        404,
        'USER_NOT_FOUND',
        '사용자 정보를 찾을 수 없습니다.',
        'user_not_found'
      );
    case 'inactive':
      console.info(LOG_PREFIX, 'inactive');
      return jsonError(
        410,
        'INACTIVE_CODE',
        '파일럿 코드가 만료되었습니다. 안내받은 링크를 다시 확인해주세요.',
        'inactive'
      );
    case 'expired':
      console.info(LOG_PREFIX, 'expired');
      return jsonError(
        410,
        'EXPIRED_CODE',
        '파일럿 코드가 만료되었습니다. 안내받은 링크를 다시 확인해주세요.',
        'expired'
      );
    case 'limit_reached':
      console.info(LOG_PREFIX, 'limit_reached');
      return jsonError(
        409,
        'REDEMPTION_LIMIT_REACHED',
        '이 파일럿 링크의 사용 가능 인원이 모두 찼습니다.',
        'limit_reached'
      );
    case 'rpc_error':
      console.error(LOG_PREFIX, 'rpc_error');
      return jsonError(
        500,
        'REDEEM_FAILED',
        '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
        'rpc_error'
      );
    default:
      console.error(LOG_PREFIX, 'rpc_error', outcome ?? 'unknown');
      return jsonError(
        500,
        'REDEEM_FAILED',
        '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
        'rpc_error'
      );
  }
}
