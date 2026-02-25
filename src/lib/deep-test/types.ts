/**
 * Deep Test 전용 타입 정의
 * Free 스코어 스키마와 완전 분리
 */

export type DeepAnswerValue = number | boolean | string | null;

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
