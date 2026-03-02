/**
 * POST /api/session/create
 *
 * 세션 플랜을 멱등 생성.
 * - progress.active_session_number가 있으면 기존 세션 그대로 반환 (새로 생성 금지)
 * - 없으면 next_session_number = completed_sessions + 1
 * - next_session_number > total_sessions면 { done: true } 반환
 * - UPSERT: UNIQUE(user_id, session_number) 기반 멱등 보장
 *
 * 입력:
 *   condition_mood: 'good' | 'ok' | 'bad'
 *   time_budget: 'short' | 'normal'
 *   pain_flags?: string[]     (선택)
 *   equipment?: string[]      (선택)
 *
 * NOTE: plan_json은 이번 PR에서 stub (Deep Result 연결은 다음 PR).
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

/** 세션 번호 기반 테마 맵 (stub: 실제 Deep Result 연결은 다음 PR) */
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

/** 세션 번호 기반 다음 테마 반환 */
function getTheme(sessionNumber: number): string {
  return SESSION_THEMES[sessionNumber] ?? SESSION_THEMES[((sessionNumber - 1) % 8) + 1] ?? 'full_body_reset';
}

/**
 * 스텁 plan_json 생성 (Deep Result 연결 전 최소 구조)
 */
function buildStubPlanJson(
  sessionNumber: number,
  theme: string,
  timeBudget: 'short' | 'normal'
) {
  const durationSec = timeBudget === 'short' ? 300 : 600;
  const segments = [
    { order: 1, templateId: 'stub_01', templateName: '준비 운동', durationSec: Math.round(durationSec * 0.25), kind: 'work' },
    { order: 2, templateId: 'stub_02', templateName: theme.replace(/_/g, ' '), durationSec: Math.round(durationSec * 0.5), kind: 'work' },
    { order: 3, templateId: 'stub_03', templateName: '마무리', durationSec: Math.round(durationSec * 0.25), kind: 'work' },
  ];
  return { session_number: sessionNumber, theme, segments, stub: true };
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
    const conditionMood = (['good', 'ok', 'bad'] as const).includes(body.condition_mood as 'good' | 'ok' | 'bad')
      ? (body.condition_mood as 'good' | 'ok' | 'bad')
      : 'ok';
    const timeBudget = (['short', 'normal'] as const).includes(body.time_budget as 'short' | 'normal')
      ? (body.time_budget as 'short' | 'normal')
      : 'normal';
    const painFlags = Array.isArray(body.pain_flags)
      ? (body.pain_flags as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const equipment = Array.isArray(body.equipment)
      ? (body.equipment as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

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

      if (insertErr || !created) {
        console.error('[session/create] progress init failed', insertErr);
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: '진행 상태 초기화에 실패했습니다.' } },
          { status: 500 }
        );
      }
      progress = created;
    }

    // 이미 active session이 있으면 그대로 반환 (멱등)
    if (progress.active_session_number) {
      const { data: existingPlan } = await supabase
        .from('session_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('session_number', progress.active_session_number)
        .maybeSingle();

      const res = NextResponse.json({
        session: existingPlan,
        progress,
        idempotent: true,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    const nextSessionNumber = progress.completed_sessions + 1;

    // 프로그램 완료
    if (nextSessionNumber > progress.total_sessions) {
      const res = NextResponse.json({
        done: true,
        completed_sessions: progress.completed_sessions,
        total_sessions: progress.total_sessions,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    const theme = getTheme(nextSessionNumber);
    const planJson = buildStubPlanJson(nextSessionNumber, theme, timeBudget);
    const condition = { condition_mood: conditionMood, time_budget: timeBudget, pain_flags: painFlags, equipment };

    // UPSERT: UNIQUE(user_id, session_number) 멱등 보장
    const { data: plan, error: upsertErr } = await supabase
      .from('session_plans')
      .upsert(
        {
          user_id: userId,
          session_number: nextSessionNumber,
          status: 'draft',
          theme,
          plan_json: planJson,
          condition,
        },
        { onConflict: 'user_id,session_number', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (upsertErr || !plan) {
      console.error('[session/create] upsert failed', upsertErr);
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '세션 플랜 생성에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // progress.active_session_number 업데이트
    const { data: updatedProgress, error: progressErr } = await supabase
      .from('session_program_progress')
      .update({ active_session_number: nextSessionNumber })
      .eq('user_id', userId)
      .select()
      .single();

    if (progressErr) {
      console.error('[session/create] progress update failed', progressErr);
    }

    const res = NextResponse.json({
      session: plan,
      progress: updatedProgress ?? { ...progress, active_session_number: nextSessionNumber },
      idempotent: false,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[session/create]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
