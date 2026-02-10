/**
 * 규칙 기반 운동 루틴 생성기
 * 
 * 운동 검사 결과를 기반으로 7일간의 개인맞춤 운동 루틴을 생성합니다.
 */

import type { MainTypeCode, SubTypeKey } from '@/types/movement-test';
import {
  getExercisesForType,
  adjustExercisesForImbalance,
  type Exercise,
  type ExerciseCategory,
} from './exercise-mapping';

/**
 * 일일 운동 루틴 인터페이스
 */
export interface WorkoutDay {
  dayNumber: number; // 1-7
  exercises: Exercise[];
  totalDuration: number; // 분 단위
  focus: ExerciseCategory[]; // 해당 일의 집중 카테고리
  notes?: string; // 추가 안내사항
}

/**
 * 운동 루틴 생성 옵션
 */
export interface RoutineGenerationOptions {
  mainType: MainTypeCode;
  subType?: SubTypeKey;
  imbalanceSeverity?: 'none' | 'mild' | 'strong';
  confidence?: number; // 0-100, 낮을수록 기본 운동 위주
  userGoals?: string[]; // 사용자 목표 (선택)
  availableTime?: number; // 일일 사용 가능 시간 (분, 기본 10분)
}

/**
 * 7일간의 운동 루틴 생성
 */
export function generateWorkoutRoutine(
  options: RoutineGenerationOptions
): WorkoutDay[] {
  const {
    mainType,
    subType,
    imbalanceSeverity = 'none',
    confidence = 50,
    availableTime = 10,
  } = options;

  // 타입별 운동 가져오기
  const exercisesByCategory = getExercisesForType(mainType, subType);

  // 불균형 강도에 따라 운동 조정
  const adjustedExercises: Record<ExerciseCategory, Exercise[]> = {
    inhibit: adjustExercisesForImbalance(
      exercisesByCategory.inhibit,
      imbalanceSeverity
    ),
    lengthen: adjustExercisesForImbalance(
      exercisesByCategory.lengthen,
      imbalanceSeverity
    ),
    activate: adjustExercisesForImbalance(
      exercisesByCategory.activate,
      imbalanceSeverity
    ),
    integrate: adjustExercisesForImbalance(
      exercisesByCategory.integrate,
      imbalanceSeverity
    ),
  };

  // 7일간의 루틴 생성
  const routine: WorkoutDay[] = [];

  // 각 일자별 카테고리 집중도 정의
  // 7일 동안 4단계를 순환하면서 점진적으로 강도 증가
  const dayFocusMap: Array<{
    primary: ExerciseCategory;
    secondary: ExerciseCategory;
    optional?: ExerciseCategory;
  }> = [
    // Day 1: 억제 + 연장 (기초 설정)
    { primary: 'inhibit', secondary: 'lengthen' },
    // Day 2: 연장 + 활성화 (유연성 → 강화)
    { primary: 'lengthen', secondary: 'activate' },
    // Day 3: 활성화 중심 (강화)
    { primary: 'activate', secondary: 'integrate' },
    // Day 4: 통합 중심 (패턴)
    { primary: 'integrate', secondary: 'activate' },
    // Day 5: 억제 + 활성화 (재균형)
    { primary: 'inhibit', secondary: 'activate' },
    // Day 6: 연장 + 통합 (유연성 + 패턴)
    { primary: 'lengthen', secondary: 'integrate' },
    // Day 7: 전체 통합 (종합)
    { primary: 'integrate', secondary: 'activate', optional: 'lengthen' },
  ];

  for (let day = 1; day <= 7; day++) {
    const focus = dayFocusMap[day - 1];
    const dayExercises: Exercise[] = [];

    // Primary 카테고리 운동 선택 (2-3개)
    const primaryExercises = selectExercisesForDay(
      adjustedExercises[focus.primary],
      day,
      confidence,
      2
    );
    dayExercises.push(...primaryExercises);

    // Secondary 카테고리 운동 선택 (1-2개)
    const secondaryExercises = selectExercisesForDay(
      adjustedExercises[focus.secondary],
      day,
      confidence,
      1
    );
    dayExercises.push(...secondaryExercises);

    // Optional 카테고리 운동 선택 (있는 경우, 1개)
    if (focus.optional) {
      const optionalExercises = selectExercisesForDay(
        adjustedExercises[focus.optional],
        day,
        confidence,
        1
      );
      dayExercises.push(...optionalExercises);
    }

    // 총 시간 계산
    const totalDuration = dayExercises.reduce(
      (sum, ex) => sum + ex.duration,
      0
    );

    // 시간 제한에 맞게 조정
    const adjustedExercises = adjustExercisesToTimeLimit(
      dayExercises,
      availableTime
    );

    routine.push({
      dayNumber: day,
      exercises: adjustedExercises.exercises,
      totalDuration: adjustedExercises.totalDuration,
      focus: [focus.primary, focus.secondary],
      notes: getDayNotes(day, mainType, imbalanceSeverity),
    });
  }

  return routine;
}

/**
 * 일자별 운동 선택 (난이도와 일자에 따라 변동)
 */
function selectExercisesForDay(
  availableExercises: Exercise[],
  day: number,
  confidence: number,
  count: number
): Exercise[] {
  if (availableExercises.length === 0) {
    return [];
  }

  // 난이도 필터링
  // confidence가 낮으면 beginner 위주, 높으면 intermediate/advanced 포함
  const difficultyFilter =
    confidence < 40
      ? (ex: Exercise) => ex.difficulty === 'beginner'
      : confidence < 70
        ? (ex: Exercise) =>
            ex.difficulty === 'beginner' || ex.difficulty === 'intermediate'
        : () => true;

  const filtered = availableExercises.filter(difficultyFilter);

  if (filtered.length === 0) {
    return availableExercises.slice(0, count);
  }

  // 일자에 따라 순환 선택 (같은 운동이 매일 반복되지 않도록)
  const startIndex = (day - 1) % filtered.length;
  const selected: Exercise[] = [];

  for (let i = 0; i < count && i < filtered.length; i++) {
    const index = (startIndex + i) % filtered.length;
    selected.push(filtered[index]);
  }

  return selected;
}

/**
 * 시간 제한에 맞게 운동 조정
 */
function adjustExercisesToTimeLimit(
  exercises: Exercise[],
  timeLimit: number
): { exercises: Exercise[]; totalDuration: number } {
  let totalDuration = exercises.reduce((sum, ex) => sum + ex.duration, 0);

  if (totalDuration <= timeLimit) {
    return { exercises, totalDuration };
  }

  // 시간 초과 시 우선순위가 높은 운동부터 선택
  // 또는 각 운동의 duration을 줄임
  const adjusted: Exercise[] = [];
  let remainingTime = timeLimit;

  // 우선순위: integrate > activate > lengthen > inhibit
  const priorityOrder: ExerciseCategory[] = [
    'integrate',
    'activate',
    'lengthen',
    'inhibit',
  ];

  const sortedExercises = [...exercises].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.category);
    const bPriority = priorityOrder.indexOf(b.category);
    return aPriority - bPriority;
  });

  for (const exercise of sortedExercises) {
    if (exercise.duration <= remainingTime) {
      adjusted.push(exercise);
      remainingTime -= exercise.duration;
    } else if (remainingTime >= 3) {
      // 최소 3분은 할당 가능하면 축소 버전 추가
      adjusted.push({
        ...exercise,
        duration: remainingTime,
        sets: exercise.sets ? Math.max(1, exercise.sets - 1) : undefined,
        reps: exercise.reps ? Math.max(5, exercise.reps - 2) : undefined,
      });
      remainingTime = 0;
    }
  }

  const finalDuration = adjusted.reduce((sum, ex) => sum + ex.duration, 0);

  return {
    exercises: adjusted.length > 0 ? adjusted : exercises.slice(0, 1), // 최소 1개는 유지
    totalDuration: finalDuration,
  };
}

/**
 * 일자별 안내사항 생성
 */
function getDayNotes(
  day: number,
  mainType: MainTypeCode,
  imbalanceSeverity: 'none' | 'mild' | 'strong'
): string {
  const notes: string[] = [];

  if (day === 1) {
    notes.push('첫 날은 천천히 시작하세요. 동작을 정확히 익히는 것이 중요합니다.');
  }

  if (day === 4 || day === 7) {
    notes.push('통합 운동에 집중하세요. 이전에 배운 동작들을 연결해보세요.');
  }

  if (imbalanceSeverity === 'strong') {
    notes.push('불편함이 느껴지면 즉시 중단하고 휴식을 취하세요.');
  }

  if (mainType === 'D') {
    notes.push('담직형: 긴장을 풀고 천천히 움직이세요.');
  } else if (mainType === 'N') {
    notes.push('날림형: 동작을 제어하며 안정적으로 수행하세요.');
  } else if (mainType === 'B') {
    notes.push('버팀형: 과도한 의존을 줄이고 균형을 찾으세요.');
  } else if (mainType === 'H') {
    notes.push('흘림형: 연결성을 느끼며 효율적으로 움직이세요.');
  }

  return notes.join(' ');
}

/**
 * 루틴 요약 정보 생성
 */
export interface RoutineSummary {
  totalDays: number;
  averageDuration: number;
  focusCategories: ExerciseCategory[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTotalTime: number; // 분 단위
}

export function generateRoutineSummary(
  routine: WorkoutDay[]
): RoutineSummary {
  const totalDuration = routine.reduce(
    (sum, day) => sum + day.totalDuration,
    0
  );
  const averageDuration = Math.round(totalDuration / routine.length);

  const allCategories = new Set<ExerciseCategory>();
  routine.forEach((day) => {
    day.focus.forEach((cat) => allCategories.add(cat));
  });

  // 전체 운동의 평균 난이도 계산
  const allExercises = routine.flatMap((day) => day.exercises);
  const difficultyCounts = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  };
  allExercises.forEach((ex) => {
    difficultyCounts[ex.difficulty]++;
  });

  let overallDifficulty: 'beginner' | 'intermediate' | 'advanced' =
    'beginner';
  if (difficultyCounts.advanced > 0 || difficultyCounts.intermediate > allExercises.length / 2) {
    overallDifficulty = 'intermediate';
  }
  if (difficultyCounts.advanced > allExercises.length / 3) {
    overallDifficulty = 'advanced';
  }

  return {
    totalDays: routine.length,
    averageDuration,
    focusCategories: Array.from(allCategories),
    difficulty: overallDifficulty,
    estimatedTotalTime: totalDuration,
  };
}
