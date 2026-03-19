/**
 * PR-V2-03 — Free Survey → DeepScoringEvidence 변환기
 *
 * 무료 설문 답변(18문항, 0~4 척도)을 채널 독립 Deep Scoring Core V2가
 * 요구하는 `DeepScoringEvidence` 형식으로 변환한다.
 *
 * 설계 원칙:
 * - 보수적 스케일: 자기보고 설문은 객관 움직임 테스트보다 정밀도가 낮으므로
 *   evidence 값을 paid test 대비 최대 2.5 수준으로 캡핑한다.
 * - 0 대체 없음: 미응답 문항은 missing_signals에 기록한다.
 * - pain 신호 없음: 무료 설문에는 통증 문항이 없으므로 전부 undefined.
 * - MONKEY 타입 = 균형형: movement axis_scores를 모두 0으로 세팅하여
 *   scoring core가 STABLE로 분류하도록 유도한다.
 *
 * 축 매핑 근거 (동물 축 → evidence 축):
 *
 * | 동물 축    | evidence 축       | 스케일       | 근거                         |
 * |-----------|------------------|-------------|------------------------------|
 * | kangaroo  | trunk_control    | ×2.0/100    | 허리/골반 과부하 = 체간 조절 결핍 (주) |
 * | turtle    | trunk_control    | ×1.0/100    | 경추/상부 전방화 = 체간 조절 (보조)  |
 * | hedgehog  | upper_mobility   | ×2.5/100    | 흉추 닫힘/등 굽음 = 상체 가동성 제한  |
 * | penguin   | lower_stability  | ×2.5/100    | 무릎/발목 불안정 = 하체 안정성 결핍   |
 * | penguin   | lower_mobility   | ×0.4/100    | 발목/무릎 → 가동성 제한 proxy (소)  |
 * | crab      | asymmetry        | ×2.0/100    | 편측 의존/비대칭 = 직접 매핑         |
 * | meerkat   | deconditioned    | ×2.0/100    | 전신 긴장 = 저활성 proxy           |
 *
 * 최대 도달 가능 evidence 값 (paid test 비교: 최대 5~7):
 * - lower_stability: 2.5, lower_mobility: 0.4, upper_mobility: 2.5
 * - trunk_control: 3.0, asymmetry: 2.0, deconditioned: 2.0
 *
 * @see src/lib/deep-scoring-core/extractors/paid-survey-extractor.ts (유료 대응 파일)
 * @see src/lib/deep-scoring-core/core.ts (소비 엔진)
 */

import { calculateScoresV2 } from '@/features/movement-test/v2';
import type { TestAnswerValue, AnimalAxis } from '@/features/movement-test/v2';
import type { DeepScoringEvidence, AxisScores } from '@/lib/deep-scoring-core/types';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** 무료 설문 18개 질문 ID (v2_도메인번호 형식) */
const FREE_SURVEY_QUESTION_IDS = [
  'v2_A1', 'v2_A2', 'v2_A3', // turtle
  'v2_B1', 'v2_B2', 'v2_B3', // hedgehog
  'v2_C1', 'v2_C2', 'v2_C3', // kangaroo
  'v2_D1', 'v2_D2', 'v2_D3', // penguin
  'v2_F1', 'v2_F2', 'v2_F3', // crab
  'v2_G1', 'v2_G2', 'v2_G3', // meerkat
] as const;

const FREE_SURVEY_TOTAL_COUNT = FREE_SURVEY_QUESTION_IDS.length; // 18

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

/**
 * 응답된 문항 수 계산.
 * undefined / null 은 미응답으로 취급한다.
 */
function countAnswered(answers: Record<string, TestAnswerValue | undefined>): number {
  return FREE_SURVEY_QUESTION_IDS.filter(
    (id) => answers[id] !== undefined && answers[id] !== null
  ).length;
}

/**
 * 미응답 문항 그룹(도메인) 식별.
 * 도메인 전체가 비어 있으면 해당 신호를 missing으로 기록한다.
 */
function buildMissingSignals(
  axisScores: Record<AnimalAxis, number>
): string[] {
  const missing: string[] = [];

  // 무료 설문에는 통증 문항이 없으므로 항상 누락
  missing.push('pain_intensity_missing');
  missing.push('pain_location_missing');
  // 객관 움직임 테스트(카메라/딥테스트) 없음
  missing.push('objective_movement_test_missing');

  // 0점 축은 미응답일 가능성 있음 — 로그 목적으로 기록
  if (axisScores.kangaroo === 0 && axisScores.turtle === 0) {
    missing.push('trunk_survey_empty');
  }
  if (axisScores.penguin === 0) {
    missing.push('lower_survey_empty');
  }
  if (axisScores.hedgehog === 0) {
    missing.push('upper_survey_empty');
  }

  return missing;
}

// ─── 핵심 변환 함수 ───────────────────────────────────────────────────────────

/**
 * Free survey 답변 → DeepScoringEvidence
 *
 * @param rawAnswers 설문 답변 맵 (key = 질문ID, value = 0~4 또는 undefined)
 * @returns DeepScoringEvidence (채널 독립 scoring core 입력)
 */
export function freeSurveyAnswersToEvidence(
  rawAnswers: Record<string, TestAnswerValue | undefined>
): DeepScoringEvidence {
  // 1) calculateScoresV2로 6축 동물 점수(0~100) 산출
  //    undefined 문항은 내부에서 2(중간값)로 대체되지만,
  //    answered_count는 실제 응답 기준으로 별도 계산한다.
  const safeAnswers = rawAnswers as Record<string, TestAnswerValue>;
  const scoreResult = calculateScoresV2(safeAnswers);
  const { axisScores, resultType } = scoreResult;

  const answeredCount = countAnswered(rawAnswers);

  // 2) MONKEY 타입(균형형) 처리
  //    모든 축이 비슷하게 낮다 → 지배적 패턴 없음 → STABLE
  //    movement axis_scores를 0으로 설정하여 scoring core가 STABLE 분류하도록 유도.
  if (resultType === 'MONKEY') {
    const deckScore = (axisScores.meerkat / 100) * 2.0;
    const evidence: DeepScoringEvidence = {
      axis_scores: {
        lower_stability: 0,
        lower_mobility:  0,
        upper_mobility:  0,
        trunk_control:   0,
        asymmetry:       0,
        deconditioned:   deckScore,
      },
      pain_signals: {
        // 무료 설문: 통증 문항 없음 → 전부 undefined (0 대체 금지)
        max_intensity: undefined,
        primary_discomfort_none: undefined,
        has_location_data: false,
      },
      movement_quality: {
        // MONKEY = 균형형 → 전반적으로 양호 판정
        all_good: true,
      },
      answered_count: answeredCount,
      total_count: FREE_SURVEY_TOTAL_COUNT,
      missing_signals: buildMissingSignals(axisScores),
    };
    return evidence;
  }

  // 3) 일반 패턴 타입 매핑 (BASIC / COMPOSITE_ARMADILLO / COMPOSITE_SLOTH)
  //
  //    스케일 근거: 자기보고 설문은 객관 테스트보다 신호 강도가 약하므로
  //    최대값을 2.5~3.0 수준으로 제한한다 (유료 테스트 최대 5~7 대비).
  //    두 동물 축이 같은 evidence 축을 공유할 때는 가중 합산한다.
  const mapped: AxisScores = {
    lower_stability: (axisScores.penguin / 100) * 2.5,
    lower_mobility:  (axisScores.penguin / 100) * 0.4,   // 발목 가동성 proxy (소)
    upper_mobility:  (axisScores.hedgehog / 100) * 2.5,
    // trunk_control = 허리/골반(kangaroo) 주 + 경추/상부(turtle) 보조
    trunk_control:   (axisScores.kangaroo / 100) * 2.0 + (axisScores.turtle / 100) * 1.0,
    asymmetry:       (axisScores.crab / 100) * 2.0,
    deconditioned:   (axisScores.meerkat / 100) * 2.0,
  };

  // 4) COMPOSITE 타입 처리
  //    armadillo/sloth는 복합 패턴 = 여러 축이 동시에 높음.
  //    deconditioned를 7.0으로 설정해 scoring core의 DECONDITIONED gate 활성화.
  //    (gate 조건: deconditioned >= 6 AND maxMovement <= deconditioned - 1)
  if (resultType === 'COMPOSITE_ARMADILLO' || resultType === 'COMPOSITE_SLOTH') {
    mapped.deconditioned = 7.0;
  }

  return {
    axis_scores: mapped,
    pain_signals: {
      max_intensity: undefined,
      primary_discomfort_none: undefined,
      has_location_data: false,
    },
    movement_quality: {
      // 비-MONKEY 타입은 지배적 패턴 존재 → 전반적 양호 아님
      all_good: false,
    },
    answered_count: answeredCount,
    total_count: FREE_SURVEY_TOTAL_COUNT,
    missing_signals: buildMissingSignals(axisScores),
  };
}
