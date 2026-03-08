'use client'

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { JourneyMapV2 } from './JourneyMapV2'
import { SessionPanelV2 } from './SessionPanelV2'
import { sessions, type SessionNode } from './map-data'
import { extractSessionExercises } from './planJsonAdapter'
import { createSession, getSessionPlanSummary, type SessionPlan, type ActivePlanSummary } from '@/lib/session/client'
import { getSessionSafe } from '@/lib/supabase'
import { prefetchMediaSign } from './media-cache'

interface ResetMapV2Props {
  /** 전체 세션 수 (max 20) */
  total: number
  /** 완료된 세션 수 */
  completed: number
  /** HomePageClient에서 내려받은 active plan (lite: session_number,status만 / full: plan_json 포함) */
  activePlan: SessionPlan | ActivePlanSummary | null
  /** daily cap: 오늘 세션 완료 여부 */
  todayCompleted?: boolean
  /** daily cap: 다음 세션 해제 시각 (ISO string) */
  nextUnlockAt?: string | null
  /** 세션 완료 후 HomePageClient의 sessionProgress 갱신용 콜백 */
  onSessionCompleted?: (completedSessions: number) => void
  /** createSession 성공 시 HomePageClient의 activePlan 갱신용 콜백 */
  onActivePlanCreated?: (plan: SessionPlan) => void
}

export function ResetMapV2({ total, completed, activePlan, todayCompleted, nextUnlockAt, onSessionCompleted, onActivePlanCreated }: ResetMapV2Props) {
  // localDailyCapActive: createSession이 DAILY_LIMIT_REACHED 반환 시 클라이언트 측 즉시 반영 (방어)
  const [localDailyCapActive, setLocalDailyCapActive] = useState(false)
  // daily cap: today_completed || localDailyCapActive, activePlan 없을 때 → 현재 세션 없음, 다음 세션 locked
  const isLockedNext = !!((todayCompleted || localDailyCapActive) && !activePlan)
  const nextSessionNum = Math.min(completed + 1, total, sessions.length)
  const effectiveCurrentSession = isLockedNext ? null : nextSessionNum

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  // localActivePlan: prop에서 시작, createSession 성공 또는 plan-summary fetch 시 갱신
  const [localActivePlan, setLocalActivePlan] = useState<SessionPlan | ActivePlanSummary | null>(activePlan)
  const [pastSessionPlan, setPastSessionPlan] = useState<SessionPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const createCalledRef = useRef(false)

  // prop 변경(세션 완료 후 null 리셋 등) 반영
  useEffect(() => {
    setLocalActivePlan(activePlan)
    // activePlan이 리셋되면 다음 패널 오픈 시 재호출 허용
    if (activePlan === null) createCalledRef.current = false
  }, [activePlan])

  // 서버에서 todayCompleted=false로 갱신되면 localDailyCapActive도 리셋
  useEffect(() => {
    if (!todayCompleted) setLocalDailyCapActive(false)
  }, [todayCompleted])

  // 선택한 세션의 상태 (effectiveCurrentSession: null이면 다음 세션도 locked)
  const selectedStatus = useMemo(() => {
    if (selectedSessionId === null) return 'locked' as const
    if (effectiveCurrentSession === null) {
      if (selectedSessionId <= completed) return 'completed' as const
      return 'locked' as const
    }
    if (selectedSessionId < effectiveCurrentSession) return 'completed' as const
    if (selectedSessionId === effectiveCurrentSession) return 'current' as const
    return 'locked' as const
  }, [selectedSessionId, effectiveCurrentSession, completed])

  // 과거 세션 클릭 시 plan-summary 조회 (패널 첫 렌더용 경량)
  useEffect(() => {
    if (selectedStatus !== 'completed' || selectedSessionId === null) {
      setPastSessionPlan(null)
      return
    }
    let cancelled = false
    setPastSessionPlan(null)
    setPlanLoading(true)
    getSessionSafe().then(async ({ session }) => {
      if (cancelled || !session?.access_token) {
        if (!cancelled) setPlanLoading(false)
        return
      }
      const result = await getSessionPlanSummary(session.access_token, selectedSessionId)
      if (cancelled) return
      setPlanLoading(false)
      if (result.ok && result.data) {
        setPastSessionPlan({
          session_number: result.data.session_number,
          status: result.data.status as 'draft' | 'started' | 'completed',
          theme: '',
          plan_json: { segments: result.data.segments } as SessionPlan['plan_json'],
          condition: { condition_mood: 'ok', time_budget: 'normal' },
          created_at: '',
          started_at: null,
        })
      }
    })
    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId])

  const handleNodeTap = useCallback((session: SessionNode) => {
    setSelectedSessionId(session.id)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedSessionId(null)
  }, [])

  // current 세션 패널 오픈 + lite만 있음(plan_json 없음) → plan-summary로 경량 fetch (패널 첫 렌더)
  useLayoutEffect(() => {
    if (selectedStatus !== 'current' || selectedSessionId === null) return
    const plan = localActivePlan
    if (plan == null) return
    if ('plan_json' in plan && plan.plan_json) return // 이미 full/segments plan
    if (plan.session_number !== selectedSessionId) return

    let cancelled = false
    setPlanLoading(true)
    getSessionSafe().then(async ({ session }) => {
      if (cancelled || !session?.access_token) {
        if (!cancelled) setPlanLoading(false)
        return
      }
      const result = await getSessionPlanSummary(session.access_token, selectedSessionId)
      if (cancelled) return
      setPlanLoading(false)
      if (result.ok && result.data) {
        setLocalActivePlan({
          session_number: result.data.session_number,
          status: result.data.status as 'draft' | 'started' | 'completed',
          theme: '',
          plan_json: { segments: result.data.segments } as SessionPlan['plan_json'],
          condition: { condition_mood: 'ok', time_budget: 'normal' },
          created_at: '',
          started_at: null,
        })
      }
    })
    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, localActivePlan])

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
        summary: true,
      })
      if (cancelled) return
      setPlanLoading(false)
      if (!result.ok) {
        // 하루 1세션 cap 초과 시 로컬 상태 즉시 반영 → locked 패널 표시
        if (result.error.code === 'DAILY_LIMIT_REACHED') {
          setLocalDailyCapActive(true)
          createCalledRef.current = false
        }
        return
      }
      if ('active' in result.data && result.data.active) {
        const plan = result.data.active as SessionPlan
        setLocalActivePlan(plan)
        onActivePlanCreated?.(plan)
      }
    })

    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, localActivePlan, onActivePlanCreated])

  // plan_json에서 운동 추출 (current: createSession 또는 plan-summary, completed: plan-summary)
  const exercises = useMemo(() => {
    if (selectedSessionId === null) return undefined
    if (selectedStatus === 'current') {
      if (planLoading && !localActivePlan) return undefined
      if (localActivePlan?.session_number === selectedSessionId && 'plan_json' in localActivePlan && localActivePlan.plan_json) {
        return extractSessionExercises(localActivePlan.plan_json)
      }
      if (localActivePlan?.session_number === selectedSessionId && !('plan_json' in localActivePlan)) return undefined // lite, fetch 중
      return []
    }
    if (selectedStatus === 'completed') {
      if (planLoading && pastSessionPlan === null) return undefined
      if (pastSessionPlan?.session_number === selectedSessionId) {
        return extractSessionExercises(pastSessionPlan.plan_json)
      }
      return []
    }
    return []
  }, [selectedSessionId, selectedStatus, localActivePlan, pastSessionPlan, planLoading])

  // 미디어 prefetch — critical path 밖. 운동 목록 렌더 후, paint 완료·idle 시점에 실행.
  useEffect(() => {
    if (!exercises?.length) return
    const ids = [...new Set(exercises.map(e => e.templateId).filter(Boolean))]
    if (ids.length === 0) return
    let cancelled = false
    const runPrefetch = () => {
      if (cancelled) return
      getSessionSafe().then(({ session }) => {
        if (cancelled || !session?.access_token) return
        prefetchMediaSign(ids, session.access_token)
      })
    }
    // 2 RAF: content paint 완료 후, requestIdleCallback으로 main thread idle 시 prefetch
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return
      requestAnimationFrame(() => {
        if (cancelled) return
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(runPrefetch, { timeout: 1500 })
        } else {
          setTimeout(runPrefetch, 300)
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
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
          <p className="text-lg font-bold text-slate-800">
            {effectiveCurrentSession ?? '—'}
          </p>
        </div>
      </div>

      {/* 지도 영역 */}
      <JourneyMapV2
        total={total}
        completed={completed}
        currentSession={effectiveCurrentSession}
        onNodeTap={handleNodeTap}
      />

      {/* 하단 패널 — plan_json 운동 목록 + 세션 종료 */}
      <SessionPanelV2
        sessionId={selectedSessionId}
        total={total}
        status={selectedStatus}
        exercises={exercises}
        activePlan={selectedStatus === 'current' ? localActivePlan : pastSessionPlan}
        isLockedNext={selectedStatus === 'locked' && isLockedNext && selectedSessionId === nextSessionNum}
        nextUnlockAt={nextUnlockAt ?? undefined}
        onClose={handleClose}
        onSessionCompleted={onSessionCompleted}
      />
    </div>
  )
}
