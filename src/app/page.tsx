// PostureLab 메인 랜딩 페이지
// 간단하고 명확한 UX: 버튼 클릭 → 무료 체크 시작
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [peopleCount, setPeopleCount] = useState<number>(1245);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [showProcess, setShowProcess] = useState(false);
  const [showCorrectionSystem, setShowCorrectionSystem] = useState(false);

  useEffect(() => {
    // 로그인 상태 확인
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || undefined });
      }
    };
    checkUser();

    // 실시간 신청 인원 수 애니메이션
    const interval = setInterval(() => {
      setPeopleCount((prev) => {
        const delta = [-1, 0, 1][Math.floor(Math.random() * 3)];
        const next = prev + delta;
        return Math.max(1200, Math.min(1500, next));
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatPeopleCount = (count: number) =>
    count.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* 배경 그라데이션 효과 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-[#f97316]/10 blur-3xl" />
        <div className="absolute -right-1/4 top-1/3 h-96 w-96 rounded-full bg-[#fb923c]/10 blur-3xl" />
      </div>

      {/* 헤더 네비게이션 */}
      <nav className="relative z-20 flex items-center justify-between border-b border-slate-800/50 bg-slate-950/80 px-6 py-4 backdrop-blur-sm">
        <Link href="/" className="text-xl font-bold text-slate-100">
          PostureLab
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-slate-400">{user.email}</span>
              <Link
                href="/my-report"
                className="text-sm text-slate-300 hover:text-white"
              >
                내 리포트
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/free-survey"
                className="text-sm font-medium text-[#f97316] hover:text-[#fb923c]"
              >
                📝 무료 자세 체크
              </Link>
              <Link
                href="/login"
                className="text-sm text-slate-300 hover:text-white"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[#f97316] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#fb923c]"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* 메인 히어로 섹션 */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:gap-16">
          {/* 왼쪽: 메인 메시지 */}
          <div className="flex-1 space-y-8">
            {/* 상단 배지 */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#f97316]" />
              <span className="font-medium">NASM 기반 · 교정운동 전문가</span>
            </div>

            {/* 메인 헤드라인 */}
            <header className="space-y-6">
              <h1 className="text-4xl font-bold leading-tight text-slate-100 sm:text-5xl md:text-6xl">
                사진 2장으로 시작하는
                <br />
                <span className="bg-gradient-to-r from-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
                  내 몸 균형 찾기
                </span>
              </h1>
              <p className="text-xl leading-relaxed text-slate-200 md:text-2xl">
                전문가가 확인하고,
                <br />
                <span className="font-bold text-white">
                  맞춤 운동 가이드를 보내드려요
                </span>
              </p>

              {/* 메인 CTA 버튼 */}
              <div className="pt-4">
                <Link
                  href="/free-survey"
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-4 text-lg font-bold text-white shadow-[0_10px_40px_rgba(249,115,22,0.4)] transition hover:scale-105 hover:shadow-[0_15px_50px_rgba(249,115,22,0.5)]"
                >
                  <span className="text-2xl">📝</span>
                  <span>무료로 체크 시작하기</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>

              {/* 신뢰 배지 */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  NASM 기반
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  24시간 전달
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  1:1 맞춤
                </div>
              </div>
            </header>

            {/* 실시간 신청 인원 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-[#f97316]/30 bg-[#f97316]/5 px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f97316] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f97316]" />
                </span>
                <span className="font-semibold text-slate-100">
                  {formatPeopleCount(peopleCount)}명
                </span>
                <span className="text-slate-300">분석 진행 중</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 프로세스 안내 카드 */}
          <aside className="flex flex-1 justify-center md:justify-end">
            <div className="w-full max-w-sm">
              <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                <div className="mb-6 text-center">
                  <div className="mb-2 inline-block rounded-full bg-green-500/10 px-3 py-1">
                    <span className="text-xs font-bold text-green-400">완전 무료</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">
                    간단하게 시작하세요
                  </h3>
                </div>

                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-400">
                      1
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">사진 등록</h4>
                      <p className="text-sm text-slate-400">정면/측면 사진 2장</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-400">
                      2
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">간단한 설문</h4>
                      <p className="text-sm text-slate-400">3분이면 충분해요</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-400">
                      3
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">즉시 결과 확인</h4>
                      <p className="text-sm text-slate-400">기본 자세 경향 분석</p>
                    </div>
                  </div>

                  {/* Step 4: Upgrade */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20 text-lg font-bold text-[#f97316]">
                      +
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">원하면 업그레이드</h4>
                      <p className="text-sm text-slate-400">상세 리포트 + 운동 가이드</p>
                    </div>
                  </div>
                </div>

                {/* 안내 문구 */}
                <div className="mt-6 rounded-lg border border-[#f97316]/30 bg-[#f97316]/5 p-4">
                  <p className="text-center text-xs text-slate-300">
                    💡 무료 버전은 간단한 경향만 확인
                    <br />
                    <span className="text-[#f97316]">더 정확한 분석이 필요하면 BASIC 플랜</span>
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* 교정운동 소개 및 신뢰 확보 섹션 */}
        <section className="relative z-10 mt-24 space-y-12">
          {/* 섹션 제목 */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">
              운동 전문가가
              <br />
              처음부터 끝까지 함께합니다
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              NASM 기반 체계적 접근, 안전한 프로세스
            </p>
          </div>

          {/* 3가지 핵심 메시지 카드 */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* 메시지 1 */}
            <div className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 transition hover:border-[#f97316]/50">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316]/10 text-4xl">
                🎓
              </div>
              <h3 className="mb-4 text-xl font-bold text-slate-100">
                국제 인증 전문가가
                <br />
                직접 확인합니다
              </h3>
              <p className="leading-relaxed text-slate-300">
                NASM-CES 자격을 보유한 운동 전문가가 사진과 설문을 직접 검토하여 당신만의 운동 루틴을 만듭니다.
                <span className="mt-2 block text-sm text-slate-400">
                  AI가 판단하지 않습니다.
                </span>
              </p>
            </div>

            {/* 메시지 2 */}
            <div className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 transition hover:border-[#f97316]/50">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316]/10 text-4xl">
                ✅
              </div>
              <h3 className="mb-4 text-xl font-bold text-slate-100">
                진단하지 않고,
                <br />
                균형을 찾아갑니다
              </h3>
              <p className="leading-relaxed text-slate-300">
                통증이나 질병을 치료하는 곳이 아닙니다.
                <span className="mt-2 block">
                  몸의 균형을 확인하고, 운동으로 개선해나가는 방법을 안내합니다.
                </span>
              </p>
            </div>

            {/* 메시지 3 */}
            <div className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 transition hover:border-[#f97316]/50 sm:col-span-2 lg:col-span-1">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316]/10 text-4xl">
                🔒
              </div>
              <h3 className="mb-4 text-xl font-bold text-slate-100">
                사진은 24시간 내 삭제,
                <br />
                개인정보 보호
              </h3>
              <p className="leading-relaxed text-slate-300">
                업로드된 사진은 확인 후 자동 삭제되며, 암호화되어 보관됩니다.
                <span className="mt-2 block text-sm text-slate-400">
                  의료 정보가 아닌 운동 참고 자료로만 활용됩니다.
                </span>
              </p>
            </div>
          </div>

          {/* 전문가 메시지 */}
          <div className="rounded-2xl border border-[#f97316]/30 bg-gradient-to-br from-[#f97316]/5 to-transparent p-8">
            <div className="flex flex-col items-center gap-6 md:flex-row">
              <div className="flex-shrink-0">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f97316]/20 text-4xl">
                  👨‍⚕️
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="mb-2 text-sm font-semibold text-[#f97316]">전문가 메시지</p>
                <p className="text-lg leading-relaxed text-slate-200">
                  "체형 불균형은 하루아침에 생기지 않습니다.
                  <br />
                  작은 습관의 누적이 만든 결과이기에, 올바른 방향으로의 작은 변화가 큰 개선을 만들어냅니다."
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  - NASM-CES 교정운동 전문가 | 10년+ 경력
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 진행 방식 & 교정 시스템 섹션 */}
        <section className="relative z-10 mt-24 space-y-8">
          <div className="flex flex-wrap justify-center gap-4">
            {/* 진행 방식 보기 버튼 */}
            <button
              onClick={() => {
                setShowProcess(!showProcess);
                setShowCorrectionSystem(false);
              }}
              className="rounded-full border border-slate-700 bg-slate-900/50 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-[#f97316] hover:text-[#f97316]"
            >
              {showProcess ? '진행 방식 접기 ▲' : '진행 방식 보기 ▼'}
            </button>

            {/* 교정 시스템 보기 버튼 */}
            <button
              onClick={() => {
                setShowCorrectionSystem(!showCorrectionSystem);
                setShowProcess(false);
              }}
              className="rounded-full border border-slate-700 bg-slate-900/50 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-[#f97316] hover:text-[#f97316]"
            >
              {showCorrectionSystem ? '교정 시스템 접기 ▲' : '교정 시스템 보기 ▼'}
            </button>
          </div>

          {/* 진행 방식 내용 */}
          {showProcess && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
              <h3 className="mb-6 text-2xl font-bold text-slate-100">진행 방식</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white font-bold">1</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">사진 업로드</h4>
                    <p className="text-sm text-slate-400">정면/측면 전신 사진 2장</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white font-bold">2</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">간단한 설문</h4>
                    <p className="text-sm text-slate-400">생활습관, 운동 경험 등</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white font-bold">3</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">전문가 분석</h4>
                    <p className="text-sm text-slate-400">체형 경향 및 운동 방향 확인</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white font-bold">4</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">맞춤 가이드 전달</h4>
                    <p className="text-sm text-slate-400">24시간 내 PDF 리포트 발송</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 교정 시스템 내용 */}
          {showCorrectionSystem && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
              <h3 className="mb-6 text-2xl font-bold text-slate-100">NASM 기반 4단계 교정 시스템</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 font-bold">1</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">억제 (Inhibit)</h4>
                    <p className="text-sm text-slate-400">과긴장 근육 이완</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 font-bold">2</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">신장 (Lengthen)</h4>
                    <p className="text-sm text-slate-400">단축 근육 스트레칭</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 font-bold">3</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">활성화 (Activate)</h4>
                    <p className="text-sm text-slate-400">약화 근육 강화</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 font-bold">4</div>
                  <div>
                    <h4 className="font-semibold text-slate-100">통합 (Integrate)</h4>
                    <p className="text-sm text-slate-400">일상 동작 적용</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 가격 플랜 섹션 */}
        <section className="relative z-10 mt-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">
              3단계 전략으로 시작하세요
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              당신에게 맞는 플랜을 선택하세요
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* BASIC 플랜 */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-100">BASIC</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#f97316]">1.9만원</span>
                  <span className="text-slate-400">/ 1회</span>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>사진 2장 기반 전문가 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>상세 체형 리포트 PDF</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>맞춤 운동 가이드</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 block rounded-lg bg-slate-800 py-3 text-center font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                선택하기
              </Link>
            </div>

            {/* STANDARD 플랜 - Best Value */}
            <div className="relative rounded-2xl border-2 border-[#f97316] bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-[0_0_40px_rgba(249,115,22,0.3)]">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-4 py-1 text-xs font-bold text-white">
                  Best Value
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-100">STANDARD</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#f97316]">4.9만원</span>
                  <span className="text-slate-400">/ 1회</span>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>BASIC 플랜 모든 구성</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-semibold text-[#f97316]">전문가 운동 수행 영상 피드백 1회</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-semibold text-[#f97316]">주간 체크리스트 PDF</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 block rounded-lg bg-gradient-to-r from-[#f97316] to-[#fb923c] py-3 text-center font-bold text-white shadow-lg transition hover:shadow-xl"
              >
                선택하기
              </Link>
            </div>

            {/* PREMIUM 플랜 */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-100">PREMIUM</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#f97316]">15만원</span>
                  <span className="text-slate-400">/ 월</span>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>STANDARD 플랜 모든 구성</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-semibold text-purple-400">1:1 전담 코칭</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-semibold text-purple-400">카톡 실시간 관리</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>주 2회 영상 피드백</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 block rounded-lg bg-slate-800 py-3 text-center font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                선택하기
              </Link>
            </div>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="relative z-10 mt-24 border-t border-slate-800 pt-12">
          <div className="grid gap-8 md:grid-cols-3">
            {/* 회사 정보 */}
            <div>
              <h4 className="mb-4 text-lg font-bold text-slate-100">PostureLab</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                NASM-CES 기반 교정운동 전문가가 운영하는
                온라인 체형 분석 및 운동 가이드 서비스
              </p>
            </div>

            {/* 링크 */}
            <div>
              <h4 className="mb-4 text-lg font-bold text-slate-100">서비스</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/free-survey" className="hover:text-[#f97316]">
                    무료 체크
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-[#f97316]">
                    가격 안내
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-[#f97316]">
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-[#f97316]">
                    개인정보처리방침
                  </Link>
                </li>
              </ul>
            </div>

            {/* 문의 */}
            <div>
              <h4 className="mb-4 text-lg font-bold text-slate-100">문의</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>이메일: support@posturelab.com</li>
                <li>운영시간: 평일 10:00 - 18:00</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            <p>© 2026 PostureLab. All rights reserved.</p>
            <p className="mt-2">
              ⚠️ 본 서비스는 의료 행위가 아니며, 운동 가이드 목적으로만 제공됩니다.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
