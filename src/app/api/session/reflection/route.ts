/**
 * POST /api/session/reflection
 *
 * PR-UX-03: Session reflection — store post-session reflection for adaptive signals.
 * Links reflection to session. No completion logic.
 *
 * Auth: Bearer token.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { saveSessionFeedback } from '@/lib/session/feedback';
import type { FeedbackPayload } from '@/lib/session/feedback-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_DISCOMFORT = ['neck', 'lower_back', 'knee', 'wrist', 'shoulder'] as const;

function difficultyToFeedback(d: number): 'too_easy' | 'ok' | 'too_hard' {
  if (d <= 2) return 'too_easy';
  if (d >= 4) return 'too_hard';
  return 'ok';
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionNumber = typeof body.session_number === 'number' ? Math.floor(body.session_number) : null;
    const difficulty = typeof body.difficulty === 'number' && body.difficulty >= 1 && body.difficulty <= 5
      ? Math.floor(body.difficulty)
      : null;
    const bodyStateChange = body.body_state_change === 'better' || body.body_state_change === 'same' || body.body_state_change === 'worse'
      ? body.body_state_change
      : null;
    const discomfortArea = typeof body.discomfort_area === 'string' && body.discomfort_area.trim()
      ? (VALID_DISCOMFORT.includes(body.discomfort_area as (typeof VALID_DISCOMFORT)[number]) ? body.discomfort_area : null)
      : null;

    if (!sessionNumber || sessionNumber < 1) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'session_number가 유효하지 않습니다');
    }
    if (difficulty === null) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'difficulty는 1~5 사이여야 합니다');
    }

    const supabase = getServerSupabaseAdmin();

    const { data: plan } = await supabase
      .from('session_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    const payload: FeedbackPayload = {
      sessionFeedback: {
        difficultyFeedback: difficultyToFeedback(difficulty),
        bodyStateChange: bodyStateChange ?? undefined,
        discomfortArea: discomfortArea ?? undefined,
      },
    };

    const result = await saveSessionFeedback(supabase, payload, {
      userId,
      sessionNumber,
      sessionPlanId: plan?.id ?? null,
    });

    if (!result.saved) {
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '리플렉션 저장에 실패했습니다');
    }

    return ok({ saved: true });
  } catch (err) {
    console.error('[session/reflection]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
