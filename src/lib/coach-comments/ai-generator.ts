/**
 * AI 기반 코치 코멘트 생성 로직
 * 
 * 재검사 결과 비교 데이터를 바탕으로 OpenAI를 사용하여
 * 개인화된 코치 코멘트를 생성합니다.
 */

import OpenAI from 'openai';
import {
  COACH_COMMENT_SYSTEM_PROMPT,
  COACH_COMMENT_USER_PROMPT,
} from '@/lib/prompts/coach-comment-prompt';
import type { TestResultData, ComparisonResult } from '@/lib/movement-test/result-comparison';

/**
 * 코치 코멘트 응답 인터페이스
 */
export interface CoachCommentResponse {
  greeting: string; // 인사 및 격려
  summary: string; // 주요 변화 요약
  improvements: string[]; // 개선 포인트 상세
  focusAreas: string[]; // 주의 영역 및 개선 방안
  nextSteps: string[]; // 다음 단계 조언
  encouragement: string; // 마무리 격려 문구
}

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
 * AI 코치 코멘트 생성
 * 
 * @param originalResult 원본 검사 결과
 * @param retestResult 재검사 결과
 * @param comparison 비교 분석 결과
 * @returns 코치 코멘트 응답
 */
export async function generateCoachComment(
  originalResult: TestResultData,
  retestResult: TestResultData,
  comparison: ComparisonResult
): Promise<CoachCommentResponse> {
  // OpenAI API 키가 없으면 기본 코멘트 반환
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'placeholder-key') {
    console.warn('⚠️ OpenAI API 키가 없어 기본 코치 코멘트를 반환합니다.');
    return generateDefaultCoachComment(comparison);
  }

  try {
    const openai = getOpenAIClient();

    // 프롬프트 구성
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: COACH_COMMENT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: COACH_COMMENT_USER_PROMPT(originalResult, retestResult, comparison),
      },
    ];

    console.log('🤖 AI 코치 코멘트 생성 중...');

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // 비용 효율을 위해 mini 사용
      messages,
      max_tokens: 2000,
      temperature: 0.7, // 창의성과 일관성의 균형
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('OpenAI로부터 응답을 받지 못했습니다.');
    }

    console.log('✅ AI 코치 코멘트 생성 완료');

    // JSON 파싱
    let comment: CoachCommentResponse;
    try {
      comment = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.error('Raw response:', rawResponse);
      throw new Error('AI 응답을 파싱하는데 실패했습니다.');
    }

    // 응답 검증
    if (
      !comment.greeting ||
      !comment.summary ||
      !Array.isArray(comment.improvements) ||
      !Array.isArray(comment.focusAreas) ||
      !Array.isArray(comment.nextSteps) ||
      !comment.encouragement
    ) {
      console.error('❌ AI 응답 형식이 올바르지 않습니다:', comment);
      throw new Error('AI 응답 형식이 올바르지 않습니다.');
    }

    return comment;
  } catch (error) {
    console.error('❌ AI 코치 코멘트 생성 실패:', error);
    
    // 에러 발생 시 기본 코멘트 반환
    console.warn('⚠️ 기본 코치 코멘트를 반환합니다.');
    return generateDefaultCoachComment(comparison);
  }
}

/**
 * 기본 코치 코멘트 생성 (AI 실패 시 fallback)
 */
function generateDefaultCoachComment(comparison: ComparisonResult): CoachCommentResponse {
  const greeting = '재검사를 완료해주셔서 감사합니다!';
  
  let summary = '';
  if (comparison.overallTrend === 'improved') {
    summary = '전반적으로 개선된 모습을 보이고 있습니다.';
  } else if (comparison.overallTrend === 'worsened') {
    summary = '일부 영역에서 주의가 필요합니다.';
  } else {
    summary = '전반적으로 안정적인 상태를 유지하고 있습니다.';
  }

  const improvements = comparison.improvementPoints.length > 0
    ? comparison.improvementPoints
    : ['현재 운동 루틴을 지속적으로 수행하고 있습니다.'];

  const focusAreas = comparison.areasToFocus.length > 0
    ? comparison.areasToFocus
    : ['정기적인 재검사로 변화를 추적하세요.'];

  const nextSteps = [
    '현재 운동 루틴을 계속 수행하세요.',
    '정기적인 재검사로 변화를 추적하세요.',
    '코치와 상담하여 추가 개선 방안을 논의하세요.',
  ];

  const encouragement = '지속적인 노력으로 더 건강한 몸을 만들어가세요!';

  return {
    greeting,
    summary,
    improvements,
    focusAreas,
    nextSteps,
    encouragement,
  };
}
