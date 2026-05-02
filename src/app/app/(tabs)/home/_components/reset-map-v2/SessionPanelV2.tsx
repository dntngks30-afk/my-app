'use client'

import { useRef, useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { X, Play, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { ExerciseItem } from './planJsonAdapter'
import { getLogKey } from './planJsonAdapter'
import type { ExerciseLogItem, SessionPlan, ActivePlanSummary } from '@/lib/session/client'
import { isExerciseLogCompleted, getExerciseLogDisplayValue } from './exercise-log-helpers'
import { buildSessionDisplayCopy, type SessionDisplayCopyInput } from '@/lib/session/session-display-copy'
import { ExercisePlayerModal } from './ExercisePlayerModal'
import SessionCompleteSummary from '@/app/app/routine/_components/SessionCompleteSummary'
import { ReflectionModal } from './ReflectionModal'
import { NextSessionPreviewCard } from '../NextSessionPreviewCard'
import {
  getLockedNextPreviewRecoveryReason,
  isUsableNextSessionPreview,
  normalizeNextSessionPreviewForDisplay,
  resolveLockedNextSessionPreview,
  resolvePostCompletionNextSessionPreview,
  type LockedNextPreviewRecoveryReason,
  type NextSessionPreviewPayload,
} from '@/lib/session/next-session-preview'
import {
  shouldShowLockedPreviewLoadingState,
  type LockedPreviewFetchState,
} from '@/lib/session/locked-preview-recovery'
import { useHomeSessionPanelState } from './useHomeSessionPanelState'
import {
  closeButtonGhost,
  dragHandle,
  panelHeaderBorder,
  panelSectionBorder,
  primaryCtaRestrained,
  sessionGoalCard,
  sessionGoalLabel,
  sheetContainer,
  statusChip,
  titleMuted,
  titlePrimary,
} from './homeExecutionTheme'

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
  /** PR-ALG-15: adaptive explanation from bootstrap */
  adaptiveExplanation?: { title: string; message: string } | null
  /** PR-RISK-02: next session from bootstrap (post-completion 카드 데이터 우선) */
  nextSession?: NextSessionPreviewPayload | null
  /** PR-NEXT-05: locked-next 패널에서 preview null/mismatch/thin 시 fallback fetch */
  onFetchLockedPreview?: (
    sessionNumber: number,
    options?: { forceRefresh?: boolean }
  ) => Promise<NextSessionPreviewPayload | null>
  /** createSession 실패 시 구체적 원인 (패널 내 표면화용) */
  createSessionError?: { code: string; message: string } | null
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  current: '진행 중',
  completed: '완료',
  locked: '잠김',
}

/** PR3 + PR-RISK-09: panel copy aligns with map/summary (legacy recovery sees session_number). */
function getPlanRationale(plan: SessionPlan | ActivePlanSummary | null) {
  if (!plan || !('plan_json' in plan) || !plan.plan_json || typeof plan.plan_json !== 'object') return null
  const meta = (plan.plan_json as { meta?: SessionDisplayCopyInput }).meta
  if (!meta || typeof meta !== 'object') return null
  const sn =
    typeof plan.session_number === 'number' && Number.isFinite(plan.session_number)
      ? Math.floor(plan.session_number)
      : undefined
  const copy = buildSessionDisplayCopy({
    ...(meta as SessionDisplayCopyInput),
    ...(sn != null ? { session_number: sn } : {}),
  })
  return {
    panelTitle: copy.panelTitle,
    headline: copy.panelHeadline,
    detail: copy.panelDetail,
    chips: copy.panelChips,
    ...(typeof meta.adaptation_summary === 'string' && meta.adaptation_summary.trim() && {
      adaptation_summary: meta.adaptation_summary,
    }),
  }
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
  adaptiveExplanation,
  nextSession,
  onFetchLockedPreview,
  createSessionError,
}: SessionPanelV2Props) {
  if (sessionId === null) return null

  return (
    <PanelInner
      sessionId={sessionId}
      total={total}
      completedSessions={completedSessions}
      status={status}
      exercises={exercises}
      activePlan={activePlan}
      initialLogs={initialLogs}
      isLockedNext={isLockedNext}
      nextUnlockAt={nextUnlockAt}
      onClose={onClose}
      onSessionCompleted={onSessionCompleted}
      onRequestNextSession={onRequestNextSession}
      adaptiveExplanation={adaptiveExplanation}
      nextSession={nextSession}
      onFetchLockedPreview={onFetchLockedPreview}
      createSessionError={createSessionError}
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
  adaptiveExplanation,
  nextSession,
  onFetchLockedPreview,
  createSessionError,
}: Omit<SessionPanelV2Props, 'sessionId'> & {
  sessionId: number
  onSessionCompleted?: (completedSessions: number) => void
  onRequestNextSession?: (nextSessionNumber: number) => void
}) {
  const panelState = useHomeSessionPanelState({
    sessionId,
    total,
    status,
    exercises,
    activePlan,
    initialLogs,
    onSessionCompleted,
  })

  const {
    logs,
    draftRestored,
    exerciseIndex,
    setExerciseIndex,
    showReflectionModal,
    completing,
    completeError,
    completed,
    completeResult,
    lastReflectionDifficulty,
    lastReflectionHadPainAreas,
    handleLogComplete,
    handleNextOrEnd,
    handleSessionCompleteClick,
    handleReflectionSubmit,
  } = panelState

  const rationale = getPlanRationale(activePlan)
  const lockedPreviewRecoveryReason = getLockedNextPreviewRecoveryReason({
    sessionId,
    status,
    isLockedNext,
    nextSession,
  })
  const lockedPreviewData = resolveLockedNextSessionPreview({
    sessionId,
    status,
    isLockedNext,
    nextSession,
  })

  // PR-NEXT-05: locked-next 패널에서 prop preview null/mismatch/thin 시 fallback fetch
  const [fallbackPreview, setFallbackPreview] = useState<NextSessionPreviewPayload | null>(null)
  const [fallbackFetchState, setFallbackFetchState] = useState<LockedPreviewFetchState>('idle')
  const fallbackFetchAttemptedRef = useRef(false) // sessionId별로 한 번만 시도
  const needsFallbackFetch =
    status === 'locked' &&
    isLockedNext === true &&
    sessionId != null &&
    lockedPreviewRecoveryReason !== null &&
    typeof onFetchLockedPreview === 'function'

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    if (!needsFallbackFetch || !lockedPreviewRecoveryReason) return
    console.info('[locked-next-preview]', {
      sessionId,
      reason: lockedPreviewRecoveryReason,
    })
  }, [needsFallbackFetch, lockedPreviewRecoveryReason, sessionId])

  useEffect(() => {
    if (!needsFallbackFetch) return
    if (fallbackFetchAttemptedRef.current) return
    if (!onFetchLockedPreview) return
    fallbackFetchAttemptedRef.current = true
    setFallbackFetchState('loading')

    let cancelled = false
    void onFetchLockedPreview(sessionId, { forceRefresh: true }).then((payload) => {
      if (cancelled) return
      const normalizedPayload = normalizeNextSessionPreviewForDisplay(payload)
      if (isUsableNextSessionPreview(normalizedPayload, sessionId)) {
        setFallbackPreview(normalizedPayload)
        setFallbackFetchState('succeeded')
        if (process.env.NODE_ENV !== 'production') {
          console.info('[locked-next-preview]', {
            sessionId,
            reason: 'fallback_fetch_succeeded',
          })
        }
        return
      }
      setFallbackFetchState('failed')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[locked-next-preview]', {
          sessionId,
          reason: 'fallback_fetch_failed',
        })
      }
    }).catch(() => {
      if (cancelled) return
      setFallbackFetchState('failed')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[locked-next-preview]', {
          sessionId,
          reason: 'fallback_fetch_failed',
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [needsFallbackFetch, sessionId, onFetchLockedPreview])

  // sessionId 변경 시 fallback 상태 리셋
  const prevSessionIdRef = useRef<number | null>(null)
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId
      fallbackFetchAttemptedRef.current = false
      setFallbackPreview(null)
      setFallbackFetchState('idle')
    }
  }, [sessionId])

  const effectiveLockedPreview = normalizeNextSessionPreviewForDisplay(lockedPreviewData ?? fallbackPreview)
  const shouldRenderLockedPreviewCard =
    status === 'locked' &&
    isLockedNext === true &&
    !!effectiveLockedPreview
  const showLockedPreviewLoading = shouldShowLockedPreviewLoadingState({
    status,
    isLockedNext,
    sessionId,
    effectiveLockedPreview,
    recoveryReason: lockedPreviewRecoveryReason,
    fallbackFetchState,
  })

  // PR-SESSION-UX-02: 세션 전환 시 운동 뷰 리셋 (hook 내부에서 처리)
  // 패널 open 측정
  useEffect(() => {
    if (sessionId != null && typeof performance !== 'undefined' && performance.mark) {
      performance.mark('panel_opened')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[perf] panel_opened')
      }
    }
  }, [sessionId])
  useEffect(() => {
    trackEvent(
      'session_panel_opened',
      {
        route_group: 'session_panel',
        session_number: sessionId,
        status,
        exercise_count: exercises?.length ?? null,
      },
      {
        route_group: 'session_panel',
        session_number: sessionId,
        dedupe_key: `session_panel_opened:${sessionId}:${status}`,
      }
    )
  }, [exercises, sessionId, status])
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

  return (
    <>
      {/* Backdrop — 즉시 반응 느낌 */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in"
        style={{ animationDuration: '100ms' }}
        onClick={exerciseIndex != null ? undefined : onClose}
        aria-hidden
      />

      {/* Bottom Sheet — 빠른 슬라이드 */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 animate-in slide-in-from-bottom-4"
        style={{ animationDuration: '180ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className={sheetContainer}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className={dragHandle} />
          </div>

          {/* Reflection: complete 이후 요약 화면 — 방금 완료한 세션만 표시 */}
          {completed && completeResult && sessionId === completeResult.progress.completed_sessions && (
            <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto space-y-4">
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
              {/* PR-RISK-02: 다음 세션 안내는 NextSessionPreviewCard 단일 블록. bootstrap next_session 우선, completeResult fallback */}
              <NextSessionPreviewCard
                data={resolvePostCompletionNextSessionPreview({
                  completedSessions: completeResult.progress.completed_sessions,
                  total,
                  nextTheme: completeResult.next_theme,
                  nextSession,
                })}
                variant="post-completion"
                isLockedUntilTomorrow={isLockedNext ?? false}
                lastSessionDifficulty={lastReflectionDifficulty}
                lastSessionHadPainAreas={lastReflectionHadPainAreas}
                adaptiveExplanation={adaptiveExplanation}
                onPrimaryCta={
                  (isLockedNext ?? false)
                    ? onClose
                    : onRequestNextSession
                      ? () => {
                          const next = Math.min(completeResult.progress.completed_sessions + 1, total)
                          if (next <= total) onRequestNextSession(next)
                        }
                      : onClose
                }
              />
            </div>
          )}

          {/* 기존 패널: 미완료 시 또는 다음 세션 미리보기 */}
          {!(completed && completeResult && sessionId === completeResult.progress.completed_sessions) && (
            <>
          {/* PR-SESSION-FIX-03: 다음 세션 미리보기 배너 */}
          {completedSessions != null && sessionId === completedSessions + 1 && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-violet-400/25 bg-violet-950/35 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-violet-200">다음 세션 준비됐어요</p>
              <p className="mt-0.5 text-xs text-violet-300/90">세션 {sessionId}에서 이런 운동을 하게 돼요</p>
            </div>
          )}

          {/* 완료 상태 배너 (다음 세션 미리보기 배너와 겹치지 않음) */}
          {completed && completedSessions != null && sessionId !== completedSessions + 1 && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-emerald-200">세션 완료! 수고하셨습니다 🎉</p>
            </div>
          )}

          {/* PR-PERSIST-01: 이전 진행 복구 안내 */}
          {draftRestored && status === 'current' && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-4 py-2 text-center">
              <p className="text-xs font-medium text-emerald-200">이전 진행이 복구되었습니다</p>
            </div>
          )}

          {/* 헤더 */}
          <div className={`flex items-center justify-between px-5 pb-3 pt-3 ${panelHeaderBorder}`}>
            <div className="flex items-center gap-2">
              <h2 className={titlePrimary}>
                {`세션 ${sessionId}`}
                <span className={`ml-1.5 ${titleMuted}`}>{`/ ${total}`}</span>
              </h2>
              <span className={statusChip[status]}>{STATUS_LABEL[status]}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={closeButtonGhost}
              aria-label="패널 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* PR-SESSION-UX-02: 세션 클릭 시 바로 운동 목록 (시작 화면 제거) */}
          <>
          {/* PR-ALG-10: Session Goal — rationale 상단 표시 */}
          <div className="max-h-[58vh] overflow-y-auto px-5 pt-4 pb-4">
            {rationale && (status === 'current' || status === 'completed') && (
              <div className={sessionGoalCard}>
                <p className={sessionGoalLabel}>오늘의 목표</p>
                {'panelTitle' in rationale && typeof rationale.panelTitle === 'string' && rationale.panelTitle && (
                  <p className="mt-1 text-sm font-semibold text-white/90">{rationale.panelTitle}</p>
                )}
                <p className="mt-1.5 text-xs leading-5 text-white/65">{rationale.headline}</p>
                {rationale.detail && (
                  <p className="mt-1 text-xs leading-5 text-white/55">{rationale.detail}</p>
                )}
                {'adaptation_summary' in rationale && rationale.adaptation_summary && (
                  <p className="mt-1.5 text-xs text-white/65">{rationale.adaptation_summary}</p>
                )}
                {'chips' in rationale && Array.isArray(rationale.chips) && rationale.chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rationale.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-lg bg-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-white/65"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {shouldRenderLockedPreviewCard ? (
              <NextSessionPreviewCard
                data={effectiveLockedPreview}
                variant="locked-panel"
                isLockedUntilTomorrow
              />
            ) : showLockedPreviewLoading ? (
              <LockedPreviewLoadingState reason={lockedPreviewRecoveryReason} />
            ) : (
              <ExerciseList
                exercises={exercises}
                status={status}
                logs={logs}
                isLockedNext={isLockedNext}
                nextUnlockAt={nextUnlockAt}
                onPlay={(item, idx) => setExerciseIndex(idx)}
                createSessionError={createSessionError}
              />
            )}
          </div>

          {/* 종료 CTA 바 (current 세션만) — PR-UX-00: 질문 블록 제거, 버튼만 */}
          {status === 'current' && !completed && (
            <div className={`space-y-3 px-5 py-4 ${panelSectionBorder}`}>
              {completeError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-950/40 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <p className="text-xs text-red-200/95">{completeError}</p>
                </div>
              )}
              <button
                type="button"
                disabled={completing || !activePlan?.session_number}
                onClick={handleSessionCompleteClick}
                className={primaryCtaRestrained}
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
        sessionNumber={sessionId}
        exerciseIndex={exerciseIndex}
        totalExercises={exercises?.length ?? 0}
        initialLog={exercises && exerciseIndex != null ? logs[getLogKey(exercises[exerciseIndex]!)] ?? logs[exercises[exerciseIndex]?.templateId ?? ''] : undefined}
        onClose={() => setExerciseIndex(null)}
        onComplete={handleLogComplete}
        onNextOrEnd={handleNextOrEnd}
        sessionGoalText={
          rationale && 'panelTitle' in rationale && typeof rationale.panelTitle === 'string'
            ? rationale.panelTitle
            : undefined
        }
        painModeMessage={
          activePlan && 'plan_json' in activePlan &&
          ['caution', 'protected'].includes((activePlan.plan_json as { meta?: { pain_mode?: string } })?.meta?.pain_mode ?? '')
            ? '무리하지 말고 편안한 범위에서 수행하세요'
            : undefined
        }
      />

      {/* PR-UX-03: 리플렉션 모달 (종료 전 필수, 닫기 불가) */}
      {showReflectionModal && status === 'current' && !completed && (
        <ReflectionModal
          onSubmit={handleReflectionSubmit}
          submitting={completing}
        />
      )}
    </>
  )
}

/* ─── 운동 목록 ──────────────────────────────────────────────── */

function LockedPreviewLoadingState({
  reason,
}: {
  reason: LockedNextPreviewRecoveryReason | null
}) {
  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-950/35 px-4 py-5 text-center">
      <div className="flex items-center justify-center gap-2 text-violet-200">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <p className="text-sm font-semibold">다음 세션 미리보기를 불러오는 중...</p>
      </div>
      <p className="mt-1 text-xs text-violet-300/85">
        잠금 상태는 유지되지만, 다음 세션 내용을 새로 복구하고 있습니다.
      </p>
      {process.env.NODE_ENV !== 'production' && reason && (
        <p className="mt-2 text-[11px] text-violet-400/80">{`debug: ${reason}`}</p>
      )}
    </div>
  )
}

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
  createSessionError,
}: {
  exercises: ExerciseItem[] | undefined
  status: SessionStatus
  logs: Record<string, ExerciseLogItem>
  isLockedNext?: boolean
  nextUnlockAt?: string
  onPlay: (item: ExerciseItem, index: number) => void
  createSessionError?: { code: string; message: string } | null
}) {
  if (status === 'locked') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
        <p className="text-sm text-white/65">
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
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-white/10" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-3.5 w-24 animate-pulse rounded bg-white/12" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
              </div>
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-white/10" />
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-white/45">운동 구성을 불러오는 중...</p>
      </div>
    )
  }
  // [] = 데이터 없음 (createSession 실패 등)
  if (exercises.length === 0) {
    const message = createSessionError?.message ?? '운동 구성을 불러올 수 없습니다.'
    return (
      <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
        <p className="text-sm text-white/65">{message}</p>
        {process.env.NODE_ENV !== 'production' && createSessionError?.code && (
          <p className="text-xs text-white/45">code: {createSessionError.code}</p>
        )}
        <p className="text-xs text-white/45">페이지를 새로고침하면 다시 시도할 수 있습니다.</p>
      </div>
    )
  }

  const panelStatus = status as SessionStatus
  const grouped = groupBySegment(exercises)

  return (
    <div className="space-y-4">
      {grouped.map(({ title, items }) => (
        <div key={title}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/45">
            {title}
          </p>
          <div className="space-y-1.5">
            {items.map((item, i) => {
              const log = logs[getLogKey(item)] ?? logs[item.templateId]
              const isDone = isExerciseLogCompleted(log, item)
              const displayValue = getExerciseLogDisplayValue(log, item)
              return (
                <div
                  key={`${item.templateId}-${i}`}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                    isDone
                      ? 'border-emerald-500/25 bg-emerald-950/35'
                      : 'border-white/[0.08] bg-white/[0.04]',
                  ].join(' ')}
                >
                  {/* 완료 체크 or 순서 번호 */}
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400/95" aria-hidden />
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-medium text-white/45">
                      {item.order}
                    </span>
                  )}

                  {/* 운동명 + rationale + 목표/실적 */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'truncate text-sm font-medium',
                        isDone ? 'text-emerald-100' : 'text-white/90',
                      ].join(' ')}
                    >
                      {item.name}
                    </p>
                    {item.rationale && (
                      <p className="mt-0.5 text-xs text-white/55">{item.rationale}</p>
                    )}
                    <p className="mt-0.5 text-xs text-white/45">
                      {isDone && displayValue
                        ? `${displayValue}${log?.difficulty ? ` · 난이도 ${log.difficulty}` : ''}`
                        : item.targetSets && item.targetReps
                          ? `목표 ${item.targetSets}×${item.targetReps}`
                          : item.holdSeconds
                            ? `목표 ${item.holdSeconds}초 유지`
                            : null}
                    </p>
                  </div>

                  {/* ▶ 버튼 — current/completed(과거) 세션에서 재생 가능 */}
                  <button
                    type="button"
                    onClick={() => onPlay(item, Math.max(0, exercises.findIndex((e) => (e.plan_item_key ? e.plan_item_key === item.plan_item_key : e.templateId === item.templateId && e.segmentTitle === item.segmentTitle && e.order === item.order))))}
                    title={
                      panelStatus === 'current' || panelStatus === 'completed'
                        ? '운동 보기'
                        : '현재 세션이 아닙니다'
                    }
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      panelStatus === 'current' || panelStatus === 'completed'
                        ? isDone
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                          : 'border-orange-500/35 bg-orange-500/12 text-orange-200 hover:bg-orange-500/22'
                        : 'cursor-not-allowed border-white/10 bg-white/[0.04] text-white/25',
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
