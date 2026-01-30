import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  POSTURE_ANALYSIS_SYSTEM_PROMPT,
  PHOTO_ANALYSIS_USER_PROMPT,
} from '@/lib/prompts/postureAnalysisPrompt';

// 빌드 시 프리렌더링 방지
export const dynamic = 'force-dynamic';

// OpenAI 클라이언트 초기화 (요청 시점에)
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'placeholder-key') {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }
  
  return new OpenAI({ apiKey });
}

export interface PhotoAnalysisRequest {
  frontPhotoUrl?: string;
  sidePhotoUrl?: string;
  surveyData?: Record<string, any>;
}

export interface PhotoAnalysisResponse {
  success: boolean;
  analysis?: {
    qualityCheck: {
      canAnalyze: boolean;
      passedChecks: number;
      totalChecks: number;
      issues: string[];
    };
    analysis: {
      observations: Array<{
        area: string;
        finding: string;
        visualEvidence: string;
        functionalImpact: string;
      }>;
      summary: string;
    };
    recommendations: {
      exercises: string[];
      retakeSuggestions: string[];
    };
    disclaimer: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PhotoAnalysisResponse>> {
  try {
    const body: PhotoAnalysisRequest = await request.json();
    const { frontPhotoUrl, sidePhotoUrl, surveyData } = body;

    // 1. 입력 검증
    if (!frontPhotoUrl && !sidePhotoUrl) {
      return NextResponse.json(
        {
          success: false,
          error: '분석할 사진이 없습니다.',
        },
        { status: 400 }
      );
    }

    console.log('📸 Photo analysis started:', {
      hasFront: !!frontPhotoUrl,
      hasSide: !!sidePhotoUrl,
      hasSurvey: !!surveyData,
    });

    // 2. OpenAI 클라이언트 생성
    let openai: OpenAI;
    try {
      openai = getOpenAIClient();
    } catch (error) {
      console.error('❌ OpenAI client initialization failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의하세요.',
        },
        { status: 500 }
      );
    }

    // 3. 사진 타입 결정
    const photoType = frontPhotoUrl && sidePhotoUrl ? 'both' : frontPhotoUrl ? 'front' : 'side';

    // 4. 설문 데이터 문자열화
    const surveyDataString = surveyData ? JSON.stringify(surveyData, null, 2) : undefined;

    // 5. OpenAI Vision API 호출
    console.log('🤖 Calling OpenAI Vision API...');

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: POSTURE_ANALYSIS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: PHOTO_ANALYSIS_USER_PROMPT(photoType, surveyDataString),
          },
          ...(frontPhotoUrl
            ? [
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: frontPhotoUrl,
                    detail: 'high' as const,
                  },
                },
              ]
            : []),
          ...(sidePhotoUrl
            ? [
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: sidePhotoUrl,
                    detail: 'high' as const,
                  },
                },
              ]
            : []),
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // 또는 'gpt-4-vision-preview'
      messages,
      max_tokens: 2000,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('OpenAI로부터 응답을 받지 못했습니다.');
    }

    console.log('✅ OpenAI response received');

    // 6. JSON 파싱
    let analysis;
    try {
      analysis = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.error('Raw response:', rawResponse);
      throw new Error('AI 응답을 파싱하는데 실패했습니다.');
    }

    // 7. 응답 검증
    if (!analysis.qualityCheck || !analysis.analysis) {
      throw new Error('AI 응답 형식이 올바르지 않습니다.');
    }

    console.log('✅ Photo analysis completed:', {
      canAnalyze: analysis.qualityCheck.canAnalyze,
      observationsCount: analysis.analysis.observations?.length || 0,
    });

    // 8. 성공 응답
    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('❌ Photo analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '사진 분석 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
