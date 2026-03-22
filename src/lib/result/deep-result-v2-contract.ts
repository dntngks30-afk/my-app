/**
 * Deep Result V2 Contract — SSOT
 *
 * 입력 채널은 여러 개지만 결과 계약은 하나다.
 * 무료 설문 / 카메라 / 유료 딥테스트 모두 이 타입으로 정규화된다.
 *
 * evidence_level과 source_mode로 정밀도 차이를 표현한다.
 *
 * @see docs/DEEP_RESULT_V2_CONTRACT.md
 */

// ─── 공통 열거형 ──────────────────────────────────────────────────────────────

/**
 * 입력 채널 식별자
 * - free_survey: 무료 설문 기반 테스트
 * - camera: 카메라 기반 자세 분석
 * - deep_paid: 유료 딥테스트 (14문항 + 알고리즘)
 */
export type SourceMode = 'free_survey' | 'camera' | 'deep_paid';

/**
 * 결과 정밀도 레벨
 * - lite:    신호 부족 / 최소 추론 (설문 미완성, 카메라 약신호)
 * - partial: 일부 신호 확보 (설문 완료, 카메라 정상, 딥테스트 v2)
 * - full:    강한 신호 + 알고리즘 확신 (딥테스트 v3 high confidence)
 */
export type EvidenceLevel = 'lite' | 'partial' | 'full';

/**
 * 통증/보호 모드
 * - none:      통증 신호 없음
 * - caution:   경미한 통증 신호 (주의 수준)
 * - protected: 강한 통증 신호 (보호 모드)
 */
export type PainMode = 'none' | 'caution' | 'protected';

/**
 * 공통 움직임 분류 타입
 * 세 채널의 서로 다른 타입 체계를 단일 공통 타입으로 정규화.
 *
 * 매핑:
 * - free_survey: kangaroo→CORE_CONTROL_DEFICIT, hedgehog→UPPER_IMMOBILITY, crab→LOWER_INSTABILITY,
 *                turtle→CORE_CONTROL_DEFICIT, penguin→LOWER_MOBILITY_RESTRICTION,
 *                meerkat→CORE_CONTROL_DEFICIT, monkey→STABLE, armadillo/sloth→DECONDITIONED
 * - camera:      kangaroo→CORE_CONTROL_DEFICIT, hedgehog→UPPER_IMMOBILITY,
 *                crab→LOWER_INSTABILITY, monkey→STABLE
 * - deep_paid v2: NECK-SHOULDER→UPPER_IMMOBILITY, LUMBO-PELVIS→CORE_CONTROL_DEFICIT,
 *                 UPPER-LIMB→UPPER_IMMOBILITY, LOWER-LIMB→LOWER_INSTABILITY,
 *                 DECONDITIONED→DECONDITIONED, STABLE→STABLE
 * - deep_paid v3: primary_type 직접 매핑
 */
export type UnifiedPrimaryType =
  | 'LOWER_INSTABILITY'
  | 'LOWER_MOBILITY_RESTRICTION'
  | 'UPPER_IMMOBILITY'
  | 'CORE_CONTROL_DEFICIT'
  | 'DECONDITIONED'
  | 'STABLE'
  | 'UNKNOWN';

export type UnifiedSecondaryType = UnifiedPrimaryType | null;

/** 6축 상태벡터 (deep_paid v3 전용, 다른 채널은 null) */
export type PriorityVector = Record<string, number> | null;

// ─── 핵심 계약 인터페이스 ─────────────────────────────────────────────────────

/**
 * UnifiedDeepResultV2: 모든 입력 채널 공통 결과 계약
 *
 * @invariant confidence ∈ [0, 1]
 * @invariant source_mode ∈ SourceMode enum
 * @invariant evidence_level ∈ EvidenceLevel enum
 */
export interface UnifiedDeepResultV2 {
  /** 1차 움직임 분류 타입 */
  primary_type: UnifiedPrimaryType;

  /** 2차 보조 움직임 타입 (없으면 null) */
  secondary_type: UnifiedSecondaryType;

  /**
   * 6축 우선순위 벡터 (0~1 정규화)
   * deep_paid v3에서만 제공; 다른 채널은 null.
   */
  priority_vector: PriorityVector;

  /**
   * 통증/보호 모드
   * deep_paid에서만 정밀 계산; 카메라/설문은 null 또는 추론값.
   */
  pain_mode: PainMode | null;

  /** 분류 신뢰도 (0~1). 채널마다 계산 방식이 다름. */
  confidence: number;

  /**
   * 결과 정밀도 레벨
   * source_mode와 채널 신호 품질을 합산한 단일 지표.
   */
  evidence_level: EvidenceLevel;

  /** 입력 채널 식별자 */
  source_mode: SourceMode;

  /**
   * 누락된 신호 목록
   * 예: ['pain_location', 'sls_quality', 'camera_depth']
   */
  missing_signals: string[];

  /**
   * 분류 근거 코드 목록
   * 예: ['knee_alignment_concern', 'trunk_lean_concern', 'pain_sum_high']
   */
  reason_codes: string[];

  /** 사용자 표시용 요약 문구 */
  summary_copy: string;

  /**
   * 하위 호환 필드 (기존 경로를 깨지 않기 위한 원본 데이터 보존)
   * normalize/adapter 레이어에서 채움. 소비 레이어는 이 필드에 의존하지 않도록 한다.
   */
  _compat?: {
    /** 기존 paid result_type (NECK-SHOULDER 등) */
    result_type?: string;
    /** 기존 paid focus_tags */
    focus_tags?: string[];
    /** 기존 paid avoid_tags */
    avoid_tags?: string[];
    /** 기존 paid algorithm_scores */
    algorithm_scores?: Record<string, number>;
    /** 기존 camera movementType */
    movementType?: string;
    /** 기존 camera captureQuality */
    captureQuality?: string;
    /** 기존 camera retryRecommended */
    retryRecommended?: boolean;
    /** 기존 camera insufficientSignal */
    insufficientSignal?: boolean;
    /** 기존 free survey mainType (담직/날림/버팀/흘림) */
    mainType?: string;
    /** 기존 free survey subType */
    subType?: string;
    /** 기존 scoring_version */
    scoring_version?: string;
    /**
     * PR-BASELINE-RAW-AXIS-SNAPSHOT-03: Free survey baseline evidence snapshot.
     * Camera refine가 priority_vector * 5 proxy 대신 더 정확한 baseline axis를 읽기 위해 저장.
     *
     * - 엄격한 런타임 검증 없음: _compat 내부는 validateUnifiedDeepResultV2 미검사.
     * - 소비: build-camera-refined-result.ts에서 snapshot 우선, 없으면 proxy fallback.
     * - 하위 호환: 이전에 생성된 payload에는 이 필드가 없으므로 optional.
     */
    baseline_deep_evidence_snapshot?: {
      /** 스냅샷 버전 식별자 (마이그레이션/디버깅용) */
      schema_version: 'free_survey_baseline_evidence_v1';
      /** 6축 raw evidence scores (DeepScoringEvidence.axis_scores와 동일 스케일) */
      axis_scores: {
        lower_stability: number;
        lower_mobility: number;
        upper_mobility: number;
        trunk_control: number;
        asymmetry: number;
        deconditioned: number;
      };
      /** movement_quality: stable 판정에서 core와 정렬하기 위한 플래그 */
      movement_quality: { all_good: boolean };
      /** 응답된 문항 수 */
      answered_count: number;
      /** 전체 문항 수 */
      total_count: number;
      /** 누락 신호 목록 */
      missing_signals: string[];
    };
  };
}

// ─── 런타임 검증 ──────────────────────────────────────────────────────────────

const VALID_SOURCE_MODES: SourceMode[] = ['free_survey', 'camera', 'deep_paid'];
const VALID_EVIDENCE_LEVELS: EvidenceLevel[] = ['lite', 'partial', 'full'];
const VALID_PAIN_MODES: Array<PainMode | null> = ['none', 'caution', 'protected', null];
const VALID_PRIMARY_TYPES: UnifiedPrimaryType[] = [
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
  'DECONDITIONED',
  'STABLE',
  'UNKNOWN',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * UnifiedDeepResultV2 런타임 검증 함수
 * zod 없이 TypeScript-compatible 검증 수행.
 */
export function validateUnifiedDeepResultV2(
  result: unknown
): ValidationResult {
  const errors: string[] = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['result must be a non-null object'] };
  }

  const r = result as Record<string, unknown>;

  // primary_type
  if (!VALID_PRIMARY_TYPES.includes(r.primary_type as UnifiedPrimaryType)) {
    errors.push(`primary_type must be one of [${VALID_PRIMARY_TYPES.join(', ')}], got: ${String(r.primary_type)}`);
  }

  // secondary_type
  const secondaryOk =
    r.secondary_type === null ||
    VALID_PRIMARY_TYPES.includes(r.secondary_type as UnifiedPrimaryType);
  if (!secondaryOk) {
    errors.push(`secondary_type must be null or UnifiedPrimaryType, got: ${String(r.secondary_type)}`);
  }

  // priority_vector
  if (r.priority_vector !== null) {
    if (typeof r.priority_vector !== 'object' || Array.isArray(r.priority_vector)) {
      errors.push('priority_vector must be a Record<string, number> or null');
    } else {
      for (const [k, v] of Object.entries(r.priority_vector as Record<string, unknown>)) {
        if (typeof v !== 'number') {
          errors.push(`priority_vector.${k} must be a number, got: ${typeof v}`);
        }
      }
    }
  }

  // pain_mode
  if (!VALID_PAIN_MODES.includes(r.pain_mode as PainMode | null)) {
    errors.push(`pain_mode must be one of [none, caution, protected, null], got: ${String(r.pain_mode)}`);
  }

  // confidence
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    errors.push(`confidence must be a number in [0, 1], got: ${String(r.confidence)}`);
  }

  // evidence_level
  if (!VALID_EVIDENCE_LEVELS.includes(r.evidence_level as EvidenceLevel)) {
    errors.push(`evidence_level must be one of [lite, partial, full], got: ${String(r.evidence_level)}`);
  }

  // source_mode
  if (!VALID_SOURCE_MODES.includes(r.source_mode as SourceMode)) {
    errors.push(`source_mode must be one of [free_survey, camera, deep_paid], got: ${String(r.source_mode)}`);
  }

  // missing_signals
  if (!Array.isArray(r.missing_signals)) {
    errors.push('missing_signals must be an array');
  } else {
    for (const s of r.missing_signals) {
      if (typeof s !== 'string') errors.push('missing_signals must contain only strings');
    }
  }

  // reason_codes
  if (!Array.isArray(r.reason_codes)) {
    errors.push('reason_codes must be an array');
  } else {
    for (const s of r.reason_codes) {
      if (typeof s !== 'string') errors.push('reason_codes must contain only strings');
    }
  }

  // summary_copy
  if (typeof r.summary_copy !== 'string') {
    errors.push(`summary_copy must be a string, got: ${typeof r.summary_copy}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 타입 가드: unknown → UnifiedDeepResultV2
 * 검증 통과 시 타입 좁힘.
 */
export function isUnifiedDeepResultV2(
  result: unknown
): result is UnifiedDeepResultV2 {
  return validateUnifiedDeepResultV2(result).valid;
}
