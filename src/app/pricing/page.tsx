// 가격 안내 페이지: 3가지 서비스 티어(베이직/프리미엄/VIP)를 소개합니다.
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  // 각 티어별 결제 처리
  const handlePurchase = (tier: string, price: number) => {
    setSelectedTier(tier);
    
    // 결제 페이지로 이동 (tier 정보를 쿼리 파라미터로 전달)
    router.push(`/?tier=${tier}&price=${price}`);
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
            href="/"
            className="text-sm text-slate-400 hover:text-slate-100"
          >
            ← 홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16">
        {/* 페이지 타이틀 */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold text-slate-100 sm:text-5xl">
            나에게 맞는 플랜을 선택하세요
          </h1>
          <p className="text-lg text-slate-300">
            NASM-CES 기반 전문 교정운동 솔루션
          </p>
        </div>

        {/* 3가지 티어 카드 */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* 베이직 플랜 */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 p-8 transition hover:border-slate-600 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-100">
                베이직
              </h2>
              <p className="text-sm text-slate-400">
                기본 분석 + PDF 리포트
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">
                  ₩19,900
                </span>
                <span className="text-slate-500">1회</span>
              </div>
            </div>

            <div className="mb-8 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  정적자세 평가 (사진 2장)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  불균형 진단 (거북목, 라운드숄더 등)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  4단계 맞춤 솔루션 (억제-신장-활성화-통합)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  PDF 리포트 제공
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  동작 가이드 영상 링크
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  24시간 내 전달
                </span>
              </div>
            </div>

            <button
              onClick={() => handlePurchase("basic", 19900)}
              className="w-full rounded-full bg-slate-800 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              베이직 시작하기
            </button>
          </div>

          {/* 프리미엄 플랜 (POPULAR) */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-[#f97316] bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-[0_20px_80px_rgba(249,115,22,0.3)]">
            {/* POPULAR 배지 */}
            <div className="absolute right-4 top-4 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold text-slate-950">
              POPULAR
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-100">
                프리미엄
              </h2>
              <p className="text-sm text-slate-400">
                1:1 전담 코칭 (1~3개월)
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">
                  ₩150,000
                </span>
                <span className="text-slate-500">/ 월</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                * 1개월 기준, 3개월 약정 시 10% 할인
              </p>
            </div>

            <div className="mb-8 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-slate-100">
                  베이직 플랜의 모든 기능
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  카카오톡/텔레그램 1:1 전담 관리
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  주간 운동 루틴 점검
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  영양 가이드 제공
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  동작 폼 체크 (사진/영상 피드백)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  24시간 내 피드백 응답
                </span>
              </div>
            </div>

            <button
              onClick={() => handlePurchase("premium", 150000)}
              className="w-full rounded-full bg-[#f97316] py-3 font-bold text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c] hover:shadow-[0_0_30px_rgba(249,115,22,0.7)]"
            >
              프리미엄 시작하기
            </button>
          </div>

          {/* VIP 플랜 */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 p-8 transition hover:border-amber-500 hover:shadow-[0_20px_60px_rgba(245,158,11,0.3)]">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-amber-400">
                VIP
              </h2>
              <p className="text-sm text-slate-400">
                화상 코칭 + 프리미엄 관리
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-100">
                  ₩400,000
                </span>
                <span className="text-slate-500">/ 월</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                * 월 4회 화상 세션 포함
              </p>
            </div>

            <div className="mb-8 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-slate-100">
                  프리미엄 플랜의 모든 기능
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  월 4회 화상 코칭 (1:1 실시간)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  디테일 동작 평가 (실시간 피드백)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  월 1회 재평가 + 프로그램 업데이트
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  맞춤 영양 플랜 (주간 식단 제공)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-slate-300">
                  우선 응답 (12시간 내)
                </span>
              </div>
            </div>

            <button
              onClick={() => handlePurchase("vip", 400000)}
              className="w-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.7)]"
            >
              VIP 시작하기
            </button>
          </div>
        </div>

        {/* FAQ 섹션 */}
        <div className="mt-20">
          <h2 className="mb-8 text-center text-3xl font-bold text-slate-100">
            자주 묻는 질문
          </h2>
          <div className="mx-auto max-w-3xl space-y-4">
            <details className="group rounded-xl border border-slate-700 bg-slate-900/50 p-6">
              <summary className="cursor-pointer font-semibold text-slate-100">
                어떤 플랜이 나에게 맞나요?
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                <strong>베이직</strong>: 혼자서도 꾸준히 할 수 있고, PDF와 영상만으로 충분한 분<br />
                <strong>프리미엄</strong>: 전담 트레이너의 관리가 필요하고, 동기부여와 세밀한 피드백을 원하는 분<br />
                <strong>VIP</strong>: 최고 수준의 맞춤 관리와 실시간 화상 코칭을 원하는 분
              </p>
            </details>

            <details className="group rounded-xl border border-slate-700 bg-slate-900/50 p-6">
              <summary className="cursor-pointer font-semibold text-slate-100">
                결제 후 언제 리포트를 받을 수 있나요?
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                사진 업로드 후 <strong>24시간 내</strong>에 전문가가 분석한 맞춤 리포트를 이메일로 전달드립니다.
              </p>
            </details>

            <details className="group rounded-xl border border-slate-700 bg-slate-900/50 p-6">
              <summary className="cursor-pointer font-semibold text-slate-100">
                환불이 가능한가요?
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                <strong>베이직</strong>: 리포트 전달 전까지 100% 환불 가능<br />
                <strong>프리미엄/VIP</strong>: 첫 7일 이내 서비스 불만족 시 전액 환불 가능
              </p>
            </details>

            <details className="group rounded-xl border border-slate-700 bg-slate-900/50 p-6">
              <summary className="cursor-pointer font-semibold text-slate-100">
                프리미엄과 VIP 플랜의 차이는 무엇인가요?
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                프리미엄은 텍스트/사진 기반 피드백이 중심이고, VIP는 <strong>월 4회 실시간 화상 코칭</strong>으로 동작을 직접 보면서 교정합니다. 
                또한 VIP는 월 1회 재평가로 프로그램을 지속적으로 업데이트합니다.
              </p>
            </details>
          </div>
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
