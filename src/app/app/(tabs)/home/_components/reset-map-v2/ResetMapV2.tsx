'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { JourneyMapV2 } from './JourneyMapV2'
import { SessionPanelV2 } from './SessionPanelV2'
import { sessions, type SessionNode } from './map-data'
import { extractSessionExercises } from './planJsonAdapter'
import {
  bootstrapSession,
  createSession,
  getSessionPlanSummary,
  type SessionBootstrapResponse,
  type SessionPlan,
  type ActivePlanSummary,
  type ExerciseLogItem,
  type PlanSummaryResponse,
} from '@/lib/session/client'
import {
  submitResetMapPreview,
  applyResetMapFlow,
} from '@/lib/reset-map/client'
import { getIdempotencyKey, clearApplyKey } from '@/lib/reset-map/clientIdempotency'
import {
  buildNextSessionPreviewRationale,
  buildNextSessionPreviewFromPlanJson,
  type NextSessionPreviewPayload,
} from '@/lib/session/next-session-preview'
import { getSessionSafe } from '@/lib/supabase'
import { prefetchMediaSign } from './media-cache'
import { clearSessionDraftForSession } from '@/lib/session/draftStorage'

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
  /** HomePageClient에서 공유하는 auth 토큰 resolver */
  getAuthToken?: () => Promise<string | null>
  /** 세션 완료 후 HomePageClient의 sessionProgress 갱신용 콜백 */
  onSessionCompleted?: (completedSessions: number) => void
  /** createSession 성공 시 HomePageClient의 activePlan 갱신용 콜백 */
  onActivePlanCreated?: (plan: SessionPlan) => void
  /** PR-SESSION-EXPERIENCE-01: 다음 세션 보기 요청 시 */
  onRequestNextSession?: (nextSessionNumber: number) => void
  /** PR-UX-14: URL focusSession으로 패널 열기 */
  initialSelectedSessionId?: number | null
  /** PR-ALG-15: adaptive explanation from bootstrap */
  adaptiveExplanation?: { title: string; message: string } | null
  /** PR-RISK-02: next session preview from bootstrap (post-completion 카드용) */
  nextSession?: NextSessionPreviewPayload | null
  /** PR-RESET-05: reset-map flow id for preview/apply wiring */
  resetMapFlowId?: string | null
  /** PR-RESET-05: called after successful apply */
  onFlowApplied?: () => void
  /** debug: true → createSession 응답에 timings 포함 (cold path 측정용) */
  debug?: boolean
}

type PanelPlanSummaryResponse = PlanSummaryResponse;
type PanelBootstrapResponse = SessionBootstrapResponse;

/** PR-18: summary → panel-compatible plan (display only). Full plan_json 아님. */
function summaryToPanelPlan(data: PanelPlanSummaryResponse): SessionPlan {
  const meta: Record<string, unknown> = {};
  if (data.rationale) {
    if (data.rationale.focus) meta.focus = data.rationale.focus;
    if (data.rationale.priority_vector) meta.priority_vector = data.rationale.priority_vector;
    if (data.rationale.pain_mode) meta.pain_mode = data.rationale.pain_mode;
    if (data.rationale.session_rationale != null) meta.session_rationale = data.rationale.session_rationale;
    if (Array.isArray(data.rationale.session_focus_axes)) meta.session_focus_axes = data.rationale.session_focus_axes;
  }
  if (data.adaptation_summary) meta.adaptation_summary = data.adaptation_summary;

  return {
    session_number: data.session_number,
    status: data.status as 'draft' | 'started' | 'completed',
    theme: '',
    plan_json: {
      ...(Object.keys(meta).length > 0 && { meta }),
      segments: data.segments,
    } as SessionPlan['plan_json'],
    condition: { condition_mood: 'ok', time_budget: 'normal' },
    created_at: '',
    started_at: null,
  }
}

/** HOTFIX: plan_item_key 우선 key, templateId fallback (backward compat). templateId 중복 시 overwrite 방지. */
function toExerciseLogMap(logs?: ExerciseLogItem[]): Record<string, ExerciseLogItem> {
  if (!logs?.length) return {}
  const map: Record<string, ExerciseLogItem> = {}
  for (const log of logs) {
    map[log.plan_item_key ?? log.templateId] = log
  }
  return map
}

/** PR-18: bootstrap → panel-compatible plan (display only). Full plan_json 아님. */
function bootstrapToPanelPlan(data: PanelBootstrapResponse): SessionPlan {
  const flagMap = new Set(data.constraint_flags)
  return {
    session_number: data.session_number,
    status: 'draft',
    theme: data.theme,
    plan_json: {
      version: 'session_bootstrap_v1',
      meta: {
        session_number: data.session_number,
        phase: data.phase,
        result_type: 'BOOTSTRAP',
        confidence: 'mid',
        focus: [],
        avoid: [],
        scoring_version: 'session_bootstrap_v1',
        session_focus_axes: data.focus_axes,
        session_rationale: buildNextSessionPreviewRationale(data.focus_axes),
        constraint_flags: {
          avoid_filter_applied: flagMap.has('avoid_filter_applied'),
          duplicate_filtered_count: flagMap.has('duplicate_filtered') ? 1 : 0,
          focus_diversity_enforced: false,
          fallback_used: false,
          short_mode_applied: false,
          recovery_mode_applied: false,
          priority_applied: flagMap.has('priority_applied'),
          pain_gate_applied: flagMap.has('pain_gate_applied'),
          first_session_guardrail_applied: flagMap.has('first_session_guardrail_applied'),
        },
      },
      flags: { recovery: false, short: false },
      segments: data.segments,
    },
    condition: { condition_mood: 'ok', time_budget: 'normal' },
    created_at: '',
    started_at: null,
  }
}

export function ResetMapV2({ total, completed, activePlan, todayCompleted, nextUnlockAt, getAuthToken, onSessionCompleted, onActivePlanCreated, onFlowApplied, resetMapFlowId, onRequestNextSession, initialSelectedSessionId, adaptiveExplanation, nextSession, debug }: ResetMapV2Props) {
  // localDailyCapActive: createSession이 DAILY_LIMIT_REACHED 반환 시 클라이언트 측 즉시 반영 (방어)
  const [localDailyCapActive, setLocalDailyCapActive] = useState(false)
  // daily cap: today_completed || localDailyCapActive, activePlan 없을 때 → 현재 세션 없음, 다음 세션 locked
  const isLockedNext = !!((todayCompleted || localDailyCapActive) && !activePlan)
  const nextSessionNum = Math.min(completed + 1, total, sessions.length)
  const effectiveCurrentSession = isLockedNext ? null : nextSessionNum

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  // PR-UX-14: URL focusSession → 패널 열기
  useEffect(() => {
    if (initialSelectedSessionId != null && initialSelectedSessionId >= 1 && initialSelectedSessionId <= total) {
      setSelectedSessionId(initialSelectedSessionId)
    }
  }, [initialSelectedSessionId, total])

  const [bootstrapPlan, setBootstrapPlan] = useState<SessionPlan | null>(null)
  const [fullPlan, setFullPlan] = useState<SessionPlan | ActivePlanSummary | null>(activePlan)
  const [pastSessionPlan, setPastSessionPlan] = useState<SessionPlan | null>(null)
  const [pastSessionInitialLogs, setPastSessionInitialLogs] = useState<Record<string, ExerciseLogItem>>({})
  const [currentSessionServerLogs, setCurrentSessionServerLogs] = useState<Record<string, ExerciseLogItem>>({})
  const [planLoading, setPlanLoading] = useState(false)
  const createCalledRef = useRef(false)
  const summaryCacheRef = useRef(new Map<number, PanelPlanSummaryResponse>())
  const summaryRequestRef = useRef(new Map<number, Promise<PanelPlanSummaryResponse | null>>())
  const bootstrapCacheRef = useRef(new Map<number, SessionPlan>())
  const bootstrapRequestRef = useRef(new Map<number, Promise<SessionPlan | null>>())
  const prevActivePlanRef = useRef<SessionPlan | ActivePlanSummary | null>(activePlan)

  /** PR-RISK-08b: Scoped invalidation — only stale sessions (completed + next). */
  const invalidateStaleSessionCaches = useCallback(
    (
      completedSessionNumber: number,
      totalSessions: number,
      displayedSessionId: number | null
    ) => {
      const nextNum = Math.min(completedSessionNumber + 1, totalSessions)
      summaryCacheRef.current.delete(completedSessionNumber)
      summaryRequestRef.current.delete(completedSessionNumber)
      bootstrapCacheRef.current.delete(completedSessionNumber)
      bootstrapRequestRef.current.delete(completedSessionNumber)
      if (nextNum !== completedSessionNumber) {
        summaryCacheRef.current.delete(nextNum)
        summaryRequestRef.current.delete(nextNum)
        bootstrapCacheRef.current.delete(nextNum)
        bootstrapRequestRef.current.delete(nextNum)
      }
      setCurrentSessionServerLogs({})
      if (
        displayedSessionId === completedSessionNumber ||
        displayedSessionId === nextNum
      ) {
        setPastSessionInitialLogs({})
        setPastSessionPlan(null)
      }
    },
    []
  )

  const resolveAuthToken = useCallback(async () => {
    if (getAuthToken) return getAuthToken()
    const { session } = await getSessionSafe()
    return session?.access_token ?? null
  }, [getAuthToken])

  const loadSessionSummary = useCallback(async (sessionNumber: number) => {
    const cached = summaryCacheRef.current.get(sessionNumber)
    if (cached) return cached

    const pending = summaryRequestRef.current.get(sessionNumber)
    if (pending) return pending

    const request = (async () => {
      const token = await resolveAuthToken()
      if (!token) return null
      const result = await getSessionPlanSummary(token, sessionNumber)
      if (!result.ok || !result.data) return null
      const data = result.data as PanelPlanSummaryResponse
      summaryCacheRef.current.set(sessionNumber, data)
      return data
    })()

    summaryRequestRef.current.set(sessionNumber, request)
    try {
      return await request
    } finally {
      summaryRequestRef.current.delete(sessionNumber)
    }
  }, [resolveAuthToken])

  const loadSessionBootstrap = useCallback(async (sessionNumber: number) => {
    const cached = bootstrapCacheRef.current.get(sessionNumber)
    if (cached) return cached

    const pending = bootstrapRequestRef.current.get(sessionNumber)
    if (pending) return pending

    const request = (async () => {
      const token = await resolveAuthToken()
      if (!token) return null
      const result = await bootstrapSession(token, {
        session_number: sessionNumber,
        ...(debug && { debug: true }),
      })
      if (!result.ok || !result.data) return null
      const data = bootstrapToPanelPlan(result.data as PanelBootstrapResponse)
      bootstrapCacheRef.current.set(sessionNumber, data)
      return data
    })()

    bootstrapRequestRef.current.set(sessionNumber, request)
    try {
      return await request
    } finally {
      bootstrapRequestRef.current.delete(sessionNumber)
    }
  }, [resolveAuthToken, debug])

  // prop 변경(세션 완료 후 null 리셋 등) 반영
  // PR-RISK-08b: activePlan non-null→null 시 identity 기반 정밀 invalidation (prefix purge 대체)
  useEffect(() => {
    const prevActivePlan = prevActivePlanRef.current
    setFullPlan(activePlan)
    setCurrentSessionServerLogs({})
    if (prevActivePlan !== null && activePlan === null) {
      createCalledRef.current = false
      setBootstrapPlan(null)
      const completedSessionNum = prevActivePlan.session_number
      invalidateStaleSessionCaches(completedSessionNum, total, selectedSessionId)
      clearSessionDraftForSession(completedSessionNum)
    }
    prevActivePlanRef.current = activePlan
  }, [activePlan, total, selectedSessionId, invalidateStaleSessionCaches])

  // 현재 세션 lite만 있을 때 plan-summary 미리 로드 (패널 첫 클릭 시 체감 개선)
  useEffect(() => {
    const plan = activePlan ?? fullPlan
    if (!plan || effectiveCurrentSession === null) return
    if (plan.session_number !== effectiveCurrentSession) return
    if ('plan_json' in plan && plan.plan_json) return // 이미 full
    if (summaryCacheRef.current.has(plan.session_number)) return

    let cancelled = false
    let raf1 = 0
    let raf2 = 0
    let timeoutId: number | null = null
    let idleId: number | null = null
    const run = async () => {
      if (cancelled) return
      await loadSessionSummary(plan.session_number)
    }
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (typeof requestIdleCallback !== 'undefined') {
          idleId = requestIdleCallback(() => { void run() }, { timeout: 1200 }) as unknown as number
        } else {
          timeoutId = window.setTimeout(() => { void run() }, 250)
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      if (idleId !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [activePlan, fullPlan, effectiveCurrentSession, loadSessionSummary])

  /** PR-PERF-22: Prefetch bootstrap for current session so panel renders immediately on click. */
  useEffect(() => {
    if (effectiveCurrentSession === null) return
    if (fullPlan !== null) return
    if (bootstrapCacheRef.current.has(effectiveCurrentSession)) return

    let cancelled = false
    let raf1 = 0
    let raf2 = 0
    let timeoutId: number | null = null
    let idleId: number | null = null
    const run = async () => {
      if (cancelled) return
      await loadSessionBootstrap(effectiveCurrentSession)
    }
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (typeof requestIdleCallback !== 'undefined') {
          idleId = requestIdleCallback(() => { void run() }, { timeout: 1200 }) as unknown as number
        } else {
          timeoutId = window.setTimeout(() => { void run() }, 250)
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      if (idleId !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [effectiveCurrentSession, fullPlan, loadSessionBootstrap])

  // 과거 세션: 가장 최근 완료 세션 미리 로드 (클릭 시 체감 개선)
  useEffect(() => {
    if (completed < 1) return
    if (summaryCacheRef.current.has(completed)) return

    let cancelled = false
    let raf1 = 0
    let raf2 = 0
    let timeoutId: number | null = null
    let idleId: number | null = null
    const run = async () => {
      if (cancelled) return
      await loadSessionSummary(completed)
    }
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (typeof requestIdleCallback !== 'undefined') {
          idleId = requestIdleCallback(() => { void run() }, { timeout: 1200 }) as unknown as number
        } else {
          timeoutId = window.setTimeout(() => { void run() }, 250)
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      if (idleId !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [completed, loadSessionSummary])

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

  // 과거 세션 클릭 시 plan-summary 조회 (패널 첫 렌더용 경량). prefetch 캐시 있으면 즉시 사용
  useEffect(() => {
    if (selectedStatus !== 'completed' || selectedSessionId === null) {
      setPastSessionPlan(null)
      setPastSessionInitialLogs({})
      return
    }

    const cached = summaryCacheRef.current.get(selectedSessionId)
    if (cached) {
      setPlanLoading(false)
      setPastSessionPlan(summaryToPanelPlan(cached))
      setPastSessionInitialLogs(toExerciseLogMap(cached.exercise_logs))
      return
    }

    let cancelled = false
    setPastSessionPlan(null)
    setPastSessionInitialLogs({})
    setPlanLoading(true)
    void loadSessionSummary(selectedSessionId).then((data) => {
      if (cancelled) return
      setPlanLoading(false)
      if (!data) return
      setPastSessionPlan(summaryToPanelPlan(data))
      setPastSessionInitialLogs(toExerciseLogMap(data.exercise_logs))
    })
    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, loadSessionSummary])

  /** PR-PERF-22: Summary-first panel. Open immediately, use cached bootstrap if available. */
  const handleNodeTap = useCallback((session: SessionNode) => {
    const nextStatus =
      effectiveCurrentSession === null
        ? (session.id <= completed ? 'completed' : 'locked')
        : session.id < effectiveCurrentSession
          ? 'completed'
          : session.id === effectiveCurrentSession
            ? 'current'
            : 'locked'

    const currentPlanReady =
      (fullPlan?.session_number === session.id &&
        'plan_json' in fullPlan &&
        !!fullPlan.plan_json) ||
      bootstrapPlan?.session_number === session.id
    const completedPlanReady =
      pastSessionPlan?.session_number === session.id ||
      summaryCacheRef.current.has(session.id)

    setSelectedSessionId(session.id)

    if (nextStatus === 'current') {
      const cachedBootstrap = bootstrapCacheRef.current.get(session.id)
      if (cachedBootstrap) {
        setBootstrapPlan(cachedBootstrap)
        setPlanLoading(false)
        return
      }
    }

    const shouldShowLoading =
      (nextStatus === 'current' && !currentPlanReady) ||
      (nextStatus === 'completed' && !completedPlanReady)
    setPlanLoading(shouldShowLoading)
  }, [effectiveCurrentSession, completed, fullPlan, bootstrapPlan, pastSessionPlan])

  const handleClose = useCallback(() => {
    setSelectedSessionId(null)
  }, [])

  // current 세션 패널 오픈 + lite만 있음(plan_json 없음) → plan-summary로 경량 fetch (패널 첫 렌더)
  useEffect(() => {
    if (selectedStatus !== 'current' || selectedSessionId === null) {
      setCurrentSessionServerLogs({})
      return
    }
    const plan = fullPlan
    if (plan == null) return
    if ('plan_json' in plan && plan.plan_json) return // 이미 full/segments plan
    if (plan.session_number !== selectedSessionId) return

    const cached = summaryCacheRef.current.get(selectedSessionId)
    if (cached) {
      setPlanLoading(false)
      setFullPlan(summaryToPanelPlan(cached))
      setCurrentSessionServerLogs(toExerciseLogMap(cached.exercise_logs))
      return
    }

    let cancelled = false
    setPlanLoading(true)
    void loadSessionSummary(selectedSessionId).then((data) => {
      if (cancelled) return
      setPlanLoading(false)
      if (!data) return
      setFullPlan(summaryToPanelPlan(data))
      setCurrentSessionServerLogs(toExerciseLogMap(data.exercise_logs))
    })
    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, fullPlan, loadSessionSummary])

  // PR-EXEC-02: current 세션 선택 시 plan-summary 로드 (exercise_logs용, fullPlan이 이미 있어도)
  useEffect(() => {
    if (selectedStatus !== 'current' || selectedSessionId === null) return
    const cached = summaryCacheRef.current.get(selectedSessionId)
    if (cached) {
      setCurrentSessionServerLogs(toExerciseLogMap(cached.exercise_logs))
      return
    }
    let cancelled = false
    void loadSessionSummary(selectedSessionId).then((data) => {
      if (cancelled || !data) return
      setCurrentSessionServerLogs(toExerciseLogMap(data.exercise_logs))
    })
    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, loadSessionSummary])

  // PR-RESET-05/08: current 세션 패널 오픈 시 preview gate. PR-RESET-08: apply only when proceed.
  const previewSubmittedRef = useRef<string | null>(null)
  const previewProceedRef = useRef<{ flowId: string; proceed: boolean } | null>(null)
  const pendingApplyRef = useRef<boolean>(false)

  useEffect(() => {
    if (selectedStatus !== 'current' || selectedSessionId === null || !resetMapFlowId) return
    if (previewSubmittedRef.current === resetMapFlowId) return

    let cancelled = false
    previewSubmittedRef.current = resetMapFlowId
    previewProceedRef.current = null
    resolveAuthToken().then(async (token) => {
      if (cancelled || !token) return
      const res = await submitResetMapPreview(token, resetMapFlowId, {
        permission_state: 'granted',
        tracking_conf: 0.5,
        landmark_coverage: 0.6,
      })
      if (cancelled) return
      previewProceedRef.current = { flowId: resetMapFlowId, proceed: res.ok && res.data?.proceed === true }
      if (pendingApplyRef.current && previewProceedRef.current.proceed && onFlowApplied) {
        const applyKey = getIdempotencyKey('apply')
        const applyRes = await applyResetMapFlow(token, resetMapFlowId, applyKey)
        if (applyRes.ok) {
          clearApplyKey()
          onFlowApplied()
        }
        pendingApplyRef.current = false
      }
    })
    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, resetMapFlowId, resolveAuthToken, onFlowApplied])

  // current 세션 패널 오픈 + activePlan 없음 → bootstrap summary 먼저 로드
  useEffect(() => {
    if (selectedStatus !== 'current' || selectedSessionId === null) return
    if (fullPlan !== null) return
    if (bootstrapPlan?.session_number === selectedSessionId) {
      setPlanLoading(false)
      return
    }

    let cancelled = false
    setPlanLoading(true)
    void loadSessionBootstrap(selectedSessionId).then((plan) => {
      if (cancelled) return
      if (plan) {
        setBootstrapPlan(plan)
        setPlanLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, fullPlan, bootstrapPlan, loadSessionBootstrap])

  /** PR-PERF-22: createSession runs in background. Panel renders bootstrap immediately. */
  useEffect(() => {
    if (selectedStatus !== 'current') return
    if (selectedSessionId === null) return
    if (fullPlan !== null) return
    if (createCalledRef.current) return

    createCalledRef.current = true
    let cancelled = false

    resolveAuthToken().then(async (token) => {
      if (cancelled || !token) {
        if (!cancelled) setPlanLoading(false)
        return
      }
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('createSession-start')
      }
      const result = await createSession(token, {
        condition_mood: 'ok',
        time_budget: 'normal',
        summary: true,
        ...(debug && { debug: true }),
      })
      if (cancelled) return
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('createSession-end')
      }
      if (!result.ok) {
        // 하루 1세션 cap 초과 시 로컬 상태 즉시 반영 → locked 패널 표시
        if (result.error.code === 'DAILY_LIMIT_REACHED') {
          setLocalDailyCapActive(true)
          createCalledRef.current = false
        }
        if (!bootstrapPlan) setPlanLoading(false)
        return
      }
      if ('active' in result.data && result.data.active) {
        const plan = result.data.active as SessionPlan
        setFullPlan(plan)
        setBootstrapPlan((prev) => (prev?.session_number === plan.session_number ? null : prev))
        setPlanLoading(false)
        onActivePlanCreated?.(plan)
        if (resetMapFlowId && onFlowApplied) {
          if (previewProceedRef.current?.flowId === resetMapFlowId && previewProceedRef.current.proceed) {
            const applyKey = getIdempotencyKey('apply')
            const applyRes = await applyResetMapFlow(token, resetMapFlowId, applyKey)
            if (applyRes.ok) {
              clearApplyKey()
              onFlowApplied()
            }
          } else {
            pendingApplyRef.current = true
          }
        }
      }
    })

    return () => { cancelled = true }
  }, [selectedStatus, selectedSessionId, fullPlan, bootstrapPlan, onActivePlanCreated, onFlowApplied, resetMapFlowId, resolveAuthToken, debug])

  /** PR-NEXT-04: locked-next 패널 fallback fetch — loadSessionBootstrap 재사용 */
  const onFetchLockedPreview = useCallback(
    async (sessionNumber: number): Promise<NextSessionPreviewPayload | null> => {
      const plan = await loadSessionBootstrap(sessionNumber)
      if (!plan?.plan_json) return null
      const segs = Array.isArray(plan.plan_json.segments) ? plan.plan_json.segments : []
      const totalSec = segs.reduce((s, seg) => s + (seg.duration_sec ?? 0), 0)
      const estimatedTime = totalSec > 0 ? Math.max(1, Math.round(totalSec / 60)) : undefined
      return buildNextSessionPreviewFromPlanJson({
        sessionNumber: plan.session_number,
        planJson: plan.plan_json,
        estimatedTime,
      })
    },
    [loadSessionBootstrap]
  )

  const currentRenderablePlan = useMemo(() => {
    if (selectedStatus !== 'current' || selectedSessionId === null) return null
    if (
      fullPlan?.session_number === selectedSessionId &&
      'plan_json' in fullPlan &&
      fullPlan.plan_json
    ) {
      return fullPlan
    }
    if (bootstrapPlan?.session_number === selectedSessionId) return bootstrapPlan
    return null
  }, [selectedStatus, selectedSessionId, fullPlan, bootstrapPlan])

  // plan_json에서 운동 추출 (current: createSession 또는 plan-summary, completed: plan-summary)
  const exercises = useMemo(() => {
    if (selectedSessionId === null) return undefined
    if (selectedStatus === 'current') {
      if (planLoading && !currentRenderablePlan && !fullPlan) return undefined
      if (currentRenderablePlan?.session_number === selectedSessionId) {
        return extractSessionExercises(currentRenderablePlan.plan_json)
      }
      if (fullPlan?.session_number === selectedSessionId && !('plan_json' in fullPlan)) return undefined
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
  }, [selectedSessionId, selectedStatus, currentRenderablePlan, fullPlan, pastSessionPlan, planLoading])

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
        completedSessions={completed}
        status={selectedStatus}
        exercises={exercises}
        activePlan={selectedStatus === 'current' ? (currentRenderablePlan ?? fullPlan) : pastSessionPlan}
        initialLogs={selectedStatus === 'completed' ? pastSessionInitialLogs : selectedStatus === 'current' ? currentSessionServerLogs : undefined}
        isLockedNext={selectedStatus === 'locked' && isLockedNext && selectedSessionId === nextSessionNum}
        nextUnlockAt={nextUnlockAt ?? undefined}
        onClose={handleClose}
        onSessionCompleted={onSessionCompleted}
        onRequestNextSession={onRequestNextSession ?? ((next) => setSelectedSessionId(next))}
        adaptiveExplanation={adaptiveExplanation}
        nextSession={nextSession}
        onFetchLockedPreview={onFetchLockedPreview}
      />
    </div>
  )
}
