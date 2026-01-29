// 이용약관 페이지입니다.
// 서비스 이용에 관한 기본 조건과 규정을 안내합니다.
// ⚠️ 법적 검토 필수: 본 약관은 의료법 위반을 방지하기 위한 안전장치입니다.

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] px-4 py-12 text-slate-100">
      <article className="mx-auto max-w-4xl space-y-8">
        {/* 헤더 */}
        <header className="space-y-4">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold">이용약관</h1>
          <p className="text-sm text-slate-400">
            최종 수정일: 2026년 1월 29일
          </p>
        </header>

        {/* 중요 안내 */}
        <div className="rounded-xl border-2 border-red-500/50 bg-red-500/10 p-6">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="mb-2 font-bold text-red-400">필독: 서비스 이용 전 반드시 확인하세요</h3>
              <ul className="space-y-1 text-sm text-slate-300">
                <li>• 본 서비스는 의료행위가 아니며, 질병의 진단·치료·예방을 목적으로 하지 않습니다.</li>
                <li>• 통증이나 질병이 있는 경우 반드시 전문 의료기관을 방문하시기 바랍니다.</li>
                <li>• 제공되는 운동 가이드는 참고 자료이며, 의료 전문가의 진료를 대체할 수 없습니다.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          {/* 제1조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제1조 (서비스의 정의 및 범위)</h2>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-5">
              <p className="mb-3 font-semibold text-slate-100">
                본 서비스는 <span className="text-[#f97316]">운동 가이드 제공 및 운동 과정 관리</span>에 한정된 온라인 코칭 서비스입니다.
              </p>
              <p className="text-slate-300">
                본 서비스는 <strong>의료행위가 아니며</strong>, 질병의 진단·치료·예방을 목적으로 하지 않습니다.
              </p>
            </div>
            
            <div className="mt-4">
              <h3 className="mb-2 font-semibold text-slate-200">회사가 제공하는 서비스:</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>사진 기반 자세 평가 (Postural Assessment, 의학적 진단 제외)</li>
                <li>NASM 운동 체계에 기반한 운동 루틴 가이드</li>
                <li>운동 수행 방법에 대한 영상 및 설명 자료</li>
                <li>운동 진행 상황 기록 및 관리</li>
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 font-semibold text-red-400">⛔ 회사가 제공하지 않는 것:</h3>
              <ul className="list-disc space-y-2 pl-5 text-slate-300">
                <li>의학적 진단 및 질병 치료</li>
                <li>통증 원인 진단 및 치료 방법 제시</li>
                <li>의료기기를 사용한 검사 및 평가</li>
                <li>특정 운동 효과 또는 신체 변화 보장</li>
                <li>의료 전문가의 진료 대체</li>
              </ul>
            </div>
          </section>

          {/* 제2조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제2조 (용어의 정의)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>&quot;서비스&quot;</strong>란 회사가 제공하는 체형 사진 분석, 맞춤 운동 가이드 제공, 
                관련 콘텐츠 및 기능 일체를 의미합니다.
              </li>
              <li>
                <strong>&quot;이용자&quot;</strong>란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 
                회원 및 비회원을 말합니다.
              </li>
              <li>
                <strong>&quot;리포트&quot;</strong>란 이용자의 체형 사진을 분석하여 제공되는 
                맞춤 운동 가이드 및 전문가 소견을 포함한 결과물을 말합니다.
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제3조 (이용자의 의무 및 책임)</h2>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
              <h3 className="mb-3 font-bold text-amber-400">⚠️ 이용자는 본 서비스 이용 전, 다음 사항을 확인해야 합니다:</h3>
              <ol className="list-decimal space-y-3 pl-5">
                <li>
                  <strong className="text-slate-100">현재 통증, 질병, 부상이 있는 경우</strong> 의료 전문가의 진료를 우선 받을 것
                </li>
                <li>
                  <strong className="text-slate-100">기저질환</strong>(심혈관 질환, 당뇨, 고혈압 등)이 있는 경우 의사와 상담 후 이용할 것
                </li>
                <li>
                  <strong className="text-slate-100">임신, 수술 후 회복기</strong> 등 특수한 상황의 경우 의료진 승인 후 이용할 것
                </li>
                <li>
                  본인의 신체 상태를 정확히 파악하고, 무리한 운동을 지양할 것
                </li>
                <li>
                  운동 중 통증, 불편감, 어지러움 등이 발생할 경우 즉시 중단하고 의료 전문가와 상담할 것
                </li>
              </ol>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 font-semibold text-slate-200">이용자는 다음 행위를 해서는 안 됩니다:</h3>
              <ol className="list-decimal space-y-2 pl-5">
                <li>타인의 정보를 도용하거나 허위 정보를 입력하는 행위</li>
                <li>타인의 신체 사진을 무단으로 업로드하는 행위</li>
                <li>서비스를 통해 얻은 정보를 회사의 사전 승낙 없이 복제, 배포, 판매하는 행위</li>
                <li>회사의 서비스 운영을 방해하는 행위</li>
                <li>기타 불법적이거나 부당한 행위</li>
              </ol>
            </div>
          </section>

          {/* 제4조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제4조 (면책 조항 - 중요)</h2>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
              <ol className="list-decimal space-y-4 pl-5">
                <li>
                  <strong className="text-red-400">의료행위 아님:</strong> 본 서비스는 의료행위가 아니므로, 
                  운동 수행 중 또는 수행 후 발생하는 부상, 통증 악화, 건강 상태 변화 등에 대해 
                  <strong className="text-slate-100"> 회사는 책임을 지지 않습니다.</strong>
                </li>
                <li>
                  <strong className="text-red-400">정보 정확성:</strong> 회사는 이용자가 제공한 사진, 정보의 정확성에 대해 책임지지 않으며, 
                  부정확한 정보로 인한 부적절한 운동 가이드 제공에 대해 책임을 지지 않습니다.
                </li>
                <li>
                  <strong className="text-red-400">주의사항 미준수:</strong> 이용자가 본 약관의 주의사항 및 안전 수칙을 준수하지 않아 발생한 손해에 대해 
                  회사는 책임을 지지 않습니다.
                </li>
                <li>
                  <strong className="text-red-400">참고 자료:</strong> 본 서비스는 참고 자료로만 활용되어야 하며, 
                  의학적 소견이나 전문 의료인의 진료를 대체할 수 없습니다.
                </li>
                <li>
                  <strong className="text-red-400">운동 효과:</strong> 운동 효과는 개인의 신체 조건, 생활 습관, 꾸준함 등에 따라 
                  다를 수 있으며, 회사는 특정 결과를 보장하지 않습니다.
                </li>
              </ol>
            </div>
          </section>

          {/* 제5조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제5조 (서비스 이용료 및 결제)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                서비스 이용료는 서비스 화면에 표시된 금액을 따르며, 
                회사는 필요에 따라 이용료를 변경할 수 있습니다.
              </li>
              <li>
                이용자는 회사가 정한 결제수단(신용카드, 체크카드 등)을 통해 
                서비스 이용료를 결제합니다.
              </li>
              <li>
                결제 완료 후 리포트가 발송된 경우, 디지털 콘텐츠의 특성상 
                환불이 제한될 수 있습니다. (환불 정책 참조)
              </li>
            </ol>
          </section>

          {/* 제6조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제6조 (환불 정책)</h2>
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-5">
              <h3 className="mb-3 font-semibold text-green-400">1회 구매 (BASIC/STANDARD):</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>리포트 발송 전:</strong> 100% 환불</li>
                <li><strong>리포트 발송 후:</strong> 디지털 콘텐츠의 특성상 환불 불가</li>
                <li><strong>서비스 하자 발생 시:</strong> 7일 내 100% 환불</li>
              </ul>
              
              <h3 className="mb-3 mt-5 font-semibold text-green-400">구독 서비스 (PREMIUM):</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>첫 7일 이내 취소:</strong> 전액 환불</li>
                <li><strong>7일 경과 후:</strong> 사용 일수 제외 후 일할 계산 환불</li>
                <li><strong>자동 결제 해지:</strong> 다음 결제일 24시간 전까지 취소 가능</li>
              </ul>

              <p className="mt-4 text-sm text-slate-300">
                <strong>환불 처리 기간:</strong> 영업일 기준 3~5일<br />
                <strong>환불 문의:</strong> support@posturelab.com
              </p>
            </div>
          </section>

          {/* 제7조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제7조 (자동 결제 - 구독 서비스)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>프리미엄 플랜은 월 단위 자동 결제 구독 서비스입니다.</li>
              <li>매월 결제일에 등록된 결제 수단으로 자동 청구됩니다.</li>
              <li>자동 결제 해지는 다음 결제일 24시간 전까지 가능합니다.</li>
              <li>결제 실패 시 3회 재시도 후 구독이 자동 해지됩니다.</li>
              <li>해지 후에도 남은 구독 기간 동안 서비스를 이용할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제8조 (개인정보 보호)</h2>
            <p>
              회사는 이용자의 개인정보를 보호하기 위해 최선을 다하고 있습니다. 
              자세한 내용은 <Link href="/privacy" className="text-[#f97316] hover:underline">개인정보처리방침</Link>을 참조하시기 바랍니다.
            </p>
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <p className="text-sm">
                <strong className="text-green-400">📸 사진 보안:</strong> 업로드된 체형 사진은 분석 완료 후 <strong>24시간 이내 자동 파기</strong>되며, 
                저장 기간 동안 암호화되어 안전하게 관리됩니다.
              </p>
            </div>
          </section>

          {/* 제9조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제9조 (저작권)</h2>
            <p>
              서비스에서 제공하는 리포트, 운동 가이드, 콘텐츠 등의 저작권은 회사에 귀속됩니다. 
              이용자는 회사의 사전 동의 없이 이를 복제, 배포, 전시, 수정하거나 상업적 목적으로 
              이용할 수 없습니다.
            </p>
          </section>

          {/* 제10조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제10조 (약관의 변경)</h2>
            <p>
              회사는 필요한 경우 관련 법령에 위배되지 않는 범위 내에서 
              이 약관을 개정할 수 있습니다. 약관이 변경되는 경우, 
              회사는 변경 내용을 서비스 내 공지사항 또는 이메일을 통해 공지합니다.
            </p>
          </section>

          {/* 제11조 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">제11조 (분쟁 해결)</h2>
            <p>
              본 약관과 관련하여 발생한 분쟁에 대해서는 대한민국 법률을 적용하며, 
              분쟁이 발생한 경우 회사의 본사 소재지를 관할하는 법원을 전속관할법원으로 합니다.
            </p>
          </section>

          {/* 부칙 */}
          <section className="space-y-3 border-t border-slate-700 pt-6">
            <h2 className="text-xl font-bold text-slate-100">부칙</h2>
            <p>
              <strong>1. 시행일:</strong> 이 약관은 2026년 1월 29일부터 시행합니다.<br />
              <strong>2. 경과 조치:</strong> 본 약관 시행 전에 가입한 회원에게도 본 약관이 적용됩니다.
            </p>
          </section>

          {/* 고객센터 */}
          <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-100">고객센터</h3>
            <ul className="space-y-2 text-sm">
              <li><strong>이메일:</strong> support@posturelab.com</li>
              <li><strong>운영시간:</strong> 평일 09:00 - 18:00 (주말 및 공휴일 휴무)</li>
              <li><strong>대표자:</strong> 김교정</li>
              <li><strong>사업자등록번호:</strong> 123-45-67890</li>
            </ul>
          </section>
        </div>

        {/* 푸터 링크 */}
        <footer className="flex flex-wrap gap-4 border-t border-slate-700 pt-6 text-sm">
          <Link href="/privacy" className="text-[#f97316] hover:underline">
            개인정보처리방침
          </Link>
          <Link href="/" className="text-slate-400 hover:text-white">
            홈으로
          </Link>
        </footer>
      </article>
    </main>
  );
}
