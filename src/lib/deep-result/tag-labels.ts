/**
 * focus_tags / avoid_tags → 한글 라벨 SSOT
 * 등록된 태그는 매핑 사용, 미등록은 SNAKE_CASE → 휴먼라이즈 fallback
 */

const TAG_LABELS: Record<string, string> = {
  // focus_tags (exercise-templates + tag_map)
  full_body_reset: '전신 리셋',
  core_control: '코어 컨트롤',
  calf_release: '종아리 이완',
  upper_trap_release: '승모근 이완',
  neck_mobility: '목 가동성',
  thoracic_mobility: '흉추 가동성',
  shoulder_mobility: '어깨 가동성',
  shoulder_stability: '어깨 안정화',
  upper_back_activation: '상등 활성화',
  hip_flexor_stretch: '고관절 굴곡근 스트레치',
  hip_mobility: '고관절 가동성',
  glute_activation: '둔근 활성화',
  lower_chain_stability: '하체 체인 안정화',
  core_stability: '코어 안정화',
  global_core: '전신 코어',
  glute_medius: '중둔근',
  basic_balance: '기본 균형',
  ankle_mobility: '발목 가동성',
  // avoid_tags (contraindications)
  shoulder_overhead: '어깨 오버헤드',
  shoulder_anterior_pain: '어깨 앞쪽 통증',
  wrist_load: '손목 부하',
  knee_ground_pain: '무릎 접지 통증',
  knee_load: '무릎 부하',
  lower_back_pain: '허리 통증',
  ankle_instability: '발목 불안정',
  deep_squat: '깊은 스쿼트',
};

function humanizeSnakeCase(s: string): string {
  return s
    .split('_')
    .map((part) =>
      part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''
    )
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function getTagLabel(tag: string): string {
  if (!tag || typeof tag !== 'string') return '';
  const key = tag.trim();
  if (TAG_LABELS[key]) return TAG_LABELS[key];
  return humanizeSnakeCase(key);
}
