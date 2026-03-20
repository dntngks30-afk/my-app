'use client';

/**
 * Public 메인 랜딩 페이지
 * PR-PUBLIC-ENTRY-02 — 단일 primary CTA → intro funnel → 설문 baseline.
 * 카메라는 첫 화면 동등 선택이 아니라 refine-bridge 이후 optional 경로로만 유지.
 */

import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { FUNNEL_KEY } from '@/lib/public/intro-funnel';

function saveSurveyEntryMode() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FUNNEL_KEY, JSON.stringify({ entryMode: 'survey' as const }));
  } catch {
    // ignore
  }
}

export default function LandingPage() {
  const router = useRouter();

  const handleStart = () => {
    saveSurveyEntryMode();
    router.push('/intro/welcome');
  };

  return (
    <div className="relative min-h-[100svh] bg-[#0d161f] text-slate-100 overflow-hidden flex flex-col">
      <Starfield />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="max-w-3xl w-full text-center flex flex-col items-center gap-6 md:gap-8">
          <div className="flex flex-col items-center">
            <span
              className="text-[#ff7b00] text-xs font-black tracking-[0.2em] uppercase mb-2 block"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              Movement Type Analysis
            </span>
            <h1
              className="text-5xl md:text-7xl font-black leading-tight mb-2 text-slate-100"
              style={{ fontFamily: 'var(--font-serif-noto)' }}
            >
              Move Re
            </h1>
            <div className="w-12 h-1 bg-[#ff7b00] rounded-full my-4 md:my-6 opacity-80" aria-hidden />
            <div className="space-y-2 md:space-y-3">
              <p
                className="text-xl md:text-2xl font-bold text-slate-100"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                당신의 움직임은 안녕하신가요?
              </p>
              <p
                className="text-slate-400 text-sm md:text-base font-medium tracking-wide break-keep"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                짧은 체크로 패턴을 정리하고, 실행까지 이어질 수 있게 도와드려요
              </p>
            </div>
          </div>

          {/* 단일 primary CTA — 설문 baseline이 기본 경로 */}
          <div className="w-full max-w-md space-y-3 pt-2">
            <button
              type="button"
              onClick={handleStart}
              className="w-full min-h-[56px] rounded-2xl font-bold text-slate-900 bg-[#ff7b00] hover:bg-[#ff8f26] transition-colors text-base md:text-lg shadow-lg shadow-black/25 focus:outline-none focus:ring-2 focus:ring-[#ff7b00] focus:ring-offset-2 focus:ring-offset-[#0d161f]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
              aria-label="내 몸 상태 1분 체크하기 — 설문으로 시작"
            >
              내 몸 상태 1분 체크하기
            </button>
            <p
              className="text-slate-500 text-xs md:text-sm font-medium break-keep leading-relaxed"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              짧은 질문으로 시작해요. 원하시면 결과를 보기 직전에 짧은 동작 확인을 더할 수 있어요.
            </p>
          </div>

          <p
            className="text-slate-500 text-[11px] font-medium mt-4"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            Professional Motion Intelligence Engine
          </p>
        </div>
      </main>
    </div>
  );
}
