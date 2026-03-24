/**
 * PR-SURVEY-04 — 설문 baseline 해석 → 첫 세션용 내부 힌트
 *
 * primary/secondary·priority·통증·decond 해석·reason_codes만 사용.
 * session-create 본문은 이 PR에서 수정하지 않음(힌트 생성·저장만).
 */

import type { DeconditionedInterpretation } from '@/lib/deep-scoring-core/types';
import type {
  EvidenceLevel,
  PainMode,
  SurveySessionAsymmetryCautionHint,
  SurveySessionConservativenessLevel,
  SurveySessionDeconditionedSupportHint,
  SurveySessionHints,
  SurveySessionIntroToleranceHint,
  SurveySessionMovementPreferenceHint,
  SurveySessionProgressionConfidenceHint,
  SurveySessionVolumeCapHint,
  UnifiedPrimaryType,
  UnifiedSecondaryType,
} from '@/lib/result/deep-result-v2-contract';

export type DeriveSurveySessionHintsInput = {
  primary_type: UnifiedPrimaryType;
  secondary_type: UnifiedSecondaryType;
  priority_vector: Record<string, number>;
  pain_mode: PainMode | null;
  deconditioned_interpretation: DeconditionedInterpretation;
  reason_codes: readonly string[];
  evidence_level: EvidenceLevel;
  confidence: number;
};

const CON_RANK: Record<SurveySessionConservativenessLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
};

const INTRO_RANK: Record<SurveySessionIntroToleranceHint, number> = {
  open: 0,
  standard: 1,
  guarded: 2,
};

const VOL_RANK: Record<SurveySessionVolumeCapHint, number> = {
  standard: 0,
  reduced: 1,
  minimal: 2,
};

const PROG_RANK: Record<SurveySessionProgressionConfidenceHint, number> = {
  cautious: 0,
  standard: 1,
  steady: 2,
};

function maxCons(
  a: SurveySessionConservativenessLevel,
  b: SurveySessionConservativenessLevel
): SurveySessionConservativenessLevel {
  return CON_RANK[a] >= CON_RANK[b] ? a : b;
}

function maxGuarded(
  a: SurveySessionIntroToleranceHint,
  b: SurveySessionIntroToleranceHint
): SurveySessionIntroToleranceHint {
  return INTRO_RANK[a] >= INTRO_RANK[b] ? a : b;
}

function maxVolRestrict(
  a: SurveySessionVolumeCapHint,
  b: SurveySessionVolumeCapHint
): SurveySessionVolumeCapHint {
  return VOL_RANK[a] >= VOL_RANK[b] ? a : b;
}

/** 더 보수적인(진행 신뢰 낮은) 쪽 */
function minProgression(
  a: SurveySessionProgressionConfidenceHint,
  b: SurveySessionProgressionConfidenceHint
): SurveySessionProgressionConfidenceHint {
  return PROG_RANK[a] <= PROG_RANK[b] ? a : b;
}

function maxDecondSupport(
  a: SurveySessionDeconditionedSupportHint,
  b: SurveySessionDeconditionedSupportHint
): SurveySessionDeconditionedSupportHint {
  const o = { none: 0, light: 1, strong: 2 };
  return o[a] >= o[b] ? a : b;
}

function maxAsymCaution(
  a: SurveySessionAsymmetryCautionHint,
  b: SurveySessionAsymmetryCautionHint
): SurveySessionAsymmetryCautionHint {
  const o = { none: 0, moderate: 1, elevated: 2 };
  return o[a] >= o[b] ? a : b;
}

function pvGet(pv: Record<string, number>, k: string): number {
  const v = pv[k];
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

function movementPreferenceFromSignals(
  primary: UnifiedPrimaryType,
  pv: Record<string, number>
): SurveySessionMovementPreferenceHint {
  const upper = pvGet(pv, 'upper_mobility');
  const lowerM = pvGet(pv, 'lower_mobility');
  const trunk = pvGet(pv, 'trunk_control');
  const lowS = pvGet(pv, 'lower_stability');
  const asym = pvGet(pv, 'asymmetry');
  const mobilityScore = Math.max(upper, lowerM);
  const controlScore = Math.max(trunk, lowS, asym * 0.55);

  if (primary === 'LOWER_MOBILITY_RESTRICTION' || primary === 'UPPER_IMMOBILITY') {
    return 'mobility_first';
  }
  if (primary === 'LOWER_INSTABILITY' || primary === 'CORE_CONTROL_DEFICIT') {
    return 'control_first';
  }
  if (primary === 'DECONDITIONED' || primary === 'STABLE' || primary === 'UNKNOWN') {
    if (mobilityScore > controlScore + 0.12) return 'mobility_first';
    if (controlScore > mobilityScore + 0.12) return 'control_first';
    return 'mixed';
  }
  return 'mixed';
}

function asymmetryHintFromSignals(
  pv: Record<string, number>,
  reason_codes: readonly string[]
): SurveySessionAsymmetryCautionHint {
  const a = pvGet(pv, 'asymmetry');
  let h: SurveySessionAsymmetryCautionHint = 'none';
  if (a >= 0.42) h = 'elevated';
  else if (a >= 0.26) h = 'moderate';

  if (reason_codes.some((c) => c.includes('interaction_survey02_rule_c_asymmetry_stack'))) {
    h = maxAsymCaution(h, 'moderate');
  }
  return h;
}

/**
 * 설문 baseline Unified/core 산출물로부터 세션 힌트 1객체 생성.
 */
export function deriveSurveySessionHints(
  input: DeriveSurveySessionHintsInput
): SurveySessionHints {
  const {
    primary_type,
    pain_mode,
    deconditioned_interpretation,
    reason_codes,
    evidence_level,
    confidence,
    priority_vector: pv,
  } = input;

  let conserv: SurveySessionConservativenessLevel = 'moderate';
  let intro: SurveySessionIntroToleranceHint = 'standard';
  let volume: SurveySessionVolumeCapHint = 'standard';
  let progression: SurveySessionProgressionConfidenceHint = 'standard';
  let decondSup: SurveySessionDeconditionedSupportHint = 'none';
  const tags: string[] = [];

  const movement_pref = movementPreferenceFromSignals(primary_type, pv);
  let asym = asymmetryHintFromSignals(pv, reason_codes);

  if (primary_type === 'STABLE' && confidence >= 0.55) {
    conserv = 'low';
    intro = 'open';
    progression = 'steady';
  }

  if (evidence_level === 'lite' || confidence < 0.42) {
    conserv = maxCons(conserv, 'moderate');
    intro = maxGuarded(intro, 'guarded');
    progression = minProgression(progression, 'cautious');
    tags.push('lite_evidence_or_low_confidence');
  }

  if (pain_mode === 'protected') {
    conserv = 'high';
    intro = 'guarded';
    volume = 'minimal';
    progression = 'cautious';
    tags.push('pain_protected_session_bias');
  } else if (pain_mode === 'caution') {
    conserv = maxCons(conserv, 'moderate');
    intro = maxGuarded(intro, 'standard');
    progression = minProgression(progression, 'cautious');
    tags.push('pain_caution_session_bias');
  }

  switch (deconditioned_interpretation) {
    case 'broad':
      decondSup = maxDecondSupport(decondSup, 'strong');
      conserv = maxCons(conserv, 'high');
      intro = maxGuarded(intro, 'guarded');
      volume = maxVolRestrict(volume, 'reduced');
      progression = minProgression(progression, 'cautious');
      tags.push('decond_shape_broad');
      break;
    case 'hybrid':
      decondSup = maxDecondSupport(decondSup, 'light');
      conserv = maxCons(conserv, 'moderate');
      volume = maxVolRestrict(volume, 'reduced');
      progression = minProgression(progression, 'standard');
      tags.push('decond_shape_hybrid');
      break;
    case 'low_confidence':
      decondSup = maxDecondSupport(decondSup, 'light');
      progression = minProgression(progression, 'cautious');
      tags.push('decond_shape_low_confidence');
      break;
    default:
      break;
  }

  if (primary_type === 'DECONDITIONED') {
    decondSup = maxDecondSupport(decondSup, 'strong');
    conserv = maxCons(conserv, 'high');
    intro = maxGuarded(intro, 'guarded');
    volume = maxVolRestrict(volume, 'reduced');
    progression = minProgression(progression, 'cautious');
    tags.push('primary_deconditioned');
  }

  const dPv = pvGet(pv, 'deconditioned');
  if (deconditioned_interpretation === 'none' && dPv >= 0.55 && primary_type !== 'DECONDITIONED') {
    decondSup = maxDecondSupport(decondSup, 'light');
  }

  if (asym === 'elevated') {
    conserv = maxCons(conserv, 'moderate');
    volume = maxVolRestrict(volume, 'reduced');
    tags.push('asymmetry_elevated_session');
  } else if (asym === 'moderate') {
    tags.push('asymmetry_moderate_session');
  }

  if (reason_codes.some((c) => c.startsWith('interaction_'))) {
    tags.push('survey_interaction_rules_applied');
  }

  return {
    schema_version: 'survey_session_hints_v1',
    intro_tolerance_hint: intro,
    first_session_conservativeness: conserv,
    movement_preference_hint: movement_pref,
    asymmetry_caution_hint: asym,
    deconditioned_support_hint: decondSup,
    volume_cap_hint: volume,
    progression_confidence_hint: progression,
    first_session_bias_tags: [...new Set(tags)],
  };
}
