/**
 * Deep Test 전용 타입 정의
 * Free 스코어 스키마와 완전 분리
 */

export type DeepAnswerValue = number | boolean | string | string[] | null;

/** deep_v1 스코어 결과 (t1~t5) */
export type DeepV1Scores = {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  t5: number;
};

/** deep_v1 결과 타입 */
export type DeepV1ResultType = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/** deep_v1 스코어링 결과 */
export interface DeepV1Result {
  scores: DeepV1Scores;
  result_type: DeepV1ResultType;
  confidence: number; // 0~1
}

// ========== Deep V2 ==========

/** deep_v2 결과 타입 */
export type DeepV2ResultType =
  | 'NECK-SHOULDER'
  | 'LUMBO-PELVIS'
  | 'UPPER-LIMB'
  | 'LOWER-LIMB'
  | 'DECONDITIONED'
  | 'STABLE';

/** 부위 포커스 */
export type DeepFocus =
  | 'NECK-SHOULDER'
  | 'LUMBO-PELVIS'
  | 'UPPER-LIMB'
  | 'LOWER-LIMB';

export type DeepPrimaryFocus = DeepFocus | 'FULL';
export type DeepSecondaryFocus = DeepFocus | 'NONE';

/** N=LUMBO? No - spec says N=NECK-SHOULDER, L=LUMBO-PELVIS, U=UPPER-LIMB, Lo=LOWER-LIMB, D=DECONDITIONED */
export type DeepObjectiveScores = {
  N: number; // 목·어깨
  L: number; // 허리·골반
  U: number; // 손목·팔꿈치
  Lo: number; // 무릎·발목
  D: number; // 전신/탈조건
};

export type DeepFinalScores = DeepObjectiveScores;

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
