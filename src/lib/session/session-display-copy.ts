/**
 * PR3 — Shared map + panel display copy (wording only). No source hierarchy here.
 * Uses PR1 resolveSessionDisplayContract for contract-first truth; bounded fallback via buildBriefSessionRationale.
 */

import { buildBriefSessionRationale } from '@/lib/deep-result/copy'
import { resolveSessionDisplayContract } from '@/lib/session/session-display-contract'

/** Input shape: plan_json.meta family (+ optional adaptation_summary). */
export type SessionDisplayCopyInput = {
  session_role_code?: string
  session_role_label?: string
  session_goal_code?: string
  session_goal_label?: string
  session_goal_hint?: string
  session_rationale?: string | null
  session_focus_axes?: string[]
  priority_vector?: Record<string, number>
  pain_mode?: 'none' | 'caution' | 'protected'
  focus?: string[]
  adaptation_summary?: string
  /** Session plan meta may include phase for PR1 seed alignment */
  phase?: number
}

export type SessionDisplayCopy = {
  roleCode: string
  roleLabel: string
  goalCode: string
  goalLabel: string
  /** Map secondary line — goal hint / label */
  subtitle: string
  /** Panel: bold goal-facing title (goalLabel-first) */
  panelTitle: string
  panelHeadline: string
  panelDetail?: string
  panelChips: string[]
}

const FOCUS_AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정',
  lower_mobility: '하체 가동성',
  upper_mobility: '상체 가동성',
  trunk_control: '몸통 제어',
  asymmetry: '좌우 균형',
  deconditioned: '전신 회복',
}

function pickSubtitle(contract: {
  session_goal_hint?: string
  session_goal_label?: string
}): string {
  const h = contract.session_goal_hint?.trim()
  if (h) return h
  const l = contract.session_goal_label?.trim()
  return l ?? ''
}

function firstLine(text: string, maxLen: number): string {
  const line = text.trim().split(/\r?\n/)[0] ?? ''
  if (line.length <= maxLen) return line
  return `${line.slice(0, maxLen).trim()}…`
}

/**
 * Single ownership for role/goal/subtitle + panel copy. Contract fields win via resolveSessionDisplayContract.
 */
export function buildSessionDisplayCopy(meta: SessionDisplayCopyInput): SessionDisplayCopy {
  const record = { ...meta } as Record<string, unknown>
  const contract = resolveSessionDisplayContract(record)

  const roleCode = contract.session_role_code?.trim() ?? 'ADAPT'
  const roleLabel = contract.session_role_label?.trim() ?? '적응'
  const goalCode = contract.session_goal_code?.trim() ?? 'FULL_BODY_PRIME'
  const goalLabel = contract.session_goal_label?.trim() ?? '전신 준비'
  const subtitle = pickSubtitle(contract) || goalLabel

  const brief = buildBriefSessionRationale(meta.priority_vector, meta.pain_mode, meta.focus)
  const hasSessionRationale =
    typeof meta.session_rationale === 'string' && meta.session_rationale.trim().length > 0

  const panelTitle = (contract.session_goal_label?.trim() || contract.session_goal_hint?.trim() || goalLabel).trim()

  let panelHeadline: string
  let panelDetail: string | undefined

  if (hasSessionRationale) {
    panelHeadline = firstLine(meta.session_rationale!, 220)
    panelDetail = brief?.detail
  } else {
    panelHeadline = brief?.headline ?? '이번 세션 방향을 요약한 흐름이에요.'
    panelDetail = brief?.detail
  }

  const panelChips = (meta.session_focus_axes ?? []).map((a) => FOCUS_AXIS_LABELS[a] ?? a)

  return {
    roleCode,
    roleLabel,
    goalCode,
    goalLabel,
    subtitle,
    panelTitle,
    panelHeadline,
    panelDetail,
    panelChips,
  }
}

/** Map surface: same copy layer as panel (large label = role, subtitle = goal line). */
export function mapLinesFromSessionDisplayCopy(copy: SessionDisplayCopy): {
  largeLabel: string
  subtitle: string | null
} {
  const sub = copy.subtitle.trim()
  return {
    largeLabel: copy.roleLabel,
    subtitle: sub ? sub : null,
  }
}

/** Bridge PR2 node resolver output → same contract/copy pipeline as plan meta. */
export function sessionCopyInputFromNodeDisplay(input: {
  roleCode: string
  roleLabel: string
  goalCode: string
  goalLabel: string
  subtitle: string
}): SessionDisplayCopyInput {
  return {
    session_role_code: input.roleCode === 'LEGACY' ? undefined : input.roleCode,
    session_role_label: input.roleLabel,
    session_goal_code: input.goalCode === 'LEGACY' ? undefined : input.goalCode,
    session_goal_label: input.goalLabel,
    session_goal_hint: input.subtitle,
  }
}
