/**
 * PR-V2-03 / PR-PUBLIC-SURVEY-EVIDENCE-DIRECT-07C — Free Survey → DeepScoringEvidence
 *
 * 무료 설문 답변(18문항, 0~4 척도)을 채널 독립 Deep Scoring Core V2가
 * 요구하는 `DeepScoringEvidence` 형식으로 변환한다.
 *
 * 07C: `calculateScoresV2` (동물 축 레거시 브리지) 의존 제거.
 * 설문 도메인 점수 → deep evidence 매핑을 이 파일에 명시적으로 둔다.
 *
 * 설계 원칙:
 * - 보수적 스케일: 자기보고 설문은 객관 움직임 테스트보다 정밀도가 낮으므로
 *   evidence 값을 paid test 대비 최대 2.5 수준으로 캡핑한다.
 * - 0 대체 없음: 미응답 문항은 missing_signals에 기록한다.
 * - pain 신호 없음: 무료 설문에는 통증 문항이 없으므로 전부 undefined.
 * - MONKEY 타입 = 균형형: movement axis_scores를 모두 0으로 세팅하여
 *   scoring core가 STABLE로 분류하도록 유도한다.
 *
 * 도메인 점수(0~100) 산출:
 * - `scoring.v2.ts`의 per-axis 가중 합(W1/W2/W3, q1 캡)과 **동일한 수식**을 인라인.
 * - 분기(MONKEY / COMPOSITE / BASIC)는 `getCompositeTagV2`와 동일 규칙 유지.
 *
 * 축 매핑 (도메인 점수 → evidence 축) — 기존 주석과 동일:
 *
 * | 도메인(동물 라벨) | evidence 축       | 스케일       |
 * |------------------|------------------|-------------|
 * | kangaroo         | trunk_control    | ×2.0/100    |
 * | turtle           | trunk_control    | ×1.0/100    |
 * | hedgehog         | upper_mobility   | ×2.5/100    |
 * | penguin          | lower_stability  | ×2.5/100    |
 * | penguin          | lower_mobility   | ×0.4/100    |
 * | crab             | asymmetry        | ×2.0/100    |
 * | meerkat          | deconditioned    | ×2.0/100    |
 *
 * @see src/features/movement-test/v2/scoring/scoring.v2.ts (도메인 점수 수식 SSOT)
 * @see src/features/movement-test/v2/scoring/composite.rules.ts (복합 타입 판정)
 * @see src/lib/deep-scoring-core/core.ts
 */

import type { AnimalAxis, TestAnswerValue } from '@/features/movement-test/v2';
import { ANIMAL_AXES } from '@/features/movement-test/v2';
import { getCompositeTagV2 } from '@/features/movement-test/v2/scoring/composite.rules';
import type { DeepScoringEvidence, AxisScores } from '@/lib/deep-scoring-core/types';

// ─── 상수 (scoring.v2.ts 와 동일 — 도메인 점수 SSOT) ─────────────────────────

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

/** 축별 문항 ID — scoring.v2 AXIS_QUESTION_IDS 와 동일 */
const AXIS_QUESTION_IDS: Record<AnimalAxis, [string, string, string]> = {
  turtle: ['v2_A1', 'v2_A2', 'v2_A3'],
  hedgehog: ['v2_B1', 'v2_B2', 'v2_B3'],
  kangaroo: ['v2_C1', 'v2_C2', 'v2_C3'],
  penguin: ['v2_D1', 'v2_D2', 'v2_D3'],
  crab: ['v2_F1', 'v2_F2', 'v2_F3'],
  meerkat: ['v2_G1', 'v2_G2', 'v2_G3'],
};

const W1 = 1.4;
const W2 = 1.2;
const W3 = 1.0;
const MAX_RAW = 14.4; // 4*1.4 + 4*1.2 + 4*1.0

const EMPTY_AXIS: Record<AnimalAxis, number> = {
  turtle: 0,
  hedgehog: 0,
  kangaroo: 0,
  penguin: 0,
  crab: 0,
  meerkat: 0,
};

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
 * 도메인 점수 계산용 값 해석 — scoring.v2 `resolveValue` 와 동일.
 * 미응답은 계산 시 2(중간값)로 치환 (기존 calculateScoresV2 동작과 정합).
 */
function resolveValueForDomainScore(
  answers: Record<string, TestAnswerValue | undefined>,
  qId: string
): number {
  const v = answers[qId];
  if (v === undefined || v === null) return 2;
  return v as number;
}

function populationStd(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const sumSq = values.reduce((s, x) => s + (x - avg) ** 2, 0);
  return Math.sqrt(sumSq / values.length);
}

type SurveyPattern =
  | 'MONKEY'
  | 'COMPOSITE_ARMADILLO'
  | 'COMPOSITE_SLOTH'
  | 'BASIC';

/**
 * 설문 답변으로부터 6도메인 0~100 점수 + 결과 분기 패턴 산출.
 * scoring.v2 `calculateScoresV2` 와 동일한 수식·분기 (calculateScoresV2 호출 없음).
 */
function computeDomainScoresAndPattern(
  answers: Record<string, TestAnswerValue | undefined>
): {
  axisScores: Record<AnimalAxis, number>;
  resultType: SurveyPattern;
} {
  const axisScores = { ...EMPTY_AXIS } as Record<AnimalAxis, number>;
  const q1Values: Record<AnimalAxis, number> = {} as Record<AnimalAxis, number>;

  for (const axis of ANIMAL_AXES) {
    const [id1, id2, id3] = AXIS_QUESTION_IDS[axis];
    const q1 = resolveValueForDomainScore(answers, id1);
    const q2 = resolveValueForDomainScore(answers, id2);
    const q3 = resolveValueForDomainScore(answers, id3);
    q1Values[axis] = q1;

    let raw = q1 * W1 + q2 * W2 + q3 * W3;
    let base = (raw / MAX_RAW) * 100;
    if (q1 <= 2) base = Math.min(base, 75);
    axisScores[axis] = Math.round(base * 100) / 100;
  }

  const sorted = ([...ANIMAL_AXES] as AnimalAxis[])
    .map((axis) => ({ axis, score: axisScores[axis] }))
    .sort((a, b) => b.score - a.score);

  const top1Axis = sorted[0]!.axis;
  const top2Axis = sorted[1]!.axis;
  const top3Axis = sorted[2]!.axis;
  const top1 = sorted[0]!.score;
  const top2 = sorted[1]!.score;
  const top3 = sorted[2]!.score;

  const avg =
    ANIMAL_AXES.reduce((s, a) => s + axisScores[a], 0) / ANIMAL_AXES.length;
  const std = populationStd(
    ANIMAL_AXES.map((a) => axisScores[a]),
    avg
  );

  const triggerCountTop3 = [top1Axis, top2Axis, top3Axis].filter(
    (a) => q1Values[a] >= 3
  ).length;

  const EPSILON = 0.01;
  const isAll50 = ANIMAL_AXES.every((a) => Math.abs(axisScores[a] - 50) <= EPSILON);

  let resultType: SurveyPattern = 'BASIC';

  if (isAll50 || top1 < 55) {
    resultType = 'MONKEY';
  } else {
    const compositeTag = getCompositeTagV2({
      axisScores,
      top1,
      top2,
      top3,
      top1Axis,
      top2Axis,
      top3Axis,
      avg,
      std,
      triggerCountTop3,
    });
    if (compositeTag === 'armadillo') resultType = 'COMPOSITE_ARMADILLO';
    else if (compositeTag === 'sloth') resultType = 'COMPOSITE_SLOTH';
    else {
      resultType = 'BASIC';
    }
  }

  return { axisScores, resultType };
}

/**
 * 미응답 문항 그룹(도메인) 식별.
 * 도메인 전체가 비어 있으면 해당 신호를 missing으로 기록한다.
 */
function buildMissingSignals(axisScores: Record<AnimalAxis, number>): string[] {
  const missing: string[] = [];

  missing.push('pain_intensity_missing');
  missing.push('pain_location_missing');
  missing.push('objective_movement_test_missing');

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
  const { axisScores, resultType } = computeDomainScoresAndPattern(rawAnswers);
  const answeredCount = countAnswered(rawAnswers);

  if (resultType === 'MONKEY') {
    const deckScore = (axisScores.meerkat / 100) * 2.0;
    const evidence: DeepScoringEvidence = {
      axis_scores: {
        lower_stability: 0,
        lower_mobility: 0,
        upper_mobility: 0,
        trunk_control: 0,
        asymmetry: 0,
        deconditioned: deckScore,
      },
      pain_signals: {
        max_intensity: undefined,
        primary_discomfort_none: undefined,
        has_location_data: false,
      },
      movement_quality: {
        all_good: true,
      },
      answered_count: answeredCount,
      total_count: FREE_SURVEY_TOTAL_COUNT,
      missing_signals: buildMissingSignals(axisScores),
    };
    return evidence;
  }

  const mapped: AxisScores = {
    lower_stability: (axisScores.penguin / 100) * 2.5,
    lower_mobility: (axisScores.penguin / 100) * 0.4,
    upper_mobility: (axisScores.hedgehog / 100) * 2.5,
    trunk_control:
      (axisScores.kangaroo / 100) * 2.0 + (axisScores.turtle / 100) * 1.0,
    asymmetry: (axisScores.crab / 100) * 2.0,
    deconditioned: (axisScores.meerkat / 100) * 2.0,
  };

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
      all_good: false,
    },
    answered_count: answeredCount,
    total_count: FREE_SURVEY_TOTAL_COUNT,
    missing_signals: buildMissingSignals(axisScores),
  };
}

// ─── 설문 UI 요약 (PR-UI-SUMMARY-SCORING-ALIGN) ───────────────────────────────

/**
 * 설문 페이지 UI/세션 보조용 — 6도메인 점수(0~100) 중 최고 축.
 * `computeDomainScoresAndPattern`과 동일 SSOT → baseline `freeSurveyAnswersToEvidence`와 drift 없음.
 * (`calculateScoresV2` 직접 호출 금지 — 07C 이후 canonical truth와 정렬)
 */
export function getSurveyUiAxisSummary(
  answers: Record<string, TestAnswerValue | undefined>
): { topAxis: AnimalAxis; topScore: number } {
  const { axisScores } = computeDomainScoresAndPattern(answers);
  const sorted = (Object.entries(axisScores) as [AnimalAxis, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  return {
    topAxis: sorted[0]?.[0] ?? 'turtle',
    topScore: sorted[0]?.[1] ?? 0,
  };
}

// ─── 회귀/스모크 전용 (제품 경로에서 사용하지 않음) ─────────────────────────────

/**
 * PR-07C: `scripts/free-survey-evidence-parity-smoke.mjs`에서
 * `calculateScoresV2`와 도메인 점수·resultType 일치를 검증할 때만 사용한다.
 */
export function computeDomainScoresAndPatternForRegression(
  answers: Record<string, TestAnswerValue | undefined>
): {
  axisScores: Record<AnimalAxis, number>;
  resultType: SurveyPattern;
} {
  return computeDomainScoresAndPattern(answers);
}
