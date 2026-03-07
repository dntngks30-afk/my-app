'use client'

import { useRef, useState, useEffect } from 'react'
import { X, Play, CheckCircle2, AlertCircle, Loader2, Dumbbell } from 'lucide-react'
import { getSessionSafe } from '@/lib/supabase'
import { completeSession } from '@/lib/session/client'
import type { ExerciseItem } from './planJsonAdapter'
import type { ExerciseLogItem, SessionPlan, ActivePlanSummary } from '@/lib/session/client'
import { ExercisePlayerModal } from './ExercisePlayerModal'

type SessionStatus = 'current' | 'completed' | 'locked'

interface SessionPanelV2Props {
  /** null이면 패널 닫힘 */
  sessionId: number | null
  total: number
  status: SessionStatus
  /** plan_json에서 추출된 운동 배열. undefined = 로딩 전, [] = 데이터 없음 */
  exercises: ExerciseItem[] | undefined
  /** 현재 active plan — session_number + status 사용 (SessionPlan | ActivePlanSummary) */
  activePlan: SessionPlan | ActivePlanSummary | null
  /** daily cap: 다음 세션이 오늘 완료로 locked인 경우 */
  isLockedNext?: boolean
  /** daily cap: 다음 세션 해제 시각 (ISO string) */
  nextUnlockAt?: string
  onClose: () => void
  /** 세션 완료 후 새 completed_sessions 값을 상위로 전달 */
  onSessionCompleted?: (completedSessions: number) => void
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

export function SessionPanelV2({
  sessionId,
  total,
  status,
  exercises,
  activePlan,
  isLockedNext,
  nextUnlockAt,
  onClose,
  onSessionCompleted,
}: SessionPanelV2Props) {
  if (sessionId === null) return null

  return (
    <PanelInner
      sessionId={sessionId}
      total={total}
      status={status}
      exercises={exercises}
      activePlan={activePlan}
      isLockedNext={isLockedNext}
      nextUnlockAt={nextUnlockAt}
      onClose={onClose}
      onSessionCompleted={onSessionCompleted}
    />
  )
}

/* ─── 내부 컴포넌트 ──────────────────────────────────────────── */

function PanelInner({
  sessionId,
  total,
  status,
  exercises,
  activePlan,
  isLockedNext,
  nextUnlockAt,
  onClose,
  onSessionCompleted,
}: Required<Omit<SessionPanelV2Props, 'onSessionCompleted'>> & {
  onSessionCompleted?: (completedSessions: number) => void
}) {
  // 로컬 운동 로그 누적 (templateId → log)
  const [logs, setLogs] = useState<Record<string, ExerciseLogItem>>({})
  // 모달에서 열린 운동 아이템
  const [openItem, setOpenItem] = useState<ExerciseItem | null>(null)

  // 패널 open 측정
  useEffect(() => {
    if (sessionId != null && typeof performance !== 'undefined' && performance.mark) {
      performance.mark('panel_opened')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[perf] panel_opened')
      }
    }
  }, [sessionId])
  // 종료 API 상태
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  // 패널 오픈 시각 (duration 계산용)
  const startedAtRef = useRef(Date.now())

  const handleLogComplete = (log: ExerciseLogItem) => {
    setLogs(prev => ({ ...prev, [log.templateId]: log }))
    setOpenItem(null)
  }

  const handleSessionComplete = async () => {
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

      // 전체 완료 여부로 completion_mode 결정
      const allDone =
        exercises && exercises.length > 0 && exercises.every(e => !!logs[e.templateId])
      const completionMode = allDone ? 'all_done' : exerciseLogsArray.length > 0 ? 'partial_done' : 'stop_early'

      const result = await completeSession(session.access_token, {
        session_number: sessionNumber,
        duration_seconds: durationSec,
        completion_mode: completionMode,
        exercise_logs: exerciseLogsArray,
      })

      if (!result.ok) {
        // 이미 완료된 경우(idempotent)는 에러가 아님
        setCompleteError(`저장 실패: ${result.error.message}. 다시 시도하거나 페이지를 새로고침해 주세요.`)
        setCompleting(false)
        return
      }

      setCompleted(true)
      setCompleting(false)

      const newCompleted = result.data.progress?.completed_sessions ?? sessionNumber
      onSessionCompleted?.(newCompleted)

      // 1.5초 후 패널 자동 닫기
      setTimeout(onClose, 1500)
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setCompleting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-in fade-in"
        style={{ animationDuration: '180ms' }}
        onClick={openItem ? undefined : onClose}
        aria-hidden
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 animate-in slide-in-from-bottom-4"
        style={{ animationDuration: '280ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-[430px] rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Drag handle */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
          </div>

          {/* 완료 상태 배너 */}
          {completed && (
            <div className="mx-4 mt-2 mb-0 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-emerald-700">세션 완료! 수고하셨습니다 🎉</p>
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

          {/* 운동 목록 */}
          <div className="max-h-[58vh] overflow-y-auto px-5 pt-4 pb-4">
            <ExerciseList
              exercises={exercises}
              status={status}
              logs={logs}
              isLockedNext={isLockedNext}
              nextUnlockAt={nextUnlockAt}
              onPlay={item => setOpenItem(item)}
            />
          </div>

          {/* 종료 CTA 바 (current 세션만) — 운동 목록 하단에 위치 */}
          {status === 'current' && !completed && (
            <div className="border-t border-slate-100 px-5 py-4">
              {completeError && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <p className="text-xs text-red-600">{completeError}</p>
                </div>
              )}
              <button
                type="button"
                disabled={completing || !activePlan?.session_number}
                onClick={handleSessionComplete}
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
        </div>
      </div>

      {/* 운동 실행 모달 */}
      <ExercisePlayerModal
        item={openItem}
        initialLog={openItem ? logs[openItem.templateId] : undefined}
        onClose={() => setOpenItem(null)}
        onComplete={handleLogComplete}
      />
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
  onPlay: (item: ExerciseItem) => void
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
  // undefined = 로딩 중 (createSession 호출 전/중)
  if (exercises === undefined) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 px-4 py-8">
        <Dumbbell className="h-5 w-5 animate-pulse text-orange-400" />
        <p className="text-sm text-slate-500">운동 구성을 준비 중입니다...</p>
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
                    onClick={() => (status === 'current' || status === 'completed') ? onPlay(item) : undefined}
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
