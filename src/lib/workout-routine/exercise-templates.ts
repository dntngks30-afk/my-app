/**
 * MOVE RE - Exercise Template Pool (28 templates)
 *
 * Clinical-grade biomechanics & posture correction.
 * SSOT for Deep V2 routine selection. All filtering uses these templates.
 *
 * @module workout-routine/exercise-templates
 */

export interface ExerciseTemplate {
  /** Unique identifier (M01–M28) */
  id: string;
  /** Display name (Korean) */
  name: string;
  /** Difficulty tier: 1=초보/재활, 2=일반, 3=강화 */
  level: number;
  /** Tags that match user's focus_tags for prioritization */
  focus_tags: readonly string[];
  /** Tags that cause exclusion if user has any of these in avoid_tags */
  avoid_tags: readonly string[];
  /** Optional video URL for instruction */
  videoUrl: string | null;
}

/**
 * 28 predefined exercise templates.
 * M01 = Universal Fallback. M28 = Secondary Fallback.
 */
export const EXERCISE_TEMPLATES: ReadonlyArray<ExerciseTemplate> = [
  // --- Universal Fallbacks (Level 1, no avoid_tags) ---
  {
    id: 'M01',
    name: '90/90 벽 호흡',
    level: 1,
    focus_tags: ['full_body_reset', 'core_control'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M28',
    name: '레그업 더 월',
    level: 1,
    focus_tags: ['full_body_reset', 'calf_release'],
    avoid_tags: [],
    videoUrl: null,
  },

  // --- Phase: 호흡 및 리셋 (Level 1) ---
  {
    id: 'M02',
    name: '크로커다일 호흡',
    level: 1,
    focus_tags: ['full_body_reset', 'core_control'],
    avoid_tags: [],
    videoUrl: null,
  },
  
  // --- Phase: 상체 가동성 및 안정화 ---
  {
    id: 'M03',
    name: '턱 당기기',
    level: 1,
    focus_tags: ['upper_trap_release', 'neck_mobility'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M04',
    name: '흉추 신전',
    level: 1,
    focus_tags: ['thoracic_mobility'],
    avoid_tags: ['shoulder_overhead'],
    videoUrl: null,
  },
  {
    id: 'M05',
    name: '스레드 더 니들',
    level: 2,
    focus_tags: ['thoracic_mobility', 'shoulder_mobility'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M06',
    name: '문틀 가슴 스트레치',
    level: 1,
    focus_tags: ['shoulder_mobility', 'upper_trap_release'],
    avoid_tags: ['shoulder_anterior_pain'],
    videoUrl: null,
  },
  {
    id: 'M07',
    name: '벽천사 / 월슬라이드',
    level: 2,
    focus_tags: ['shoulder_mobility', 'core_control'],
    avoid_tags: ['shoulder_overhead'],
    videoUrl: null,
  },
  {
    id: 'M08',
    name: '누워서하는 T레이즈', // 교체 완료
    level: 2,
    focus_tags: ['upper_back_activation', 'thoracic_mobility'],
    avoid_tags: ['shoulder_anterior_pain'],
    videoUrl: null,
  },
  {
    id: 'M09',
    name: '푸쉬업 플러스',
    level: 2,
    focus_tags: ['shoulder_stability', 'core_control'],
    avoid_tags: ['wrist_load'],
    videoUrl: null,
  },
  {
    id: 'M25',
    name: '프론 Y 레이즈',
    level: 2,
    focus_tags: ['shoulder_stability', 'thoracic_mobility'],
    avoid_tags: ['shoulder_overhead'],
    videoUrl: null,
  },
  {
    id: 'M27',
    name: '오픈북',
    level: 1,
    focus_tags: ['thoracic_mobility', 'shoulder_mobility'],
    avoid_tags: [],
    videoUrl: null,
  },

  // --- Phase: 하체 가동성 및 코어 ---
  {
    id: 'M10',
    name: '고관절 굴곡근 스트레치',
    level: 1,
    focus_tags: ['hip_flexor_stretch'],
    avoid_tags: ['knee_ground_pain'],
    videoUrl: null,
  },
  {
    id: 'M11',
    name: '사각자세 록백',
    level: 1,
    focus_tags: ['hip_mobility', 'core_control'],
    avoid_tags: ['knee_ground_pain', 'wrist_load'],
    videoUrl: null,
  },
  {
    id: 'M12',
    name: '글루트 브릿지',
    level: 1,
    focus_tags: ['glute_activation', 'lower_chain_stability'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M13',
    name: '데드버그',
    level: 2,
    focus_tags: ['core_stability', 'global_core'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M14',
    name: '버드독',
    level: 2,
    focus_tags: ['core_stability', 'global_core'],
    avoid_tags: ['knee_ground_pain', 'wrist_load'],
    videoUrl: null,
  },
  {
    id: 'M21',
    name: '버드독 슬로우 컨트롤', // 교체 완료
    level: 3,
    focus_tags: ['global_core', 'core_stability'],
    avoid_tags: ['knee_ground_pain', 'wrist_load'],
    videoUrl: null,
  },
  {
    id: 'M26',
    name: '플랭크',
    level: 3,
    focus_tags: ['global_core', 'core_stability'],
    avoid_tags: ['shoulder_anterior_pain', 'wrist_load'],
    videoUrl: null,
  },

  // --- Phase: 하체 통합 및 밸런스 ---
  {
    id: 'M15',
    name: '의자 박스 스쿼트',
    level: 2,
    focus_tags: ['lower_chain_stability', 'glute_activation'],
    avoid_tags: ['knee_load', 'deep_squat'],
    videoUrl: null,
  },
  {
    id: 'M16',
    name: '스텝다운',
    level: 3,
    focus_tags: ['lower_chain_stability', 'ankle_mobility'],
    avoid_tags: ['knee_load'],
    videoUrl: null,
  },
  {
    id: 'M17',
    name: '사이드 스텝',
    level: 2,
    focus_tags: ['glute_medius', 'glute_activation'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M18',
    name: '숏풋 / 트라이포드 풋',
    level: 1,
    focus_tags: ['ankle_mobility', 'basic_balance'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M19',
    name: '리버스 런지',
    level: 3,
    focus_tags: ['lower_chain_stability'],
    avoid_tags: ['knee_load'],
    videoUrl: null,
  },
  {
    id: 'M20',
    name: '월 서포티드 힙힌지(벽 앞에서서 힙힌지)', // 교체 완료
    level: 2,
    focus_tags: ['hip_mobility', 'glute_activation'],
    avoid_tags: ['lower_back_pain'],
    videoUrl: null,
  },
  {
    id: 'M22',
    name: '사이드-라이잉 힙 어브덕션',
    level: 1,
    focus_tags: ['glute_medius', 'basic_balance'],
    avoid_tags: [],
    videoUrl: null,
  },
  {
    id: 'M23',
    name: '한발 밸런스 리치',
    level: 3,
    focus_tags: ['lower_chain_stability', 'global_core'],
    avoid_tags: ['knee_load', 'ankle_instability'],
    videoUrl: null,
  },
  {
    id: 'M24',
    name: '티비얼리스 레이즈',
    level: 1,
    focus_tags: ['ankle_mobility'],
    avoid_tags: [],
    videoUrl: null,
  },
] as const;

/**
 * Get template by id. Returns undefined if not found.
 */
export function getTemplateById(id: string): ExerciseTemplate | undefined {
  return EXERCISE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get fallback templates (M01, M28) for empty days.
 */
export function getFallbackTemplates(): readonly ExerciseTemplate[] {
  const m01 = EXERCISE_TEMPLATES.find((t) => t.id === 'M01');
  const m28 = EXERCISE_TEMPLATES.find((t) => t.id === 'M28');
  const fallbacks: ExerciseTemplate[] = [];
  if (m01) fallbacks.push(m01);
  if (m28) fallbacks.push(m28);
  return fallbacks;
}