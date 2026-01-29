import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { supabase } from '@/lib/supabase';
import { analyzeSurveyResults } from '@/lib/survey-analyzer';
import { SurveyReportPDF } from '@/lib/pdf-generator';
import { sendReportEmail } from '@/lib/email-sender';

// 빌드 시 프리렌더링 방지
export const dynamic = 'force-dynamic';

interface SubmitSurveyRequest {
  responses: Record<string, string | string[]>;
  email: string;
  name?: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitSurveyRequest = await request.json();
    const { responses, email, name = '고객', userId } = body;

    // 1. 입력 검증
    if (!responses || Object.keys(responses).length === 0) {
      return NextResponse.json(
        { error: '설문 응답이 없습니다.' },
        { status: 400 }
      );
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: '유효한 이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('📋 Survey submission started:', { email, responseCount: Object.keys(responses).length });

    // 2. 설문 분석
    const analysis = analyzeSurveyResults(responses);
    console.log('✅ Analysis completed:', {
      postureType: analysis.postureType,
      severity: analysis.overallSeverity,
    });

    // 3. PDF 생성
    console.log('📄 Generating PDF...');
    const pdfBuffer = await renderToBuffer(
      SurveyReportPDF({ analysis, userEmail: email })
    );
    console.log('✅ PDF generated:', pdfBuffer.length, 'bytes');

    // 4. Supabase에 저장 (선택적 - 환경 변수 있을 때만)
    let assessmentId: string | null = null;
    let pdfUrl: string | null = null;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co') {
      try {
        // 4-1. PDF를 Supabase Storage에 업로드
        const fileName = `reports/${Date.now()}-${email.replace('@', '-at-')}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('assessments')
          .upload(fileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.error('❌ PDF upload error:', uploadError);
        } else {
          // 공개 URL 생성
          const { data: urlData } = supabase.storage
            .from('assessments')
            .getPublicUrl(fileName);
          pdfUrl = urlData.publicUrl;
          console.log('✅ PDF uploaded to Supabase:', pdfUrl);
        }

        // 4-2. assessments 테이블에 기록 저장
        const { data: assessmentData, error: assessmentError } = await supabase
          .from('assessments')
          .insert({
            user_id: userId || null,
            email: email,
            name: name,
            survey_responses: responses,
            analysis_result: {
              postureType: analysis.postureType,
              overallSeverity: analysis.overallSeverity,
              scores: analysis.scores,
              primaryIssues: analysis.primaryIssues,
              recommendations: analysis.recommendations,
            },
            pdf_url: pdfUrl,
            status: 'completed',
          })
          .select('id')
          .single();

        if (assessmentError) {
          console.error('❌ Assessment save error:', assessmentError);
        } else {
          assessmentId = assessmentData.id;
          console.log('✅ Assessment saved:', assessmentId);
        }
      } catch (supabaseError) {
        console.error('❌ Supabase operation failed:', supabaseError);
        // Supabase 에러가 있어도 이메일 발송은 계속 진행
      }
    } else {
      console.log('⚠️ Supabase not configured, skipping database save');
    }

    // 5. 이메일 발송
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'placeholder-key') {
      try {
        console.log('📧 Sending email...');
        await sendReportEmail({
          to: email,
          analysis,
          pdfBuffer,
          userName: name,
        });
        console.log('✅ Email sent successfully');
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        // 이메일 실패해도 사용자에게는 성공 응답 (PDF는 다운로드 가능)
      }
    } else {
      console.log('⚠️ Resend API not configured, skipping email');
    }

    // 6. 성공 응답
    return NextResponse.json({
      success: true,
      message: '설문이 성공적으로 제출되었습니다.',
      data: {
        assessmentId,
        analysis: {
          postureType: analysis.postureType,
          overallSeverity: analysis.overallSeverity,
          scores: analysis.scores,
          primaryIssues: analysis.primaryIssues.length,
        },
        pdfUrl,
        emailSent: !!process.env.RESEND_API_KEY,
      },
    });

  } catch (error) {
    console.error('❌ Survey submission error:', error);
    
    return NextResponse.json(
      {
        error: '설문 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

// PDF 다운로드 엔드포인트 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('id');

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'Assessment ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Supabase에서 assessment 조회
    const { data, error } = await supabase
      .from('assessments')
      .select('pdf_url, email, name')
      .eq('id', assessmentId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Assessment를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!data.pdf_url) {
      return NextResponse.json(
        { error: 'PDF 파일이 없습니다.' },
        { status: 404 }
      );
    }

    // PDF URL로 리다이렉트
    return NextResponse.redirect(data.pdf_url);

  } catch (error) {
    console.error('❌ PDF download error:', error);
    return NextResponse.json(
      { error: 'PDF 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
