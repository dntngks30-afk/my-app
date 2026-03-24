/**
 * Deep Scoring Core V2 — 채널 독립 상태 해석 엔진
 *
 * 이 파일은 입력 채널(free_survey / camera / deep_paid)을 알지 못한다.
 * source_mode 없이도 동작한다.
 *
 * 입력:  DeepScoringEvidence (채널 추출기가 생성)
 * 출력:  DeepScoringCoreResult (adapter 레이어가 UnifiedDeepResultV2로 변환)
 *
 * deep_v3 `classifyDeepV3` + `buildDeepV3Derived` 로직을 채널 독립적으로 추출.
 *
 * PR-SURVEY-02: 무료 설문이 `survey_axis_interaction_hints`를 넘기면 비-STABLE 에서만
 *               보수적 축 조정 1패스 적용(카메라/유료는 hints 없음 → 동일 동작).
 *
 * @see src/lib/deep-test/scoring/deep_v3.ts (원본 참조)
 */

import { getFocusToTags, getAxisToAvoid } from '@/lib/deep-test/config';
import { applySurveyAxisInteractionAdjustments } from './survey-axis-interactions';
import type {
  DeepScoringEvidence,
  DeepScoringCoreResult,
  AxisScores,
  ScoringPrimaryType,
  ScoringSecondaryType,
  ScoringPainMode,
  ScoringPriorityVector,
} from './types';

// ─── Pain Mode 결정 ───────────────────────────────────────────────────────────

/**
 * evidence.pain_signals → ScoringPainMode
 *
 * deep_v3 resolvePainMode와 동일 의미 (PR-ALG-13A 포함).
 * 통증 정보 없음(undefined)이면 'none' 안전 기본값.
 */
function resolvePainMode(evidence: DeepScoringEvidence): ScoringPainMode {
  const { max_intensity, primary_discomfort_none } = evidence.pain_signals;

  // 통증 데이터 없음 → 안전 기본값 none
  if (max_intensity === undefined) return 'none';

  if (max_intensity >= 3) return 'protected';
  if (max_intensity >= 2) return 'caution';
  // PR-ALG-13A: max_intensity===1 + primary_discomfort_none → none으로 승격
  if (max_intensity === 1 && primary_discomfort_none === true) return 'none';
  return max_intensity >= 1 ? 'caution' : 'none';
}

// ─── 축 정렬 (tie-break 포함) ─────────────────────────────────────────────────

/**
 * deep_v3 classifyDeepV3와 동일하게 5축만 사용 (deconditioned 제외).
 * deconditioned는 DECONDITIONED gate에서 별도 처리.
 */
const MOVEMENT_AXIS_ORDER: Array<keyof AxisScores> = [
  'lower_stability',
  'lower_mobility',
  'upper_mobility',
  'trunk_control',
  'asymmetry',
];

function sortAxes(sv: AxisScores): Array<keyof AxisScores> {
  return [...MOVEMENT_AXIS_ORDER].sort((a, b) => {
    const diff = sv[b] - sv[a];
    if (diff !== 0) return diff;
    return MOVEMENT_AXIS_ORDER.indexOf(a) - MOVEMENT_AXIS_ORDER.indexOf(b);
  });
}

function axisToType(axis: keyof AxisScores, deconditioned: number): ScoringPrimaryType {
  switch (axis) {
    case 'lower_stability':    return 'LOWER_INSTABILITY';
    case 'lower_mobility':     return 'LOWER_MOBILITY_RESTRICTION';
    case 'upper_mobility':     return 'UPPER_IMMOBILITY';
    case 'trunk_control':      return 'CORE_CONTROL_DEFICIT';
    case 'asymmetry':
      return deconditioned >= 4 ? 'DECONDITIONED' : 'CORE_CONTROL_DEFICIT';
    // 'deconditioned'은 MOVEMENT_AXIS_ORDER에 포함되지 않으므로 이 케이스는 도달하지 않음
    default:
      return 'STABLE';
  }
}

// ─── 분류 로직 ────────────────────────────────────────────────────────────────

function classifyTypes(
  sv: AxisScores,
  painMode: ScoringPainMode
): { primary_type: ScoringPrimaryType; secondary_type: ScoringSecondaryType } {
  const { lower_stability, lower_mobility, upper_mobility, trunk_control, asymmetry, deconditioned } = sv;

  // DECONDITIONED gate (pain_mode=protected → 즉시 DECONDITIONED)
  if (painMode === 'protected') {
    return { primary_type: 'DECONDITIONED', secondary_type: null };
  }

  // DECONDITIONED gate (D 압도적)
  const maxPart = Math.max(lower_stability, lower_mobility, upper_mobility, trunk_control, asymmetry);
  if (deconditioned >= 6 && maxPart <= deconditioned - 1) {
    return { primary_type: 'DECONDITIONED', secondary_type: null };
  }

  // 정상 분류: 높은 축부터 정렬
  const sorted = sortAxes(sv);
  const top = sorted[0];
  const second = sorted[1];
  const topVal = top ? sv[top] : 0;
  const secondVal = second ? sv[second] : 0;

  const primary_type = top && topVal > 0 ? axisToType(top, deconditioned) : 'STABLE';
  const secondary_type =
    second && secondVal > 0 && second !== top ? axisToType(second, deconditioned) : null;

  return { primary_type, secondary_type };
}

// ─── Priority Vector 정규화 ───────────────────────────────────────────────────

function normalizePriorityVector(sv: AxisScores): ScoringPriorityVector {
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
    lower_mobility:  Math.min(1, sv.lower_mobility / max),
    upper_mobility:  Math.min(1, sv.upper_mobility / max),
    trunk_control:   Math.min(1, sv.trunk_control / max),
    asymmetry:       Math.min(1, sv.asymmetry / max),
    deconditioned:   Math.min(1, sv.deconditioned / max),
  };
}

// ─── 태그 및 레벨 파생 ────────────────────────────────────────────────────────

/** ScoringPrimaryType → focus 키 (tag_map 키 체계) */
function primaryTypeToFocusKey(t: ScoringPrimaryType): string {
  switch (t) {
    case 'LOWER_INSTABILITY':          return 'LOWER-LIMB';
    case 'LOWER_MOBILITY_RESTRICTION': return 'LOWER-LIMB';
    case 'UPPER_IMMOBILITY':           return 'UPPER-LIMB';
    case 'CORE_CONTROL_DEFICIT':       return 'LUMBO-PELVIS';
    case 'DECONDITIONED':              return 'FULL';
    case 'STABLE':                     return 'FULL';
    default:                           return 'FULL';
  }
}

/** axis_scores → deep_v2 호환 축 키 (N/L/U/Lo/D) */
function toObjectiveAxis(sv: AxisScores): Record<string, number> {
  return {
    N:  sv.trunk_control + (sv.upper_mobility > 0 ? 0.5 : 0),
    L:  sv.trunk_control + sv.asymmetry,
    U:  sv.upper_mobility,
    Lo: sv.lower_stability + sv.lower_mobility,
    D:  sv.deconditioned,
  };
}

function buildDerived(
  primary_type: ScoringPrimaryType,
  secondary_type: ScoringSecondaryType,
  painMode: ScoringPainMode,
  sv: AxisScores,
  confidence: number
): DeepScoringCoreResult['derived'] {
  const FOCUS_TO_TAGS = getFocusToTags();
  const AXIS_TO_AVOID = getAxisToAvoid();

  const primaryKey = primaryTypeToFocusKey(primary_type);
  const focus_tags: string[] = [...(FOCUS_TO_TAGS[primaryKey] ?? FOCUS_TO_TAGS['FULL'])];
  if (secondary_type) {
    const secKey = primaryTypeToFocusKey(secondary_type);
    for (const t of (FOCUS_TO_TAGS[secKey] ?? [])) {
      if (!focus_tags.includes(t)) focus_tags.push(t);
    }
  }

  const obj = toObjectiveAxis(sv);
  const avoid_tags: string[] = [];
  const axisMap: Record<string, string> = { N: 'N', L: 'L', U: 'U', Lo: 'Lo' };
  for (const [axis, key] of Object.entries(axisMap)) {
    if ((obj[axis] ?? 0) >= 3) {
      avoid_tags.push(...(AXIS_TO_AVOID[key] ?? []));
    }
  }

  // level 결정
  let level: number;
  if (primary_type === 'STABLE') {
    level = 2;
  } else if (primary_type === 'DECONDITIONED' || painMode === 'protected') {
    level = 1;
  } else {
    const D = sv.deconditioned;
    if (D >= 4) level = 1;
    else if (D >= 2) level = 2;
    else level = 3;
  }
  if (confidence < 0.5) level = Math.min(level, 1);
  level = Math.max(1, Math.min(3, level));

  const algorithm_scores = {
    upper_score:   obj.N + obj.U,
    lower_score:   obj.L + obj.Lo,
    core_score:    Math.max(obj.N, obj.L),
    balance_score: obj.D,
    pain_risk:     obj.D,
  };

  return {
    level,
    focus_tags,
    avoid_tags: [...new Set(avoid_tags)],
    algorithm_scores,
  };
}

// ─── reason_codes 생성 ────────────────────────────────────────────────────────

function buildReasonCodes(
  sv: AxisScores,
  painMode: ScoringPainMode,
  primary_type: ScoringPrimaryType
): string[] {
  const codes: string[] = [];
  const sorted = sortAxes(sv); // 5축만 (deconditioned 제외)
  const top = sorted[0];
  const second = sorted[1];
  if (top && sv[top] > 0) codes.push(`top_axis_${top}`);
  if (second && sv[second] > 0 && second !== top) codes.push(`secondary_axis_${second}`);
  if (painMode === 'protected') codes.push('pain_protected_mode');
  if (painMode === 'caution') codes.push('pain_caution_mode');
  if (primary_type === 'DECONDITIONED') codes.push('deconditioned_gate');
  if (primary_type === 'STABLE') codes.push('stable_gate');
  if (sv.asymmetry > 0) codes.push('asymmetry_detected');
  return codes;
}

// ─── STABLE gate ──────────────────────────────────────────────────────────────

function isStableEvidence(evidence: DeepScoringEvidence): boolean {
  const { axis_scores: sv, pain_signals, movement_quality } = evidence;
  const noPain = (pain_signals.max_intensity ?? 0) === 0;
  const primaryNone = pain_signals.primary_discomfort_none !== false;
  const allGood = movement_quality.all_good;
  const lowDecond = sv.deconditioned <= 3;
  const noMovementIssues =
    sv.lower_stability === 0 &&
    sv.upper_mobility === 0 &&
    sv.trunk_control === 0;
  return noPain && primaryNone && allGood && lowDecond && noMovementIssues;
}

// ─── 메인 진입점 ──────────────────────────────────────────────────────────────

/**
 * runDeepScoringCore — 채널 독립 상태 해석 엔진
 *
 * source_mode를 모르고 동작한다.
 * missing evidence는 0 대체 없이 missing_signals로 유지된다.
 */
export function runDeepScoringCore(
  evidence: DeepScoringEvidence
): DeepScoringCoreResult {
  // Pain mode 결정
  const pain_mode = resolvePainMode(evidence);

  const stable = isStableEvidence(evidence);

  // PR-SURVEY-02: STABLE 후보는 interaction 미적용(기존 zeroing·게이트 유지)
  const { axis_scores: sv, fired_rule_ids } = stable
    ? { axis_scores: evidence.axis_scores, fired_rule_ids: [] as string[] }
    : applySurveyAxisInteractionAdjustments(evidence);

  // Primary/Secondary type 분류
  let primary_type: ScoringPrimaryType;
  let secondary_type: ScoringSecondaryType;

  if (stable) {
    primary_type = 'STABLE';
    secondary_type = null;
  } else {
    const classified = classifyTypes(sv, pain_mode);
    primary_type = classified.primary_type;
    secondary_type = classified.secondary_type;
  }

  // Confidence 계산
  const confidence_base = evidence.total_count > 0
    ? evidence.answered_count / evidence.total_count
    : 0;

  // gap bonus: 1차-2차 축 점수 차이 기반
  const sorted = sortAxes(sv);
  const topVal  = sv[sorted[0]] ?? 0;
  const secVal  = sv[sorted[1]] ?? 0;
  const confidence_gap_bonus =
    topVal > 0 ? ((topVal - secVal) / topVal) * 0.15 : 0;

  const confidence = Math.min(1, Math.max(0, confidence_base + confidence_gap_bonus));

  // Priority vector (0~1 정규화)
  const priority_vector = normalizePriorityVector(sv);

  // Derived (tags, level, algorithm_scores)
  const derived = buildDerived(primary_type, secondary_type, pain_mode, sv, confidence);

  // Reason codes + interaction audit tags
  const reason_codes = [
    ...buildReasonCodes(sv, pain_mode, primary_type),
    ...fired_rule_ids.map((id) => `interaction_${id}`),
  ];

  // missing_signals 전달 (evidence에서)
  const missing_signals = [...evidence.missing_signals];

  return {
    primary_type,
    secondary_type,
    priority_vector,
    pain_mode,
    confidence_base,
    confidence_gap_bonus,
    confidence,
    reason_codes,
    missing_signals,
    derived,
    axis_scores_raw: { ...sv },
  };
}
