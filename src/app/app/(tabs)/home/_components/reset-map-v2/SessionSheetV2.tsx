'use client'

import { type SessionNode } from './map-data'
import { X, Clock, Mountain, ChevronRight } from 'lucide-react'

interface SessionSheetV2Props {
  session: SessionNode | null
  isCompleted: boolean
  isCurrent: boolean
  onClose: () => void
  onComplete: (id: number) => void
}

export function SessionSheetV2({ session, isCompleted, isCurrent, onClose, onComplete }: SessionSheetV2Props) {
  if (!session) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4 duration-300 ease-out">
        <div className="mx-auto max-w-[430px] rounded-t-2xl border border-border/60 bg-card px-6 pt-4 pb-10">
          {/* Drag indicator */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted" />

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase mb-1">
                {`${session.week}주차 · 세션 ${session.id}`}
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {session.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{session.description}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
              aria-label="세션 상세 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Meta badges */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">{session.duration}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mountain className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">{`${session.elevation}m`}</span>
            </div>
            {session.type === 'milestone' && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary tracking-wide">
                {'마일스톤'}
              </span>
            )}
          </div>

          {/* Exercises placeholder — 목업 데이터 비노출, PR2에서 plan_json으로 교체 예정 */}
          <div className="mb-8 rounded-xl bg-secondary/30 px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {'세션 상세(운동 구성)는 곧 연결됩니다'}
            </p>
          </div>

          {/* Action */}
          {isCurrent && !isCompleted && (
            <button
              onClick={() => onComplete(session.id)}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {'세션 시작하기'}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
          {isCompleted && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 py-3.5 text-sm font-medium text-muted-foreground">
              {'완료됨'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
