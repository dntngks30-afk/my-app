// VIP 서비스 상세 안내 페이지 (화상 코칭 + 프리미엄 관리)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VIPPage() {
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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 px-4 py-2 text-sm text-amber-400">
            <span>⭐</span>
            <span className="font-semibold">최고급 프리미엄 서비스</span>
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            VIP 화상 코칭
          </h1>
          <p className="mb-8 text-lg text-slate-300">
            월 4회 실시간 화상으로 전문가와 1:1로 만나세요
          </p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold text-amber-400">₩400,000</span>
            <span className="text-xl text-slate-500">/ 월</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            월 4회 화상 코칭 + 프리미엄 관리 전체 포함
          </p>
        </div>

        {/* VIP만의 특별함 */}
        <div className="mb-16 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-amber-950/10 to-slate-900 p-8">
          <h2 className="mb-6 text-2xl font-bold text-amber-400">
            VIP 플랜만의 특별함
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-500/20 bg-slate-900/50 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-2xl">🎥</span>
              </div>
              <h3 className="mb-2 font-bold text-slate-100">실시간 화상 코칭</h3>
              <p className="text-sm text-slate-300">
                텍스트나 사진이 아닌, 실시간으로 동작을 보면서 즉각 교정합니다. 마치 PT 스튜디오에서 받는 것처럼.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-slate-900/50 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="mb-2 font-bold text-slate-100">월 1회 재평가</h3>
              <p className="text-sm text-slate-300">
                매월 체형 변화를 다시 평가하고, 프로그램을 업데이트합니다. 지속적인 진화.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-slate-900/50 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-2xl">🥗</span>
              </div>
              <h3 className="mb-2 font-bold text-slate-100">맞춤 영양 플랜</h3>
              <p className="text-sm text-slate-300">
                단순한 팁이 아닌, 주간 식단 예시와 함께 체계적인 영양 관리를 받습니다.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-slate-900/50 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="mb-2 font-bold text-slate-100">우선 응답 (12시간 내)</h3>
              <p className="text-sm text-slate-300">
                일반 회원보다 빠른 12시간 내 응답으로, 궁금증을 빠르게 해결합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 서비스 상세 */}
        <div className="mb-16 space-y-8">
          <h2 className="text-3xl font-bold text-slate-100">
            VIP 플랜에 포함된 모든 것
          </h2>

          {/* 화상 코칭 */}
          <div className="overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-slate-900 via-amber-950/10 to-slate-900">
            <div className="border-b border-amber-500/30 bg-amber-500/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎥</span>
                <div>
                  <h3 className="text-xl font-bold text-amber-400">
                    월 4회 실시간 화상 코칭 (주 1회)
                  </h3>
                  <p className="text-sm text-slate-400">
                    전문가와 1:1로 화면을 보며 직접 교정받습니다
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <div>
                    <p className="font-semibold text-slate-100">세션당 30~40분</p>
                    <p className="text-slate-400">동작 시연, 폼 체크, 질의응답 포함</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <div>
                    <p className="font-semibold text-slate-100">실시간 동작 교정</p>
                    <p className="text-slate-400">화면으로 동작을 보며 즉각 피드백</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <div>
                    <p className="font-semibold text-slate-100">유연한 예약 시스템</p>
                    <p className="text-slate-400">원하는 시간에 사전 예약 (평일/주말 가능)</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <div>
                    <p className="font-semibold text-slate-100">세션 녹화 제공</p>
                    <p className="text-slate-400">복습용 영상 링크 전달 (선택 시)</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* 월 1회 재평가 */}
          <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-amber-500/20 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔄</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    월 1회 재평가 + 프로그램 업데이트
                  </h3>
                  <p className="text-sm text-slate-400">
                    변화에 맞춰 계속 진화하는 프로그램
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>매월 사진 재촬영 및 체형 변화 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>개선된 부분과 보완할 부분 피드백</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>다음 달 프로그램 난이도 및 종목 조정</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 맞춤 영양 플랜 */}
          <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-amber-500/20 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🥗</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    맞춤 영양 플랜 (주간 식단 제공)
                  </h3>
                  <p className="text-sm text-slate-400">
                    운동 효과를 극대화하는 전문 영양 관리
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>주간 식단 예시 제공 (아침/점심/저녁/간식)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>칼로리 및 영양소 비율 가이드</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>개인 상황에 맞춘 식단 조정 (외식, 회식 등)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>부종/염증 관리 식품 추천</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 프리미엄 전체 포함 */}
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800/50">
            <div className="border-b border-slate-700 bg-slate-900/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✨</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    프리미엄 플랜의 모든 기능 포함
                  </h3>
                  <p className="text-sm text-slate-400">
                    VIP는 프리미엄 + 추가 혜택
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>베이직 플랜 (정적자세 평가 + PDF 리포트)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>카카오톡/텔레그램 1:1 전담 관리</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>주간 운동 루틴 점검</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>동작 폼 체크 (사진/영상 피드백)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 이런 분께 추천 */}
        <div className="mb-16 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-amber-950/10 to-slate-900 p-8">
          <h2 className="mb-6 text-2xl font-bold text-amber-400">
            VIP 플랜은 이런 분께 추천합니다
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">최고의 관리를 받고 싶은 분</p>
                <p className="text-sm text-slate-400">텍스트가 아닌 실시간 화상으로 디테일하게 배우고 싶으신 분</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">빠른 변화가 필요한 분</p>
                <p className="text-sm text-slate-400">월 1회 재평가로 프로그램을 지속 업데이트하며 최적화하고 싶으신 분</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">운동과 영양을 함께 관리받고 싶은 분</p>
                <p className="text-sm text-slate-400">주간 식단까지 체계적으로 관리받고 싶으신 분</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-slate-100">바쁜 일정 속에서도 확실한 시간을 확보하고 싶은 분</p>
                <p className="text-sm text-slate-400">주 1회 화상 세션으로 집중 관리를 받고 싶으신 분</p>
              </div>
            </div>
          </div>
        </div>

        {/* 진행 과정 */}
        <div className="mb-16 rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
          <h2 className="mb-8 text-2xl font-bold text-slate-100">
            VIP 코칭 진행 과정
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-slate-950">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">결제 및 사진 업로드</h3>
                <p className="text-sm text-slate-400">
                  VIP 플랜 결제 후 정면/측면 사진을 업로드합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-slate-950">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">전문가 심층 분석 (24시간 내)</h3>
                <p className="text-sm text-slate-400">
                  NASM-CES 전문가가 디테일하게 체형을 분석하고 VIP용 맞춤 프로그램을 작성합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-slate-950">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">전담 전문가 배정 + 첫 화상 오리엔테이션</h3>
                <p className="text-sm text-slate-400">
                  카톡/텔레그램 연결 후, 첫 화상 세션에서 프로그램 설명 및 Q&A를 진행합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-slate-950">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">주 1회 화상 코칭 + 매일 관리</h3>
                <p className="text-sm text-slate-400">
                  월 4회 화상 세션으로 동작을 직접 교정받고, 매일 텍스트/사진으로도 피드백받습니다.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-slate-950">
                5
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-100">월 1회 재평가 및 프로그램 업데이트</h3>
                <p className="text-sm text-slate-400">
                  매월 체형 변화를 재평가하고, 다음 달 프로그램을 업그레이드합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-500/20 via-slate-900/90 to-slate-900/90 p-8 text-center shadow-[0_20px_60px_rgba(245,158,11,0.3)]">
          <h2 className="mb-4 text-2xl font-bold text-slate-100">
            최고급 VIP 관리를 경험하세요
          </h2>
          <p className="mb-6 text-slate-300">
            첫 7일 동안 만족하지 못하시면 전액 환불해드립니다
          </p>
          <button
            onClick={handleSubscribe}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-4 text-lg font-bold text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.5)] transition hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_40px_rgba(245,158,11,0.7)] hover:scale-105"
          >
            <span>₩400,000/월로 시작하기</span>
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
