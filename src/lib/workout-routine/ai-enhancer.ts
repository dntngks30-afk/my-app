/**
 * AI 기반 운동 루틴 보강
 * 
 * 규칙 기반 루틴을 AI로 개인화 보강
 */

import OpenAI from 'openai';
import type { WorkoutDay } from './generator';
import {
  WORKOUT_ROUTINE_SYSTEM_PROMPT,
  WORKOUT_ROUTINE_USER_PROMPT,
} from '@/lib/prompts/workout-routine-prompt';
import type { MainTypeCode, SubTypeKey } from '@/types/movement-test';

/**
 * OpenAI 클라이언트 초기화
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'placeholder-key') {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  return new OpenAI({ apiKey });
}

/**
 * 사용자 프로필 인터페이스
 */
export interface UserProfile {
  mainType: MainTypeCode;
  subType?: SubTypeKey;
  confidence?: number;
  imbalanceSeverity?: 'none' | 'mild' | 'strong';
  goals?: string[];
  painAreas?: string[];
  exerciseExperience?: 'beginner' | 'intermediate' | 'advanced';
  availableTime?: number;
}

/**
 * AI 보강된 루틴 인터페이스
 */
export interface EnhancedWorkoutDay extends WorkoutDay {
  personalizedTips?: string[];
}

/**
 * AI로 루틴 개인화 보강
 */
export async function enhanceRoutineWithAI(
  baseRoutine: WorkoutDay[],
  userProfile: UserProfile
): Promise<EnhancedWorkoutDay[]> {
  // OpenAI API 키가 없으면 기본 루틴 반환
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'placeholder-key') {
    console.warn('OpenAI API 키가 없어 기본 루틴을 반환합니다.');
    return baseRoutine.map((day) => ({ ...day }));
  }

  try {
    const openai = getOpenAIClient();

    // AI 프롬프트 구성
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: WORKOUT_ROUTINE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: WORKOUT_ROUTINE_USER_PROMPT(baseRoutine, userProfile),
      },
    ];

    // AI 호출
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // 비용 효율을 위해 mini 사용
      messages,
      max_tokens: 3000,
      temperature: 0.5, // 창의성과 일관성의 균형
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('OpenAI로부터 응답을 받지 못했습니다.');
    }

    // JSON 파싱
    let enhancedData;
    try {
      enhancedData = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Raw response:', rawResponse);
      throw new Error('AI 응답을 파싱하는데 실패했습니다.');
    }

    // 응답 검증
    if (!enhancedData.enhancedRoutine || !Array.isArray(enhancedData.enhancedRoutine)) {
      console.warn('AI 응답 형식이 올바르지 않습니다. 기본 루틴을 반환합니다.');
      return baseRoutine.map((day) => ({ ...day }));
    }

    // 보강된 루틴 반환
    return enhancedData.enhancedRoutine.map((day: any) => ({
      dayNumber: day.dayNumber,
      exercises: day.exercises || [],
      totalDuration: day.totalDuration || 0,
      focus: day.focus || [],
      notes: day.notes || '',
      personalizedTips: day.personalizedTips || [],
    }));
  } catch (error) {
    console.error('AI 루틴 보강 실패:', error);

    // 에러 발생 시 기본 루틴 반환 (fallback)
    if (error instanceof Error) {
      // API 키 오류는 조용히 기본 루틴 반환
      if (error.message.includes('API 키')) {
        return baseRoutine.map((day) => ({ ...day }));
      }
    }

    // 기타 에러는 기본 루틴 반환하되 경고 로그
    console.warn('AI 보강 실패로 기본 루틴을 반환합니다.');
    return baseRoutine.map((day) => ({ ...day }));
  }
}

/**
 * 루틴 검증
 * AI가 생성한 루틴이 안전하고 유효한지 검증
 */
export function validateEnhancedRoutine(
  routine: EnhancedWorkoutDay[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 기본 검증
  if (!routine || routine.length === 0) {
    errors.push('루틴이 비어있습니다.');
    return { valid: false, errors };
  }

  if (routine.length !== 7) {
    errors.push(`루틴 일수가 7일이 아닙니다. (현재: ${routine.length}일)`);
  }

  // 각 일자 검증
  routine.forEach((day, index) => {
    if (day.dayNumber !== index + 1) {
      errors.push(`Day ${index + 1}의 dayNumber가 올바르지 않습니다.`);
    }

    if (!day.exercises || day.exercises.length === 0) {
      errors.push(`Day ${day.dayNumber}에 운동이 없습니다.`);
    }

    if (day.totalDuration <= 0) {
      errors.push(`Day ${day.dayNumber}의 총 시간이 0 이하입니다.`);
    }

    // 각 운동 검증
    day.exercises.forEach((exercise, exIndex) => {
      if (!exercise.id || !exercise.name) {
        errors.push(`Day ${day.dayNumber}, Exercise ${exIndex + 1}에 필수 정보가 없습니다.`);
      }

      if (exercise.duration <= 0) {
        errors.push(`Day ${day.dayNumber}, Exercise ${exercise.name}의 duration이 0 이하입니다.`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
