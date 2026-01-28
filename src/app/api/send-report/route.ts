// 리포트 완료 이메일 발송 API입니다.
// Resend를 사용하여 사용자에게 리포트 알림 이메일을 보냅니다.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 (서버용)
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, requestId, diagnoses } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Resend API 키 확인
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("RESEND_API_KEY가 설정되지 않았습니다.");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    // 사용자 이메일 조회
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (userError || !userData?.email) {
      console.error("사용자 이메일 조회 실패:", userError);
      return NextResponse.json({ error: "User email not found" }, { status: 404 });
    }

    const userEmail = userData.email;

    // 이메일 내용 구성
    const diagnosisList = diagnoses && diagnoses.length > 0
      ? diagnoses.join(", ")
      : "상세 내용은 리포트를 확인해주세요";

    // 리포트 확인 링크 (프로덕션 배포 후 실제 도메인으로 변경 필요)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const reportUrl = `${baseUrl}/my-report`;

    // Resend API로 이메일 발송
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Resend 무료 플랜에서는 발신 이메일 도메인 인증이 필요합니다.
        // 테스트 시에는 onboarding@resend.dev를 사용할 수 있습니다.
        from: "교정 솔루션 <onboarding@resend.dev>",
        to: [userEmail],
        subject: "[교정 솔루션] 맞춤 교정 리포트가 준비되었습니다!",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          <!-- 헤더 -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316, #fb923c); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 700;">
                맞춤 교정 리포트 완성!
              </h1>
            </td>
          </tr>
          
          <!-- 본문 -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #f1f5f9; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                안녕하세요!<br><br>
                전문가가 분석한 <strong>1:1 맞춤 교정 리포트</strong>가 준비되었습니다.
              </p>
              
              <!-- 진단 결과 박스 -->
              <div style="background-color: #334155; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px; text-transform: uppercase;">
                  진단 결과
                </p>
                <p style="color: #f97316; font-size: 18px; font-weight: 600; margin: 0;">
                  ${diagnosisList}
                </p>
              </div>
              
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                리포트에는 다음 내용이 포함되어 있습니다:
              </p>
              
              <ul style="color: #cbd5e1; font-size: 14px; line-height: 1.8; margin: 0 0 20px; padding-left: 20px;">
                <li>체형 분석 결과 및 진단</li>
                <li>4단계 교정 운동 루틴 (억제-신장-활성화-통합)</li>
                <li>전문가 맞춤 조언</li>
              </ul>
              
              <!-- CTA 버튼 -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${reportUrl}" style="display: inline-block; background-color: #f97316; color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  내 리포트 확인하기
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 20px 0 0; text-align: center;">
                로그인 후 '내 리포트' 페이지에서 확인하실 수 있습니다.
              </p>
            </td>
          </tr>
          
          <!-- 푸터 -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px; text-align: center; border-top: 1px solid #334155;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                © 2024 교정 솔루션. All rights reserved.<br>
                이 이메일은 교정 솔루션 서비스 이용자에게 발송됩니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend 이메일 발송 실패:", resendData);
      return NextResponse.json(
        { error: resendData.message || "이메일 발송 실패" },
        { status: 500 }
      );
    }

    console.log("이메일 발송 성공:", resendData);

    return NextResponse.json({
      ok: true,
      messageId: resendData.id,
    });
  } catch (err) {
    console.error("이메일 발송 에러:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
