/**
 * Deep Test 전용 타입 정의
 * Free 스코어 스키마와 완전 분리 (V1 레거시 유지 및 V2 알고리즘 확장)
 */

export type DeepAnswerValue = number | boolean | string | string[] | null;

// ==========================================
// [Legacy] Deep V1
// ==========================================
export type DeepV1Scores = {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  t5: number;
};

export type DeepV1ResultType = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export interface DeepV1Result {
  scores: DeepV1Scores;
  result_type: DeepV1ResultType;
  confidence: number; // 0~1
}

// ==========================================
// [Current] Deep V2 (알고리즘 최적화 버전)
// ==========================================

export type DeepV2ResultType =
  | 'NECK-SHOULDER'
  | 'LUMBO-PELVIS'
  | 'UPPER-LIMB'
  | 'LOWER-LIMB'
  | 'DECONDITIONED'
  | 'STABLE';

export type DeepFocus =
  | 'NECK-SHOULDER'
  | 'LUMBO-PELVIS'
  | 'UPPER-LIMB'
  | 'LOWER-LIMB';

export type DeepPrimaryFocus = DeepFocus | 'FULL';
export type DeepSecondaryFocus = DeepFocus | 'NONE';

/** * [UI 하위 호환성 유지용 객체]
 * N=NECK-SHOULDER, L=LUMBO-PELVIS, U=UPPER-LIMB, Lo=LOWER-LIMB, D=BALANCE/DECONDITIONED
 */
export type DeepObjectiveScores = {
  N: number;  // 목·어깨
  L: number;  // 허리·골반
  U: number;  // 손목·팔꿈치
  Lo: number; // 무릎·발목
  D: number;  // 전신/밸런스 (기존 탈조건)
};

export type DeepFinalScores = DeepObjectiveScores;

/**
 * [신규 추천 알고리즘 전용 스코어 객체]
 * 각 부위별 위험도 및 타겟팅 우선순위를 결정하는 절대 점수
 */
export type DeepAlgorithmScores = {
  upper_score: number;   // 상체(흉추/어깨) 불균형 점수
  lower_score: number;   // 하체(골반/발목) 불균형 점수
  core_score: number;    // 코어/척추 불안정성 점수
  balance_score: number; // 좌우 비대칭 및 밸런스 점수
  pain_risk: number;     // 통증 기반 위험도 (높을수록 안전 모드/Level 1 강제)
};

/** calculateDeepV2 내부 signals (extendDeepV2에서 red_flags 등 사용) */
export interface DeepV2Signals {
  red_flags: boolean;
  pain_sum: number;
}

/** * V2 기본 결과 인터페이스 (UI 및 레거시 데이터 통신용)
 */
export interface DeepV2Result {
  scoring_version: 'deep_v2';
  result_type: DeepV2ResultType;
  primaryFocus: DeepPrimaryFocus;
  secondaryFocus: DeepSecondaryFocus;
  objectiveScores: DeepObjectiveScores;
  finalScores: DeepFinalScores;
  confidence: number;
  answeredCount: number;
  totalCount: number; // 14
}

// ==========================================
// [P1-2] Explainability (optional, backward-compatible)
// ==========================================

/** confidence_breakdown.final_confidence가 있으면 SSOT, 없으면 legacy confidence 사용 */
export interface ConfidenceBreakdown {
  base_confidence?: number;
  gap_bonus?: number;
  final_confidence: number;
}

export interface EvidenceQuality {
  answered_ratio?: number;
  pain_detail?: 'none' | 'partial' | 'full';
}

export interface Rationale {
  summary?: string;
  top_positive_signals?: string[];
  caution_reason?: string;
}

export interface DecisionTrace {
  primary_axis?: string;
  secondary_axis?: string;
  level_reason?: string;
}

/** scores.derived.explainability 또는 derived 내 개별 필드로 전달 */
export interface DeepExplainability {
  confidence_breakdown?: ConfidenceBreakdown;
  evidence_quality?: EvidenceQuality;
  rationale?: Rationale;
  decision_trace?: DecisionTrace;
}

/** * 🚀 [SSOT 핵심] 7일 루틴 자동 생성 API가 소비할 V2 확장 인터페이스
 * (이 데이터가 서버 알고리즘의 유일한 판단 기준이 됩니다)
 */
export interface DeepV2ExtendedResult extends DeepV2Result {
  level: number;                          // 1 (초보/재활), 2 (일반), 3 (강화)
  focus_tags: string[];                   // 템플릿 추출용 목표 태그 (예: ['glute_activation'])
  avoid_tags: string[];                   // 절대 금지 태그 (예: ['knee_load', 'shoulder_overhead'])
  algorithm_scores: DeepAlgorithmScores;  // 알고리즘 내부 계산용 상세 점수 객체
}

// ==========================================
// [PR-ALG-01] Deep V3 (상태벡터 스코어링)
// ==========================================

/** deep_v3 상태벡터 6축 */
export type DeepV3StateVector = {
  lower_stability: number;
  lower_mobility: number;
  upper_mobility: number;
  trunk_control: number;
  asymmetry: number;
  deconditioned: number;
};

/** deep_v3 pain_mode: 보호모드 게이트 */
export type DeepV3PainMode = 'none' | 'caution' | 'protected';

/** deep_v3 권장 타입 (설명용) */
export type DeepV3Type =
  | 'LOWER_INSTABILITY'
  | 'LOWER_MOBILITY_RESTRICTION'
  | 'UPPER_IMMOBILITY'
  | 'CORE_CONTROL_DEFICIT'
  | 'DECONDITIONED'
  | 'STABLE';

/** deep_v3 derived 확장 (기존 + 신규) */
export interface DeepV3ExtendedDerived extends DeepV2ExtendedResult {
  primary_type?: DeepV3Type;
  secondary_type?: DeepV3Type | null;
  priority_vector?: DeepV3StateVector;
  pain_mode?: DeepV3PainMode;
}