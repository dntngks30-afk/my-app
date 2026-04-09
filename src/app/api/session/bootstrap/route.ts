import { NextRequest } from 'next/server'
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId'
import { getServerSupabaseAdmin } from '@/lib/supabase'
import { ok, fail, ApiErrorCode } from '@/lib/api/contract'
import { fetchActiveLiteData } from '@/lib/session/active-lite-data'
import { buildSessionBootstrapSummary } from '@/lib/session/bootstrap-summary'
import { resolveSessionAnalysisInput } from '@/lib/session/resolveSessionAnalysisInput'
import {
  computePhase,
  resolvePhaseLengths,
  isAdaptivePhasePolicy,
  resolvePhasePolicyReason,
  type PhaseLengths,
  type PhasePolicyOptions,
} from '@/lib/session/phase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type BootstrapRouteData = {
  session_number: number
  phase: number
  theme: string
  segments: Array<{
    title: string
    items: Array<{
      templateId: string
      name: string
      sets?: number
      reps?: number
      hold_seconds?: number
      order: number
    }>
  }>
  estimated_duration: number
  focus_axes: string[]
  constraint_flags: string[]
}

const DEFAULT_TOTAL_SESSIONS = 16
const PHASE_LABELS = ['1순위 타겟', '2순위 타겟', '통합', '릴렉스'] as const

export function shouldAllowTodayCompletedBootstrapPreview(input: {
  todayCompleted: boolean
  requestedSessionNumber: number | null
  nextSessionNumber: number
}): boolean {
  if (!input.todayCompleted) return false
  if (input.requestedSessionNumber == null) return false
  return input.requestedSessionNumber === input.nextSessionNumber
}

function getPhaseLengthsFromTrace(trace: unknown): PhaseLengths | null {
  if (!trace || typeof trace !== 'object') return null
  const arr = (trace as Record<string, unknown>).phase_lengths
  if (!Array.isArray(arr) || arr.length !== 4) return null
  const nums = arr.map((value) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null
  )
  if (nums.some((value) => value === null)) return null
  return nums as PhaseLengths
}

function buildTheme(
  sessionNumber: number,
  totalSessions: number,
  deep: { result_type: string; focus: string[] },
  options?: { phaseLengths?: PhaseLengths | null; policyOptions?: PhasePolicyOptions | null }
): string {
  const phaseIdx = computePhase(totalSessions, sessionNumber, options) - 1
  const phaseLabel = PHASE_LABELS[phaseIdx]

  if (phaseIdx === 0) {
    const target = deep.focus[0] ?? deep.result_type
    return `Phase 1 · ${target} 안정화`
  }
  if (phaseIdx === 1) {
    const target = deep.focus[1] ?? deep.focus[0] ?? deep.result_type
    return `Phase 2 · ${target} 심화`
  }
  return `Phase ${phaseIdx + 1} · ${phaseLabel}`
}

function extractConstraintFlags(planJson: unknown): string[] {
  const flags = (planJson as { meta?: { constraint_flags?: Record<string, unknown> } } | null)?.meta?.constraint_flags
  if (!flags || typeof flags !== 'object') return []
  return Object.entries(flags)
    .filter(([, value]) => value === true || (typeof value === 'number' && value > 0))
    .map(([key]) => key)
}

function estimateDurationFromPlan(planJson: unknown): number {
  const segments = (planJson as { segments?: Array<{ duration_sec?: number; items?: unknown[] }> } | null)?.segments
  if (!Array.isArray(segments)) return 0
  return segments.reduce((sum, segment) => {
    if (typeof segment.duration_sec === 'number' && Number.isFinite(segment.duration_sec)) {
      return sum + segment.duration_sec
    }
    return sum + (Array.isArray(segment.items) ? segment.items.length * 300 : 0)
  }, 0)
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다')
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const requestedSessionNumber =
      typeof body.session_number === 'number' && Number.isInteger(body.session_number)
        ? body.session_number
        : null

    const supabase = getServerSupabaseAdmin()
    const activeLite = await fetchActiveLiteData(supabase, userId)
    if (!activeLite.ok) {
      return fail(
        activeLite.status,
        (activeLite.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        activeLite.message
      )
    }

    const { progress, active, today_completed } = activeLite.data
    const totalSessions = progress.total_sessions ?? DEFAULT_TOTAL_SESSIONS

    if (active?.session_number) {
      if (requestedSessionNumber != null && requestedSessionNumber !== active.session_number) {
        return fail(400, ApiErrorCode.VALIDATION_FAILED, '요청한 session_number가 현재 active 세션과 다릅니다')
      }

      const { data: row, error } = await supabase
        .from('session_plans')
        .select('session_number, theme, plan_json')
        .eq('user_id', userId)
        .eq('session_number', active.session_number)
        .maybeSingle()

      if (error || !row) {
        return fail(404, ApiErrorCode.SESSION_PLAN_NOT_FOUND, '현재 세션 플랜을 찾을 수 없습니다')
      }

      const planJson = row.plan_json as {
        meta?: { phase?: number; session_focus_axes?: string[] }
        segments?: BootstrapRouteData['segments']
      } | null
      const phase =
        typeof planJson?.meta?.phase === 'number'
          ? planJson.meta.phase
          : computePhase(totalSessions, row.session_number)

      return ok<BootstrapRouteData>({
        session_number: row.session_number,
        phase,
        theme: row.theme ?? '',
        segments: Array.isArray(planJson?.segments) ? planJson.segments : [],
        estimated_duration: estimateDurationFromPlan(planJson),
        focus_axes: Array.isArray(planJson?.meta?.session_focus_axes) ? planJson.meta.session_focus_axes : [],
        constraint_flags: extractConstraintFlags(planJson),
      })
    }

    const nextSessionNumber = (progress.completed_sessions ?? 0) + 1
    if (requestedSessionNumber != null && requestedSessionNumber !== nextSessionNumber) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, '요청한 session_number가 현재 생성 가능한 세션과 다릅니다')
    }
    if (nextSessionNumber > totalSessions) {
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, '모든 세션을 완료했습니다')
    }
    if (
      today_completed &&
      !shouldAllowTodayCompletedBootstrapPreview({
        todayCompleted: today_completed,
        requestedSessionNumber,
        nextSessionNumber,
      })
    ) {
      return fail(409, ApiErrorCode.DAILY_LIMIT_REACHED, '오늘은 이미 완료했습니다')
    }

    const resolvedAnalysisInput = await resolveSessionAnalysisInput(userId)
    if (!resolvedAnalysisInput) {
      return fail(404, ApiErrorCode.DEEP_RESULT_MISSING, '심층 결과가 없습니다')
    }
    const deepSummary = resolvedAnalysisInput.summary

    const policyOptions: PhasePolicyOptions = {
      deepLevel: deepSummary.deep_level ?? null,
      safetyMode: deepSummary.safety_mode ?? null,
      redFlags: deepSummary.red_flags ?? null,
    }

    let phaseLengths: PhaseLengths | null = null
    if (nextSessionNumber > 1) {
      const { data: prevPlan } = await supabase
        .from('session_plans')
        .select('generation_trace_json')
        .eq('user_id', userId)
        .eq('session_number', nextSessionNumber - 1)
        .maybeSingle()
      phaseLengths = getPhaseLengthsFromTrace(prevPlan?.generation_trace_json)
    }
    if (!phaseLengths) {
      phaseLengths = resolvePhaseLengths(totalSessions, policyOptions)
    }

    const phase = computePhase(totalSessions, nextSessionNumber, { phaseLengths })
    const theme = buildTheme(nextSessionNumber, totalSessions, deepSummary, {
      phaseLengths,
      policyOptions,
    })

    const summary = await buildSessionBootstrapSummary({
      sessionNumber: nextSessionNumber,
      deepSummary,
    })

    const constraint_flags = [
      ...summary.constraint_flags,
      ...(isAdaptivePhasePolicy(policyOptions)
        ? [`phase_policy_${resolvePhasePolicyReason(policyOptions)}`]
        : []),
    ]

    return ok<BootstrapRouteData>({
      session_number: nextSessionNumber,
      phase,
      theme,
      segments: summary.segments,
      estimated_duration: summary.estimated_duration,
      focus_axes: summary.focus_axes,
      constraint_flags,
    })
  } catch (err) {
    console.error('[session/bootstrap]', err)
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류')
  }
}
