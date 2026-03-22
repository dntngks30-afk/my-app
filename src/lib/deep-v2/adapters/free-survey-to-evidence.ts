/**
 * PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01 — Free Survey → DeepScoringEvidence
 *
 * 무료 설문 18문항 답변을 Deep Scoring Core V2의 `DeepScoringEvidence`로 변환한다.
 * 이번 PR에서 animal-domain intermediate(turtle/hedgehog/kangaroo/penguin/crab/meerkat)
 * 중심 구조를 제거하고, 18문항 → deep axis 6개 직접 다축 매핑으로 전환한다.
 *
 * ─── 변경 요약 ─────────────────────────────────────────────────────────────────
 * 기존(07C): 18문항 → animal-domain 점수(0~100) → domain-to-axis 매핑 → evidence
 * 신규(이번): 18문항 → direct multi-axis raw 누적 → 정규화 → 스케일 → evidence
 *
 * ─── 파이프라인 ────────────────────────────────────────────────────────────────
 * 1. applyFamilyCapRules       : 문항별 기여 누적 + q1≤2 상한 75% 캡
 * 2. normalizeSurveyAxisScores : raw / axis_max → 0~1
 * 3. applyStableCandidateRule  : MONKEY 대체 — movement concern 낮으면 stable 유도
 * 4. applyDeconditionedBoostRule : COMPOSITE 대체 — 복합 고부하 패턴 → decond 부스트
 * 5. 최종 스케일 곱 (AXIS_TARGET_SCALE)
 * 6. buildMissingSignalsFromSurveyAnswers : 누락 신호 기록
 *
 * ─── 스케일 원칙 ───────────────────────────────────────────────────────────────
 * - axis_raw[a] = Σ answer[q] * slotWeight[q] * axisShare[q,a]  (2-replacement for missing)
 * - axis_max[a] = Σ 4 * slotWeight[q] * axisShare[q,a]         (이론적 최대, cap 전)
 * - normalized[a] = axis_raw_capped[a] / axis_max[a]            (0~1)
 * - final[a] = normalized[a] * AXIS_TARGET_SCALE[a]             (core 기대 magnitude)
 *
 * ─── 수치 보고서 ───────────────────────────────────────────────────────────────
 * axis_max 계산값 (모든 질문 응답=4 기준):
 *   lower_stability : 13.08
 *   lower_mobility  :  8.52
 *   upper_mobility  : 22.88
 *   trunk_control   : 27.96
 *   asymmetry       : 10.48
 *   deconditioned   :  3.48
 *
 * AXIS_TARGET_SCALE (자기보고 설문 보수적 상한, paid 대비 최대 2.5 수준):
 *   lower_stability : 2.5  (구 penguin evidence max와 동일)
 *   lower_mobility  : 0.5  (직접 매핑으로 구 0.4에서 소폭 상향)
 *   upper_mobility  : 2.5  (구 hedgehog evidence max와 동일)
 *   trunk_control   : 2.5  (구 kangaroo+turtle max 3.0에서 보수적 조정)
 *   asymmetry       : 2.0  (구 crab evidence max와 동일)
 *   deconditioned   : 2.0  (구 meerkat evidence max와 동일)
 *
 * ─── STABLE / DECONDITIONED helper 설계 ────────────────────────────────────────
 * applyStableCandidateRule:
 *   movement 5축 normalized 모두 < 0.55 AND decond normalized < 0.55
 *   → movement 축 zeroing + all_good=true (구 MONKEY path 동작 재현)
 *   → isStableEvidence()의 strict-zero 조건과 호환
 *
 * applyDeconditionedBoostRule (BROAD_CONCERN — 구 COMPOSITE_ARMADILLO 대응):
 *   movement 5축 중 4개 이상 normalized ≥ 0.65 AND decond normalized ≥ 0.50
 *   → deconditioned = 7.0 강제 (구 COMPOSITE forced 값과 동일)
 *   → core의 DECONDITIONED gate: decond ≥ 6 && maxPart ≤ decond−1 충족
 *
 * COMPOSITE_SLOTH 대응은 이번 PR 범위 밖 (follow-up 예정).
 *
 * ─── q1≤2 캡 대체 ──────────────────────────────────────────────────────────────
 * 각 family의 q1 ≤ 2이면 해당 family의 축 기여를 75% family-max로 상한 clamp.
 * 구 코드의 "domain score ≤ 75" 효과를 다축 구조 안에서 per-family로 재현.
 *
 * ─── 회귀 비교 ─────────────────────────────────────────────────────────────────
 * 기존 animal-domain 경로는 computeDomainScoresAndPatternForRegression으로 유지.
 * scripts/free-survey-multi-axis-regression.mjs 에서 비교 가능.
 *
 * @see src/lib/deep-scoring-core/core.ts
 * @see src/lib/deep-scoring-core/types.ts
 */

import type { AnimalAxis, TestAnswerValue } from '@/features/movement-test/v2';
import { ANIMAL_AXES } from '@/features/movement-test/v2';
import { getCompositeTagV2 } from '@/features/movement-test/v2/scoring/composite.rules';
import type { DeepScoringEvidence, AxisScores } from '@/lib/deep-scoring-core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// 공통 상수
// ═══════════════════════════════════════════════════════════════════════════════

/** 무료 설문 18개 질문 ID */
const FREE_SURVEY_QUESTION_IDS = [
  'v2_A1', 'v2_A2', 'v2_A3',
  'v2_B1', 'v2_B2', 'v2_B3',
  'v2_C1', 'v2_C2', 'v2_C3',
  'v2_D1', 'v2_D2', 'v2_D3',
  'v2_F1', 'v2_F2', 'v2_F3',
  'v2_G1', 'v2_G2', 'v2_G3',
] as const;

const FREE_SURVEY_TOTAL_COUNT = FREE_SURVEY_QUESTION_IDS.length; // 18

/**
 * 응답된 문항 수 계산.
 * undefined / null 은 미응답으로 취급한다.
 */
function countAnswered(answers: Record<string, TestAnswerValue | undefined>): number {
  return FREE_SURVEY_QUESTION_IDS.filter(
    (id) => answers[id] !== undefined && answers[id] !== null
  ).length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A: 신규 다축 매핑 (PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 다축 매핑 테이블 ──────────────────────────────────────────────────────────

/**
 * 문항별 deep axis 기여 비율 (sparse multi-axis mapping v1).
 * 각 행의 share 합 = 1.0.
 *
 * 그룹별 의미:
 *   A: 경추·어깨 전방화 (상부 전방 → upper_mobility + trunk_control)
 *   B: 가슴 닫힘·등 굽음 (흉추 제한 → upper_mobility 강함)
 *   C: 허리 과부하·골반 지지 부족 (trunk_control 주, lower 보조)
 *   D: 무릎·발목 불안정 (lower_stability / lower_mobility 직접)
 *   F: 편측 의존·비대칭 (asymmetry 주)
 *   G: 전신 긴장·guarding (upper_mobility + trunk_control, deconditioned 보조)
 *      주의: G군은 디컨디셔닝보다 guarding/tension 성격이 강하므로
 *            deconditioned 비율을 낮게(0.10~0.30) 설정.
 */
const QUESTION_AXIS_SHARES: Record<string, Partial<Record<keyof AxisScores, number>>> = {
  // A 그룹 — 경추·어깨 전방화
  v2_A1: { upper_mobility: 0.40, trunk_control: 0.60 },
  v2_A2: { upper_mobility: 0.45, trunk_control: 0.55 },
  v2_A3: { upper_mobility: 0.35, trunk_control: 0.65 },
  // B 그룹 — 가슴 닫힘·흉추 굴곡
  v2_B1: { upper_mobility: 0.75, trunk_control: 0.25 },
  v2_B2: { upper_mobility: 0.85, trunk_control: 0.15 },
  v2_B3: { upper_mobility: 0.55, trunk_control: 0.45 },
  // C 그룹 — 허리 과부하
  v2_C1: { lower_stability: 0.10, lower_mobility: 0.30, trunk_control: 0.60 },
  v2_C2: { lower_stability: 0.15, lower_mobility: 0.15, trunk_control: 0.55, deconditioned: 0.15 },
  v2_C3: { lower_stability: 0.20, lower_mobility: 0.25, trunk_control: 0.55 },
  // D 그룹 — 무릎·발목 불안정
  v2_D1: { lower_stability: 0.70, lower_mobility: 0.30 },
  v2_D2: { lower_stability: 0.45, lower_mobility: 0.55 },
  v2_D3: { lower_stability: 0.80, lower_mobility: 0.20 },
  // F 그룹 — 편측 의존·비대칭
  v2_F1: { lower_stability: 0.15, trunk_control: 0.20, asymmetry: 0.65 },
  v2_F2: { lower_stability: 0.10, trunk_control: 0.10, asymmetry: 0.80 },
  v2_F3: { lower_stability: 0.10, trunk_control: 0.15, asymmetry: 0.75 },
  // G 그룹 — 전신 긴장·guarding
  v2_G1: { upper_mobility: 0.35, trunk_control: 0.35, deconditioned: 0.30 },
  v2_G2: { upper_mobility: 0.55, trunk_control: 0.35, deconditioned: 0.10 },
  v2_G3: { upper_mobility: 0.50, trunk_control: 0.35, deconditioned: 0.15 },
};

/**
 * 문항별 슬롯 가중치 (가족 내 순서: q1=1.4, q2=1.2, q3=1.0).
 * scoring.v2.ts의 W1/W2/W3와 동일.
 */
const QUESTION_SLOT_WEIGHT: Record<string, number> = {
  v2_A1: 1.4, v2_A2: 1.2, v2_A3: 1.0,
  v2_B1: 1.4, v2_B2: 1.2, v2_B3: 1.0,
  v2_C1: 1.4, v2_C2: 1.2, v2_C3: 1.0,
  v2_D1: 1.4, v2_D2: 1.2, v2_D3: 1.0,
  v2_F1: 1.4, v2_F2: 1.2, v2_F3: 1.0,
  v2_G1: 1.4, v2_G2: 1.2, v2_G3: 1.0,
};

/** 3문항 가족 묶음 (q1 캡 적용 단위) */
const SURVEY_FAMILIES: { q1: string; q2: string; q3: string }[] = [
  { q1: 'v2_A1', q2: 'v2_A2', q3: 'v2_A3' },
  { q1: 'v2_B1', q2: 'v2_B2', q3: 'v2_B3' },
  { q1: 'v2_C1', q2: 'v2_C2', q3: 'v2_C3' },
  { q1: 'v2_D1', q2: 'v2_D2', q3: 'v2_D3' },
  { q1: 'v2_F1', q2: 'v2_F2', q3: 'v2_F3' },
  { q1: 'v2_G1', q2: 'v2_G2', q3: 'v2_G3' },
];

// ─── 정규화 상수 ───────────────────────────────────────────────────────────────

/**
 * 각 축의 이론적 최대 raw 누적값.
 * axis_max[a] = Σ_q (4 * slotWeight[q] * axisShare[q,a])
 *
 * 계산값 (매핑 테이블 기준, 변경 시 갱신 필요):
 *   lower_stability : 13.08  (D군 주도: D1=3.92, D2=2.16, D3=3.20)
 *   lower_mobility  :  8.52  (D+C군)
 *   upper_mobility  : 22.88  (B군 주도: B1=4.20, B2=4.08)
 *   trunk_control   : 27.96  (A+B+C+F+G 다수 기여)
 *   asymmetry       : 10.48  (F군 전담: F1=3.64, F2=3.84, F3=3.00)
 *   deconditioned   :  3.48  (C2=0.72, G1=1.68, G2=0.48, G3=0.60)
 */
const AXIS_MAX: Readonly<AxisScores> = {
  lower_stability:  13.08,
  lower_mobility:    8.52,
  upper_mobility:   22.88,
  trunk_control:    27.96,
  asymmetry:        10.48,
  deconditioned:     3.48,
};

/**
 * 최종 evidence 축 스케일 목표값 (normalized 1.0 → TARGET_SCALE).
 *
 * 자기보고 설문은 paid 객관 테스트보다 정밀도가 낮으므로 보수적으로 캡핑.
 * 최대 2.5 수준 유지 (상단 주석의 "paid 대비 최대 2.5 수준" 원칙).
 *
 * camera evidence 참고 최대값:
 *   lower_stability: 3.0 / lower_mobility: 2.5 / upper_mobility: 3.0
 *   trunk_control: 3.0 / asymmetry: 2.0 / deconditioned: 1.0
 */
const AXIS_TARGET_SCALE: Readonly<AxisScores> = {
  lower_stability: 2.5,
  lower_mobility:  0.5,
  upper_mobility:  2.5,
  trunk_control:   2.5,
  asymmetry:       2.0,
  deconditioned:   2.0,
};

// ─── 수치 규칙 상수 ────────────────────────────────────────────────────────────

/**
 * STABLE 후보 판정 임계값 (normalized 0~1 기준).
 * 구 코드의 "top1 < 55 (0~100)" → normalized 0.55로 직접 대응.
 * 모든 movement 축과 deconditioned가 이 값 미만이면 stable candidate.
 */
const STABLE_CONCERN_THRESHOLD = 0.55;

/**
 * isStableEvidence()의 "deconditioned <= 3" 조건과 정렬.
 * stable path에서 deconditioned의 최대 rescaled 값.
 */
const DECONDITIONED_STABLE_MAX = 3.0;

/**
 * BROAD_CONCERN (구 COMPOSITE_ARMADILLO) 부스트 판정용.
 * movement 축 normalized 이 값 이상이면 "고부하" 축으로 카운트.
 */
const DECONDITIONED_BOOST_MOVEMENT_HIGH_THRESHOLD = 0.65;

/**
 * BROAD_CONCERN 판정: 고부하 movement 축 최소 개수 (5개 중).
 * 4개 이상이면 명확한 광범위 복합 패턴으로 판정.
 */
const DECONDITIONED_BOOST_MIN_HIGH_COUNT = 4;

/**
 * BROAD_CONCERN 판정: deconditioned normalized 최소 임계값.
 * 전신 긴장 신호가 어느 정도 있어야 부스트 발동 (G군 단독으로는 불충분).
 */
const DECONDITIONED_BOOST_DECOND_THRESHOLD = 0.50;

/**
 * 부스트 시 deconditioned에 강제 설정할 값.
 * core의 DECONDITIONED gate: decond >= 6 && maxPart <= decond-1
 * 7.0이면 maxPart가 최대 2.5여도 게이트 통과 (7-1=6 > 2.5).
 * 구 COMPOSITE path의 forced 7.0과 동일.
 */
const DECONDITIONED_BOOST_VALUE = 7.0;

// ─── 미응답 처리 헬퍼 ─────────────────────────────────────────────────────────

/**
 * 미응답 시 값 해석: 2(중간값) 치환.
 * parity 유지: 기존 calculateScoresV2와 동일한 미응답 정책.
 * answered_count는 실제 응답 수 기준 (2-치환된 값은 카운트하지 않음).
 */
function resolveAnswerValue(
  answers: Record<string, TestAnswerValue | undefined>,
  qId: string
): number {
  const v = answers[qId];
  if (v === undefined || v === null) return 2;
  return v as number;
}

// ─── 1단계: 축별 raw 누적 ─────────────────────────────────────────────────────

/**
 * computeSurveyAxisRawScoresFromAnswers
 *
 * 18문항 답변 → 6축 raw 누적값 (cap 미적용, 미응답=2 치환).
 *
 * axis_raw[a] = Σ_q answer[q] * slotWeight[q] * axisShare[q,a]
 *
 * 이 함수는 회귀 비교 및 단위 테스트용.
 * 실제 파이프라인은 applyFamilyCapRules를 직접 사용.
 */
export function computeSurveyAxisRawScoresFromAnswers(
  answers: Record<string, TestAnswerValue | undefined>
): AxisScores {
  const raw: AxisScores = {
    lower_stability: 0, lower_mobility: 0, upper_mobility: 0,
    trunk_control: 0, asymmetry: 0, deconditioned: 0,
  };
  for (const [qId, shares] of Object.entries(QUESTION_AXIS_SHARES)) {
    const v = resolveAnswerValue(answers, qId);
    const w = QUESTION_SLOT_WEIGHT[qId] ?? 1.0;
    for (const [axis, share] of Object.entries(shares)) {
      (raw as Record<string, number>)[axis] += v * w * (share ?? 0);
    }
  }
  return raw;
}

// ─── 2단계: family cap 적용 ───────────────────────────────────────────────────

/**
 * applyFamilyCapRules
 *
 * 각 3문항 family의 q1 응답이 낮으면(≤2) 그 family의 축 기여를 75% 상한으로 clamp.
 * 기존 domain score의 "q1≤2 → 75점 상한" 규칙을 다축 구조에서 per-family로 재현.
 *
 * 설계 원칙:
 * - q1이 낮으면 해당 패턴의 핵심 증거(1번 문항)가 약하므로 전체 기여를 보수적으로 제한.
 * - cap은 family별로 독립 적용 → 다른 family의 기여는 영향 없음.
 * - axis_max는 cap 전 이론적 최대 → 정규화 분모는 항상 AXIS_MAX 상수 사용.
 *
 * @returns 6축 raw 누적값 (family cap 적용 후 합산)
 */
export function applyFamilyCapRules(
  answers: Record<string, TestAnswerValue | undefined>
): AxisScores {
  const result: AxisScores = {
    lower_stability: 0, lower_mobility: 0, upper_mobility: 0,
    trunk_control: 0, asymmetry: 0, deconditioned: 0,
  };

  for (const family of SURVEY_FAMILIES) {
    const q1Raw = answers[family.q1];
    const q1Val = (q1Raw === undefined || q1Raw === null) ? 2 : (q1Raw as number);
    const shouldCap = q1Val <= 2;

    const questions = [family.q1, family.q2, family.q3];

    const familyContrib: AxisScores = {
      lower_stability: 0, lower_mobility: 0, upper_mobility: 0,
      trunk_control: 0, asymmetry: 0, deconditioned: 0,
    };
    const familyMax: AxisScores = {
      lower_stability: 0, lower_mobility: 0, upper_mobility: 0,
      trunk_control: 0, asymmetry: 0, deconditioned: 0,
    };

    for (const qId of questions) {
      const v = resolveAnswerValue(answers, qId);
      const w = QUESTION_SLOT_WEIGHT[qId] ?? 1.0;
      const shares = QUESTION_AXIS_SHARES[qId] ?? {};
      for (const [axis, share] of Object.entries(shares)) {
        (familyContrib as Record<string, number>)[axis] += v * w * (share ?? 0);
        (familyMax as Record<string, number>)[axis] += 4 * w * (share ?? 0);
      }
    }

    for (const axis of Object.keys(result) as (keyof AxisScores)[]) {
      let contrib = familyContrib[axis];
      if (shouldCap && familyMax[axis] > 0) {
        // q1≤2이면 해당 family의 축 기여를 family-max의 75%로 상한
        contrib = Math.min(contrib, 0.75 * familyMax[axis]);
      }
      result[axis] += contrib;
    }
  }

  return result;
}

// ─── 3단계: 정규화 ────────────────────────────────────────────────────────────

/**
 * normalizeSurveyAxisScores
 *
 * raw 누적값 → 0~1 normalized (raw / AXIS_MAX).
 * AXIS_MAX는 cap 전 이론적 최대치이므로,
 * cap 후에도 normalized는 cap 효과를 반영한 0~1 비율이 됨.
 */
export function normalizeSurveyAxisScores(raw: AxisScores): AxisScores {
  return {
    lower_stability: AXIS_MAX.lower_stability > 0
      ? raw.lower_stability / AXIS_MAX.lower_stability : 0,
    lower_mobility:  AXIS_MAX.lower_mobility  > 0
      ? raw.lower_mobility  / AXIS_MAX.lower_mobility  : 0,
    upper_mobility:  AXIS_MAX.upper_mobility  > 0
      ? raw.upper_mobility  / AXIS_MAX.upper_mobility  : 0,
    trunk_control:   AXIS_MAX.trunk_control   > 0
      ? raw.trunk_control   / AXIS_MAX.trunk_control   : 0,
    asymmetry:       AXIS_MAX.asymmetry       > 0
      ? raw.asymmetry       / AXIS_MAX.asymmetry       : 0,
    deconditioned:   AXIS_MAX.deconditioned   > 0
      ? raw.deconditioned   / AXIS_MAX.deconditioned   : 0,
  };
}

// ─── 4단계: Stable candidate rule ─────────────────────────────────────────────

/**
 * 단일 family의 concern 수준 계산 (0~1).
 * family_concern = (q1*W1 + q2*W2 + q3*W3) / (4*W1 + 4*W2 + 4*W3)
 *
 * 이 값은 구 코드의 "domain score / 100" 과 동일하다 (q1≤2 캡 미적용).
 * = 구 MONKEY gate "top1 < 55" = "max family_concern < 0.55" 로 직접 대응.
 *
 * 왜 per-family인가:
 * trunk_control은 A/B/C/F/G 5개 그룹이 기여하여 axis_max=27.96(큼).
 * C=4(others=1)이어도 trunk normalized=0.47 < 0.55 — global 기준으로는 stable로 오판.
 * per-family 기준은 C family concern=1.0 ≥ 0.55 → 정확히 NOT stable.
 */
function computeFamilyConcern(
  answers: Record<string, TestAnswerValue | undefined>,
  q1Id: string,
  q2Id: string,
  q3Id: string
): number {
  const q1 = resolveAnswerValue(answers, q1Id);
  const q2 = resolveAnswerValue(answers, q2Id);
  const q3 = resolveAnswerValue(answers, q3Id);
  const MAX_FAMILY_RAW = 4 * 1.4 + 4 * 1.2 + 4 * 1.0; // 14.4
  return (q1 * 1.4 + q2 * 1.2 + q3 * 1.0) / MAX_FAMILY_RAW;
}

/**
 * applyStableCandidateRule — MONKEY 분기 대체
 *
 * 모든 6개 family의 concern이 낮은 균형형 패턴을 감지.
 * 감지 시:
 * - movement axes zeroing (isStableEvidence의 strict-zero 조건 충족)
 * - deconditioned는 소량만 유지 (decond ≤ 3 조건 충족)
 * - movement_quality.all_good = true
 *
 * 기준: 모든 family의 per-family concern < STABLE_CONCERN_THRESHOLD (0.55).
 * = 구 MONKEY gate "top1 domain_score < 55" 와 동일 의미.
 *
 * 왜 per-family인가 (global normalized 대신):
 * trunk_control 같이 많은 그룹이 기여하는 축은 global normalized가 희석된다.
 * C=4(others=1)이어도 trunk normalized=0.47 < 0.55 → global 기준으로 오판 가능.
 * per-family 기준은 "C family concern=1.0 ≥ 0.55 → NOT stable"로 정확히 판정.
 *
 * pain 없음 전제: 무료 설문에는 통증 문항이 없으므로 noPain은 항상 충족.
 *
 * zeroing이 필요한 이유:
 * isStableEvidence()는 lower_stability=0, upper_mobility=0, trunk_control=0을 요구.
 * 다축 매핑에서 답변 2(중간)가 non-zero raw를 만들기 때문에 명시적 zeroing 필요.
 *
 * @param answers       원본 설문 답변 (2-치환 포함 per-family concern 계산용)
 * @param normalizedForDecond cap 적용 후 normalized (deconditioned 소량 유지 계산용)
 * @returns isStableCandidate 여부 및 stable path용 deconditioned rescaled 값
 */
export function applyStableCandidateRule(
  answers: Record<string, TestAnswerValue | undefined>,
  normalizedForDecond: AxisScores
): {
  isStableCandidate: boolean;
  deconditionedForStable: number;
} {
  // 어떤 family라도 concern ≥ threshold면 NOT stable
  for (const family of SURVEY_FAMILIES) {
    const concern = computeFamilyConcern(answers, family.q1, family.q2, family.q3);
    if (concern >= STABLE_CONCERN_THRESHOLD) {
      return { isStableCandidate: false, deconditionedForStable: 0 };
    }
  }

  // 모든 family concern < threshold → stable candidate
  // deconditioned: G군 기여 반영하여 소량 유지 (isStableEvidence: decond ≤ 3)
  const deconditionedForStable = Math.min(
    normalizedForDecond.deconditioned * AXIS_TARGET_SCALE.deconditioned,
    DECONDITIONED_STABLE_MAX
  );

  return { isStableCandidate: true, deconditionedForStable };
}

// ─── 5단계: Deconditioned boost rule ──────────────────────────────────────────

/**
 * applyDeconditionedBoostRule — COMPOSITE_ARMADILLO 분기 대체
 *
 * 광범위 복합 고부하 패턴(BROAD_CONCERN) 감지.
 * 감지 시: deconditioned = DECONDITIONED_BOOST_VALUE(7.0) 강제
 * → core의 DECONDITIONED gate: decond ≥ 6 && maxPart ≤ decond-1 충족.
 *
 * BROAD_CONCERN 조건:
 *   movement 5축 중 ≥4개의 normalized ≥ 0.65
 *   AND deconditioned normalized ≥ 0.50
 *
 * G군 보호 주의:
 * G군이 높아도 다른 movement 축이 충분히 높지 않으면(highCount < 4)
 * 부스트가 발동되지 않는다. 단순 전신 긴장(G만 높음)은 DECONDITIONED가 아니다.
 *
 * COMPOSITE_SLOTH 대응(확산 패턴):
 * 이번 PR에서는 구현하지 않음. Follow-up PR 예정.
 *
 * 구 forced value와의 관계:
 * 구 COMPOSITE → deconditioned = 7.0 강제.
 * 신규 BROAD_CONCERN → 동일하게 7.0 강제.
 * core gate: decond(7.0) ≥ 6 ✓, maxPart 최대 2.5 ≤ 6 ✓ → DECONDITIONED 분류.
 *
 * @param normalized 정규화된 0~1 축 점수 (family cap 적용 후)
 * @returns 부스트할 deconditioned 값, 또는 null (부스트 없음)
 */
export function applyDeconditionedBoostRule(normalized: AxisScores): number | null {
  const movementNorms = [
    normalized.lower_stability,
    normalized.lower_mobility,
    normalized.upper_mobility,
    normalized.trunk_control,
    normalized.asymmetry,
  ];

  const highCount = movementNorms.filter(
    v => v >= DECONDITIONED_BOOST_MOVEMENT_HIGH_THRESHOLD
  ).length;

  if (
    highCount >= DECONDITIONED_BOOST_MIN_HIGH_COUNT &&
    normalized.deconditioned >= DECONDITIONED_BOOST_DECOND_THRESHOLD
  ) {
    return DECONDITIONED_BOOST_VALUE;
  }

  return null;
}

// ─── 6단계: missing signals ────────────────────────────────────────────────────

/**
 * buildMissingSignalsFromSurveyAnswers
 *
 * 설문 답변 기준 누락 신호 생성 (animal-domain 0점 기준 제거).
 * 조건은 "해당 그룹의 핵심 질문이 실제로 미응답인가"에 기반.
 *
 * 항상 포함 (무료 설문 구조 한계):
 * - pain_intensity_missing
 * - pain_location_missing
 * - objective_movement_test_missing
 *
 * 조건부:
 * - upper_survey_empty  : B 그룹 전체 미응답 (상체 가동성 핵심 신호)
 * - lower_survey_empty  : D 그룹 전체 미응답 (하체 신호)
 * - trunk_survey_empty  : C 그룹 전체 미응답 (체간 신호)
 * - asymmetry_survey_empty : F 그룹 전체 미응답 (비대칭 신호)
 */
export function buildMissingSignalsFromSurveyAnswers(
  answers: Record<string, TestAnswerValue | undefined>
): string[] {
  const missing: string[] = [
    'pain_intensity_missing',
    'pain_location_missing',
    'objective_movement_test_missing',
  ];

  const isAllMissing = (...ids: string[]) =>
    ids.every(id => answers[id] === undefined || answers[id] === null);

  if (isAllMissing('v2_B1', 'v2_B2', 'v2_B3')) {
    missing.push('upper_survey_empty');
  }
  if (isAllMissing('v2_D1', 'v2_D2', 'v2_D3')) {
    missing.push('lower_survey_empty');
  }
  if (isAllMissing('v2_C1', 'v2_C2', 'v2_C3')) {
    missing.push('trunk_survey_empty');
  }
  if (isAllMissing('v2_F1', 'v2_F2', 'v2_F3')) {
    missing.push('asymmetry_survey_empty');
  }

  return missing;
}

// ─── 7단계: 통합 빌더 ─────────────────────────────────────────────────────────

/**
 * buildFreeSurveyDeepEvidence
 *
 * 18문항 → direct multi-axis DeepScoringEvidence (신규 active path).
 *
 * Pipeline:
 * 1. applyFamilyCapRules           → capped raw scores (미응답=2 치환, q1≤2 cap)
 * 2. normalizeSurveyAxisScores     → 0~1 normalized
 * 3. applyStableCandidateRule      → stable 판정 (movement zeroing + all_good)
 * 4. applyDeconditionedBoostRule   → 복합 고부하 판정 (decond=7.0 강제)
 * 5. AXIS_TARGET_SCALE 곱          → 최종 evidence axis_scores
 * 6. buildMissingSignalsFromSurveyAnswers → missing_signals
 * 7. DeepScoringEvidence 조립
 */
export function buildFreeSurveyDeepEvidence(
  rawAnswers: Record<string, TestAnswerValue | undefined>
): DeepScoringEvidence {
  const answeredCount = countAnswered(rawAnswers);

  // 1. family cap 적용 후 raw 누적
  const cappedRaw = applyFamilyCapRules(rawAnswers);

  // 2. 0~1 정규화
  const normalized = normalizeSurveyAxisScores(cappedRaw);

  // 3. stable candidate 판정 (per-family concern 기반)
  const stableResult = applyStableCandidateRule(rawAnswers, normalized);

  // 4. deconditioned boost 판정 (stable이면 boost 불필요)
  const boostDeconditioned = stableResult.isStableCandidate
    ? null
    : applyDeconditionedBoostRule(normalized);

  // 5. 최종 axis_scores 결정
  let axis_scores: AxisScores;
  let movementQualityAllGood: boolean;

  if (stableResult.isStableCandidate) {
    // STABLE path: movement 축 zeroing + small deconditioned
    // isStableEvidence() 조건: lower_stability=0, upper_mobility=0, trunk_control=0, decond≤3
    axis_scores = {
      lower_stability: 0,
      lower_mobility:  0,
      upper_mobility:  0,
      trunk_control:   0,
      asymmetry:       0,
      deconditioned:   stableResult.deconditionedForStable,
    };
    movementQualityAllGood = true;
  } else {
    // 일반 또는 boosted path
    axis_scores = {
      lower_stability: normalized.lower_stability * AXIS_TARGET_SCALE.lower_stability,
      lower_mobility:  normalized.lower_mobility  * AXIS_TARGET_SCALE.lower_mobility,
      upper_mobility:  normalized.upper_mobility  * AXIS_TARGET_SCALE.upper_mobility,
      trunk_control:   normalized.trunk_control   * AXIS_TARGET_SCALE.trunk_control,
      asymmetry:       normalized.asymmetry       * AXIS_TARGET_SCALE.asymmetry,
      deconditioned:   boostDeconditioned !== null
        ? boostDeconditioned
        : normalized.deconditioned * AXIS_TARGET_SCALE.deconditioned,
    };
    movementQualityAllGood = false;
  }

  // 6. missing signals
  const missing_signals = buildMissingSignalsFromSurveyAnswers(rawAnswers);

  return {
    axis_scores,
    pain_signals: {
      max_intensity:            undefined,
      primary_discomfort_none:  undefined,
      has_location_data:        false,
    },
    movement_quality: {
      all_good: movementQualityAllGood,
    },
    answered_count: answeredCount,
    total_count:    FREE_SURVEY_TOTAL_COUNT,
    missing_signals,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B: Active 진입점 (신규 multi-axis path 사용)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * freeSurveyAnswersToEvidence — Public API
 *
 * PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01:
 * active path = buildFreeSurveyDeepEvidence (direct multi-axis).
 * animal-domain intermediate는 더 이상 active scoring 중심이 아님.
 *
 * @param rawAnswers 설문 답변 맵 (key = 질문ID, value = 0~4 또는 undefined)
 * @returns DeepScoringEvidence (채널 독립 scoring core 입력)
 */
export function freeSurveyAnswersToEvidence(
  rawAnswers: Record<string, TestAnswerValue | undefined>
): DeepScoringEvidence {
  return buildFreeSurveyDeepEvidence(rawAnswers);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C: 설문 UI 보조 (PR-UI-SUMMARY-SCORING-ALIGN 이후 잔류)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * getSurveyUiAxisSummary — 설문 페이지 UI 보조용 (현재 active 소비처 없음)
 *
 * 신규 다축 매핑 기준으로 재구현.
 * 가장 높은 deep axis와 normalized 점수(0~1)를 반환.
 *
 * @deprecated survey/page.tsx에서 제거됨 (PR-SESSION-SCHEMA-CLEANUP).
 *             현재 product 경로에서 사용하지 않음. 내부 디버그/테스트 전용.
 */
export function getSurveyUiAxisSummary(
  answers: Record<string, TestAnswerValue | undefined>
): { topAxis: string; topScore: number } {
  const cappedRaw  = applyFamilyCapRules(answers);
  const normalized = normalizeSurveyAxisScores(cappedRaw);

  const entries = Object.entries(normalized) as [keyof AxisScores, number][];
  const sorted  = entries.sort((a, b) => b[1] - a[1]);

  return {
    topAxis:  (sorted[0]?.[0] as string) ?? 'trunk_control',
    topScore: sorted[0]?.[1] ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D: 회귀 비교용 (animal-domain 구 경로 — 제품 경로에서 사용하지 않음)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 구 경로 전용 상수 ─────────────────────────────────────────────────────────

/** 축별 문항 ID (animal-domain 기준) */
const AXIS_QUESTION_IDS: Record<AnimalAxis, [string, string, string]> = {
  turtle:   ['v2_A1', 'v2_A2', 'v2_A3'],
  hedgehog: ['v2_B1', 'v2_B2', 'v2_B3'],
  kangaroo: ['v2_C1', 'v2_C2', 'v2_C3'],
  penguin:  ['v2_D1', 'v2_D2', 'v2_D3'],
  crab:     ['v2_F1', 'v2_F2', 'v2_F3'],
  meerkat:  ['v2_G1', 'v2_G2', 'v2_G3'],
};

const W1_LEGACY = 1.4;
const W2_LEGACY = 1.2;
const W3_LEGACY = 1.0;
const MAX_RAW_LEGACY = 14.4; // 4*1.4 + 4*1.2 + 4*1.0

const EMPTY_AXIS_LEGACY: Record<AnimalAxis, number> = {
  turtle: 0, hedgehog: 0, kangaroo: 0, penguin: 0, crab: 0, meerkat: 0,
};

type SurveyPatternLegacy =
  | 'MONKEY'
  | 'COMPOSITE_ARMADILLO'
  | 'COMPOSITE_SLOTH'
  | 'BASIC';

function populationStdLegacy(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const sumSq = values.reduce((s, x) => s + (x - avg) ** 2, 0);
  return Math.sqrt(sumSq / values.length);
}

function resolveValueLegacy(
  answers: Record<string, TestAnswerValue | undefined>,
  qId: string
): number {
  const v = answers[qId];
  if (v === undefined || v === null) return 2;
  return v as number;
}

/**
 * 구 animal-domain 점수 + 분기 패턴 계산.
 * PR-07C 이후 active path에서 분리 — 회귀 비교 전용.
 * @see computeDomainScoresAndPatternForRegression
 */
function computeDomainScoresAndPattern(
  answers: Record<string, TestAnswerValue | undefined>
): {
  axisScores: Record<AnimalAxis, number>;
  resultType: SurveyPatternLegacy;
} {
  const axisScores = { ...EMPTY_AXIS_LEGACY } as Record<AnimalAxis, number>;
  const q1Values: Record<AnimalAxis, number> = {} as Record<AnimalAxis, number>;

  for (const axis of ANIMAL_AXES) {
    const [id1, id2, id3] = AXIS_QUESTION_IDS[axis];
    const q1 = resolveValueLegacy(answers, id1);
    const q2 = resolveValueLegacy(answers, id2);
    const q3 = resolveValueLegacy(answers, id3);
    q1Values[axis] = q1;

    let raw  = q1 * W1_LEGACY + q2 * W2_LEGACY + q3 * W3_LEGACY;
    let base = (raw / MAX_RAW_LEGACY) * 100;
    if (q1 <= 2) base = Math.min(base, 75);
    axisScores[axis] = Math.round(base * 100) / 100;
  }

  const sorted = ([...ANIMAL_AXES] as AnimalAxis[])
    .map((axis) => ({ axis, score: axisScores[axis] }))
    .sort((a, b) => b.score - a.score);

  const top1Axis = sorted[0]!.axis;
  const top2Axis = sorted[1]!.axis;
  const top3Axis = sorted[2]!.axis;
  const top1     = sorted[0]!.score;
  const top2     = sorted[1]!.score;
  const top3     = sorted[2]!.score;

  const avg = ANIMAL_AXES.reduce((s, a) => s + axisScores[a], 0) / ANIMAL_AXES.length;
  const std = populationStdLegacy(
    ANIMAL_AXES.map((a) => axisScores[a]),
    avg
  );

  const triggerCountTop3 = [top1Axis, top2Axis, top3Axis].filter(
    (a) => q1Values[a] >= 3
  ).length;

  const EPSILON = 0.01;
  const isAll50 = ANIMAL_AXES.every((a) => Math.abs(axisScores[a] - 50) <= EPSILON);

  let resultType: SurveyPatternLegacy = 'BASIC';

  if (isAll50 || top1 < 55) {
    resultType = 'MONKEY';
  } else {
    const compositeTag = getCompositeTagV2({
      axisScores,
      top1, top2, top3,
      top1Axis, top2Axis, top3Axis,
      avg, std, triggerCountTop3,
    });
    if (compositeTag === 'armadillo')      resultType = 'COMPOSITE_ARMADILLO';
    else if (compositeTag === 'sloth')     resultType = 'COMPOSITE_SLOTH';
    else                                   resultType = 'BASIC';
  }

  return { axisScores, resultType };
}

/**
 * computeDomainScoresAndPatternForRegression
 *
 * 구 animal-domain 경로 — 회귀 비교 전용.
 * active baseline path와 분포 차이 비교에 사용.
 *
 * @see scripts/free-survey-multi-axis-regression.mjs
 */
export function computeDomainScoresAndPatternForRegression(
  answers: Record<string, TestAnswerValue | undefined>
): {
  axisScores: Record<AnimalAxis, number>;
  resultType: SurveyPatternLegacy;
} {
  return computeDomainScoresAndPattern(answers);
}
