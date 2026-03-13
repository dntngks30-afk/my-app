import type { SessionDeepSummary } from '@/lib/deep-result/session-deep-summary'
import { buildExcludeSet, hasContraindicationOverlap } from '@/lib/session/safety'
import {
  getPainModeExtraAvoid,
  getPainModePenalty,
  resolveSessionPriorities,
  scoreByPriority,
} from '@/lib/session/priority-layer'
import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db'

type GoldPathVector =
  | 'lower_stability'
  | 'lower_mobility'
  | 'trunk_control'
  | 'upper_mobility'
  | 'deconditioned'

type SegmentKind = 'prep' | 'main' | 'accessory' | 'cooldown'

export type SessionBootstrapSummaryItem = {
  templateId: string
  name: string
  sets?: number
  reps?: number
  hold_seconds?: number
  order: number
}

export type SessionBootstrapSummarySegment = {
  title: string
  items: SessionBootstrapSummaryItem[]
}

export type SessionBootstrapSummary = {
  segments: SessionBootstrapSummarySegment[]
  estimated_duration: number
  focus_axes: string[]
  constraint_flags: string[]
}

export type SessionBootstrapSummaryInput = {
  sessionNumber: number
  deepSummary: SessionDeepSummary
}

const PREP_TAGS = new Set([
  'full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility',
  'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility',
  'ankle_mobility', 'core_control',
])
const MAIN_TAGS = new Set([
  'core_stability', 'global_core', 'upper_back_activation', 'shoulder_stability',
  'glute_activation', 'lower_chain_stability', 'glute_medius', 'basic_balance',
])
const MAIN_EXCLUSIVE_FROM_RELEASE = new Set([
  'lower_chain_stability', 'glute_medius', 'glute_activation', 'core_stability',
  'global_core', 'shoulder_stability', 'upper_back_activation',
])
const RELEASE_TAGS = new Set([
  'full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility',
  'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility',
])

const PRIMARY_FOCUS_BONUS = 3
const SECONDARY_FOCUS_BONUS = 2
const PRIORITY_MATCH_BONUS = 2
const LEVEL_MATCH_BONUS = 1
const MAX_FIRST_SESSION_MAIN_COUNT = 1
const MAX_FIRST_SESSION_TOTAL_EXERCISES = 5

type GoldPathSegmentRule = {
  title: 'Prep' | 'Main' | 'Accessory' | 'Cooldown'
  kind: SegmentKind
  preferredPhases: string[]
  preferredVectors: GoldPathVector[]
  fallbackVectors: GoldPathVector[]
  preferredProgression: number[]
  count: number
}

const GOLD_PATH_RULES: Record<GoldPathVector, Omit<GoldPathSegmentRule, 'count'>[]> = {
  lower_stability: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['trunk_control'], fallbackVectors: ['lower_mobility', 'deconditioned'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['lower_stability'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['lower_stability'], fallbackVectors: ['trunk_control', 'lower_mobility'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['lower_mobility'], fallbackVectors: ['deconditioned', 'trunk_control'], preferredProgression: [1] },
  ],
  lower_mobility: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep', 'accessory'], preferredVectors: ['lower_mobility'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['lower_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [2, 1, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['lower_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['lower_mobility'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
  ],
  trunk_control: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['trunk_control', 'deconditioned'], fallbackVectors: ['upper_mobility'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['trunk_control'], fallbackVectors: ['lower_stability'], preferredProgression: [1, 2, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['trunk_control'], fallbackVectors: ['lower_stability', 'upper_mobility'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['deconditioned', 'trunk_control'], fallbackVectors: ['upper_mobility'], preferredProgression: [1] },
  ],
  upper_mobility: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['upper_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['upper_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [2, 1, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['upper_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['upper_mobility'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
  ],
  deconditioned: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['deconditioned'], fallbackVectors: ['trunk_control'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['deconditioned', 'trunk_control'], fallbackVectors: ['lower_mobility', 'upper_mobility'], preferredProgression: [1, 2] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'prep'], preferredVectors: ['lower_mobility', 'upper_mobility'], fallbackVectors: ['deconditioned', 'trunk_control'], preferredProgression: [1] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['prep', 'accessory'], preferredVectors: ['deconditioned'], fallbackVectors: ['lower_mobility', 'upper_mobility'], preferredProgression: [1] },
  ],
}

function isPrepEligible(t: SessionTemplateRow): boolean {
  return t.focus_tags.some((tag) => PREP_TAGS.has(tag))
}

function isMainEligible(t: SessionTemplateRow): boolean {
  return t.focus_tags.some((tag) => MAIN_TAGS.has(tag))
}

function isReleaseEligible(t: SessionTemplateRow): boolean {
  const hasReleaseTag = t.focus_tags.some((tag) => RELEASE_TAGS.has(tag))
  const hasMainExclusive = t.focus_tags.some((tag) => MAIN_EXCLUSIVE_FROM_RELEASE.has(tag))
  return hasReleaseTag && !hasMainExclusive
}

function hasTargetVector(
  template: SessionTemplateRow,
  vectors: readonly GoldPathVector[]
): boolean {
  return !!template.target_vector?.some((vector) => vectors.includes(vector as GoldPathVector))
}

function getDifficultyRank(difficulty: string | null | undefined): number {
  if (difficulty === 'low') return 1
  if (difficulty === 'medium') return 2
  if (difficulty === 'high') return 3
  return 0
}

function resolveFocusAxes(priorityVector?: Record<string, number> | null): string[] {
  if (!priorityVector || typeof priorityVector !== 'object') return []
  return Object.entries(priorityVector)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([axis]) => axis)
}

function resolveGoldPathVector(input: SessionBootstrapSummaryInput): GoldPathVector | null {
  const ranked = Object.entries(input.deepSummary.priority_vector ?? {})
    .filter((entry): entry is [GoldPathVector, number] =>
      ['lower_stability', 'lower_mobility', 'trunk_control', 'upper_mobility', 'deconditioned'].includes(entry[0]) &&
      typeof entry[1] === 'number' &&
      entry[1] > 0
    )
    .sort((a, b) => b[1] - a[1])

  if (ranked.length > 0) return ranked[0][0]

  switch (input.deepSummary.primary_type) {
    case 'LOWER_INSTABILITY':
      return 'lower_stability'
    case 'LOWER_MOBILITY_RESTRICTION':
      return 'lower_mobility'
    case 'CORE_CONTROL_DEFICIT':
      return 'trunk_control'
    case 'UPPER_IMMOBILITY':
      return 'upper_mobility'
    case 'DECONDITIONED':
      return 'deconditioned'
    default:
      return null
  }
}

function computeTargetLevel(input: SessionBootstrapSummaryInput): { finalTargetLevel: number; maxLevel: number } {
  const base = input.deepSummary.deep_level ?? 2
  const maxLevel =
    input.deepSummary.safety_mode === 'red' ? 1 : input.deepSummary.safety_mode === 'yellow' ? 2 : 3
  return { finalTargetLevel: Math.min(base, maxLevel), maxLevel }
}


function scoreTemplate(
  template: SessionTemplateRow,
  input: SessionBootstrapSummaryInput,
  finalTargetLevel: number,
  excludeSet: Set<string>
): number {
  if (hasContraindicationOverlap(template.contraindications, excludeSet)) return -100

  let score = 0
  const priorityTags = resolveSessionPriorities(input.deepSummary.priority_vector)
  const effectiveFocus = priorityTags && priorityTags.length > 0 ? priorityTags : input.deepSummary.focus
  const primary = effectiveFocus[0]
  const secondary = effectiveFocus[1] ?? effectiveFocus[0]

  if (primary && template.focus_tags.includes(primary)) score += PRIMARY_FOCUS_BONUS
  if (secondary && template.focus_tags.includes(secondary)) score += SECONDARY_FOCUS_BONUS
  if (priorityTags) score += scoreByPriority(template.focus_tags, priorityTags, PRIORITY_MATCH_BONUS)
  score -= getPainModePenalty(template.contraindications, input.deepSummary.pain_mode)
  if (template.level === finalTargetLevel) score += LEVEL_MATCH_BONUS

  return score
}

function scoreGoldPathSegmentFit(
  template: SessionTemplateRow,
  rule: GoldPathSegmentRule,
  painMode?: 'none' | 'caution' | 'protected'
): number {
  let score = 0

  if (template.phase && rule.preferredPhases.includes(template.phase)) score += 8
  else if (rule.kind === 'cooldown' && isReleaseEligible(template)) score += 5
  else if (rule.kind === 'accessory' && template.phase === 'main') score += 2

  if (hasTargetVector(template, rule.preferredVectors)) score += 12
  else if (hasTargetVector(template, rule.fallbackVectors)) score += 6

  const progression = template.progression_level ?? 1
  const progressionIdx = rule.preferredProgression.indexOf(progression)
  if (progressionIdx >= 0) score += Math.max(1, 5 - progressionIdx)

  const difficultyRank = getDifficultyRank(template.difficulty)
  if (rule.kind === 'cooldown') {
    if (difficultyRank <= 1) score += 5
    if (difficultyRank >= 3) score -= 12
    if (!isReleaseEligible(template) && template.phase === 'main') score -= 20
  } else if (rule.kind === 'prep' || rule.kind === 'accessory') {
    if (difficultyRank <= 1) score += 3
    if (difficultyRank >= 3) score -= 8
  }

  if (painMode === 'protected') {
    if (difficultyRank >= 3) score -= 30
    else if (difficultyRank === 2) score -= 8
  } else if (painMode === 'caution') {
    if (difficultyRank >= 3) score -= 16
    else if (difficultyRank === 1) score += 2
  }

  return score
}

function buildGoldPathSegmentRules(vector: GoldPathVector, mainCount: number): GoldPathSegmentRule[] {
  return GOLD_PATH_RULES[vector].map((rule) => ({
    ...rule,
    count: rule.kind === 'main' ? mainCount : 1,
  }))
}

function isConservativeFallbackEligible(template: SessionTemplateRow, kind: SegmentKind): boolean {
  if (kind === 'cooldown') {
    return isReleaseEligible(template) || template.phase === 'prep' || template.phase === 'accessory' || getDifficultyRank(template.difficulty) <= 1
  }
  if (kind === 'prep') {
    return template.phase === 'prep' || getDifficultyRank(template.difficulty) <= 1 || isPrepEligible(template)
  }
  if (kind === 'accessory') {
    return template.phase === 'accessory' || (template.phase === 'prep' && getDifficultyRank(template.difficulty) <= 1)
  }
  return template.phase === 'main' || isMainEligible(template)
}

function selectGoldPathTemplates(
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  input: SessionBootstrapSummaryInput,
  vector: GoldPathVector,
  mainCount: number
): { segments: Array<{ title: string; items: SessionTemplateRow[] }>; duplicateFilteredCount: number } {
  const used = new Set<string>()
  const duplicateSeen = new Set<string>()
  let duplicateFilteredCount = 0
  const mainFocusCount = new Map<string, number>()
  const rules = buildGoldPathSegmentRules(vector, mainCount)

  const segments = rules.map((rule) => {
    const ranked = sorted
      .map(({ template, score }) => ({
        template,
        score: score + scoreGoldPathSegmentFit(template, rule, input.deepSummary.pain_mode),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aProgression = a.template.progression_level ?? 1
        const bProgression = b.template.progression_level ?? 1
        if (aProgression !== bProgression) return aProgression - bProgression
        const aDifficulty = getDifficultyRank(a.template.difficulty)
        const bDifficulty = getDifficultyRank(b.template.difficulty)
        if (aDifficulty !== bDifficulty) return aDifficulty - bDifficulty
        return a.template.id.localeCompare(b.template.id)
      })

    const items: SessionTemplateRow[] = []
    const tryPick = (candidate: SessionTemplateRow) => {
      if (used.has(candidate.id)) {
        if (!duplicateSeen.has(candidate.id)) {
          duplicateSeen.add(candidate.id)
          duplicateFilteredCount++
        }
        return false
      }
      if (rule.kind === 'main') {
        const focusTag = candidate.focus_tags[0] ?? '_none'
        if ((mainFocusCount.get(focusTag) ?? 0) >= 2) return false
        mainFocusCount.set(focusTag, (mainFocusCount.get(focusTag) ?? 0) + 1)
      }
      used.add(candidate.id)
      items.push(candidate)
      return true
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break
      if (!(template.phase && rule.preferredPhases.includes(template.phase))) continue
      if (!hasTargetVector(template, rule.preferredVectors)) continue
      tryPick(template)
    }
    for (const { template } of ranked) {
      if (items.length >= rule.count) break
      if (!(template.phase && rule.preferredPhases.includes(template.phase))) continue
      if (!hasTargetVector(template, rule.fallbackVectors)) continue
      tryPick(template)
    }
    for (const { template } of ranked) {
      if (items.length >= rule.count) break
      if (!hasTargetVector(template, rule.preferredVectors)) continue
      tryPick(template)
    }
    for (const { template } of ranked) {
      if (items.length >= rule.count) break
      if (!isConservativeFallbackEligible(template, rule.kind)) continue
      tryPick(template)
    }

    return { title: rule.title, items }
  })

  return { segments, duplicateFilteredCount }
}

function toBootstrapItem(
  template: SessionTemplateRow,
  order: number,
  segmentTitle: string
): SessionBootstrapSummaryItem {
  if (template.name.includes('이완') || segmentTitle === 'Cooldown') {
    return {
      templateId: template.id,
      name: template.name,
      order,
      sets: 1,
      hold_seconds: 30,
    }
  }
  return {
    templateId: template.id,
    name: template.name,
    order,
    sets: 2,
    reps: 12,
  }
}

function buildConstraintFlags(flags: {
  avoidFilterApplied: boolean
  duplicateFilteredCount: number
  priorityApplied: boolean
  painGateApplied: boolean
  firstSessionGuardrailApplied: boolean
}): string[] {
  const out: string[] = []
  if (flags.avoidFilterApplied) out.push('avoid_filter_applied')
  if (flags.duplicateFilteredCount > 0) out.push('duplicate_filtered')
  if (flags.priorityApplied) out.push('priority_applied')
  if (flags.painGateApplied) out.push('pain_gate_applied')
  if (flags.firstSessionGuardrailApplied) out.push('first_session_guardrail_applied')
  return out
}

export function buildSessionBootstrapSummaryFromTemplates(
  templates: SessionTemplateRow[],
  input: SessionBootstrapSummaryInput
): SessionBootstrapSummary {
  const { finalTargetLevel, maxLevel } = computeTargetLevel(input)
  const painExtraAvoid = getPainModeExtraAvoid(input.deepSummary.pain_mode)
  const excludeSet = buildExcludeSet(input.deepSummary.avoid, painExtraAvoid)
  const isFirstSession = input.sessionNumber === 1

  const candidates = templates.filter(
    (template) =>
      !hasContraindicationOverlap(template.contraindications, excludeSet) &&
      template.level <= maxLevel &&
      !isExcludedByPainMode(template, input.deepSummary.pain_mode) &&
      !isExcludedByFirstSessionGuardrail(template, input.sessionNumber)
  )

  const scored = candidates
    .map((template) => ({
      template,
      score: scoreTemplate(template, input, finalTargetLevel, excludeSet),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)

  /** PR-SESSION-BASELINE-01: main 2~3 baseline. red=1, yellow=2, else 3. first session guardrail 유지 */
  let mainCount = input.deepSummary.safety_mode === 'red' ? 1 : input.deepSummary.safety_mode === 'yellow' ? 2 : 3
  if (isFirstSession && mainCount > MAX_FIRST_SESSION_MAIN_COUNT) {
    mainCount = MAX_FIRST_SESSION_MAIN_COUNT
  }
  if (1 + mainCount + 1 + 1 > MAX_FIRST_SESSION_TOTAL_EXERCISES && isFirstSession) {
    mainCount = Math.max(1, MAX_FIRST_SESSION_TOTAL_EXERCISES - 3)
  }

  const vector = resolveGoldPathVector(input)
  const selection = selectGoldPathTemplates(scored, input, vector ?? 'trunk_control', mainCount)
  const segments = selection.segments
    .filter((segment) => segment.items.length > 0)
    .map((segment) => ({
      title: segment.title,
      items: segment.items.map((template, index) => toBootstrapItem(template, index + 1, segment.title)),
    }))

  return {
    segments,
    estimated_duration: segments.reduce((sum, segment) => sum + segment.items.length * 300, 0),
    focus_axes: resolveFocusAxes(input.deepSummary.priority_vector),
    constraint_flags: buildConstraintFlags({
      avoidFilterApplied: excludeSet.size > 0,
      duplicateFilteredCount: selection.duplicateFilteredCount,
      priorityApplied: !!input.deepSummary.priority_vector,
      painGateApplied: !!input.deepSummary.pain_mode && input.deepSummary.pain_mode !== 'none',
      firstSessionGuardrailApplied: isFirstSession,
    }),
  }
}

export async function buildSessionBootstrapSummary(
  input: SessionBootstrapSummaryInput
): Promise<SessionBootstrapSummary> {
  const { getTemplatesForSessionPlan } = await import('@/lib/workout-routine/exercise-templates-db')
  const templates = await getTemplatesForSessionPlan({
    scoringVersion: input.deepSummary.scoring_version ?? 'deep_v2',
  })
  return buildSessionBootstrapSummaryFromTemplates(templates, input)
}
