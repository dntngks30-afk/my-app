'use client';

/**
 * Public 메인 랜딩 페이지
 * 모바일 우선 100svh 풀스크린 story-style.
 * 설문형/동작형 CTA 클릭 시 localStorage 저장 후 /intro/welcome으로 이동.
 */

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';

const FUNNEL_KEY = 'moveRePublicFunnel:v1';
type EntryMode = 'survey' | 'camera';

function saveEntryMode(mode: EntryMode) {
  if (typeof window === 'undefined') return;
  try {
    const data = { entryMode: mode };
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export default function LandingPage() {
  const router = useRouter();

  const handleCta = (mode: EntryMode) => {
    saveEntryMode(mode);
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
                className="text-slate-400 text-sm md:text-base font-medium tracking-wide"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                AI가 분석하는 정밀 체형 및 움직임 밸런스 측정
              </p>
            </div>
          </div>

          <p
            className="text-slate-400 text-sm font-medium mt-2 mb-4"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            분석을 시작할 방식을 선택해주세요.
          </p>

          {/* 2-CTA cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
            <button
              type="button"
              onClick={() => handleCta('survey')}
              className="group relative flex flex-col items-start justify-center gap-1 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#ff7b00]/50 hover:bg-white/10 transition-all duration-300 min-h-[100px] text-left focus:outline-none focus:ring-2 focus:ring-[#ff7b00] focus:ring-offset-2 focus:ring-offset-[#0d161f]"
              aria-label="설문형 - 생활습관 추적 분석으로 시작"
            >
              <span className="text-[#ff7b00] text-xs font-bold uppercase tracking-wider">
                설문형
              </span>
              <span className="text-white text-lg font-bold">생활습관 추적 분석</span>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-slate-500 group-hover:text-slate-400" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => handleCta('camera')}
              className="group relative flex flex-col items-start justify-center gap-1 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#ff7b00]/50 hover:bg-white/10 transition-all duration-300 min-h-[100px] text-left focus:outline-none focus:ring-2 focus:ring-[#ff7b00] focus:ring-offset-2 focus:ring-offset-[#0d161f]"
              aria-label="동작형 - AI기반 카메라 분석으로 시작"
            >
              <span className="text-[#ff7b00] text-xs font-bold uppercase tracking-wider">
                동작형
              </span>
              <span className="text-white text-lg font-bold">AI기반 카메라 분석</span>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-slate-500 group-hover:text-slate-400" aria-hidden />
            </button>
          </div>

          <p
            className="text-slate-500 text-[11px] font-medium mt-6"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            Professional Motion Intelligence Engine
          </p>
        </div>
      </main>
    </div>
  );
}
