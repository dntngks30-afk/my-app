/**
 * PR-CAM-01 — 카메라 evidence를 “분석 성공”이 아니라 **세션 계획에 얼마나 신뢰 가능한가**로 정규화.
 *
 * - `CameraEvidenceQuality`(strong/partial/minimal)는 어댑터의 **분석 신호 강도**에 가깝다.
 * - `CameraPlanningEvidenceTier`(none/limited/standard)는 **세션 병합 정책**이 쓰는 티어다.
 * - pass만으로 standard가 되지 않도록 `computeCameraPlanningEvidenceTier`에서 pass+분석 품질을 함께 본다.
 */

import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

/** 세션 1 설문+카메라 병합 정책용 티어 */
export type CameraPlanningEvidenceTier = 'none' | 'limited' | 'standard';

/** `_compat.camera_evidence_quality` 및 역추적용 레이블 */
export type CameraLegacyEvidenceQuality = 'strong' | 'partial' | 'minimal' | 'unknown';

type CompatCam = {
  camera_planning_evidence_tier?: string;
  camera_evidence_quality?: string;
  camera_pass?: boolean;
};

/**
 * refined 빌드 시점: 분석 품질 + pass → planning 티어.
 * - pass false 또는 분석 minimal → planning 영향 없음(none).
 * - partial → dampen/caution 계열만(limited).
 * - strong + pass → reinforce까지 허용 가능(standard).
 */
export function computeCameraPlanningEvidenceTier(
  cameraPass: boolean,
  analysisQuality: 'strong' | 'partial' | 'minimal'
): CameraPlanningEvidenceTier {
  if (!cameraPass || analysisQuality === 'minimal') return 'none';
  if (analysisQuality === 'partial') return 'limited';
  return 'standard';
}

export function inferCameraPassFromResult(v2: UnifiedDeepResultV2): boolean | undefined {
  const c = v2._compat as CompatCam | undefined;
  return typeof c?.camera_pass === 'boolean' ? c.camera_pass : undefined;
}

/**
 * claimed refined JSON에서 planning 티어 결정. 한 곳에서만 역추적한다.
 * - `camera_planning_evidence_tier`가 있으면 최우선(신규 저장분).
 * - 구버전: analysis quality + pass; `source_mode===camera`인데 quality 불명이면 **standard로 가정하지 않고** limited.
 */
export function resolveCameraPlanningTierForSessionMerge(v2: UnifiedDeepResultV2): {
  tier: CameraPlanningEvidenceTier;
  legacy_analysis_quality: CameraLegacyEvidenceQuality;
  tier_resolution_trace: string[];
} {
  const compat = v2._compat as CompatCam | undefined;
  const trace: string[] = [];

  const explicit = compat?.camera_planning_evidence_tier;
  if (explicit === 'none' || explicit === 'limited' || explicit === 'standard') {
    trace.push('cam_tier:compat_explicit');
    let legacy: CameraLegacyEvidenceQuality = 'unknown';
    const q = compat?.camera_evidence_quality;
    if (q === 'strong' || q === 'partial' || q === 'minimal') legacy = q;
    return {
      tier: explicit,
      legacy_analysis_quality: legacy,
      tier_resolution_trace: trace,
    };
  }

  const pass = inferCameraPassFromResult(v2);
  let legacy: CameraLegacyEvidenceQuality = 'unknown';
  const q = compat?.camera_evidence_quality;
  if (q === 'strong' || q === 'partial' || q === 'minimal') {
    legacy = q;
  } else if (v2.reason_codes?.includes('camera_evidence_partial')) {
    legacy = 'partial';
  } else if (v2.source_mode === 'camera' && v2.evidence_level === 'lite') {
    legacy = 'minimal';
  } else if (v2.source_mode === 'camera') {
    legacy = 'unknown';
  }

  let tier: CameraPlanningEvidenceTier;
  if (pass === false || legacy === 'minimal') {
    tier = 'none';
    trace.push('cam_tier:legacy_none');
  } else if (legacy === 'partial') {
    tier = 'limited';
    trace.push('cam_tier:legacy_limited');
  } else if (legacy === 'strong') {
    tier = 'standard';
    trace.push('cam_tier:legacy_standard');
  } else if (v2.source_mode === 'camera') {
    tier = 'limited';
    trace.push('cam_tier:legacy_unknown_camera_as_limited');
  } else {
    tier = 'none';
    trace.push('cam_tier:fallback_none');
  }

  return { tier, legacy_analysis_quality: legacy, tier_resolution_trace: trace };
}
