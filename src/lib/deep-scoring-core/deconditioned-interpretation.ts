/**
 * PR-SURVEY-03 — deconditioned 유사 패턴의 내부 해석(broad / hybrid / low_confidence)
 *
 * primary_type은 바꾸지 않고, 축 분포·우세도·설문 힌트로 “형태”만 레이블한다.
 * 소비: reason_codes, priority_vector 소폭 보정(low_confidence), _compat 메타(설문 baseline).
 */

import type {
  AxisScores,
  DeepScoringEvidence,
  DeconditionedInterpretation,
  ScoringPainMode,
  ScoringPrimaryType,
  ScoringSecondaryType,
} from './types';

const M_KEYS: readonly (keyof AxisScores)[] = [
  'lower_stability',
  'lower_mobility',
  'upper_mobility',
  'trunk_control',
  'asymmetry',
] as const;

function movementProfile(sv: AxisScores) {
  const vals = M_KEYS.map((k) => sv[k]);
  const sorted = [...vals].sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  const minV = sorted[4] ?? 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const dom = top > 1e-6 ? (top - second) / top : 0;
  const spread = top - minV;
  return { top, second, minV, mean, dom, spread, maxPart: top };
}

/**
 * @param sv interaction 적용 후 축 점수
 */
export function evaluateDeconditionedInterpretation(
  sv: AxisScores,
  primary_type: ScoringPrimaryType,
  secondary_type: ScoringSecondaryType,
  pain_mode: ScoringPainMode,
  evidence: DeepScoringEvidence
): DeconditionedInterpretation {
  void secondary_type;
  void pain_mode;

  const D = sv.deconditioned;
  const { top, mean, dom, spread, maxPart, minV } = movementProfile(sv);
  const hints = evidence.survey_axis_interaction_hints;

  if (primary_type === 'STABLE') return 'none';
  if (D < 0.28 && primary_type !== 'DECONDITIONED') return 'none';

  // ── DECONDITIONED primary: broad vs hybrid ─────────────────────────────
  if (primary_type === 'DECONDITIONED') {
    if (top >= 0.48 && dom >= 0.2) return 'hybrid';
    if (mean >= 0.38 && spread <= 0.82 && minV >= 0.14) return 'broad';
    return 'broad';
  }

  // ── 특정 축 primary + decond “배경” 지지 → hybrid ─────────────────────
  if (D >= 1.15 && maxPart > 0.08) {
    const ratio = D / maxPart;
    if (ratio >= 0.3 && ratio <= 0.92 && dom >= 0.08) return 'hybrid';
  }

  // ── 약한 decond 신호: 과대 해석 방지용 low_confidence ─────────────────
  if (
    hints?.g_guarding_cluster &&
    hints.low_global_movement_confidence &&
    D >= 0.42 &&
    D < 3.6
  ) {
    return 'low_confidence';
  }

  if (D >= 0.52 && D < 2.65 && dom < 0.13 && mean < 0.48 && maxPart >= 0.2) {
    return 'low_confidence';
  }

  return 'none';
}
