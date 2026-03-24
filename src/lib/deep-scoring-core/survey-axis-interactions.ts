/**
 * PR-SURVEY-02 — 무료 설문 baseline용 보수적 interaction rule layer
 *
 * 가중 합만으로는 약한 “문항 조합” 패턴을 axis_scores에 소폭 반영한다.
 * - survey_axis_interaction_hints가 있을 때만 동작(카메라/유료는 undefined).
 * - STABLE 분기는 core에서 본 함수 호출 전에 차단되므로 여기서 다루지 않음.
 * - signalType(PR-SURVEY-01)은 사용하지 않음.
 */

import type { AxisScores, DeepScoringEvidence, SurveyAxisInteractionHints } from './types';

const MOVEMENT_AXIS_KEYS: readonly (keyof AxisScores)[] = [
  'lower_stability',
  'lower_mobility',
  'upper_mobility',
  'trunk_control',
  'asymmetry',
] as const;

function cloneScores(sv: AxisScores): AxisScores {
  return { ...sv };
}

/** 상한 캡 — evidence 스케일(대략 0~2.5 + decond 부스트)을 벗어나지 않게 */
const CAP = {
  trunk_control: 2.7,
  lower_mobility: 0.58,
  asymmetry: 2.4,
  deconditioned_pre_gate: 5.55,
} as const;

export type SurveyAxisInteractionResult = {
  axis_scores: AxisScores;
  /** reason_codes에 `interaction_<id>` 형태로 합류 */
  fired_rule_ids: string[];
};

/**
 * hints 없음 → 입력 axis_scores 그대로(참조 동일), 규칙 미적용.
 * hints 있음 → 복사본에 순서 A → C → B → D로 소폭 가산.
 */
export function applySurveyAxisInteractionAdjustments(
  evidence: DeepScoringEvidence
): SurveyAxisInteractionResult {
  const hints = evidence.survey_axis_interaction_hints;
  if (hints === undefined) {
    return { axis_scores: evidence.axis_scores, fired_rule_ids: [] };
  }

  const sv = cloneScores(evidence.axis_scores);
  const fired: string[] = [];

  applyRuleA(sv, hints, fired);
  applyRuleC(sv, hints, fired);
  applyRuleB(sv, fired);
  applyRuleD(sv, hints, fired);

  return { axis_scores: sv, fired_rule_ids: fired };
}

/** Rule A: 하체 가동성 신호 + C군(허리·부하) 맥락 → 체간 보호 해석 보강(통증 대체 아님) */
function applyRuleA(
  sv: AxisScores,
  hints: SurveyAxisInteractionHints,
  fired: string[]
): void {
  if (!hints.trunk_load_pain_proxy) return;
  if (sv.lower_mobility < 0.085) return;

  sv.trunk_control = Math.min(CAP.trunk_control, sv.trunk_control + 0.065);
  sv.lower_mobility = Math.min(CAP.lower_mobility, sv.lower_mobility + 0.035);
  fired.push('survey02_rule_a_lower_mobility_trunk_load');
}

/** Rule C: F군 문항이 같이 높고 asymmetry 축이 이미 의미 있으면 소폭 강화 */
function applyRuleC(
  sv: AxisScores,
  hints: SurveyAxisInteractionHints,
  fired: string[]
): void {
  if (!hints.f_asymmetry_cluster) return;
  if (sv.asymmetry < 0.22) return;

  sv.asymmetry = Math.min(CAP.asymmetry, sv.asymmetry + 0.085);
  fired.push('survey02_rule_c_asymmetry_stack');
}

/**
 * Rule B: movement 5축이 둔탁하게 함께 높음(분산 낮음) → deconditioned만 소폭 지지
 * (이미 adapter에서 decond=7 부스트된 경우는 decond≥6으로 자연 스킵)
 */
function applyRuleB(sv: AxisScores, fired: string[]): void {
  if (sv.deconditioned >= 6) return;

  const vals = MOVEMENT_AXIS_KEYS.map((k) => sv[k]);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const meanV = vals.reduce((a, b) => a + b, 0) / vals.length;

  if (minV < 0.34 || maxV - minV > 0.55 || meanV < 0.4) return;
  if (sv.deconditioned < 0.22) return;

  sv.deconditioned = Math.min(CAP.deconditioned_pre_gate, sv.deconditioned + 0.13);
  fired.push('survey02_rule_b_broad_high');
}

/** Rule D: G군 긴장 + 전반 낮은 자기평가 → deconditioned 소폭 지지 */
function applyRuleD(
  sv: AxisScores,
  hints: SurveyAxisInteractionHints,
  fired: string[]
): void {
  if (!hints.g_guarding_cluster || !hints.low_global_movement_confidence) return;
  if (sv.deconditioned >= 6) return;

  sv.deconditioned = Math.min(CAP.deconditioned_pre_gate, sv.deconditioned + 0.1);
  fired.push('survey02_rule_d_fatigue_low_habit');
}
