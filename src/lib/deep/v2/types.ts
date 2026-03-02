/**
 * DeepResultV2 SSOT 계약
 *
 * 루틴 엔진이 소비하는 유일한 derived 데이터 형식.
 * answers를 직접 해석하지 않고, 이 타입만 사용한다.
 *
 * @see docs/deep-v2-ssot.md
 */

import type {
  DeepV2ExtendedResult,
  DeepV2ResultType,
  DeepObjectiveScores,
  DeepFinalScores,
  DeepAlgorithmScores,
} from '@/lib/deep-test/types';

/** SSOT: 루틴 엔진 소비용 derived 결과 (extendDeepV2 출력) */
export type DeepResultV2 = DeepV2ExtendedResult;

/** 6개 결과 타입 (유지) */
export type DeepResultV2Type = DeepV2ResultType;

export type {
  DeepObjectiveScores,
  DeepFinalScores,
  DeepAlgorithmScores,
};
