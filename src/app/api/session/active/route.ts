/**
 * GET /api/session/active
 *
 * 진행 중인 세션을 반환. 없으면 { active: null, progress }.
 * 최초 요청 시 session_program_progress 행이 없으면 기본값으로 초기화.
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Bearer token 인증.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TOTAL_SESSIONS = 8;

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    // progress 조회 — 없으면 초기화
    let { data: progress } = await supabase
      .from('session_program_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress) {
      const { data: created, error: insertErr } = await supabase
        .from('session_program_progress')
        .insert({
          user_id: userId,
          total_sessions: DEFAULT_TOTAL_SESSIONS,
          completed_sessions: 0,
          active_session_number: null,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[session/active] progress init failed', insertErr);
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: '진행 상태 초기화에 실패했습니다.' } },
          { status: 500 }
        );
      }
      progress = created;
    }

    const activeSessionNumber = progress.active_session_number;

    if (!activeSessionNumber) {
      const res = NextResponse.json({ active: null, progress });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    // active_session_number가 있으면 해당 session_plan 반환
    const { data: plan, error: planErr } = await supabase
      .from('session_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('session_number', activeSessionNumber)
      .maybeSingle();

    if (planErr) {
      console.error('[session/active] plan fetch failed', planErr);
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '세션 플랜 조회에 실패했습니다.' } },
        { status: 500 }
      );
    }

    const res = NextResponse.json({
      active: plan ?? null,
      progress,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[session/active]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
