/**
 * GET /api/session/history
 *
 * 완료된 세션 스탬프 목록 (캘린더/히스토리 UI용).
 * BE-05: duration_seconds, completion_mode 포함.
 * Read-only. 7일 시스템 미변경.
 *
 * Auth: Bearer token. 401 if not logged in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 120;

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limitParam ?? '', 10) || DEFAULT_LIMIT)
    );

    const supabase = getServerSupabaseAdmin();

    const [progressRes, plansRes] = await Promise.all([
      supabase
        .from('session_program_progress')
        .select('completed_sessions, total_sessions, last_completed_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('session_plans')
        .select('session_number, completed_at, duration_seconds, completion_mode, theme')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit),
    ]);

    const progress = progressRes.data;
    const plans = plansRes.data ?? [];
    const progressErr = progressRes.error;
    const plansErr = plansRes.error;

    if (progressErr) {
      console.error('[session/history] progress fetch error', progressErr);
    }
    if (plansErr) {
      console.error('[session/history] plans fetch error', plansErr);
    }

    const payload = {
      progress: {
        completed_sessions: progress?.completed_sessions ?? 0,
        total_sessions: progress?.total_sessions ?? 16,
        last_completed_at: progress?.last_completed_at ?? null,
      },
      items: plans.map((p) => ({
        session_number: p.session_number,
        completed_at: p.completed_at ?? '',
        duration_seconds: p.duration_seconds ?? null,
        completion_mode: p.completion_mode ?? null,
        theme: p.theme ?? '',
      })),
    };

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[session/history]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
