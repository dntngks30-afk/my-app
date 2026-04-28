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
import {
  reconcileFinalPlanDisplayMeta,
  type FinalAlignmentAuditV1,
} from './final-plan-display-reconciliation';
import type { SurveySessionHints } from '@/lib/result/deep-result-v2-contract';
import {
  buildSurveySessionHintsObservability,
  bumpFirstSessionTierForSurveyHints,
  clampTargetLevelForSurveyIntro,
  mergeSurveyHintMaxDifficultyCap,
  surveyHintGoldPathSegmentScoreAdjust,
  surveyHintVolumeDelta,
  surveyHintsDominatedByHardGuardrails,
} from '@/lib/deep-v2/session/survey-session-hints-first-session';
import type {
  SurveySessionHintBlockedBy,
  SurveySessionHintsObservabilityV1,
} from '@/lib/deep-v2/session/survey-session-hints-first-session';
import type { SessionCameraTranslationMetaV1 } from '@/lib/deep-v2/session/merge-survey-camera-session-hints';
import {
  isLowerStabilityMainAnchorCandidate,
  isUpperOnlyMainOffAxisForLowerStability,
  LOWER_AXIS_GUARD_TAGS,
  LOWER_PAIR_GOLD_PATH_RULES,
} from '@/lib/session/lower-pair-session1-shared';
import {
  scoreUpperMobilityIntentFit,
  shouldReplaceForbiddenDominantByAnchor,
  shouldReserveUpperMainCandidate,
} from '@/lib/session/upper-mobility-session1-shared';
import {
  applyTrunkCoreSession1TemplateProjection,
  scoreTrunkCoreIntentFit,
  TRUNK_CORE_GOLD_PATH_RULES,
} from '@/lib/session/trunk-core-session1-shared';
import {
  getBalancedResetFirstSessionGoldPathRules,
  getDeconditionedFirstSessionGoldPathRules,
  isDeconditionedStablePolishAnchor,
  scoreDeconditionedStableLevelPolishBonus,
  scoreDeconditionedStableIntentFit,
  scoreDeconditionedStableTemplatePolishBonus,
} from '@/lib/session/deconditioned-stable-session1-shared';
import {
  buildPrepCooldownAlignmentMeta,
  scorePrepCooldownAxisFit,
  type PrepCooldownAlignmentMetaV1,
} from '@/lib/session/prep-cooldown-axis-profile';
import { isExcludedByFirstSessionGuardrail } from './policy-registry/rules/selectionRules';
import { normalizeExerciseTaxonomy } from '@/lib/session/taxonomy';
import { hasSingleLegLoad } from '@/core/session-guardrail/movementSafetyRules';
import { isSafeForFirstSession } from '@/core/session-guardrail/difficultyClamp';

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
const GOLD_PATH_VECTORS = ['lower_stability', 'lower_mobility', 'trunk_control', 'upper_mobility', 'deconditioned', 'balanced_reset'] as const;
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
  phases: readonly TemplatePhase[]
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
  preferredPhases: readonly TemplatePhase[];
  preferredVectors: readonly GoldPathVector[];
  fallbackVectors: readonly GoldPathVector[];
  preferredProgression: readonly number[];
  count: number;
};

const GOLD_PATH_RULES: Record<GoldPathVector, Omit<GoldPathSegmentRule, 'count'>[]> = {
  lower_stability: [...LOWER_PAIR_GOLD_PATH_RULES.lower_stability],
  lower_mobility: [...LOWER_PAIR_GOLD_PATH_RULES.lower_mobility],
  trunk_control: [...TRUNK_CORE_GOLD_PATH_RULES],
  upper_mobility: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['upper_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['upper_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [2, 1, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['upper_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['upper_mobility'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
  ],
  deconditioned: [...getDeconditionedFirstSessionGoldPathRules()],
  balanced_reset: [...getBalancedResetFirstSessionGoldPathRules()],
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
 * PR-FIRST-SESSION-QUALITY-02A / PR-TRUTH-03: beginner → 티어 한 단계 보수적으로.
 * intermediate는 변경 없음(baseline). advanced는 티어가 아니라 별도 assertive uplift(아래)로 처리.
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

/**
 * PR-TRUTH-03: advanced 첫 세션 — 안전·통증·난이도 캡·짧은/회복 모드가 아닐 때만 제한적 uplift.
 */
function canApplyAdvancedFirstSessionUplift(
  input: PlanGeneratorInput,
  firstSessionTier: FirstSessionTier,
  maxDifficultyCap: 'low' | 'medium' | 'high' | undefined
): boolean {
  if (input.sessionNumber !== 1) return false;
  if (input.exercise_experience_level !== 'advanced') return false;
  if (firstSessionTier !== 'normal') return false;
  if (input.pain_mode != null && input.pain_mode !== 'none') return false;
  if (input.safety_mode != null && input.safety_mode !== 'none') return false;
  const isShort = input.adaptiveOverlay?.forceShort ?? input.timeBudget === 'short';
  const isRecovery = input.adaptiveOverlay?.forceRecovery ?? input.conditionMood === 'bad';
  if (isShort || isRecovery) return false;
  if (maxDifficultyCap != null) return false;
  if ((input.adaptiveOverlay?.targetLevelDelta ?? 0) < 0) return false;
  return true;
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
    case 'STABLE':
      return 'balanced_reset';
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
  /** PR-SURVEY-07: refined 행 설문+카메라 병합 메타(관찰성) */
  session_camera_translation?: SessionCameraTranslationMetaV1;
  /** PR-PILOT-BASELINE-SESSION-ALIGN-01: public baseline에서 파생된 세분화된 세션 앵커 */
  baseline_session_anchor?: string;
  /** Harness/fixture path: DB 조회 없이 템플릿 풀 주입 (기본 동작은 DB 조회 유지) */
  templatePool?: SessionTemplateRow[];
};

/** PR-FIRST-SESSION-ANCHOR-REGRESSION-48-01: S1 Main vs gold_path_vector (additive meta). */
export type FirstSessionAnchorIntegrityMetaV1 = {
  version: 'first_session_anchor_integrity_v1';
  gold_path_vector: string | null;
  main_anchor_match_count: number;
  main_support_match_count: number;
  main_off_axis_count: number;
  repaired: boolean;
  repaired_template_ids?: string[];
  removed_template_ids?: string[];
};

/** PR-SESSION-2PLUS-CONTINUITY-GUARD-01: S2/S3 only — type continuity (weaker than S1 anchor). */
export type SessionTypeContinuityMetaV1 = {
  version: 'session_type_continuity_v1';
  session_number: number;
  baseline_anchor: string | null;
  primary_type: string | null;
  main_anchor_match_count: number;
  main_support_match_count: number;
  main_off_axis_count: number;
  repaired: boolean;
  repaired_template_ids?: string[];
  removed_template_ids?: string[];
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
    /**
     * PR-SURVEY-06: UI 카피용 아님. 설문 힌트 기반 세션 구성 태그(디버그·감사).
     * PR-TRUTH-02: session_rationale 본문은 최종 세그먼트 기준으로 재정렬될 수 있음(감사는 final_alignment_audit).
     */
    survey_session_rationale_tags?: string[];
    /** PR-SURVEY-06: 설문 힌트 관찰성(세션 1 중심) */
    survey_session_hints_observability?: SurveySessionHintsObservabilityV1;
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
      /** PR-SURVEY-05~06: 세션 1에서 힌트 존재·적격·적용·차단 구분 */
      survey_session_hints_present?: boolean;
      survey_session_hints_eligible?: boolean;
      survey_session_hints_applied?: boolean;
      /** blocked_by가 null이 아닐 때 true (session_not_1 포함) */
      survey_session_hints_blocked?: boolean;
      survey_session_hints_blocked_by?: SurveySessionHintBlockedBy;
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
    /** PR-TRUTH-02: upstream intent vs final composition drift (additive) */
    final_alignment_audit?: FinalAlignmentAuditV1;
    /** PR-PILOT-BASELINE-SESSION-ALIGN-01: baseline-first alignment observability */
    baseline_alignment?: {
      baseline_session_anchor: string | null;
      first_session_intent_anchor: string | null;
      gold_path_vector: string | null;
      intent_source: 'baseline_anchor' | 'legacy_band' | 'none';
    };
    /** PR-PREP-COOLDOWN-AXIS-ALIGN-01: Prep/Cooldown axis fit (additive, non-UI) */
    prep_cooldown_alignment?: PrepCooldownAlignmentMetaV1;
    /** PR-FIRST-SESSION-ANCHOR-REGRESSION-48-01: S1 + gold_path Main target_vector 정합(관찰) */
    first_session_anchor_integrity?: FirstSessionAnchorIntegrityMetaV1;
    /** PR-SESSION-2PLUS-CONTINUITY-GUARD-01: S2/S3 only */
    session_type_continuity?: SessionTypeContinuityMetaV1;
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

  const polishAnchor = firstSessionIntent?.goldPath ?? null;
  if (isDeconditionedStablePolishAnchor(polishAnchor)) {
    score += scoreDeconditionedStableIntentFit({
      anchorType: polishAnchor,
      templateFocusTags: t.focus_tags,
    });
    score += scoreDeconditionedStableLevelPolishBonus({
      anchorType: polishAnchor,
      templateLevel: t.level,
    });
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
  const polishAnchor = firstSessionIntent.goldPath;
  if (isDeconditionedStablePolishAnchor(polishAnchor)) {
    const requiredTagFit = hasFirstSessionIntentTag(template, firstSessionIntent)
      ? scoreDeconditionedStableIntentFit({
          anchorType: polishAnchor,
          templateFocusTags: template.focus_tags,
          ruleKind: rule.kind,
        })
      : 0;
    return requiredTagFit + scoreDeconditionedStableTemplatePolishBonus({
      anchorType: polishAnchor,
      templateId: template.id,
      ruleKind: rule.kind,
    });
  }
  if (!hasFirstSessionIntentTag(template, firstSessionIntent)) return 0;
  const anchor = firstSessionIntent.anchorType;
  if (anchor === 'lower_stability') {
    if (rule.kind === 'main') return 12;
    if (rule.kind === 'accessory') return 5;
    if (rule.kind === 'prep') return 5;
    return 2;
  }
  if (anchor === 'lower_mobility') {
    if (rule.kind === 'main') return 12;
    if (rule.kind === 'accessory') return 6;
    if (rule.kind === 'prep' || rule.kind === 'cooldown') return 4;
    return 2;
  }
  if (anchor === 'upper_mobility') {
    return scoreUpperMobilityIntentFit(template.focus_tags, rule.kind);
  }
  if (anchor === 'trunk_control') {
    return scoreTrunkCoreIntentFit(template.focus_tags, rule.kind);
  }
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
  },
  goldPathVector?: GoldPathVector | null
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

  if (goldPathVector && (rule.kind === 'prep' || rule.kind === 'cooldown')) {
    score += scorePrepCooldownAxisFit({
      goldPathVector,
      segmentKind: rule.kind,
      focusTags: template.focus_tags,
      targetVector: template.target_vector,
    });
  }

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
          scoreGoldPathSegmentFit(
            template,
            rule,
            input.pain_mode,
            surveyAdjust,
            vector
          ) +
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
      // PR2-C follow-up: reserve upper-main-capacity candidates in the final conservative fallback pass too.
      if (shouldReserveUpperMainCandidate({
        anchorType: firstSessionIntent?.anchorType,
        ruleKind: rule.kind,
        templateFocusTags: template.focus_tags,
        isMainEligible: isMainEligible(template),
      })) continue;
      if (!hasTemplatePhase(template, rule.preferredPhases)) continue;
      if (!hasTargetVector(template, rule.preferredVectors)) continue;
      tryPick(template);
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (shouldReserveUpperMainCandidate({
        anchorType: firstSessionIntent?.anchorType,
        ruleKind: rule.kind,
        templateFocusTags: template.focus_tags,
        isMainEligible: isMainEligible(template),
      })) continue;
      if (!hasTemplatePhase(template, rule.preferredPhases)) continue;
      if (!hasTargetVector(template, rule.fallbackVectors)) continue;
      tryPick(template);
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (shouldReserveUpperMainCandidate({
        anchorType: firstSessionIntent?.anchorType,
        ruleKind: rule.kind,
        templateFocusTags: template.focus_tags,
        isMainEligible: isMainEligible(template),
      })) continue;
      if (!hasTargetVector(template, rule.preferredVectors)) continue;
      tryPick(template);
    }

    for (const { template } of ranked) {
      if (items.length >= rule.count) break;
      if (shouldReserveUpperMainCandidate({
        anchorType: firstSessionIntent?.anchorType,
        ruleKind: rule.kind,
        templateFocusTags: template.focus_tags,
        isMainEligible: isMainEligible(template),
      })) continue;
      if (!isConservativeFallbackEligible(template, rule.kind)) continue;
      tryPick(template);
    }

    return { rule, items };
  });

  onDuplicateFiltered(duplicateFiltered);
  return segments;
}

/**
 * PR-PILOT-BASELINE-SESSION-ALIGN-01: session 1 Main segment alignment 보장.
 *
 * Main-eligible template만 Main에 주입 가능. prep-eligible을 Main에 승격하는 것은 금지.
 *
 * 1단계: Main에 이미 intent tag가 있으면 forbiddenDominant 검사만 수행.
 * 2단계: Main에 aligned item이 없으면 main-eligible aligned replacement를 찾아 교체.
 * 3단계: main-eligible replacement가 없으면 기존 Main을 유지 (무교체 종료).
 * 4단계: forbiddenDominantAxes 위반 교정.
 */
function enforceFirstSessionIntentOnSegments(
  segmentEntries: Array<{ title: string; items: SessionTemplateRow[] }>,
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  painMode: 'none' | 'caution' | 'protected' | undefined,
  firstSessionIntent?: FirstSessionIntentSSOT | null
): Array<{ title: string; items: SessionTemplateRow[] }> {
  if (!firstSessionIntent || firstSessionIntent.requiredTags.length === 0) return segmentEntries;

  const mainEntry = segmentEntries.find((e) => e.title === 'Main');
  const mainAligned = mainEntry?.items.some((item) =>
    hasFirstSessionIntentTag(item, firstSessionIntent)
  ) ?? false;

  if (mainAligned) {
    return enforceForbiddenDominantAxes(segmentEntries, sorted, painMode, firstSessionIntent);
  }

  // Main에 aligned item이 없으면 main-eligible replacement만 시도
  const usedIds = new Set(segmentEntries.flatMap((entry) => entry.items.map((item) => item.id)));
  const replacement = sorted
    .map(({ template }) => template)
    .find((template) => {
      if (usedIds.has(template.id)) return false;
      if (!hasFirstSessionIntentTag(template, firstSessionIntent)) return false;
      if (painMode && painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) return false;
      return isMainEligible(template);
    });

  if (replacement) {
    segmentEntries = segmentEntries.map((entry) => {
      if (entry.title === 'Main' && entry.items.length > 0) {
        const nextItems = [...entry.items];
        nextItems[nextItems.length - 1] = replacement;
        return { ...entry, items: nextItems };
      }
      return entry;
    });
  }
  // main-eligible replacement가 없으면 기존 Main 유지 (phase semantics 보존)

  return enforceForbiddenDominantAxes(segmentEntries, sorted, painMode, firstSessionIntent);
}

/**
 * PR-PILOT-BASELINE-SESSION-ALIGN-01: forbiddenDominantAxes 위반 교정.
 * Main segment에서 forbidden axis가 과반을 차지하면 교체 시도.
 */
function enforceForbiddenDominantAxes(
  segmentEntries: Array<{ title: string; items: SessionTemplateRow[] }>,
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  painMode: 'none' | 'caution' | 'protected' | undefined,
  firstSessionIntent: FirstSessionIntentSSOT
): Array<{ title: string; items: SessionTemplateRow[] }> {
  if (firstSessionIntent.forbiddenDominantAxes.length === 0) return segmentEntries;

  const mainEntry = segmentEntries.find((e) => e.title === 'Main');
  if (!mainEntry || mainEntry.items.length === 0) return segmentEntries;

  const forbiddenSet = new Set(firstSessionIntent.forbiddenDominantAxes);
  const forbiddenTagsForAxis: Record<string, string[]> = {
    upper_mobility: ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation', 'shoulder_stability'],
    lower_mobility: [...LOWER_AXIS_GUARD_TAGS.lower_mobility],
    lower_stability: [...LOWER_AXIS_GUARD_TAGS.lower_stability],
    trunk_control: ['core_control', 'core_stability', 'global_core'],
  };

  const forbiddenTags = new Set<string>();
  for (const axis of forbiddenSet) {
    for (const tag of forbiddenTagsForAxis[axis] ?? []) {
      forbiddenTags.add(tag);
    }
  }

  const forbiddenCount = mainEntry.items.filter((item) =>
    item.focus_tags.some((tag) => forbiddenTags.has(tag))
  ).length;

  const shouldReplaceForbiddenDominant = shouldReplaceForbiddenDominantByAnchor({
    anchorType: firstSessionIntent.anchorType,
    forbiddenCount,
    mainItemCount: mainEntry.items.length,
  });

  if (!shouldReplaceForbiddenDominant) return segmentEntries;

  const usedIds = new Set(segmentEntries.flatMap((entry) => entry.items.map((item) => item.id)));
  const replacement = sorted
    .map(({ template }) => template)
    .find((template) => {
      if (usedIds.has(template.id)) return false;
      if (template.focus_tags.some((tag) => forbiddenTags.has(tag))) return false;
      if (!hasFirstSessionIntentTag(template, firstSessionIntent)) return false;
      if (painMode && painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) return false;
      return isMainEligible(template);
    });

  if (!replacement) return segmentEntries;

  const worstIdx = mainEntry.items.reduce((worst, item, idx) => {
    const isForbidden = item.focus_tags.some((tag) => forbiddenTags.has(tag));
    return isForbidden ? idx : worst;
  }, -1);

  if (worstIdx < 0) return segmentEntries;

  return segmentEntries.map((entry) => {
    if (entry.title === 'Main') {
      const nextItems = [...entry.items];
      nextItems[worstIdx] = replacement;
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
  /** PR-TRUTH-03: Main prescription density when advanced uplift applies */
  advancedFirstSessionPrescriptionUplift?: boolean;
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
  const reps = isRecovery
    ? 8
    : ctx.advancedFirstSessionPrescriptionUplift && segmentTitle === 'Main'
      ? 14
      : 12;
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

function isTargetAnchorVector(t: SessionTemplateRow, g: GoldPathVector): boolean {
  return hasTargetVector(t, [g]);
}

function isTargetSupportForGoldPath(t: SessionTemplateRow, g: GoldPathVector): boolean {
  if (isTargetAnchorVector(t, g)) return false;
  const v = new Set(t.target_vector ?? []);
  if (g === 'lower_stability') {
    return v.has('trunk_control') || v.has('lower_mobility');
  }
  if (g === 'lower_mobility') {
    return v.has('lower_stability') || v.has('trunk_control');
  }
  if (g === 'upper_mobility') {
    return v.has('trunk_control');
  }
  if (g === 'trunk_control') {
    return v.has('lower_stability') || v.has('upper_mobility');
  }
  if (g === 'deconditioned') {
    return v.has('trunk_control');
  }
  if (g === 'balanced_reset') {
    return (
      v.has('trunk_control') ||
      v.has('upper_mobility') ||
      v.has('lower_stability') ||
      v.has('lower_mobility') ||
      v.has('deconditioned')
    );
  }
  return false;
}

function isTargetOffAxisForGoldPath(t: SessionTemplateRow, g: GoldPathVector): boolean {
  if (isTargetAnchorVector(t, g) || isTargetSupportForGoldPath(t, g)) return false;
  const v = new Set(t.target_vector ?? []);
  if (v.size === 0) return true;
  if (g === 'lower_stability') {
    return v.has('upper_mobility') && !v.has('trunk_control') && !v.has('lower_mobility') && !v.has('lower_stability');
  }
  if (g === 'lower_mobility') {
    return (
      v.has('upper_mobility') && !v.has('trunk_control') && !v.has('lower_mobility') && !v.has('lower_stability')
    );
  }
  if (g === 'upper_mobility') {
    return (
      v.has('lower_stability') && !v.has('upper_mobility') && !v.has('trunk_control') && !v.has('lower_mobility')
    );
  }
  if (g === 'trunk_control') {
    return (
      v.has('upper_mobility') && !v.has('trunk_control') && !v.has('lower_stability') && !v.has('lower_mobility')
    );
  }
  if (g === 'deconditioned') {
    return v.has('upper_mobility') && !v.has('deconditioned') && !v.has('trunk_control') && v.size === 1;
  }
  if (g === 'balanced_reset') {
    return (v.size === 1 && (v.has('upper_mobility') || v.has('lower_mobility'))) || (v.size === 2 && (v.has('upper_mobility') || v.has('lower_mobility')) && !v.has('trunk_control') && !v.has('balanced_reset'));
  }
  return false;
}

function isHighRiskUnilateralUnfavorable(t: SessionTemplateRow): boolean {
  return hasSingleLegLoad(t) && (t.difficulty === 'high' || (t.progression_level ?? 1) >= 3);
}

function countMainVectorStats(mainRows: SessionTemplateRow[], g: GoldPathVector) {
  let main_anchor_match_count = 0;
  let main_support_match_count = 0;
  let main_off_axis_count = 0;
  for (const t of mainRows) {
    if (isTargetAnchorVector(t, g)) main_anchor_match_count += 1;
    else if (isTargetSupportForGoldPath(t, g)) main_support_match_count += 1;
    else if (isTargetOffAxisForGoldPath(t, g)) main_off_axis_count += 1;
  }
  return { main_anchor_match_count, main_support_match_count, main_off_axis_count };
}

function meetsS1MainAnchorContract(
  mainRows: SessionTemplateRow[],
  g: GoldPathVector
): boolean {
  const n = mainRows.length;
  if (n === 0) return true;

  if (g === 'deconditioned') {
    if (mainRows.some((t) => isTargetAnchorVector(t, g))) return true;
    const h = mainRows.filter((t) => isHighRiskUnilateralUnfavorable(t)).length;
    return h < 2;
  }

  const { main_anchor_match_count: a, main_support_match_count: s, main_off_axis_count: o } = countMainVectorStats(
    mainRows,
    g
  );

  if (g === 'balanced_reset') {
    if (a >= 1) return true;
    if (n === 2 && o === 2) return false;
    if (n === 1) return a + s >= 1;
  }

  if (n === 1) {
    return a >= 1;
  }
  if (n === 2) {
    if (a < 1) return false;
    if (o === 2) return false;
    return true;
  }
  if (n === 3) {
    if (a < 1) return false;
    if (a + s < 2) return false;
    if (o > 1) return false;
    return true;
  }
  return a >= 1;
}

function scoreRepairTemplateForGold(t: SessionTemplateRow, g: GoldPathVector): number {
  let s = 0;
  if (isTargetAnchorVector(t, g)) s += 1000;
  if (isTargetSupportForGoldPath(t, g)) s += 200;
  if (isTargetOffAxisForGoldPath(t, g)) s -= 500;
  return s;
}

/**
 * PR-FIRST-SESSION-LOWER-ANCHOR-MAIN-GUARD-01: S1 lower_stability Main 복구 후보 순위 (난이도·안전 우선 아님).
 * lower_mobility support는 명시 순위상 하단(상체 채우기 금지).
 */
function scoreLowerStabilityS1MainRepairPriority(t: SessionTemplateRow): number {
  const tv = t.target_vector ?? [];
  let s = 0;
  if (tv.includes('lower_stability')) s += 1_000_000;
  if (t.focus_tags.some((tag) => tag === 'lower_chain_stability')) s += 800_000;
  if (t.focus_tags.some((tag) => tag === 'glute_activation')) s += 600_000;
  if (t.focus_tags.some((tag) => tag === 'glute_medius')) s += 500_000;
  if (t.focus_tags.some((tag) => tag === 'basic_balance')) s += 400_000;
  if (t.focus_tags.some((tag) => tag === 'core_stability')) s += 300_000;
  if (tv.includes('lower_mobility')) s += 100_000;
  return s + scoreRepairTemplateForGold(t, 'lower_stability');
}

function countPlanSegmentItems(segments: PlanSegment[]): number {
  return segments.reduce((acc, seg) => acc + seg.items.length, 0);
}

function isRepairTemplateEligible(
  t: SessionTemplateRow,
  args: {
    sessionNumber: number;
    excludeSet: Set<string>;
    painMode: 'none' | 'caution' | 'protected' | undefined;
    maxLevel: number;
    maxDifficultyCap: 'low' | 'medium' | 'high' | undefined;
  }
): boolean {
  if (hasContraindicationOverlap(t.contraindications, args.excludeSet)) return false;
  if ((t.level ?? 1) > args.maxLevel) return false;
  if (!isSafeForFirstSession(t)) return false;
  const tax = normalizeExerciseTaxonomy(t);
  if (isExcludedByFirstSessionGuardrail(t, args.sessionNumber, tax.risk_group)) return false;
  if (args.painMode && args.painMode !== 'none' && (t.avoid_if_pain_mode ?? []).includes(args.painMode)) {
    return false;
  }
  if (args.maxDifficultyCap && isDifficultyAboveCap(t.difficulty ?? null, args.maxDifficultyCap)) {
    return false;
  }
  if (!(t.phase === 'main' || isMainEligible(t))) return false;
  return true;
}

function collectUsedTemplateIdsFromSegments(segments: PlanSegment[]): Set<string> {
  const s = new Set<string>();
  for (const seg of segments) {
    for (const it of seg.items) s.add(it.templateId);
  }
  return s;
}

function clonePlanSegments(segments: PlanSegment[]): PlanSegment[] {
  return segments.map((seg) => ({ ...seg, items: seg.items.map((i) => ({ ...i })) }));
}

type RepairS1Context = {
  goldPathVector: GoldPathVector;
  templatePool: SessionTemplateRow[];
  templatesById: Map<string, SessionTemplateRow>;
  excludeSet: Set<string>;
  painMode: 'none' | 'caution' | 'protected' | undefined;
  maxDifficultyCap: 'low' | 'medium' | 'high' | undefined;
  maxLevel: number;
  toPlanItemCtx: ToPlanItemContext;
  sessionNumber: number;
};

function findBestMainRepairFromPool(
  ctx: RepairS1Context,
  used: Set<string>,
  excludeId: string | null,
  opts?: { requireLowerStabilityMainAnchor?: boolean }
): SessionTemplateRow | null {
  const isS1Lower = ctx.sessionNumber === 1 && ctx.goldPathVector === 'lower_stability';
  const cands = ctx.templatePool
    .filter(
      (t) =>
        t.id !== excludeId &&
        isRepairTemplateEligible(t, {
          sessionNumber: ctx.sessionNumber,
          excludeSet: ctx.excludeSet,
          painMode: ctx.painMode,
          maxLevel: ctx.maxLevel,
          maxDifficultyCap: ctx.maxDifficultyCap,
        }) &&
        (!isS1Lower || !isUpperOnlyMainOffAxisForLowerStability(t)) &&
        (!opts?.requireLowerStabilityMainAnchor ||
          (isLowerStabilityMainAnchorCandidate(t) && !isUpperOnlyMainOffAxisForLowerStability(t)))
    )
    .map((t) => ({
      t,
      sc: isS1Lower
        ? scoreLowerStabilityS1MainRepairPriority(t)
        : scoreRepairTemplateForGold(t, ctx.goldPathVector),
    }))
    .filter(({ t }) => !used.has(t.id))
    .sort((a, b) => b.sc - a.sc || a.t.id.localeCompare(b.t.id));
  return cands[0]?.t ?? null;
}

function pickMainReplaceIndexForContinuity(mainRows: SessionTemplateRow[], g: GoldPathVector): number {
  for (let i = 0; i < mainRows.length; i += 1) {
    if (isTargetOffAxisForGoldPath(mainRows[i]!, g)) return i;
  }
  for (let i = 0; i < mainRows.length; i += 1) {
    if (!isTargetAnchorVector(mainRows[i]!, g) && !isTargetSupportForGoldPath(mainRows[i]!, g)) return i;
  }
  for (let i = 0; i < mainRows.length; i += 1) {
    if (!isTargetAnchorVector(mainRows[i]!, g)) return i;
  }
  return 0;
}

function planHasTargetVectorInPlan(
  segments: PlanSegment[],
  templatesById: Map<string, SessionTemplateRow>,
  vec: GoldPathVector | string
): boolean {
  const s = String(vec);
  for (const seg of segments) {
    for (const it of seg.items) {
      const t = templatesById.get(it.templateId);
      if (t?.target_vector?.includes(s)) return true;
    }
  }
  return false;
}

function mainHasLowerStabilityFamily(rows: SessionTemplateRow[]): boolean {
  return rows.some(
    (t) => isTargetAnchorVector(t, 'lower_stability') || isTargetSupportForGoldPath(t, 'lower_stability')
  );
}

function isMainUpperOnlyDominant(rows: SessionTemplateRow[]): boolean {
  if (rows.length < 2) return false;
  return rows.every((t) => {
    const v = new Set(t.target_vector ?? []);
    return v.has('upper_mobility') && !v.has('lower_stability') && !v.has('trunk_control') && !v.has('lower_mobility');
  });
}

function isMainUpperDominantLowerMobility(rows: SessionTemplateRow[]): boolean {
  if (rows.length < 2) return false;
  return rows.every(
    (t) =>
      (t.target_vector ?? []).includes('upper_mobility') &&
      !(t.target_vector ?? []).includes('lower_mobility')
  );
}

function isMainLowerStabilityDominantUpper(rows: SessionTemplateRow[]): boolean {
  if (rows.length < 2) return false;
  return rows.every(
    (t) =>
      (t.target_vector ?? []).includes('lower_stability') &&
      !(t.target_vector ?? []).includes('upper_mobility')
  );
}

function resolveSession2PlusContinuityAnchor(input: PlanGeneratorInput): GoldPathVector | null {
  const b = input.baseline_session_anchor?.trim();
  if (b && (GOLD_PATH_VECTORS as readonly string[]).includes(b)) {
    return b as GoldPathVector;
  }
  const byPrimary: Record<string, GoldPathVector> = {
    LOWER_INSTABILITY: 'lower_stability',
    LOWER_MOBILITY_RESTRICTION: 'lower_mobility',
    UPPER_IMMOBILITY: 'upper_mobility',
    CORE_CONTROL_DEFICIT: 'trunk_control',
    DECONDITIONED: 'deconditioned',
    STABLE: 'balanced_reset',
  };
  if (input.primary_type && byPrimary[input.primary_type]) {
    return byPrimary[input.primary_type]!;
  }
  const ranked = Object.entries(input.priority_vector ?? {})
    .filter(
      (e): e is [GoldPathVector, number] =>
        (GOLD_PATH_VECTORS as readonly string[]).includes(e[0]) && typeof e[1] === 'number' && e[1] > 0
    )
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (ranked[0]) return ranked[0]![0];
  return null;
}

/**
 * S2/S3: 약한 연속성 보정 + 관찰 메타. S1 앵커 복구와 별도.
 */
function repairSession2PlusTypeContinuity(input: {
  plan: PlanJsonOutput;
  planInput: PlanGeneratorInput;
  sessionNumber: number;
  templatePool: SessionTemplateRow[];
  maxLevel: number;
  excludeSet: Set<string>;
  painMode: 'none' | 'caution' | 'protected' | undefined;
  maxDifficultyCap: 'low' | 'medium' | 'high' | undefined;
  toPlanItemCtx: ToPlanItemContext;
}): { plan: PlanJsonOutput; meta: SessionTypeContinuityMetaV1 | null } {
  if (input.sessionNumber !== 2 && input.sessionNumber !== 3) {
    return { plan: input.plan, meta: null };
  }
  const anchor = resolveSession2PlusContinuityAnchor(input.planInput);
  if (!anchor) {
    return { plan: input.plan, meta: null };
  }
  const templatesById = new Map(input.templatePool.map((t) => [t.id, t]));
  const segments = clonePlanSegments(input.plan.segments);
  const getMain = () => segments.find((s) => s.title === 'Main');
  const asRows = (main: PlanSegment | undefined) =>
    (main?.items.map((i) => templatesById.get(i.templateId)).filter(Boolean) ?? []) as SessionTemplateRow[];
  const repairedIdList: string[] = [];
  const removedIdList: string[] = [];
  const ctxTemplate = (g: GoldPathVector): RepairS1Context => ({
    goldPathVector: g,
    templatePool: input.templatePool,
    templatesById,
    excludeSet: input.excludeSet,
    painMode: input.painMode,
    maxDifficultyCap: input.maxDifficultyCap,
    maxLevel: input.maxLevel,
    toPlanItemCtx: input.toPlanItemCtx,
    sessionNumber: input.sessionNumber,
  });
  const tryReplaceMainAt = (mainIndex: number, replacement: SessionTemplateRow, title = 'Main') => {
    const main = getMain()!;
    const old = main.items[mainIndex]!.templateId;
    removedIdList.push(old);
    repairedIdList.push(replacement.id);
    main.items[mainIndex] = toPlanItem(
      replacement,
      mainIndex + 1,
      title,
      input.toPlanItemCtx
    );
  };
  for (let iter = 0; iter < 24; iter += 1) {
    const mainSeg = getMain();
    if (!mainSeg) break;
    const rows = asRows(mainSeg);
    if (rows.length === 0) break;
    let needRepair = false;
    if (anchor === 'trunk_control') {
      needRepair = !rows.some((t) => hasTargetVector(t, ['trunk_control']));
    } else if (anchor === 'lower_stability') {
      needRepair = isMainUpperOnlyDominant(rows) || !mainHasLowerStabilityFamily(rows);
    } else if (anchor === 'lower_mobility') {
      const planVec = planHasTargetVectorInPlan(segments, templatesById, 'lower_mobility');
      needRepair = isMainUpperDominantLowerMobility(rows) || !planVec;
    } else if (anchor === 'upper_mobility') {
      const planVec = planHasTargetVectorInPlan(segments, templatesById, 'upper_mobility');
      needRepair = isMainLowerStabilityDominantUpper(rows) || !planVec;
    } else if (anchor === 'deconditioned') {
      const bad = rows.filter((t) => isHighRiskUnilateralUnfavorable(t));
      needRepair = bad.length >= 2;
    } else if (anchor === 'balanced_reset') {
      if (rows.length < 2) {
        needRepair = false;
      } else {
        const oneAxis = rows.every((t) => {
          const v = t.target_vector ?? [];
          return v.length === 1 && (v[0] === 'upper_mobility' || v[0] === 'lower_mobility');
        });
        needRepair = rows.length === 2 && oneAxis;
      }
    }
    if (!needRepair) break;
    const g =
      anchor === 'lower_mobility' && !planHasTargetVectorInPlan(segments, templatesById, 'lower_mobility')
        ? 'lower_mobility'
        : anchor === 'upper_mobility' && !planHasTargetVectorInPlan(segments, templatesById, 'upper_mobility')
          ? 'upper_mobility'
          : anchor;
    const ctx = ctxTemplate(g);
    const used = collectUsedTemplateIdsFromSegments(segments);
    const tryIdx = pickMainReplaceIndexForContinuity(rows, g);
    const usedForPick = new Set(used);
    const oldId = getMain()!.items[tryIdx]!.templateId;
    usedForPick.delete(oldId);
    const repl = findBestMainRepairFromPool(ctx, usedForPick, null);
    if (repl) {
      tryReplaceMainAt(tryIdx, repl);
      continue;
    }
    let swapped = false;
    for (const segTitle of ['Accessory', 'Prep', 'Cooldown'] as const) {
      if (swapped) break;
      const seg = segments.find((s) => s.title === segTitle);
      if (!seg) continue;
      for (let j = 0; j < seg.items.length; j += 1) {
        const oth = templatesById.get(seg.items[j]!.templateId);
        if (!oth) continue;
        if (
          !isRepairTemplateEligible(oth, {
            sessionNumber: input.sessionNumber,
            excludeSet: input.excludeSet,
            painMode: input.painMode,
            maxLevel: input.maxLevel,
            maxDifficultyCap: input.maxDifficultyCap,
          })
        ) {
          continue;
        }
        if (scoreRepairTemplateForGold(oth, g) < 200 && !isTargetAnchorVector(oth, g)) {
          continue;
        }
        const badT = asRows(getMain())[tryIdx]!;
        if (!badT) break;
        tryReplaceMainAt(tryIdx, oth);
        seg.items[j] = toPlanItem(badT, j + 1, segTitle, input.toPlanItemCtx);
        swapped = true;
        break;
      }
    }
    if (!swapped) break;
  }
  const finalMain = asRows(getMain());
  const stats = countMainVectorStats(finalMain, anchor);
  const meta: SessionTypeContinuityMetaV1 = {
    version: 'session_type_continuity_v1',
    session_number: input.sessionNumber,
    baseline_anchor: input.planInput.baseline_session_anchor ?? null,
    primary_type: input.planInput.primary_type ?? null,
    main_anchor_match_count: stats.main_anchor_match_count,
    main_support_match_count: stats.main_support_match_count,
    main_off_axis_count: stats.main_off_axis_count,
    repaired: repairedIdList.length > 0,
    ...(repairedIdList.length > 0 && { repaired_template_ids: repairedIdList }),
    ...(removedIdList.length > 0 && { removed_template_ids: removedIdList }),
  };
  return {
    plan: {
      ...input.plan,
      segments,
      meta: {
        ...input.plan.meta,
        used_template_ids: Array.from(
          new Set(segments.flatMap((s) => s.items.map((i) => i.templateId)))
        ),
      },
    },
    meta,
  };
}

/**
 * S1 + gold: Main anchor 보정(풀 → Accessory/Prep/Cooldown 스왑). 세션 2+ no-op.
 */
function repairFirstSessionMainAnchorIntegration(input: {
  plan: PlanJsonOutput;
  sessionNumber: number;
  goldPathVector: GoldPathVector;
  templatePool: SessionTemplateRow[];
  maxLevel: number;
  excludeSet: Set<string>;
  painMode: 'none' | 'caution' | 'protected' | undefined;
  maxDifficultyCap: 'low' | 'medium' | 'high' | undefined;
  toPlanItemCtx: ToPlanItemContext;
}): { plan: PlanJsonOutput; integrity: FirstSessionAnchorIntegrityMetaV1 } {
  const { goldPathVector } = input;
  const templatesById = new Map(input.templatePool.map((t) => [t.id, t]));
  const segments = clonePlanSegments(input.plan.segments);
  const ctxBase: RepairS1Context = {
    goldPathVector,
    templatePool: input.templatePool,
    templatesById,
    excludeSet: input.excludeSet,
    painMode: input.painMode,
    maxDifficultyCap: input.maxDifficultyCap,
    maxLevel: input.maxLevel,
    toPlanItemCtx: input.toPlanItemCtx,
    sessionNumber: input.sessionNumber,
  };

  const getMain = () => segments.find((s) => s.title === 'Main');
  const asRows = (main: PlanSegment | undefined) =>
    (main?.items.map((i) => templatesById.get(i.templateId)).filter(Boolean) ?? []) as SessionTemplateRow[];

  const repairedIdList: string[] = [];
  const removedIdList: string[] = [];

  let used = collectUsedTemplateIdsFromSegments(segments);
  const mainEntry = getMain();
  if (!mainEntry) {
    return {
      plan: input.plan,
      integrity: {
        version: 'first_session_anchor_integrity_v1',
        gold_path_vector: goldPathVector,
        main_anchor_match_count: 0,
        main_support_match_count: 0,
        main_off_axis_count: 0,
        repaired: false,
      },
    };
  }

  /** S1 lower_stability: 상체만 Main 태그 → 제거 후 Accessory 허용 시 이동, 아니면 드랍 */
  if (input.sessionNumber === 1 && goldPathVector === 'lower_stability') {
    const MAX_S1_TOTAL_HEURISTIC = 6;
    const accessorySeg = segments.find((s) => s.title === 'Accessory');
    const nextMainItems: typeof mainEntry.items = [];
    const mainSeg = getMain()!;
    for (let idx = 0; idx < mainSeg.items.length; idx += 1) {
      const pi = mainSeg.items[idx]!;
      const row = templatesById.get(pi.templateId);
      if (row && isUpperOnlyMainOffAxisForLowerStability(row)) {
        removedIdList.push(pi.templateId);
        const accessoryDup = accessorySeg?.items.some((i) => i.templateId === pi.templateId);
        const canAccessory =
          accessorySeg &&
          !accessoryDup &&
          countPlanSegmentItems(segments) < MAX_S1_TOTAL_HEURISTIC;
        if (canAccessory) {
          accessorySeg!.items.push(
            toPlanItem(row, accessorySeg!.items.length + 1, 'Accessory', input.toPlanItemCtx)
          );
        }
        continue;
      }
      nextMainItems.push(pi);
    }
    mainSeg.items = nextMainItems.map((it, orderIdx) => ({ ...it, order: orderIdx + 1 }));
  }

  const pickMainReplaceIndex = (
    mainRows: SessionTemplateRow[],
    g: GoldPathVector
  ): number => {
    if (input.sessionNumber === 1 && g === 'lower_stability') {
      for (let i = 0; i < mainRows.length; i += 1) {
        if (isUpperOnlyMainOffAxisForLowerStability(mainRows[i]!)) return i;
      }
    }
    for (let i = 0; i < mainRows.length; i += 1) {
      if (isTargetOffAxisForGoldPath(mainRows[i]!, g)) return i;
    }
    for (let i = 0; i < mainRows.length; i += 1) {
      if (!isTargetAnchorVector(mainRows[i]!, g) && !isTargetSupportForGoldPath(mainRows[i]!, g)) return i;
    }
    for (let i = 0; i < mainRows.length; i += 1) {
      if (!isTargetAnchorVector(mainRows[i]!, g)) return i;
    }
    return 0;
  };

  /** S1 lower_stability: 풀에 하체 앵커 후보가 있으면 Main에 최소 1개 */
  if (input.sessionNumber === 1 && goldPathVector === 'lower_stability') {
    const poolEligible = input.templatePool.filter(
      (t) =>
        isRepairTemplateEligible(t, {
          sessionNumber: input.sessionNumber,
          excludeSet: input.excludeSet,
          painMode: input.painMode,
          maxLevel: input.maxLevel,
          maxDifficultyCap: input.maxDifficultyCap,
        }) &&
        isLowerStabilityMainAnchorCandidate(t) &&
        !isUpperOnlyMainOffAxisForLowerStability(t)
    );
    const mainSegEarly = getMain();
    const mainRowsNow = mainSegEarly ? asRows(mainSegEarly) : [];
    const hasLsAnchor = mainRowsNow.some((t) => isLowerStabilityMainAnchorCandidate(t));
    if (!hasLsAnchor && poolEligible.length > 0) {
      used = collectUsedTemplateIdsFromSegments(segments);
      let repl = findBestMainRepairFromPool(ctxBase, used, null, {
        requireLowerStabilityMainAnchor: true,
      });
      if (!repl) {
        const avail = poolEligible.filter((t) => !used.has(t.id));
        if (avail.length > 0) {
          avail.sort((a, b) => {
            const ds =
              scoreLowerStabilityS1MainRepairPriority(b) -
              scoreLowerStabilityS1MainRepairPriority(a);
            return ds !== 0 ? ds : a.id.localeCompare(b.id);
          });
          repl = avail[0]!;
        }
      }
      if (
        repl &&
        isLowerStabilityMainAnchorCandidate(repl) &&
        !isUpperOnlyMainOffAxisForLowerStability(repl) &&
        mainSegEarly
      ) {
        if (!mainRowsNow.length) {
          mainSegEarly.items = [toPlanItem(repl, 1, 'Main', input.toPlanItemCtx)];
          repairedIdList.push(repl.id);
        } else {
          const tryIdx = pickMainReplaceIndex(mainRowsNow, goldPathVector);
          removedIdList.push(mainSegEarly.items[tryIdx]!.templateId);
          mainSegEarly.items[tryIdx] = toPlanItem(repl, tryIdx + 1, 'Main', input.toPlanItemCtx);
          repairedIdList.push(repl.id);
        }
        used = collectUsedTemplateIdsFromSegments(segments);
      }
    }
  }

  const tryReplaceMainAt = (mainIndex: number, replacement: SessionTemplateRow): void => {
    const main = getMain()!;
    const old = main.items[mainIndex]!.templateId;
    removedIdList.push(old);
    repairedIdList.push(replacement.id);
    main.items[mainIndex] = toPlanItem(
      replacement,
      mainIndex + 1,
      'Main',
      input.toPlanItemCtx
    );
    used = collectUsedTemplateIdsFromSegments(segments);
  };

  for (let iter = 0; iter < 20; iter += 1) {
    const rows = asRows(getMain());
    if (rows.length === 0 || meetsS1MainAnchorContract(rows, goldPathVector)) break;
    const tryIdx = pickMainReplaceIndex(rows, goldPathVector);
    const usedForPick = new Set(used);
    const oldId = getMain()!.items[tryIdx]!.templateId;
    usedForPick.delete(oldId);
    const repl = findBestMainRepairFromPool(ctxBase, usedForPick, null);
    if (repl) {
      tryReplaceMainAt(tryIdx, repl);
      continue;
    }

    let swapped = false;
    for (const segTitle of ['Accessory', 'Prep', 'Cooldown'] as const) {
      if (swapped) break;
      const seg = segments.find((s) => s.title === segTitle);
      if (!seg) continue;
      for (let j = 0; j < seg.items.length; j += 1) {
        const oth = templatesById.get(seg.items[j]!.templateId);
        if (!oth) continue;
        if (!isRepairTemplateEligible(oth, { sessionNumber: input.sessionNumber, excludeSet: input.excludeSet, painMode: input.painMode, maxLevel: input.maxLevel, maxDifficultyCap: input.maxDifficultyCap })) {
          continue;
        }
        if (
          input.sessionNumber === 1 &&
          goldPathVector === 'lower_stability' &&
          isUpperOnlyMainOffAxisForLowerStability(oth)
        ) {
          continue;
        }
        if (scoreRepairTemplateForGold(oth, goldPathVector) < 200 && !isTargetAnchorVector(oth, goldPathVector)) {
          continue;
        }
        const badT = asRows(getMain())[tryIdx]!;
        if (!badT) break;
        tryReplaceMainAt(tryIdx, oth);
        seg.items[j] = toPlanItem(badT, j + 1, segTitle, input.toPlanItemCtx);
        swapped = true;
        break;
      }
    }
    if (!swapped) break;
  }

  const finalMainRows = asRows(getMain());
  const stats = countMainVectorStats(finalMainRows, goldPathVector);

  return {
    plan: {
      ...input.plan,
      segments,
      meta: {
        ...input.plan.meta,
        used_template_ids: Array.from(
          new Set(segments.flatMap((s) => s.items.map((i) => i.templateId)))
        ),
      },
    },
    integrity: {
      version: 'first_session_anchor_integrity_v1',
      gold_path_vector: goldPathVector,
      ...stats,
      repaired: repairedIdList.length > 0 || removedIdList.length > 0,
      ...(repairedIdList.length > 0 && { repaired_template_ids: repairedIdList }),
      ...(removedIdList.length > 0 && { removed_template_ids: removedIdList }),
    },
  };
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
  let templates = Array.isArray(input.templatePool) && input.templatePool.length > 0
    ? input.templatePool
    : await getTemplatesForSessionPlan({
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

  const tierSurvey = bumpFirstSessionTierForSurveyHints(
    adjustFirstSessionTierForOnboardingExperience(getFirstSessionTier(input), input),
    input.sessionNumber,
    surveySessionHints,
    hardDominated
  );
  const firstSessionTier = tierSurvey.tier;
  surveyHintTrace.push(...tierSurvey.trace);

  const advancedFirstSessionUplift = canApplyAdvancedFirstSessionUplift(
    input,
    firstSessionTier,
    maxDifficultyCap
  );
  if (advancedFirstSessionUplift) {
    const next = Math.min(maxLevel, Math.min(3, finalTargetLevel + 1));
    if (next > finalTargetLevel) {
      finalTargetLevel = next;
      surveyHintTrace.push('experience:advanced_target_level+1');
    }
    surveyHintTrace.push('experience:advanced_uplift_v1');
  }

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
    baselineSessionAnchor: input.baseline_session_anchor,
  });
  templates = applyTrunkCoreSession1TemplateProjection(templates, firstSessionIntent?.anchorType);

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

  let volumeModForMainCount = input.volumeModifier ?? 0;
  if (isFirstSession && surveySessionHints && !hardDominated) {
    const vol = surveyHintVolumeDelta(surveySessionHints, hardDominated, input.sessionNumber);
    volumeModForMainCount += vol.delta;
    volumeModForMainCount = Math.max(-0.45, volumeModForMainCount);
    surveyHintTrace.push(...vol.trace);
  }

  const firstSessionLimits =
    isFirstSession && advancedFirstSessionUplift
      ? { maxMain: 3, maxTotal: 6 }
      : FIRST_SESSION_LIMITS[firstSessionTier];
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
    advancedFirstSessionPrescriptionUplift: isFirstSession && advancedFirstSessionUplift,
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

  const surveyHintsObservability = buildSurveySessionHintsObservability({
    sessionNumber: input.sessionNumber,
    hints: surveySessionHints,
    pain_mode: input.pain_mode,
    safety_mode: input.safety_mode,
    flatTrace: surveyHintTrace,
    exercise_experience_level: input.exercise_experience_level,
    hasGoldPathVector: !!goldPathVector,
    session_camera_translation: input.session_camera_translation ?? null,
  });

  const basePlan: PlanJsonOutput = {
    version: 'session_plan_v1',
    meta: {
      session_number: input.sessionNumber,
      phase: input.phase,
      result_type: input.resultType ?? 'UNKNOWN',
      ...(input.confidence !== undefined && { confidence: input.confidence }),
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
      ...(isFirstSession && {
        survey_session_hints_observability: surveyHintsObservability,
        ...(surveyHintsObservability.rationale_tags.length > 0 && {
          survey_session_rationale_tags: surveyHintsObservability.rationale_tags,
        }),
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
        ...(isFirstSession && {
          survey_session_hints_present: surveyHintsObservability.present,
          survey_session_hints_eligible: surveyHintsObservability.eligible,
          survey_session_hints_applied: surveyHintsObservability.applied,
          survey_session_hints_blocked: surveyHintsObservability.blocked,
          survey_session_hints_blocked_by: surveyHintsObservability.blocked_by,
          ...(surveyHintsObservability.trace.length > 0 && {
            survey_session_hints_trace: [...surveyHintsObservability.trace],
          }),
        }),
      },
      policy_registry: {
        version: 'session_policy_registry_v1',
        selection_rule_ids: selectionResult.appliedRuleIds,
        excluded_count_by_rule: selectionResult.excludedCountByRule,
        taxonomy_mode: 'derived_v1',
      },
      candidate_competition: competitionResult.meta,
      ...(isFirstSession && {
        baseline_alignment: {
          baseline_session_anchor: input.baseline_session_anchor ?? null,
          first_session_intent_anchor: firstSessionIntent?.anchorType ?? null,
          gold_path_vector: goldPathVector ?? null,
          intent_source: input.baseline_session_anchor
            ? 'baseline_anchor' as const
            : firstSessionIntent
              ? 'legacy_band' as const
              : 'none' as const,
        },
      }),
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

  let planAfterOrdering = orderingResult.plan;
  let firstSessionAnchorIntegrity: FirstSessionAnchorIntegrityMetaV1 | undefined;
  if (isFirstSession && goldPathVector) {
    const r = repairFirstSessionMainAnchorIntegration({
      plan: orderingResult.plan,
      sessionNumber: input.sessionNumber,
      goldPathVector,
      templatePool: templates,
      maxLevel,
      excludeSet,
      painMode: input.pain_mode,
      maxDifficultyCap,
      toPlanItemCtx,
    });
    planAfterOrdering = r.plan;
    firstSessionAnchorIntegrity = r.integrity;
  }

  let planAfterS2S3 = planAfterOrdering;
  let sessionTypeContinuity: SessionTypeContinuityMetaV1 | undefined;
  if (input.sessionNumber === 2 || input.sessionNumber === 3) {
    const c = repairSession2PlusTypeContinuity({
      plan: planAfterOrdering,
      planInput: input,
      sessionNumber: input.sessionNumber,
      templatePool: templates,
      maxLevel,
      excludeSet,
      painMode: input.pain_mode,
      maxDifficultyCap,
      toPlanItemCtx,
    });
    planAfterS2S3 = c.plan;
    if (c.meta) sessionTypeContinuity = c.meta;
  }

  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const reconcileInput = {
    segments: planAfterS2S3.segments,
    templatesById,
    upstreamFocusAxes:
      effectiveFocusAxes.length > 0 ? effectiveFocusAxes : resolveSessionFocusAxes(input.priority_vector),
    upstreamRationale:
      effectiveRationale ?? resolveSessionRationale(input.priority_vector, input.pain_mode),
    sessionNumber: input.sessionNumber,
    phase: input.phase,
    painMode: input.pain_mode ?? null,
    priorityVector: input.priority_vector ?? null,
    primaryType: input.primary_type ?? null,
    resultType: input.resultType ?? null,
  };
  const reconcileOut = reconcileFinalPlanDisplayMeta(reconcileInput);

  let planAfterReconcile = planAfterS2S3;
  if (reconcileOut) {
    planAfterReconcile = {
      ...planAfterS2S3,
      meta: {
        ...planAfterS2S3.meta,
        ...(reconcileOut.session_focus_axes.length > 0 && {
          session_focus_axes: reconcileOut.session_focus_axes,
        }),
        ...(reconcileOut.session_rationale != null && {
          session_rationale: reconcileOut.session_rationale,
        }),
        ...reconcileOut.sessionDisplayFields,
        final_alignment_audit: reconcileOut.audit,
      },
    };
  }

  const auditResult = auditPlanQuality(planAfterReconcile, templates, {
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

  const prepCooldownAlignment = buildPrepCooldownAlignmentMeta(
    planAfterReconcile.segments,
    templatesById,
    goldPathVector
  );

  return {
    ...planAfterReconcile,
    meta: {
      ...planAfterReconcile.meta,
      ...(firstSessionAnchorIntegrity && {
        first_session_anchor_integrity: firstSessionAnchorIntegrity,
      }),
      ...(sessionTypeContinuity && { session_type_continuity: sessionTypeContinuity }),
      plan_quality_audit: auditResult,
      prep_cooldown_alignment: prepCooldownAlignment,
    },
  };
}
