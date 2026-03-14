type PreviewSegment = {
  items?: Array<{
    name?: string | null
  }>
}

type PlanJsonLike = {
  meta?: {
    session_focus_axes?: string[]
    session_rationale?: string | null
  }
  segments?: PreviewSegment[]
} | null | undefined

type BootstrapSummaryLike = {
  focus_axes: string[]
  estimated_duration: number
  segments: PreviewSegment[]
} | null | undefined

export type NextSessionPreviewPayload = {
  session_number: number
  focus_axes: string[]
  estimated_time: number
  exercise_count: number
  session_rationale: string | null
  exercises_preview: string[]
}

export type NextSessionPreviewData = NextSessionPreviewPayload & {
  focus_label?: string | null
}

const FOCUS_AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정',
  lower_mobility: '하체 가동성',
  upper_mobility: '상체 가동성',
  trunk_control: '몸통 제어',
  asymmetry: '좌우 균형',
  deconditioned: '전신 회복',
}

export function buildNextSessionPreviewRationale(focusAxes: string[]): string | null {
  const labels = focusAxes.map((axis) => FOCUS_AXIS_LABELS[axis] ?? axis).filter(Boolean)
  if (labels.length === 0) return null
  if (labels.length === 1) return `${labels[0]} 중심으로 다음 흐름을 이어가는 세션입니다`
  return `${labels[0]}과 ${labels[1]} 중심으로 다음 흐름을 이어가는 세션입니다`
}

export function countPreviewExercises(segments?: PreviewSegment[] | null): number {
  if (!Array.isArray(segments)) return 0
  return segments.reduce(
    (sum, segment) => sum + (Array.isArray(segment.items) ? segment.items.length : 0),
    0
  )
}

export function pickPreviewExerciseNames(
  segments?: PreviewSegment[] | null,
  maxCount = 3
): string[] {
  if (!Array.isArray(segments) || maxCount <= 0) return []
  const names: string[] = []
  for (const segment of segments) {
    for (const item of segment.items ?? []) {
      if (typeof item.name !== 'string' || item.name.trim().length === 0) continue
      names.push(item.name.trim())
      if (names.length >= maxCount) return names
    }
  }
  return names
}

export function buildNextSessionPreviewPayload(input: {
  sessionNumber: number
  focusAxes?: string[] | null
  estimatedTime?: number | null
  sessionRationale?: string | null
  segments?: PreviewSegment[] | null
}): NextSessionPreviewPayload {
  const focusAxes = Array.isArray(input.focusAxes) ? input.focusAxes : []
  const estimatedTime =
    typeof input.estimatedTime === 'number' && Number.isFinite(input.estimatedTime) && input.estimatedTime > 0
      ? Math.round(input.estimatedTime)
      : 0
  return {
    session_number: input.sessionNumber,
    focus_axes: focusAxes,
    estimated_time: estimatedTime,
    exercise_count: countPreviewExercises(input.segments),
    session_rationale: input.sessionRationale ?? buildNextSessionPreviewRationale(focusAxes),
    exercises_preview: pickPreviewExerciseNames(input.segments),
  }
}

export function buildNextSessionPreviewFromPlanJson(input: {
  sessionNumber: number
  planJson: PlanJsonLike
  estimatedTime?: number | null
}): NextSessionPreviewPayload {
  return buildNextSessionPreviewPayload({
    sessionNumber: input.sessionNumber,
    focusAxes: Array.isArray(input.planJson?.meta?.session_focus_axes)
      ? input.planJson.meta.session_focus_axes
      : [],
    estimatedTime: input.estimatedTime,
    sessionRationale:
      typeof input.planJson?.meta?.session_rationale === 'string'
        ? input.planJson.meta.session_rationale
        : null,
    segments: Array.isArray(input.planJson?.segments) ? input.planJson.segments : [],
  })
}

export function buildNextSessionPreviewFromBootstrapSummary(input: {
  sessionNumber: number
  summary: BootstrapSummaryLike
}): NextSessionPreviewPayload | null {
  if (!input.summary) return null
  return buildNextSessionPreviewPayload({
    sessionNumber: input.sessionNumber,
    focusAxes: input.summary.focus_axes,
    estimatedTime: Math.max(1, Math.round(input.summary.estimated_duration / 60)),
    segments: input.summary.segments,
  })
}

export function resolveBootstrapNextSessionPreview(input: {
  activeSessionPlan?: { session_number: number; planJson: PlanJsonLike; estimatedTime?: number | null } | null
  completedSessions: number
  totalSessions: number
  todayCompleted?: boolean
  bootstrapSummary?: BootstrapSummaryLike
}): NextSessionPreviewPayload | null {
  const nextSessionNumber = input.completedSessions + 1
  if (nextSessionNumber > input.totalSessions) return null

  const activeSessionNumber = input.activeSessionPlan?.session_number ?? null
  const shouldUseActivePreview =
    activeSessionNumber != null &&
    input.todayCompleted !== true &&
    activeSessionNumber > input.completedSessions &&
    activeSessionNumber === nextSessionNumber

  if (shouldUseActivePreview && input.activeSessionPlan) {
    return buildNextSessionPreviewFromPlanJson({
      sessionNumber: activeSessionNumber,
      planJson: input.activeSessionPlan.planJson,
      estimatedTime: input.activeSessionPlan.estimatedTime,
    })
  }

  return buildNextSessionPreviewFromBootstrapSummary({
    sessionNumber: nextSessionNumber,
    summary: input.bootstrapSummary,
  })
}

export function buildFallbackNextSessionPreview(input: {
  sessionNumber: number
  focusLabel?: string | null
  estimatedTime?: number
}): NextSessionPreviewData {
  return {
    session_number: input.sessionNumber,
    focus_axes: [],
    focus_label: input.focusLabel ?? null,
    estimated_time: input.estimatedTime ?? 12,
    exercise_count: 0,
    session_rationale: null,
    exercises_preview: [],
  }
}

export function resolvePostCompletionNextSessionPreview(input: {
  completedSessions: number
  total: number
  nextTheme?: string | null
  nextSession?: NextSessionPreviewPayload | null
}): NextSessionPreviewData {
  const nextNum = Math.min(input.completedSessions + 1, input.total)
  if (input.nextSession && input.nextSession.session_number === nextNum) {
    return input.nextSession
  }
  return buildFallbackNextSessionPreview({
    sessionNumber: nextNum,
    focusLabel: input.nextTheme,
  })
}

export function resolveLockedNextSessionPreview(input: {
  sessionId: number | null
  status: 'current' | 'completed' | 'locked'
  isLockedNext?: boolean
  nextSession?: NextSessionPreviewPayload | null
}): NextSessionPreviewPayload | null {
  if (input.status !== 'locked' || !input.isLockedNext || input.sessionId == null) return null
  if (!input.nextSession || input.nextSession.session_number !== input.sessionId) return null
  return input.nextSession
}
