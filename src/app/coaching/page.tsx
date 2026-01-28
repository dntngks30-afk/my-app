// 프리미엄 1:1 코칭 서비스 상세 안내 페이지
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CoachingPage() {
  const router = useRouter();

  const handleSubscribe = () => {
    router.push("/pricing");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-slate-100">
            교정운동 솔루션
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-slate-400 hover:text-slate-100"
          >
            ← 가격 안내
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16">
        {/* 히어로 섹션 */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f97316]/10 px-4 py-2 text-sm text-[#f97316]">
            <span>🔥</span>
            <span className="font-semibold">가장 인기 있는 플랜</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-slate-100 sm:text-5xl">
            프리미엄 1:1 코칭
          </h1>
          <p className="mb-8 text-lg text-slate-300">
            전담 트레이너가 카톡/텔레그램으로 직접 관리해드립니다
          </p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold text-[#f97316]">₩150,000</span>
            <span className="text-xl text-slate-500">/ 월</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            * 3개월 약정 시 10% 할인 (₩135,000/월)
          </p>
        </div>

        {/* 이런 분들께 추천합니다 */}
        <div className="mb-16 rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
          <h2 className="mb-6 text-2xl font-bold text-slate-100">
            이런 분들께 추천합니다
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">혼자서는 꾸준히 어려운 분</p>
                <p className="text-sm text-slate-400">전담 트레이너의 지속적인 동기부여가 필요하신 분</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">정확한 동작이 중요한 분</p>
                <p className="text-sm text-slate-400">사진/영상으로 폼 체크를 받고 싶으신 분</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">영양까지 관리받고 싶은 분</p>
                <p className="text-sm text-slate-400">운동과 함께 식습관 개선이 필요하신 분</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">빠른 피드백이 필요한 분</p>
                <p className="text-sm text-slate-400">질문에 24시간 내 답변을 받고 싶으신 분</p>
              </div>
            </div>
          </div>
        </div>

        {/* 서비스 상세 내용 */}
        <div className="mb-16 space-y-8">
          <h2 className="text-3xl font-bold text-slate-100">
            프리미엄 코칭에 포함된 것들
          </h2>

          {/* 1. 맞춤 분석 */}
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-slate-700 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📊</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    전문가 정적자세 평가 (베이직 포함)
                  </h3>
                  <p className="text-sm text-slate-400">
                    NASM-CES 기반 체형 분석 + PDF 리포트
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>거북목, 라운드숄더, 상완골전방활주, 골반 비대칭 등 불균형 진단</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>억제-신장-활성화-통합 4단계 맞춤 솔루션</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>동작 가이드 영상 링크 제공</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 2. 1:1 전담 관리 */}
          <div className="overflow-hidden rounded-2xl border-2 border-[#f97316]/50 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-[#f97316]/30 bg-[#f97316]/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💬</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    카카오톡 / 텔레그램 1:1 전담 관리
                  </h3>
                  <p className="text-sm text-slate-400">
                    언제든 편하게 질문하고 피드백 받으세요
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>전담 트레이너 배정 (동일 트레이너가 계속 관리)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>24시간 내 피드백 응답 보장</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>운동 중 궁금한 점 즉시 질문 가능</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 3. 주간 루틴 점검 */}
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-slate-700 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📅</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    주간 운동 루틴 점검
                  </h3>
                  <p className="text-sm text-slate-400">
                    매주 진행 상황을 체크하고 조정합니다
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>주 1회 체크인 (운동 실행률, 통증/불편함 여부)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>필요 시 프로그램 난이도 조정</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>목표 달성률 관리</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 4. 동작 폼 체크 */}
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-slate-700 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📸</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    동작 폼 체크 (사진/영상)
                  </h3>
                  <p className="text-sm text-slate-400">
                    정확한 동작으로 효과를 극대화하세요
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>운동 영상/사진 전송 시 폼 피드백 제공</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>잘못된 자세 교정 및 팁 제공</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>부상 방지를 위한 주의사항 안내</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 5. 영양 가이드 */}
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-slate-700 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🥗</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    기본 영양 가이드 제공
                  </h3>
                  <p className="text-sm text-slate-400">
                    운동 효과를 높이는 식습관
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>근육 회복을 위한 단백질 섭취 가이드</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>부종/염증 관리를 위한 식습관 팁</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">•</span>
                  <span>간단한 식단 질문 답변</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 진행 과정 */}
        <div className="mb-16 rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
          <h2 className="mb-8 text-2xl font-bold text-slate-100">
            프리미엄 코칭 진행 과정
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] font-bold text-slate-950">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">결제 및 사진 업로드</h3>
                <p className="text-sm text-slate-400">
                  결제 완료 후 정면/측면 사진 2장을 업로드합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] font-bold text-slate-950">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">전문가 분석 (24시간 내)</h3>
                <p className="text-sm text-slate-400">
                  NASM-CES 전문가가 체형을 분석하고 맞춤 프로그램을 작성합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] font-bold text-slate-950">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">전담 트레이너 배정 및 오리엔테이션</h3>
                <p className="text-sm text-slate-400">
                  카카오톡/텔레그램으로 전담 트레이너와 연결되고, 프로그램 설명을 받습니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] font-bold text-slate-950">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">매일 실행 + 주간 체크인</h3>
                <p className="text-sm text-slate-400">
                  프로그램을 실행하며 언제든 질문하고, 매주 진행 상황을 점검합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] font-bold text-slate-950">
                5
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">목표 달성 및 유지</h3>
                <p className="text-sm text-slate-400">
                  1~3개월 후 체형 개선을 확인하고, 이후 유지 방법을 안내받습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-[#f97316]/50 bg-gradient-to-br from-[#f97316]/20 via-slate-900/90 to-slate-900/90 p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-100">
            지금 시작하고 전담 트레이너를 만나보세요
          </h2>
          <p className="mb-6 text-slate-300">
            첫 7일 동안 만족하지 못하시면 전액 환불해드립니다
          </p>
          <button
            onClick={handleSubscribe}
            className="inline-flex items-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-lg font-bold text-slate-950 shadow-[0_0_30px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c] hover:shadow-[0_0_40px_rgba(249,115,22,0.7)] hover:scale-105"
          >
            <span>₩150,000/월로 시작하기</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-slate-800 bg-slate-950/50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500">
          <p>© 2026 교정운동 솔루션. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/terms" className="hover:text-slate-300">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-slate-300">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
