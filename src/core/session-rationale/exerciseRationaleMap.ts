/**
 * PR-ALG-10: Session Rationale Engine — Exercise Rationale Map
 *
 * focus_tag → 운동별 처방 근거 매핑.
 * 운동 선택 이유를 사용자에게 전달.
 */

/** focus_tag → rationale (운동 처방 근거) */
export const FOCUS_TAG_TO_RATIONALE: Record<string, string> = {
  // 하체 안정 / 골반
  lower_chain_stability: '골반 안정성과 하체 체인 지지를 강화합니다',
  glute_medius: '중둔근 강화로 무릎 흔들림을 줄입니다',
  glute_activation: '엉덩이 근육 활성화를 통해 골반 안정성을 개선합니다',
  basic_balance: '좌우 골반 안정성과 기본 균형을 강화합니다',
  core_stability: '코어 안정화로 몸통 흔들림을 줄입니다',
  global_core: '전신 코어 연결로 동작 안정성을 높입니다',
  core_control: '호흡-코어 연결로 몸통 제어를 개선합니다',

  // 가동성
  hip_mobility: '고관절 가동성을 회복하고 움직임 범위를 넓힙니다',
  ankle_mobility: '발목 가동성과 발 아치 지지를 개선합니다',
  thoracic_mobility: '흉추 가동성으로 상체 움직임을 부드럽게 합니다',
  shoulder_mobility: '어깨 가동성과 움직임 범위를 회복합니다',
  shoulder_stability: '어깨 안정화로 부하 분산을 돕습니다',
  neck_mobility: '목 가동성과 긴장 완화를 돕습니다',

  // 리셋 / 이완
  full_body_reset: '전신 움직임을 부드럽게 리셋합니다',
  calf_release: '종아리 이완으로 하체 긴장을 풀어줍니다',
  upper_trap_release: '승모근 이완으로 상체 긴장을 풀어줍니다',
  hip_flexor_stretch: '고관절 굴곡근 스트레치로 앞쪽 긴장을 완화합니다',
  upper_back_activation: '상등 활성화로 자세를 정렬합니다',
};

/** focus_tag로 rationale 조회. 없으면 fallback */
export function getExerciseRationale(focusTag: string | null | undefined): string | null {
  if (!focusTag || typeof focusTag !== 'string') return null;
  const trimmed = focusTag.trim();
  return FOCUS_TAG_TO_RATIONALE[trimmed] ?? null;
}
