/**
 * PR-V2-03 — Free Survey Baseline Deep Result V2 빌더
 *
 * free survey answers → DeepScoringEvidence → runDeepScoringCore
 * → UnifiedDeepResultV2 (baseline) 생성 파이프라인.
 *
 * 파이프라인:
 *   1. freeSurveyAnswersToEvidence()   : 답변 → 채널 독립 evidence
 *   2. runDeepScoringCore()            : evidence → DeepScoringCoreResult
 *   3. coreResultToUnifiedV2()         : core 결과 → UnifiedDeepResultV2
 *   4. validateUnifiedDeepResultV2()   : 계약 검증 (실패 시 throw)
 *   5. baseline_meta 스탬프            : result_stage='baseline' 등
 *
 * ─── Confidence 정규화 규칙 ──────────────────────────────────────────────────
 * confidence는 전적으로 scoring core에서 계산된다.
 * - confidence_base  = answered_count / 18  (설문 완성도)
 * - confidence_gap_bonus = 1~2차 축 점수 차이 기반 (최대 0.15)
 * 이 값은 이미 0~1 범위(V2 시맨틱)이며, 기존 free-score 필드(avg6 등)를
 * 신뢰도로 재해석하여 passthrough하지 않는다.
 *
 * ─── Evidence_level 결정 규칙 ────────────────────────────────────────────────
 * - 설문 미완성(answered < 18): 'lite'
 * - 설문 완성 + confidence >= 0.6: 'partial'
 * - 설문 완성 + confidence < 0.6: 'lite'
 * - 'full'은 절대 반환하지 않는다 (통증 신호 없음 / 객관 테스트 없음)
 *
 * ─── V2-04 경계 ──────────────────────────────────────────────────────────────
 * 이 빌더는 callable seam을 제공한다.
 * V2-04는 이 함수를 import하여 baseline을 생성하고, camera evidence와 결합한다.
 *
 * @see src/lib/deep-v2/adapters/free-survey-to-evidence.ts
 * @see src/lib/deep-scoring-core/core.ts
 * @see src/lib/result/deep-result-v2-contract.ts
 */

import type { TestAnswerValue } from '@/features/movement-test/v2';
import { runDeepScoringCore } from '@/lib/deep-scoring-core/core';
import type { DeepScoringCoreResult } from '@/lib/deep-scoring-core/types';
import {
  validateUnifiedDeepResultV2,
  type UnifiedDeepResultV2,
  type EvidenceLevel,
  type PainMode,
} from '@/lib/result/deep-result-v2-contract';
import { freeSurveyAnswersToEvidence } from '../adapters/free-survey-to-evidence';
import type { FreeSurveyBaselineResult } from '../types';

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

/**
 * evidence_level 결정.
 * 자유 설문은 최대 'partial' — 통증 데이터 없음, 객관 테스트 없음.
 */
function resolveEvidenceLevel(
  answeredCount: number,
  totalCount: number,
  confidence: number
): EvidenceLevel {
  const ratio = totalCount > 0 ? answeredCount / totalCount : 0;
  if (ratio < 1.0) return 'lite';
  if (confidence >= 0.6) return 'partial';
  return 'lite';
}

/**
 * 요약 문구 생성 (baseline 표시용).
 * 최종 결과 문구가 아님을 명시한다.
 */
function buildBaselineSummaryCopy(primaryType: string): string {
  const copies: Record<string, string> = {
    LOWER_INSTABILITY:         '하체 안정성 패턴이 주요하게 나타났습니다. 기초 안정화 훈련을 우선합니다.',
    LOWER_MOBILITY_RESTRICTION:'하체 가동성 제한 패턴이 확인됩니다. 발목/고관절 가동성 회복을 우선합니다.',
    UPPER_IMMOBILITY:          '상체 가동성 제한 패턴이 확인됩니다. 흉추 이동성과 어깨 가동성 회복을 우선합니다.',
    CORE_CONTROL_DEFICIT:      '체간 조절 패턴이 주요하게 나타났습니다. 코어 안정화와 호흡 협응을 우선합니다.',
    DECONDITIONED:             '복합 패턴이 확인됩니다. 전반적인 기초 조절 능력 회복을 우선합니다.',
    STABLE:                    '전반적으로 균형이 잡힌 움직임 패턴입니다.',
    UNKNOWN:                   '패턴 파악에 추가 정보가 필요합니다.',
  };
  const base = copies[primaryType] ?? '움직임 패턴 분석이 완료되었습니다.';
  return `${base} (설문 기반 기초 분석입니다.)`;
}

/**
 * DeepScoringCoreResult → UnifiedDeepResultV2 변환.
 *
 * ScoringPrimaryType ⊂ UnifiedPrimaryType 이므로 직접 캐스트 가능.
 * 차이점: UnifiedPrimaryType에는 'UNKNOWN'이 있으나 core는 반환하지 않는다.
 */
function coreResultToUnifiedV2(
  coreResult: DeepScoringCoreResult,
  answeredCount: number,
  totalCount: number,
  originalAnimalType: string | undefined
): UnifiedDeepResultV2 {
  const evidenceLevel = resolveEvidenceLevel(
    answeredCount,
    totalCount,
    coreResult.confidence
  );

  // scoring core의 pain_mode는 ScoringPainMode = 'none'|'caution'|'protected'
  // UnifiedDeepResultV2의 pain_mode는 PainMode | null
  // free survey는 pain 데이터 없으므로 항상 'none' (core도 undefined 입력 시 'none' 반환)
  const painMode: PainMode = coreResult.pain_mode as PainMode;

  return {
    primary_type: coreResult.primary_type,
    secondary_type: coreResult.secondary_type,
    priority_vector: coreResult.priority_vector,
    pain_mode: painMode,
    confidence: coreResult.confidence,
    evidence_level: evidenceLevel,
    source_mode: 'free_survey',
    missing_signals: coreResult.missing_signals,
    reason_codes: coreResult.reason_codes,
    summary_copy: buildBaselineSummaryCopy(coreResult.primary_type),
    _compat: {
      mainType: originalAnimalType,
      // PR-SCORING-META-ALIGN: canonical deep family 기준 = 'deep_v2'.
      // 과거 'free_survey_v2_core' 스탬프는 compat/historical 용도였으나,
      // buildSessionDeepSummaryFromPublicResult의 normalization guard와 정렬하여
      // 이제부터 canonical 값을 직접 씁니다.
      scoring_version: 'deep_v2',
    },
  };
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * buildFreeSurveyBaselineResult — 무료 설문 → baseline Deep Result V2 생성
 *
 * @param answers 무료 설문 답변 맵 (key=질문ID, value=0~4 또는 undefined)
 * @returns FreeSurveyBaselineResult (result + baseline_meta)
 * @throws Error if the produced UnifiedDeepResultV2 fails contract validation
 *
 * 사용 예:
 * ```typescript
 * const session = JSON.parse(localStorage.getItem('movementTestSession:v2') ?? '{}');
 * const baseline = buildFreeSurveyBaselineResult(session.answersById ?? {});
 * // baseline.result: UnifiedDeepResultV2 (계약 검증 완료)
 * // baseline.baseline_meta.result_stage === 'baseline'
 * ```
 */
export function buildFreeSurveyBaselineResult(
  answers: Record<string, TestAnswerValue | undefined>
): FreeSurveyBaselineResult {
  // Step 1: raw answers → DeepScoringEvidence
  const evidence = freeSurveyAnswersToEvidence(answers);

  // Step 2: evidence → DeepScoringCoreResult (채널 독립 scoring core)
  const coreResult = runDeepScoringCore(evidence);

  // 원본 동물 타입 보존 (_compat용)
  // calculateScoresV2는 이미 evidence 생성 시 호출됐으므로 재호출 없이
  // reason_codes에서 top_axis 정보를 활용하거나 단순히 primary_type에서 파생.
  // 단, _compat.mainType은 동물 이름이므로 별도로 유지하지 않고 undefined 허용.
  // (V2-04에서 필요하면 extractor를 통해 ScoreResultV2.mainAnimal을 전달 가능)
  const originalAnimalType = undefined;

  // Step 3: DeepScoringCoreResult → UnifiedDeepResultV2
  const unifiedResult = coreResultToUnifiedV2(
    coreResult,
    evidence.answered_count,
    evidence.total_count,
    originalAnimalType
  );

  // Step 4: 계약 검증 (실패 시 throw — 테스트에서 명확히 포착)
  const validation = validateUnifiedDeepResultV2(unifiedResult);
  if (!validation.valid) {
    throw new Error(
      `[buildFreeSurveyBaselineResult] Deep Result V2 contract validation failed:\n` +
      validation.errors.join('\n')
    );
  }

  // Step 5: baseline_meta 스탬프
  const baselineResult: FreeSurveyBaselineResult = {
    result: unifiedResult,
    baseline_meta: {
      result_stage: 'baseline',
      source_inputs: ['free_survey'],
      refinement_available: true,
      generated_at: new Date().toISOString(),
      // PR-SCORING-META-ALIGN: canonical deep family 기준.
      // 과거 'free_survey_v2_core'에서 'deep_v2'로 정렬됨.
      scoring_version: 'deep_v2',
    },
  };

  return baselineResult;
}
