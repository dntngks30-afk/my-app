/**
 * PR-ALG-10: Session Rationale Engine — Axis Descriptions
 *
 * priority_vector 축별 설명 매핑.
 * Deep Result → 세션 목적 설명 연결.
 */

export interface AxisDescription {
  /** 축 라벨 (UI 표시용) */
  label: string;
  /** 축 부족/문제 설명 (예: "한발 지지 안정성이 부족합니다") */
  description: string;
  /** 세션 목표 문구 (예: "엉덩이와 골반 안정성을 강화하는 세션입니다") */
  sessionGoal: string;
}

/** priority_vector axis → 설명 */
export const AXIS_DESCRIPTIONS: Record<string, AxisDescription> = {
  lower_stability: {
    label: '하체 안정',
    description: '한발 지지 안정성이 부족하여',
    sessionGoal: '엉덩이와 골반 안정성을 강화하는 세션입니다',
  },
  lower_mobility: {
    label: '하체 가동성',
    description: '고관절·발목 가동성이 제한되어',
    sessionGoal: '하체 관절 가동성을 회복하는 세션입니다',
  },
  upper_mobility: {
    label: '상체 가동성',
    description: '흉추·어깨 가동성이 제한되어',
    sessionGoal: '상체 가동성과 움직임 범위를 개선하는 세션입니다',
  },
  trunk_control: {
    label: '몸통 제어',
    description: '코어 안정성이 부족하여',
    sessionGoal: '몸통 제어와 코어 안정성을 강화하는 세션입니다',
  },
  asymmetry: {
    label: '좌우 균형',
    description: '좌우 움직임 균형이 무너져',
    sessionGoal: '좌우 균형과 대칭 움직임을 회복하는 세션입니다',
  },
  deconditioned: {
    label: '전신 회복',
    description: '기본 움직임 회복이 우선이어서',
    sessionGoal: '안정적인 움직임 기반을 다지는 세션입니다',
  },
};

/** 축 라벨 조회 (fallback: snake_case 휴먼라이즈) */
export function getAxisLabel(axis: string): string {
  return AXIS_DESCRIPTIONS[axis]?.label ?? axis.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 축 설명 조회 */
export function getAxisDescription(axis: string): string {
  return AXIS_DESCRIPTIONS[axis]?.description ?? `${getAxisLabel(axis)}을(를) 개선하기 위한 세션입니다`;
}

/** 축별 세션 목표 문구 조회 */
export function getAxisSessionGoal(axis: string): string {
  return AXIS_DESCRIPTIONS[axis]?.sessionGoal ?? `${getAxisLabel(axis)}을(를) 회복하기 위한 구성입니다`;
}
