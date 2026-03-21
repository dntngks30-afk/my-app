/**
 * PR-V2-03 — Free Survey Baseline 전용 타입 정의
 *
 * `FreeSurveyBaselineResult`는 UnifiedDeepResultV2를 감싸는 래퍼다.
 * result 필드 자체는 표준 계약(UnifiedDeepResultV2)을 만족한다.
 * baseline_meta는 V2-04 연결 및 UI 분기를 위한 메타데이터를 보관한다.
 *
 * V2-04는 이 타입의 `result`를 직접 소비하면 된다.
 * `baseline_meta.result_stage === 'baseline'`으로 최종 결과와 구분한다.
 */

import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

// ─── Baseline 메타데이터 ──────────────────────────────────────────────────────

/**
 * Free survey 기반 baseline 생성 메타데이터.
 * `result_stage = 'baseline'`이면 아직 최종 결과가 아님을 명시한다.
 *
 * V2-04 이후 camera / paid 보강을 통해 `result_stage = 'refined' | 'final'`로 승급한다.
 *
 * PR-SCORING-META-ALIGN: scoring_version canonical family = 'deep_v2'.
 * 과거 'free_survey_v2_core' 값은 compat/historical 용도로만 존재한다.
 */
export interface FreeSurveyBaselineMeta {
  /** 이 결과는 baseline 전용 — 설문 기반 초기 해석 */
  result_stage: 'baseline';
  /** 이 결과를 생성한 입력 채널 목록 */
  source_inputs: readonly ['free_survey'];
  /** 카메라/딥테스트로 보강 가능 여부 (V2-03 항상 true) */
  refinement_available: true;
  /** 생성 시각 (ISO 8601) */
  generated_at: string;
  /**
   * Canonical scoring family 식별자.
   * 'deep_v2' = canonical deep family (template pool 조회 키와 정렬됨).
   * 하위 호환: 과거 'free_survey_v2_core' 값을 읽는 경우는
   * buildSessionDeepSummaryFromPublicResult에서 자동 normalize된다.
   */
  scoring_version: 'deep_v2';
}

// ─── Baseline 결과 래퍼 ───────────────────────────────────────────────────────

/**
 * Free survey baseline 결과.
 *
 * @field result       - 표준 Deep Result V2 계약 (validateUnifiedDeepResultV2 통과)
 * @field baseline_meta - V2-03 baseline 메타데이터
 *
 * 소비 레이어(V2-04, result renderer 등)는 `result`를 직접 사용하고
 * `baseline_meta.result_stage`로 최종 결과인지 판단한다.
 */
export interface FreeSurveyBaselineResult {
  result: UnifiedDeepResultV2;
  baseline_meta: FreeSurveyBaselineMeta;
}
