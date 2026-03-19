/**
 * PR-V2-06 — Public Result 표시 레이블 SSOT
 *
 * Deep Result V2 어휘 → 한국어 UI 레이블 매핑.
 * 이 파일이 baseline/refined/future-loaded 모든 공개 결과 표면의 레이블 SSOT다.
 *
 * ⚠️ 이 파일에 동물 이름(kangaroo, hedgehog 등)을 headline label로 추가 금지.
 * 모든 레이블은 paid-deep-style / Deep Result V2 어휘 기반이어야 한다.
 *
 * @see src/lib/result/deep-result-v2-contract.ts (타입 SSOT)
 */

import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';

// ─── Primary Type ─────────────────────────────────────────────────────────────

/** UnifiedPrimaryType → 간결 표시 레이블 */
export const PRIMARY_TYPE_LABELS: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체 안정성 패턴',
  LOWER_MOBILITY_RESTRICTION: '하체 가동성 제한',
  UPPER_IMMOBILITY:           '상체 가동성 제한',
  CORE_CONTROL_DEFICIT:       '체간 조절 패턴',
  DECONDITIONED:              '복합 재조정 패턴',
  STABLE:                     '균형형',
  UNKNOWN:                    '분석 정보 부족',
};

/** UnifiedPrimaryType → 간략 설명 (gate/card용) */
export const PRIMARY_TYPE_BRIEF: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체의 안정성 신호가 가장 두드러집니다.',
  LOWER_MOBILITY_RESTRICTION: '발목·고관절의 가동 범위 제한 신호가 나타납니다.',
  UPPER_IMMOBILITY:           '흉추·어깨의 가동성 제한 신호가 나타납니다.',
  CORE_CONTROL_DEFICIT:       '허리·골반 조절 패턴 신호가 가장 두드러집니다.',
  DECONDITIONED:              '복수 부위에서 동시에 신호가 나타납니다.',
  STABLE:                     '전반적으로 균형이 잡힌 움직임 패턴입니다.',
  UNKNOWN:                    '충분한 신호를 얻지 못했습니다.',
};

/** UnifiedPrimaryType → accent 색상 */
export const PRIMARY_TYPE_COLOR: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '#60a5fa',
  LOWER_MOBILITY_RESTRICTION: '#34d399',
  UPPER_IMMOBILITY:           '#a78bfa',
  CORE_CONTROL_DEFICIT:       '#f97316',
  DECONDITIONED:              '#fb923c',
  STABLE:                     '#4ade80',
  UNKNOWN:                    '#94a3b8',
};

// ─── Evidence & Stage ────────────────────────────────────────────────────────

/** evidence_level → 배지 레이블 */
export const EVIDENCE_LEVEL_LABELS: Record<string, string> = {
  lite:    '기초 분석',
  partial: '부분 분석',
  full:    '정밀 분석',
};

/** camera evidence quality → 배지 레이블 */
export const CAMERA_QUALITY_LABELS: Record<string, string> = {
  strong:  '동작 분석 확인',
  partial: '동작 분석 일부',
  minimal: '신호 제한적',
};

// ─── Axis ─────────────────────────────────────────────────────────────────────

/** priority_vector 축 → 한국어 레이블 */
export const AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정성',
  lower_mobility:  '하체 가동성',
  upper_mobility:  '상체 가동성',
  trunk_control:   '체간 조절',
  asymmetry:       '좌우 균형',
  deconditioned:   '전신 조건화',
};

// ─── Reason Codes ────────────────────────────────────────────────────────────

/** reason_code → 간략 설명 */
export const REASON_CODE_LABELS: Record<string, string> = {
  top_axis_lower_stability:       '하체 안정성 신호 강함',
  top_axis_lower_mobility:        '하체 가동성 제한 신호',
  top_axis_upper_mobility:        '상체 가동성 제한 신호',
  top_axis_trunk_control:         '체간 조절 신호 강함',
  top_axis_asymmetry:             '좌우 비대칭 신호',
  secondary_axis_lower_stability: '하체 안정성 보조 신호',
  secondary_axis_lower_mobility:  '하체 가동성 보조 신호',
  secondary_axis_upper_mobility:  '상체 가동성 보조 신호',
  secondary_axis_trunk_control:   '체간 조절 보조 신호',
  secondary_axis_asymmetry:       '비대칭 보조 신호',
  stable_gate:                    '균형형 판정',
  deconditioned_gate:             '복합 패턴 판정',
  asymmetry_detected:             '좌우 비대칭 감지',
  lumbar_dominant_pattern:        '허리 주도 패턴',
  thoracic_closure_pattern:       '흉추 닫힘 패턴',
  lateral_imbalance_pattern:      '측면 불균형 패턴',
  anterior_head_pattern:          '경추 전방화 패턴',
  ankle_mobility_restriction:     '발목 가동성 제한',
  global_bracing_pattern:         '전신 긴장 패턴',
  balanced_movement_pattern:      '균형 움직임 패턴',
  composite_pattern:              '복합 패턴 감지',
  camera_evidence_partial:        '카메라 일부 신호 기반',
};

// ─── Missing Signals ──────────────────────────────────────────────────────────

/** missing_signal → 한국어 안내 문구 */
export const MISSING_SIGNAL_LABELS: Record<string, string> = {
  pain_intensity_missing:              '통증 강도 정보 (유료 딥테스트에서 측정)',
  pain_location_missing:               '통증 위치 정보 (유료 딥테스트에서 측정)',
  objective_movement_test_missing:     '객관 동작 테스트 (카메라 분석에서 측정)',
  camera_evidence_partial:             '카메라 신호 일부 제한 (재촬영 시 개선 가능)',
  subjective_fatigue_missing:          '주관적 피로도 (설문 항목에 없음)',
};

/** missing_signals 목록에서 UI에 표시할 항목만 필터링 */
export function filterDisplayableMissingSignals(signals: string[]): string[] {
  return signals.filter(
    (s) =>
      !s.includes('_empty') &&
      !s.includes('_step_') &&
      s in MISSING_SIGNAL_LABELS
  );
}
