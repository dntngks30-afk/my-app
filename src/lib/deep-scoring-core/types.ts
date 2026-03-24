/**
 * Deep Scoring Core V2 — 타입 정의
 *
 * 이 파일은 입력 채널(free_survey / camera / deep_paid)을 알지 못한다.
 * 모든 채널은 DeepScoringEvidence를 만들어 core에 전달한다.
 *
 * 설계 원칙:
 * - raw survey answer 없음
 * - 채널 식별자(source_mode) 없음
 * - 0점 대체 없음 — 정보 없을 경우 missing_signals에 기록
 */

// ─── 6축 상태벡터 ──────────────────────────────────────────────────────────────

/**
 * 6축 상태벡터 (0~∞ raw count)
 * deep_v3 StateVector와 동일 의미. 채널 독립적 정규화 후 사용.
 */
export interface AxisScores {
  /** 하체 안정성 결핍 정도 (무릎/발목 불안정, 편측 흔들림 등) */
  lower_stability: number;
  /** 하체 가동성 제한 정도 (발목 가동범위 제한 등) */
  lower_mobility: number;
  /** 상체 가동성 제한 정도 (팔 거상 제한, 흉추 제한 등) */
  upper_mobility: number;
  /** 체간 조절 결핍 정도 (허리/갈비뼈 보상, 골반 비틀림 등) */
  trunk_control: number;
  /** 비대칭/편측 정도 */
  asymmetry: number;
  /** 전신 저조건화 정도 (나이·경험 부족·활동 부족 등) */
  deconditioned: number;
}

// ─── 통증 신호 ────────────────────────────────────────────────────────────────

/**
 * 통증 관련 증거 (pain_mode 결정에 사용)
 * 채널별로 수집 가능한 정보가 다르므로 선택적 필드로 구성.
 */
export interface PainSignals {
  /**
   * 통증 강도 최대값 (0~3)
   * 0=없음, 1=약간, 2=중간, 3=강함
   * 정보 없으면 undefined (0 대체 금지)
   */
  max_intensity?: number;
  /**
   * "주 불편 부위 없음" 명시 여부
   * deep_paid: Q5 "해당 없음" 선택
   * 정보 없으면 undefined
   */
  primary_discomfort_none?: boolean;
  /**
   * 통증 위치 데이터 존재 여부 (asymmetry 계산 보조)
   */
  has_location_data?: boolean;
}

// ─── 움직임 품질 ──────────────────────────────────────────────────────────────

/**
 * 움직임 수행 품질 (STABLE gate 판정에 사용)
 * 채널별로 평가 방식이 다르므로 불리언 플래그로 추상화.
 */
export interface MovementQuality {
  /**
   * 모든 주요 movement 문항이 "양호" 판정인지 여부
   * deep_paid:
   *   Q8 "발바닥이 바닥에 잘 붙은 채로" + Q11 "문제 없음" + Q14 "10초 안정적으로 가능"
   * camera:
   *   captureQuality === 'ok' && movementType === 'monkey'
   * free_survey:
   *   결과 타입 === 'monkey'
   * 정보 없으면 false (안전한 기본값)
   */
  all_good: boolean;
}

// ─── PR-SURVEY-02: 무료 설문 조합 힌트 (core interaction rules 전용) ─────────

/**
 * 무료 설문 18문항에서만 채워짐. 카메라/유료는 undefined → interaction 규칙 비활성.
 * UnifiedDeepResultV2 계약이 아닌 DeepScoringEvidence 내부 입력 확장.
 */
export interface SurveyAxisInteractionHints {
  /** C군(허리·골반 부하) 평균이 높음 → 보호·통증 맥락 프록시(임상 통증 아님) */
  trunk_load_pain_proxy: boolean;
  /** F군(비대칭) 문항 평균이 높음 */
  f_asymmetry_cluster: boolean;
  /** G군(긴장·guarding) 평균이 높음 */
  g_guarding_cluster: boolean;
  /** 18문항 전체 평균이 낮음 → 전반적 낮은 자기평가·익숙도 프록시 */
  low_global_movement_confidence: boolean;
}

// ─── 핵심 입력 타입 ───────────────────────────────────────────────────────────

/**
 * DeepScoringEvidence — 채널 독립 scoring core의 유일한 입력
 *
 * @invariant axis_scores의 모든 값 >= 0
 * @invariant answered_count <= total_count
 * @invariant missing_signals는 실제 누락된 신호 이름 목록
 */
export interface DeepScoringEvidence {
  /** 6축 상태벡터 */
  axis_scores: AxisScores;
  /** 통증 신호 */
  pain_signals: PainSignals;
  /** 움직임 품질 */
  movement_quality: MovementQuality;
  /** 응답된 문항 수 */
  answered_count: number;
  /** 전체 문항 수 (denominator) */
  total_count: number;
  /**
   * 누락된 신호 목록 (0 대체 없이 빈 값으로 남긴 신호들)
   * 예: ['sls_quality_missing', 'pain_location_missing']
   */
  missing_signals: string[];
  /**
   * PR-SURVEY-02: 무료 설문 baseline 전용. 있으면 core에서 보수적 축 조정 1패스 적용.
   */
  survey_axis_interaction_hints?: SurveyAxisInteractionHints;
}

// ─── 핵심 출력 타입 ───────────────────────────────────────────────────────────

/**
 * primary/secondary 분류 타입
 * PR-V2-01의 UnifiedPrimaryType과 동일 값셋 유지.
 */
export type ScoringPrimaryType =
  | 'LOWER_INSTABILITY'
  | 'LOWER_MOBILITY_RESTRICTION'
  | 'UPPER_IMMOBILITY'
  | 'CORE_CONTROL_DEFICIT'
  | 'DECONDITIONED'
  | 'STABLE';

export type ScoringSecondaryType = ScoringPrimaryType | null;

/** 통증/보호 모드 */
export type ScoringPainMode = 'none' | 'caution' | 'protected';

/** 6축 우선순위 벡터 (0~1 정규화) */
export type ScoringPriorityVector = Record<keyof AxisScores, number>;

/**
 * DeepScoringCoreResult — 채널 독립 scoring core의 출력
 *
 * 이 타입은 adapter 레이어에서 UnifiedDeepResultV2로 변환된다.
 */
export interface DeepScoringCoreResult {
  /** 1차 분류 타입 */
  primary_type: ScoringPrimaryType;
  /** 2차 분류 타입 (없으면 null) */
  secondary_type: ScoringSecondaryType;
  /** 6축 우선순위 벡터 (0~1) */
  priority_vector: ScoringPriorityVector;
  /** 통증/보호 모드 */
  pain_mode: ScoringPainMode;
  /**
   * 신뢰도 초안 [0~1]
   * base = answered_count / total_count
   * gap bonus는 axis_scores 기반 별도 계산 가능
   */
  confidence_base: number;
  /** gap bonus (1차-2차 score 차이 기반) */
  confidence_gap_bonus: number;
  /** 최종 신뢰도 = clamp(confidence_base + confidence_gap_bonus, 0, 1) */
  confidence: number;
  /** 분류 근거 코드 목록 */
  reason_codes: string[];
  /** 누락 신호 목록 (evidence에서 전달) */
  missing_signals: string[];
  /**
   * 루틴 생성 엔진 소비용 파생 데이터
   * deep_v2/v3 호환을 위한 태그 및 레벨 포함
   */
  derived: {
    level: number;
    focus_tags: string[];
    avoid_tags: string[];
    algorithm_scores: {
      upper_score: number;
      lower_score: number;
      core_score: number;
      balance_score: number;
      pain_risk: number;
    };
  };
  /**
   * 호환용 raw axis_scores (0~∞)
   * deep_v2/v3 objectiveScores/finalScores 재구성에 사용
   */
  axis_scores_raw: AxisScores;
}
