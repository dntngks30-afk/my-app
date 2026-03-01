/**
 * DeepResultV2 SSOT — 루틴 엔진이 소비하는 유일한 derived 계약
 *
 * answers → calculateDeepV2 → extendDeepV2 → DeepResultV2(derived)
 * 루틴 엔진은 answers를 직접 해석하지 않고 derived만 사용한다.
 */

import type {
  DeepV2ExtendedResult,
  DeepV2ResultType,
  DeepObjectiveScores,
  DeepFinalScores,
  DeepAlgorithmScores,
} from '@/lib/deep-test/types';

/** 6개 결과 타입 유지 */
export type DeepResultV2Type = DeepV2ResultType;

/**
 * DeepResultV2 — deep_test_attempts.scores.derived에 저장되는 SSOT
 * extendDeepV2(calculateDeepV2(answers)) 반환 타입과 동일
 */
export type DeepResultV2 = DeepV2ExtendedResult;

export type {
  DeepObjectiveScores,
  DeepFinalScores,
  DeepAlgorithmScores,
};
