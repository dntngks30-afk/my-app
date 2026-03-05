'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { JourneyMapV2 } from './JourneyMapV2'
import { SessionPanelV2 } from './SessionPanelV2'
import { sessions, type SessionNode } from './map-data'
import { extractSessionExercises } from './planJsonAdapter'
import type { ExerciseItem } from './planJsonAdapter'
import type { SessionPlan } from '@/lib/session/client'
import { getSessionSafe } from '@/lib/supabase'
import { getSessionPlan } from '@/lib/session/client'

interface ResetMapV2Props {
  /** 전체 세션 수 (max 20) */
  total: number
  /** 완료된 세션 수 */
  completed: number
  /** HomePageClient에서 내려받은 active plan (plan_json 포함) */
  activePlan: SessionPlan | null
  /** 세션 완료 후 HomePageClient의 sessionProgress 갱신용 콜백 */
  onSessionCompleted?: (completedSessions: number) => void
}

export function ResetMapV2({ total, completed, activePlan, onSessionCompleted }: ResetMapV2Props) {
  // currentSession: 다음에 해야 할 세션 번호 (1-indexed)
  const currentSession = Math.min(completed + 1, total, sessions.length)

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  /** 과거(완료) 세션 plan_json + exercise_logs 캐시 — 클릭 시 1회 조회 */
  const [pastPlanCache, setPastPlanCache] = useState<Record<number, { exercises: ExerciseItem[]; logs: Record<string, ExerciseLogItem> } | 'loading'>>({})

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

  // 과거 세션 클릭 시 plan_json 1회 조회
  useEffect(() => {
    if (selectedSessionId === null || selectedStatus !== 'completed') return
    const cached = pastPlanCache[selectedSessionId]
    if (cached !== undefined && cached !== 'loading') return

    setPastPlanCache(prev => ({ ...prev, [selectedSessionId]: 'loading' }))
    let cancelled = false
    ;(async () => {
      const { session } = await getSessionSafe()
      if (!session?.access_token || cancelled) return
      const result = await getSessionPlan(session.access_token, selectedSessionId)
      if (cancelled) return
      const exercises = result.ok && result.data.plan_json
        ? extractSessionExercises(result.data.plan_json)
        : []
      const logs: Record<string, import('@/lib/session/client').ExerciseLogItem> = {}
      if (result.ok && Array.isArray(result.data.exercise_logs)) {
        for (const log of result.data.exercise_logs) {
          if (log?.templateId) logs[log.templateId] = log
        }
      }
      setPastPlanCache(prev => ({ ...prev, [selectedSessionId]: { exercises, logs } }))
    })()
    return () => { cancelled = true }
  }, [selectedSessionId, selectedStatus])

  // plan_json에서 운동 추출 — current: activePlan, completed: pastPlanCache
  const exercises = useMemo((): ExerciseItem[] | undefined => {
    if (selectedSessionId === null) return undefined
    if (selectedStatus === 'current' && activePlan?.session_number === selectedSessionId) {
      return extractSessionExercises(activePlan.plan_json)
    }
    if (selectedStatus === 'completed') {
      const cached = pastPlanCache[selectedSessionId]
      if (cached === 'loading') return undefined
      return cached?.exercises ?? []
    }
    return []
  }, [selectedSessionId, selectedStatus, activePlan, pastPlanCache])

  const pastExerciseLogs: Record<string, ExerciseLogItem> = selectedSessionId !== null && selectedStatus === 'completed'
    ? (pastPlanCache[selectedSessionId] !== 'loading' && pastPlanCache[selectedSessionId]?.logs) ?? {}
    : {}

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
      style={{ height: '70vh', maxHeight: 560 }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">리셋 지도</p>
          <p className="mt-0.5 text-sm font-bold text-slate-800">
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
        total={total}
        currentSession={currentSession}
        onNodeTap={handleNodeTap}
      />

      {/* 하단 패널 — plan_json 운동 목록 + 세션 종료 */}
      <SessionPanelV2
        sessionId={selectedSessionId}
        total={total}
        status={selectedStatus}
        exercises={exercises}
        activePlan={activePlan}
        pastExerciseLogs={pastExerciseLogs}
        onClose={handleClose}
        onSessionCompleted={onSessionCompleted}
      />
    </div>
  )
}
