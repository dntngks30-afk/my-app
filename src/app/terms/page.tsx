// 이용약관 페이지입니다.
// 서비스 이용에 관한 기본 조건과 규정을 안내합니다.

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] px-4 py-12 text-slate-100">
      <article className="mx-auto max-w-3xl space-y-8">
        {/* 헤더 */}
        <header className="space-y-4">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold">이용약관</h1>
          <p className="text-sm text-slate-400">
            최종 수정일: 2024년 1월 1일
          </p>
        </header>

        {/* 본문 */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          {/* 제1조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제1조 (목적)</h2>
            <p>
              이 약관은 교정 솔루션(이하 &quot;회사&quot;)이 제공하는 체형 분석 및 교정운동 솔루션 서비스(이하 &quot;서비스&quot;)의 
              이용조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제2조 (용어의 정의)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>&quot;서비스&quot;</strong>란 회사가 제공하는 체형 사진 분석, 맞춤 교정운동 리포트 제공, 
                관련 콘텐츠 및 기능 일체를 의미합니다.
              </li>
              <li>
                <strong>&quot;이용자&quot;</strong>란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 
                회원 및 비회원을 말합니다.
              </li>
              <li>
                <strong>&quot;회원&quot;</strong>이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 
                회사의 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
              </li>
              <li>
                <strong>&quot;리포트&quot;</strong>란 이용자의 체형 사진을 분석하여 제공되는 
                맞춤 교정운동 가이드 및 전문가 소견을 포함한 결과물을 말합니다.
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제3조 (서비스의 내용)</h2>
            <p>회사가 제공하는 서비스는 다음과 같습니다:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>체형 사진 업로드 및 분석</li>
              <li>NASM 기반 4단계 교정운동 리포트 제공 (억제-신장-활성화-통합)</li>
              <li>전문가 맞춤 운동 처방 및 소견</li>
              <li>이메일 알림 서비스</li>
              <li>기타 회사가 정하는 서비스</li>
            </ol>
          </section>

          {/* 제4조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제4조 (서비스 이용료 및 결제)</h2>
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
                환불이 제한될 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 제5조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제5조 (환불 정책)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                결제 후 24시간 이내에 리포트가 발송되지 않은 경우, 
                전액 환불을 요청할 수 있습니다.
              </li>
              <li>
                리포트 발송 완료 후에는 디지털 콘텐츠의 특성상 
                환불이 불가능합니다.
              </li>
              <li>
                서비스 장애 등 회사의 귀책사유로 서비스를 이용하지 못한 경우, 
                회사는 그에 상응하는 보상을 제공합니다.
              </li>
              <li>
                환불 관련 문의는 고객센터를 통해 접수해 주시기 바랍니다.
              </li>
            </ol>
          </section>

          {/* 제6조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제6조 (이용자의 의무)</h2>
            <p>이용자는 다음 행위를 해서는 안 됩니다:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>타인의 정보를 도용하거나 허위 정보를 입력하는 행위</li>
              <li>타인의 신체 사진을 무단으로 업로드하는 행위</li>
              <li>서비스를 통해 얻은 정보를 회사의 사전 승낙 없이 복제, 배포, 판매하는 행위</li>
              <li>회사의 서비스 운영을 방해하는 행위</li>
              <li>기타 불법적이거나 부당한 행위</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제7조 (면책 조항)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                본 서비스는 의료 행위가 아니며, 제공되는 리포트는 
                전문 의료인의 진단을 대체하지 않습니다.
              </li>
              <li>
                이용자는 본 서비스의 리포트를 참고 자료로만 활용해야 하며, 
                신체 이상이 있는 경우 반드시 전문 의료기관에 상담하시기 바랍니다.
              </li>
              <li>
                회사는 이용자가 서비스를 통해 얻은 정보를 바탕으로 
                운동을 수행하여 발생한 상해에 대해 책임지지 않습니다.
              </li>
            </ol>
          </section>

          {/* 제8조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제8조 (저작권)</h2>
            <p>
              서비스에서 제공하는 리포트, 운동 가이드, 콘텐츠 등의 저작권은 회사에 귀속됩니다. 
              이용자는 회사의 사전 동의 없이 이를 복제, 배포, 전시, 수정하거나 상업적 목적으로 
              이용할 수 없습니다.
            </p>
          </section>

          {/* 제9조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제9조 (약관의 변경)</h2>
            <p>
              회사는 필요한 경우 관련 법령에 위배되지 않는 범위 내에서 
              이 약관을 개정할 수 있습니다. 약관이 변경되는 경우, 
              회사는 변경 내용을 서비스 내 공지사항 또는 이메일을 통해 공지합니다.
            </p>
          </section>

          {/* 제10조 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">제10조 (분쟁 해결)</h2>
            <p>
              본 약관과 관련하여 발생한 분쟁에 대해서는 대한민국 법률을 적용하며, 
              분쟁이 발생한 경우 회사의 본사 소재지를 관할하는 법원을 전속관할법원으로 합니다.
            </p>
          </section>

          {/* 부칙 */}
          <section className="space-y-3 border-t border-slate-700 pt-6">
            <h2 className="text-lg font-semibold text-slate-100">부칙</h2>
            <p>이 약관은 2024년 1월 1일부터 시행합니다.</p>
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
