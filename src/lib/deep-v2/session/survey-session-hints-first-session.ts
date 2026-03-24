/**
 * PR-SURVEY-05 — 설문 baseline `_compat.survey_session_hints` → 세션 1 plan-generator 보수적 bias
 *
 * - pain_mode protected / safety red 아래에서는 힌트를 적용하지 않는다 (하드 가드 우선).
 * - 세션 번호 1이 아니면 전부 no-op.
 * - 효과는 티어·볼륨·난이도 캡·타깃 레벨·골드패스 스코어 미세 조정 수준으로 제한한다.
 */

import type { SurveySessionHints } from '@/lib/result/deep-result-v2-contract';

export type FirstSessionTierId = 'conservative' | 'moderate' | 'normal';

/** 런타임에 손상된 payload가 들어와도 plan 생성을 깨지 않도록 최소 형태만 검사 */
export function isUsableSurveySessionHints(raw: unknown): raw is SurveySessionHints {
  if (!raw || typeof raw !== 'object') return false;
  const h = raw as Record<string, unknown>;
  if (h.schema_version !== 'survey_session_hints_v1') return false;
  return (
    typeof h.intro_tolerance_hint === 'string' &&
    typeof h.first_session_conservativeness === 'string' &&
    typeof h.movement_preference_hint === 'string' &&
    typeof h.asymmetry_caution_hint === 'string' &&
    typeof h.deconditioned_support_hint === 'string' &&
    typeof h.volume_cap_hint === 'string' &&
    typeof h.progression_confidence_hint === 'string' &&
    Array.isArray(h.first_session_bias_tags)
  );
}

export function surveyHintsDominatedByHardGuardrails(input: {
  pain_mode?: 'none' | 'caution' | 'protected';
  safety_mode?: 'red' | 'yellow' | 'none';
}): boolean {
  return input.pain_mode === 'protected' || input.safety_mode === 'red';
}

/**
 * 온보딩·pain/safety 이후 티어에 한 단계만 추가 보수화 (normal→moderate→conservative).
 */
export function bumpFirstSessionTierForSurveyHints(
  tier: FirstSessionTierId,
  sessionNumber: number,
  hints: SurveySessionHints | undefined,
  hardDominated: boolean
): { tier: FirstSessionTierId; trace: string[] } {
  const trace: string[] = [];
  if (sessionNumber !== 1 || !hints || hardDominated) return { tier, trace };

  let bump = false;
  if (hints.first_session_conservativeness === 'high') {
    bump = true;
    trace.push('tier:first_session_conservativeness_high');
  }
  if (hints.volume_cap_hint === 'minimal') {
    bump = true;
    trace.push('tier:volume_cap_minimal');
  }
  if (hints.volume_cap_hint === 'reduced' && hints.progression_confidence_hint === 'cautious') {
    bump = true;
    trace.push('tier:volume_reduced_and_progression_cautious');
  }
  if (
    hints.intro_tolerance_hint === 'guarded' &&
    (hints.progression_confidence_hint === 'cautious' || hints.first_session_conservativeness === 'high')
  ) {
    bump = true;
    trace.push('tier:intro_guarded_and_cautious_or_high_cons');
  }
  if (hints.deconditioned_support_hint === 'strong' && hints.first_session_conservativeness !== 'low') {
    bump = true;
    trace.push('tier:deconditioned_strong_cons_not_low');
  }

  if (!bump) return { tier, trace };
  if (tier === 'normal') return { tier: 'moderate', trace };
  if (tier === 'moderate') return { tier: 'conservative', trace };
  return { tier: 'conservative', trace };
}

/** mainCount용 volumeModifier에 더할 음수(힌트만, 상한 클램프는 호출측) */
export function surveyHintVolumeDelta(
  hints: SurveySessionHints,
  hardDominated: boolean,
  sessionNumber: number
): { delta: number; trace: string[] } {
  const trace: string[] = [];
  if (sessionNumber !== 1 || hardDominated) return { delta: 0, trace };

  let delta = 0;
  if (hints.volume_cap_hint === 'minimal') {
    delta -= 0.12;
    trace.push('volume:cap_minimal');
  } else if (hints.volume_cap_hint === 'reduced') {
    delta -= 0.06;
    trace.push('volume:cap_reduced');
  }
  if (hints.deconditioned_support_hint === 'strong') {
    delta -= 0.04;
    trace.push('volume:deconditioned_support_strong');
  }
  delta = Math.max(-0.18, delta);
  return { delta, trace };
}

/**
 * adaptiveOverlay.maxDifficultyCap과 병합: 더 엄격한 쪽을 유지.
 * 힌트는 high→medium 정도의 보수 캡만 제안한다.
 */
export function mergeSurveyHintMaxDifficultyCap(
  existing: 'low' | 'medium' | 'high' | undefined,
  hints: SurveySessionHints | undefined,
  hardDominated: boolean,
  sessionNumber: number
): { cap: 'low' | 'medium' | 'high' | undefined; trace: string[] } {
  const trace: string[] = [];
  if (sessionNumber !== 1 || !hints || hardDominated) return { cap: existing, trace };

  let wantMedium = false;
  if (hints.intro_tolerance_hint === 'guarded') {
    wantMedium = true;
    trace.push('difficulty_cap:intro_guarded');
  }
  if (hints.progression_confidence_hint === 'cautious' && hints.first_session_conservativeness !== 'low') {
    wantMedium = true;
    trace.push('difficulty_cap:progression_cautious_cons_not_low');
  }

  if (!wantMedium) return { cap: existing, trace };

  if (!existing || existing === 'high') return { cap: 'medium', trace };
  return { cap: existing, trace };
}

/** intro guarded일 때 maxLevel·finalTargetLevel 상한을 2로 한 번 더 조인트 (safety가 이미 더 낮으면 유지) */
export function clampTargetLevelForSurveyIntro(
  finalTargetLevel: number,
  maxLevel: number,
  hints: SurveySessionHints | undefined,
  sessionNumber: number,
  hardDominated: boolean
): { finalTargetLevel: number; maxLevel: number; trace: string[] } {
  const trace: string[] = [];
  if (sessionNumber !== 1 || !hints || hardDominated) {
    return { finalTargetLevel, maxLevel, trace };
  }
  if (hints.intro_tolerance_hint !== 'guarded') {
    return { finalTargetLevel, maxLevel, trace };
  }
  const nextMax = Math.min(maxLevel, 2);
  trace.push('target_level:intro_guarded_max2');
  return {
    maxLevel: nextMax,
    finalTargetLevel: Math.min(finalTargetLevel, nextMax),
    trace,
  };
}

const MOBILITY_PREP_TAGS = new Set([
  'thoracic_mobility',
  'shoulder_mobility',
  'hip_mobility',
  'ankle_mobility',
  'hip_flexor_stretch',
  'neck_mobility',
]);

/**
 * 골드패스 세그먼트 스코어에만 가산(프렙 취향·비대칭 과진행 억제).
 */
export function surveyHintGoldPathSegmentScoreAdjust(
  hints: SurveySessionHints | undefined,
  sessionNumber: number,
  ruleKind: 'prep' | 'main' | 'accessory' | 'cooldown',
  template: { focus_tags: string[]; progression_level?: number | null },
  hardDominated: boolean
): number {
  if (sessionNumber !== 1 || !hints || hardDominated) return 0;

  let adj = 0;
  if (ruleKind === 'prep' && hints.movement_preference_hint === 'mobility_first') {
    if (template.focus_tags.some((t) => MOBILITY_PREP_TAGS.has(t))) adj += 2;
  }
  if (ruleKind === 'prep' && hints.movement_preference_hint === 'control_first') {
    if (template.focus_tags.includes('core_control')) adj += 2;
  }
  if (ruleKind === 'main' && hints.asymmetry_caution_hint === 'elevated') {
    const prog = template.progression_level ?? 1;
    if (prog >= 3) adj -= 5;
    else if (prog >= 2) adj -= 2;
  }
  return adj;
}

// ─── PR-SURVEY-06: observability / explainability (no new plan logic) ─────────

/** 하드 가드 또는 세션 번호로 설문 힌트가 적용되지 않는 이유 */
export type SurveySessionHintBlockedBy = 'pain_protected' | 'safety_red' | 'session_not_1' | null;

/** flat trace 문자열(prefix)에서 역추적한 변경 축 */
export type SurveySessionHintChangedField =
  | 'first_session_tier'
  | 'volume_modifier'
  | 'max_difficulty_cap'
  | 'target_level'
  | 'gold_path_scoring';

const CONSIDERED_HINT_AXES = [
  'intro_tolerance',
  'first_session_conservativeness',
  'movement_preference',
  'asymmetry_caution',
  'deconditioned_support',
  'volume_cap',
  'progression_confidence',
] as const;

export type SurveyHintsPrecedence =
  | 'no_hints'
  | 'hard_guard_blocks_survey'
  | 'eligible_no_survey_effect'
  | 'survey_after_beginner_tier'
  | 'survey_hints_applied';

export type SurveySessionHintsObservabilityV1 = {
  schema_version: 'survey_session_hints_obs_v1';
  present: boolean;
  eligible: boolean;
  applied: boolean;
  blocked: boolean;
  blocked_by: SurveySessionHintBlockedBy;
  precedence: SurveyHintsPrecedence;
  /** 세션 1에서 힌트 객체가 평가 대상이었을 때 축 목록(하드 가드 시에도 동일 — 읽혔으나 적용 안 됨) */
  considered_hint_axes: string[];
  changed_fields: SurveySessionHintChangedField[];
  /** UI 카피용 아님: 디버그·감사·분석용 짧은 태그 */
  rationale_tags: string[];
  trace: string[];
  /** 온보딩 beginner 티어 조정이 설문 티어 bump보다 먼저 적용됨 (순서 설명) */
  beginner_guardrail_before_survey_tier: boolean;
};

export function resolveSurveyHintBlockedBy(
  sessionNumber: number,
  hints: SurveySessionHints | undefined,
  pain_mode?: 'none' | 'caution' | 'protected',
  safety_mode?: 'red' | 'yellow' | 'none'
): SurveySessionHintBlockedBy {
  if (!hints) return null;
  if (sessionNumber !== 1) return 'session_not_1';
  if (pain_mode === 'protected') return 'pain_protected';
  if (safety_mode === 'red') return 'safety_red';
  return null;
}

export function classifySurveyHintChangedFields(flatTrace: string[]): SurveySessionHintChangedField[] {
  const out = new Set<SurveySessionHintChangedField>();
  for (const t of flatTrace) {
    if (t.startsWith('tier:')) out.add('first_session_tier');
    if (t.startsWith('volume:')) out.add('volume_modifier');
    if (t.startsWith('difficulty_cap:')) out.add('max_difficulty_cap');
    if (t.startsWith('target_level:')) out.add('target_level');
    if (t === 'selection:survey_gold_path_bias') out.add('gold_path_scoring');
  }
  return [...out];
}

function deriveSurveyRationaleTags(
  hints: SurveySessionHints,
  ctx: {
    applied: boolean;
    blocked_by: SurveySessionHintBlockedBy;
    hasGoldPathVector: boolean;
    changed_fields: SurveySessionHintChangedField[];
  }
): string[] {
  if (!ctx.applied || ctx.blocked_by) return [];
  const tags: string[] = [];
  const { hasGoldPathVector } = ctx;
  const cf = ctx.changed_fields;

  if (hints.movement_preference_hint === 'mobility_first' && hasGoldPathVector) {
    tags.push('survey_bias_mobility_first');
  }
  if (hints.movement_preference_hint === 'control_first' && hasGoldPathVector) {
    tags.push('survey_bias_control_first');
  }
  if (hints.asymmetry_caution_hint === 'elevated' && hasGoldPathVector) {
    tags.push('survey_bias_asymmetry_caution');
  }
  if (
    hints.deconditioned_support_hint === 'strong' &&
    (cf.includes('first_session_tier') || cf.includes('volume_modifier'))
  ) {
    tags.push('survey_bias_broad_deconditioned');
  }
  if (
    hints.progression_confidence_hint === 'cautious' &&
    (cf.includes('max_difficulty_cap') ||
      cf.includes('first_session_tier') ||
      cf.includes('target_level'))
  ) {
    tags.push('survey_bias_low_progression_confidence');
  }
  return tags;
}

function resolveSurveyHintsPrecedence(
  present: boolean,
  eligible: boolean,
  blocked_by: SurveySessionHintBlockedBy,
  applied: boolean,
  exercise_experience_level: 'beginner' | 'intermediate' | 'advanced' | undefined
): SurveyHintsPrecedence {
  if (!present) return 'no_hints';
  if (!eligible) return 'no_hints';
  if (blocked_by === 'pain_protected' || blocked_by === 'safety_red') return 'hard_guard_blocks_survey';
  if (!applied) return 'eligible_no_survey_effect';
  if (exercise_experience_level === 'beginner') return 'survey_after_beginner_tier';
  return 'survey_hints_applied';
}

/**
 * PR-SURVEY-05 trace 문자열을 구조화해 present / eligible / applied / blocked / precedence를 분리한다.
 * plan 로직은 변경하지 않는다.
 */
export function buildSurveySessionHintsObservability(input: {
  sessionNumber: number;
  hints: SurveySessionHints | undefined;
  pain_mode?: 'none' | 'caution' | 'protected';
  safety_mode?: 'red' | 'yellow' | 'none';
  flatTrace: string[];
  exercise_experience_level?: 'beginner' | 'intermediate' | 'advanced';
  hasGoldPathVector: boolean;
}): SurveySessionHintsObservabilityV1 {
  const present = !!input.hints;
  const eligible = present && input.sessionNumber === 1;
  const blocked_by = resolveSurveyHintBlockedBy(
    input.sessionNumber,
    input.hints,
    input.pain_mode,
    input.safety_mode
  );
  const blocked = blocked_by !== null;
  const trace = [...input.flatTrace];
  const applied = eligible && !blocked && trace.length > 0;
  const considered_hint_axes =
    eligible && input.hints ? [...CONSIDERED_HINT_AXES] : [];
  const changed_fields = classifySurveyHintChangedFields(trace);
  const beginner_guardrail_before_survey_tier =
    input.sessionNumber === 1 && input.exercise_experience_level === 'beginner';

  const rationale_tags =
    input.hints && applied
      ? deriveSurveyRationaleTags(input.hints, {
          applied,
          blocked_by,
          hasGoldPathVector: input.hasGoldPathVector,
          changed_fields,
        })
      : [];

  const precedence = resolveSurveyHintsPrecedence(
    present,
    eligible,
    blocked_by,
    applied,
    input.exercise_experience_level
  );

  return {
    schema_version: 'survey_session_hints_obs_v1',
    present,
    eligible,
    applied,
    blocked,
    blocked_by,
    precedence,
    considered_hint_axes,
    changed_fields,
    rationale_tags,
    trace,
    beginner_guardrail_before_survey_tier,
  };
}
