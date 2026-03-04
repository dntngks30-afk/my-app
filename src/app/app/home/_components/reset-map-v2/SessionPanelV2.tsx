'use client'

import { X, Play } from 'lucide-react'
import type { ExerciseItem } from './planJsonAdapter'

type SessionStatus = 'current' | 'completed' | 'locked'

interface SessionPanelV2Props {
  /** null이면 패널 닫힘 */
  sessionId: number | null
  total: number
  status: SessionStatus
  /** plan_json에서 추출된 운동 배열. undefined = 로딩 전, [] = 데이터 없음 */
  exercises: ExerciseItem[] | undefined
  onClose: () => void
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
  onClose,
}: SessionPanelV2Props) {
  if (sessionId === null) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in"
        style={{ animationDuration: '180ms' }}
        onClick={onClose}
        aria-hidden
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4"
        style={{ animationDuration: '280ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)' }}
      >
        <div className="mx-auto max-w-[430px] rounded-t-2xl bg-white border border-slate-200 px-5 pt-4 pb-10 shadow-xl">
          {/* Drag handle */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">
                {`세션 ${sessionId}`}
                <span className="ml-1.5 text-sm font-normal text-slate-400">{`/ ${total}`}</span>
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="패널 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Exercise list */}
          <ExerciseList exercises={exercises} status={status} />
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────── */

function ExerciseList({
  exercises,
  status,
}: {
  exercises: ExerciseItem[] | undefined
  status: SessionStatus
}) {
  // 아직 plan이 없는 경우 (locked / 미생성)
  if (status === 'locked') {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
        <p className="text-sm text-slate-500">아직 준비되지 않은 세션입니다.</p>
      </div>
    )
  }

  // plan_json을 못 찾은 경우 (completed지만 plan 없음, 또는 에러)
  if (!exercises?.length) {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-5 text-center space-y-2">
        <p className="text-sm text-slate-500">운동 구성을 불러올 수 없습니다.</p>
        <p className="text-xs text-slate-400">페이지를 새로고침하면 다시 시도할 수 있습니다.</p>
      </div>
    )
  }

  // 세그먼트 기준으로 그루핑하여 렌더
  const grouped = groupBySegment(exercises)

  return (
    <div className="space-y-4">
      {grouped.map(({ title, items }) => (
        <div key={title}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {title}
          </p>
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div
                key={`${item.templateId}-${i}`}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
              >
                {/* 순서 번호 */}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-medium text-slate-400 bg-slate-200">
                  {item.order}
                </span>

                {/* 운동명 + 세트/횟수 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  {(item.targetSets || item.targetReps || item.holdSeconds) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.targetSets && item.targetReps
                        ? `${item.targetSets}×${item.targetReps}`
                        : item.holdSeconds
                          ? `${item.holdSeconds}초 유지`
                          : null}
                    </p>
                  )}
                </div>

                {/* ▶ 버튼 — PR2에서는 준비중 */}
                <button
                  type="button"
                  disabled
                  title="영상 준비 중"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300 cursor-not-allowed"
                  aria-label={`${item.name} 영상 준비 중`}
                >
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                </button>
              </div>
            ))}
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
