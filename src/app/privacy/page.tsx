// 개인정보처리방침 페이지입니다.
// 개인정보 수집, 이용, 보관, 제3자 제공에 관한 정책을 안내합니다.

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] px-4 py-12 text-slate-100">
      <article className="mx-auto max-w-3xl space-y-8">
        {/* 헤더 */}
        <header className="space-y-4">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold">개인정보처리방침</h1>
          <p className="text-sm text-slate-400">
            최종 수정일: 2024년 1월 1일
          </p>
        </header>

        {/* 본문 */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          {/* 개요 */}
          <section className="space-y-3">
            <p>
              교정 솔루션(이하 &quot;회사&quot;)은 이용자의 개인정보를 중요시하며, 
              「개인정보 보호법」 등 관련 법령을 준수합니다. 
              본 개인정보처리방침을 통해 이용자의 개인정보가 어떤 용도와 방식으로 
              이용되고 있으며, 어떠한 조치가 취해지고 있는지 알려드립니다.
            </p>
          </section>

          {/* 제1조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제1조 (수집하는 개인정보 항목)</h2>
            <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다:</p>
            
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-2 font-medium text-slate-100">필수 항목</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>이메일 주소 (회원가입, 서비스 이용, 알림 발송)</li>
                <li>비밀번호 (암호화 저장)</li>
              </ul>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-2 font-medium text-slate-100">선택 항목</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>체형 사진 (정면, 측면 - 체형 분석 목적)</li>
                <li>결제 정보 (카드사에서 처리, 회사는 결제 결과만 저장)</li>
              </ul>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-2 font-medium text-slate-100">자동 수집 항목</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>IP 주소, 접속 로그, 쿠키, 브라우저 종류</li>
                <li>서비스 이용 기록</li>
              </ul>
            </div>
          </section>

          {/* 제2조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제2조 (개인정보의 수집 및 이용 목적)</h2>
            <p>회사는 수집한 개인정보를 다음의 목적으로 이용합니다:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>서비스 제공</strong>: 체형 분석, 맞춤 교정운동 리포트 생성 및 제공
              </li>
              <li>
                <strong>회원 관리</strong>: 회원 식별, 본인 확인, 서비스 이용 기록 관리
              </li>
              <li>
                <strong>결제 처리</strong>: 유료 서비스 결제 및 환불 처리
              </li>
              <li>
                <strong>고객 응대</strong>: 문의 접수 및 답변, 불만 처리
              </li>
              <li>
                <strong>서비스 개선</strong>: 서비스 이용 통계 분석, 품질 향상
              </li>
              <li>
                <strong>알림 발송</strong>: 리포트 완료 알림, 서비스 관련 공지사항 전달
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제3조 (개인정보의 보유 및 이용 기간)</h2>
            <p>
              회사는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 
              해당 정보를 지체 없이 파기합니다. 단, 관련 법령에 의해 보존할 필요가 있는 경우, 
              아래와 같이 관련 법령에서 정한 기간 동안 보관합니다:
            </p>
            
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <ul className="space-y-3">
                <li>
                  <strong className="text-slate-100">계약 또는 청약철회 등에 관한 기록</strong>
                  <br />
                  <span className="text-slate-400">보존 기간: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</span>
                </li>
                <li>
                  <strong className="text-slate-100">대금결제 및 재화 등의 공급에 관한 기록</strong>
                  <br />
                  <span className="text-slate-400">보존 기간: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</span>
                </li>
                <li>
                  <strong className="text-slate-100">소비자의 불만 또는 분쟁처리에 관한 기록</strong>
                  <br />
                  <span className="text-slate-400">보존 기간: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</span>
                </li>
                <li>
                  <strong className="text-slate-100">접속에 관한 기록</strong>
                  <br />
                  <span className="text-slate-400">보존 기간: 3개월 (통신비밀보호법)</span>
                </li>
              </ul>
            </div>
          </section>

          {/* 제4조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제4조 (개인정보의 제3자 제공)</h2>
            <p>
              회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 
              다만, 다음의 경우에는 예외로 합니다:
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 따르거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ol>

            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-2 font-medium text-slate-100">제3자 서비스 이용</h3>
              <p className="mb-2 text-slate-400">
                회사는 서비스 제공을 위해 다음의 외부 서비스를 이용합니다:
              </p>
              <ul className="space-y-2">
                <li>
                  <strong>Toss Payments (결제 처리)</strong>
                  <br />
                  <span className="text-slate-400">제공 정보: 결제 금액, 주문 정보</span>
                </li>
                <li>
                  <strong>Resend (이메일 발송)</strong>
                  <br />
                  <span className="text-slate-400">제공 정보: 이메일 주소</span>
                </li>
                <li>
                  <strong>Supabase (데이터 저장)</strong>
                  <br />
                  <span className="text-slate-400">제공 정보: 서비스 이용에 필요한 데이터</span>
                </li>
              </ul>
            </div>
          </section>

          {/* 제5조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제5조 (이용자의 권리와 행사 방법)</h2>
            <p>이용자는 다음과 같은 권리를 행사할 수 있습니다:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>개인정보 열람 요구</strong>: 회사가 보유한 본인의 개인정보에 대한 열람을 요구할 수 있습니다.
              </li>
              <li>
                <strong>개인정보 정정 요구</strong>: 개인정보에 오류가 있는 경우 정정을 요구할 수 있습니다.
              </li>
              <li>
                <strong>개인정보 삭제 요구</strong>: 개인정보의 삭제를 요구할 수 있습니다. 
                단, 법령에 의해 보존 의무가 있는 경우 삭제가 제한될 수 있습니다.
              </li>
              <li>
                <strong>처리 정지 요구</strong>: 개인정보 처리의 정지를 요구할 수 있습니다.
              </li>
            </ol>
            <p className="mt-4">
              위 권리 행사는 서비스 내 &quot;내 정보&quot; 페이지 또는 고객센터를 통해 요청하실 수 있습니다.
            </p>
          </section>

          {/* 제6조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제6조 (개인정보의 파기)</h2>
            <p>
              회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 
              지체 없이 해당 개인정보를 파기합니다.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>전자적 파일 형태</strong>: 복구 및 재생이 불가능한 방법으로 영구 삭제
              </li>
              <li>
                <strong className="text-green-400">체형 사진 (중요)</strong>: 분석 완료 후 24시간 이내 자동 파기
                <ul className="mt-2 list-circle pl-5 text-slate-400">
                  <li>업로드된 체형 사진은 분석 목적으로만 사용됩니다</li>
                  <li>리포트 생성이 완료되면 24시간 이내에 서버에서 영구 삭제됩니다</li>
                  <li>삭제 후에는 복구가 불가능합니다</li>
                </ul>
              </li>
            </ul>
          </section>

          {/* 제7조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제7조 (개인정보의 안전성 확보 조치)</h2>
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>비밀번호 암호화 저장</strong>: 모든 비밀번호는 단방향 암호화되어 저장됩니다</li>
              <li><strong>개인정보 접근 권한 제한</strong>: 개인정보 처리 권한을 최소 인원으로 제한</li>
              <li><strong>SSL/TLS 암호화 통신</strong>: 모든 데이터 전송 시 암호화 프로토콜 적용</li>
              <li><strong>사진 암호화 저장</strong>: 업로드된 체형 사진은 암호화되어 저장되며, 분석 후 24시간 이내 자동 삭제</li>
              <li><strong>보안 프로그램 설치 및 점검</strong>: 주기적인 보안 시스템 점검 및 업데이트</li>
              <li><strong>개인정보 취급 직원 교육</strong>: 직원 최소화 및 정기적인 보안 교육 실시</li>
            </ul>
            
            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <h3 className="mb-2 font-semibold text-green-400">체형 사진 보안 관리 프로세스</h3>
                  <ul className="space-y-1 text-xs text-slate-300">
                    <li>1. 업로드 시: SSL/TLS 암호화 전송</li>
                    <li>2. 저장 시: 서버 측 암호화 적용 (AES-256)</li>
                    <li>3. 분석 중: 권한을 가진 시스템과 전문가만 접근 가능</li>
                    <li>4. 분석 후: 24시간 이내 자동 영구 삭제</li>
                    <li>5. 백업 시스템에서도 동시 삭제하여 복구 불가능</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 제8조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제8조 (쿠키의 사용)</h2>
            <p>
              회사는 이용자에게 더 나은 서비스를 제공하기 위해 쿠키를 사용합니다. 
              쿠키는 웹사이트가 이용자의 브라우저에 보내는 작은 텍스트 파일로, 
              이용자의 기기에 저장됩니다.
            </p>
            <p className="mt-2">
              이용자는 웹 브라우저 설정을 통해 쿠키의 저장을 거부하거나 삭제할 수 있습니다. 
              단, 쿠키 저장을 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
            </p>
          </section>

          {/* 제9조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제9조 (개인정보 보호책임자)</h2>
            <p>
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 
              개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제 등을 위하여 
              아래와 같이 개인정보 보호책임자를 지정하고 있습니다:
            </p>
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <p><strong>개인정보 보호책임자</strong></p>
              <p className="text-slate-400">이메일: privacy@example.com</p>
            </div>
          </section>

          {/* 제10조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제10조 (개인정보처리방침의 변경)</h2>
            <p>
              이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 
              삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 
              고지할 것입니다.
            </p>
          </section>

          {/* 부칙 */}
          <section className="space-y-3 border-t border-slate-700 pt-6">
            <h2 className="text-lg font-semibold text-slate-100">부칙</h2>
            <p>이 개인정보처리방침은 2024년 1월 1일부터 시행합니다.</p>
          </section>
        </div>

        {/* 푸터 링크 */}
        <footer className="flex flex-wrap gap-4 border-t border-slate-700 pt-6 text-sm">
          <Link href="/terms" className="text-[#f97316] hover:underline">
            이용약관
          </Link>
          <Link href="/" className="text-slate-400 hover:text-white">
            홈으로
          </Link>
        </footer>
      </article>
    </main>
  );
}
