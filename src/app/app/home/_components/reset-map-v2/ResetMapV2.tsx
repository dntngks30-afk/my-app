'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { JourneyMapV2 } from './JourneyMapV2'
import { SessionPanelV2 } from './SessionPanelV2'
import { sessions, type SessionNode } from './map-data'
import { extractSessionExercises } from './planJsonAdapter'
import { createSession, type SessionPlan } from '@/lib/session/client'
import { getSessionSafe } from '@/lib/supabase'
import { prefetchMediaSign } from './media-cache'

interface ResetMapV2Props {
  /** 전체 세션 수 (max 20) */
  total: number
  /** 완료된 세션 수 */
  completed: number
  /** HomePageClient에서 내려받은 active plan (plan_json 포함) */
  activePlan: SessionPlan | null
  /** 세션 완료 후 HomePageClient의 sessionProgress 갱신용 콜백 */
  onSessionCompleted?: (completedSessions: number) => void
  /** createSession 성공 시 HomePageClient의 activePlan 갱신용 콜백 */
  onActivePlanCreated?: (plan: SessionPlan) => void
}

export function ResetMapV2({ total, completed, activePlan, onSessionCompleted, onActivePlanCreated }: ResetMapV2Props) {
  // currentSession: 다음에 해야 할 세션 번호 (1-indexed)
  const currentSession = Math.min(completed + 1, total, sessions.length)

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  // localActivePlan: prop에서 시작, createSession 성공 시 갱신
  const [localActivePlan, setLocalActivePlan] = useState<SessionPlan | null>(activePlan)
  const [planLoading, setPlanLoading] = useState(false)
  const createCalledRef = useRef(false)

  // prop 변경(세션 완료 후 null 리셋 등) 반영
  useEffect(() => {
    setLocalActivePlan(activePlan)
    // activePlan이 리셋되면 다음 패널 오픈 시 재호출 허용
    if (activePlan === null) createCalledRef.current = false
  }, [activePlan])

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

  // current 세션 패널 오픈 + activePlan 없음 → createSession 호출
  useEffect(() => {
    if (selectedStatus !== 'current') return
    if (selectedSessionId === null) return
    if (localActivePlan !== null) return
    if (createCalledRef.current) return

    createCalledRef.current = true
    let cancelled = false
    setPlanLoading(true)

    getSessionSafe().then(async ({ session }) => {
      if (cancelled || !session?.access_token) {
        if (!cancelled) setPlanLoading(false)
        return
      }
      const result = await createSession(session.access_token, {
        condition_mood: 'ok',
        time_budget: 'normal',
      })
      if (cancelled) return
      setPlanLoading(false)
      if (result.ok && 'active' in result.data && result.data.active) {
        const plan = result.data.active as SessionPlan
        setLocalActivePlan(plan)
        onActivePlanCreated?.(plan)
      }
    })

    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, localActivePlan, onActivePlanCreated])

  // plan_json에서 운동 추출
  const exercises = useMemo(() => {
    if (selectedSessionId === null) return undefined
    if (selectedStatus !== 'current') return []
    // 로딩 중: undefined(로딩 스피너)
    if (planLoading && localActivePlan === null) return undefined
    if (localActivePlan?.session_number === selectedSessionId) {
      return extractSessionExercises(localActivePlan.plan_json)
    }
    return []
  }, [selectedSessionId, selectedStatus, localActivePlan, planLoading])

  // 패널 open 시 exercises의 templateIds 배치 prefetch
  useEffect(() => {
    if (!exercises?.length) return
    const ids = [...new Set(exercises.map(e => e.templateId).filter(Boolean))]
    if (ids.length === 0) return
    let cancelled = false
    getSessionSafe().then(({ session }) => {
      if (cancelled || !session?.access_token) return
      prefetchMediaSign(ids, session.access_token)
    })
    return () => { cancelled = true }
  }, [exercises])

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
        activePlan={localActivePlan}
        onClose={handleClose}
        onSessionCompleted={onSessionCompleted}
      />
    </div>
  )
}
