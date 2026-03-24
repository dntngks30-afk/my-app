/**
 * Session Plan Generator (BE-06)
 *
 * exercise_templates 기반 plan_json 생성.
 * Safety gate, repetition penalty, phase별 focus 반영.
 */

import { getTemplatesForSessionPlan, type SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { applySelectionExcludesWithTrace } from '@/lib/session/policy-registry';
import type { TemplatePhase } from '@/lib/workout-routine/exercise-templates';
import { computePhase, type Phase } from './phase';
import { buildExcludeSet, hasContraindicationOverlap } from './safety';
import {
  getPainModeExtraAvoid,
  resolveSessionPriorities,
  scoreByPriority,
  getPainModePenalty,
  resolveFirstSessionIntent,
  type FirstSessionIntentSSOT,
} from './priority-layer';
import { generateSessionRationale, getExerciseRationale } from '@/core/session-rationale';
import { applySessionConstraints } from './constraints';
import type { ConstraintEngineMeta } from './constraints';
import { applySessionOrdering } from './ordering';
import type { OrderingEngineMeta } from './ordering';
import { applyCandidateCompetition } from './candidate-competition';
import type { CandidateCompetitionMeta } from './candidate-competition';
import { auditPlanQuality } from './plan-quality-audit';
import type { PlanQualityAuditMeta } from './plan-quality-audit';
import type { SurveySessionHints } from '@/lib/result/deep-result-v2-contract';
import {
  bumpFirstSessionTierForSurveyHints,
  clampTargetLevelForSurveyIntro,
  mergeSurveyHintMaxDifficultyCap,
  surveyHintGoldPathSegmentScoreAdjust,
  surveyHintVolumeDelta,
  surveyHintsDominatedByHardGuardrails,
} from '@/lib/deep-v2/session/survey-session-hints-first-session';

const REPETITION_PENALTY = 100;
const CONTRAINDICATION_PENALTY = 100;
const MAX_LEVEL_CAP = 3;
const PRIMARY_FOCUS_BONUS = 3;
const SECONDARY_FOCUS_BONUS = 2;
/** PR-ALG-03: priority_vector 기반 추가 보너스 */
const PRIORITY_MATCH_BONUS = 2;
const SHORT_DURATION_BONUS = 1;
const LEVEL_MATCH_BONUS = 1;

/** PR-P2-4: constraint hardening */
const MAX_SAME_FOCUS_IN_MAIN = 2;
const GOLD_PATH_VECTORS = ['lower_stability', 'lower_mobility', 'trunk_control', 'upper_mobility', 'deconditioned'] as const;
type GoldPathVector = typeof GOLD_PATH_VECTORS[number];
type SegmentKind = 'prep' | 'main' | 'accessory' | 'cooldown';

/** Phase-safe composition: focus_tags → segment eligibility (no DB change) */
const PREP_TAGS = new Set([
  'full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility',
  'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility',
  'ankle_mobility', 'core_control',
]);
const MAIN_TAGS = new Set([
  'core_stability', 'global_core', 'upper_back_activation', 'shoulder_stability',
  'glute_activation', 'lower_chain_stability', 'glute_medius', 'basic_balance',
]);
/** Main-strength tags: NEVER place in Release/Cooldown */
const MAIN_EXCLUSIVE_FROM_RELEASE = new Set([
  'lower_chain_stability', 'glute_medius', 'glute_activation', 'core_stability',
  'global_core', 'shoulder_stability', 'upper_back_activation',
]);
const RELEASE_TAGS = new Set([
  'full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility',
  'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility',
]);

function isPrepEligible(t: SessionTemplateRow): boolean {
  return t.focus_tags.some((tag) => PREP_TAGS.has(tag));
}
function isMainEligible(t: SessionTemplateRow): boolean {
  return t.focus_tags.some((tag) => MAIN_TAGS.has(tag));
}
function isReleaseEligible(t: SessionTemplateRow): boolean {
  const hasReleaseTag = t.focus_tags.some((tag) => RELEASE_TAGS.has(tag));
  const hasMainExclusive = t.focus_tags.some((tag) => MAIN_EXCLUSIVE_FROM_RELEASE.has(tag));
  return hasReleaseTag && !hasMainExclusive;
}

function hasTemplatePhase(
  template: SessionTemplateRow,
  phases: TemplatePhase[]
): boolean {
  return !!template.phase && phases.includes(template.phase as TemplatePhase);
}

function hasTargetVector(
  template: SessionTemplateRow,
  vectors: readonly GoldPathVector[]
): boolean {
  return !!template.target_vector?.some((vector) => vectors.includes(vector as GoldPathVector));
}

function getDifficultyRank(difficulty: string | null | undefined): number {
  return DIFFICULTY_ORDER[difficulty ?? ''] ?? 0;
}

type GoldPathSegmentRule = {
  title: 'Prep' | 'Main' | 'Accessory' | 'Cooldown';
  kind: SegmentKind;
  preferredPhases: TemplatePhase[];
  preferredVectors: GoldPathVector[];
  fallbackVectors: GoldPathVector[];
  preferredProgression: number[];
  count: number;
};

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
};
const MIN_CANDIDATES_FOR_STRICT_AVOID = 3;
const SHORT_TOTAL_ITEM_CAP = 4;

/** PR-ALG-21: First session guardrails — risk-tiered. */
type FirstSessionTier = 'conservative' | 'moderate' | 'normal';
/** conservative: protected/red or deconditioned top. moderate: caution/yellow. normal: none + general */
function getFirstSessionTier(input: PlanGeneratorInput): FirstSessionTier {
  if (input.sessionNumber !== 1) return 'normal';
  if (input.pain_mode === 'protected' || input.safety_mode === 'red') return 'conservative';
  if (input.pain_mode === 'caution' || input.safety_mode === 'yellow') return 'moderate';
  const pv = input.priority_vector ?? {};
  const decond = pv.deconditioned ?? 0;
  const topAxis = Object.entries(pv)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0];
  if (topAxis === 'deconditioned' && decond > 0) return 'moderate';
  return 'normal';
}
const FIRST_SESSION_LIMITS: Record<FirstSessionTier, { maxMain: number; maxTotal: number }> = {
  conservative: { maxMain: 1, maxTotal: 5 },
  moderate: { maxMain: 2, maxTotal: 5 },
  normal: { maxMain: 2, maxTotal: 6 },
};

/**
 * PR-FIRST-SESSION-QUALITY-02A: 온보딩 beginner → 첫 세션 티어 한 단계 보수적으로 (볼륨·toPlanItem 단일 세트 경향).
 * pain_mode/safety 기반 티어가 우선 계산된 뒤 적용. intermediate/advanced는 변경 없음.
 */
function adjustFirstSessionTierForOnboardingExperience(
  tier: FirstSessionTier,
  input: PlanGeneratorInput
): FirstSessionTier {
  if (input.sessionNumber !== 1) return tier;
  if (input.exercise_experience_level !== 'beginner') return tier;
  if (tier === 'normal') return 'moderate';
  if (tier === 'moderate') return 'conservative';
  return 'conservative';
}

/** PR-ALG-05: difficulty order for cap (low < medium < high) */
const DIFFICULTY_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };

function isDifficultyAboveCap(
  templateDifficulty: string | null | undefined,
  cap: 'low' | 'medium' | 'high'
): boolean {
  if (!templateDifficulty || !(templateDifficulty in DIFFICULTY_ORDER)) return false;
  const tOrder = DIFFICULTY_ORDER[templateDifficulty] ?? 0;
  const capOrder = DIFFICULTY_ORDER[cap] ?? 3;
  return tOrder > capOrder;
}

/** PR-SESSION-QUALITY-01: priority_vector top 1–2 axes for session focus */
function resolveSessionFocusAxes(priorityVector?: Record<string, number> | null): string[] {
  if (!priorityVector || typeof priorityVector !== 'object') return [];
  return Object.entries(priorityVector)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([axis]) => axis);
}

/** PR-ALG-10: Session Rationale Engine 사용. 없으면 fallback */
function resolveSessionRationale(
  priorityVector?: Record<string, number> | null,
  painMode?: 'none' | 'caution' | 'protected' | null
): string | null {
  const result = generateSessionRationale({ priority_vector: priorityVector, pain_mode: painMode });
  if (result.session_focus_axes.length === 0) return null;
  return result.rationale_text;
}

function resolveGoldPathVector(
  input: PlanGeneratorInput,
  firstSessionIntent?: FirstSessionIntentSSOT | null
): GoldPathVector | null {
  if (firstSessionIntent?.goldPath && GOLD_PATH_VECTORS.includes(firstSessionIntent.goldPath as GoldPathVector)) {
    return firstSessionIntent.goldPath as GoldPathVector;
  }

  const ranked = Object.entries(input.priority_vector ?? {})
    .filter((entry): entry is [GoldPathVector, number] =>
      GOLD_PATH_VECTORS.includes(entry[0] as GoldPathVector) && typeof entry[1] === 'number' && entry[1] > 0
    )
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) return ranked[0][0];

  switch (input.primary_type) {
    case 'LOWER_INSTABILITY':
      return 'lower_stability';
    case 'LOWER_MOBILITY_RESTRICTION':
      return 'lower_mobility';
    case 'CORE_CONTROL_DEFICIT':
      return 'trunk_control';
    case 'UPPER_IMMOBILITY':
      return 'upper_mobility';
    case 'DECONDITIONED':
      return 'deconditioned';
    default:
      return null;
  }
}

/** PR-ALG-16B: selection-time excludes delegated to policy-registry.applySelectionExcludes */

export type ConditionMood = 'good' | 'ok' | 'bad';
export type TimeBudget = 'short' | 'normal';

export type PlanGeneratorInput = {
  sessionNumber: number;
  totalSessions: number;
  phase: Phase;
  theme: string;
  timeBudget: TimeBudget;
  conditionMood: ConditionMood;
  focus: string[];
  avoid: string[];
  painFlags: string[];
  usedTemplateIds: string[];
  resultType?: string;
  confidence?: number;
  scoringVersion?: string;
  /** PR-C: deep_level (1~3), 없으면 2. targetLevel base. */
  deep_level?: 1 | 2 | 3;
  pain_risk?: number;
  red_flags?: boolean;
  /** PR-C: safety_mode → maxLevel cap. red=1, yellow=2, none=3 */
  safety_mode?: 'red' | 'yellow' | 'none';
  /** PR-P2-3: adaptive overlay from recent feedback. PR-ALG-05: maxDifficultyCap */
  adaptiveOverlay?: {
    targetLevelDelta?: -1 | 0 | 1;
    forceShort?: boolean;
    forceRecovery?: boolean;
    avoidTemplateIds?: string[];
    /** PR-ALG-05: exclude templates with difficulty above this (metadata) */
    maxDifficultyCap?: 'low' | 'medium' | 'high';
  };
  /** PR-C: modifier from session_adaptive_summaries. Reduces Main segment count. */
  volumeModifier?: number;
  /** PR-ALG-02: deep_v3 additive (optional) */
  primary_type?: string;
  secondary_type?: string | null;
  priority_vector?: Record<string, number>;
  pain_mode?: 'none' | 'caution' | 'protected';
  /** PR-FIRST-SESSION-QUALITY-02A: 온보딩 exercise_experience_level — 세션 1만 반영 */
  exercise_experience_level?: 'beginner' | 'intermediate' | 'advanced';
  /** PR-SURVEY-05: 무료 설문 baseline `_compat` (세션 1에서만 소비) */
  survey_session_hints?: SurveySessionHints;
};

export type PlanItem = {
  order: number;
  templateId: string;
  name: string;
  sets?: number;
  reps?: number;
  hold_seconds?: number;
  focus_tag?: string | null;
  media_ref?: unknown;
  /** PR-ALG-10: 운동 처방 근거 */
  rationale?: string | null;
};

export type PlanSegment = {
  title: string;
  duration_sec: number;
  items: PlanItem[];
};

export type PlanJsonOutput = {
  version: string;
  meta: {
    session_number: number;
    phase: number;
    result_type?: string;
    confidence?: number;
    focus: string[];
    avoid: string[];
    scoring_version: string;
    used_template_ids: string[];
    /** PR-C optional enrichment */
    deep_level?: 1 | 2 | 3;
    pain_risk?: number;
    red_flags?: boolean;
    safety_mode?: 'red' | 'yellow' | 'none';
    finalTargetLevel?: number;
    maxLevel?: number;
    /** PR-ALG-02: deep_v3 additive */
    primary_type?: string;
    secondary_type?: string | null;
    priority_vector?: Record<string, number>;
    pain_mode?: 'none' | 'caution' | 'protected';
    /** PR-SESSION-QUALITY-01: priority_vector top axes for session focus */
    session_focus_axes?: string[];
    /** PR-SESSION-QUALITY-01: rationale for session composition */
    session_rationale?: string | null;
    /** PR-P2-4: constraint trace */
    constraint_flags?: {
      avoid_filter_applied: boolean;
      duplicate_filtered_count: number;
      focus_diversity_enforced: boolean;
      fallback_used: boolean;
      short_mode_applied: boolean;
      recovery_mode_applied: boolean;
      /** PR-ALG-03 */
      priority_applied?: boolean;
      pain_gate_applied?: boolean;
      /** PR-SESSION-QUALITY-01 */
      first_session_guardrail_applied?: boolean;
      /** PR-SURVEY-05: 설문 힌트가 세션 1에 반영됐을 때만 */
      survey_session_hints_applied?: boolean;
      survey_session_hints_trace?: string[];
    };
    /** PR-ALG-16A: additive, explainable constraint engine meta */
    constraint_engine?: ConstraintEngineMeta;
    /** PR-ALG-17: additive, explainable ordering engine meta */
    ordering_engine?: OrderingEngineMeta;
    /** PR-ALG-16B: additive, explainable policy registry selection trace */
    policy_registry?: {
      version: 'session_policy_registry_v1';
      selection_rule_ids: string[];
      excluded_count_by_rule: Record<string, number>;
      taxonomy_mode: 'derived_v1';
    };
    /** PR-ALG-18: additive candidate competition meta */
    candidate_competition?: CandidateCompetitionMeta;
    /** PR-ALG-19: additive plan quality audit meta */
    plan_quality_audit?: PlanQualityAuditMeta;
  };
  flags: { recovery: boolean; short: boolean };
  segments: PlanSegment[];
};

function scoreTemplate(
  t: SessionTemplateRow,
  input: PlanGeneratorInput,
  finalTargetLevel: number,
  excludeSet: Set<string>,
  firstSessionIntent?: FirstSessionIntentSSOT | null
): number {
  if (hasContraindicationOverlap(t.contraindications, excludeSet)) {
    return -CONTRAINDICATION_PENALTY;
  }

  if (input.usedTemplateIds.includes(t.id)) {
    return -REPETITION_PENALTY;
  }

  let score = 0;

  // PR-ALG-03: priority_vector 우선, 없으면 focus fallback
  const priorityTags = resolveSessionPriorities(input.priority_vector);
  const effectiveFocus = priorityTags && priorityTags.length > 0 ? priorityTags : input.focus;
  const primary = effectiveFocus[0];
  const secondary = effectiveFocus[1] ?? effectiveFocus[0];

  if (primary && t.focus_tags.includes(primary)) score += PRIMARY_FOCUS_BONUS;
  if (secondary && t.focus_tags.includes(secondary)) score += SECONDARY_FOCUS_BONUS;

  // PR-ALG-03: priority_vector 기반 추가 보너스
  if (priorityTags) {
    score += scoreByPriority(t.focus_tags, priorityTags, PRIORITY_MATCH_BONUS);
  }

  // PR-SSOT-01: session 1 intent SSOT adds explicit required tag bias.
  const requiredIntentTags = firstSessionIntent?.requiredTags ?? [];
  if (requiredIntentTags.length > 0 && t.focus_tags.some((tag) => requiredIntentTags.includes(tag))) {
    score += PRIMARY_FOCUS_BONUS;
  }

  // PR-ALG-03: pain_mode 기반 penalty
  score -= getPainModePenalty(t.contraindications, input.pain_mode);

  if (input.timeBudget === 'short' && t.duration_sec <= 420) score += SHORT_DURATION_BONUS;

  if (t.level === finalTargetLevel) score += LEVEL_MATCH_BONUS;

  return score;
}

function hasFirstSessionIntentTag(
  template: SessionTemplateRow,
  firstSessionIntent?: FirstSessionIntentSSOT | null
): boolean {
  if (!firstSessionIntent || firstSessionIntent.requiredTags.length === 0) return false;
  const tagSet = new Set([
    ...firstSessionIntent.requiredTags,
    ...firstSessionIntent.preferredTemplateTags,
  ]);
  return template.focus_tags.some((tag) => tagSet.has(tag));
}

function scoreFirstSessionIntentFit(
  template: SessionTemplateRow,
  rule: GoldPathSegmentRule,
  firstSessionIntent?: FirstSessionIntentSSOT | null
): number {
  if (!firstSessionIntent) return 0;
  if (!hasFirstSessionIntentTag(template, firstSessionIntent)) return 0;
  if (rule.kind === 'main') return 10;
  if (rule.kind === 'prep') return 6;
  return 3;
}

/**
 * PR-P2-4: Phase-safe selection. Prep/Main/Release each use phase-eligible templates only.
 * Fallback: Release may use prep-eligible (stretch) if no release-eligible; never main-exclusive.
 * Deterministic: same input → same output.
 */
function selectTemplatesWithConstraints(
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  usedTemplateIds: string[],
  prepCount: number,
  mainCount: number,
  releaseCount: number,
  onDuplicateFiltered: (count: number) => void
): SessionTemplateRow[] {
  const used = new Set<string>([...usedTemplateIds]);
  let duplicateFiltered = 0;

  const pick = (
    pool: Array<{ template: SessionTemplateRow; score: number }>,
    eligible: (t: SessionTemplateRow) => boolean,
    count: number,
    mainFocusCap?: Map<string, number>
  ): SessionTemplateRow[] => {
    const out: SessionTemplateRow[] = [];
    for (const { template } of pool) {
      if (out.length >= count) break;
      if (used.has(template.id)) {
        duplicateFiltered++;
        continue;
      }
      if (!eligible(template)) continue;
      if (mainFocusCap) {
        const ft = template.focus_tags[0] ?? '_none';
        if ((mainFocusCap.get(ft) ?? 0) >= MAX_SAME_FOCUS_IN_MAIN) continue;
      }
      out.push(template);
      used.add(template.id);
      if (mainFocusCap) {
        const ft = template.focus_tags[0] ?? '_none';
        mainFocusCap.set(ft, (mainFocusCap.get(ft) ?? 0) + 1);
      }
    }
    return out;
  };

  const mainFocusCount = new Map<string, number>();
  let prepItems = pick(sorted, isPrepEligible, prepCount);
  if (prepItems.length < prepCount) {
    prepItems = [...prepItems, ...pick(sorted, () => true, prepCount - prepItems.length)];
  }
  let mainItems = pick(sorted, isMainEligible, mainCount, mainFocusCount);
  if (mainItems.length < mainCount) {
    mainItems = [...mainItems, ...pick(sorted, () => true, mainCount - mainItems.length, mainFocusCount)];
  }
  let releaseItems = pick(sorted, isReleaseEligible, releaseCount);
  if (releaseItems.length < releaseCount) {
    const more = pick(sorted, isPrepEligible, releaseCount - releaseItems.length);
    releaseItems = [...releaseItems, ...more];
  }
  if (releaseItems.length < releaseCount) {
    const safeForRelease = (t: SessionTemplateRow) =>
      !t.focus_tags.some((tag) => MAIN_EXCLUSIVE_FROM_RELEASE.has(tag));
    const more = pick(sorted, safeForRelease, releaseCount - releaseItems.length);
    releaseItems = [...releaseItems, ...more];
  }

  onDuplicateFiltered(duplicateFiltered);
  return [...prepItems, ...mainItems, ...releaseItems];
}

function scoreGoldPathSegmentFit(
  template: SessionTemplateRow,
  rule: GoldPathSegmentRule,
  painMode?: 'none' | 'caution' | 'protected',
  surveyAdjust?: {
    sessionNumber: number;
    hints?: SurveySessionHints;
    hardDominated: boolean;
  }
): number {
  let score = 0;

  if (hasTemplatePhase(template, rule.preferredPhases)) {
    score += 8;
  } else if (rule.kind === 'cooldown' && isReleaseEligible(template)) {
    score += 5;
  } else if (rule.kind === 'accessory' && template.phase === 'main') {
    score += 2;
  }

  if (hasTargetVector(template, rule.preferredVectors)) {
    score += 12;
  } else if (hasTargetVector(template, rule.fallbackVectors)) {
    score += 6;
  }

  const progression = template.progression_level ?? 1;
  const progressionIdx = rule.preferredProgression.indexOf(progression);
  if (progressionIdx >= 0) {
    score += Math.max(1, 5 - progressionIdx);
  }

  const difficultyRank = getDifficultyRank(template.difficulty);
  if (rule.kind === 'cooldown') {
    if (difficultyRank <= 1) score += 5;
    if (difficultyRank >= 3) score -= 12;
    if (!isReleaseEligible(template) && template.phase === 'main') score -= 20;
  } else if (rule.kind === 'prep' || rule.kind === 'accessory') {
    if (difficultyRank <= 1) score += 3;
    if (difficultyRank >= 3) score -= 8;
  }

  if (painMode === 'protected') {
    if (difficultyRank >= 3) score -= 30;
    else if (difficultyRank === 2) score -= 8;
  } else if (painMode === 'caution') {
    if (difficultyRank >= 3) score -= 16;
    else if (difficultyRank === 1) score += 2;
  }

  score += surveyHintGoldPathSegmentScoreAdjust(
    surveyAdjust?.hints,
    surveyAdjust?.sessionNumber ?? 0,
    rule.kind,
    template,
    surveyAdjust?.hardDominated ?? true
  );

  return score;
}

function isConservativeFallbackEligible(
  template: SessionTemplateRow,
  kind: SegmentKind
): boolean {
  if (kind === 'cooldown') {
    return isReleaseEligible(template) || template.phase === 'prep' || template.phase === 'accessory' || getDifficultyRank(template.difficulty) <= 1;
  }
  if (kind === 'prep') {
    return template.phase === 'prep' || getDifficultyRank(template.difficulty) <= 1 || isPrepEligible(template);
  }
  if (kind === 'accessory') {
    return template.phase === 'accessory' || (template.phase === 'prep' && getDifficultyRank(template.difficulty) <= 1);
  }
  return template.phase === 'main' || isMainEligible(template);
}

function buildGoldPathSegmentRules(
  vector: GoldPathVector,
  mainCount: number
): GoldPathSegmentRule[] {
  return GOLD_PATH_RULES[vector].map((rule) => ({
    ...rule,
    count: rule.kind === 'main' ? mainCount : 1,
  }));
}

function selectGoldPathTemplates(
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  input: PlanGeneratorInput,
  vector: GoldPathVector,
  mainCount: number,
  onDuplicateFiltered: (count: number) => void,
  firstSessionIntent?: FirstSessionIntentSSOT | null,
  surveyAdjust?: { sessionNumber: number; hints?: SurveySessionHints; hardDominated: boolean }
): Array<{ rule: GoldPathSegmentRule; items: SessionTemplateRow[] }> {
  const used = new Set<string>(input.usedTemplateIds);
  const duplicateSeen = new Set<string>();
  let duplicateFiltered = 0;
  const mainFocusCount = new Map<string, number>();
  const rules = buildGoldPathSegmentRules(vector, mainCount);

  const segments = rules.map((rule) => {
    const ranked = sorted
      .map(({ template, score }) => ({
        template,
        score:
          score +
          scoreGoldPathSegmentFit(template, rule, input.pain_mode, surveyAdjust) +
          scoreFirstSessionIntentFit(template, rule, firstSessionIntent),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aProgression = a.template.progression_level ?? 1;
        const bProgression = b.template.progression_level ?? 1;
        if (aProgression !== bProgression) return aProgression - bProgression;
        const aDifficulty = getDifficultyRank(a.template.difficulty);
        const bDifficulty = getDifficultyRank(b.template.difficulty);
        if (aDifficulty !== bDifficulty) return aDifficulty - bDifficulty;
        return a.template.id.localeCompare(b.template.id);
      });

    const items: SessionTemplateRow[] = [];
    const tryPick = (candidate: SessionTemplateRow) => {
      if (used.has(candidate.id)) {
        if (!duplicateSeen.has(candidate.id)) {
          duplicateSeen.add(candidate.id);
          duplicateFiltered++;
        }
        return false;
      }
      if (rule.kind === 'main') {
        const ft = candidate.focus_tags[0] ?? '_none';
        if ((mainFocusCount.get(ft) ?? 0) >= MAX_SAME_FOCUS_IN_MAIN) return false;
        mainFocusCount.set(ft, (mainFocusCount.get(ft) ?? 0) + 1);
      }
      used.add(candidate.id);
      items.push(candidate);
      return true;
    };

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (!hasTemplatePhase(template, rule.preferredPhases)) continue;
      if (!hasTargetVector(template, rule.preferredVectors)) continue;
      tryPick(template);
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (!hasTemplatePhase(template, rule.preferredPhases)) continue;
      if (!hasTargetVector(template, rule.fallbackVectors)) continue;
      tryPick(template);
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (!hasTargetVector(template, rule.preferredVectors)) continue;
      tryPick(template);
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (!isConservativeFallbackEligible(template, rule.kind)) continue;
      tryPick(template);
    }

    return { rule, items };
  });

  onDuplicateFiltered(duplicateFiltered);
  return segments;
}

function enforceFirstSessionIntentOnSegments(
  segmentEntries: Array<{ title: string; items: SessionTemplateRow[] }>,
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  painMode: 'none' | 'caution' | 'protected' | undefined,
  firstSessionIntent?: FirstSessionIntentSSOT | null
): Array<{ title: string; items: SessionTemplateRow[] }> {
  if (!firstSessionIntent || firstSessionIntent.requiredTags.length === 0) return segmentEntries;

  const prepAndMain = segmentEntries.filter((entry) => entry.title === 'Prep' || entry.title === 'Main');
  const alreadyAligned = prepAndMain.some((entry) =>
    entry.items.some((item) => hasFirstSessionIntentTag(item, firstSessionIntent))
  );
  if (alreadyAligned) return segmentEntries;

  const usedIds = new Set(segmentEntries.flatMap((entry) => entry.items.map((item) => item.id)));
  const replacement = sorted
    .map(({ template }) => template)
    .find((template) => {
      if (usedIds.has(template.id)) return false;
      if (!hasFirstSessionIntentTag(template, firstSessionIntent)) return false;
      if (painMode && painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) return false;
      return isMainEligible(template) || isPrepEligible(template);
    });

  if (!replacement) return segmentEntries;

  return segmentEntries.map((entry) => {
    if (entry.title === 'Main' && entry.items.length > 0) {
      const nextItems = [...entry.items];
      nextItems[nextItems.length - 1] = replacement;
      return { ...entry, items: nextItems };
    }
    return entry;
  });
}

/** PR-ALG-21: sets/reps context for first session. Cooldown/release always 1 set. */
type ToPlanItemContext = {
  conditionMood: ConditionMood;
  isFirstSession: boolean;
  firstSessionTier: FirstSessionTier;
};
function toPlanItem(
  t: SessionTemplateRow,
  order: number,
  segmentTitle: string,
  ctx: ToPlanItemContext
): PlanItem {
  const isRecovery = ctx.conditionMood === 'bad';
  const isCooldownOrRelease = t.name.includes('이완') || segmentTitle === 'Cooldown';
  const allowSingleSet =
    isCooldownOrRelease ||
    isRecovery ||
    ctx.firstSessionTier === 'conservative';
  const sets = allowSingleSet ? 1 : 2;
  const reps = isRecovery ? 8 : 12;
  const focusTag = t.focus_tags[0] ?? null;

  const rationale = getExerciseRationale(focusTag);
  const item: PlanItem = {
    order,
    templateId: t.id,
    name: t.name,
    focus_tag: focusTag,
    media_ref: t.media_ref ?? undefined,
    ...(rationale && { rationale }),
  };

  if (isCooldownOrRelease) {
    item.sets = 1;
    item.hold_seconds = 30;
  } else {
    item.sets = sets;
    item.reps = reps;
  }

  return item;
}

/**
 * PR-C: targetLevel 결정론
 * base = deep_level ?? 2, mood → target, safety_mode → maxLevel, finalTargetLevel = min(target, maxLevel)
 * PR-P2-3: adaptiveOverlay.targetLevelDelta 적용 (clamp 1~3)
 */
function computeTargetLevel(input: PlanGeneratorInput): {
  finalTargetLevel: number;
  maxLevel: number;
} {
  const base = input.deep_level ?? 2;
  const target =
    input.conditionMood === 'bad'
      ? 1
      : input.conditionMood === 'ok'
        ? base
        : Math.min(base + 1, 3);
  const maxLevel =
    input.safety_mode === 'red' ? 1 : input.safety_mode === 'yellow' ? 2 : 3;
  let finalTargetLevel = Math.min(target, maxLevel);

  const delta = input.adaptiveOverlay?.targetLevelDelta ?? 0;
  if (delta !== 0) {
    finalTargetLevel = Math.min(MAX_LEVEL_CAP, Math.max(1, finalTargetLevel + delta));
    finalTargetLevel = Math.min(finalTargetLevel, maxLevel);
  }
  return { finalTargetLevel, maxLevel };
}

/**
 * 세션 플랜 plan_json 생성.
 * 템플릿 1회 조회, 스코어링, 선택, 세그먼트 조립.
 */
export async function buildSessionPlanJson(input: PlanGeneratorInput): Promise<PlanJsonOutput> {
  const templates = await getTemplatesForSessionPlan({
    scoringVersion: input.scoringVersion ?? 'deep_v2',
  });

  const surveyHintTrace: string[] = [];
  const hardDominated = surveyHintsDominatedByHardGuardrails({
    pain_mode: input.pain_mode,
    safety_mode: input.safety_mode,
  });
  const surveySessionHints = input.survey_session_hints;
  const surveyGoldPathAdjust = {
    sessionNumber: input.sessionNumber,
    hints: surveySessionHints,
    hardDominated,
  };

  const { finalTargetLevel: rawFinal, maxLevel: rawMax } = computeTargetLevel(input);
  const introClamped = clampTargetLevelForSurveyIntro(
    rawFinal,
    rawMax,
    surveySessionHints,
    input.sessionNumber,
    hardDominated
  );
  let finalTargetLevel = introClamped.finalTargetLevel;
  let maxLevel = introClamped.maxLevel;
  surveyHintTrace.push(...introClamped.trace);

  const capMerged = mergeSurveyHintMaxDifficultyCap(
    input.adaptiveOverlay?.maxDifficultyCap,
    surveySessionHints,
    hardDominated,
    input.sessionNumber
  );
  const maxDifficultyCap = capMerged.cap;
  surveyHintTrace.push(...capMerged.trace);

  const firstSessionIntent = resolveFirstSessionIntent({
    resultType: input.resultType,
    primaryType: input.primary_type,
    secondaryType: input.secondary_type,
    priorityVector: input.priority_vector,
    painMode: input.pain_mode,
    sessionNumber: input.sessionNumber,
    deepLevel: input.deep_level,
    safetyMode: input.safety_mode,
    redFlags: input.red_flags,
  });

  // PR-ALG-03: pain_mode Safety Gate - 추가 제외 태그
  const painExtraAvoid = getPainModeExtraAvoid(input.pain_mode);
  const extendedPainFlags = [...input.painFlags, ...painExtraAvoid];
  const excludeSet = buildExcludeSet(input.avoid, extendedPainFlags);
  const avoidIds = new Set(input.adaptiveOverlay?.avoidTemplateIds ?? []);

  const preFiltered = templates.filter(
    (t) =>
      !hasContraindicationOverlap(t.contraindications, excludeSet) &&
      t.level <= maxLevel &&
      !avoidIds.has(t.id) &&
      !(maxDifficultyCap && isDifficultyAboveCap(t.difficulty ?? null, maxDifficultyCap))
  );
  const selectionResult = applySelectionExcludesWithTrace(preFiltered, {
    sessionNumber: input.sessionNumber,
    painMode: input.pain_mode ?? null,
  });
  const candidates = selectionResult.templates;

  const scored = candidates.map((t) => ({
    template: t,
    score: scoreTemplate(t, input, finalTargetLevel, excludeSet, firstSessionIntent),
  }));

  const scoredPositive = scored.filter((s) => s.score >= 0);
  const competitionResult = applyCandidateCompetition(scoredPositive, {
    sessionNumber: input.sessionNumber,
    isFirstSession: input.sessionNumber === 1,
    painMode: input.pain_mode ?? null,
    priorityVector: input.priority_vector ?? null,
    timeBudget: input.timeBudget,
    conditionMood: input.conditionMood,
    usedTemplateIds: input.usedTemplateIds,
  });

  let sorted = competitionResult.ranked;

  let usedFallbackPool = false;
  if (sorted.length === 0) {
    const fallbacks = candidates.length > 0
      ? candidates.filter((t) => t.is_fallback)
      : templates.filter((t) => t.is_fallback && t.level <= maxLevel);
    sorted = fallbacks.map((t) => ({ template: t, score: 0 }));
    usedFallbackPool = true;
  }

  const overlay = input.adaptiveOverlay;
  const isShort = overlay?.forceShort ?? input.timeBudget === 'short';
  const isRecovery = overlay?.forceRecovery ?? input.conditionMood === 'bad';
  const isFirstSession = input.sessionNumber === 1;
  const tierSurvey = bumpFirstSessionTierForSurveyHints(
    adjustFirstSessionTierForOnboardingExperience(getFirstSessionTier(input), input),
    input.sessionNumber,
    surveySessionHints,
    hardDominated
  );
  const firstSessionTier = tierSurvey.tier;
  surveyHintTrace.push(...tierSurvey.trace);

  let volumeModForMainCount = input.volumeModifier ?? 0;
  if (isFirstSession && surveySessionHints && !hardDominated) {
    const vol = surveyHintVolumeDelta(surveySessionHints, hardDominated, input.sessionNumber);
    volumeModForMainCount += vol.delta;
    volumeModForMainCount = Math.max(-0.45, volumeModForMainCount);
    surveyHintTrace.push(...vol.trace);
  }

  const firstSessionLimits = FIRST_SESSION_LIMITS[firstSessionTier];
  /** PR-SESSION-BASELINE-01: main 2~3 baseline. red=1, yellow=2, else 3 */
  let mainCount = isShort ? 1 : isRecovery ? 1 : 3;
  if (input.safety_mode === 'red') {
    mainCount = 1;
  } else if (input.safety_mode === 'yellow') {
    mainCount = 2;
  }
  if (isFirstSession && mainCount > firstSessionLimits.maxMain) {
    mainCount = firstSessionLimits.maxMain;
  }
  if (typeof volumeModForMainCount === 'number' && volumeModForMainCount < 0) {
    mainCount = Math.max(1, Math.floor(mainCount * (1 + volumeModForMainCount)));
  }
  if (typeof input.volumeModifier === 'number' && input.volumeModifier > 0 && !isFirstSession) {
    mainCount = Math.min(3, Math.ceil(mainCount * (1 + input.volumeModifier)));
  }
  const prepCount = 1;
  const accessoryCount = 1;
  const cooldownCount = 1;
  if (isShort && prepCount + mainCount + accessoryCount + cooldownCount > SHORT_TOTAL_ITEM_CAP) {
    mainCount = Math.max(1, SHORT_TOTAL_ITEM_CAP - prepCount - accessoryCount - cooldownCount);
  }
  if (isFirstSession && prepCount + mainCount + accessoryCount + cooldownCount > firstSessionLimits.maxTotal) {
    mainCount = Math.max(1, firstSessionLimits.maxTotal - prepCount - accessoryCount - cooldownCount);
  }
  const totalNeeded = prepCount + mainCount + accessoryCount + cooldownCount;

  const avoidFilterApplied = avoidIds.size > 0;
  const fallbackUsed = usedFallbackPool;
  let duplicateFilteredCount = 0;

  const goldPathVector = resolveGoldPathVector(input, firstSessionIntent);
  if (
    isFirstSession &&
    surveySessionHints &&
    !hardDominated &&
    goldPathVector &&
    (surveySessionHints.movement_preference_hint !== 'mixed' ||
      surveySessionHints.asymmetry_caution_hint === 'elevated')
  ) {
    surveyHintTrace.push('selection:survey_gold_path_bias');
  }
  let selected: SessionTemplateRow[] = [];
  let selectedSegments: Array<{ title: string; items: SessionTemplateRow[] }> | null = null;

  if (goldPathVector) {
    const goldSegments = selectGoldPathTemplates(
      sorted,
      input,
      goldPathVector,
      mainCount,
      (d) => { duplicateFilteredCount = d; },
      firstSessionIntent,
      surveyGoldPathAdjust
    );
    selectedSegments = goldSegments.map((segment) => ({
      title: segment.rule.title,
      items: segment.items,
    }));
    selected = goldSegments.flatMap((segment) => segment.items);
  } else {
    selected = selectTemplatesWithConstraints(
      sorted,
      input.usedTemplateIds,
      prepCount,
      mainCount + accessoryCount,
      cooldownCount,
      (d) => { duplicateFilteredCount = d; }
    );
  }

  if (selected.length < totalNeeded && candidates.length < MIN_CANDIDATES_FOR_STRICT_AVOID) {
    const relaxedCandidates = templates.filter(
      (t) =>
        t.level <= maxLevel &&
        !hasContraindicationOverlap(t.contraindications, excludeSet)
    );
    const relaxedSorted = relaxedCandidates.map((t) => ({ template: t, score: 0 }));
    const relaxedSelected = goldPathVector
      ? selectGoldPathTemplates(relaxedSorted, input, goldPathVector, mainCount, () => {}, firstSessionIntent, surveyGoldPathAdjust)
      : [{
          rule: { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: [] as GoldPathVector[], fallbackVectors: [] as GoldPathVector[], preferredProgression: [1], count: 0 },
          items: selectTemplatesWithConstraints(
            relaxedSorted,
            input.usedTemplateIds,
            prepCount,
            mainCount + accessoryCount,
            cooldownCount,
            () => {}
          ),
        }];
    const relaxedItems = goldPathVector
      ? relaxedSelected.flatMap((segment) => segment.items)
      : relaxedSelected[0].items;
    if (relaxedItems.length >= totalNeeded) {
      selected = relaxedItems;
      if (goldPathVector) {
        selectedSegments = (relaxedSelected as Array<{ rule: GoldPathSegmentRule; items: SessionTemplateRow[] }>).map((segment) => ({
          title: segment.rule.title,
          items: segment.items,
        }));
      } else {
        selectedSegments = null;
      }
    }
  }

  const prepDuration = isShort ? 90 : 150;
  const mainDuration = isShort ? 180 : 300;
  const accessoryDuration = isShort ? 90 : 150;
  const cooldownDuration = isShort ? 60 : 120;

  const segments: PlanSegment[] = [];
  let segmentEntries = selectedSegments ?? [
    { title: 'Prep', items: selected.slice(0, prepCount) },
    { title: 'Main', items: selected.slice(prepCount, prepCount + mainCount) },
    { title: 'Accessory', items: selected.slice(prepCount + mainCount, prepCount + mainCount + accessoryCount) },
    { title: 'Cooldown', items: selected.slice(prepCount + mainCount + accessoryCount, prepCount + mainCount + accessoryCount + cooldownCount) },
  ];
  segmentEntries = enforceFirstSessionIntentOnSegments(
    segmentEntries,
    sorted,
    input.pain_mode,
    firstSessionIntent
  );

  const durationByTitle: Record<string, number> = {
    Prep: prepDuration,
    Main: mainDuration,
    Accessory: accessoryDuration,
    Cooldown: cooldownDuration,
  };

  const toPlanItemCtx: ToPlanItemContext = {
    conditionMood: input.conditionMood,
    isFirstSession,
    firstSessionTier,
  };
  for (const entry of segmentEntries) {
    if (entry.items.length === 0) continue;
    segments.push({
      title: entry.title,
      duration_sec: durationByTitle[entry.title] ?? accessoryDuration,
      items: entry.items.map((t, i) =>
        toPlanItem(t, i + 1, entry.title, toPlanItemCtx)
      ),
    });
  }

  const usedTemplateIds = segmentEntries.flatMap((entry) => entry.items.map((item) => item.id));

  const effectiveFocusAxes =
    firstSessionIntent?.focusAxes?.length
      ? firstSessionIntent.focusAxes
      : resolveSessionFocusAxes(input.priority_vector);
  const effectiveRationale =
    firstSessionIntent?.rationale ??
    resolveSessionRationale(input.priority_vector, input.pain_mode);

  const basePlan: PlanJsonOutput = {
    version: 'session_plan_v1',
    meta: {
      session_number: input.sessionNumber,
      phase: input.phase,
      result_type: input.resultType ?? 'UNKNOWN',
      confidence: (input.confidence ?? 0) >= 0.7 ? 'high' : (input.confidence ?? 0) >= 0.4 ? 'mid' : 'low',
      focus: input.focus.slice(0, 4),
      avoid: input.avoid.slice(0, 4),
      scoring_version: input.scoringVersion ?? 'deep_v2',
      used_template_ids: usedTemplateIds,
      ...(input.deep_level != null && { deep_level: input.deep_level }),
      ...(input.pain_risk != null && { pain_risk: input.pain_risk }),
      ...(input.red_flags != null && { red_flags: input.red_flags }),
      ...(input.safety_mode != null && { safety_mode: input.safety_mode }),
      ...(input.primary_type != null && { primary_type: input.primary_type }),
      ...(input.secondary_type !== undefined && { secondary_type: input.secondary_type }),
      ...(input.priority_vector != null && { priority_vector: input.priority_vector }),
      ...(input.pain_mode != null && { pain_mode: input.pain_mode }),
      ...((effectiveFocusAxes.length > 0 || input.priority_vector != null) && {
        session_focus_axes: effectiveFocusAxes.length > 0 ? effectiveFocusAxes : resolveSessionFocusAxes(input.priority_vector),
      }),
      ...((effectiveRationale != null || input.priority_vector != null) && {
        session_rationale: effectiveRationale ?? resolveSessionRationale(input.priority_vector, input.pain_mode),
      }),
      finalTargetLevel,
      maxLevel,
      constraint_flags: {
        avoid_filter_applied: avoidFilterApplied,
        duplicate_filtered_count: duplicateFilteredCount,
        focus_diversity_enforced: true,
        fallback_used: fallbackUsed,
        short_mode_applied: isShort,
        recovery_mode_applied: isRecovery,
        priority_applied: !!input.priority_vector,
        pain_gate_applied: !!input.pain_mode && input.pain_mode !== 'none',
        first_session_guardrail_applied: isFirstSession,
        ...(surveyHintTrace.length > 0 && {
          survey_session_hints_applied: true,
          survey_session_hints_trace: [...surveyHintTrace],
        }),
      },
      policy_registry: {
        version: 'session_policy_registry_v1',
        selection_rule_ids: selectionResult.appliedRuleIds,
        excluded_count_by_rule: selectionResult.excludedCountByRule,
        taxonomy_mode: 'derived_v1',
      },
      candidate_competition: competitionResult.meta,
    },
    flags: {
      recovery: isRecovery,
      short: isShort,
    },
    segments,
  };
  const constraintResult = applySessionConstraints(basePlan, templates, {
    sessionNumber: input.sessionNumber,
    totalSessions: input.totalSessions,
    painMode: input.pain_mode ?? null,
    isFirstSession,
    priorityVector: input.priority_vector ?? null,
    scoringVersion: input.scoringVersion ?? 'deep_v2',
    firstSessionTier,
    safetyMode: input.safety_mode ?? null,
  });

  const orderingResult = applySessionOrdering(constraintResult.plan, templates, {
    sessionNumber: input.sessionNumber,
    isFirstSession,
    painMode: input.pain_mode ?? null,
    priorityVector: input.priority_vector ?? null,
  });

  const auditResult = auditPlanQuality(orderingResult.plan, templates, {
    sessionNumber: input.sessionNumber,
    isFirstSession,
    painMode: input.pain_mode ?? null,
    priorityVector: input.priority_vector ?? null,
    timeBudget: input.timeBudget,
    conditionMood: input.conditionMood,
    resultType: input.resultType ?? null,
    primaryType: input.primary_type ?? null,
    secondaryType: input.secondary_type ?? null,
    safetyMode: input.safety_mode ?? null,
    redFlags: input.red_flags ?? null,
  });

  return {
    ...orderingResult.plan,
    meta: {
      ...orderingResult.plan.meta,
      plan_quality_audit: auditResult,
    },
  };
}
