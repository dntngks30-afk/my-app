'use client';

/**
 * PWA 설치 안내 페이지 (PR-A + PR-B + PR-C)
 * 자동 리다이렉트 없음. 클릭 기반 CTA만.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppTopBar from '../_components/AppTopBar';
import PwaInstallModal from '@/components/pwa/PwaInstallModal';
import { usePwaInstall } from '@/lib/pwa/usePwaInstall';

export default function InstallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/app/home';
  const [modalOpen, setModalOpen] = useState(false);
  const { isStandalone } = usePwaInstall();

  const handleContinue = () => {
    router.push(from);
  };

  const nbBtnPrimary = 'block w-full rounded-full border-2 border-slate-900 bg-slate-800 py-4 text-center text-base font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';
  const nbBtnSecondary = 'block w-full rounded-full border-2 border-slate-900 bg-white py-3 text-center text-sm font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
            isStandalone
              ? 'bg-slate-800 text-white'
              : 'border-2 border-slate-300 bg-white text-stone-600'
          }`}>
            {isStandalone ? '설치됨 (앱 모드)' : '브라우저 모드'}
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">
              앱으로 설치하기
            </h1>
            <p className="text-sm text-stone-600">
              설치 후 홈 화면 아이콘으로 실행해 주세요.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 w-full rounded-full border-2 border-slate-900 bg-slate-800 py-4 text-center text-base font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
            >
              설치 방법 보기
            </button>
          </div>

          <p className="text-sm text-stone-600">
            설치 방법은 상단 버튼으로 가이드 확인
          </p>

          <div className="pt-4 space-y-3">
            {isStandalone ? (
              <>
                <button
                  type="button"
                  onClick={handleContinue}
                  className={nbBtnPrimary}
                >
                  앱에서 계속하기
                </button>
                <p className="text-xs text-stone-500 text-center">
                  홈 화면 아이콘으로 실행 중
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={handleContinue}
                className={nbBtnPrimary}
              >
                /app에서 계속하기
              </button>
            )}
            <button
              type="button"
              onClick={handleContinue}
              className={nbBtnSecondary}
            >
              이전 화면으로 돌아가기
            </button>
          </div>
        </div>
      </main>
      <PwaInstallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        context="installPage"
      />
    </div>
  );
}
