/**
 * POST /api/session/complete
 *
 * 세션 완료 처리 (멱등).
 * - status='completed'면 중복 +1 없이 같은 응답 반환
 * - session_plans status='completed', completed_at 설정
 * - progress.completed_sessions = GREATEST(현재, session_number)
 * - progress.active_session_number = null
 * - progress.last_completed_at = now()
 * - 응답에 next_theme만 포함 (운동 리스트 예고 금지)
 *
 * 입력:
 *   session_number: number
 *   duration_seconds: number
 *   completion_mode: 'all_done' | 'partial_done' | 'stop_early'
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Bearer token 인증.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_THEMES: Record<number, string> = {
  1: 'full_body_reset',
  2: 'thoracic_mobility',
  3: 'core_stability',
  4: 'glute_activation',
  5: 'lower_chain_stability',
  6: 'shoulder_mobility',
  7: 'global_core',
  8: 'full_body_reset',
};

function getTheme(sessionNumber: number): string {
  return SESSION_THEMES[sessionNumber] ?? SESSION_THEMES[((sessionNumber - 1) % 8) + 1] ?? 'full_body_reset';
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionNumber = typeof body.session_number === 'number' ? body.session_number : null;
    const durationSeconds = typeof body.duration_seconds === 'number' ? body.duration_seconds : null;
    const completionMode = (['all_done', 'partial_done', 'stop_early'] as const).includes(
      body.completion_mode as 'all_done' | 'partial_done' | 'stop_early'
    )
      ? (body.completion_mode as 'all_done' | 'partial_done' | 'stop_early')
      : null;

    if (!sessionNumber || sessionNumber < 1) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'session_number가 유효하지 않습니다.' } },
        { status: 400 }
      );
    }
    if (durationSeconds === null || durationSeconds < 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'duration_seconds가 유효하지 않습니다.' } },
        { status: 400 }
      );
    }
    if (!completionMode) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'completion_mode는 all_done|partial_done|stop_early 중 하나여야 합니다.' } },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    // 해당 세션 플랜 조회
    const { data: plan, error: planFetchErr } = await supabase
      .from('session_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    if (planFetchErr) {
      console.error('[session/complete] plan fetch failed', planFetchErr);
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '세션 플랜 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '해당 세션 플랜을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    // 이미 완료 — 멱등: 중복 처리 없이 같은 응답 반환
    if (plan.status === 'completed') {
      const { data: progress } = await supabase
        .from('session_program_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const nextSessionNumber = (progress?.completed_sessions ?? sessionNumber) + 1;
      const nextTheme = nextSessionNumber <= (progress?.total_sessions ?? 8)
        ? getTheme(nextSessionNumber)
        : null;

      const res = NextResponse.json({
        success: true,
        idempotent: true,
        session: plan,
        progress,
        next_theme: nextTheme,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    const nowIso = new Date().toISOString();

    // session_plans 업데이트
    const { data: updatedPlan, error: planUpdateErr } = await supabase
      .from('session_plans')
      .update({
        status: 'completed',
        completed_at: nowIso,
        duration_seconds: durationSeconds,
        completion_mode: completionMode,
      })
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .select()
      .single();

    if (planUpdateErr) {
      console.error('[session/complete] plan update failed', planUpdateErr);
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '세션 완료 업데이트에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // progress 조회 후 업데이트
    const { data: progress } = await supabase
      .from('session_program_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const newCompletedSessions = Math.max(
      progress?.completed_sessions ?? 0,
      sessionNumber
    );

    const { data: updatedProgress, error: progressErr } = await supabase
      .from('session_program_progress')
      .update({
        completed_sessions: newCompletedSessions,
        active_session_number: null,
        last_completed_at: nowIso,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (progressErr) {
      console.error('[session/complete] progress update failed', progressErr);
    }

    const finalProgress = updatedProgress ?? progress;
    const nextSessionNumber = newCompletedSessions + 1;
    const nextTheme = finalProgress && nextSessionNumber <= finalProgress.total_sessions
      ? getTheme(nextSessionNumber)
      : null;

    const res = NextResponse.json({
      success: true,
      idempotent: false,
      session: updatedPlan,
      progress: finalProgress,
      next_theme: nextTheme,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[session/complete]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
