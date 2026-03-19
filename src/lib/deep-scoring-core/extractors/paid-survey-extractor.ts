/**
 * Paid Survey → DeepScoringEvidence 추출기
 *
 * deep_paid 설문 raw answers에서 채널 독립적 evidence로 변환.
 * deep_v3 스코어링 로직의 "입력 파싱" 단계를 분리한 것.
 *
 * 이 파일은 deep_v3 스코어링 로직과 1:1 대응을 유지한다.
 * 스코어링 로직 변경 시 이 파일도 함께 업데이트해야 한다.
 *
 * @see src/lib/deep-test/scoring/deep_v3.ts (원본 참조)
 */

import type { DeepAnswerValue } from '@/lib/deep-test/types';
import { getPainIntensityMap } from '@/lib/deep-test/config';
import {
  DEEP_V2_TOTAL_COUNT,
  getApplicableQuestionIds,
} from '@/lib/deep-test/question-ids';
import type { DeepScoringEvidence, AxisScores } from '../types';

// ─── Value parsers (deep_v3와 동일 구현) ─────────────────────────────────────

function toNumber(v: DeepAnswerValue): number | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function toString(v: DeepAnswerValue): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return null;
}

function toLocationArray(v: DeepAnswerValue): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function parsePainIntensity(
  v: DeepAnswerValue,
  painMap: Record<string, number>
): number {
  const s = toString(v);
  if (!s) return 0;
  const lower = s.trim().toLowerCase();
  for (const [k, val] of Object.entries(painMap)) {
    if (s.includes(k) || lower.includes(k.toLowerCase())) return val;
  }
  return 0;
}

// ─── Evidence 추출 로직 ────────────────────────────────────────────────────────

/**
 * deep_paid 설문 raw answers → DeepScoringEvidence
 *
 * deep_v3 `calculateDeepV3StateVector` + `resolvePainMode` 로직을
 * evidence 추출 레이어로 분리. 계산식은 deep_v3와 동일하게 유지.
 */
export function extractPaidSurveyEvidence(
  answers: Record<string, DeepAnswerValue>
): DeepScoringEvidence {
  const painMap = getPainIntensityMap();
  const missing: string[] = [];

  // ─── answeredCount 계산 ──────────────────────────────────────────────────
  let answeredCount = 0;
  for (const id of getApplicableQuestionIds()) {
    const v = answers[id];
    if (v !== undefined && v !== null) {
      if (Array.isArray(v)) {
        if (v.length > 0) answeredCount += 1;
      } else {
        answeredCount += 1;
      }
    }
  }

  // ─── axis_scores 계산 (deep_v3 calculateDeepV3StateVector와 동일) ────────
  const sv: AxisScores = {
    lower_stability: 0,
    lower_mobility: 0,
    upper_mobility: 0,
    trunk_control: 0,
    asymmetry: 0,
    deconditioned: 0,
  };

  // Q1: deep_basic_age → deconditioned
  const age = toNumber(answers.deep_basic_age);
  if (age !== null) {
    if (age >= 55) sv.deconditioned += 2;
    else if (age >= 40) sv.deconditioned += 1;
  } else {
    missing.push('deep_basic_age_missing');
  }

  // Q3: deep_basic_experience → deconditioned
  const exp = toString(answers.deep_basic_experience);
  if (exp) {
    if (exp.includes('없음')) sv.deconditioned += 2;
    else if (exp.includes('어렸을 때') || exp.includes('조금')) sv.deconditioned += 1;
  } else {
    missing.push('deep_basic_experience_missing');
  }

  // Q4: deep_basic_workstyle → deconditioned
  const work = toString(answers.deep_basic_workstyle);
  if (work) {
    if (work.includes('누움') || work.includes('눕')) sv.deconditioned += 3;
    else if (work.includes('앉아서') || work.includes('앉아')) sv.deconditioned += 1;
  } else {
    missing.push('deep_basic_workstyle_missing');
  }

  // Q8: deep_squat_knee_alignment → lower_stability
  const q8 = toString(answers.deep_squat_knee_alignment);
  if (q8) {
    if (q8.includes('가끔') && q8.includes('흔들림')) sv.lower_stability += 1;
    else if (q8.includes('자주') && q8.includes('크게')) sv.lower_stability += 2;
  } else {
    missing.push('deep_squat_knee_alignment_missing');
  }

  // Q11: deep_wallangel_quality → upper_mobility / trunk_control
  const q11 = toString(answers.deep_wallangel_quality);
  if (q11) {
    if (q11.includes('어깨가 들리') || q11.includes('목이 긴장')) sv.trunk_control += 1;
    else if (q11.includes('팔꿈치') || q11.includes('손목')) sv.upper_mobility += 2;
    else if (q11.includes('허리') || q11.includes('갈비뼈')) sv.trunk_control += 2;
    else if (q11.includes('전신') || q11.includes('뻣뻣') || q11.includes('피곤')) sv.deconditioned += 2;
  } else {
    missing.push('deep_wallangel_quality_missing');
  }

  // Q14: deep_sls_quality → lower_stability / trunk_control / deconditioned + asymmetry
  const q14 = toString(answers.deep_sls_quality);
  if (q14) {
    if (q14.includes('10초') && q14.includes('안정')) {
      // 양호 — 0
    } else if (q14.includes('무릎') || q14.includes('발목')) {
      sv.lower_stability += 2;
    } else if (q14.includes('골반') || (q14.includes('허리') && q14.includes('비틀'))) {
      sv.trunk_control += 2;
      sv.asymmetry += 1;
    } else if (q14.includes('상체') && q14.includes('흔들')) {
      sv.trunk_control += 2;
      sv.deconditioned += 1;
    } else if (q14.includes('거의 불가능') || q14.includes('불가능')) {
      sv.deconditioned += 3;
      sv.lower_stability += 1;
    }
  } else {
    missing.push('deep_sls_quality_missing');
  }

  // PR-ALG-08: lower_mobility 보정 (발목 가동성 제한 proxy)
  const q5 = toString(answers.deep_basic_primary_discomfort);
  if (q14?.includes('발목') && q14?.includes('꺾이며')) {
    sv.lower_mobility += 2;
    if (q5?.includes('무릎') || q5?.includes('발목')) {
      sv.lower_mobility += 1;
    }
  }

  // 통증 위치 → asymmetry
  const q6Loc = toLocationArray(answers.deep_squat_pain_location);
  const q10Loc = toLocationArray(answers.deep_wallangel_pain_location);
  const q13Loc = toLocationArray(answers.deep_sls_pain_location);
  const hasMultipleLocations =
    [...q6Loc, ...q10Loc, ...q13Loc].filter(
      (x) => x && !x.includes('없음') && !x.includes('전신')
    ).length > 1;
  if (hasMultipleLocations) sv.asymmetry += 1;
  if (q5 && !q5.includes('해당 없음') && !q5.includes('전신')) sv.asymmetry += 0.5;

  // ─── pain_signals 추출 ───────────────────────────────────────────────────
  const q6Int = parsePainIntensity(answers.deep_squat_pain_intensity, painMap);
  const q9Int = parsePainIntensity(answers.deep_wallangel_pain_intensity, painMap);
  const q12Int = parsePainIntensity(answers.deep_sls_pain_intensity, painMap);
  const maxIntensity = Math.max(q6Int, q9Int, q12Int);

  const hasPainData =
    answers.deep_squat_pain_intensity !== undefined ||
    answers.deep_wallangel_pain_intensity !== undefined ||
    answers.deep_sls_pain_intensity !== undefined;

  if (!hasPainData) missing.push('pain_intensity_missing');

  const primaryDiscomfortNone = q5?.includes('해당 없음') ?? false;
  const hasLocationData =
    [...q6Loc, ...q10Loc, ...q13Loc].some(
      (x) => x && !x.includes('없음')
    );

  // ─── movement_quality 추출 (STABLE gate 신호) ────────────────────────────
  const q8Good = q8?.includes('발바닥이 바닥에 잘 붙은 채로') ?? false;
  const q11Good = q11?.includes('문제 없음') ?? false;
  const q14Good = q14?.includes('10초 안정적으로 가능') ?? false;
  const allMovementGood = q8Good && q11Good && q14Good;

  return {
    axis_scores: sv,
    pain_signals: {
      max_intensity: hasPainData ? maxIntensity : undefined,
      primary_discomfort_none: q5 !== null ? primaryDiscomfortNone : undefined,
      has_location_data: hasLocationData,
    },
    movement_quality: {
      all_good: allMovementGood,
    },
    answered_count: answeredCount,
    total_count: DEEP_V2_TOTAL_COUNT,
    missing_signals: missing,
  };
}
