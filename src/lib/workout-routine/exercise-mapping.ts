/**
 * 운동 타입 매핑
 * MBTI 운동 검사 결과를 기반으로 운동을 매핑하는 규칙 정의
 */

import type { MainTypeCode, SubTypeKey } from '@/types/movement-test';

/**
 * 운동 카테고리 타입
 */
export type ExerciseCategory = 'inhibit' | 'lengthen' | 'activate' | 'integrate';

/**
 * 운동 정보 인터페이스
 */
export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  duration: number; // 분 단위
  sets?: number;
  reps?: number;
  holdTime?: number; // 초 단위 (스태틱 운동용)
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment?: string[]; // 필요한 장비
  videoUrl?: string; // 운동 영상 URL (선택)
}

/**
 * 메인 타입별 기본 운동 매핑
 */
const MAIN_TYPE_EXERCISES: Record<
  MainTypeCode,
  Record<ExerciseCategory, Exercise[]>
> = {
  D: {
    // 담직형: 과도한 긴장 완화 + 움직임 활성화
    inhibit: [
      {
        id: 'd-inhibit-1',
        name: '횡격막 호흡',
        description: '복식 호흡으로 횡격막 활성화',
        category: 'inhibit',
        duration: 5,
        holdTime: 5,
        difficulty: 'beginner',
      },
      {
        id: 'd-inhibit-2',
        name: '가슴근 이완',
        description: '가슴근 스트레칭 및 이완',
        category: 'inhibit',
        duration: 5,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    lengthen: [
      {
        id: 'd-lengthen-1',
        name: '가슴 스트레칭',
        description: '벽을 이용한 가슴근 스트레칭',
        category: 'lengthen',
        duration: 3,
        sets: 3,
        holdTime: 30,
        difficulty: 'beginner',
      },
      {
        id: 'd-lengthen-2',
        name: '엉덩이 스트레칭',
        description: '고관절 전면근 스트레칭',
        category: 'lengthen',
        duration: 3,
        sets: 3,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    activate: [
      {
        id: 'd-activate-1',
        name: '엉덩이 브릿지',
        description: '둔근 및 후면 사슬 활성화',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'beginner',
      },
      {
        id: 'd-activate-2',
        name: '코어 활성화',
        description: '플랭크 및 코어 강화',
        category: 'activate',
        duration: 5,
        sets: 3,
        holdTime: 30,
        difficulty: 'intermediate',
      },
    ],
    integrate: [
      {
        id: 'd-integrate-1',
        name: '캣-카우',
        description: '척추 가동성 향상',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 10,
        difficulty: 'beginner',
      },
      {
        id: 'd-integrate-2',
        name: '데드버그',
        description: '대각선 안정성 훈련',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 8,
        difficulty: 'intermediate',
      },
    ],
  },
  N: {
    // 날림형: 안정성 강화 + 제어력 향상
    inhibit: [
      {
        id: 'n-inhibit-1',
        name: '과도한 움직임 억제',
        description: '정적 자세 유지 훈련',
        category: 'inhibit',
        duration: 5,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    lengthen: [
      {
        id: 'n-lengthen-1',
        name: '햄스트링 스트레칭',
        description: '후면 사슬 유연성 향상',
        category: 'lengthen',
        duration: 3,
        sets: 3,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    activate: [
      {
        id: 'n-activate-1',
        name: '코어 안정화',
        description: '코어 근육 강화 및 안정화',
        category: 'activate',
        duration: 5,
        sets: 3,
        holdTime: 45,
        difficulty: 'intermediate',
      },
      {
        id: 'n-activate-2',
        name: '고관절 안정화',
        description: '고관절 근육 강화',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'intermediate',
      },
    ],
    integrate: [
      {
        id: 'n-integrate-1',
        name: '버드독',
        description: '대각선 안정성 및 제어력 향상',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 10,
        difficulty: 'intermediate',
      },
      {
        id: 'n-integrate-2',
        name: '스쿼트 제어',
        description: '점진적 스쿼트 동작 제어',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 8,
        difficulty: 'intermediate',
      },
    ],
  },
  B: {
    // 버팀형: 과도한 의존 완화 + 균형 강화
    inhibit: [
      {
        id: 'b-inhibit-1',
        name: '과도한 긴장 이완',
        description: '목, 어깨, 허리 긴장 완화',
        category: 'inhibit',
        duration: 5,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    lengthen: [
      {
        id: 'b-lengthen-1',
        name: '허리 스트레칭',
        description: '요추 유연성 향상',
        category: 'lengthen',
        duration: 3,
        sets: 3,
        holdTime: 30,
        difficulty: 'beginner',
      },
      {
        id: 'b-lengthen-2',
        name: '목 어깨 스트레칭',
        description: '상부 승모근 스트레칭',
        category: 'lengthen',
        duration: 3,
        sets: 3,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    activate: [
      {
        id: 'b-activate-1',
        name: '엉덩이 활성화',
        description: '둔근 및 고관절 근육 활성화',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'beginner',
      },
      {
        id: 'b-activate-2',
        name: '복근 활성화',
        description: '복횡근 및 코어 활성화',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'intermediate',
      },
    ],
    integrate: [
      {
        id: 'b-integrate-1',
        name: '힙 힌지',
        description: '고관절 중심 움직임 패턴',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 10,
        difficulty: 'intermediate',
      },
      {
        id: 'b-integrate-2',
        name: '스쿼트 패턴',
        description: '균형잡힌 스쿼트 동작',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 8,
        difficulty: 'intermediate',
      },
    ],
  },
  H: {
    // 흘림형: 연결성 강화 + 효율성 향상
    inhibit: [
      {
        id: 'h-inhibit-1',
        name: '과도한 움직임 제어',
        description: '불필요한 움직임 억제',
        category: 'inhibit',
        duration: 5,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    lengthen: [
      {
        id: 'h-lengthen-1',
        name: '전신 스트레칭',
        description: '전신 근육 유연성 향상',
        category: 'lengthen',
        duration: 5,
        sets: 3,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
    activate: [
      {
        id: 'h-activate-1',
        name: '전면 사슬 활성화',
        description: '전면 근육 사슬 강화',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'intermediate',
      },
      {
        id: 'h-activate-2',
        name: '후면 사슬 활성화',
        description: '후면 근육 사슬 강화',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'intermediate',
      },
    ],
    integrate: [
      {
        id: 'h-integrate-1',
        name: '체인 연결 훈련',
        description: '전신 연결성 향상',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 10,
        difficulty: 'intermediate',
      },
      {
        id: 'h-integrate-2',
        name: '동작 효율성 훈련',
        description: '움직임 효율성 향상',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 8,
        difficulty: 'advanced',
      },
    ],
  },
};

/**
 * 서브타입별 추가 운동 매핑
 * 서브타입에 따라 특정 카테고리의 운동을 추가하거나 교체
 */
const SUBTYPE_EXERCISE_OVERRIDES: Partial<
  Record<SubTypeKey, Partial<Record<ExerciseCategory, Exercise[]>>>
> = {
  // 담직형 서브타입
  D_UPPER_LOCK: {
    inhibit: [
      {
        id: 'd-upper-inhibit-1',
        name: '상체 긴장 이완',
        description: '상체 근육 긴장 완화',
        category: 'inhibit',
        duration: 5,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
  },
  D_LOWER_LOCK: {
    inhibit: [
      {
        id: 'd-lower-inhibit-1',
        name: '하체 긴장 이완',
        description: '하체 근육 긴장 완화',
        category: 'inhibit',
        duration: 5,
        holdTime: 30,
        difficulty: 'beginner',
      },
    ],
  },
  // 버팀형 서브타입
  B_LOWBACK_RELY: {
    activate: [
      {
        id: 'b-lowback-activate-1',
        name: '엉덩이 강화',
        description: '둔근 강화로 허리 부담 감소',
        category: 'activate',
        duration: 5,
        sets: 3,
        reps: 15,
        difficulty: 'beginner',
      },
    ],
  },
  B_NECK_SHOULDER_OVER: {
    inhibit: [
      {
        id: 'b-neck-inhibit-1',
        name: '목 어깨 이완',
        description: '상부 승모근 이완',
        category: 'inhibit',
        duration: 5,
        holdTime: 45,
        difficulty: 'beginner',
      },
    ],
  },
  // 날림형 서브타입
  N_CORE_DRIFT: {
    activate: [
      {
        id: 'n-core-activate-1',
        name: '코어 강화',
        description: '심부 코어 근육 강화',
        category: 'activate',
        duration: 5,
        sets: 3,
        holdTime: 60,
        difficulty: 'intermediate',
      },
    ],
  },
  // 흘림형 서브타입
  H_CHAIN_BREAK: {
    integrate: [
      {
        id: 'h-chain-integrate-1',
        name: '연결성 훈련',
        description: '근육 사슬 연결성 향상',
        category: 'integrate',
        duration: 5,
        sets: 3,
        reps: 12,
        difficulty: 'intermediate',
      },
    ],
  },
};

/**
 * 메인 타입과 서브타입을 기반으로 운동 목록 가져오기
 */
export function getExercisesForType(
  mainType: MainTypeCode,
  subType?: SubTypeKey
): Record<ExerciseCategory, Exercise[]> {
  const baseExercises = MAIN_TYPE_EXERCISES[mainType];
  const overrides = subType ? SUBTYPE_EXERCISE_OVERRIDES[subType] : undefined;

  if (!overrides) {
    return baseExercises;
  }

  // 오버라이드가 있는 카테고리만 교체
  const result: Record<ExerciseCategory, Exercise[]> = {
    inhibit: overrides.inhibit || baseExercises.inhibit,
    lengthen: overrides.lengthen || baseExercises.lengthen,
    activate: overrides.activate || baseExercises.activate,
    integrate: overrides.integrate || baseExercises.integrate,
  };

  return result;
}

/**
 * 불균형 강도에 따른 운동 조정
 */
export function adjustExercisesForImbalance(
  exercises: Exercise[],
  imbalanceSeverity: 'none' | 'mild' | 'strong'
): Exercise[] {
  if (imbalanceSeverity === 'none') {
    return exercises;
  }

  // 불균형이 있으면 난이도를 낮추고 지속 시간을 조정
  return exercises.map((exercise) => {
    const adjusted = { ...exercise };

    if (imbalanceSeverity === 'strong') {
      adjusted.difficulty = 'beginner';
      if (adjusted.sets) {
        adjusted.sets = Math.max(2, adjusted.sets - 1);
      }
      if (adjusted.reps) {
        adjusted.reps = Math.max(8, adjusted.reps - 2);
      }
      if (adjusted.holdTime) {
        adjusted.holdTime = Math.max(15, adjusted.holdTime - 10);
      }
    } else if (imbalanceSeverity === 'mild') {
      if (adjusted.difficulty === 'advanced') {
        adjusted.difficulty = 'intermediate';
      }
    }

    return adjusted;
  });
}
