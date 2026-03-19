/**
 * Free Survey → UnifiedDeepResultV2 adapter
 *
 * 무료 설문 결과(ScoreResultV2 또는 AnimalAxis 기반)를
 * 공통 Deep Result V2 계약으로 정규화한다.
 *
 * 이 파일은 엔진 교체 없이 normalize/adapter 레이어만 제공한다.
 * 기존 무료 설문 렌더 경로는 그대로 유지된다.
 */

import type {
  UnifiedDeepResultV2,
  UnifiedPrimaryType,
  UnifiedSecondaryType,
  EvidenceLevel,
} from '../deep-result-v2-contract';

/**
 * 무료 설문 AnimalAxis → UnifiedPrimaryType 매핑
 *
 * 근거:
 * - kangaroo: 허리/골반 과부하 → CORE_CONTROL_DEFICIT
 * - hedgehog: 상체 가동성 제한(가슴 닫힘/등 굽음) → UPPER_IMMOBILITY
 * - crab:     좌우 불균형/편측 의존 → LOWER_INSTABILITY
 * - turtle:   상부 전방화(목·어깨 긴장) → CORE_CONTROL_DEFICIT
 * - penguin:  발목 가동성 제한 → LOWER_MOBILITY_RESTRICTION
 * - meerkat:  전신 과긴장/호흡 잠김 → CORE_CONTROL_DEFICIT
 * - monkey:   균형형 → STABLE
 * - armadillo:복합형(상+하체 동시 말림) → DECONDITIONED
 * - sloth:    복합형(지지 분산/힘 누수) → DECONDITIONED
 */
const FREE_SURVEY_ANIMAL_TO_PRIMARY: Record<string, UnifiedPrimaryType> = {
  kangaroo:  'CORE_CONTROL_DEFICIT',
  hedgehog:  'UPPER_IMMOBILITY',
  crab:      'LOWER_INSTABILITY',
  turtle:    'CORE_CONTROL_DEFICIT',
  penguin:   'LOWER_MOBILITY_RESTRICTION',
  meerkat:   'CORE_CONTROL_DEFICIT',
  monkey:    'STABLE',
  armadillo: 'DECONDITIONED',
  sloth:     'DECONDITIONED',
};

/** SubType 문자열에서 secondary type 추론 */
function inferSecondaryFromSubType(
  subType: string | undefined,
  primary: UnifiedPrimaryType
): UnifiedSecondaryType {
  if (!subType) return null;
  const s = subType.toLowerCase();
  if (s.includes('상체') || s.includes('어깨') || s.includes('가슴')) return 'UPPER_IMMOBILITY';
  if (s.includes('허리') || s.includes('골반') || s.includes('호흡')) return 'CORE_CONTROL_DEFICIT';
  if (s.includes('무릎') || s.includes('발목') || s.includes('하체')) return 'LOWER_INSTABILITY';
  if (s.includes('비대칭') || s.includes('좌우')) return 'LOWER_INSTABILITY';
  return null;
}

/** confidence (0~100 int) → normalized 0~1 */
function normalizeConfidence(rawConfidence: number | undefined): number {
  if (rawConfidence === undefined || rawConfidence === null) return 0.5;
  if (rawConfidence > 1) return Math.min(1, rawConfidence / 100);
  return Math.max(0, Math.min(1, rawConfidence));
}

/** answeredRatio → evidence_level */
function toEvidenceLevel(answeredRatio: number, confidence: number): EvidenceLevel {
  if (answeredRatio >= 0.9 && confidence >= 0.6) return 'partial';
  return 'lite';
}

/**
 * 무료 설문 ScoreResultV2-compatible shape → UnifiedDeepResultV2
 *
 * @param input 무료 설문 결과 shape. ScoreResultV2 또는 최소 필드만 있는 경우 모두 허용.
 */
export function adaptFreeSurveyResult(input: {
  mainAnimal?: string;
  baseType?: string;
  subType?: string;
  subTendency?: string;
  resultType?: string;
  confidence?: number;
  answeredRatio?: number;
  totalQuestions?: number;
  answeredQuestions?: number;
  missingFields?: string[];
}): UnifiedDeepResultV2 {
  const animalKey =
    input.mainAnimal ??
    input.baseType ??
    (input.resultType?.toLowerCase()) ??
    'unknown';

  const primary: UnifiedPrimaryType =
    FREE_SURVEY_ANIMAL_TO_PRIMARY[animalKey] ?? 'UNKNOWN';

  const secondary = inferSecondaryFromSubType(
    input.subType ?? input.subTendency,
    primary
  );

  const rawConfidence = input.confidence;
  const confidence = normalizeConfidence(rawConfidence);

  const answeredRatio =
    input.answeredRatio ??
    (input.totalQuestions && input.answeredQuestions !== undefined
      ? input.answeredQuestions / input.totalQuestions
      : undefined) ??
    (rawConfidence !== undefined && rawConfidence > 1
      ? rawConfidence / 100
      : rawConfidence) ??
    0.5;

  const evidenceLevel = toEvidenceLevel(answeredRatio, confidence);

  const missingSignals: string[] = input.missingFields ?? [];
  if (answeredRatio < 0.7) missingSignals.push('survey_incomplete');

  const reasonCodes: string[] = [];
  if (animalKey === 'kangaroo') reasonCodes.push('lumbar_dominant_pattern');
  if (animalKey === 'hedgehog') reasonCodes.push('thoracic_closure_pattern');
  if (animalKey === 'crab') reasonCodes.push('lateral_imbalance_pattern');
  if (animalKey === 'turtle') reasonCodes.push('anterior_head_pattern');
  if (animalKey === 'penguin') reasonCodes.push('ankle_mobility_restriction');
  if (animalKey === 'meerkat') reasonCodes.push('global_bracing_pattern');
  if (animalKey === 'monkey') reasonCodes.push('balanced_movement_pattern');
  if (animalKey === 'armadillo' || animalKey === 'sloth') {
    reasonCodes.push('composite_pattern');
  }

  const summaryCopy = primary === 'STABLE'
    ? '전반적으로 균형이 잘 잡힌 움직임 패턴이 확인됩니다.'
    : primary === 'DECONDITIONED'
      ? '복합적인 움직임 패턴이 나타났습니다. 기초부터 차근차근 잡아가는 흐름을 권장합니다.'
      : `${animalKey}형 움직임 패턴이 확인됩니다. 우선순위 부위를 중심으로 조정하는 흐름을 권장합니다.`;

  return {
    primary_type: primary,
    secondary_type: secondary,
    priority_vector: null,
    pain_mode: null,
    confidence,
    evidence_level: evidenceLevel,
    source_mode: 'free_survey',
    missing_signals: [...new Set(missingSignals)],
    reason_codes: reasonCodes,
    summary_copy: summaryCopy,
    _compat: {
      mainType: animalKey,
      subType: input.subType ?? input.subTendency,
      scoring_version: 'free_v2',
    },
  };
}
