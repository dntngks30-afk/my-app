'use client'

import { useState, useCallback, useMemo } from 'react'
import { JourneyMapV2 } from './JourneyMapV2'
import { SessionPanelV2 } from './SessionPanelV2'
import { sessions, type SessionNode } from './map-data'
import { extractSessionExercises } from './planJsonAdapter'
import type { SessionPlan } from '@/lib/session/client'

interface ResetMapV2Props {
  /** 전체 세션 수 (max 20) */
  total: number
  /** 완료된 세션 수 */
  completed: number
  /** HomePageClient에서 내려받은 active plan (plan_json 포함) */
  activePlan: SessionPlan | null
}

export function ResetMapV2({ total, completed, activePlan }: ResetMapV2Props) {
  // currentSession: 다음에 해야 할 세션 번호 (1-indexed)
  const currentSession = Math.min(completed + 1, total, sessions.length)

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  const handleNodeTap = useCallback((session: SessionNode) => {
    setSelectedSessionId(session.id)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedSessionId(null)
  }, [])

  // 선택한 세션의 상태
  const selectedStatus = useMemo(() => {
    if (selectedSessionId === null) return 'locked' as const
    if (selectedSessionId < currentSession) return 'completed' as const
    if (selectedSessionId === currentSession) return 'current' as const
    return 'locked' as const
  }, [selectedSessionId, currentSession])

  // plan_json에서 운동 추출 — active 세션(= currentSession)과 클릭한 세션이 일치할 때만 표시
  const exercises = useMemo(() => {
    if (selectedSessionId === null) return undefined
    if (
      selectedStatus === 'current' &&
      activePlan?.session_number === selectedSessionId
    ) {
      return extractSessionExercises(activePlan.plan_json)
    }
    // 완료 세션이라도 현재는 plan을 조회하지 않음(PR3 스코프)
    // locked 세션도 undefined → ExerciseList에서 locked 상태 처리
    return []
  }, [selectedSessionId, selectedStatus, activePlan])

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
      style={{ height: '70vh', maxHeight: 560 }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest">리셋 지도</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {completed} / {total} 세션 완료
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">현재 세션</p>
          <p className="text-lg font-bold text-slate-800">{currentSession}</p>
        </div>
      </div>

      {/* 지도 영역 */}
      <JourneyMapV2
        currentSession={currentSession}
        onNodeTap={handleNodeTap}
      />

      {/* 하단 패널 — plan_json 운동 목록 */}
      <SessionPanelV2
        sessionId={selectedSessionId}
        total={total}
        status={selectedStatus}
        exercises={exercises}
        onClose={handleClose}
      />
    </div>
  )
}
