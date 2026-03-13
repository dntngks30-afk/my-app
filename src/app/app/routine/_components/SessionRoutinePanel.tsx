'use client';

/**
 * SessionRoutinePanel
 *
 * Path B 세션 레일 — 루틴 탭 최상단 패널.
 * 7일 시스템과 완전 분리. 기존 7일 로직/컴포넌트 미변경.
 *
 * 상태 머신:
 *   loading | active | empty | deep_missing | done | error | summary
 *
 * 네트워크 가드:
 *   - GET /api/session/active: mount 시 1회만
 *   - POST /api/session/create: 버튼 클릭 시에만
 *   - POST /api/session/complete: 종료 버튼 클릭 시에만
 *   - 무한 재시도 없음
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  SlidersHorizontal,
  Zap,
  X,
  CheckCircle2,
} from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import {
  getActiveSession,
  createSession,
  completeSession,
  type SessionPlan,
  type SessionProgress,
  type CreateSessionInput,
} from '@/lib/session/client';
import {
  loadSessionDraft,
  saveSessionDraft,
  deleteSessionDraft,
  type SessionDraft,
} from '@/lib/session/storage';
import SessionRecoveryModal from './SessionRecoveryModal';
import SessionCompleteSummary from './SessionCompleteSummary';
import { SessionFeedbackQuickForm } from '@/app/app/_components/SessionFeedbackQuickForm';
import type { FeedbackPayload } from '@/lib/session/feedback-types';
import {
  buildCompletionExerciseLogsWithIdentity,
  getCheckedItemKey,
  normalizeLegacyItemKey,
} from '@/lib/session/exercise-log-identity';
import { normalizeSessionSegmentsForUI } from '@/lib/session/session-segments-ui';

// ─── 날짜 포맷 ─────────────────────────────────────────────────────────────────

function getTodayLabel(): string {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

const MAX_DURATION_SEC = 7200; // 120분

// ─── 스켈레톤 ──────────────────────────────────────────────────────────────────

function SessionSkeleton() {
  return (
    <NeoCard className="p-5 bg-white">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-stone-200" />
        <div className="h-5 w-2/3 rounded bg-stone-200" />
        <div className="h-11 w-full rounded-2xl bg-stone-200" />
      </div>
    </NeoCard>
  );
}

// ─── 세그먼트 리스트 ───────────────────────────────────────────────────────────

type SegmentListProps = {
  plan: SessionPlan;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
};

function SegmentList({ plan, checked, onToggle }: SegmentListProps) {
  const { meta, flags } = plan.plan_json;
  const segments = normalizeSessionSegmentsForUI(plan.plan_json.segments);

  return (
    <div className="space-y-2">
      {/* meta badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {flags.recovery && (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
            회복 모드
          </span>
        )}
        {flags.short && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
            단축 구성
          </span>
        )}
        {meta?.confidence && (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            신뢰도 {meta.confidence}
          </span>
        )}
      </div>

      {segments.map((seg, segIdx) => (
        <div
          key={seg.title}
          className="rounded-xl border border-stone-200 bg-stone-50 p-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              {seg.title}
            </span>
            <span className="text-xs text-slate-400">
              {Math.round(seg.duration_sec / 60)}분
            </span>
          </div>
          <ul className="space-y-1">
            {seg.items.map((item) => {
              const key = getCheckedItemKey(item._originalSegIdx, item._originalItemIdx, item.templateId ?? '');
              const isChecked = !!checked[key];
              return (
                <li
                  key={key}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <button
                    type="button"
                    onClick={() => onToggle(key)}
                    className={[
                      'size-5 shrink-0 rounded border-2 flex items-center justify-center transition',
                      isChecked
                        ? 'border-emerald-600 bg-emerald-500 text-white'
                        : 'border-stone-400 bg-white',
                    ].join(' ')}
                    aria-label={`${item.name} ${isChecked ? '체크 해제' : '체크'}`}
                  >
                    {isChecked && <CheckCircle2 className="size-3" strokeWidth={3} />}
                  </button>
                  <span className={['flex-1', isChecked && 'line-through text-slate-400'].filter(Boolean).join(' ')}>
                    {item.name}
                  </span>
                  {item.sets && item.reps && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {item.sets}×{item.reps}
                    </span>
                  )}
                  {item.hold_seconds && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {item.hold_seconds}초 유지
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── 조정 모달 ─────────────────────────────────────────────────────────────────

type Mood = 'good' | 'ok' | 'bad';
type Budget = 'short' | 'normal';

const MOOD_OPTIONS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'good', label: '좋음', emoji: '😊' },
  { value: 'ok', label: '보통', emoji: '😐' },
  { value: 'bad', label: '나쁨', emoji: '😔' },
];

const BUDGET_OPTIONS: { value: Budget; label: string; sub: string }[] = [
  { value: 'short', label: '짧게', sub: '~15분' },
  { value: 'normal', label: '보통', sub: '~30분' },
];

function AdjustModal({
  defaultMood,
  defaultBudget,
  loading,
  onClose,
  onSubmit,
}: {
  defaultMood: Mood;
  defaultBudget: Budget;
  loading: boolean;
  onClose: () => void;
  onSubmit: (mood: Mood, budget: Budget) => void;
}) {
  const [mood, setMood] = useState<Mood>(defaultMood);
  const [budget, setBudget] = useState<Budget>(defaultBudget);

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* sheet */}
      <div className="w-full max-w-md rounded-t-3xl border-2 border-slate-900 bg-white p-6 shadow-[0_-4px_0_0_rgba(15,23,42,1)]">
        {/* header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-800">오늘 컨디션 조정</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-slate-500 hover:bg-stone-100"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* mood */}
        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          오늘 컨디션
        </p>
        <div className="flex gap-2 mb-5">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMood(opt.value)}
              className={[
                'flex-1 flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-semibold transition',
                mood === opt.value
                  ? 'border-slate-900 bg-orange-100 text-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                  : 'border-stone-300 bg-white text-slate-600 hover:border-slate-400',
              ].join(' ')}
            >
              <span className="text-xl">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* budget */}
        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          운동 시간
        </p>
        <div className="flex gap-2 mb-6">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBudget(opt.value)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 rounded-2xl border-2 py-3 text-sm font-semibold transition',
                budget === opt.value
                  ? 'border-slate-900 bg-orange-100 text-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                  : 'border-stone-300 bg-white text-slate-600 hover:border-slate-400',
              ].join(' ')}
            >
              {opt.label}
              <span className="text-xs font-normal text-slate-500">{opt.sub}</span>
            </button>
          ))}
        </div>

        <NeoButton
          variant="orange"
          fullWidth
          disabled={loading}
          onClick={() => onSubmit(mood, budget)}
          className="py-3 text-base"
        >
          {loading ? '생성 중...' : '리셋 시작'}
        </NeoButton>
      </div>
    </div>
  );
}

// ─── 종료 확인 모달 (일부 미완료 시) ───────────────────────────────────────────

function ConfirmCompleteModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-3xl border-2 border-slate-900 bg-white p-6 shadow-[0_-4px_0_0_rgba(15,23,42,1)]">
        <h2 className="text-base font-bold text-slate-800 mb-2">그래도 종료할까요?</h2>
        <p className="text-sm text-slate-600 mb-5">
          아직 완료하지 않은 운동이 있어요. 그래도 종료할까요?
        </p>
        <div className="flex gap-2">
          <NeoButton variant="secondary" fullWidth onClick={onClose} className="py-3">
            계속하기
          </NeoButton>
          <NeoButton
            variant="orange"
            fullWidth
            disabled={loading}
            onClick={onConfirm}
            className="py-3"
          >
            {loading ? '처리 중...' : '그대로 종료'}
          </NeoButton>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 패널 ─────────────────────────────────────────────────────────────────

type PanelState =
  | 'loading'
  | 'active'
  | 'empty'
  | 'deep_missing'
  | 'done'
  | 'error'
  | 'summary';

export default function SessionRoutinePanel() {
  const router = useRouter();

  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [activePlan, setActivePlan] = useState<SessionPlan | null>(null);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // 체크 상태 + startedAt (로컬)
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  // 완료 후 Summary 표시용
  const [summaryDurationSec, setSummaryDurationSec] = useState<number>(0);
  const [summaryNextTheme, setSummaryNextTheme] = useState<string | null>(null);
  const [durationClamped, setDurationClamped] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);

  const initializedRef = useRef(false);
  const activeLoadedRef = useRef(false);

  // GET /api/session/active — mount 시 1회
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        if (!cancelled) {
          setErrorMsg('로그인이 필요합니다.');
          setPanelState('error');
        }
        return;
      }

      if (!cancelled) setToken(session.access_token);

      const result = await getActiveSession(session.access_token);

      if (cancelled) return;

      if (!result.ok) {
        if (result.status === 401) {
          setErrorMsg('로그인이 필요합니다.');
          setPanelState('error');
        } else {
          setErrorMsg(result.error.message);
          setPanelState('error');
        }
        return;
      }

      const { active, progress: prog } = result.data;
      setProgress(prog);

      if (active) {
        setActivePlan(active);
        const draft = loadSessionDraft(active.session_number);
        if (draft && draft.sessionNumber === active.session_number) {
          const segments = active.plan_json?.segments;
          const migrated: Record<string, boolean> = {};
          for (const [key, val] of Object.entries(draft.checked)) {
            const canonical = key.includes(':')
              ? key
              : normalizeLegacyItemKey(key, segments) ?? key;
            migrated[canonical] = val;
          }
          setChecked(migrated);
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
        if (!cancelled) setPanelState('active');
        activeLoadedRef.current = true;
      } else if (prog.completed_sessions >= prog.total_sessions) {
        setPanelState('done');
      } else {
        setPanelState('empty');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // POST /api/session/create — 버튼 클릭에서만 호출
  const handleCreate = useCallback(async (
    mood: Mood = 'ok',
    budget: Budget = 'short'
  ) => {
    if (!token || creating) return;
    setCreating(true);
    setShowAdjust(false);

    const input: CreateSessionInput = {
      condition_mood: mood,
      time_budget: budget,
    };

    const result = await createSession(token, input);
    setCreating(false);

    if (!result.ok) {
      if (result.error.code === 'DEEP_RESULT_MISSING') {
        setPanelState('deep_missing');
      } else if (result.status === 401) {
        setErrorMsg('로그인이 필요합니다.');
        setPanelState('error');
      } else {
        setErrorMsg(result.error.message);
        setPanelState('error');
      }
      return;
    }

    if ('done' in result.data && result.data.done) {
      setProgress(result.data.progress);
      setPanelState('done');
      return;
    }

    const { active, progress: prog } = result.data as {
      active: SessionPlan;
      progress: SessionProgress;
      idempotent: boolean;
    };
    setActivePlan(active);
    setProgress(prog);
    setPanelState('active');
    const now = Date.now();
    setStartedAtMs(now);
    setChecked({});
    saveSessionDraft({
      sessionNumber: active.session_number,
      startedAtMs: now,
      lastUpdatedAtMs: now,
      checked: {},
      note: { mood: active.condition.condition_mood, time_budget: active.condition.time_budget },
    });
  }, [token, creating]);

  const handleToggleChecked = useCallback((key: string) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  }, []);

  // checked 변경 시 storage 저장 (activePlan.session_number 필요)
  useEffect(() => {
    if (!activePlan || panelState !== 'active') return;
    const draft = loadSessionDraft(activePlan.session_number);
    if (draft) {
      saveSessionDraft({
        ...draft,
        checked,
        lastUpdatedAtMs: Date.now(),
      });
    }
  }, [checked, activePlan, panelState]);

  const performComplete = useCallback(async () => {
    if (!token || !activePlan || completing) return;
    const start = startedAtMs ?? Date.now();
    let durationSec = Math.floor((Date.now() - start) / 1000);
    const clamped = durationSec > MAX_DURATION_SEC;
    if (clamped) durationSec = MAX_DURATION_SEC;
    const allItems = activePlan.plan_json?.segments?.flatMap((s, segIdx) =>
      (s.items ?? []).map((i, itemIdx) => getCheckedItemKey(segIdx, itemIdx, i.templateId ?? ''))
    ) ?? [];
    const allChecked = allItems.length > 0 && allItems.every((k) => checked[k]);
    const completionMode = allChecked ? 'all_done' : 'partial_done';

    // PR-DATA-01: evidence gate requires exercise_logs — plan_item_key identity (templateId-only is legacy fallback)
    const exerciseLogs = buildCompletionExerciseLogsWithIdentity(
      activePlan.plan_json?.segments,
      (segIdx, itemIdx, item) => {
        const key = getCheckedItemKey(segIdx, itemIdx, item.templateId ?? '');
        if (!checked[key]) return null;
        return {
          templateId: item.templateId ?? '',
          name: item.name ?? '',
          sets: typeof item.sets === 'number' ? item.sets : 1,
          reps: typeof item.reps === 'number' ? item.reps : 1,
          difficulty: null,
          rpe: null,
          discomfort: null,
        };
      }
    );

    setCompleting(true);
    const payload: Parameters<typeof completeSession>[1] = {
      session_number: activePlan.session_number,
      duration_seconds: durationSec,
      completion_mode: completionMode,
      exercise_logs: exerciseLogs,
    };
    if (feedback?.sessionFeedback && Object.keys(feedback.sessionFeedback).length > 0) {
      payload.feedback = feedback;
    }
    const result = await completeSession(token, payload);
    setCompleting(false);

    if (!result.ok) {
      setErrorMsg(result.error.message);
      setPanelState('error');
      return;
    }
    deleteSessionDraft(activePlan.session_number);
    setProgress(result.data.progress);
    setSummaryDurationSec(durationSec);
    setSummaryNextTheme(result.data.next_theme ?? null);
    setDurationClamped(clamped);
    setActivePlan(null);
    setPanelState('summary');
  }, [token, activePlan, completing, startedAtMs, checked, feedback]);

  const handleCompleteClick = useCallback(() => {
    const allItems = activePlan?.plan_json?.segments?.flatMap((s, segIdx) =>
      (s.items ?? []).map((i, itemIdx) => getCheckedItemKey(segIdx, itemIdx, i.templateId ?? ''))
    ) ?? [];
    const allChecked = allItems.length > 0 && allItems.every((k) => checked[k]);
    if (!allChecked && allItems.length > 0) {
      setShowConfirmComplete(true);
    } else {
      performComplete();
    }
  }, [activePlan, checked, performComplete]);

  const handleRecoveryAction = useCallback(
    (action: 'resume' | 'complete' | 'discard') => {
      if (action === 'resume') {
        setShowRecovery(false);
      } else if (action === 'discard') {
        if (activePlan) deleteSessionDraft(activePlan.session_number);
        setChecked({});
        setShowRecovery(false);
      } else {
        setShowRecovery(false);
        performComplete();
      }
    },
    [activePlan, performComplete]
  );

  // ─── 렌더 ────────────────────────────────────────────────────────────────────

  if (panelState === 'loading') {
    return <SessionSkeleton />;
  }

  if (panelState === 'deep_missing') {
    return (
      <NeoCard className="p-5 bg-white">
        <div className="flex items-start gap-3 mb-4">
          <Sparkles className="size-5 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800">심층 테스트 필요</p>
            <p className="text-xs text-slate-500 mt-0.5">
              나에게 맞는 세션 루틴을 만들려면 Deep Test가 필요해요.
            </p>
          </div>
        </div>
        <NeoButton
          variant="primary"
          fullWidth
          onClick={() => router.push('/app/deep-test')}
          className="py-2.5 text-sm"
        >
          Deep Test 시작하기 →
        </NeoButton>
      </NeoCard>
    );
  }

  if (panelState === 'done') {
    return (
      <NeoCard className="p-5 bg-white">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800">프로그램 완료!</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {progress?.completed_sessions}회 / {progress?.total_sessions}회 세션을 모두 마쳤어요.
            </p>
          </div>
        </div>
      </NeoCard>
    );
  }

  if (panelState === 'error') {
    return (
      <NeoCard className="p-5 bg-white">
        <p className="text-sm text-red-600">{errorMsg ?? '세션 조회에 실패했습니다.'}</p>
      </NeoCard>
    );
  }

  if (panelState === 'summary' && progress) {
    return (
      <SessionCompleteSummary
        durationSeconds={summaryDurationSec}
        progress={progress}
        nextTheme={summaryNextTheme}
        durationClamped={durationClamped}
      />
    );
  }

  // active 또는 empty 상태
  return (
    <>
      <NeoCard className="p-5 bg-white">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400 font-medium">{getTodayLabel()}</p>
            <h2 className="text-base font-bold text-slate-800 mt-0.5">
              {panelState === 'active' && activePlan
                ? activePlan.theme
                : '오늘 세션 루틴'}
            </h2>
            {progress && (
              <p className="text-xs text-slate-500 mt-0.5">
                {progress.completed_sessions} / {progress.total_sessions} 세션 완료
              </p>
            )}
          </div>

          {/* 조정 버튼 (active가 없을 때만) */}
          {panelState === 'empty' && (
            <button
              type="button"
              onClick={() => setShowAdjust(true)}
              className="flex items-center gap-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-stone-100 transition"
              aria-label="컨디션 조정"
            >
              <SlidersHorizontal className="size-3.5" />
              조정
            </button>
          )}
        </div>

        {/* active: 세그먼트 리스트 */}
        {panelState === 'active' && activePlan ? (
          <>
            <SegmentList plan={activePlan} checked={checked} onToggle={handleToggleChecked} />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">Session {activePlan.session_number}</span>
            </div>
          </>
        ) : (
          /* empty: 생성 버튼 */
          <NeoButton
            variant="orange"
            fullWidth
            disabled={creating}
            onClick={() => handleCreate('ok', 'short')}
            className="py-3 text-base flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                생성 중...
              </>
            ) : (
              <>
                <Zap className="size-5" fill="currentColor" strokeWidth={0} />
                바로 오늘 루틴 만들기
              </>
            )}
          </NeoButton>
        )}
      </NeoCard>

      {/* Sticky 종료 버튼 — active일 때만 */}
      {panelState === 'active' && activePlan && (
        <div className="sticky bottom-0 left-0 right-0 z-40 -mx-4 px-4 py-3 bg-[#f8f6f0] border-t border-stone-200 mt-4 space-y-4">
          <SessionFeedbackQuickForm
            value={feedback}
            onChange={setFeedback}
            derivedCompletionRatio={
              (() => {
                const allItems = activePlan.plan_json?.segments?.flatMap((s, segIdx) =>
                  (s.items ?? []).map((i, itemIdx) => getCheckedItemKey(segIdx, itemIdx, i.templateId ?? ''))
                ) ?? [];
                return allItems.length > 0
                  ? allItems.filter((k) => checked[k]).length / allItems.length
                  : undefined;
              })()
            }
          />
          <NeoButton
            variant="orange"
            fullWidth
            disabled={completing}
            onClick={handleCompleteClick}
            className="py-3 text-base font-bold"
          >
            {completing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                처리 중...
              </span>
            ) : (
              '오늘 운동 종료하기'
            )}
          </NeoButton>
        </div>
      )}

      {/* 조정 모달 */}
      {showAdjust && (
        <AdjustModal
          defaultMood="ok"
          defaultBudget="short"
          loading={creating}
          onClose={() => setShowAdjust(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* 종료 확인 모달 (일부 미완료) */}
      {showConfirmComplete && (
        <ConfirmCompleteModal
          onClose={() => setShowConfirmComplete(false)}
          onConfirm={() => {
            setShowConfirmComplete(false);
            performComplete();
          }}
          loading={completing}
        />
      )}

      {/* Recovery 모달 */}
      {showRecovery && (
        <SessionRecoveryModal
          onAction={handleRecoveryAction}
          loading={completing}
        />
      )}
    </>
  );
}
