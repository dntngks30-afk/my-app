/**
 * Paid Deep Test Result → UnifiedDeepResultV2 adapter
 *
 * 유료 딥테스트 결과(deep_v2 / deep_v3)를
 * 공통 Deep Result V2 계약으로 정규화한다.
 *
 * 이 파일은 엔진 교체 없이 normalize/adapter 레이어만 제공한다.
 * 기존 /api/deep-test/get-latest 및 DeepTestResultContent 읽기 경로는 그대로 유지된다.
 */

import type {
  UnifiedDeepResultV2,
  UnifiedPrimaryType,
  UnifiedSecondaryType,
  EvidenceLevel,
  PainMode,
  PriorityVector,
} from '../deep-result-v2-contract';

/**
 * deep_v2 result_type → UnifiedPrimaryType 매핑
 *
 * 근거:
 * - NECK-SHOULDER:  목·어깨 축 제한 → UPPER_IMMOBILITY
 * - LUMBO-PELVIS:   허리·골반 불안정 → CORE_CONTROL_DEFICIT
 * - UPPER-LIMB:     손목·팔꿈치 가동성 제한 → UPPER_IMMOBILITY
 * - LOWER-LIMB:     무릎·발목 불안정 → LOWER_INSTABILITY
 * - DECONDITIONED:  전신/밸런스 저하 → DECONDITIONED
 * - STABLE:         안정 → STABLE
 */
const DEEP_V2_RESULT_TYPE_TO_PRIMARY: Record<string, UnifiedPrimaryType> = {
  'NECK-SHOULDER': 'UPPER_IMMOBILITY',
  'LUMBO-PELVIS':  'CORE_CONTROL_DEFICIT',
  'UPPER-LIMB':    'UPPER_IMMOBILITY',
  'LOWER-LIMB':    'LOWER_INSTABILITY',
  'DECONDITIONED': 'DECONDITIONED',
  'STABLE':        'STABLE',
};

/**
 * deep_v3 primary_type → UnifiedPrimaryType 매핑
 * deep_v3 타입과 Unified 타입이 동일하므로 direct cast 가능하지만
 * 명시적으로 매핑하여 안전성 확보.
 */
const DEEP_V3_PRIMARY_TO_UNIFIED: Record<string, UnifiedPrimaryType> = {
  LOWER_INSTABILITY:         'LOWER_INSTABILITY',
  LOWER_MOBILITY_RESTRICTION:'LOWER_MOBILITY_RESTRICTION',
  UPPER_IMMOBILITY:          'UPPER_IMMOBILITY',
  CORE_CONTROL_DEFICIT:      'CORE_CONTROL_DEFICIT',
  DECONDITIONED:             'DECONDITIONED',
  STABLE:                    'STABLE',
};

/** deep_v2/v3 secondaryFocus / secondary_type → UnifiedSecondaryType 매핑 */
function toSecondary(
  secondaryFocus: string | undefined | null,
  secondaryType: string | undefined | null
): UnifiedSecondaryType {
  const raw = secondaryType ?? secondaryFocus;
  if (!raw || raw === 'NONE') return null;
  return (
    DEEP_V3_PRIMARY_TO_UNIFIED[raw] ??
    DEEP_V2_RESULT_TYPE_TO_PRIMARY[raw] ??
    null
  );
}

/** confidence → EvidenceLevel */
function toEvidenceLevel(confidence: number, scoringVersion: string): EvidenceLevel {
  if (scoringVersion === 'deep_v3') {
    if (confidence >= 0.8) return 'full';
    if (confidence >= 0.6) return 'partial';
    return 'lite';
  }
  if (confidence >= 0.7) return 'partial';
  return 'lite';
}

/** pain_mode 문자열 → PainMode */
function toPainMode(raw: string | undefined | null): PainMode | null {
  if (raw === 'protected' || raw === 'caution' || raw === 'none') return raw;
  return null;
}

/**
 * priority_vector 검증 및 클린업
 * 모든 값이 number 이어야 한다.
 */
function toPriorityVector(
  raw: Record<string, number> | undefined | null
): PriorityVector {
  if (!raw || typeof raw !== 'object') return null;
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      cleaned[k] = v;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/** objectiveScores / finalScores 기반 reason_codes 생성 */
function buildReasonCodes(input: {
  objectiveScores?: Record<string, number>;
  finalScores?: Record<string, number>;
  pain_mode?: string | null;
  priority_vector?: Record<string, number> | null;
}): string[] {
  const codes: string[] = [];
  const obj = input.objectiveScores ?? {};
  const final = input.finalScores ?? {};
  const scores = { ...obj, ...final };

  if ((scores.N ?? 0) >= 3) codes.push('neck_shoulder_high');
  if ((scores.L ?? 0) >= 3) codes.push('lumbo_pelvis_high');
  if ((scores.U ?? 0) >= 3) codes.push('upper_limb_high');
  if ((scores.Lo ?? 0) >= 3) codes.push('lower_limb_high');
  if ((scores.D ?? 0) >= 4) codes.push('deconditioned_high');

  if (input.pain_mode === 'protected') codes.push('pain_protected_mode');
  if (input.pain_mode === 'caution') codes.push('pain_caution_mode');

  const pv = input.priority_vector;
  if (pv) {
    const topAxis = Object.entries(pv)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([k]) => k);
    for (const axis of topAxis) {
      codes.push(`top_axis_${axis}`);
    }
  }

  return codes;
}

/** missing_signals 계산 */
function buildMissingSignals(input: {
  answeredCount?: number;
  totalCount?: number;
  focus_tags?: string[];
}): string[] {
  const missing: string[] = [];
  const total = input.totalCount ?? 14;
  const answered = input.answeredCount ?? total;
  if (answered < total) {
    missing.push(`deep_survey_partial_${answered}/${total}`);
  }
  if (!input.focus_tags || input.focus_tags.length === 0) {
    missing.push('focus_tags_empty');
  }
  return missing;
}

/**
 * PaidDeepAttempt-compatible shape → UnifiedDeepResultV2
 *
 * @param input 유료 딥테스트 attempt 결과 (API 응답 또는 DB 저장 shape 호환)
 */
export function adaptPaidDeepResult(input: {
  scoring_version?: string;
  resultType?: string | null;
  confidence?: number | null;
  scores?: {
    objectiveScores?: Record<string, number>;
    finalScores?: Record<string, number>;
    primaryFocus?: string;
    secondaryFocus?: string;
    derived?: {
      focus_tags?: string[];
      avoid_tags?: string[];
      algorithm_scores?: Record<string, number>;
      priority_vector?: Record<string, number>;
      pain_mode?: string;
      primary_type?: string;
      secondary_type?: string | null;
      answeredCount?: number;
      totalCount?: number;
    };
  };
}): UnifiedDeepResultV2 {
  const scoringVersion = input.scoring_version ?? 'deep_v2';
  const derived = input.scores?.derived;
  const isV3 = scoringVersion === 'deep_v3';

  const rawPrimary = isV3
    ? (derived?.primary_type ?? input.resultType)
    : input.resultType;
  const primary: UnifiedPrimaryType = isV3
    ? (DEEP_V3_PRIMARY_TO_UNIFIED[rawPrimary ?? ''] ?? 'UNKNOWN')
    : (DEEP_V2_RESULT_TYPE_TO_PRIMARY[rawPrimary ?? ''] ?? 'UNKNOWN');

  const secondary = toSecondary(
    input.scores?.secondaryFocus,
    derived?.secondary_type ?? null
  );

  const rawConfidence = input.confidence ?? 0;
  const confidence = Math.max(0, Math.min(1, rawConfidence));
  const evidenceLevel = toEvidenceLevel(confidence, scoringVersion);

  const painMode = toPainMode(derived?.pain_mode ?? null);
  const priorityVector = toPriorityVector(derived?.priority_vector ?? null);

  const reasonCodes = buildReasonCodes({
    objectiveScores: input.scores?.objectiveScores,
    finalScores: input.scores?.finalScores,
    pain_mode: derived?.pain_mode,
    priority_vector: derived?.priority_vector,
  });

  const missingSignals = buildMissingSignals({
    answeredCount: derived?.answeredCount,
    totalCount: derived?.totalCount ?? 14,
    focus_tags: derived?.focus_tags,
  });

  const summaryCopy = primary === 'STABLE'
    ? '전반적인 움직임 상태가 안정적입니다.'
    : primary === 'DECONDITIONED'
      ? '전신 컨디션 회복이 최우선 과제입니다. 기초 안정화부터 시작합니다.'
      : primary === 'UNKNOWN'
        ? '결과를 확정하기 위한 신호가 부족합니다.'
        : `${rawPrimary ?? primary} 패턴이 우선순위로 확인됩니다.`;

  return {
    primary_type: primary,
    secondary_type: secondary,
    priority_vector: priorityVector,
    pain_mode: painMode,
    confidence,
    evidence_level: evidenceLevel,
    source_mode: 'deep_paid',
    missing_signals: [...new Set(missingSignals)],
    reason_codes: reasonCodes,
    summary_copy: summaryCopy,
    _compat: {
      result_type: input.resultType ?? undefined,
      focus_tags: derived?.focus_tags,
      avoid_tags: derived?.avoid_tags,
      algorithm_scores: derived?.algorithm_scores,
      scoring_version: scoringVersion,
    },
  };
}
