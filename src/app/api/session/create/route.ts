/**
 * POST /api/session/create
 *
 * 세션 플랜 멱등 생성.
 * - active_session_number가 있으면 기존 세션 그대로 반환 (새로 생성 금지)
 * - 없으면 next = completed_sessions + 1
 * - next > total_sessions이면 { done:true, progress } 반환
 * - UPSERT: UNIQUE(user_id, session_number) 기반 멱등 보장
 *
 * 입력:
 *   condition_mood: 'good' | 'ok' | 'bad'
 *   time_budget: 'short' | 'normal'
 *   pain_flags?: string[]
 *   equipment?: 'none' | 'band'
 *
 * plan_json: 이번 PR은 STUB (Deep Result 연결은 다음 PR)
 *   version: 'session_stub_v1'
 *   segments: Warmup + Main + Cooldown (time_budget=short면 세트 수 감소)
 *   bad 컨디션이면 plan_json.recovery: true
 *
 * 테마 4단계 (session_number 기반):
 *   1~4:  "1순위 타겟"
 *   5~8:  "2순위 타겟"
 *   9~12: "통합"
 *   13~16:"릴렉스"
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Auth: Bearer token. Write: service role admin client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TOTAL_SESSIONS = 16;

type ConditionMood = 'good' | 'ok' | 'bad';
type TimeBudget = 'short' | 'normal';

/** session_number → 4단계 테마 */
function getTheme(sessionNumber: number): string {
  if (sessionNumber <= 4)  return '1순위 타겟';
  if (sessionNumber <= 8)  return '2순위 타겟';
  if (sessionNumber <= 12) return '통합';
  return '릴렉스';
}

/**
 * 스텁 plan_json 생성 (Deep Result 연결 전 최소 구조)
 * - time_budget=short: items/sets 수 축소
 * - condition_mood=bad: recovery 플래그 추가
 */
function buildStubPlanJson(
  sessionNumber: number,
  theme: string,
  timeBudget: TimeBudget,
  conditionMood: ConditionMood
) {
  const isShort = timeBudget === 'short';
  const isRecovery = conditionMood === 'bad';
  const sets = isShort ? 2 : 3;
  const items = isShort ? 2 : 4;

  return {
    version: 'session_stub_v1',
    recovery: isRecovery,
    segments: [
      {
        title: 'Warmup',
        duration_sec: isShort ? 120 : 180,
        items: Array.from({ length: isShort ? 2 : 3 }, (_, i) => ({
          order: i + 1,
          templateId: `stub_warmup_${i + 1}`,
          name: `준비 운동 ${i + 1}`,
          sets: 1,
          reps: 10,
        })),
      },
      {
        title: `Main (${theme})`,
        duration_sec: isShort ? 240 : 420,
        items: Array.from({ length: items }, (_, i) => ({
          order: i + 1,
          templateId: `stub_main_s${sessionNumber}_${i + 1}`,
          name: isRecovery ? `회복 운동 ${i + 1}` : `${theme} 운동 ${i + 1}`,
          sets,
          reps: isRecovery ? 8 : 12,
        })),
      },
      {
        title: 'Cooldown',
        duration_sec: isShort ? 60 : 120,
        items: Array.from({ length: isShort ? 1 : 2 }, (_, i) => ({
          order: i + 1,
          templateId: `stub_cooldown_${i + 1}`,
          name: `마무리 스트레칭 ${i + 1}`,
          sets: 1,
          reps: 30,
          note: 'hold_seconds',
        })),
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const conditionMood: ConditionMood = (['good', 'ok', 'bad'] as const).includes(
      body.condition_mood as ConditionMood
    )
      ? (body.condition_mood as ConditionMood)
      : 'ok';

    const timeBudget: TimeBudget = (['short', 'normal'] as const).includes(
      body.time_budget as TimeBudget
    )
      ? (body.time_budget as TimeBudget)
      : 'normal';

    const painFlags = Array.isArray(body.pain_flags)
      ? (body.pain_flags as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    const equipment = typeof body.equipment === 'string' ? body.equipment : 'none';

    const supabase = getServerSupabaseAdmin();

    // progress 조회 — 없으면 자동 생성
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
        .select('session_number, status, theme, plan_json, condition')
        .eq('user_id', userId)
        .eq('session_number', progress.active_session_number)
        .maybeSingle();

      const res = NextResponse.json({
        progress,
        active: existingPlan ?? null,
        idempotent: true,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    const nextSessionNumber = progress.completed_sessions + 1;

    // 프로그램 전체 완료
    if (nextSessionNumber > progress.total_sessions) {
      const res = NextResponse.json({
        done: true,
        progress,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    const theme = getTheme(nextSessionNumber);
    const planJson = buildStubPlanJson(nextSessionNumber, theme, timeBudget, conditionMood);
    const condition = { condition_mood: conditionMood, time_budget: timeBudget, pain_flags: painFlags, equipment };

    // UPSERT: UNIQUE(user_id, session_number) — 멱등 보장
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
      .select('session_number, status, theme, plan_json, condition')
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
      progress: updatedProgress ?? { ...progress, active_session_number: nextSessionNumber },
      active: plan,
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
