'use client';

/**
 * Public 메인 랜딩 페이지
 * 시안: 딥 네이비 배경, 별 배경, Move Re 히어로, 설문형/동작형 2-CTA
 * presentation = 시안 / behavior = 기존 route 연결
 */

import Link from 'next/link';
import { User } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#0d161f] text-slate-100 overflow-x-hidden">
      <Starfield />

      <main className="relative z-10 flex-1">
        <section className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-20">
          <div className="max-w-3xl w-full text-center flex flex-col items-center gap-8">
            {/* Profile placeholder */}
            <div className="mb-2">
              <div className="size-24 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20">
                <User className="size-12 text-white/80" strokeWidth={1.5} aria-hidden />
              </div>
            </div>

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
              <div className="w-12 h-1 bg-[#ff7b00] rounded-full my-6 opacity-80" aria-hidden />
              <div className="space-y-3">
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
              className="text-[#ff7b00] text-sm font-bold tracking-widest uppercase mt-10 mb-8"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              분석을 시작할 방식을 선택해주세요.
            </p>

            {/* 2-CTA cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
              <Link
                href="/movement-test/survey"
                className="group flex flex-col items-center justify-center gap-2 p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-[#ff7b00]/50 hover:bg-white/10 transition-all duration-300 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#ff7b00] focus:ring-offset-2 focus:ring-offset-[#0d161f]"
                aria-label="설문형 - 생활습관 추적 분석으로 시작"
              >
                <span className="text-white text-xl font-bold">설문형</span>
                <span className="text-slate-500 text-xs group-hover:text-slate-400">
                  생활습관 추적 분석
                </span>
              </Link>
              <Link
                href="/deep-test/run"
                className="group flex flex-col items-center justify-center gap-2 p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-[#ff7b00]/50 hover:bg-white/10 transition-all duration-300 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#ff7b00] focus:ring-offset-2 focus:ring-offset-[#0d161f]"
                aria-label="동작형 - AI기반 카메라 분석으로 시작"
              >
                <span className="text-white text-xl font-bold">동작형</span>
                <span className="text-slate-500 text-xs group-hover:text-slate-400">
                  AI기반 카메라 분석
                </span>
              </Link>
            </div>

            <p
              className="text-slate-500 text-[11px] font-medium mt-8"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              규칙형 알고리즘 기반 움직임 분석 · 소요시간 약 3분
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
