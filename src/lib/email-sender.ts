import { Resend } from 'resend';
import type { AnalysisResult } from '@/types/survey';
import { POSTURE_TYPE_NAMES } from './survey-analyzer';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendReportEmailParams {
  to: string;
  analysis: AnalysisResult;
  pdfBuffer: Buffer;
  userName?: string;
}

export async function sendReportEmail({
  to,
  analysis,
  pdfBuffer,
  userName = '고객'
}: SendReportEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'PostureLab <noreply@posturelab.com>', // 실제 도메인으로 변경 필요
      to: [to],
      subject: `[PostureLab] ${userName}님의 자세 경향 체크 결과 (참고용)`,
      html: getEmailHTML(analysis, userName),
      attachments: [
        {
          filename: `posturelab-report-${Date.now()}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('❌ Resend email error:', error);
      throw new Error(`이메일 발송 실패: ${error.message}`);
    }

    console.log('✅ Email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
}

function getEmailHTML(analysis: AnalysisResult, userName: string): string {
  const getSeverityLabel = (severity: 'mild' | 'moderate' | 'severe') => {
    const labels = {
      mild: '참고 수준 (경미)',
      moderate: '참고 수준 (보통)',
      severe: '전문가 상담 권장'
    };
    return labels[severity];
  };

  const getSeverityColor = (severity: 'mild' | 'moderate' | 'severe') => {
    return severity === 'severe' ? '#DC2626' : severity === 'moderate' ? '#F59E0B' : '#10B981';
  };

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>자세 경향 체크 결과</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F1F5F9; color: #1E293B;">
  
  <!-- 메인 컨테이너 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F1F5F9; padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <!-- 카드 컨테이너 -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- 헤더 -->
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #FB923C 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #FFFFFF;">
                PostureLab
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #FFF7ED;">
                자세 경향 자가 체크 결과가 도착했습니다
              </p>
            </td>
          </tr>
          
          <!-- 인사말 -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #1E293B;">
                안녕하세요, ${userName}님! 👋
              </h2>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #475569;">
                자세 경향 자가 체크를 완료해주셔서 감사합니다.<br>
                설문 응답을 바탕으로 작성된 상세 리포트를 첨부파일로 보내드립니다.
              </p>
            </td>
          </tr>
          
          <!-- 요약 카드 -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="20" cellspacing="0" style="background-color: #FEF3C7; border-radius: 8px; border: 2px solid #FCD34D;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #92400E; font-weight: bold;">
                      📋 확인된 자세 경향 (참고용)
                    </p>
                    <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #1E293B;">
                      ${POSTURE_TYPE_NAMES[analysis.postureType]}
                    </h3>
                    <p style="margin: 0; font-size: 14px; color: #475569;">
                      경향 수준: <span style="color: ${getSeverityColor(analysis.overallSeverity)}; font-weight: bold;">${getSeverityLabel(analysis.overallSeverity)}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- 부위별 점수 -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #334155;">
                부위별 경향성 점수 (참고 정보)
              </p>
              
              <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #F8FAFC; border-radius: 6px; margin-bottom: 10px;">
                <tr>
                  <td style="font-size: 14px; color: #334155;">목/경추 부위</td>
                  <td align="right" style="font-size: 18px; font-weight: bold; color: #F97316;">
                    ${Math.round(analysis.scores.forwardHead)}점
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #F8FAFC; border-radius: 6px; margin-bottom: 10px;">
                <tr>
                  <td style="font-size: 14px; color: #334155;">어깨/흉추 부위</td>
                  <td align="right" style="font-size: 18px; font-weight: bold; color: #F97316;">
                    ${Math.round(analysis.scores.roundedShoulder)}점
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #F8FAFC; border-radius: 6px;">
                <tr>
                  <td style="font-size: 14px; color: #334155;">골반/허리 부위</td>
                  <td align="right" style="font-size: 18px; font-weight: bold; color: #F97316;">
                    ${Math.round(Math.max(analysis.scores.anteriorPelvicTilt, analysis.scores.posteriorPelvicTilt))}점
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- 주요 경향 -->
          ${analysis.primaryIssues.length > 0 ? `
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #334155;">
                확인된 주요 경향 (참고 정보)
              </p>
              ${analysis.primaryIssues.map(issue => `
                <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #FEF2F2; border-left: 4px solid ${getSeverityColor(issue.severity)}; border-radius: 6px; margin-bottom: 10px;">
                  <tr>
                    <td>
                      <p style="margin: 0 0 5px 0; font-size: 13px; font-weight: bold; color: #1E293B;">
                        [${issue.area}]
                      </p>
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${getSeverityColor(issue.severity)};">
                        ${getSeverityLabel(issue.severity)}
                      </p>
                      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                        ${issue.description}
                      </p>
                    </td>
                  </tr>
                </table>
              `).join('')}
            </td>
          </tr>
          ` : ''}
          
          <!-- CTA 버튼 -->
          <tr>
            <td style="padding: 0 30px 30px 30px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #F97316 0%, #FB923C 100%); border-radius: 8px; padding: 15px 40px;">
                    <a href="https://posturelab.com/pricing" style="color: #FFFFFF; text-decoration: none; font-size: 16px; font-weight: bold; display: block;">
                      더 정확한 평가 알아보기 →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #64748B;">
                (사진 기반 전문가 피드백 서비스, 단 이것도 의학적 진단은 아닙니다)
              </p>
            </td>
          </tr>
          
          <!-- 중요 안내 -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="20" cellspacing="0" style="background-color: #FEE2E2; border-radius: 8px; border: 2px solid #FCA5A5;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #991B1B;">
                      ⚠️ 필독: 본 결과의 한계
                    </p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.6; color: #991B1B;">
                      <li>본 결과는 자가 체크 기반이며, AI나 전문가가 직접 판단한 것이 아닙니다.</li>
                      <li>의학적 진단이 아니므로 참고 정보로만 활용하세요.</li>
                      <li>실제 상태와 다를 수 있습니다.</li>
                      <li>통증, 질병, 부상이 있는 경우 반드시 의료기관을 방문하세요.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- 푸터 -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748B;">
                <strong style="color: #F97316;">PostureLab</strong><br>
                자세 경향 자가 체크 서비스
              </p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #94A3B8;">
                웹사이트: <a href="https://posturelab.com" style="color: #F97316; text-decoration: none;">posturelab.com</a><br>
                이메일: support@posturelab.com
              </p>
              <p style="margin: 0; font-size: 11px; color: #CBD5E1;">
                본 메일은 운동 가이드 참고 목적이며, 의료 진단이 아닙니다.<br>
                © 2026 PostureLab. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
}

// 테스트용 이메일 발송 (개발 환경)
export async function sendTestEmail(to: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'PostureLab <noreply@posturelab.com>',
      to: [to],
      subject: '[PostureLab] 테스트 이메일',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #F97316;">PostureLab 이메일 테스트</h1>
          <p>Resend API가 정상적으로 작동하고 있습니다.</p>
          <p>생성 시간: ${new Date().toLocaleString('ko-KR')}</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`테스트 이메일 발송 실패: ${error.message}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('❌ Test email failed:', error);
    throw error;
  }
}
