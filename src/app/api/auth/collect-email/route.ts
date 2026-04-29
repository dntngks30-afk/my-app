/**
 * PR-AUTH-IOS-LOGIN-POLICY-01 — Kakao 등 OAuth 후 이메일 보정 (서비스 롤 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { normalizeCollectEmail } from '@/lib/auth/collectEmailValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isDuplicateEmailAuthError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? '').toLowerCase();
  return (
    msg.includes('already') ||
    msg.includes('duplicate') ||
    msg.includes('exists') ||
    msg.includes('taken') ||
    msg.includes('unique')
  );
}

type OkBody = { ok: true };
type ErrBody = {
  ok: false;
  error: {
    code: 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'DUPLICATE_EMAIL' | 'UPDATE_FAILED';
    message: string;
  };
};

function jsonErr(status: number, body: ErrBody) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return jsonErr(401, {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '요청 형식이 올바르지 않습니다.' },
    });
  }

  const rawEmail =
    body && typeof body === 'object' && 'email' in body
      ? (body as { email?: unknown }).email
      : undefined;
  const email = normalizeCollectEmail(rawEmail);
  if (!email) {
    return jsonErr(400, {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '올바른 이메일 주소를 입력해 주세요.' },
    });
  }

  const supabaseAdmin = getServerSupabaseAdmin();
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authUser) {
    return jsonErr(401, {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: '세션이 유효하지 않습니다.' },
    });
  }

  const userId = authUser.id;

  const { data: existingRow } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingRow && (existingRow as { id: string }).id !== userId) {
    return jsonErr(409, {
      ok: false,
      error: {
        code: 'DUPLICATE_EMAIL',
        message: '이미 다른 계정에서 사용 중인 이메일입니다.',
      },
    });
  }

  const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });

  if (authUpdateErr) {
    if (isDuplicateEmailAuthError(authUpdateErr)) {
      return jsonErr(409, {
        ok: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: '이미 다른 계정에서 사용 중인 이메일입니다.',
        },
      });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[collect-email] auth.admin.updateUserById non-fatal:', authUpdateErr.message);
    }
  }

  const { error: dbErr } = await supabaseAdmin.from('users').update({ email }).eq('id', userId);
  if (dbErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[collect-email] users update failed:', dbErr.message);
    }
    return jsonErr(500, {
      ok: false,
      error: {
        code: 'UPDATE_FAILED',
        message: '이메일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      },
    });
  }

  return NextResponse.json({ ok: true } satisfies OkBody);
}
