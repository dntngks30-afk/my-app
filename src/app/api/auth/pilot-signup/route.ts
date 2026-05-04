/**
 * PR-AUTH-PILOT-PASSWORD-SIGNUP-02 — 이메일·비밀번호 즉시 가입 (서비스 롤 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import {
  validatePilotSignupBody,
  pilotSignupUserMetadata,
} from '@/lib/auth/pilotSignupValidation';
import { signupBirthDateToAgeBand } from '@/lib/analytics/kpi-demographics-types';
import { upsertSignupProfile } from '@/lib/analytics/signup-profile';
import { linkPublicTestProfileAnonToUser } from '@/lib/analytics/public-test-profile';
import { linkLatestPublicTestRunToUserByAnon } from '@/lib/public-test-runs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 40;
const rateBucket = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = rateBucket.get(ip);
  if (!e || now - e.windowStart > RATE_WINDOW_MS) {
    rateBucket.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (e.count >= RATE_MAX) return false;
  e.count += 1;
  return true;
}

function isEmailAlreadyExistsError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? '').toLowerCase();
  return (
    msg.includes('already been') ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already') ||
    msg.includes('duplicate')
  );
}

type ErrorBody = {
  ok: false;
  error: {
    code: 'VALIDATION_ERROR' | 'EMAIL_EXISTS' | 'SUPABASE_CONFIG_MISSING' | 'SIGNUP_FAILED' | 'RATE_LIMITED';
    message: string;
  };
};

function jsonError(
  status: number,
  body: ErrorBody,
): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    return jsonError(400, {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '요청 형식이 올바르지 않습니다.',
      },
    });
  }

  const ip = getClientIp(req);
  if (!checkRate(ip)) {
    return jsonError(429, {
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: '잠시 후 다시 시도해 주세요.',
      },
    });
  }

  const parsed = validatePilotSignupBody(bodyUnknown);
  if (!parsed.ok) {
    return jsonError(400, {
      ok: false,
      error: { code: parsed.code, message: parsed.message },
    });
  }

  const v = parsed.value;

  let supabase;
  try {
    supabase = getServerSupabaseAdmin();
  } catch {
    console.error('[pilot-signup] admin client unavailable');
    return jsonError(500, {
      ok: false,
      error: {
        code: 'SUPABASE_CONFIG_MISSING',
        message: '서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.',
      },
    });
  }

  const domainHint = v.email.includes('@') ? v.email.split('@')[1] : '';
  console.info('[pilot-signup] attempt', { domain: domainHint });

  const { data, error } = await supabase.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: pilotSignupUserMetadata(v),
  });

  if (error) {
    if (isEmailAlreadyExistsError(error)) {
      return jsonError(409, {
        ok: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: '이미 가입된 이메일입니다. 로그인해 주세요.',
        },
      });
    }
    console.error('[pilot-signup] createUser failed', { message: error.message });
    return jsonError(500, {
      ok: false,
      error: {
        code: 'SIGNUP_FAILED',
        message: '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
    });
  }

  const userId = data.user?.id;
  if (!userId) {
    return jsonError(500, {
      ok: false,
      error: {
        code: 'SIGNUP_FAILED',
        message: '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
    });
  }

  try {
    const band = signupBirthDateToAgeBand(v.birthDate);
    if (band !== 'unknown') {
      await upsertSignupProfile({
        userId,
        birthDateIso: v.birthDate,
        signupAgeBand: band,
        acquisitionSource: v.acquisitionSource,
        pilotCode: v.pilotCode,
      });
    }
  } catch (e) {
    console.error('[pilot-signup] signup_profiles upsert failed', e);
  }

  if (v.anonId) {
    try {
      await linkPublicTestProfileAnonToUser({
        anonId: v.anonId,
        userId,
      });
    } catch (e) {
      console.warn('[pilot-signup] public_test_profiles anon->user link failed', e);
    }

    void linkLatestPublicTestRunToUserByAnon({
      anonId: v.anonId,
      userId,
      pilotCode: v.pilotCode,
      markAuthSuccess: true,
    });
  }

  return NextResponse.json({ ok: true, userId });
}
