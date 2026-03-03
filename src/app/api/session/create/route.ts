/**
 * POST /api/session/create
 *
 * 세션 플랜 멱등 생성 (Deep Result + exercise_templates 연결).
 *
 * 동작 순서:
 *   1) auth: userId 확보
 *   2) progress 조회/초기화
 *   3) active_session_number 있으면 기존 plan 그대로 반환 (멱등)
 *   4) next_session_number 결정
 *   5) deep_test_attempts에서 최신 final 결과 요약 로드
 *   6) 직전 세션 plan_json에서 used_template_ids 로드 (반복 방지)
 *   7) exercise_templates 조회 → 스코어링 → plan_json 생성 (BE-06)
 *   8) session_plans UPSERT + progress.active_session_number 세팅
 *
 * BE-06: exercise_templates(28) 기반, safety gate, repetition penalty.
 * media sign 호출 없음.
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Auth: Bearer token. Write: service role admin client (RLS bypass).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { buildSessionPlanJson } from '@/lib/session/plan-generator';
import { getKstDayKey, getNextKstMidnightUtcIso } from '@/lib/session/kst';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TOTAL_SESSIONS = 16;

const FREQUENCY_TO_TOTAL: Record<number, number> = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

/** BE-ONB-02: profile.target_frequency → total_sessions. 없으면 16. */
async function resolveTotalSessions(
  supabase: Awaited<ReturnType<typeof getServerSupabaseAdmin>>,
  userId: string
): Promise<{ totalSessions: number; source: 'profile' | 'default' }> {
  const { data } = await supabase
    .from('session_user_profile')
    .select('target_frequency')
    .eq('user_id', userId)
    .maybeSingle();

  const freq = data?.target_frequency;
  if (typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL) {
    return { totalSessions: FREQUENCY_TO_TOTAL[freq], source: 'profile' };
  }
  return { totalSessions: DEFAULT_TOTAL_SESSIONS, source: 'default' };
}

type ConditionMood = 'good' | 'ok' | 'bad';
type TimeBudget = 'short' | 'normal';

// ─── 테마 결정 ────────────────────────────────────────────────────────────────

const PHASE_LABELS = ['1순위 타겟', '2순위 타겟', '통합', '릴렉스'] as const;

/** session_number → 0-based phase index (0~3) */
function getPhaseIndex(sessionNumber: number): number {
  return Math.min(3, Math.floor((sessionNumber - 1) / 4));
}

/**
 * 직전 세션 plan_json에서 used_template_ids 추출.
 * meta.used_template_ids 또는 segments[].items[].templateId 플랫튼.
 */
function getUsedTemplateIds(planJson: unknown): string[] {
  if (!planJson || typeof planJson !== 'object') return [];
  const meta = (planJson as Record<string, unknown>).meta as Record<string, unknown> | undefined;
  if (meta && Array.isArray(meta.used_template_ids)) {
    return (meta.used_template_ids as unknown[]).filter((x): x is string => typeof x === 'string');
  }
  const segments = (planJson as Record<string, unknown>).segments as Array<{ items?: Array<{ templateId?: string }> }> | undefined;
  if (!Array.isArray(segments)) return [];
  const ids: string[] = [];
  for (const seg of segments) {
    for (const it of seg.items ?? []) {
      if (typeof it.templateId === 'string') ids.push(it.templateId);
    }
  }
  return ids;
}

/**
 * Deep 결과 + session_number → 테마 문자열 결정 (운동명/구체 코드 절대 금지)
 * - Phase 1: "Phase 1 · {focus[0]} 안정화"
 * - Phase 2: "Phase 2 · {focus[1] or focus[0]} 심화"
 * - Phase 3: "Phase 3 · 통합"
 * - Phase 4: "Phase 4 · 릴렉스"
 */
function buildTheme(
  sessionNumber: number,
  deep: { result_type: string; focus: string[] }
): string {
  const phaseIdx = getPhaseIndex(sessionNumber);
  const phaseLabel = PHASE_LABELS[phaseIdx];

  if (phaseIdx === 0) {
    const target = deep.focus[0] ?? deep.result_type;
    return `Phase 1 · ${target} 안정화`;
  }
  if (phaseIdx === 1) {
    const target = deep.focus[1] ?? deep.focus[0] ?? deep.result_type;
    return `Phase 2 · ${target} 심화`;
  }
  return `Phase ${phaseIdx + 1} · ${phaseLabel}`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

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

    // progress 조회 — 없으면 자동 생성 (BE-ONB-02: profile 기반 total_sessions)
    let { data: progress } = await supabase
      .from('session_program_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress) {
      const resolved = await resolveTotalSessions(supabase, userId);
      const { data: created, error: insertErr } = await supabase
        .from('session_program_progress')
        .insert({
          user_id: userId,
          total_sessions: resolved.totalSessions,
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

    // ── 멱등: active session이 이미 있으면 profile 조회 없이 그대로 반환 ──
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

    // BE-ONB-02: progress 있음 + active 없음 → profile 기반 sync (안전 조건 시)
    const resolved = await resolveTotalSessions(supabase, userId);
    const completed = progress.completed_sessions ?? 0;
    const safeToSync =
      resolved.totalSessions >= completed && progress.total_sessions !== resolved.totalSessions;
    if (safeToSync) {
      const { data: synced, error: syncErr } = await supabase
        .from('session_program_progress')
        .update({ total_sessions: resolved.totalSessions })
        .eq('user_id', userId)
        .select()
        .single();
      if (!syncErr && synced) progress = synced;
    } else if (resolved.totalSessions < completed) {
      console.warn('[session/create] sync skipped: resolved < completed_sessions');
    }

    // Daily cap: max 1 completed session per KST day
    const todayKstDayKey = getKstDayKey(new Date());
    const lastDayKey = progress.last_completed_day_key as string | null | undefined;
    if (lastDayKey === todayKstDayKey) {
      return NextResponse.json(
        {
          error: {
            code: 'DAILY_LIMIT_REACHED',
            message: '오늘 이미 세션을 완료했습니다. 내일 다시 시작해 주세요.',
            next_unlock_at: getNextKstMidnightUtcIso(new Date()),
            day_key: todayKstDayKey,
          },
        },
        { status: 409 }
      );
    }

    const nextSessionNumber = progress.completed_sessions + 1;

    // 프로그램 전체 완료
    if (nextSessionNumber > progress.total_sessions) {
      const res = NextResponse.json({ done: true, progress });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    // ── [NEW] Deep Result 요약 로드 (next 생성 시점에만) ──────────────────────
    // 성능 가드: SELECT 5개 컬럼, LIMIT 1, 재계산 없음
    const deepSummary = await loadSessionDeepSummary(userId);

    if (!deepSummary) {
      return NextResponse.json(
        {
          error: {
            code: 'DEEP_RESULT_MISSING',
            message: '심화 테스트 결과가 없습니다. Deep Test를 먼저 완료해 주세요.',
          },
        },
        { status: 404 }
      );
    }

    const phaseIndex = getPhaseIndex(nextSessionNumber);
    const phase = phaseIndex + 1 as 1 | 2 | 3 | 4;
    const theme = buildTheme(nextSessionNumber, deepSummary);

    let usedTemplateIds: string[] = [];
    if (nextSessionNumber > 1) {
      const { data: prevPlan } = await supabase
        .from('session_plans')
        .select('plan_json')
        .eq('user_id', userId)
        .eq('session_number', nextSessionNumber - 1)
        .maybeSingle();
      usedTemplateIds = getUsedTemplateIds(prevPlan?.plan_json);
    }

    const planJson = await buildSessionPlanJson({
      sessionNumber: nextSessionNumber,
      totalSessions: progress.total_sessions,
      phase,
      theme,
      timeBudget,
      conditionMood,
      focus: deepSummary.focus,
      avoid: deepSummary.avoid,
      painFlags,
      usedTemplateIds,
      resultType: deepSummary.result_type,
      confidence: deepSummary.confidence,
      scoringVersion: deepSummary.scoring_version,
    });
    const condition = {
      condition_mood: conditionMood,
      time_budget: timeBudget,
      pain_flags: painFlags,
      equipment,
    };

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
