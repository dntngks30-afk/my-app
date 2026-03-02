/**
 * POST /api/session/create
 *
 * 세션 플랜 멱등 생성 (Deep Result 요약 연결).
 *
 * 동작 순서:
 *   1) auth: userId 확보
 *   2) progress 조회/초기화
 *   3) active_session_number 있으면 기존 plan 그대로 반환 (deep 재조회 없음 — 멱등)
 *   4) next_session_number 결정
 *   5) [NEW] deep_test_attempts에서 최신 final 결과 요약 로드
 *      → 없으면 404 DEEP_RESULT_MISSING
 *   6) 테마/메타 결정 (session_number × deep summary)
 *   7) plan_json stub v2 (meta 포함) 생성
 *   8) session_plans UPSERT + progress.active_session_number 세팅
 *
 * 성능 가드 (금지 목록):
 *   - 템플릿 대량 fetch 없음 (exercise_templates 테이블 접근 없음)
 *   - media sign 호출 없음
 *   - 재계산 알고리즘 없음 (DB 저장값 그대로 사용)
 *
 * 테마 4단계 (session_number 기반):
 *   1~4:  Phase 1 · focus[0] 안정화
 *   5~8:  Phase 2 · focus[1 or 0] 심화
 *   9~12: Phase 3 · 통합
 *   13~16: Phase 4 · 릴렉스
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Auth: Bearer token. Write: service role admin client (RLS bypass).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import type { SessionDeepSummary } from '@/lib/deep-result/session-deep-summary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TOTAL_SESSIONS = 16;

type ConditionMood = 'good' | 'ok' | 'bad';
type TimeBudget = 'short' | 'normal';

// ─── 테마 결정 ────────────────────────────────────────────────────────────────

const PHASE_LABELS = ['1순위 타겟', '2순위 타겟', '통합', '릴렉스'] as const;

/** session_number → 0-based phase index (0~3) */
function getPhaseIndex(sessionNumber: number): number {
  return Math.min(3, Math.floor((sessionNumber - 1) / 4));
}

/**
 * Deep 결과 + session_number → 테마 문자열 결정 (운동명/구체 코드 절대 금지)
 * - Phase 1: "Phase 1 · {focus[0]} 안정화"
 * - Phase 2: "Phase 2 · {focus[1] or focus[0]} 심화"
 * - Phase 3: "Phase 3 · 통합"
 * - Phase 4: "Phase 4 · 릴렉스"
 */
function buildTheme(sessionNumber: number, deep: SessionDeepSummary): string {
  const phaseIdx = getPhaseIndex(sessionNumber);
  const phaseLabel = PHASE_LABELS[phaseIdx];

  if (phaseIdx === 0) {
    const target = deep.focusTags[0] ?? deep.resultType;
    return `Phase 1 · ${target} 안정화`;
  }
  if (phaseIdx === 1) {
    const target = deep.focusTags[1] ?? deep.focusTags[0] ?? deep.resultType;
    return `Phase 2 · ${target} 심화`;
  }
  // Phase 3, 4: 고정 라벨
  return `Phase ${phaseIdx + 1} · ${phaseLabel}`;
}

// ─── plan_json stub v2 ────────────────────────────────────────────────────────

/**
 * plan_json stub v2 생성.
 * meta: deep 결과 요약 포함.
 * items: 구체 운동명 없음 (templateId는 placeholder, 다음 PR에서 실제 연결).
 * condition × time_budget: flags + items 수량/세트 수만 반영.
 */
function buildStubPlanJsonV2(
  sessionNumber: number,
  phase: number,
  theme: string,
  timeBudget: TimeBudget,
  conditionMood: ConditionMood,
  deep: SessionDeepSummary
) {
  const isShort = timeBudget === 'short';
  const isRecovery = conditionMood === 'bad';
  const sets = isShort ? 2 : 3;
  const mainItems = isShort ? 2 : 4;

  return {
    version: 'session_stub_v2',
    meta: {
      session_number: sessionNumber,
      phase,
      result_type: deep.resultType,
      confidence: deep.confidence,
      focus: deep.focusTags.slice(0, 4),
      avoid: deep.avoidTags.slice(0, 4),
      scoring_version: deep.scoringVersion,
    },
    flags: {
      recovery: isRecovery,
      short: isShort,
    },
    segments: [
      {
        title: 'Prep',
        duration_sec: isShort ? 120 : 180,
        items: Array.from({ length: isShort ? 2 : 3 }, (_, i) => ({
          order: i + 1,
          templateId: `stub_prep_${i + 1}`,
          name: `준비 ${i + 1}`,
          sets: 1,
          reps: 10,
        })),
      },
      {
        title: 'Main',
        duration_sec: isShort ? 240 : 420,
        items: Array.from({ length: mainItems }, (_, i) => ({
          order: i + 1,
          templateId: `stub_main_p${phase}_${i + 1}`,
          name: isRecovery ? `회복 운동 ${i + 1}` : `${theme} ${i + 1}`,
          sets,
          reps: isRecovery ? 8 : 12,
          focus_tag: deep.focusTags[i % deep.focusTags.length] ?? null,
        })),
      },
      {
        title: 'Release',
        duration_sec: isShort ? 60 : 120,
        items: Array.from({ length: isShort ? 1 : 2 }, (_, i) => ({
          order: i + 1,
          templateId: `stub_release_${i + 1}`,
          name: `이완 ${i + 1}`,
          sets: 1,
          hold_seconds: 30,
        })),
      },
    ],
  };
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

    // ── 멱등: active session이 이미 있으면 deep 재조회 없이 그대로 반환 ──
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
      const res = NextResponse.json({ done: true, progress });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    // ── [NEW] Deep Result 요약 로드 (next 생성 시점에만) ──────────────────────
    // 성능 가드: SELECT 5개 컬럼, LIMIT 1, 재계산 없음
    const deepSummary = await loadSessionDeepSummary(supabase, userId);

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
    const phase = phaseIndex + 1;
    const theme = buildTheme(nextSessionNumber, deepSummary);
    const planJson = buildStubPlanJsonV2(
      nextSessionNumber,
      phase,
      theme,
      timeBudget,
      conditionMood,
      deepSummary
    );
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
