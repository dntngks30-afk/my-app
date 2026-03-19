/**
 * Camera Result → UnifiedDeepResultV2 adapter
 *
 * NormalizedCameraResult(카메라 분석 결과)를
 * 공통 Deep Result V2 계약으로 정규화한다.
 *
 * 이 파일은 엔진 교체 없이 normalize/adapter 레이어만 제공한다.
 * 기존 카메라 렌더 경로(NormalizedCameraResult)는 그대로 유지된다.
 */

import type {
  UnifiedDeepResultV2,
  UnifiedPrimaryType,
  UnifiedSecondaryType,
  EvidenceLevel,
  PainMode,
} from '../deep-result-v2-contract';

/**
 * 카메라 movementType → UnifiedPrimaryType 매핑
 *
 * 근거:
 * - kangaroo: 허리/골반 과부하 패턴 → CORE_CONTROL_DEFICIT
 * - hedgehog: 상체 가동성 제한 패턴 → UPPER_IMMOBILITY
 * - crab:     좌우 불균형 패턴 → LOWER_INSTABILITY
 * - monkey:   균형형 → STABLE
 * - unknown:  신호 부족 → UNKNOWN
 */
const CAMERA_MOVEMENT_TO_PRIMARY: Record<string, UnifiedPrimaryType> = {
  kangaroo: 'CORE_CONTROL_DEFICIT',
  hedgehog: 'UPPER_IMMOBILITY',
  crab:     'LOWER_INSTABILITY',
  monkey:   'STABLE',
  unknown:  'UNKNOWN',
};

/**
 * ResultEvidenceLevel → EvidenceLevel 매핑
 */
const CAMERA_EVIDENCE_TO_LEVEL: Record<string, EvidenceLevel> = {
  strong_evidence:    'partial',
  shallow_evidence:   'partial',
  weak_evidence:      'lite',
  insufficient_signal:'lite',
};

/**
 * 카메라 플래그 → missing_signals 변환
 */
function toMissingSignals(flags: string[]): string[] {
  const missing: string[] = [];
  if (flags.includes('insufficient_signal')) missing.push('camera_signal_insufficient');
  if (flags.includes('valid_frames_too_few')) missing.push('camera_frames_too_few');
  if (flags.includes('framing_invalid')) missing.push('camera_framing_invalid');
  if (flags.includes('landmark_confidence_low')) missing.push('camera_landmark_confidence_low');
  if (flags.includes('hard_partial')) missing.push('camera_occlusion_hard');
  if (flags.includes('soft_partial')) missing.push('camera_occlusion_soft');
  if (flags.includes('rep_incomplete')) missing.push('camera_rep_incomplete');
  if (flags.includes('hold_too_short')) missing.push('camera_hold_too_short');
  return missing;
}

/**
 * 카메라 메트릭 concern → reason_codes 변환
 */
function toReasonCodes(
  evaluatorResults: Array<{
    metrics?: Array<{ name: string; trend?: string }>;
    insufficientSignal?: boolean;
  }>
): string[] {
  const codes: string[] = [];
  for (const r of evaluatorResults) {
    if (r.insufficientSignal) continue;
    for (const m of r.metrics ?? []) {
      if (m.trend === 'concern') {
        codes.push(`camera_${m.name}_concern`);
      }
    }
  }
  return [...new Set(codes)];
}

/**
 * captureQuality + retryRecommended + insufficientSignal → PainMode 추론
 * 카메라는 통증 정보를 직접 수집하지 않으므로 null 반환.
 */
function toPainMode(): PainMode | null {
  return null;
}

/**
 * evaluatorResults에서 secondary type 추론
 * 두 번째로 높은 concern count 메트릭 그룹 기반.
 */
function inferSecondary(
  primary: UnifiedPrimaryType,
  evaluatorResults: Array<{
    metrics?: Array<{ name: string; trend?: string }>;
    insufficientSignal?: boolean;
  }>
): UnifiedSecondaryType {
  const allMetrics = evaluatorResults.flatMap((r) =>
    r.insufficientSignal ? [] : (r.metrics ?? [])
  );
  const concerns = allMetrics.filter((m) => m.trend === 'concern');

  const hasDepthConcern = concerns.some((m) => m.name === 'depth');
  const hasKneeConcern = concerns.some((m) => m.name === 'knee_alignment_trend');
  const hasArmRangeConcern = concerns.some((m) => m.name === 'arm_range');
  const hasLumbarConcern = concerns.some((m) => m.name === 'lumbar_extension');
  const hasTrunkConcern = concerns.some((m) => m.name === 'trunk_lean');

  if (primary === 'UPPER_IMMOBILITY' && (hasDepthConcern || hasKneeConcern)) {
    return 'LOWER_INSTABILITY';
  }
  if (primary === 'CORE_CONTROL_DEFICIT' && (hasArmRangeConcern || hasLumbarConcern)) {
    return 'UPPER_IMMOBILITY';
  }
  if (primary === 'LOWER_INSTABILITY' && (hasTrunkConcern || hasLumbarConcern)) {
    return 'CORE_CONTROL_DEFICIT';
  }

  return null;
}

/**
 * NormalizedCameraResult-compatible shape → UnifiedDeepResultV2
 *
 * @param input NormalizedCameraResult 또는 그와 호환되는 shape
 */
export function adaptCameraResult(input: {
  movementType: string;
  confidence: number;
  captureQuality: string;
  flags?: string[];
  retryRecommended?: boolean;
  fallbackMode?: string | null;
  insufficientSignal?: boolean;
  evaluatorResults?: Array<{
    metrics?: Array<{ name: string; trend?: string }>;
    insufficientSignal?: boolean;
  }>;
  patternSummary?: string;
  resultEvidenceLevel?: string;
  resultToneMode?: string;
}): UnifiedDeepResultV2 {
  const movementType = input.movementType ?? 'unknown';
  const primary: UnifiedPrimaryType =
    CAMERA_MOVEMENT_TO_PRIMARY[movementType] ?? 'UNKNOWN';

  const evaluatorResults = input.evaluatorResults ?? [];
  const secondary = inferSecondary(primary, evaluatorResults);
  const flags = input.flags ?? [];

  const rawEvidenceLevel = input.resultEvidenceLevel;
  const evidenceLevel: EvidenceLevel =
    CAMERA_EVIDENCE_TO_LEVEL[rawEvidenceLevel ?? ''] ??
    (input.insufficientSignal ? 'lite' : input.captureQuality === 'ok' ? 'partial' : 'lite');

  const missingSignals = toMissingSignals(flags);
  if (input.insufficientSignal) missingSignals.push('camera_signal_insufficient');
  const reasonCodes = toReasonCodes(evaluatorResults);

  const summaryCopy = input.patternSummary ?? (
    primary === 'STABLE'
      ? '전반적으로 균형이 잡힌 움직임 패턴이 확인됩니다.'
      : primary === 'UNKNOWN'
        ? '촬영 신호가 충분하지 않아 결과를 확정하지 않았습니다.'
        : `${movementType}형 패턴 경향이 확인됩니다.`
  );

  return {
    primary_type: primary,
    secondary_type: secondary,
    priority_vector: null,
    pain_mode: toPainMode(),
    confidence: Math.max(0, Math.min(1, input.confidence)),
    evidence_level: evidenceLevel,
    source_mode: 'camera',
    missing_signals: [...new Set(missingSignals)],
    reason_codes: reasonCodes,
    summary_copy: summaryCopy,
    _compat: {
      movementType,
      captureQuality: input.captureQuality,
      retryRecommended: input.retryRecommended ?? false,
      insufficientSignal: input.insufficientSignal ?? false,
      scoring_version: 'camera_v1',
    },
  };
}
