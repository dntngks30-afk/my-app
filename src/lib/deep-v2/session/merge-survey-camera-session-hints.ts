/**
 * PR-SURVEY-07 — 설문 baseline `survey_session_hints` + 카메라 refined evidence → 세션 1용 병합 정책
 *
 * - 설문 힌트가 baseline planning truth; 카메라는 독립 planner가 아님.
 * - `public_results.stage === 'refined'`일 때만 병합(그 외는 입력 그대로).
 * - 약한 카메라 신호(minimal/unknown)는 설문主導 유지.
 * - 하드 가드는 plan-generator 측에서 기존대로 우선(본 파일은 힌트 값만 조정).
 */

import type { SurveySessionHints, UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

/** 카메라가 세션 힌트에 미치는 역할(내부·감사용) */
export type CameraSessionInfluenceLevel = 'none' | 'reinforce' | 'dampen' | 'caution_only';

export type SessionCameraTranslationMetaV1 = {
  schema_version: 'session_camera_translation_v1';
  refined_public_stage: true;
  camera_evidence_quality: 'strong' | 'partial' | 'minimal' | 'unknown';
  camera_pass?: boolean;
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

/** `_compat` 또는 reason_codes 기반 역추적(구버전 refined payload 호환) */
export function inferCameraEvidenceQualityForSessionPolicy(
  v2: UnifiedDeepResultV2
): 'strong' | 'partial' | 'minimal' | 'unknown' {
  const compat = v2._compat as { camera_evidence_quality?: string } | undefined;
  const q = compat?.camera_evidence_quality;
  if (q === 'strong' || q === 'partial' || q === 'minimal') return q;
  if (v2.reason_codes?.includes('camera_evidence_partial')) return 'partial';
  if (v2.source_mode === 'camera' && v2.evidence_level === 'lite') return 'minimal';
  if (v2.source_mode === 'camera') return 'strong';
  return 'unknown';
}

export function inferCameraPassFromResult(v2: UnifiedDeepResultV2): boolean | undefined {
  const compat = v2._compat as { camera_pass?: boolean } | undefined;
  return typeof compat?.camera_pass === 'boolean' ? compat.camera_pass : undefined;
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

  const quality = inferCameraEvidenceQualityForSessionPolicy(v2);
  const cameraPass = inferCameraPassFromResult(v2);
  const pv = readPv(v2);
  const asym = pv.asymmetry ?? 0;
  const lm = pv.lower_mobility ?? 0;
  const um = pv.upper_mobility ?? 0;
  const mobilityAvg = (lm + um) / 2;

  const merge_trace: string[] = ['camera:refined_stage_merge_entry'];
  const changed_fields: string[] = [];

  if (quality === 'minimal' || quality === 'unknown') {
    merge_trace.push(
      quality === 'unknown'
        ? 'camera:quality_unknown_survey_led'
        : 'camera:quality_minimal_survey_led'
    );
    return {
      mergedHints: cloneHints(baselineHints),
      translationMeta: {
        schema_version: 'session_camera_translation_v1',
        refined_public_stage: true,
        camera_evidence_quality: quality,
        camera_pass: cameraPass,
        influence_level: 'none',
        merge_trace,
        changed_hint_fields_from_camera: [],
      },
    };
  }

  const merged = cloneHints(baselineHints);
  let influence: CameraSessionInfluenceLevel = 'dampen';

  // ── 공통: 융합 priority_vector 기반 비대칭 (partial 이상에서만 의미 있게) ──
  const asymThresholdPartial = 0.22;
  const asymThresholdStrong = 0.18;
  const asymNeed =
    quality === 'strong' ? asym >= asymThresholdStrong : asym >= asymThresholdPartial;
  if (asymNeed && bumpAsymmetryCaution(merged)) {
    changed_fields.push('asymmetry_caution_hint');
    merge_trace.push(`camera:asymmetry_pv_${quality}`);
  }

  if (quality === 'partial') {
    if (cameraPass === false) {
      influence = 'caution_only';
      merge_trace.push('camera:partial_pass_false_caution');
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
      merge_trace.push('camera:partial_default_dampen');
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
      merge_trace.push('camera:partial_mobility_from_pv');
      if (influence === 'dampen') influence = 'reinforce';
    }

    addBiasTag(merged, 'camera_partial_session_translation');
  }

  if (quality === 'strong') {
    merge_trace.push('camera:strong_policy');
    if (merged.progression_confidence_hint !== 'cautious' && bumpProgressionMoreCautious(merged)) {
      if (!changed_fields.includes('progression_confidence_hint')) {
        changed_fields.push('progression_confidence_hint');
      }
      merge_trace.push('camera:strong_progression_dampen');
    }
    influence = 'dampen';

    if (
      cameraPass !== false &&
      merged.movement_preference_hint === 'mobility_first' &&
      mobilityAvg >= 0.25
    ) {
      addBiasTag(merged, 'camera_aligned_mobility_reinforced');
      merge_trace.push('camera:strong_reinforce_mobility_alignment');
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
      addBiasTag(merged, 'camera_strong_mobility_from_pv');
      merge_trace.push('camera:strong_mixed_to_mobility_first');
      influence = 'reinforce';
    }

    if (cameraPass === false) {
      influence = 'caution_only';
      merge_trace.push('camera:strong_pass_false_caution');
      if (bumpVolumeMoreConservative(merged) && !changed_fields.includes('volume_cap_hint')) {
        changed_fields.push('volume_cap_hint');
      }
      if (tightenIntro(merged) && !changed_fields.includes('intro_tolerance_hint')) {
        changed_fields.push('intro_tolerance_hint');
      }
    }

    addBiasTag(merged, 'camera_strong_session_translation');
  }

  return {
    mergedHints: merged,
    translationMeta: {
      schema_version: 'session_camera_translation_v1',
      refined_public_stage: true,
      camera_evidence_quality: quality,
      camera_pass: cameraPass,
      influence_level: influence,
      merge_trace,
      changed_hint_fields_from_camera: [...new Set(changed_fields)],
    },
  };
}
