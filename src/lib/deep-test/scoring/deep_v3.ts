/**
 * Deep Test v3 스코어링
 * 14문항 유지, 상태벡터 방식 (state-vector scoring)
 * deep_v2 부위 중심 → deep_v3 상태벡터 축
 * PR-ALG-01
 */

import type { DeepAnswerValue } from '../types';
import type {
  DeepV2ResultType,
  DeepObjectiveScores,
  DeepFinalScores,
  DeepPrimaryFocus,
  DeepSecondaryFocus,
  DeepAlgorithmScores,
  DeepV3StateVector,
  DeepV3PainMode,
  DeepV3Type,
} from '../types';
import { getPainIntensityMap, getFocusToTags, getAxisToAvoid } from '../config';
import {
  DEEP_V2_TOTAL_COUNT,
  getApplicableQuestionIds,
} from '../question-ids';

export const SCORING_VERSION = 'deep_v3';

/** Re-export for consumers */
export type { DeepV3StateVector, DeepV3PainMode, DeepV3Type } from '../types';
export type DeepV3PriorityVector = DeepV3StateVector;

// --- Value parsers ---
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

function parsePainIntensity(v: DeepAnswerValue, painMap: Record<string, number>): number {
  const s = toString(v);
  if (!s) return 0;
  const lower = s.trim().toLowerCase();
  for (const [k, val] of Object.entries(painMap)) {
    if (s.includes(k) || lower.includes(k.toLowerCase())) return val;
  }
  return 0;
}

/**
 * answers → 6축 상태벡터
 * 질문별 재매핑 원칙 적용
 */
export function calculateDeepV3StateVector(
  answers: Record<string, DeepAnswerValue>
): DeepV3StateVector {
  const painMap = getPainIntensityMap();
  const sv: DeepV3StateVector = {
    lower_stability: 0,
    lower_mobility: 0,
    upper_mobility: 0,
    trunk_control: 0,
    asymmetry: 0,
    deconditioned: 0,
  };

  // --- 기본정보: age / inactivity / no experience → deconditioned ---
  const age = toNumber(answers.deep_basic_age);
  if (age !== null) {
    if (age >= 55) sv.deconditioned += 2;
    else if (age >= 40) sv.deconditioned += 1;
  }
  const exp = toString(answers.deep_basic_experience);
  if (exp) {
    if (exp.includes('없음')) sv.deconditioned += 2;
    else if (exp.includes('어렸을 때') || exp.includes('조금')) sv.deconditioned += 1;
  }
  const work = toString(answers.deep_basic_workstyle);
  if (work) {
    if (work.includes('누움') || work.includes('눕')) sv.deconditioned += 3;
    else if (work.includes('앉아서') || work.includes('앉아')) sv.deconditioned += 1;
  }

  // --- 스쿼트: 무릎 흔들림 → lower_stability ---
  const q8 = toString(answers.deep_squat_knee_alignment);
  if (q8) {
    if (q8.includes('가끔') && q8.includes('흔들림')) sv.lower_stability += 1;
    else if (q8.includes('자주') && q8.includes('크게')) sv.lower_stability += 2;
  }

  // --- 벽천사: 팔 위치 제한 → upper_mobility, 허리/갈비/목 → trunk_control ---
  const q11 = toString(answers.deep_wallangel_quality);
  if (q11) {
    if (q11.includes('어깨가 들리') || q11.includes('목이 긴장')) sv.trunk_control += 1;
    else if (q11.includes('팔꿈치') || q11.includes('손목')) sv.upper_mobility += 2;
    else if (q11.includes('허리') || q11.includes('갈비뼈')) sv.trunk_control += 2;
    else if (q11.includes('전신') || q11.includes('뻣뻣') || q11.includes('피곤')) sv.deconditioned += 2;
  }

  // --- 한발서기: 흔들림 → lower_stability, 상체 흔들림 → trunk_control, 거의 불가 → deconditioned, 좌우 차이 → asymmetry ---
  const q14 = toString(answers.deep_sls_quality);
  if (q14) {
    if (q14.includes('10초') && q14.includes('안정')) {
      // 0
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
  }

  // --- PR-ALG-08: lower_mobility 보정 (발목 가동성 제한) ---
  // SLS "발목이 꺾이며" + primary_discomfort 무릎·발목 → ankle mobility restriction proxy
  const q5 = toString(answers.deep_basic_primary_discomfort);
  if (q14?.includes('발목') && q14?.includes('꺾이며')) {
    sv.lower_mobility += 2;
    if (q5?.includes('무릎') || q5?.includes('발목')) {
      sv.lower_mobility += 1;
    }
  }

  // --- 통증부위/좌우 차이 → asymmetry (primary_discomfort 보조, 비중 축소) ---
  const q6Loc = toLocationArray(answers.deep_squat_pain_location);
  const q10Loc = toLocationArray(answers.deep_wallangel_pain_location);
  const q13Loc = toLocationArray(answers.deep_sls_pain_location);
  const hasMultipleLocations =
    [...q6Loc, ...q10Loc, ...q13Loc].filter(
      (x) => x && !x.includes('없음') && !x.includes('전신')
    ).length > 1;
  if (hasMultipleLocations) sv.asymmetry += 1;
  if (q5 && !q5.includes('해당 없음') && !q5.includes('전신')) sv.asymmetry += 0.5;

  return sv;
}

/**
 * pain_mode: none / caution / protected
 * 통증강도 기반 게이트
 */
export function resolvePainMode(
  answers: Record<string, DeepAnswerValue>,
  _stateVector: DeepV3StateVector
): DeepV3PainMode {
  const painMap = getPainIntensityMap();
  const q6 = parsePainIntensity(answers.deep_squat_pain_intensity, painMap);
  const q9 = parsePainIntensity(answers.deep_wallangel_pain_intensity, painMap);
  const q12 = parsePainIntensity(answers.deep_sls_pain_intensity, painMap);
  const maxInt = Math.max(q6, q9, q12);
  if (maxInt >= 3) return 'protected';
  if (maxInt >= 1) return 'caution';
  return 'none';
}

/**
 * stateVector + painMode → primary_type, secondary_type
 * type은 설명용, priority_vector가 처방 핵심
 */
export function classifyDeepV3(
  stateVector: DeepV3StateVector,
  painMode: DeepV3PainMode
): { primary_type: DeepV3Type; secondary_type: DeepV3Type | null } {
  const { lower_stability, lower_mobility, upper_mobility, trunk_control, asymmetry, deconditioned } =
    stateVector;

  // STABLE gate
  const q5해당없음 = true; // caller에서 answers 체크 필요 시 전달
  const stableCandidates =
    lower_stability === 0 &&
    lower_mobility === 0 &&
    upper_mobility === 0 &&
    trunk_control === 0 &&
    asymmetry === 0 &&
    deconditioned <= 2;
  if (stableCandidates && painMode === 'none') {
    return { primary_type: 'STABLE', secondary_type: null };
  }

  // DECONDITIONED gate
  const D = deconditioned;
  const maxPart = Math.max(
    lower_stability,
    lower_mobility,
    upper_mobility,
    trunk_control,
    asymmetry
  );
  if (D >= 6 && maxPart <= D - 1) {
    return { primary_type: 'DECONDITIONED', secondary_type: null };
  }
  if (painMode === 'protected') {
    return { primary_type: 'DECONDITIONED', secondary_type: null };
  }

  // 우선순위: 가장 높은 축 → primary, 두번째 → secondary
  // PR-ALG-08: tie-break 일관성 - 동점 시 axes 순서 우선 (lower_stability > lower_mobility > ...)
  const axes: (keyof DeepV3StateVector)[] = [
    'lower_stability',
    'lower_mobility',
    'upper_mobility',
    'trunk_control',
    'asymmetry',
  ];
  const sorted = [...axes].sort((a, b) => {
    const diff = stateVector[b] - stateVector[a];
    if (diff !== 0) return diff;
    return axes.indexOf(a) - axes.indexOf(b);
  });
  const top = sorted[0];
  const second = sorted[1];
  const topVal = top ? stateVector[top] : 0;
  const secondVal = second ? stateVector[second] : 0;

  const toType = (axis: keyof DeepV3StateVector): DeepV3Type => {
    switch (axis) {
      case 'lower_stability':
        return 'LOWER_INSTABILITY';
      case 'lower_mobility':
        return 'LOWER_MOBILITY_RESTRICTION';
      case 'upper_mobility':
        return 'UPPER_IMMOBILITY';
      case 'trunk_control':
        return 'CORE_CONTROL_DEFICIT';
      case 'asymmetry':
        return deconditioned >= 4 ? 'DECONDITIONED' : 'CORE_CONTROL_DEFICIT';
      default:
        return 'STABLE';
    }
  };

  const primary_type = top && topVal > 0 ? toType(top) : 'STABLE';
  const secondary_type =
    second && secondVal > 0 && second !== top ? toType(second) : null;

  return { primary_type, secondary_type };
}

/** DeepV3Type → DeepV2ResultType (호환용) */
function v3TypeToV2ResultType(t: DeepV3Type): DeepV2ResultType {
  switch (t) {
    case 'LOWER_INSTABILITY':
    case 'LOWER_MOBILITY_RESTRICTION':
      return 'LOWER-LIMB';
    case 'UPPER_IMMOBILITY':
      return 'UPPER-LIMB';
    case 'CORE_CONTROL_DEFICIT':
      return 'LUMBO-PELVIS';
    case 'DECONDITIONED':
      return 'DECONDITIONED';
    case 'STABLE':
      return 'STABLE';
    default:
      return 'LOWER-LIMB';
  }
}

/** DeepV3Type → DeepPrimaryFocus */
function v3TypeToFocus(t: DeepV3Type): DeepPrimaryFocus {
  switch (t) {
    case 'LOWER_INSTABILITY':
    case 'LOWER_MOBILITY_RESTRICTION':
      return 'LOWER-LIMB';
    case 'UPPER_IMMOBILITY':
      return 'UPPER-LIMB';
    case 'CORE_CONTROL_DEFICIT':
      return 'LUMBO-PELVIS';
    case 'DECONDITIONED':
      return 'LOWER-LIMB'; // fallback
    case 'STABLE':
      return 'FULL';
    default:
      return 'LOWER-LIMB';
  }
}

/** priority_vector 정규화 (0~1) */
function normalizePriorityVector(sv: DeepV3StateVector): DeepV3PriorityVector {
  const max = Math.max(
    sv.lower_stability,
    sv.lower_mobility,
    sv.upper_mobility,
    sv.trunk_control,
    sv.asymmetry,
    sv.deconditioned,
    1
  );
  return {
    lower_stability: Math.min(1, sv.lower_stability / max),
    lower_mobility: Math.min(1, sv.lower_mobility / max),
    upper_mobility: Math.min(1, sv.upper_mobility / max),
    trunk_control: Math.min(1, sv.trunk_control / max),
    asymmetry: Math.min(1, sv.asymmetry / max),
    deconditioned: Math.min(1, sv.deconditioned / max),
  };
}

/** stateVector → DeepObjectiveScores (호환용 N,L,U,Lo,D) */
function stateVectorToObjectiveScores(sv: DeepV3StateVector): DeepObjectiveScores {
  return {
    N: sv.trunk_control + (sv.upper_mobility > 0 ? 0.5 : 0),
    L: sv.trunk_control + sv.asymmetry,
    U: sv.upper_mobility,
    Lo: sv.lower_stability + sv.lower_mobility,
    D: sv.deconditioned,
  };
}

/**
 * deep_v3 derived 빌드 (day-plan-generator 호환)
 * 기존 키 유지 + primary_type, secondary_type, priority_vector, pain_mode 추가
 */
export function buildDeepV3Derived(
  stateVector: DeepV3StateVector,
  painMode: DeepV3PainMode,
  primary_type: DeepV3Type,
  secondary_type: DeepV3Type | null,
  confidence: number
): {
  result_type: DeepV2ResultType;
  primaryFocus: DeepPrimaryFocus;
  secondaryFocus: DeepSecondaryFocus;
  level: number;
  focus_tags: string[];
  avoid_tags: string[];
  algorithm_scores: DeepAlgorithmScores;
  primary_type: DeepV3Type;
  secondary_type: DeepV3Type | null;
  priority_vector: DeepV3PriorityVector;
  pain_mode: DeepV3PainMode;
  objectiveScores: DeepObjectiveScores;
  finalScores: DeepFinalScores;
} {
  const FOCUS_TO_TAGS = getFocusToTags();
  const AXIS_TO_AVOID = getAxisToAvoid();
  const obj = stateVectorToObjectiveScores(stateVector);
  const finalScores = { ...obj };

  const result_type = v3TypeToV2ResultType(primary_type);
  const primaryFocus = v3TypeToFocus(primary_type);
  const secondaryFocus: DeepSecondaryFocus =
    secondary_type && secondary_type !== primary_type
      ? v3TypeToFocus(secondary_type)
      : 'NONE';

  let level: number;
  if (primary_type === 'STABLE') {
    level = 2;
  } else if (primary_type === 'DECONDITIONED' || painMode === 'protected') {
    level = 1;
  } else {
    const D = stateVector.deconditioned;
    if (D >= 4) level = 1;
    else if (D >= 2) level = 2;
    else level = 3;
  }
  if (confidence < 0.5) level = Math.min(level, 1);
  level = Math.max(1, Math.min(3, level));

  const focus_tags: string[] = [];
  const primaryTags = FOCUS_TO_TAGS[primaryFocus] ?? FOCUS_TO_TAGS['FULL'];
  focus_tags.push(...primaryTags);
  if (secondaryFocus && secondaryFocus !== 'NONE') {
    const secTags = FOCUS_TO_TAGS[secondaryFocus] ?? [];
    for (const t of secTags) {
      if (!focus_tags.includes(t)) focus_tags.push(t);
    }
  }

  const avoid_tags: string[] = [];
  const axisMap: Record<string, keyof typeof AXIS_TO_AVOID> = {
    N: 'N',
    L: 'L',
    U: 'U',
    Lo: 'Lo',
  };
  for (const [axis, key] of Object.entries(axisMap)) {
    const score = finalScores[key as keyof DeepObjectiveScores];
    if (score >= 3) {
      avoid_tags.push(...(AXIS_TO_AVOID[key as keyof typeof AXIS_TO_AVOID] ?? []));
    }
  }

  const algorithm_scores: DeepAlgorithmScores = {
    upper_score: obj.N + obj.U,
    lower_score: obj.L + obj.Lo,
    core_score: Math.max(obj.N, obj.L),
    balance_score: obj.D,
    pain_risk: obj.D,
  };

  const priority_vector = normalizePriorityVector(stateVector);

  return {
    result_type,
    primaryFocus,
    secondaryFocus,
    level,
    focus_tags,
    avoid_tags: [...new Set(avoid_tags)],
    algorithm_scores,
    primary_type,
    secondary_type,
    priority_vector,
    pain_mode: painMode,
    objectiveScores: obj,
    finalScores,
  };
}

/**
 * 메인 진입점: answers → deep_v3 결과 (derived 호환 shape)
 */
export function calculateDeepV3(
  answers: Record<string, DeepAnswerValue>
): {
  scoring_version: 'deep_v3';
  result_type: DeepV2ResultType;
  primaryFocus: DeepPrimaryFocus;
  secondaryFocus: DeepSecondaryFocus;
  objectiveScores: DeepObjectiveScores;
  finalScores: DeepFinalScores;
  confidence: number;
  answeredCount: number;
  totalCount: number;
  primary_type: DeepV3Type;
  secondary_type: DeepV3Type | null;
  priority_vector: DeepV3PriorityVector;
  pain_mode: DeepV3PainMode;
  derived: ReturnType<typeof buildDeepV3Derived>;
} {
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
  const baseConfidence = answeredCount / DEEP_V2_TOTAL_COUNT;

  const stateVector = calculateDeepV3StateVector(answers);
  const painMode = resolvePainMode(answers, stateVector);

  // STABLE gate: Q5 해당없음, 통증 없음, 운동 양호
  const q5 = toString(answers.deep_basic_primary_discomfort);
  const painMap = getPainIntensityMap();
  const q6Int = parsePainIntensity(answers.deep_squat_pain_intensity, painMap);
  const q9Int = parsePainIntensity(answers.deep_wallangel_pain_intensity, painMap);
  const q12Int = parsePainIntensity(answers.deep_sls_pain_intensity, painMap);
  const q8 = toString(answers.deep_squat_knee_alignment);
  const q11 = toString(answers.deep_wallangel_quality);
  const q14 = toString(answers.deep_sls_quality);

  const q5해당없음 = q5?.includes('해당 없음') ?? false;
  const noPain = q6Int === 0 && q9Int === 0 && q12Int === 0;
  const q8Good = q8?.includes('발바닥이 바닥에 잘 붙은 채로') ?? false;
  const q11Good = q11?.includes('문제 없음') ?? false;
  const q14Good = q14?.includes('10초 안정적으로 가능') ?? false;
  const decondLow = stateVector.deconditioned <= 3;

  let primary_type: DeepV3Type;
  let secondary_type: DeepV3Type | null;

  if (
    q5해당없음 &&
    noPain &&
    q8Good &&
    q11Good &&
    q14Good &&
    decondLow &&
    stateVector.lower_stability === 0 &&
    stateVector.upper_mobility === 0 &&
    stateVector.trunk_control === 0
  ) {
    primary_type = 'STABLE';
    secondary_type = null;
  } else {
    const classified = classifyDeepV3(stateVector, painMode);
    primary_type = classified.primary_type;
    secondary_type = classified.secondary_type;
  }

  const derived = buildDeepV3Derived(
    stateVector,
    painMode,
    primary_type,
    secondary_type,
    baseConfidence
  );

  const confidence = Math.min(1, Math.max(0, baseConfidence + 0.1));

  return {
    scoring_version: 'deep_v3',
    result_type: derived.result_type,
    primaryFocus: derived.primaryFocus,
    secondaryFocus: derived.secondaryFocus,
    objectiveScores: derived.objectiveScores,
    finalScores: derived.finalScores,
    confidence,
    answeredCount,
    totalCount: DEEP_V2_TOTAL_COUNT,
    primary_type,
    secondary_type,
    priority_vector: derived.priority_vector,
    pain_mode: painMode,
    derived,
  };
}

/**
 * scoring_version에 따라 deep_v2 또는 deep_v3 계산
 */
export function resolveDeepScoringByVersion(
  version: string,
  answers: Record<string, DeepAnswerValue>
): { useV3: boolean; v3Result?: ReturnType<typeof calculateDeepV3> } {
  if (version === 'deep_v3') {
    return { useV3: true, v3Result: calculateDeepV3(answers) };
  }
  return { useV3: false };
}

// ─── PR-ALG-09: Shadow Compare (safe rollout) ─────────────────────────────────

export const ACTIVE_RULE_VERSION = 'deep_v3_calibration_v1';
export const SHADOW_COMPARE_VERSION = 'shadow_compare_v1';

/** pain_mode candidate: relaxed = caution at 2+ (vs current 1+). protected unchanged. */
function resolvePainModeCandidate(
  answers: Record<string, DeepAnswerValue>,
  _stateVector: DeepV3StateVector,
  candidateName: string
): DeepV3PainMode {
  const painMap = getPainIntensityMap();
  const q6 = parsePainIntensity(answers.deep_squat_pain_intensity, painMap);
  const q9 = parsePainIntensity(answers.deep_wallangel_pain_intensity, painMap);
  const q12 = parsePainIntensity(answers.deep_sls_pain_intensity, painMap);
  const maxInt = Math.max(q6, q9, q12);
  if (candidateName === 'pain_mode_relaxed') {
    if (maxInt >= 3) return 'protected';
    if (maxInt >= 2) return 'caution';
    return 'none';
  }
  return resolvePainMode(answers, _stateVector);
}

/** Shadow result with candidate pain_mode. State vector unchanged. */
export function calculateDeepV3WithCandidate(
  answers: Record<string, DeepAnswerValue>,
  candidateName: string
): ReturnType<typeof calculateDeepV3> {
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
  const baseConfidence = answeredCount / DEEP_V2_TOTAL_COUNT;

  const stateVector = calculateDeepV3StateVector(answers);
  const painMode = resolvePainModeCandidate(answers, stateVector, candidateName);

  const q5 = toString(answers.deep_basic_primary_discomfort);
  const painMap = getPainIntensityMap();
  const q6Int = parsePainIntensity(answers.deep_squat_pain_intensity, painMap);
  const q9Int = parsePainIntensity(answers.deep_wallangel_pain_intensity, painMap);
  const q12Int = parsePainIntensity(answers.deep_sls_pain_intensity, painMap);
  const q8 = toString(answers.deep_squat_knee_alignment);
  const q11 = toString(answers.deep_wallangel_quality);
  const q14 = toString(answers.deep_sls_quality);

  const q5해당없음 = q5?.includes('해당 없음') ?? false;
  const noPain = q6Int === 0 && q9Int === 0 && q12Int === 0;
  const q8Good = q8?.includes('발바닥이 바닥에 잘 붙은 채로') ?? false;
  const q11Good = q11?.includes('문제 없음') ?? false;
  const q14Good = q14?.includes('10초 안정적으로 가능') ?? false;
  const decondLow = stateVector.deconditioned <= 3;

  let primary_type: DeepV3Type;
  let secondary_type: DeepV3Type | null;

  if (
    q5해당없음 &&
    noPain &&
    q8Good &&
    q11Good &&
    q14Good &&
    decondLow &&
    stateVector.lower_stability === 0 &&
    stateVector.upper_mobility === 0 &&
    stateVector.trunk_control === 0
  ) {
    primary_type = 'STABLE';
    secondary_type = null;
  } else {
    const classified = classifyDeepV3(stateVector, painMode);
    primary_type = classified.primary_type;
    secondary_type = classified.secondary_type;
  }

  const derived = buildDeepV3Derived(
    stateVector,
    painMode,
    primary_type,
    secondary_type,
    baseConfidence
  );

  const confidence = Math.min(1, Math.max(0, baseConfidence + 0.1));

  return {
    scoring_version: 'deep_v3',
    result_type: derived.result_type,
    primaryFocus: derived.primaryFocus,
    secondaryFocus: derived.secondaryFocus,
    objectiveScores: derived.objectiveScores,
    finalScores: derived.finalScores,
    confidence,
    answeredCount,
    totalCount: DEEP_V2_TOTAL_COUNT,
    primary_type,
    secondary_type,
    priority_vector: derived.priority_vector,
    pain_mode: painMode,
    derived,
  };
}

export type ShadowCompareBlock = {
  active_rule_version: string;
  shadow_rule_version: string;
  candidate_name: string;
  active_primary_type: string;
  shadow_primary_type: string;
  active_secondary_type: string | null;
  shadow_secondary_type: string | null;
  active_priority_vector: Record<string, number>;
  shadow_priority_vector: Record<string, number>;
  active_pain_mode: string;
  shadow_pain_mode: string;
  diff_flags: string[];
  comparison_reason: string;
  compare_version: string;
};

function priorityVectorToString(pv: Record<string, number>): string {
  const axes = ['lower_stability', 'lower_mobility', 'upper_mobility', 'trunk_control', 'asymmetry', 'deconditioned'];
  return axes.map((a) => `${a}:${(pv[a] ?? 0).toFixed(2)}`).join(',');
}

export function buildShadowCompare(
  active: ReturnType<typeof calculateDeepV3>,
  shadow: ReturnType<typeof calculateDeepV3>,
  candidateName: string,
  shadowRuleVersion: string
): ShadowCompareBlock {
  const diffFlags: string[] = [];
  if (active.primary_type !== shadow.primary_type) diffFlags.push('primary_type_changed');
  if (String(active.secondary_type ?? '') !== String(shadow.secondary_type ?? '')) diffFlags.push('secondary_type_changed');
  if (priorityVectorToString(active.priority_vector) !== priorityVectorToString(shadow.priority_vector)) {
    diffFlags.push('priority_order_changed');
  }
  if (active.pain_mode !== shadow.pain_mode) diffFlags.push('pain_mode_changed');

  return {
    active_rule_version: ACTIVE_RULE_VERSION,
    shadow_rule_version: shadowRuleVersion,
    candidate_name: candidateName,
    active_primary_type: active.primary_type,
    shadow_primary_type: shadow.primary_type,
    active_secondary_type: active.secondary_type,
    shadow_secondary_type: shadow.secondary_type,
    active_priority_vector: { ...active.priority_vector },
    shadow_priority_vector: { ...shadow.priority_vector },
    active_pain_mode: active.pain_mode,
    shadow_pain_mode: shadow.pain_mode,
    diff_flags: diffFlags,
    comparison_reason: `${candidateName} vs active`,
    compare_version: SHADOW_COMPARE_VERSION,
  };
}
