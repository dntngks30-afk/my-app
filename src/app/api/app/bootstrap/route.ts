import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { buildSessionBootstrapSummary } from '@/lib/session/bootstrap-summary';
import { fetchActiveLiteData } from '@/lib/session/active-lite-data';
import { resolveSessionAnalysisInput } from '@/lib/session/resolveSessionAnalysisInput';
import {
  resolveBootstrapNextSessionPreview,
  type NextSessionPreviewPayload,
} from '@/lib/session/next-session-preview';
import { loadRecentAdaptiveSignals } from '@/lib/session/adaptive-progression';
import { loadLatestAdaptiveSummary } from '@/lib/session/adaptive-modifier-resolver';
import { computeAdaptiveModifier } from '@/core/adaptive-engine';
import { generateAdaptiveExplanation } from '@/core/adaptive-explanation';
import { getActiveFlowByUser, type ResetMapFlowRow } from '@/lib/reset-map/activeFlow';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { fetchHomeNodeDisplayBundle } from '@/lib/session/home-node-display-bundle';
import { buildSessionNodeDisplayHydrationItem } from '@/lib/session/session-node-display-hydration-item';
import type { HomeNodeDisplayBundle } from '@/lib/session/client';
import { resolveSyntheticPreviewPhase } from '@/lib/session/phase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AppBootstrapData = {
  user: {
    id: string;
    plan_status: string | null;
  };
  session: {
    active_session: { session_number: number; status: string } | null;
    completed_sessions: number;
    total_sessions: number;
    today_completed?: boolean;
    next_unlock_at?: string | null;
    rail_ready?: boolean;
    progress_source?: 'db' | 'default_fallback';
  };
  next_session: {
    session_number: number;
    focus_axes: string[];
    estimated_time: number;
    exercise_count: number;
    session_rationale: string | null;
    exercises_preview: string[];
  } | null;
  /** PR-ALG-15: Human-readable explanation of adaptive adjustments */
  adaptive_explanation: {
    title: string;
    message: string;
  } | null;
  stats_preview: {
    completed_sessions: number;
    weekly_streak: number;
  };
  /** PR-PERF-21: Reset Map active flow merged into bootstrap to remove waterfall */
  reset_map: {
    active_flow: ResetMapFlowRow | null;
    should_start: boolean;
  };
  /** PR4: home map node display slice (compact; same family as node-display-batch). */
  node_display_bundle?: HomeNodeDisplayBundle;
};

function estimateMinutesFromPlanJson(planJson: unknown): number {
  const segments = (planJson as {
    segments?: Array<{ duration_sec?: number; items?: unknown[] }>;
  } | null)?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return 0;
  const totalSeconds = segments.reduce((sum, segment) => {
    if (typeof segment.duration_sec === 'number' && Number.isFinite(segment.duration_sec)) {
      return sum + segment.duration_sec;
    }
    return sum + (Array.isArray(segment.items) ? segment.items.length * 300 : 0);
  }, 0);
  return Math.max(1, Math.round(totalSeconds / 60));
}

function getWeeklyStreak(progress: { completed_sessions?: number; last_completed_day_key?: string | null } | null): number {
  const completed = progress?.completed_sessions ?? 0;
  const lastDayKey = progress?.last_completed_day_key;
  if (typeof lastDayKey === 'string' && lastDayKey.length >= 10) return 1;
  return completed > 0 ? Math.min(completed, 7) : 0;
}

async function loadNextSessionPreview(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase').getServerSupabaseAdmin>>,
  userId: string,
  activeSession: { session_number: number; status: string } | null,
  session: { completed_sessions: number; total_sessions: number; today_completed?: boolean }
): Promise<NextSessionPreviewPayload | null> {
  try {
    const nextSessionNumber = session.completed_sessions + 1;
    const shouldUseActivePreview =
      activeSession?.session_number != null &&
      session.today_completed !== true &&
      activeSession.session_number > session.completed_sessions &&
      activeSession.session_number === nextSessionNumber;

    if (shouldUseActivePreview && activeSession?.session_number) {
      const { data: row } = await supabase
        .from('session_plans')
        .select('session_number, plan_json')
        .eq('user_id', userId)
        .eq('session_number', activeSession.session_number)
        .maybeSingle();

      const planJson = row?.plan_json as {
        meta?: { session_focus_axes?: string[]; session_rationale?: string | null };
        segments?: Array<{ items?: Array<{ name?: string | null }> }>;
      } | null;

      return resolveBootstrapNextSessionPreview({
        activeSessionPlan: {
          session_number: row?.session_number ?? activeSession.session_number,
          planJson,
          estimatedTime: estimateMinutesFromPlanJson(planJson),
        },
        completedSessions: session.completed_sessions,
        totalSessions: session.total_sessions,
        todayCompleted: session.today_completed,
      });
    }

    if (nextSessionNumber > session.total_sessions) return null;

    const resolvedAnalysisInput = await resolveSessionAnalysisInput(userId);
    if (!resolvedAnalysisInput) return null;

    const summary = await buildSessionBootstrapSummary({
      sessionNumber: nextSessionNumber,
      deepSummary: resolvedAnalysisInput.summary,
    });

    return resolveBootstrapNextSessionPreview({
      completedSessions: session.completed_sessions,
      totalSessions: session.total_sessions,
      todayCompleted: session.today_completed,
      bootstrapSummary: summary,
    });
  } catch (err) {
    console.warn('[app/bootstrap] next_session preview fallback', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const isDebug = req.nextUrl.searchParams.get('debug') === '1';
  const timings: Record<string, number> = {};

  try {
    const userId = await getCurrentUserId(req);
    timings.auth_ms = Math.round(performance.now() - t0);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    const tSession = performance.now();
    const activeLite = await fetchActiveLiteData(supabase, userId);
    timings.session_ms = Math.round(performance.now() - tSession);

    if (!activeLite.ok) {
      return fail(
        activeLite.status,
        (activeLite.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        activeLite.message
      );
    }

    const sessionData = {
      active_session: activeLite.data.active,
      completed_sessions: activeLite.data.progress.completed_sessions ?? 0,
      total_sessions: activeLite.data.progress.total_sessions ?? 16,
      today_completed: activeLite.data.today_completed === true,
      next_unlock_at: activeLite.data.next_unlock_at ?? null,
      rail_ready: activeLite.data.rail_ready === true,
      progress_source: activeLite.data.progress_source ?? 'default_fallback',
    };

    const tResetMap = performance.now();
    const activeFlow = await getActiveFlowByUser(supabase, userId);
    timings.reset_map_ms = Math.round(performance.now() - tResetMap);

    const tNext = performance.now();
    const nextSession = await loadNextSessionPreview(
      supabase,
      userId,
      activeLite.data.active,
      sessionData
    );
    timings.next_session_ms = Math.round(performance.now() - tNext);

    const tNodeDisplay = performance.now();
    let nodeDisplayBundle: HomeNodeDisplayBundle | undefined;
    try {
      const bundle = await fetchHomeNodeDisplayBundle(supabase, userId, {
        totalSessions: sessionData.total_sessions,
        activeSessionNumber: activeLite.data.progress.active_session_number ?? null,
      });
      const items = [...bundle.items];
      const nextNum = Math.min(
        sessionData.completed_sessions + 1,
        sessionData.total_sessions
      );
      if (
        nextNum >= 1 &&
        nextNum <= sessionData.total_sessions &&
        nextSession &&
        nextSession.session_number === nextNum &&
        !items.some((i) => i.session_number === nextNum)
      ) {
        const syntheticMeta: Record<string, unknown> = {
          session_number: nextNum,
          phase: resolveSyntheticPreviewPhase(nextNum, sessionData.total_sessions),
          session_focus_axes: nextSession.focus_axes,
        };
        if (
          typeof nextSession.session_rationale === 'string' &&
          nextSession.session_rationale.trim().length > 0
        ) {
          syntheticMeta.session_rationale = nextSession.session_rationale.trim();
        }
        const base = buildSessionNodeDisplayHydrationItem(nextNum, syntheticMeta);
        items.push({ ...base, source_hint: 'bootstrap' });
        items.sort((a, b) => a.session_number - b.session_number);
      }
      if (items.length > 0) {
        nodeDisplayBundle = { items };
      }
    } catch (err) {
      console.warn('[app/bootstrap] node_display_bundle skipped', err);
    }
    timings.node_display_bundle_ms = Math.round(performance.now() - tNodeDisplay);

    // PR-ALG-15: Adaptive explanation from last session signals
    let adaptiveExplanation: AppBootstrapData['adaptive_explanation'] = null;
    const nextSessionNumber = sessionData.completed_sessions + 1;
    if (
      nextSessionNumber >= 1 &&
      nextSessionNumber <= sessionData.total_sessions
    ) {
      try {
        const { sessionFeedback } = await loadRecentAdaptiveSignals(
          userId,
          nextSessionNumber
        );
        const summary = await loadLatestAdaptiveSummary(supabase, userId);
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
        adaptiveExplanation = generateAdaptiveExplanation(engineModifier);
      } catch (err) {
        console.warn('[app/bootstrap] adaptive_explanation fallback', err);
      }
    }

    const data: AppBootstrapData = {
      user: {
        id: userId,
        plan_status: activeLite.data.plan_status ?? null,
      },
      session: sessionData,
      next_session: nextSession,
      adaptive_explanation: adaptiveExplanation,
      stats_preview: {
        completed_sessions: activeLite.data.progress.completed_sessions ?? 0,
        weekly_streak: getWeeklyStreak(activeLite.data.progress),
      },
      reset_map: {
        active_flow: activeFlow,
        should_start: !activeFlow,
      },
      ...(nodeDisplayBundle ? { node_display_bundle: nodeDisplayBundle } : {}),
    };

    if (isDebug) {
      timings.total_ms = Math.round(performance.now() - t0);
      return ok(data, { timings });
    }

    return ok(data);
  } catch (err) {
    console.error('[app/bootstrap]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
