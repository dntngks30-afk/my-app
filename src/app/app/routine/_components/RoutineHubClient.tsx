'use client';

/**
 * RoutineHubClient — 루틴 탭 메인 (리디자인)
 *
 * 레이아웃: Today 헤더 → CalendarPills → TodayGoalCard → CTA → Accordion(모달 확정 후)
 * CTA 클릭 → 오늘 컨디션 조정 모달 → 확정(리셋 시작) 시에만 create 또는 표시.
 *
 * Network: GET active 1x, GET history 1x, POST create는 모달 확정 시에만.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Bell, Play, Sparkles, CheckCircle2, Home, BarChart2 } from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
import { NeoButton } from '@/components/neobrutalism';
import BottomNav from '../../_components/BottomNav';
import CalendarPills from './CalendarPills';
import TodayGoalCard from './TodayGoalCard';
import RoutineAccordionList from './RoutineAccordionList';
import SessionAdjustModal from './SessionAdjustModal';
import SessionRecoveryModal from './SessionRecoveryModal';
import SessionCompleteSummary from './SessionCompleteSummary';
import {
  getActiveSession,
  getSessionHistory,
  createSession,
  completeSession,
  type SessionPlan,
  type SessionProgress,
  type SessionHistoryResponse,
} from '@/lib/session/client';
import { buildWeeklyGoalSummary } from '@/lib/session/goal-summary';
import { loadSessionDraft, saveSessionDraft, deleteSessionDraft } from '@/lib/session/storage';
import type { RoutineAccordionItemData } from './RoutineAccordionItem';

const MAX_DURATION_SEC = 7200;

function flattenPlanToAccordionItems(plan: SessionPlan): RoutineAccordionItemData[] {
  const segments = plan.plan_json?.segments ?? [];
  const items: RoutineAccordionItemData[] = [];
  let idx = 0;
  for (const seg of segments) {
    const perItemSec = seg.items.length > 0 ? seg.duration_sec / seg.items.length : 0;
    for (const it of seg.items) {
      if (idx >= 4) break;
      items.push({
        id: `${seg.title}_${it.order}_${it.templateId}`,
        title: it.name,
        kind: it.focus_tag ?? seg.title,
        durationSec: Math.round(perItemSec),
        videoUrl: null,
        description: it.sets && it.reps ? `${it.sets}×${it.reps}` : undefined,
      });
      idx++;
    }
    if (idx >= 4) break;
  }
  return items.slice(0, 4);
}

function getTimeLabel(timeBudget: 'short' | 'normal'): string {
  return timeBudget === 'short' ? '15분 소요' : '25~30분 소요';
}

/** Path B 디버그 라벨: total_sessions + templateId 샘플 (읽기 전용) */
function getDebugBadgeText(
  progress: SessionProgress | null,
  activePlan: SessionPlan | null
): string {
  const show = process.env.NEXT_PUBLIC_SHOW_DEBUG_BADGES !== '0' &&
    process.env.NEXT_PUBLIC_SHOW_DEBUG_BADGES !== 'false';
  if (!show) return '';

  const total = progress?.total_sessions ?? null;
  const totalStr = total != null ? String(total) : 'unknown';

  let templateStr = 'unknown';
  if (activePlan?.plan_json?.segments) {
    const first = activePlan.plan_json.segments[0]?.items?.[0]?.templateId;
    if (typeof first === 'string') {
      if (first.startsWith('stub_')) templateStr = 'stub';
      else if (/^M\d+$/.test(first)) templateStr = first;
    }
  }

  return `total_sessions: ${totalStr} · template: ${templateStr}`;
}

export default function RoutineHubClient() {
  const router = useRouter();

  const [activePlan, setActivePlan] = useState<SessionPlan | null>(null);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [historyData, setHistoryData] = useState<SessionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showTodayRoutine, setShowTodayRoutine] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  const [summaryDurationSec, setSummaryDurationSec] = useState(0);
  const [summaryNextTheme, setSummaryNextTheme] = useState<string | null>(null);
  const [durationClamped, setDurationClamped] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [nextUnlockAt, setNextUnlockAt] = useState<string | null>(null);

  const activeFetchedRef = useRef(false);
  const historyFetchedRef = useRef(false);

  const panelState =
    loading ? 'loading' :
    errorMsg ? 'error' :
    activePlan ? 'active' :
    progress && progress.completed_sessions >= progress.total_sessions ? 'done' :
    'empty';

  const isDeepMissing = useRef(false);

  // GET /api/session/active — 1회
  useEffect(() => {
    if (activeFetchedRef.current) return;
    activeFetchedRef.current = true;

    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        if (!cancelled) setLoading(false);
        return;
      }
      setToken(session.access_token);
      const result = await getActiveSession(session.access_token);
      if (cancelled) return;

      if (!result.ok) {
        if (result.status === 401) {
          setErrorMsg('로그인이 필요합니다.');
        } else {
          setErrorMsg(result.error.message);
        }
        setLoading(false);
        return;
      }

      const { active, progress: prog, today_completed, next_unlock_at } = result.data;
      setProgress(prog);
      setTodayCompleted(today_completed === true);
      setNextUnlockAt(typeof next_unlock_at === 'string' ? next_unlock_at : null);

      if (active) {
        setActivePlan(active);
        const draft = loadSessionDraft(active.session_number);
        if (draft && draft.sessionNumber === active.session_number) {
          setStartedAtMs(draft.startedAtMs);
          if (!cancelled) setShowRecovery(true);
        } else {
          const now = Date.now();
          setStartedAtMs(now);
          saveSessionDraft({
            sessionNumber: active.session_number,
            startedAtMs: now,
            lastUpdatedAtMs: now,
            checked: {},
            note: active.condition
              ? { mood: active.condition.condition_mood, time_budget: active.condition.time_budget }
              : undefined,
          });
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // GET /api/session/history — 1회
  useEffect(() => {
    if (historyFetchedRef.current) return;
    historyFetchedRef.current = true;

    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        if (!cancelled) setHistoryLoading(false);
        return;
      }
      const result = await getSessionHistory(session.access_token, 60);
      if (cancelled) return;
      if (result.ok) {
        setHistoryData(result.data);
      } else {
        setHistoryError(true);
      }
      setHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleConfirmCreate = useCallback(async (
    mood: 'good' | 'ok' | 'bad',
    budget: 'short' | 'normal'
  ) => {
    if (!token || creating) return;
    setCreating(true);

    if (activePlan) {
      setShowTodayRoutine(true);
      setModalOpen(false);
      setCreating(false);
      return;
    }

    const result = await createSession(token, {
      condition_mood: mood,
      time_budget: budget,
    });
    setCreating(false);

    if (!result.ok) {
      if (result.error.code === 'DEEP_RESULT_MISSING') {
        isDeepMissing.current = true;
      } else if (result.error.code === 'DAILY_LIMIT_REACHED') {
        setTodayCompleted(true);
        if (result.error.next_unlock_at) setNextUnlockAt(result.error.next_unlock_at);
      } else {
        setErrorMsg(result.error.message);
      }
      setModalOpen(false);
      return;
    }

    if ('done' in result.data && result.data.done) {
      setProgress(result.data.progress);
      setModalOpen(false);
      return;
    }

    const { active, progress: prog } = result.data as {
      active: SessionPlan;
      progress: SessionProgress;
      idempotent: boolean;
    };
    setActivePlan(active);
    setProgress(prog);
    setShowTodayRoutine(true);
    setModalOpen(false);
    const now = Date.now();
    setStartedAtMs(now);
    saveSessionDraft({
      sessionNumber: active.session_number,
      startedAtMs: now,
      lastUpdatedAtMs: now,
      checked: {},
      note: { mood: active.condition.condition_mood, time_budget: active.condition.time_budget },
    });
  }, [token, creating, activePlan]);

  const performComplete = useCallback(async () => {
    if (!token || !activePlan || completing) return;
    const start = startedAtMs ?? Date.now();
    let durationSec = Math.floor((Date.now() - start) / 1000);
    const clamped = durationSec > MAX_DURATION_SEC;
    if (clamped) durationSec = MAX_DURATION_SEC;

    setCompleting(true);
    const result = await completeSession(token, {
      session_number: activePlan.session_number,
      duration_seconds: durationSec,
      completion_mode: 'all_done',
    });
    setCompleting(false);

    if (!result.ok) {
      setErrorMsg(result.error.message);
      return;
    }
    deleteSessionDraft(activePlan.session_number);
    setProgress(result.data.progress);
    setSummaryDurationSec(durationSec);
    setSummaryNextTheme(result.data.next_theme ?? null);
    setDurationClamped(clamped);
    setActivePlan(null);
    setTodayCompleted(true);
    setShowSummary(true);
  }, [token, activePlan, completing, startedAtMs]);

  const handleRecoveryAction = useCallback(
    (action: 'resume' | 'complete' | 'discard') => {
      if (action === 'resume') {
        setShowRecovery(false);
      } else if (action === 'discard') {
        if (activePlan) deleteSessionDraft(activePlan.session_number);
        setShowRecovery(false);
      } else {
        setShowRecovery(false);
        performComplete();
      }
    },
    [activePlan, performComplete]
  );

  const goal = activePlan?.plan_json?.meta
    ? buildWeeklyGoalSummary(
        activePlan.plan_json.meta,
        progress?.total_sessions ?? 16
      )
    : {
        title: '오늘의 목표',
        description: '오늘의 목표를 설정하려면 루틴을 시작하세요.',
        weekLabel: '',
        chips: [] as string[],
      };

  const timeLabel = activePlan?.condition?.time_budget
    ? getTimeLabel(activePlan.condition.time_budget)
    : '15분 소요';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-24">
        <div className="px-4 pt-6 pb-4">
          <div className="h-8 w-24 animate-pulse rounded bg-stone-200" />
        </div>
        <div className="px-4 space-y-4">
          <div className="h-20 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (isDeepMissing.current || (errorMsg && !activePlan)) {
    const showDeepMissing = isDeepMissing.current;
    const debugText = getDebugBadgeText(progress, activePlan);
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-24">
        <header className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-slate-800">Today</h1>
          {debugText && (
            <p className="mt-1 text-xs text-slate-400 font-mono" aria-hidden="true">
              {debugText}
            </p>
          )}
        </header>
        <main className="px-4">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="size-5 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {showDeepMissing ? '심층 테스트 필요' : '오류'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {showDeepMissing
                    ? '나에게 맞는 세션 루틴을 만들려면 Deep Test가 필요해요.'
                    : errorMsg}
                </p>
              </div>
            </div>
            {showDeepMissing && (
              <NeoButton
                variant="primary"
                fullWidth
                onClick={() => router.push('/app/deep-test')}
                className="mt-4 py-2.5 text-sm"
              >
                Deep Test 시작하기 →
              </NeoButton>
            )}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (panelState === 'done' && progress) {
    const debugText = getDebugBadgeText(progress, null);
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-24">
        <header className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-slate-800">Today</h1>
          {debugText && (
            <p className="mt-1 text-xs text-slate-400 font-mono" aria-hidden="true">
              {debugText}
            </p>
          )}
        </header>
        <main className="px-4">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">프로그램 완료!</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {progress.completed_sessions}회 / {progress.total_sessions}회 세션을 모두 마쳤어요.
                </p>
              </div>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const debugText = getDebugBadgeText(progress, activePlan);

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-24">
      <header className="px-4 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Today</h1>
          {debugText && (
            <p className="mt-1 text-xs text-slate-400 font-mono" aria-hidden="true">
              {debugText}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-stone-300 text-slate-500"
            aria-label="캘린더"
          >
            <Calendar className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-stone-300 text-slate-500"
            aria-label="알림"
          >
            <Bell className="size-4" />
          </button>
        </div>
      </header>

      <main className="px-4 space-y-4">
        <CalendarPills
          history={historyError ? null : historyData}
          selectedDateKey={selectedDateKey}
          onSelectDate={setSelectedDateKey}
        />

        <TodayGoalCard
          goal={goal}
          timeLabel={timeLabel}
          kcalLabel="예상 120 kcal"
        />

        {showTodayRoutine && activePlan ? (
          <>
            <section>
              <h2 className="text-sm font-semibold text-slate-800 mb-3">내 루틴 목록</h2>
              <RoutineAccordionList items={flattenPlanToAccordionItems(activePlan)} />
            </section>

            <div className="sticky bottom-0 left-0 right-0 z-40 -mx-4 px-4 py-3 bg-[#f8f6f0] border-t border-stone-200">
              <NeoButton
                variant="orange"
                fullWidth
                disabled={completing}
                onClick={performComplete}
                className="py-3 text-base font-bold flex items-center justify-center gap-2"
              >
                {completing ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <Play className="size-5" fill="currentColor" strokeWidth={0} />
                    오늘 운동 종료하기
                  </>
                )}
              </NeoButton>
            </div>
          </>
        ) : todayCompleted ? (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">오늘 완료</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  오늘 세션을 이미 완료했어요. 다음 세션은 자정 이후 가능해요.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/app/home"
                className="flex-1 flex items-center justify-center gap-2 rounded-full border-2 border-slate-900 bg-white py-2.5 text-sm font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
              >
                <Home className="size-4" />
                홈으로
              </Link>
              <Link
                href="/app/checkin"
                className="flex-1 flex items-center justify-center gap-2 rounded-full border-2 border-slate-900 bg-orange-400 py-2.5 text-sm font-bold text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
              >
                <BarChart2 className="size-4" />
                루틴 확인
              </Link>
            </div>
          </div>
        ) : (
          <div className="fixed bottom-20 left-4 right-4 z-40">
            <NeoButton
              variant="orange"
              fullWidth
              onClick={() => setModalOpen(true)}
              className="py-3 text-base font-bold flex items-center justify-center gap-2"
            >
              <Play className="size-5" fill="currentColor" strokeWidth={0} />
              움직임 리셋 시작
            </NeoButton>
          </div>
        )}

      {isModalOpen && (
        <SessionAdjustModal
          defaultMood="ok"
          defaultBudget="short"
          loading={creating}
          onClose={() => setModalOpen(false)}
          onSubmit={handleConfirmCreate}
        />
      )}

      </main>

      {showSummary && progress && summaryDurationSec > 0 && (
        <div className="fixed inset-0 z-50 bg-[#f8f6f0] overflow-auto">
          <div className="p-4 pt-6">
            <SessionCompleteSummary
              durationSeconds={summaryDurationSec}
              progress={progress}
              nextTheme={summaryNextTheme}
              durationClamped={durationClamped}
              onDismiss={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {showRecovery && activePlan && (
        <SessionRecoveryModal onAction={handleRecoveryAction} loading={completing} />
      )}

      <BottomNav />
    </div>
  );
}
