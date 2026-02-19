'use client';

/**
 * 메인 페이지 (16Personalities 스타일)
 *
 * Hero + 카드 4개. 설문은 /movement-test/survey 직행.
 */

import { useRouter } from 'next/navigation';

/** 카드 4개 섹션 일시 숨김. true로 변경 시 즉시 복구 */
const SHOW_HOME_CARDS = false;

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Hero 섹션 */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1
              className="text-4xl md:text-5xl font-bold text-[var(--text)] mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              무료 움직임 테스트
            </h1>
            <p className="text-lg md:text-xl text-[var(--muted)] mb-12">
              내 움직임 습관을 빠르게 확인하고 오늘 바로 고칠 루틴까지
            </p>
            <button
              type="button"
              onClick={() => router.push('/movement-test/survey')}
              className="
                inline-flex items-center justify-center
                rounded-[var(--radius)]
                bg-[var(--brand)] text-white
                px-8 py-4
                font-bold
                shadow-[var(--shadow-0)]
                transition-all duration-200
                hover:opacity-95
              "
            >
              테스트 시작
            </button>
          </div>
        </div>
      </section>

      {SHOW_HOME_CARDS ? (
        <section className="pb-12">
  <div className="container mx-auto px-4">
    {/* max-w-6xl → 7xl 로 넓혀서 데스크톱에서 더 시원하게 */}
    <div className="max-w-7xl mx-auto">
      {/* gap도 데스크톱에서 키우면 “덩치 큰 느낌”이 확 남 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {/* 카드 공통 스타일 */}
        {[
          { icon: '⏱️', title: '1~2분 설문', desc: '간단한 질문으로 나의 움직임 패턴을 확인하세요' },
          { icon: '📊', title: '결과 즉시', desc: '테스트 완료 즉시 맞춤형 결과를 받아보세요' },
          { icon: '💪', title: '오늘 10분 루틴', desc: '바로 고칠 수 있는 맞춤형 운동 루틴을 제공합니다' },
          { icon: '🔬', title: '심층분석 (유료)', desc: '영상/사진 업로드 + 전문가 코멘트로 더 정확한 분석' },
        ].map((c) => (
          <div
            key={c.title}
            className="
              rounded-[var(--radius)]
              bg-[var(--surface)]
              border border-[color:var(--border)]
              shadow-[var(--shadow-0)]
              w-full
              p-5 sm:p-6 lg:p-10
              min-h-[160px] lg:min-h-[260px]
              flex flex-col
            "
          >
            <div className="text-3xl lg:text-4xl mb-3">{c.icon}</div>

            <h3 className="text-lg lg:text-xl font-semibold text-[var(--text)] mb-2">
              {c.title}
            </h3>

            <p className="text-sm lg:text-base leading-relaxed text-[var(--muted)]">
              {c.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>
      ) : null}

      {/* 하단 고지 */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs text-[var(--muted)]">
              ⚠️ 의학적 진단이 아닌 습관/성향 체크입니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
