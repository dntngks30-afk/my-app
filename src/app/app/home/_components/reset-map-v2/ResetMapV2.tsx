'use client'

import { useState, useCallback } from 'react'
import { JourneyMapV2 } from './JourneyMapV2'
import { SessionSheetV2 } from './SessionSheetV2'
import { sessions, type SessionNode } from './map-data'

interface ResetMapV2Props {
  /** 전체 세션 수 (max 20) */
  total: number
  /** 완료된 세션 수 */
  completed: number
}

export function ResetMapV2({ total, completed }: ResetMapV2Props) {
  // currentSession: 다음에 해야 할 세션 번호 (1-indexed)
  // completed=3 이면 4번이 current, completed=0 이면 1번이 current
  const currentSession = Math.min(completed + 1, total, sessions.length)

  const [selectedSession, setSelectedSession] = useState<SessionNode | null>(null)

  const handleNodeTap = useCallback((session: SessionNode) => {
    setSelectedSession(session)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSelectedSession(null)
  }, [])

  // ResetMapV2는 읽기 전용 뷰: 세션 완료는 실제 루틴 플레이어를 통해 진행
  const handleComplete = useCallback(() => {
    setSelectedSession(null)
  }, [])

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]" style={{ height: '70vh', maxHeight: 560 }}>
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

      {/* 세션 상세 시트 */}
      <SessionSheetV2
        session={selectedSession}
        isCompleted={selectedSession ? selectedSession.id < currentSession : false}
        isCurrent={selectedSession ? selectedSession.id === currentSession : false}
        onClose={handleCloseSheet}
        onComplete={handleComplete}
      />
    </div>
  )
}
