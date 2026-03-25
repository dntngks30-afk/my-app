/**
 * PR-SURVEY-07 — 설문 baseline `survey_session_hints` + 카메라 refined evidence → 세션 1용 병합 정책
 * PR-CAM-01 — 병합 입력은 `CameraPlanningEvidenceTier`(none / limited / standard)로 정규화.
 *
 * - 설문 힌트가 baseline planning truth; 카메라는 독립 planner가 아님.
 * - `public_results.stage === 'refined'`일 때만 병합(그 외는 입력 그대로).
 * - 티어 none → 설문 주도(카메라 planning 영향 없음).
 * - 하드 가드는 plan-generator 측에서 기존대로 우선.
 */

import type { SurveySessionHints, UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';
import {
  inferCameraPassFromResult,
  resolveCameraPlanningTierForSessionMerge,
  type CameraPlanningEvidenceTier,
} from '@/lib/deep-v2/session/camera-planning-evidence-tier';

/** 카메라가 세션 힌트에 미치는 역할(내부·감사용) */
export type CameraSessionInfluenceLevel = 'none' | 'reinforce' | 'dampen' | 'caution_only';

export type SessionCameraTranslationMetaV1 = {
  schema_version: 'session_camera_translation_v1';
  refined_public_stage: true;
  /** PR-CAM-01: 세션 병합 정책이 사용하는 티어 */
  camera_planning_evidence_tier: CameraPlanningEvidenceTier;
  /** 어댑터 기준 분석 품질(감사·하위 호환; unknown 가능) */
  camera_evidence_quality: 'strong' | 'partial' | 'minimal' | 'unknown';
  camera_pass?: boolean;
  /** 티어 결정 근거(짧은 문자열) */
  tier_resolution_trace?: string[];
  influence_level: CameraSessionInfluenceLevel;
  merge_trace: string[];
  /** 카메라 병합으로 값이 바뀐 SurveySessionHints 필드 키 */
  changed_hint_fields_from_camera: string[];
};

function cloneHints(h: SurveySessionHints): SurveySessionHints {
  return {
    ...h,
    first_session_bias_tags: [...h.first_session_bias_tags],
  };
}

function addBiasTag(h: SurveySessionHints, tag: string): void {
  if (!h.first_session_bias_tags.includes(tag)) h.first_session_bias_tags.push(tag);
}

function bumpProgressionMoreCautious(h: SurveySessionHints): boolean {
  let changed = false;
  if (h.progression_confidence_hint === 'steady') {
    h.progression_confidence_hint = 'standard';
    changed = true;
  } else if (h.progression_confidence_hint === 'standard') {
    h.progression_confidence_hint = 'cautious';
    changed = true;
  }
  return changed;
}

function bumpVolumeMoreConservative(h: SurveySessionHints): boolean {
  let changed = false;
  if (h.volume_cap_hint === 'standard') {
    h.volume_cap_hint = 'reduced';
    changed = true;
  } else if (h.volume_cap_hint === 'reduced') {
    h.volume_cap_hint = 'minimal';
    changed = true;
  }
  return changed;
}

function bumpAsymmetryCaution(h: SurveySessionHints): boolean {
  let changed = false;
  if (h.asymmetry_caution_hint === 'none') {
    h.asymmetry_caution_hint = 'moderate';
    changed = true;
  } else if (h.asymmetry_caution_hint === 'moderate') {
    h.asymmetry_caution_hint = 'elevated';
    changed = true;
  }
  return changed;
}

function tightenIntro(h: SurveySessionHints): boolean {
  let changed = false;
  if (h.intro_tolerance_hint === 'open') {
    h.intro_tolerance_hint = 'standard';
    changed = true;
  } else if (h.intro_tolerance_hint === 'standard') {
    h.intro_tolerance_hint = 'guarded';
    changed = true;
  }
  return changed;
}

type Pv = Record<string, number>;

function readPv(v2: UnifiedDeepResultV2): Pv {
  if (!v2.priority_vector || typeof v2.priority_vector !== 'object') return {};
  return v2.priority_vector as Pv;
}

/**
 * refined 공개 결과 + 설문 힌트가 있을 때만 병합. baseline-only는 translationMeta null.
 */
export function mergeSurveyAndCameraSessionHintsForFirstSession(input: {
  baselineHints: SurveySessionHints;
  v2: UnifiedDeepResultV2;
  publicStage: 'baseline' | 'refined';
}): { mergedHints: SurveySessionHints; translationMeta: SessionCameraTranslationMetaV1 | null } {
  const { baselineHints, v2, publicStage } = input;

  if (publicStage !== 'refined') {
    return { mergedHints: baselineHints, translationMeta: null };
  }

  const resolved = resolveCameraPlanningTierForSessionMerge(v2);
  const { tier, legacy_analysis_quality, tier_resolution_trace } = resolved;
  const cameraPass = inferCameraPassFromResult(v2);
  const pv = readPv(v2);
  const asym = pv.asymmetry ?? 0;
  const lm = pv.lower_mobility ?? 0;
  const um = pv.upper_mobility ?? 0;
  const mobilityAvg = (lm + um) / 2;

  const merge_trace: string[] = [
    'camera:refined_stage_merge_entry',
    ...tier_resolution_trace,
    `camera:planning_tier_${tier}`,
  ];
  const changed_fields: string[] = [];

  if (tier === 'none') {
    merge_trace.push('camera:planning_tier_none_survey_led');
    return {
      mergedHints: cloneHints(baselineHints),
      translationMeta: {
        schema_version: 'session_camera_translation_v1',
        refined_public_stage: true,
        camera_planning_evidence_tier: tier,
        camera_evidence_quality: legacy_analysis_quality,
        camera_pass: cameraPass,
        tier_resolution_trace,
        influence_level: 'none',
        merge_trace,
        changed_hint_fields_from_camera: [],
      },
    };
  }

  const merged = cloneHints(baselineHints);
  let influence: CameraSessionInfluenceLevel = 'dampen';

  const asymThresholdStandard = 0.18;
  const asymThresholdLimited = 0.22;
  const asymNeed =
    tier === 'standard' ? asym >= asymThresholdStandard : asym >= asymThresholdLimited;
  if (asymNeed && bumpAsymmetryCaution(merged)) {
    changed_fields.push('asymmetry_caution_hint');
    merge_trace.push(`camera:asymmetry_pv_${tier}`);
  }

  if (tier === 'limited') {
    if (cameraPass === false) {
      influence = 'caution_only';
      merge_trace.push('camera:limited_pass_false_caution');
      if (bumpProgressionMoreCautious(merged)) {
        changed_fields.push('progression_confidence_hint');
      }
      if (tightenIntro(merged)) {
        changed_fields.push('intro_tolerance_hint');
      }
      if (bumpVolumeMoreConservative(merged)) {
        changed_fields.push('volume_cap_hint');
      }
    } else {
      influence = 'dampen';
      merge_trace.push('camera:limited_default_dampen');
      if (merged.progression_confidence_hint !== 'cautious' && bumpProgressionMoreCautious(merged)) {
        changed_fields.push('progression_confidence_hint');
      }
    }

    if (
      merged.movement_preference_hint === 'mixed' &&
      mobilityAvg >= 0.28 &&
      lm + um > 0 &&
      cameraPass !== false
    ) {
      merged.movement_preference_hint = 'mobility_first';
      changed_fields.push('movement_preference_hint');
      merge_trace.push('camera:limited_mobility_from_pv');
      if (influence === 'dampen') influence = 'reinforce';
    }

    addBiasTag(merged, 'camera_limited_session_translation');
  }

  if (tier === 'standard') {
    merge_trace.push('camera:standard_tier_policy');
    if (merged.progression_confidence_hint !== 'cautious' && bumpProgressionMoreCautious(merged)) {
      if (!changed_fields.includes('progression_confidence_hint')) {
        changed_fields.push('progression_confidence_hint');
      }
      merge_trace.push('camera:standard_progression_dampen');
    }
    influence = 'dampen';

    if (
      cameraPass !== false &&
      merged.movement_preference_hint === 'mobility_first' &&
      mobilityAvg >= 0.25
    ) {
      addBiasTag(merged, 'camera_aligned_mobility_reinforced');
      merge_trace.push('camera:standard_reinforce_mobility_alignment');
      influence = 'reinforce';
    } else if (
      merged.movement_preference_hint === 'mixed' &&
      mobilityAvg >= 0.3 &&
      cameraPass !== false
    ) {
      merged.movement_preference_hint = 'mobility_first';
      if (!changed_fields.includes('movement_preference_hint')) {
        changed_fields.push('movement_preference_hint');
      }
      addBiasTag(merged, 'camera_standard_mobility_from_pv');
      merge_trace.push('camera:standard_mixed_to_mobility_first');
      influence = 'reinforce';
    }

    if (cameraPass === false) {
      influence = 'caution_only';
      merge_trace.push('camera:standard_pass_false_caution');
      if (bumpVolumeMoreConservative(merged) && !changed_fields.includes('volume_cap_hint')) {
        changed_fields.push('volume_cap_hint');
      }
      if (tightenIntro(merged) && !changed_fields.includes('intro_tolerance_hint')) {
        changed_fields.push('intro_tolerance_hint');
      }
    }

    addBiasTag(merged, 'camera_standard_session_translation');
  }

  return {
    mergedHints: merged,
    translationMeta: {
      schema_version: 'session_camera_translation_v1',
      refined_public_stage: true,
      camera_planning_evidence_tier: tier,
      camera_evidence_quality: legacy_analysis_quality,
      camera_pass: cameraPass,
      tier_resolution_trace,
      influence_level: influence,
      merge_trace,
      changed_hint_fields_from_camera: [...new Set(changed_fields)],
    },
  };
}
