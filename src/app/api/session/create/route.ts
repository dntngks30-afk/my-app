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
 *   6) 최근 K세션 plan_json에서 used_template_ids 로드 (반복 방지)
 *   7) exercise_templates 조회 → 스코어링 → plan_json 생성 (BE-06)
 *   8) session_plans UPSERT + progress.active_session_number 세팅
 *
 * BE-06: exercise_templates(28) 기반, safety gate, repetition penalty.
 * media sign 호출 없음.
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Auth: Bearer token. Write: service role admin client (RLS bypass).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { getLatestClaimedPublicResultForUser } from '@/lib/public-results/getLatestClaimedPublicResultForUser';
import { buildSessionDeepSummaryFromPublicResult } from '@/lib/deep-result/buildSessionDeepSummaryFromPublicResult';
import { buildSessionPlanJson } from '@/lib/session/plan-generator';
import {
  computeAdaptiveModifier,
  getAvoidTagsForDiscomfort,
} from '@/core/adaptive-engine';
import {
  PLAN_VERSION,
  buildDeepSummarySnapshot,
  buildProfileSnapshot,
  buildGenerationTrace,
} from '@/lib/session/session-snapshot';
import {
  loadRecentAdaptiveSignals,
  deriveAdaptiveModifiers,
  buildAdaptationTrace,
} from '@/lib/session/adaptive-progression';
import {
  loadLatestAdaptiveSummary,
  resolveAdaptiveModifier,
} from '@/lib/session/adaptive-modifier-resolver';
import { resolveAdaptiveMerge } from '@/lib/session/adaptive-merge';
import { getKstDayKeyUTC, getNextKstMidnightUtcIso, getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import { logSessionEvent } from '@/lib/session-events';
import { buildDedupeKey, tryAcquireDedupe } from '@/lib/request-dedupe';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import {
  computePhase,
  resolvePhaseLengths,
  isAdaptivePhasePolicy,
  resolvePhasePolicyReason,
  type PhaseLengths,
  type PhasePolicyOptions,
} from '@/lib/session/phase';
import { getCachedPlan, setCachedPlan } from '@/lib/session-gen-cache';
import { isValidExerciseExperienceLevel } from '@/lib/session/profile';

const ROUTE_CREATE = '/api/session/create';

/** 최근 K세션 plan_json에서 used_template_ids 수집 (반복 억제). clamp 1..8 */
const USED_WINDOW_K = 4;

/** Panel first render용: plan_json을 segments만 남긴 경량 형태로 변환 */
function toSummaryPlan(
  plan: { session_number: number; status: string; theme: string; plan_json: unknown; condition: unknown },
  adaptationTrace?: { reason_summary?: string } | null
): typeof plan {
  const pj = plan.plan_json as {
    meta?: {
      focus?: string[];
      priority_vector?: Record<string, number>;
      pain_mode?: 'none' | 'caution' | 'protected';
      /** PR-FIRST-SESSION-EXPLANATION-01: plan-generator 산출 — summary 응답에서도 패널 rationale에 전달 */
      session_rationale?: string | null;
      session_focus_axes?: string[];
      primary_type?: string;
      result_type?: string;
      constraint_flags?: { first_session_guardrail_applied?: boolean };
    };
    segments?: Array<{ title?: string; items?: Array<{ templateId?: string; name?: string; order?: number; sets?: number; reps?: number; hold_seconds?: number }> }>
  } | null;
  const segments = (pj?.segments ?? []).map((seg) => ({
    title: seg.title ?? '',
    items: (seg.items ?? []).map((it) => ({
      templateId: it.templateId ?? '',
      name: it.name ?? '',
      order: it.order ?? 0,
      sets: it.sets,
      reps: it.reps,
      hold_seconds: it.hold_seconds,
    })),
  }));
  const meta: Record<string, unknown> = {};
  if (pj?.meta) {
    if (Array.isArray(pj.meta.focus)) meta.focus = pj.meta.focus.slice(0, 3);
    if (pj.meta.priority_vector) meta.priority_vector = pj.meta.priority_vector;
    if (pj.meta.pain_mode) meta.pain_mode = pj.meta.pain_mode;
    // PR-FIRST-SESSION-EXPLANATION-01: 생성기가 이미 넣은 설명 메타만 통과 (재생성 없음)
    if (typeof pj.meta.session_rationale === 'string') {
      meta.session_rationale = pj.meta.session_rationale;
    }
    if (Array.isArray(pj.meta.session_focus_axes) && pj.meta.session_focus_axes.length > 0) {
      meta.session_focus_axes = pj.meta.session_focus_axes.slice(0, 8);
    }
    if (typeof pj.meta.primary_type === 'string' && pj.meta.primary_type.length > 0) {
      meta.primary_type = pj.meta.primary_type;
    }
    if (typeof pj.meta.result_type === 'string' && pj.meta.result_type.length > 0) {
      meta.result_type = pj.meta.result_type;
    }
    const cf = pj.meta.constraint_flags;
    if (cf && typeof cf === 'object' && typeof cf.first_session_guardrail_applied === 'boolean') {
      meta.constraint_flags = { first_session_guardrail_applied: cf.first_session_guardrail_applied };
    }
  }
  if (adaptationTrace?.reason_summary) meta.adaptation_summary = adaptationTrace.reason_summary;

  return {
    ...plan,
    plan_json: {
      ...(Object.keys(meta).length > 0 && { meta }),
      segments,
    },
  };
}

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
/** PR-FIRST-SESSION-QUALITY-02A: exercise_experience_level 동행 조회(세션 1 품질만). */
async function resolveTotalSessions(
  supabase: Awaited<ReturnType<typeof getServerSupabaseAdmin>>,
  userId: string
): Promise<{
  totalSessions: number;
  source: 'profile' | 'default';
  profile: { target_frequency?: number; exercise_experience_level?: string | null } | null;
}> {
  const { data } = await supabase
    .from('session_user_profile')
    .select('target_frequency, exercise_experience_level')
    .eq('user_id', userId)
    .maybeSingle();

  const freq = data?.target_frequency;
  if (typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL) {
    return { totalSessions: FREQUENCY_TO_TOTAL[freq], source: 'profile', profile: data };
  }
  return { totalSessions: DEFAULT_TOTAL_SESSIONS, source: 'default', profile: data };
}

type ConditionMood = 'good' | 'ok' | 'bad';
type TimeBudget = 'short' | 'normal';

// ─── 테마 결정 ────────────────────────────────────────────────────────────────

const PHASE_LABELS = ['1순위 타겟', '2순위 타겟', '통합', '릴렉스'] as const;

/** session_number → 0-based phase index (0~3). phase_lengths 또는 options 기반. */
function getPhaseIndex(
  sessionNumber: number,
  totalSessions: number,
  options?: { phaseLengths?: PhaseLengths | null; policyOptions?: PhasePolicyOptions | null }
): number {
  return computePhase(totalSessions, sessionNumber, options) - 1;
}

/** generation_trace_json에서 phase_lengths 추출. 유효하면 반환. */
function getPhaseLengthsFromTrace(trace: unknown): PhaseLengths | null {
  if (!trace || typeof trace !== 'object') return null;
  const arr = (trace as Record<string, unknown>).phase_lengths;
  if (!Array.isArray(arr) || arr.length !== 4) return null;
  const nums = arr.map((x) => (typeof x === 'number' && Number.isInteger(x) && x >= 1 ? x : null));
  if (nums.some((n) => n === null)) return null;
  const sum = (nums as number[]).reduce((a, b) => a + b, 0);
  if (sum < 4 || sum > 20) return null;
  return nums as PhaseLengths;
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
  totalSessions: number,
  deep: { result_type: string; focus: string[] },
  options?: { phaseLengths?: PhaseLengths | null; policyOptions?: PhasePolicyOptions | null }
): string {
  const phaseIdx = getPhaseIndex(sessionNumber, totalSessions, options);
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
  const t0 = performance.now();
  const timings: Record<string, number> = {};

  try {
    const userId = await getCurrentUserId(req);
    timings.auth_ms = Math.round(performance.now() - t0);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const tDedupe = performance.now();
    const headerKey = req.headers.get('Idempotency-Key') ?? null;
    const kstDay = getKstDayKeyUTC();
    const dedupeKey = buildDedupeKey({ route: ROUTE_CREATE, userId, kstDay, headerKey });
    const supabase = getServerSupabaseAdmin();
    const acquired = await tryAcquireDedupe(supabase, {
      route: ROUTE_CREATE,
      userId,
      dedupeKey,
      kstDay,
      ttlSeconds: 10,
    });
    timings.dedupe_ms = Math.round(performance.now() - tDedupe);
    if (!acquired) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'request_deduped',
        status: 'blocked',
        code: 'REQUEST_DEDUPED',
        meta: { route: ROUTE_CREATE },
      });
      return fail(409, ApiErrorCode.REQUEST_DEDUPED, '요청이 처리 중입니다. 잠시 후 다시 시도하세요');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const isDebug = body.debug === true || new URL(req.url ?? '').searchParams.get('debug') === '1';

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

    const tProgress = performance.now();
    // progress 조회 — 없으면 자동 생성 (BE-ONB-02: profile 기반 total_sessions)
    let { data: progress } = await supabase
      .from('session_program_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    timings.progress_read_ms = Math.round(performance.now() - tProgress);

    if (!progress) {
      const resolved = await resolveTotalSessions(supabase, userId);
      if (resolved.source === 'default') {
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_blocked',
          status: 'blocked',
          code: 'FREQUENCY_REQUIRED',
          meta: {
            profile_present: !!resolved.profile,
            target_frequency: resolved.profile?.target_frequency ?? null,
            fallback_blocked: true,
          },
        });
        return fail(
          409,
          ApiErrorCode.FREQUENCY_REQUIRED,
          '주당 목표 빈도를 먼저 설정해 주세요. 심층 테스트 결과 보기에서 빈도를 선택한 후 다시 시도해 주세요.',
          { fallback_blocked: true, rail_ready: false }
        );
      }
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
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_blocked',
          status: 'error',
          code: 'DB_ERROR',
          meta: { message_short: 'progress init failed' },
        });
        return fail(500, ApiErrorCode.INTERNAL_ERROR, '진행 상태 초기화에 실패했습니다');
      }
      progress = created;
    }
    timings.progress_db_ms = Math.round(performance.now() - tProgress);

    // P0-09: 프로그램 종료 — completed_sessions >= total_sessions 이면 create 차단
    const totalSessions = progress.total_sessions ?? 16;
    const completedCount = progress.completed_sessions ?? 0;
    if (completedCount >= totalSessions) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'blocked',
        code: 'PROGRAM_FINISHED',
        meta: { total_sessions: totalSessions, completed_sessions: completedCount },
      });
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, '모든 세션을 완료했습니다');
    }

    // P0-09: active_session_number > total_sessions 이면 정리 후 차단
    const activeNum = progress.active_session_number;
    if (activeNum != null && activeNum > totalSessions) {
      await supabase
        .from('session_program_progress')
        .update({ active_session_number: null })
        .eq('user_id', userId);
      progress = { ...progress, active_session_number: null };
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'blocked',
        code: 'PROGRAM_FINISHED',
        meta: { total_sessions: totalSessions, active_session_number: activeNum },
      });
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, '모든 세션을 완료했습니다');
    }

    const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(progress);

    // Daily cap: 오늘 완료했으면 create 차단 (SSOT)
    if (todayCompleted) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'blocked',
        code: 'DAILY_LIMIT_REACHED',
        meta: { day_key: getKstDayKeyUTC() },
      });
      const nextUnlock = nextUnlockAt ?? getNextKstMidnightUtcIso();
      const kstDay = getKstDayKeyUTC();
      return fail(
        409,
        ApiErrorCode.DAILY_LIMIT_REACHED,
        '오늘은 이미 완료했습니다',
        { next_unlock_at: nextUnlock, kst_day: kstDay },
        { next_unlock_at: nextUnlock }
      );
    }

    // ── 멱등: active session이 이미 있으면 profile 조회 없이 그대로 반환 ──
    if (progress.active_session_number) {
      const { data: existingPlan } = await supabase
        .from('session_plans')
        .select('session_number, status, theme, plan_json, condition')
        .eq('user_id', userId)
        .eq('session_number', progress.active_session_number)
        .maybeSingle();

      // empty draft 판정: 과거 버그로 segments=[] 로 저장된 plan은 재생성 허용
      const pj = existingPlan?.plan_json as { segments?: unknown[] } | null | undefined;
      const isEmptyDraft =
        existingPlan?.status === 'draft' &&
        (!Array.isArray(pj?.segments) || (pj?.segments as unknown[]).length === 0);

      if (!isEmptyDraft) {
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_idempotent',
          status: 'ok',
          sessionNumber: progress.active_session_number,
          meta: { reason: 'active_exists' },
        });
        const active = existingPlan ? toSummaryPlan(existingPlan) : null;
        const data = { progress, active, idempotent: true, today_completed: todayCompleted, ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }) };
        return ok(data, data);
      }

      // empty draft → 재생성 경로로 fall-through (active_session_number 로컬 클리어)
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create',
        status: 'ok',
        sessionNumber: progress.active_session_number,
        meta: { reason: 'empty_draft_recovery' },
      });
      progress = { ...progress, active_session_number: null };
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
      console.warn('[session/create] sync skipped: resolved < completed_sessions', {
        resolved_total: resolved.totalSessions,
        completed_sessions: completed,
        profile_present: !!resolved.profile,
      });
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create',
        status: 'ok',
        meta: {
          sync_skipped: true,
          reason: 'resolved_total_sessions_lt_completed',
          resolved_total: resolved.totalSessions,
          completed_sessions: completed,
        },
      });
    }

    const nextSessionNumber = progress.completed_sessions + 1;
    if (nextSessionNumber > progress.total_sessions) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'blocked',
        code: 'PROGRAM_FINISHED',
        meta: { total_sessions: progress.total_sessions, completed_sessions: progress.completed_sessions },
      });
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, '모든 세션을 완료했습니다');
    }

    // ── [FLOW-06] Analysis Input 해결 ─────────────────────────────────────────
    // 우선순위 1: claimed public result (public-first 경로)
    // 우선순위 2: legacy paid deep_test_attempts final (backward compatibility)
    // 둘 다 없으면: ANALYSIS_INPUT_UNAVAILABLE
    const tDeep = performance.now();

    let deepSummary = null as Awaited<ReturnType<typeof loadSessionDeepSummary>>;
    let analysisSourceMode: 'public_result' | 'legacy_paid_deep' | null = null;
    let sourcePublicResultId: string | null = null;

    // 1. 공개 결과 경로 시도 (claim 완료된 public result)
    const claimedPublicResult = await getLatestClaimedPublicResultForUser(userId);
    if (claimedPublicResult) {
      const adapted = buildSessionDeepSummaryFromPublicResult(claimedPublicResult);
      deepSummary = adapted;
      analysisSourceMode = 'public_result';
      sourcePublicResultId = claimedPublicResult.id;
    }

    // 2. Legacy fallback: paid deep_test_attempts
    if (!deepSummary) {
      deepSummary = await loadSessionDeepSummary(userId);
      if (deepSummary) {
        analysisSourceMode = 'legacy_paid_deep';
      }
    }

    timings.deep_profile_ms = Math.round(performance.now() - tDeep);
    timings.deep_load_ms = timings.deep_profile_ms;

    // 3. 입력 없음 → 명시적 에러
    if (!deepSummary) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'blocked',
        code: 'ANALYSIS_INPUT_UNAVAILABLE',
        meta: { public_result_found: false, legacy_deep_found: false },
      });
      return fail(
        404,
        ApiErrorCode.ANALYSIS_INPUT_UNAVAILABLE,
        '분석 결과가 없습니다. 무료 테스트를 완료하거나 심층 테스트를 먼저 진행해 주세요.'
      );
    }

    const totalSessionsForPhase = progress.total_sessions ?? DEFAULT_TOTAL_SESSIONS;
    const policyOptions: PhasePolicyOptions = {
      deepLevel: deepSummary.deep_level ?? null,
      safetyMode: deepSummary.safety_mode ?? null,
      redFlags: deepSummary.red_flags ?? null,
    };

    let phaseLengths: PhaseLengths | null = null;
    if (nextSessionNumber > 1) {
      const { data: prevPlan } = await supabase
        .from('session_plans')
        .select('generation_trace_json')
        .eq('user_id', userId)
        .eq('session_number', nextSessionNumber - 1)
        .maybeSingle();
      phaseLengths = getPhaseLengthsFromTrace(prevPlan?.generation_trace_json);
    }
    if (!phaseLengths) {
      phaseLengths = resolvePhaseLengths(totalSessionsForPhase, policyOptions);
    }

    const phase = computePhase(totalSessionsForPhase, nextSessionNumber, { phaseLengths });
    const theme = buildTheme(nextSessionNumber, totalSessionsForPhase, deepSummary, {
      phaseLengths,
      policyOptions,
    });

    let usedTemplateIds: string[] = [];
    if (nextSessionNumber > 1) {
      const K = Math.max(1, Math.min(8, USED_WINDOW_K));
      const { data: plans } = await supabase
        .from('session_plans')
        .select('plan_json')
        .eq('user_id', userId)
        .lt('session_number', nextSessionNumber)
        .order('session_number', { ascending: false })
        .limit(K);
      const usedSet = new Set<string>();
      for (const row of plans ?? []) {
        for (const id of getUsedTemplateIds(row?.plan_json)) {
          usedSet.add(id);
        }
      }
      usedTemplateIds = Array.from(usedSet);
    }

    const tAdaptive = performance.now();
    const { sessionFeedback, exerciseFeedback, sourceSessionNumbers } =
      await loadRecentAdaptiveSignals(userId, nextSessionNumber);
    timings.adaptive_load_ms = Math.round(performance.now() - tAdaptive);

    const adaptiveCtx = {
      priority_vector: deepSummary.priority_vector ?? null,
      pain_mode: deepSummary.pain_mode ?? null,
    };
    const modifiers = deriveAdaptiveModifiers(
      sessionFeedback,
      exerciseFeedback,
      sourceSessionNumbers,
      adaptiveCtx
    );

    // PR-02: centralized merge (progression + summary modifier)
    const tAdaptiveMod = performance.now();
    const summary = await loadLatestAdaptiveSummary(supabase, userId);
    const adaptiveModifier = resolveAdaptiveModifier(summary);
    let mergedControls = resolveAdaptiveMerge({
      progression: modifiers,
      modifier: adaptiveModifier,
      summary: summary ? { flags: summary.flags, created_at: summary.created_at } : null,
    });

    // PR-ALG-12: Adaptive Engine v1 — merge execution-signal modifier
    const engineModifier = computeAdaptiveModifier({
      sessionFeedback: sessionFeedback.map((f) => ({
        session_number: f.session_number,
        overall_rpe: f.overall_rpe,
        pain_after: f.pain_after,
        difficulty_feedback: f.difficulty_feedback,
        completion_ratio: f.completion_ratio,
        body_state_change: f.body_state_change,
        discomfort_area: f.discomfort_area,
      })),
      adaptiveSummary: summary
        ? {
            completion_ratio: summary.completion_ratio,
            skipped_exercises: summary.skipped_exercises,
            avg_rpe: summary.avg_rpe,
            avg_discomfort: summary.avg_discomfort,
            dropout_risk_score: summary.dropout_risk_score,
            discomfort_burden_score: summary.discomfort_burden_score,
          }
        : null,
    });

    if (engineModifier.protection_mode) {
      const baseOverlay = mergedControls.overlay ?? {};
      mergedControls = {
        ...mergedControls,
        forceRecovery: true,
        overlay: {
          ...baseOverlay,
          forceRecovery: true,
          targetLevelDelta: -1 as const,
          ...(baseOverlay.maxDifficultyCap ? {} : { maxDifficultyCap: 'medium' as const }),
        },
      };
    }
    if (engineModifier.volume_modifier === -1 && (mergedControls.volumeModifier ?? 0) > -0.2) {
      mergedControls = {
        ...mergedControls,
        volumeModifier: Math.min(mergedControls.volumeModifier ?? 0, -0.2),
      };
    }
    if (engineModifier.difficulty_modifier === -1 && !mergedControls.maxDifficultyCap) {
      mergedControls = {
        ...mergedControls,
        maxDifficultyCap: 'medium' as const,
        overlay: {
          ...mergedControls.overlay,
          maxDifficultyCap: 'medium' as const,
        } as typeof mergedControls.overlay,
      };
    }

    let effectivePainFlags = [...painFlags];
    const discomfortAvoid = getAvoidTagsForDiscomfort(engineModifier.discomfort_area);
    for (const tag of discomfortAvoid) {
      if (!effectivePainFlags.includes(tag)) effectivePainFlags.push(tag);
    }

    const adaptiveOverlay = mergedControls.overlay;
    const mergedVolume = mergedControls.volumeModifier;
    timings.adaptive_modifier_ms = Math.round(performance.now() - tAdaptiveMod);

    /** 세션 1만: 온보딩 운동 경험 → plan-generator 보수 티어 (유효 값만). */
    const exerciseExperienceForSession1 =
      nextSessionNumber === 1 &&
      resolved.profile &&
      isValidExerciseExperienceLevel(resolved.profile.exercise_experience_level)
        ? resolved.profile.exercise_experience_level
        : undefined;

    const cacheInput = {
      userId,
      sessionNumber: nextSessionNumber,
      totalSessions: progress.total_sessions ?? DEFAULT_TOTAL_SESSIONS,
      phase,
      theme,
      timeBudget,
      conditionMood,
      focus: deepSummary.focus ?? [],
      avoid: deepSummary.avoid ?? [],
      painFlags: effectivePainFlags,
      usedTemplateIds,
      adaptiveOverlay: adaptiveOverlay ?? undefined,
      volumeModifier: mergedVolume,
      priority_vector: deepSummary.priority_vector ?? undefined,
      pain_mode: deepSummary.pain_mode ?? undefined,
      exercise_experience_level: exerciseExperienceForSession1,
      /** PR-SURVEY-05: 세션 1 설문 힌트가 캐시 키에 포함되어야 동일 입력 동일 플랜 */
      survey_session_hints: deepSummary.survey_session_hints ?? null,
    };

    const tGen = performance.now();
    let planJson = getCachedPlan(cacheInput);
    if (!planJson) {
      planJson = await buildSessionPlanJson({
        sessionNumber: nextSessionNumber,
        totalSessions: progress.total_sessions,
        phase,
        theme,
        timeBudget,
        conditionMood,
        focus: deepSummary.focus,
        avoid: deepSummary.avoid,
        painFlags: effectivePainFlags,
        usedTemplateIds,
        resultType: deepSummary.result_type,
        confidence: deepSummary.effective_confidence ?? deepSummary.confidence,
        scoringVersion: deepSummary.scoring_version,
        deep_level: deepSummary.deep_level,
        pain_risk: deepSummary.pain_risk,
        red_flags: deepSummary.red_flags,
        safety_mode: deepSummary.safety_mode,
        primary_type: deepSummary.primary_type,
        secondary_type: deepSummary.secondary_type,
        priority_vector: deepSummary.priority_vector,
        pain_mode: deepSummary.pain_mode,
        adaptiveOverlay,
        volumeModifier: mergedVolume,
        exercise_experience_level: exerciseExperienceForSession1,
        survey_session_hints: deepSummary.survey_session_hints,
      });
      setCachedPlan(cacheInput, planJson as Record<string, unknown>);
    }
    timings.generation_ms = Math.round(performance.now() - tGen);

    const tSer = performance.now();
    JSON.stringify(planJson);
    timings.serialization_ms = Math.round(performance.now() - tSer);
    const condition = {
      condition_mood: conditionMood,
      time_budget: timeBudget,
      pain_flags: effectivePainFlags,
      equipment,
    };

    const confidenceSource =
      deepSummary.effective_confidence !== undefined && deepSummary.effective_confidence !== null
        ? ('effective_confidence' as const)
        : ('legacy_confidence' as const);
    const deepSummarySnapshot = buildDeepSummarySnapshot(deepSummary);
    const profileSnapshot = buildProfileSnapshot(resolved.profile, totalSessionsForPhase);
    const phasePolicy = isAdaptivePhasePolicy(policyOptions) ? 'front_loaded' : 'equal';
    const phasePolicyReason = resolvePhasePolicyReason(policyOptions);
    const baseTrace = buildGenerationTrace({
      sessionNumber: nextSessionNumber,
      totalSessions: totalSessionsForPhase,
      phase,
      theme,
      confidenceSource,
      scoringVersion: deepSummary.scoring_version,
      safetyMode: deepSummary.safety_mode,
      primaryFocus: deepSummary.primaryFocus,
      secondaryFocus: deepSummary.secondaryFocus,
      phaseLengths,
      phasePolicy,
      phasePolicyReason,
    });
    const traceModifiers = {
      ...modifiers,
      targetLevelDelta: mergedControls.targetLevelDelta,
      forceShort: mergedControls.forceShort,
      forceRecovery: mergedControls.forceRecovery,
      avoidExerciseKeys: mergedControls.avoidTemplateIds,
      maxDifficultyCap: mergedControls.maxDifficultyCap,
    };
    let adaptationTrace = buildAdaptationTrace(
      traceModifiers,
      sourceSessionNumbers,
      adaptiveCtx
    );
    if (summary) {
      const triggerReasons: string[] = [];
      if (summary.completion_ratio < 0.6) triggerReasons.push('completion_ratio_low');
      else if (summary.completion_ratio < 0.8) triggerReasons.push('completion_ratio_moderate');
      if (summary.skipped_exercises >= 2) triggerReasons.push('skipped_exercises_high');
      if (summary.dropout_risk_score >= 50) triggerReasons.push('dropout_risk_high');
      if (summary.discomfort_burden_score >= 60) triggerReasons.push('discomfort_burden_high');
      adaptationTrace = {
        ...adaptationTrace,
        event_based_summary: {
          completion_ratio: summary.completion_ratio,
          avg_rpe: summary.avg_rpe,
          avg_discomfort: summary.avg_discomfort,
          dropout_risk_score: summary.dropout_risk_score,
          discomfort_burden_score: summary.discomfort_burden_score,
          flags: summary.flags,
          trigger_reasons: triggerReasons.length > 0 ? triggerReasons : undefined,
        },
      };
    }
    const generationTrace = {
      ...baseTrace,
      adaptation: adaptationTrace,
    };

    // completed row 덮어쓰기 금지: status IN ('draft','started')일 때만 갱신
    const { data: existingPlan } = await supabase
      .from('session_plans')
      .select('session_number, status, theme, plan_json, condition')
      .eq('user_id', userId)
      .eq('session_number', nextSessionNumber)
      .maybeSingle();

    if (existingPlan?.status === 'completed') {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_idempotent',
        status: 'ok',
        sessionNumber: nextSessionNumber,
        meta: { reason: 'conflict_return' },
      });
      const active = toSummaryPlan(existingPlan);
      const data = { progress, active, idempotent: true, today_completed: todayCompleted, ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }) };
      return ok(data, data);
    }

    const planPayload = {
      user_id: userId,
      session_number: nextSessionNumber,
      status: 'draft' as const,
      theme,
      plan_json: planJson,
      condition,
      plan_version: PLAN_VERSION,
      // FLOW-06: public result 경로면 source_deep_attempt_id는 null, public result id는 trace에 기록
      source_deep_attempt_id: deepSummary.source_deep_attempt_id ?? null,
      deep_summary_snapshot_json: deepSummarySnapshot,
      profile_snapshot_json: profileSnapshot,
      generation_trace_json: {
        ...generationTrace,
        // FLOW-06 관찰가능성: 분석 입력 소스 기록
        analysis_source_mode: analysisSourceMode,
        ...(sourcePublicResultId && { source_public_result_id: sourcePublicResultId }),
      },
    };

    const tPlanWrite = performance.now();
    let plan: typeof existingPlan;
    if (existingPlan && (existingPlan.status === 'draft' || existingPlan.status === 'started')) {
      const { data: updated, error: updateErr } = await supabase
        .from('session_plans')
        .update({
          theme: planPayload.theme,
          plan_json: planPayload.plan_json,
          condition: planPayload.condition,
          generation_trace_json: planPayload.generation_trace_json,
        })
        .eq('user_id', userId)
        .eq('session_number', nextSessionNumber)
        .in('status', ['draft', 'started'])
        .select('session_number, status, theme, plan_json, condition')
        .maybeSingle();

      if (updateErr) {
        console.error('[session/create] plan update failed', updateErr);
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_blocked',
          status: 'error',
          code: 'DB_ERROR',
          meta: { message_short: 'plan update failed' },
        });
        return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 업데이트에 실패했습니다');
      }
      plan = updated ?? existingPlan;
      timings.plan_write_ms = Math.round(performance.now() - tPlanWrite);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('session_plans')
        .insert(planPayload)
        .select('session_number, status, theme, plan_json, condition')
        .maybeSingle();

      if (insertErr) {
        if (insertErr.code === '23505') {
          const [{ data: raced }, { data: prog }] = await Promise.all([
            supabase
              .from('session_plans')
              .select('session_number, status, theme, plan_json, condition')
              .eq('user_id', userId)
              .eq('session_number', nextSessionNumber)
              .maybeSingle(),
            supabase
              .from('session_program_progress')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle(),
          ]);
          if (raced) {
            void logSessionEvent(supabase, {
              userId,
              eventType: 'session_create_idempotent',
              status: 'ok',
              sessionNumber: nextSessionNumber,
              meta: { reason: 'conflict_return' },
            });
            const p = prog ?? { ...progress, active_session_number: nextSessionNumber };
            const { todayCompleted: tc, nextUnlockAt: nua } = getTodayCompletedAndNextUnlock(p);
            const active = toSummaryPlan(raced);
            const data = { progress: p, active, idempotent: true, today_completed: tc, ...(nua != null && { next_unlock_at: nua }) };
            return ok(data, data);
          }
        }
        console.error('[session/create] plan insert failed', insertErr);
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_blocked',
          status: 'error',
          code: 'DB_ERROR',
          meta: { message_short: 'plan insert failed' },
        });
        return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 생성에 실패했습니다');
      }
      plan = inserted;
      timings.plan_write_ms = Math.round(performance.now() - tPlanWrite);
    }

    if (!plan) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_create_blocked',
        status: 'error',
        code: 'DB_ERROR',
        meta: { message_short: 'plan not found after insert' },
      });
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜을 가져올 수 없습니다');
    }

    const { data: updatedProgress, error: progressErr } = await supabase
      .from('session_program_progress')
      .update({ active_session_number: nextSessionNumber })
      .eq('user_id', userId)
      .select()
      .single();

    if (progressErr) {
      console.error('[session/create] progress update failed', progressErr);
    }

    const finalProgress = updatedProgress ?? { ...progress, active_session_number: nextSessionNumber };
    const { todayCompleted: tc, nextUnlockAt: nua } = getTodayCompletedAndNextUnlock(finalProgress);

    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create',
      status: 'ok',
      sessionNumber: nextSessionNumber,
      meta: {
        total_sessions: finalProgress.total_sessions,
        completed_sessions_before: progress.completed_sessions,
        // FLOW-06: 입력 소스 관찰가능성
        analysis_source_mode: analysisSourceMode,
        ...(sourcePublicResultId && { source_public_result_id: sourcePublicResultId }),
      },
    });

    timings.total_ms = Math.round(performance.now() - t0);
    if (isDebug && process.env.NODE_ENV !== 'production') {
      console.info('[session/create] perf', timings);
    }

    const active = toSummaryPlan(plan, adaptationTrace);
    const data = { progress: finalProgress, active, idempotent: false, today_completed: tc, ...(nua != null && { next_unlock_at: nua }) };
    const pjMeta = planJson && typeof planJson === 'object' && 'meta' in planJson
      ? (planJson as { meta?: { constraint_engine?: { reasons?: unknown[]; flags?: Record<string, boolean>; summary?: Record<string, unknown>; applied_rule_count?: number } } }).meta
      : undefined;
    const debugExtras = isDebug
      ? {
          debug: {
            ...timings,
            freq_source: resolved.source,
            profile_present: !!resolved.profile,
            target_frequency: resolved.profile?.target_frequency ?? null,
            ...(pjMeta?.constraint_engine && {
              constraint_engine: {
                reasons: pjMeta.constraint_engine.reasons ?? [],
                flags: pjMeta.constraint_engine.flags ?? {},
                summary: pjMeta.constraint_engine.summary ?? {},
                applied_rule_count: pjMeta.constraint_engine.applied_rule_count ?? 0,
              },
            }),
            ...(adaptiveModifier && {
              adaptive_modifier: {
                volume_modifier: adaptiveModifier.volume_modifier,
                complexity_cap: adaptiveModifier.complexity_cap,
                recovery_bias: adaptiveModifier.recovery_bias,
              },
            }),
            adaptive_consumption_trace: {
              summary_consumed: summary
                ? { id: summary.id, created_at: summary.created_at, flags: summary.flags }
                : null,
              modifier: adaptiveModifier
                ? {
                    volume_modifier: adaptiveModifier.volume_modifier,
                    complexity_cap: adaptiveModifier.complexity_cap,
                    recovery_bias: adaptiveModifier.recovery_bias,
                  }
                : null,
              merged_controls: {
                targetLevelDelta: mergedControls.targetLevelDelta,
                forceShort: mergedControls.forceShort,
                forceRecovery: mergedControls.forceRecovery,
                avoidTemplateIds: mergedControls.avoidTemplateIds,
                maxDifficultyCap: mergedControls.maxDifficultyCap,
                volumeModifier: mergedVolume,
              },
              merge_reasons: mergedControls.reasons,
              sources: mergedControls.sources,
            },
          },
        }
      : undefined;
    return ok(data, debugExtras);
  } catch (err) {
    console.error('[session/create]', err);
    try {
      const userId = await getCurrentUserId(req);
      if (userId) {
        const supabase = getServerSupabaseAdmin();
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_blocked',
          status: 'error',
          code: 'INTERNAL',
          meta: { message_short: err instanceof Error ? err.message : '서버 오류' },
        });
      }
    } catch (_) { /* noop */ }
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
