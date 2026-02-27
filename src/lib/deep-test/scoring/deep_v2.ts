/**
 * Deep Test v2 스코어링
 * 14문항, 6타입, ObjectiveScores/FinalScores, STABLE/DECONDITIONED 게이트
 * deep_v1.ts는 수정하지 않음
 */

import type { DeepAnswerValue } from '../types';
import type {
  DeepV2Result,
  DeepV2ResultType,
  DeepObjectiveScores,
  DeepFinalScores,
  DeepPrimaryFocus,
  DeepSecondaryFocus,
  DeepV2ExtendedResult,
  DeepAlgorithmScores,
} from '../types';

export const SCORING_VERSION = 'deep_v2';

export const DEEP_V2_QUESTION_IDS = [
  'deep_basic_age',
  'deep_basic_gender',
  'deep_basic_experience',
  'deep_basic_workstyle',
  'deep_basic_primary_discomfort',
  'deep_squat_pain_intensity',
  'deep_squat_pain_location',
  'deep_squat_knee_alignment',
  'deep_wallangel_pain_intensity',
  'deep_wallangel_pain_location',
  'deep_wallangel_quality',
  'deep_sls_pain_intensity',
  'deep_sls_pain_location',
  'deep_sls_quality',
] as const;

const TOTAL_COUNT = 14;

// --- Value parsers (deep_v1 패턴 재사용, free import 금지) ---
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

// --- Pain intensity: 없음 0, 약간 1, 중간 2, 강함 3 ---
const PAIN_INTENSITY_MAP: Record<string, number> = {
  없음: 0,
  약간: 1,
  중간: 2,
  강함: 3,
};

function parsePainIntensity(v: DeepAnswerValue): number {
  const s = toString(v);
  if (!s) return 0;
  const lower = s.trim().toLowerCase();
  for (const [k, val] of Object.entries(PAIN_INTENSITY_MAP)) {
    if (s.includes(k) || lower.includes(k.toLowerCase())) return val;
  }
  return 0;
}

// --- Location → axis: 목·어깨=>N, 허리·골반=>L, 손목·팔꿈치=>U, 무릎·발목=>Lo ---
type AxisKey = 'N' | 'L' | 'U' | 'Lo' | 'D';

function locationToAxis(loc: string): AxisKey | null {
  const s = loc.trim();
  if (s.includes('목') || s.includes('어깨')) return 'N';
  if (s.includes('허리') || s.includes('골반')) return 'L';
  if (s.includes('손목') || s.includes('팔꿈치')) return 'U';
  if (s.includes('무릎') || s.includes('발목')) return 'Lo';
  if (s.includes('전신')) return 'D';
  return null;
}

function addPainLocationPoints(
  locations: string[],
  out: Record<AxisKey, number>,
  points: number
) {
  const filtered = locations.filter((x) => {
    const t = x.trim().toLowerCase();
    return t !== '' && t !== '없음' && !t.includes('없음');
  });
  if (filtered.length === 0) return;

  const hasOnly전신 =
    filtered.some((x) => x.includes('전신') || x.includes('애매')) &&
    filtered.every((x) => x.includes('전신') || x.includes('애매') || x.length < 3);
  if (hasOnly전신 || (filtered.length === 1 && filtered[0].includes('전신'))) {
    out.D += 1;
    return;
  }

  const axes = filtered
    .map(locationToAxis)
    .filter((a): a is AxisKey => a !== null && a !== 'D');
  if (axes.length === 0) return;
  const k = axes.length;
  const perAxis = Math.ceil(points / k);
  for (const a of axes) {
    out[a] += perAxis;
  }
}

function emptyScores(): DeepObjectiveScores {
  return { N: 0, L: 0, U: 0, Lo: 0, D: 0 };
}

export function calculateDeepV2(
  answers: Record<string, DeepAnswerValue>
): DeepV2Result {
  const obj = emptyScores();

  // --- Answered count (DEEP_V2_QUESTION_IDS 기준) ---
  let answeredCount = 0;
  for (const id of DEEP_V2_QUESTION_IDS) {
    const v = answers[id];
    if (v !== undefined && v !== null) {
      if (Array.isArray(v)) {
        if (v.length > 0) answeredCount += 1;
      } else {
        answeredCount += 1;
      }
    }
  }
  const confidence = answeredCount / TOTAL_COUNT;

  // --- Q1: deep_basic_age ---
  const age = toNumber(answers.deep_basic_age);
  if (age !== null) {
    if (age >= 55) obj.D += 2;
    else if (age >= 40) obj.D += 1;
  }

  // --- Q3: deep_basic_experience ---
  const exp = toString(answers.deep_basic_experience);
  if (exp) {
    if (exp.includes('없음')) obj.D += 2;
    else if (exp.includes('어렸을 때') || exp.includes('조금')) obj.D += 1;
  }

  // --- Q4: deep_basic_workstyle ---
  const work = toString(answers.deep_basic_workstyle);
  if (work) {
    if (work.includes('누움') || work.includes('눕')) obj.D += 3;
    else if (work.includes('앉아서') || work.includes('앉아')) obj.D += 1;
  }

  // --- Q6: deep_squat_pain_intensity ---
  const q6Int = parsePainIntensity(answers.deep_squat_pain_intensity);
  const q6Loc = toLocationArray(answers.deep_squat_pain_location);
  if (q6Int > 0) {
    if (q6Loc.length > 0) addPainLocationPoints(q6Loc, obj, q6Int);
    else obj.D += q6Int;
  }

  // --- Q8: deep_squat_knee_alignment ---
  const q8 = toString(answers.deep_squat_knee_alignment);
  if (q8) {
    if (q8.includes('가끔') && q8.includes('흔들림')) obj.Lo += 1;
    else if (q8.includes('자주') && q8.includes('크게')) obj.Lo += 2;
  }

  // --- Q9, Q10, Q11: wallangel ---
  const q9Int = parsePainIntensity(answers.deep_wallangel_pain_intensity);
  const q10Loc = toLocationArray(answers.deep_wallangel_pain_location);
  if (q9Int > 0) {
    if (q10Loc.length > 0) addPainLocationPoints(q10Loc, obj, q9Int);
    else obj.D += q9Int;
  }
  const q11 = toString(answers.deep_wallangel_quality);
  if (q11) {
    if (q11.includes('어깨가 들리') || q11.includes('목이 긴장')) obj.N += 2;
    else if (q11.includes('팔꿈치') || q11.includes('손목')) obj.U += 2;
    else if (q11.includes('허리') || q11.includes('갈비뼈')) obj.L += 2;
    else if (q11.includes('전신') || q11.includes('뻣뻣') || q11.includes('피곤')) obj.D += 2;
  }

  // --- Q12, Q13, Q14: sls ---
  const q12Int = parsePainIntensity(answers.deep_sls_pain_intensity);
  const q13Loc = toLocationArray(answers.deep_sls_pain_location);
  if (q12Int > 0) {
    if (q13Loc.length > 0) addPainLocationPoints(q13Loc, obj, q12Int);
    else obj.D += q12Int;
  }
  const q14 = toString(answers.deep_sls_quality);
  if (q14) {
    if (q14.includes('10초') && q14.includes('안정')) {
      // 0 - no add
    } else if (q14.includes('무릎') || q14.includes('발목')) obj.Lo += 2;
    else if (q14.includes('골반') || q14.includes('허리') && q14.includes('비틀')) obj.L += 2;
    else if (q14.includes('상체') && q14.includes('흔들')) obj.D += 2;
    else if (q14.includes('거의 불가능') || q14.includes('불가능')) {
      obj.D += 3;
      obj.Lo += 1;
    }
  }

  const objectiveScores = { ...obj };

  // --- Q5: primary discomfort → FinalScores +4 ---
  const q5 = toString(answers.deep_basic_primary_discomfort);
  const finalScores = { ...obj };
  if (q5) {
    if (q5.includes('목') || q5.includes('어깨')) finalScores.N += 4;
    else if (q5.includes('허리') || q5.includes('골반')) finalScores.L += 4;
    else if (q5.includes('손목') || q5.includes('팔꿈치')) finalScores.U += 4;
    else if (q5.includes('무릎') || q5.includes('발목')) finalScores.Lo += 4;
  }

  // --- STABLE gate (Q5=해당없음, Q6/Q9/Q12=없음, Q8/Q11/Q14 특정값, D<=3) ---
  const q5해당없음 = q5?.includes('해당 없음') ?? false;
  const q6없음 = parsePainIntensity(answers.deep_squat_pain_intensity) === 0;
  const q9없음 = parsePainIntensity(answers.deep_wallangel_pain_intensity) === 0;
  const q12없음 = parsePainIntensity(answers.deep_sls_pain_intensity) === 0;
  const q8무릎잘감 = q8?.includes('무릎이 발 앞으로 잘 감') ?? false;
  const q11문제없음 = q11?.includes('문제 없음') ?? false;
  const q14안정적 = q14?.includes('10초 안정적으로 가능') ?? false;

  if (
    q5해당없음 &&
    q6없음 &&
    q9없음 &&
    q12없음 &&
    q8무릎잘감 &&
    q11문제없음 &&
    q14안정적 &&
    objectiveScores.D <= 3
  ) {
    return {
      scoring_version: 'deep_v2',
      result_type: 'STABLE',
      primaryFocus: 'FULL',
      secondaryFocus: 'NONE',
      objectiveScores,
      finalScores: { ...finalScores },
      confidence,
      answeredCount,
      totalCount: TOTAL_COUNT,
    };
  }

  // --- DECONDITIONED gate ---
  const D = objectiveScores.D;
  const maxPart = Math.max(
    objectiveScores.N,
    objectiveScores.L,
    objectiveScores.U,
    objectiveScores.Lo
  );
  if (D >= 6 && maxPart <= D - 1) {
    const primary = computePrimaryFocus(q5, objectiveScores, q14 ?? null, q11 ?? null);
    const secondary = computeSecondaryFocus(objectiveScores, primary);
    return {
      scoring_version: 'deep_v2',
      result_type: 'DECONDITIONED',
      primaryFocus: primary,
      secondaryFocus: secondary,
      objectiveScores,
      finalScores: { ...finalScores },
      confidence,
      answeredCount,
      totalCount: TOTAL_COUNT,
    };
  }

  // --- Normal result_type from FinalScores max ---
  const maxAxis = getMaxAxis(finalScores, q14, q11);
  const resultType = axisToResultType(maxAxis);
  const primary = computePrimaryFocus(q5, objectiveScores, q14 ?? null, q11 ?? null);
  const secondary = computeSecondaryFocus(objectiveScores, primary);

  return {
    scoring_version: 'deep_v2',
    result_type: resultType,
    primaryFocus: primary,
    secondaryFocus: secondary,
    objectiveScores,
    finalScores: { ...finalScores },
    confidence,
    answeredCount,
    totalCount: TOTAL_COUNT,
  };
}

function getMaxAxis(
  scores: DeepObjectiveScores,
  q14?: string | null,
  q11?: string | null
): AxisKey {
  const arr: [AxisKey, number][] = [
    ['N', scores.N],
    ['L', scores.L],
    ['U', scores.U],
    ['Lo', scores.Lo],
  ];
  arr.sort((a, b) => b[1] - a[1]);
  const top = arr[0];
  const second = arr[1];
  if (!second || top[1] > second[1]) return top[0];

  const a = top[0];
  const b = second[0];
  if ((a === 'Lo' || b === 'Lo') && (a === 'L' || b === 'L')) {
    if (q14?.includes('무릎') || q14?.includes('발목')) return 'Lo';
    if (q14?.includes('골반') || q14?.includes('허리')) return 'L';
    return 'Lo';
  }
  if ((a === 'N' || b === 'N') && (a === 'U' || b === 'U')) {
    if (q11?.includes('목') || q11?.includes('긴장')) return 'N';
    if (q11?.includes('손목') || q11?.includes('팔꿈치')) return 'U';
    return 'Lo';
  }
  return 'Lo';
}

function axisToResultType(axis: AxisKey): Exclude<DeepV2ResultType, 'DECONDITIONED' | 'STABLE'> {
  switch (axis) {
    case 'N':
      return 'NECK-SHOULDER';
    case 'L':
      return 'LUMBO-PELVIS';
    case 'U':
      return 'UPPER-LIMB';
    case 'Lo':
      return 'LOWER-LIMB';
    default:
      return 'LOWER-LIMB';
  }
}

function axisToFocus(axis: AxisKey): DeepFocus {
  switch (axis) {
    case 'N':
      return 'NECK-SHOULDER';
    case 'L':
      return 'LUMBO-PELVIS';
    case 'U':
      return 'UPPER-LIMB';
    case 'Lo':
      return 'LOWER-LIMB';
    default:
      return 'LOWER-LIMB';
  }
}

function computePrimaryFocus(
  q5: string | null,
  obj: DeepObjectiveScores,
  _q14?: string | null,
  _q11?: string | null
): DeepPrimaryFocus {
  if (q5) {
    if (q5.includes('목') || q5.includes('어깨')) return 'NECK-SHOULDER';
    if (q5.includes('허리') || q5.includes('골반')) return 'LUMBO-PELVIS';
    if (q5.includes('손목') || q5.includes('팔꿈치')) return 'UPPER-LIMB';
    if (q5.includes('무릎') || q5.includes('발목')) return 'LOWER-LIMB';
  }
  const maxAxis = getMaxAxis(obj, _q14, _q11);
  return axisToFocus(maxAxis);
}

function computeSecondaryFocus(
  obj: DeepObjectiveScores,
  primary: DeepPrimaryFocus
): DeepSecondaryFocus {
  if (primary === 'FULL') return 'NONE';
  const exclude: Partial<Record<AxisKey, boolean>> = {};
  switch (primary) {
    case 'NECK-SHOULDER':
      exclude.N = true;
      break;
    case 'LUMBO-PELVIS':
      exclude.L = true;
      break;
    case 'UPPER-LIMB':
      exclude.U = true;
      break;
    case 'LOWER-LIMB':
      exclude.Lo = true;
      break;
    default:
      return 'NONE';
  }
  const arr: [AxisKey, number][] = [
    ['N', exclude.N ? -1 : obj.N],
    ['L', exclude.L ? -1 : obj.L],
    ['U', exclude.U ? -1 : obj.U],
    ['Lo', exclude.Lo ? -1 : obj.Lo],
  ];
  arr.sort((a, b) => b[1] - a[1]);
  if (arr[0][1] <= 0) return 'NONE';
  return axisToFocus(arr[0][0]);
}

/** DeepFocus → exercise_templates focus_tags 매핑 */
const FOCUS_TO_TAGS: Record<string, string[]> = {
  'NECK-SHOULDER': ['upper_trap_release', 'neck_mobility', 'thoracic_mobility'],
  'LUMBO-PELVIS': ['hip_mobility', 'glute_activation', 'core_control'],
  'UPPER-LIMB': ['shoulder_mobility', 'shoulder_stability'],
  'LOWER-LIMB': ['lower_chain_stability', 'glute_medius', 'ankle_mobility'],
  'FULL': ['core_control', 'full_body_reset'],
};

/** 축 점수 높을 때 추가할 avoid_tags */
const AXIS_TO_AVOID: Record<AxisKey, string[]> = {
  N: ['shoulder_overhead'],
  L: ['lower_back_pain'],
  U: ['wrist_load'],
  Lo: ['knee_load', 'knee_ground_pain'],
  D: [],
};

/**
 * DeepV2Result → DeepV2ExtendedResult (level, focus_tags, avoid_tags)
 * day-plan-generator가 소비하는 SSOT
 */
export function extendDeepV2(v2: DeepV2Result): DeepV2ExtendedResult {
  const { result_type, primaryFocus, secondaryFocus, objectiveScores, finalScores, confidence } = v2;
  const D = objectiveScores.D;

  let level: number;
  if (result_type === 'STABLE') {
    level = 2;
  } else if (result_type === 'DECONDITIONED') {
    level = 1;
  } else {
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
  const axes: AxisKey[] = ['N', 'L', 'U', 'Lo'];
  for (const a of axes) {
    if (finalScores[a] >= 3) {
      avoid_tags.push(...(AXIS_TO_AVOID[a] ?? []));
    }
  }

  const algorithm_scores: DeepAlgorithmScores = {
    upper_score: objectiveScores.N + objectiveScores.U,
    lower_score: objectiveScores.L + objectiveScores.Lo,
    core_score: Math.max(objectiveScores.N, objectiveScores.L),
    balance_score: objectiveScores.D,
    pain_risk: objectiveScores.D,
  };

  return {
    ...v2,
    level,
    focus_tags,
    avoid_tags: [...new Set(avoid_tags)],
    algorithm_scores,
  };
}
