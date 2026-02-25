import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { supabase } from '@/lib/supabase';
import { PhotoAnalysisReportPDF, PhotoAnalysisResult } from '@/lib/pdf-generator';
import { sendReportEmail } from '@/lib/email-sender';

// 빌드 시 프리렌더링 방지
export const dynamic = 'force-dynamic';

interface GeneratePhotoReportRequest {
  analysis: PhotoAnalysisResult;
  email: string;
  name?: string;
  userId?: string;
  photoUrls?: {
    front?: string;
    side?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePhotoReportRequest = await request.json();
    const { analysis, email, name = '고객님', userId, photoUrls } = body;

    // 1. 입력 검증
    if (!analysis || !email) {
      return NextResponse.json(
        { error: '분석 결과와 이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('📄 Photo report generation started:', { email, canAnalyze: analysis.qualityCheck.canAnalyze });

    // 2. PDF 생성
    console.log('📄 Generating PDF...');
    const pdfBuffer = await renderToBuffer(
      PhotoAnalysisReportPDF({
        analysis,
        userEmail: email,
        userName: name,
        photoUrls,
      })
    );
    console.log('✅ PDF generated:', pdfBuffer.length, 'bytes');

    // 3. Supabase에 저장 (선택적)
    let assessmentId: string | null = null;
    let pdfUrl: string | null = null;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co') {
      try {
        // 3-1. PDF를 Supabase Storage에 업로드
        const fileName = `reports/photo-analysis-${Date.now()}-${email.replace('@', '-at-')}.pdf`;
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

        // 3-2. assessments 테이블에 기록 저장
        const { data: assessmentData, error: assessmentError } = await supabase
          .from('assessments')
          .insert({
            user_id: userId || null,
            email: email,
            name: name,
            analysis_result: {
              type: 'photo_analysis',
              qualityCheck: analysis.qualityCheck,
              observations: analysis.analysis.observations,
              summary: analysis.analysis.summary,
              recommendations: analysis.recommendations,
            },
            pdf_url: pdfUrl,
            status: 'completed',
            front_photo_url: photoUrls?.front || null,
            side_photo_url: photoUrls?.side || null,
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

    // 4. 이메일 발송
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'placeholder-key') {
      try {
        console.log('📧 Sending email with photo analysis report...');
        
        // sendReportEmail 함수를 사진 분석용으로 수정해야 할 수도 있습니다
        // 일단 기본 이메일 발송 로직 사용
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        await resend.emails.send({
          from: 'PostureLab <onboarding@resend.dev>',
          to: [email],
          subject: `[PostureLab] ${name}님의 사진 기반 체형 관찰 결과`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #F97316;">안녕하세요, ${name}님!</h2>
              
              <p>사진 기반 체형 관찰 결과를 보내드립니다.</p>
              
              ${analysis.qualityCheck.canAnalyze ? `
                <div style="background-color: #D1FAE5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #10B981; margin-top: 0;">✅ 분석 완료</h3>
                  <p style="margin-bottom: 0;">관찰된 주요 내용이 PDF 리포트에 포함되어 있습니다.</p>
                </div>
              ` : `
                <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #F59E0B; margin-top: 0;">⚠️ 사진 개선 필요</h3>
                  <p>보다 정확한 분석을 위해 재촬영을 권장합니다.</p>
                  <p style="margin-bottom: 0;">재촬영 가이드가 PDF에 포함되어 있습니다.</p>
                </div>
              `}
              
              <p><strong>첨부된 PDF 리포트</strong>를 확인해주세요.</p>
              
              <div style="background-color: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #991B1B; font-size: 14px; margin: 0;">
                  ⚠️ <strong>중요 안내:</strong> 본 결과는 사진 기반 시각적 평가이며, 
                  의학적 분석이 아닙니다. 참고 자료로만 활용해주세요.
                </p>
              </div>
              
              <p style="color: #64748B; font-size: 14px;">
                더 자세한 가이드가 필요하시면 언제든 연락주세요!
              </p>
              
              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 30px 0;">
              
              <p style="color: #94A3B8; font-size: 12px;">
                PostureLab | 체형 관찰 및 교정운동 가이드 서비스<br>
                본 이메일은 참고용이며, 의료 분석을 대체할 수 없습니다.
              </p>
            </div>
          `,
          attachments: [
            {
              filename: `posturelab-photo-analysis-${Date.now()}.pdf`,
              content: pdfBuffer,
            },
          ],
        });
        
        console.log('✅ Email sent successfully');
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        // 이메일 실패해도 사용자에게는 성공 응답
      }
    } else {
      console.log('⚠️ Resend API not configured, skipping email');
    }

    // 5. 성공 응답
    return NextResponse.json({
      success: true,
      message: '사진 분석 리포트가 생성되었습니다.',
      data: {
        assessmentId,
        pdfUrl,
        canAnalyze: analysis.qualityCheck.canAnalyze,
        observationsCount: analysis.analysis.observations.length,
        emailSent: !!process.env.RESEND_API_KEY,
      },
    });

  } catch (error) {
    console.error('❌ Photo report generation error:', error);
    
    return NextResponse.json(
      {
        error: '리포트 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
