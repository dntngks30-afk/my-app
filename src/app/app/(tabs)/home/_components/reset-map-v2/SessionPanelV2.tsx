'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Play, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { getSessionSafe } from '@/lib/supabase'
import { completeSession } from '@/lib/session/client'
import type { ExerciseItem } from './planJsonAdapter'
import type { ExerciseLogItem, SessionPlan, ActivePlanSummary } from '@/lib/session/client'
import { buildBriefSessionRationale } from '@/lib/deep-result/copy'
import { ExercisePlayerModal } from './ExercisePlayerModal'
import SessionCompleteSummary from '@/app/app/routine/_components/SessionCompleteSummary'
import { SessionCompletionSheet, type BodyStateAfter } from './SessionCompletionSheet'
import type { SessionPainArea } from '@/lib/session/feedback-types'
import { loadSessionDraft, saveSessionDraft, clearSessionDraft, draftToLogs } from '@/lib/session/draftStorage'
import { saveSessionProgress } from '@/lib/session/client'

type SessionStatus = 'current' | 'completed' | 'locked'

interface SessionPanelV2Props {
  /** null이면 패널 닫힘 */
  sessionId: number | null
  total: number
  /** 완료된 세션 수 (다음 세션 미리보기 배너용) */
  completedSessions?: number
  status: SessionStatus
  /** plan_json에서 추출된 운동 배열. undefined = 로딩 전, [] = 데이터 없음 */
  exercises: ExerciseItem[] | undefined
  /** 현재 active plan — session_number + status 사용 (SessionPlan | ActivePlanSummary) */
  activePlan: SessionPlan | ActivePlanSummary | null
  /** 완료된 세션 재조회 시 서버에서 받은 exercise_logs (templateId → log) */
  initialLogs?: Record<string, ExerciseLogItem>
  /** daily cap: 다음 세션이 오늘 완료로 locked인 경우 */
  isLockedNext?: boolean
  /** daily cap: 다음 세션 해제 시각 (ISO string) */
  nextUnlockAt?: string
  onClose: () => void
  /** 세션 완료 후 새 completed_sessions 값을 상위로 전달 */
  onSessionCompleted?: (completedSessions: number) => void
  /** PR-SESSION-EXPERIENCE-01: 다음 세션 보기 요청 (nextSessionNumber) */
  onRequestNextSession?: (nextSessionNumber: number) => void
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  current: '진행 중',
  completed: '완료',
  locked: '잠김',
}
const STATUS_CLASS: Record<SessionStatus, string> = {
  current: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-slate-100 text-slate-500',
}

/** PR-SESSION-EXPERIENCE-01: session_focus_axes → 한글 라벨 */
const FOCUS_AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정',
  lower_mobility: '하체 가동성',
  upper_mobility: '상체 가동성',
  trunk_control: '몸통 제어',
  asymmetry: '좌우 균형',
  deconditioned: '전신 회복',
}

function getPlanRationale(plan: SessionPlan | ActivePlanSummary | null) {
  if (!plan || !('plan_json' in plan) || !plan.plan_json || typeof plan.plan_json !== 'object') return null
  const meta = (plan.plan_json as {
    meta?: {
      focus?: string[]
      priority_vector?: Record<string, number>
      pain_mode?: 'none' | 'caution' | 'protected'
      adaptation_summary?: string
      session_rationale?: string | null
      session_focus_axes?: string[]
    }
  }).meta
  const base = buildBriefSessionRationale(meta?.priority_vector, meta?.pain_mode, meta?.focus)
  const headline = meta?.session_rationale ?? base?.headline
  const detail = meta?.session_rationale ? undefined : base?.detail
  const chips = (meta?.session_focus_axes ?? []).map((a) => FOCUS_AXIS_LABELS[a] ?? a)
  if (!base && (headline || chips.length > 0)) {
    return {
      headline: headline ?? '이번 세션을 빠르게 미리 볼 수 있는 요약입니다',
      detail: '패널은 먼저 요약을 보여주고, 뒤에서 실제 세션 구성을 불러옵니다.',
      chips,
      ...(meta?.adaptation_summary && { adaptation_summary: meta.adaptation_summary }),
    }
  }
  return base
    ? {
        ...base,
        headline: headline ?? base.headline,
        ...(detail && { detail }),
        chips,
        ...(meta?.adaptation_summary && { adaptation_summary: meta.adaptation_summary }),
      }
    : null
}

export function SessionPanelV2({
  sessionId,
  total,
  completedSessions,
  status,
  exercises,
  activePlan,
  initialLogs,
  isLockedNext,
  nextUnlockAt,
  onClose,
  onSessionCompleted,
  onRequestNextSession,
}: SessionPanelV2Props) {
  if (sessionId === null) return null

  return (
    <PanelInner
      sessionId={sessionId}
      total={total}
      status={status}
      exercises={exercises}
      activePlan={activePlan}
      initialLogs={initialLogs}
      isLockedNext={isLockedNext}
      nextUnlockAt={nextUnlockAt}
      onClose={onClose}
      onSessionCompleted={onSessionCompleted}
      onRequestNextSession={onRequestNextSession}
    />
  )
}

/* ─── 내부 컴포넌트 ──────────────────────────────────────────── */

function PanelInner({
  sessionId,
  total,
  completedSessions,
  status,
  exercises,
  activePlan,
  initialLogs,
  isLockedNext,
  nextUnlockAt,
  onClose,
  onSessionCompleted,
  onRequestNextSession,
}: Required<Omit<SessionPanelV2Props, 'onSessionCompleted' | 'onRequestNextSession'>> & {
  onSessionCompleted?: (completedSessions: number) => void
  onRequestNextSession?: (nextSessionNumber: number) => void
}) {
  // 로컬 운동 로그 누적 (templateId → log). PR-PERSIST-01: draft 복구 또는 initialLogs
  const [logs, setLogs] = useState<Record<string, ExerciseLogItem>>({})
  const [draftRestored, setDraftRestored] = useState(false)
  const [sessionPerceivedDifficulty, setSessionPerceivedDifficulty] = useState<'too_easy' | 'ok' | 'too_hard' | null>(null)
  const [sessionPainAreas, setSessionPainAreas] = useState<SessionPainArea[]>([])
  const [bodyStateAfter, setBodyStateAfter] = useState<BodyStateAfter | null>(null)
  const rationale = getPlanRationale(activePlan)

  // PR-SESSION-UX-02: 세션 전환 시 운동 뷰 리셋
  useEffect(() => {
    setExerciseIndex(null)
  }, [sessionId])
  // 세션 전환 시 완료 상태 리셋 (다음 세션 보기 시)
  useEffect(() => {
    setCompleted(false)
    setCompleteResult(null)
    setBodyStateAfter(null)
    setDraftRestored(false)
  }, [sessionId])
  // PR-PERSIST-01 + PR-EXEC-02: 세션 진입 시 draft 복구 또는 initialLogs(서버 진행) 또는 초기화
  useEffect(() => {
    if (status === 'completed') {
      if (initialLogs && Object.keys(initialLogs).length > 0) {
        setLogs(initialLogs)
      } else {
        setLogs({})
      }
      if (sessionId != null) clearSessionDraft(String(sessionId))
      return
    }
    if (sessionId == null) return
    if (status === 'current') {
      const planId = String(sessionId)
      const draft = loadSessionDraft(planId)
      if (draft && draft.session_number === sessionId && Object.keys(draft.exercises).length > 0) {
        const nameByTemplateId: Record<string, string> = {}
        if (exercises) for (const e of exercises) nameByTemplateId[e.templateId] = e.name
        const restoredLogs = draftToLogs(draft, nameByTemplateId)
        setLogs(restoredLogs)
        if (draft.sessionPerceivedDifficulty != null) setSessionPerceivedDifficulty(draft.sessionPerceivedDifficulty)
        if (draft.sessionPainAreas && draft.sessionPainAreas.length > 0) setSessionPainAreas(draft.sessionPainAreas)
        setDraftRestored(true)
      } else if (initialLogs && Object.keys(initialLogs).length > 0) {
        setLogs(initialLogs)
      } else {
        setLogs({})
      }
    } else {
      setLogs({})
    }
  }, [sessionId, status, initialLogs, exercises])

  // PR-PERSIST-01: logs 변경 시 draft 저장 (current 세션만, 300ms debounce)
  const saveDraftRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDraft = useCallback(() => {
    if (sessionId == null || status !== 'current' || !activePlan?.session_number) return
    if (sessionId !== activePlan.session_number) return
    const planId = String(sessionId)
    const holdSecondsByTemplateId: Record<string, number> = {}
    if (exercises) for (const e of exercises) if (e.holdSeconds) holdSecondsByTemplateId[e.templateId] = e.holdSeconds
    saveSessionDraft(planId, {
      session_number: sessionId,
      plan_id: planId,
      logs,
      holdSecondsByTemplateId: Object.keys(holdSecondsByTemplateId).length ? holdSecondsByTemplateId : undefined,
      sessionPerceivedDifficulty,
      sessionPainAreas,
    })
  }, [sessionId, status, activePlan?.session_number, logs, sessionPerceivedDifficulty, sessionPainAreas, exercises])
  useEffect(() => {
    if (sessionId == null || status !== 'current' || sessionId !== activePlan?.session_number) return
    if (saveDraftRef.current) clearTimeout(saveDraftRef.current)
    saveDraftRef.current = setTimeout(saveDraft, 300)
    return () => {
      if (saveDraftRef.current) clearTimeout(saveDraftRef.current)
    }
  }, [sessionId, status, activePlan?.session_number, logs, sessionPerceivedDifficulty, sessionPainAreas, exercises, saveDraft])

  // PR-EXEC-02: 진행 서버 저장 (500ms debounce)
  const saveProgressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (sessionId == null || status !== 'current' || sessionId !== activePlan?.session_number) return
    const tokenPromise = getSessionSafe().then((r) => r.session?.access_token ?? null)
    if (saveProgressRef.current) clearTimeout(saveProgressRef.current)
    saveProgressRef.current = setTimeout(async () => {
      const token = await tokenPromise
      if (!token || Object.keys(logs).length === 0) return
      const holdMap: Record<string, number> = {}
      if (exercises) for (const e of exercises) if (e.holdSeconds) holdMap[e.templateId] = e.holdSeconds
      const items = Object.entries(logs).map(([templateId, log]) => {
        const sets = log.sets ?? 0
        const reps = log.reps ?? 0
        const isHold = holdMap[templateId] != null && holdMap[templateId] > 0
        return {
          template_id: templateId,
          sets,
          reps: isHold ? 0 : reps,
          hold_seconds: isHold ? reps : 0,
          rpe: log.rpe ?? null,
          completed: sets > 0 || reps > 0,
          skipped: false,
        }
      })
      saveSessionProgress(token, sessionId, items)
    }, 500)
    return () => {
      if (saveProgressRef.current) clearTimeout(saveProgressRef.current)
    }
  }, [sessionId, status, activePlan?.session_number, logs, exercises])
  // PR-PERSIST-01: 복구 안내 4초 후 자동 숨김
  useEffect(() => {
    if (!draftRestored) return
    const t = setTimeout(() => setDraftRestored(false), 4000)
    return () => clearTimeout(t)
  }, [draftRestored])

  // PR-SESSION-UX-02: 운동 인덱스 (null = 목록, number = 해당 운동 화면)
  const [exerciseIndex, setExerciseIndex] = useState<number | null>(null)

  // 패널 open 측정
  useEffect(() => {
    if (sessionId != null && typeof performance !== 'undefined' && performance.mark) {
      performance.mark('panel_opened')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[perf] panel_opened')
      }
    }
  }, [sessionId])
  // exercises ready 측정 (createSession cold path → panel first paint)
  const prevExercisesRef = useRef<ExerciseItem[] | undefined>(undefined)
  useEffect(() => {
    if (exercises !== undefined && prevExercisesRef.current === undefined && typeof performance !== 'undefined' && performance.mark) {
      performance.mark('panel_exercises_ready')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[perf] panel_exercises_ready')
      }
    }
    prevExercisesRef.current = exercises
  }, [exercises])
  // 세션 피드백 (PR-UX-00: 종료 시 시트에서만 수집)
  const [showSessionCompletionSheet, setShowSessionCompletionSheet] = useState(false)
  // 종료 API 상태
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [completeResult, setCompleteResult] = useState<{
    progress: { completed_sessions: number; total_sessions: number }
    next_theme: string | null
    duration_seconds: number
    exercise_logs?: ExerciseLogItem[] | null
  } | null>(null)
  // 패널 오픈 시각 (duration 계산용)
  const startedAtRef = useRef(Date.now())

  const handleLogComplete = (log: ExerciseLogItem) => {
    setLogs(prev => ({ ...prev, [log.templateId]: log }))
  }

  const handleNextOrEnd = (log: ExerciseLogItem) => {
    setLogs(prev => ({ ...prev, [log.templateId]: log }))
    if (!exercises || exercises.length === 0) return
    let nextIdx: number | null = null
    let showSessionSheet = false
    if (exerciseIndex != null) {
      if (exerciseIndex < exercises.length - 1) {
        nextIdx = exerciseIndex + 1
      } else {
        showSessionSheet = true
      }
    }
    setExerciseIndex(nextIdx)
    if (showSessionSheet) setShowSessionCompletionSheet(true)
  }

  const doSessionComplete = async () => {
    if (completing || completed) return
    const sessionNumber = activePlan?.session_number
    if (!sessionNumber) return

    setCompleting(true)
    setCompleteError(null)

    try {
      const { session } = await getSessionSafe()
      if (!session?.access_token) {
        setCompleteError('로그인이 필요합니다. 페이지를 새로고침해 주세요.')
        setCompleting(false)
        return
      }

      const durationSec = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
      const exerciseLogsArray = Object.values(logs)

      const allDone =
        exercises && exercises.length > 0 && exercises.every(e => !!logs[e.templateId])
      const completionMode = allDone ? 'all_done' : exerciseLogsArray.length > 0 ? 'partial_done' : 'stop_early'

      const payload: Parameters<typeof completeSession>[1] = {
        session_number: sessionNumber,
        duration_seconds: durationSec,
        completion_mode: completionMode,
        exercise_logs: exerciseLogsArray,
      }
      const hasSessionFeedback = sessionPerceivedDifficulty != null || sessionPainAreas.length > 0
      if (hasSessionFeedback) {
        payload.feedback = {
          sessionFeedback: {
            difficultyFeedback: sessionPerceivedDifficulty ?? undefined,
            painAreas: sessionPainAreas.length > 0 ? sessionPainAreas : undefined,
          },
        }
      }
      const result = await completeSession(session.access_token, payload)

      if (!result.ok) {
        // 이미 완료된 경우(idempotent)는 에러가 아님
        setCompleteError(`저장 실패: ${result.error.message}. 다시 시도하거나 페이지를 새로고침해 주세요.`)
        setCompleting(false)
        return
      }

      setCompleted(true)
      setCompleting(false)
      setCompleteResult({
        progress: result.data.progress ?? { completed_sessions: sessionNumber, total_sessions: total },
        next_theme: result.data.next_theme ?? null,
        duration_seconds: durationSec,
        exercise_logs: result.data.exercise_logs ?? exerciseLogsArray,
      })

      clearSessionDraft(String(sessionNumber))

      const newCompleted = result.data.progress?.completed_sessions ?? sessionNumber
      onSessionCompleted?.(newCompleted)
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setCompleting(false)
    }
  }

  const handleSessionCompleteClick = () => {
    setShowSessionCompletionSheet(true)
  }

  const handleSessionCompletionConfirm = () => {
    setShowSessionCompletionSheet(false)
    doSessionComplete()
  }

  return (
    <>
      {/* Backdrop — 즉시 반응 느낌 */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-in fade-in"
        style={{ animationDuration: '100ms' }}
        onClick={exerciseIndex != null ? undefined : onClose}
        aria-hidden
      />

      {/* Bottom Sheet — 빠른 슬라이드 */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 animate-in slide-in-from-bottom-4"
        style={{ animationDuration: '180ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-[430px] rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Drag handle */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
          </div>

          {/* Reflection: complete 이후 요약 화면 — 방금 완료한 세션만 표시 */}
          {completed && completeResult && sessionId === completeResult.progress.completed_sessions && (
            <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">
              <SessionCompleteSummary
                durationSeconds={completeResult.duration_seconds}
                progress={completeResult.progress}
                nextTheme={completeResult.next_theme}
                exerciseLogs={completeResult.exercise_logs}
                completedSessionNumber={completeResult.progress.completed_sessions}
                onDismiss={onClose}
                showBodyCheckCta
                variant="home"
                isNextLockedUntilTomorrow={isLockedNext ?? false}
                onNextSessionClick={
                  onRequestNextSession
                    ? () => {
                        const next = Math.min(completeResult.progress.completed_sessions + 1, total)
                        if (next <= total) onRequestNextSession(next)
                      }
                    : undefined
                }
              />
            </div>
          )}

          {/* 기존 패널: 미완료 시 또는 다음 세션 미리보기 */}
          {!(completed && completeResult && sessionId === completeResult.progress.completed_sessions) && (
            <>
          {/* PR-SESSION-FIX-03: 다음 세션 미리보기 배너 */}
          {completedSessions != null && sessionId === completedSessions + 1 && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-violet-800">다음 세션 준비됐어요</p>
              <p className="text-xs text-violet-600 mt-0.5">세션 {sessionId}에서 이런 운동을 하게 돼요</p>
            </div>
          )}

          {/* 완료 상태 배너 (다음 세션 미리보기 배너와 겹치지 않음) */}
          {completed && completedSessions != null && sessionId !== completedSessions + 1 && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-emerald-700">세션 완료! 수고하셨습니다 🎉</p>
            </div>
          )}

          {/* PR-PERSIST-01: 이전 진행 복구 안내 */}
          {draftRestored && status === 'current' && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center">
              <p className="text-xs font-medium text-emerald-700">이전 진행이 복구되었습니다</p>
            </div>
          )}

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">
                {`세션 ${sessionId}`}
                <span className="ml-1.5 text-sm font-normal text-slate-400">{`/ ${total}`}</span>
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="패널 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* PR-SESSION-UX-02: 세션 클릭 시 바로 운동 목록 (시작 화면 제거) */}
          <>
          {/* 운동 목록 — rationale은 상단에만 표시 */}
          <div className="max-h-[58vh] overflow-y-auto px-5 pt-4 pb-4">
            {rationale && (status === 'current' || status === 'completed') && 'chips' in rationale && Array.isArray(rationale.chips) && rationale.chips.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {rationale.chips.map((chip) => (
                  <span key={chip} className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {rationale && (status === 'current' || status === 'completed') && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{rationale.headline}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{rationale.detail}</p>
                {'adaptation_summary' in rationale && rationale.adaptation_summary && (
                  <p className="mt-1.5 text-xs text-slate-600">{rationale.adaptation_summary}</p>
                )}
              </div>
            )}
            <ExerciseList
              exercises={exercises}
              status={status}
              logs={logs}
              isLockedNext={isLockedNext}
              nextUnlockAt={nextUnlockAt}
              onPlay={(item, idx) => setExerciseIndex(idx)}
            />
          </div>

          {/* 종료 CTA 바 (current 세션만) — PR-UX-00: 질문 블록 제거, 버튼만 */}
          {status === 'current' && !completed && (
            <div className="border-t border-slate-100 px-5 py-4 space-y-3">
              {completeError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <p className="text-xs text-red-600">{completeError}</p>
                </div>
              )}
              <button
                type="button"
                disabled={completing || !activePlan?.session_number}
                onClick={handleSessionCompleteClick}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-400 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {completing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />저장 중...</>
                ) : (
                  <>세션 종료하기</>
                )}
              </button>
            </div>
          )}
          </>
        </>
          )}
        </div>
      </div>

      {/* 운동 실행 모달 — PR-SESSION-UX-02: 다음 버튼으로 연속 흐름 */}
      <ExercisePlayerModal
        item={exercises && exerciseIndex != null ? exercises[exerciseIndex] ?? null : null}
        exerciseIndex={exerciseIndex}
        totalExercises={exercises?.length ?? 0}
        initialLog={exercises && exerciseIndex != null ? logs[exercises[exerciseIndex]?.templateId ?? ''] : undefined}
        onClose={() => setExerciseIndex(null)}
        onComplete={handleLogComplete}
        onNextOrEnd={handleNextOrEnd}
        sessionGoalText={
          rationale && 'chips' in rationale && Array.isArray(rationale.chips) && rationale.chips.length > 0
            ? rationale.chips.slice(0, 2).join(' + ')
            : undefined
        }
        painModeMessage={
          activePlan && 'plan_json' in activePlan &&
          ['caution', 'protected'].includes((activePlan.plan_json as { meta?: { pain_mode?: string } })?.meta?.pain_mode ?? '')
            ? '무리하지 말고 편안한 범위에서 수행하세요'
            : undefined
        }
      />

      {/* 세션 종료 시트 (PR-UX-00) */}
      {showSessionCompletionSheet && status === 'current' && !completed && (
        <>
          <div
            className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm animate-in fade-in"
            style={{ animationDuration: '150ms' }}
            onClick={() => setShowSessionCompletionSheet(false)}
            aria-hidden
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[80] animate-in slide-in-from-bottom-4"
            style={{ animationDuration: '250ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto max-w-[430px] rounded-t-2xl border border-slate-200 bg-white px-5 py-5 pb-8 shadow-2xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                세션 종료 — 간단한 체크
              </p>
              <SessionCompletionSheet
                perceivedDifficulty={sessionPerceivedDifficulty}
                painAreas={sessionPainAreas}
                onPerceivedDifficultyChange={setSessionPerceivedDifficulty}
                onPainAreasChange={setSessionPainAreas}
                onConfirm={handleSessionCompletionConfirm}
                completing={completing}
                bodyStateAfter={bodyStateAfter}
                onBodyStateAfterChange={setBodyStateAfter}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* ─── 운동 목록 ──────────────────────────────────────────────── */

function formatUnlockMessage(nextUnlockAt?: string): string {
  if (nextUnlockAt) {
    try {
      const d = new Date(nextUnlockAt)
      if (!Number.isNaN(d.getTime())) {
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
        const h = kst.getUTCHours()
        const m = kst.getUTCMinutes()
        if (h === 0 && m === 0) return '다음 세션은 내일 다시 열립니다.'
        return `다음 세션은 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} 이후 열립니다.`
      }
    } catch { /* fallback */ }
  }
  return '내일 다시 열립니다.'
}

function ExerciseList({
  exercises,
  status,
  logs,
  isLockedNext,
  nextUnlockAt,
  onPlay,
}: {
  exercises: ExerciseItem[] | undefined
  status: SessionStatus
  logs: Record<string, ExerciseLogItem>
  isLockedNext?: boolean
  nextUnlockAt?: string
  onPlay: (item: ExerciseItem, index: number) => void
}) {
  if (status === 'locked') {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
        <p className="text-sm text-slate-500">
          {isLockedNext
            ? `오늘 세션을 완료했어요. ${formatUnlockMessage(nextUnlockAt)}`
            : '아직 준비되지 않은 세션입니다.'}
        </p>
      </div>
    )
  }
  // undefined = 로딩 중 (createSession/plan-summary 호출 중) — 스켈레톤으로 즉시 레이아웃 고정
  if (exercises === undefined) {
    return (
      <div className="space-y-4 animate-in fade-in" style={{ animationDuration: '120ms' }}>
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-slate-100">
              <div className="h-5 w-5 shrink-0 rounded bg-slate-200 animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-3.5 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400">운동 구성을 불러오는 중...</p>
      </div>
    )
  }
  // [] = 데이터 없음 (createSession 실패 등)
  if (exercises.length === 0) {
    return (
      <div className="space-y-1 rounded-xl bg-slate-50 px-4 py-5 text-center">
        <p className="text-sm text-slate-500">운동 구성을 불러올 수 없습니다.</p>
        <p className="text-xs text-slate-400">페이지를 새로고침하면 다시 시도할 수 있습니다.</p>
      </div>
    )
  }

  const grouped = groupBySegment(exercises)

  return (
    <div className="space-y-4">
      {grouped.map(({ title, items }) => (
        <div key={title}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {title}
          </p>
          <div className="space-y-1.5">
            {items.map((item, i) => {
              const isDone = !!logs[item.templateId]
              const log = logs[item.templateId]
              return (
                <div
                  key={`${item.templateId}-${i}`}
                  className={[
                    'flex items-center gap-3 rounded-xl px-4 py-3 transition-colors',
                    isDone ? 'bg-emerald-50' : 'bg-slate-50',
                  ].join(' ')}
                >
                  {/* 완료 체크 or 순서 번호 */}
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-200 text-[10px] font-medium text-slate-400">
                      {item.order}
                    </span>
                  )}

                  {/* 운동명 + 목표/실적 */}
                  <div className="min-w-0 flex-1">
                    <p className={[
                      'truncate text-sm font-medium',
                      isDone ? 'text-emerald-800' : 'text-slate-800',
                    ].join(' ')}>
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {isDone && log
                        ? `${log.sets ?? '-'}세트 × ${log.reps ?? '-'}회${log.difficulty ? ` · 난이도 ${log.difficulty}` : ''}`
                        : item.targetSets && item.targetReps
                          ? `목표 ${item.targetSets}×${item.targetReps}`
                          : item.holdSeconds
                            ? `${item.holdSeconds}초 유지`
                            : null}
                    </p>
                  </div>

                  {/* ▶ 버튼 — current/completed(과거) 세션에서 재생 가능 */}
                  <button
                    type="button"
                    onClick={() => (status === 'current' || status === 'completed') ? onPlay(item, Math.max(0, exercises?.findIndex((e) => e.templateId === item.templateId && e.segmentTitle === item.segmentTitle && e.order === item.order) ?? 0)) : undefined}
                    disabled={status === 'locked'}
                    title={status === 'locked' ? '현재 세션이 아닙니다' : '운동 보기'}
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      status === 'current' || status === 'completed'
                        ? isDone
                          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'cursor-not-allowed bg-slate-100 text-slate-300',
                    ].join(' ')}
                    aria-label={`${item.name} 운동 시작`}
                  >
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── 헬퍼 ── */
function groupBySegment(items: ExerciseItem[]): { title: string; items: ExerciseItem[] }[] {
  const map = new Map<string, ExerciseItem[]>()
  for (const item of items) {
    const arr = map.get(item.segmentTitle) ?? []
    arr.push(item)
    map.set(item.segmentTitle, arr)
  }
  return Array.from(map.entries()).map(([title, items]) => ({ title, items }))
}
