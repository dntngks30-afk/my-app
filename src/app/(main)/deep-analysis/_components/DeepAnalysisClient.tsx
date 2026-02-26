'use client';

/**
 * 심층분석 랜딩 (Client)
 * useSearchParams로 pay=1 감지 → 모달 표시
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PayModal from './PayModal';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';

function IconPerson() {
  return (
    <svg className="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
    </svg>
  );
}

function IconInsights() {
  return (
    <svg className="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-6 h-6 flex-shrink-0 text-orange-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="w-3.5 h-3.5 inline align-middle mr-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
    </svg>
  );
}

export default function DeepAnalysisClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  const payOpen = searchParams.get('pay') === '1';
  const returnUrl = `${pathname || '/deep-analysis'}?pay=1`;

  const closeModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('pay');
    const qs = params.toString();
    router.replace(`${pathname || '/deep-analysis'}${qs ? '?' + qs : ''}`);
  };

  useEffect(() => {
    const check = async () => {
      await supabase.auth.getSession();
      setLoading(false);
    };
    check();
  }, []);

  const handleCtaClick = () => {
    const nextPath = `${pathname || '/deep-analysis'}?pay=1`;
    router.push(nextPath);
  };

  return (
    <div className="relative overflow-hidden bg-[#F8F6F0]">
      <PayModal isOpen={payOpen} onClose={closeModal} returnUrl={returnUrl} />

      <NeoPageLayout maxWidth="lg">
        {/* Hero */}
        <section className="pt-12 pb-12 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border-2 border-slate-900 bg-orange-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            PREMIUM PROGRAM
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 tracking-tight leading-tight">
            심층 분석 프로그램
          </h1>
          <p className="text-xl md:text-2xl text-slate-700 font-medium mb-4">
            7일 동안 움직임을 재설계합니다.
          </p>
          <p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed">
            단순 운동이 아닌, 분석 기반 리셋 프로그램으로
            <br />
            당신의 숨은 가동성을 찾아보세요.
          </p>
        </section>

        {/* 3 STEP Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NeoCard className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl border-2 border-slate-900 bg-orange-50 flex items-center justify-center mb-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
              <IconPerson />
            </div>
            <div className="text-orange-600 text-xs font-bold mb-2 tracking-widest uppercase">Step 01</div>
            <h3 className="text-xl font-bold mb-3 text-slate-800">움직임 정밀 체크</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              전문적인 바디 스캔 기술을 통해
              <br />
              현재 신체 상태를 정밀 분석합니다.
            </p>
          </NeoCard>
          <NeoCard className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl border-2 border-slate-900 bg-orange-50 flex items-center justify-center mb-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
              <IconPlay />
            </div>
            <div className="text-orange-600 text-xs font-bold mb-2 tracking-widest uppercase">Step 02</div>
            <h3 className="text-xl font-bold mb-3 text-slate-800">7일 맞춤 루틴</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              분석 결과를 바탕으로 설계된
              <br />
              나만을 위한 최적의 데일리 루틴.
            </p>
          </NeoCard>
          <NeoCard className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl border-2 border-slate-900 bg-orange-50 flex items-center justify-center mb-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
              <IconInsights />
            </div>
            <div className="text-orange-600 text-xs font-bold mb-2 tracking-widest uppercase">Step 03</div>
            <h3 className="text-xl font-bold mb-3 text-slate-800">변화 리포트 제공</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              7일 후 시각화된 변화 리포트로
              <br />
              개선된 움직임을 직접 확인하세요.
            </p>
          </NeoCard>
        </section>

        {/* 프로그램 상세 구성 */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center text-slate-800">
            프로그램 상세 구성
          </h2>
          <NeoCard className="p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <IconCheck />
                  <div>
                    <h4 className="font-bold mb-1 text-slate-800">하루 5~10분 루틴</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      바쁜 일상 속에서도 부담 없이 실천할 수 있는 효율적인 코스
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <IconCheck />
                  <div>
                    <h4 className="font-bold mb-1 text-slate-800">통증/가동성 체크 기록</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      매일의 신체 변화를 기록하고 변화 과정을 추적합니다.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <IconCheck />
                  <div>
                    <h4 className="font-bold mb-1 text-slate-800">전문 코치 코멘트</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      데이터 기반의 정확한 피드백으로 올바른 방향을 제시합니다.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <IconCheck />
                  <div>
                    <h4 className="font-bold mb-1 text-slate-800">평생 소장 리포트</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      프로그램 종료 후에도 지속 가능한 관리법을 담은 리포트 제공
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </NeoCard>
        </section>

        {/* CTA */}
        <section className="pb-16 text-center">
          <div className="mb-8 p-6 rounded-2xl border-2 border-slate-900 bg-orange-50 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <p className="text-slate-700 mb-1">지금 시작하면 7일 뒤 당신은</p>
            <p className="text-xl font-bold text-orange-600">
              더 가볍고 유연한 움직임
            </p>
            <p className="text-slate-700">을 가질 수 있습니다.</p>
          </div>
          <NeoButton
            variant="orange"
            onClick={handleCtaClick}
            disabled={loading}
            className="w-full py-5 text-lg flex items-center justify-center gap-2"
          >
            7일 심층 분석 시작하기
            <IconArrow />
          </NeoButton>
          <p className="mt-4 text-sm text-slate-600">
            <IconLock />
            로그인 후 결제가 진행됩니다.
          </p>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t-2 border-slate-900 bg-white">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-slate-600 text-sm">
              © 2024 PostureLab. All rights reserved.
            </div>
            <div className="flex gap-8 text-sm text-slate-600">
              <Link href="#" className="hover:text-orange-600 transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-orange-600 font-semibold transition-colors">
                개인정보처리방침
              </Link>
              <Link href="#" className="hover:text-orange-600 transition-colors">
                고객센터
              </Link>
            </div>
          </div>
        </footer>
      </NeoPageLayout>
    </div>
  );
}
