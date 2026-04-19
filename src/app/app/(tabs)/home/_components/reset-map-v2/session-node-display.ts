/**
 * PR2 — Map node display: source hierarchy + arc placeholders only.
 * Pure helpers; no adaptive/scoring/generation semantics.
 */

import type { PlanSummaryResponse, SessionNodeDisplayHydrationItem } from '@/lib/session/client'
import {
  resolveSessionDisplayContract,
  buildSessionDisplaySeedFromMeta,
} from '@/lib/session/session-display-contract'
import type { NextSessionPreviewPayload } from '@/lib/session/next-session-preview'
import { isUsableNextSessionPreview } from '@/lib/session/next-session-preview'
import {
  buildSessionDisplayCopy,
  mapLinesFromSessionDisplayCopy,
  sessionCopyInputFromNodeDisplay,
} from '@/lib/session/session-display-copy'
import type { SessionNode } from './map-data'

export type SessionNodeDisplayState = 'confirmed' | 'preview' | 'placeholder'

export type SessionNodeDisplaySource =
  | 'active_plan'
  | 'summary'
  | 'hydrated_history'
  | 'bootstrap'
  | 'next_preview'
  | 'arc_template'
  | 'legacy_map_data'

export type SessionNodeDisplay = {
  sessionNumber: number
  state: SessionNodeDisplayState
  roleCode: string
  roleLabel: string
  goalCode: string
  goalLabel: string
  /** Map secondary line — goal hint preferred */
  subtitle: string
  source: SessionNodeDisplaySource
  confidence: 'high' | 'medium' | 'low'
}

const GOAL = {
  FULL_BODY_PRIME: { code: 'FULL_BODY_PRIME', label: '전신 준비', hint: '전신 준비' },
  CORE_STABILITY: { code: 'CORE_STABILITY', label: '코어 안정성', hint: '코어 안정성' },
  LOWER_MOBILITY: { code: 'LOWER_MOBILITY', label: '하체 가동성', hint: '하체 가동성' },
  ASYMMETRY_BALANCE: { code: 'ASYMMETRY_BALANCE', label: '좌우 균형', hint: '좌우 균형' },
  RECOVERY_RELIEF: { code: 'RECOVERY_RELIEF', label: '부담 완화 회복', hint: '부담 완화 회복' },
} as const

const ROLE = {
  ADAPT: { code: 'ADAPT', label: '적응' },
  STABILIZE: { code: 'STABILIZE', label: '안정' },
  MOBILIZE: { code: 'MOBILIZE', label: '확장' },
  BALANCE: { code: 'BALANCE', label: '균형' },
  INTEGRATE: { code: 'INTEGRATE', label: '통합' },
  RECOVER: { code: 'RECOVER', label: '회복' },
} as const

function pickSubtitle(contract: {
  session_goal_hint?: string
  session_goal_label?: string
}): string {
  const h = contract.session_goal_hint?.trim()
  if (h) return h
  const l = contract.session_goal_label?.trim()
  return l ?? ''
}

function contractToDisplay(
  sessionNumber: number,
  c: ReturnType<typeof resolveSessionDisplayContract>,
  state: SessionNodeDisplayState,
  source: SessionNodeDisplaySource,
  confidence: SessionNodeDisplay['confidence']
): SessionNodeDisplay {
  const roleCode = c.session_role_code?.trim() ?? 'ADAPT'
  const roleLabel = c.session_role_label?.trim() ?? '적응'
  const goalCode = c.session_goal_code?.trim() ?? 'FULL_BODY_PRIME'
  const goalLabel = c.session_goal_label?.trim() ?? '전신 준비'
  const subtitle = pickSubtitle(c) || goalLabel
  return {
    sessionNumber,
    state,
    roleCode,
    roleLabel,
    goalCode,
    goalLabel,
    subtitle,
    source,
    confidence,
  }
}

/** Far-future arc — bounded vocabulary only (SSOT bands, 20 sessions). */
export function arcPlaceholderDisplay(sessionNumber: number): SessionNodeDisplay {
  const n = sessionNumber

  if (n <= 3) {
    return {
      sessionNumber: n,
      state: 'placeholder',
      roleCode: ROLE.ADAPT.code,
      roleLabel: ROLE.ADAPT.label,
      goalCode: GOAL.FULL_BODY_PRIME.code,
      goalLabel: GOAL.FULL_BODY_PRIME.label,
      subtitle: GOAL.FULL_BODY_PRIME.hint,
      source: 'arc_template',
      confidence: 'low',
    }
  }
  if (n <= 7) {
    return {
      sessionNumber: n,
      state: 'placeholder',
      roleCode: ROLE.STABILIZE.code,
      roleLabel: ROLE.STABILIZE.label,
      goalCode: GOAL.CORE_STABILITY.code,
      goalLabel: GOAL.CORE_STABILITY.label,
      subtitle: GOAL.CORE_STABILITY.hint,
      source: 'arc_template',
      confidence: 'low',
    }
  }
  if (n <= 11) {
    return {
      sessionNumber: n,
      state: 'placeholder',
      roleCode: ROLE.MOBILIZE.code,
      roleLabel: ROLE.MOBILIZE.label,
      goalCode: GOAL.LOWER_MOBILITY.code,
      goalLabel: GOAL.LOWER_MOBILITY.label,
      subtitle: GOAL.LOWER_MOBILITY.hint,
      source: 'arc_template',
      confidence: 'low',
    }
  }
  if (n <= 15) {
    return {
      sessionNumber: n,
      state: 'placeholder',
      roleCode: ROLE.BALANCE.code,
      roleLabel: ROLE.BALANCE.label,
      goalCode: GOAL.ASYMMETRY_BALANCE.code,
      goalLabel: GOAL.ASYMMETRY_BALANCE.label,
      subtitle: GOAL.ASYMMETRY_BALANCE.hint,
      source: 'arc_template',
      confidence: 'low',
    }
  }
  if (n <= 18) {
    return {
      sessionNumber: n,
      state: 'placeholder',
      roleCode: ROLE.INTEGRATE.code,
      roleLabel: ROLE.INTEGRATE.label,
      goalCode: GOAL.FULL_BODY_PRIME.code,
      goalLabel: GOAL.FULL_BODY_PRIME.label,
      subtitle: GOAL.FULL_BODY_PRIME.hint,
      source: 'arc_template',
      confidence: 'low',
    }
  }
  return {
    sessionNumber: n,
    state: 'placeholder',
    roleCode: ROLE.RECOVER.code,
    roleLabel: ROLE.RECOVER.label,
    goalCode: GOAL.RECOVERY_RELIEF.code,
    goalLabel: GOAL.RECOVERY_RELIEF.label,
    subtitle: GOAL.RECOVERY_RELIEF.hint,
    source: 'arc_template',
    confidence: 'low',
  }
}

function legacyFallback(sessionNumber: number, node: SessionNode | undefined): SessionNodeDisplay {
  return {
    sessionNumber,
    state: 'placeholder',
    roleCode: 'LEGACY',
    roleLabel: node?.label ?? `세션 ${sessionNumber}`,
    goalCode: 'LEGACY',
    goalLabel: node?.description ?? '',
    subtitle: node?.description ?? '',
    source: 'legacy_map_data',
    confidence: 'low',
  }
}

/** Batch hydration item → plan_json.meta-shaped object for resolveSessionDisplayContract. */
export function hydrationItemToResolverMeta(item: SessionNodeDisplayHydrationItem): Record<string, unknown> {
  const m: Record<string, unknown> = {}
  if (typeof item.session_number === 'number' && Number.isFinite(item.session_number)) {
    m.session_number = Math.floor(item.session_number)
  }
  if (item.session_role_code) m.session_role_code = item.session_role_code
  if (item.session_role_label) m.session_role_label = item.session_role_label
  if (item.session_goal_code) m.session_goal_code = item.session_goal_code
  if (item.session_goal_label) m.session_goal_label = item.session_goal_label
  if (item.session_goal_hint) m.session_goal_hint = item.session_goal_hint
  if (item.session_rationale !== undefined) m.session_rationale = item.session_rationale
  if (Array.isArray(item.session_focus_axes) && item.session_focus_axes.length > 0) {
    m.session_focus_axes = item.session_focus_axes
  }
  if (item.priority_vector && typeof item.priority_vector === 'object') {
    m.priority_vector = item.priority_vector
  }
  if (item.pain_mode) m.pain_mode = item.pain_mode
  if (Array.isArray(item.focus) && item.focus.length > 0) m.focus = item.focus
  if (typeof item.primary_type === 'string' && item.primary_type.trim()) {
    m.primary_type = item.primary_type.trim()
  }
  if (typeof item.result_type === 'string' && item.result_type.trim()) {
    m.result_type = item.result_type.trim()
  }
  if (typeof item.phase === 'number' && Number.isFinite(item.phase)) {
    m.phase = Math.floor(item.phase)
  }
  if (item.constraint_flags && typeof item.constraint_flags === 'object') {
    m.constraint_flags = item.constraint_flags
  }
  return m
}

function rationaleToContractMeta(
  r: NonNullable<PlanSummaryResponse['rationale']>
): Record<string, unknown> {
  return {
    ...r,
    session_focus_axes: r.session_focus_axes,
    session_rationale: r.session_rationale,
    focus: r.focus,
    priority_vector: r.priority_vector,
    pain_mode: r.pain_mode,
  }
}

function displayFromNextPreviewPayload(sessionNumber: number, payload: NextSessionPreviewPayload): SessionNodeDisplay {
  const c = buildSessionDisplaySeedFromMeta({
    session_focus_axes: payload.focus_axes,
    phase: Math.max(1, Math.min(4, sessionNumber)),
    pain_mode: 'none',
  })
  const full = resolveSessionDisplayContract({
    ...c,
    session_role_code: c.session_role_code,
    session_role_label: c.session_role_label,
    session_goal_code: c.session_goal_code,
    session_goal_label: c.session_goal_label,
    session_goal_hint: c.session_goal_hint,
  } as Record<string, unknown>)
  return contractToDisplay(sessionNumber, full, 'preview', 'next_preview', 'medium')
}

export type ResolveSessionNodeDisplaysArgs = {
  total: number
  completed: number
  /** null = daily cap / no current session */
  effectiveCurrentSession: number | null
  /** plan_json.meta for the one active full plan (current session) */
  activeFullMeta: { sessionNumber: number; meta: Record<string, unknown> } | null
  summaryBySession: Map<number, PlanSummaryResponse>
  /** PR-LEGACY-HYDRATION: batch read-time display, weaker than loaded summary */
  hydrationMetaBySession: Map<number, Record<string, unknown>>
  bootstrapMetaBySession: Map<number, Record<string, unknown>>
  nextPreview: NextSessionPreviewPayload | null
  /** min(completed+1, total) */
  nextSessionNumber: number
  visibleNodes: SessionNode[]
}

/**
 * Source hierarchy (SSOT):
 * 1. active full plan meta (current session)
 * 2. plan-summary rationale/meta
 * 3. batch hydrated display (read-time; summary보다 약하거나 동급, active는 덮지 않음)
 * 4. bootstrap meta
 * 5. usable next-session preview (applies to next node only)
 * 6a. completed history → legacy map-data copy
 * 6b. far-future nodes → arc_template
 * 6c. next node without preview → legacy before arc
 * Lower tiers never override higher tiers.
 */
export function resolveSessionNodeDisplays(args: ResolveSessionNodeDisplaysArgs): Record<number, SessionNodeDisplay> {
  const {
    total,
    completed,
    effectiveCurrentSession,
    activeFullMeta,
    summaryBySession,
    hydrationMetaBySession,
    bootstrapMetaBySession,
    nextPreview,
    nextSessionNumber,
    visibleNodes,
  } = args

  const safeTotal = Math.max(1, Math.min(20, total ?? 20))
  const byId = new Map(visibleNodes.filter((s) => s.id <= safeTotal).map((s) => [s.id, s]))
  const out: Record<number, SessionNodeDisplay> = {}

  for (let n = 1; n <= safeTotal; n++) {
    const legacyNode = byId.get(n)
    const isPastDone = n <= completed
    const isCurrent = effectiveCurrentSession !== null && n === effectiveCurrentSession
    const isNextNode = n === nextSessionNumber
    const isFarFuture = n > nextSessionNumber

    // 1) Active full plan (current session only)
    if (activeFullMeta && activeFullMeta.sessionNumber === n) {
      const c = resolveSessionDisplayContract(activeFullMeta.meta)
      out[n] = contractToDisplay(n, c, 'confirmed', 'active_plan', 'high')
      continue
    }

    // 2) Summary (completed + current + any prefetched)
    const summary = summaryBySession.get(n)
    if (summary?.rationale) {
      const c = resolveSessionDisplayContract({
        ...rationaleToContractMeta(summary.rationale),
        session_number: n,
      })
      out[n] = contractToDisplay(n, c, 'confirmed', 'summary', 'high')
      continue
    }

    const hyd = hydrationMetaBySession.get(n)
    if (hyd && Object.keys(hyd).length > 0) {
      const c = resolveSessionDisplayContract(hyd)
      out[n] = contractToDisplay(n, c, 'confirmed', 'hydrated_history', 'medium')
      continue
    }

    // Past completed sessions: map-data legacy until summary/hydration (no arc for history)
    if (isPastDone && !isCurrent) {
      out[n] = legacyFallback(n, legacyNode)
      continue
    }

    // Bootstrap preview
    const bMeta = bootstrapMetaBySession.get(n)
    if (bMeta) {
      const c = resolveSessionDisplayContract(bMeta)
      out[n] = contractToDisplay(n, c, 'preview', 'bootstrap', 'medium')
      continue
    }

    // 4) Next-session preview prop
    if (nextPreview && isNextNode && isUsableNextSessionPreview(nextPreview, n)) {
      out[n] = displayFromNextPreviewPayload(n, nextPreview)
      continue
    }

    // Next node (not current): journey copy before arc
    if (isNextNode && !isCurrent) {
      out[n] = legacyFallback(n, legacyNode)
      continue
    }

    // Far future: arc, then legacy safety
    if (isFarFuture) {
      out[n] = arcPlaceholderDisplay(n)
      continue
    }

    // Current session without meta yet (no summary / bootstrap): legacy so map stays stable
    if (isCurrent) {
      out[n] = legacyFallback(n, legacyNode)
      continue
    }

    out[n] = legacyFallback(n, legacyNode)
  }

  return out
}

export function getMapLines(
  display: SessionNodeDisplay | undefined,
  fallbackNode: SessionNode
): { largeLabel: string; subtitle: string | null } {
  if (!display) {
    return { largeLabel: fallbackNode.label, subtitle: fallbackNode.description?.trim() ? fallbackNode.description : null }
  }
  if (display.source === 'legacy_map_data') {
    const sub = display.subtitle?.trim()
    return { largeLabel: display.roleLabel, subtitle: sub || null }
  }
  const copy = buildSessionDisplayCopy(sessionCopyInputFromNodeDisplay(display))
  return mapLinesFromSessionDisplayCopy(copy)
}
