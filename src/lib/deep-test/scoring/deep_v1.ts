/**
 * Deep Test v1 스코어링 - 완전 결정적(Deterministic)
 * Free 스코어 로직과 무관한 전용 구현
 */

import type { DeepAnswerValue } from '../types';
import type { DeepV1Result, DeepV1Scores } from '../types';

const SCORING_VERSION = 'deep_v1';

/** v0 질문 ID → t 축 매핑 */
const QUESTION_TO_AXIS: Record<string, 1 | 2 | 3 | 4 | 5> = {
  d1: 1,
  d2: 2,
  d3: 3,
  d4: 4,
  d5: 5,
};

/** 가중치 (v0: 균등) */
const WEIGHT = 1;

function toNumber(v: DeepAnswerValue): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * answers 기반 deep_v1 스코어 계산
 * - scores: t1~t5 (0~1 정규화)
 * - result_type: 최고점 축
 * - confidence: 응답 비율 (unknown/skip 적을수록 높음)
 */
export function calculateDeepV1(
  answers: Record<string, DeepAnswerValue>
): DeepV1Result {
  const raw: DeepV1Scores = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 };
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let answeredCount = 0;
  let totalRelevant = 0;

  for (const [qId, value] of Object.entries(answers)) {
    const axis = QUESTION_TO_AXIS[qId];
    if (!axis) continue;

    totalRelevant += 1;
    const n = toNumber(value);
    if (n !== null) {
      raw[`t${axis}` as keyof DeepV1Scores] += n * WEIGHT;
      counts[axis] += 1;
      answeredCount += 1;
    }
  }

  // 0~1 정규화 (최대 4점 가정, 0~4 스케일)
  const maxPerAxis = 4;
  const scores: DeepV1Scores = {
    t1: Math.min(1, raw.t1 / maxPerAxis),
    t2: Math.min(1, raw.t2 / maxPerAxis),
    t3: Math.min(1, raw.t3 / maxPerAxis),
    t4: Math.min(1, raw.t4 / maxPerAxis),
    t5: Math.min(1, raw.t5 / maxPerAxis),
  };

  // result_type: 최고점 축
  const entries = [
    ['T1', scores.t1],
    ['T2', scores.t2],
    ['T3', scores.t3],
    ['T4', scores.t4],
    ['T5', scores.t5],
  ] as const;
  entries.sort((a, b) => b[1] - a[1]);
  const result_type = entries[0][0];

  // confidence: 응답 비율 (0~1)
  const confidence =
    totalRelevant > 0 ? Math.round((answeredCount / totalRelevant) * 100) / 100 : 0;

  return {
    scores,
    result_type,
    confidence,
  };
}

export { SCORING_VERSION };
