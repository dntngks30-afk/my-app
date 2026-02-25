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
  const from = searchParams.get('from') ?? '/app';
  const [modalOpen, setModalOpen] = useState(false);
  const { isStandalone } = usePwaInstall();

  const handleContinue = () => {
    router.push(from);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-8">
          {/* 상태 배지 (PR-C) */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: isStandalone ? 'var(--brand)' : 'var(--surface-2)',
              color: isStandalone ? 'white' : 'var(--muted)',
            }}
          >
            {isStandalone ? '설치됨 (앱 모드)' : '브라우저 모드'}
          </div>

          <div>
            <h1 className="text-xl font-bold text-[var(--text)] mb-2">
              앱으로 설치하기
            </h1>
            <p className="text-sm text-[var(--muted)]">
              설치 후 홈 화면 아이콘으로 실행해 주세요.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 w-full rounded-lg bg-[var(--brand)] py-4 text-center text-base font-semibold text-white"
            >
              설치하기
            </button>
          </div>

          <div className="space-y-6 text-sm">
            <section>
              <h2 className="font-semibold text-[var(--text)] mb-2">
                Android (Chrome)
              </h2>
              <p className="text-[var(--muted)] leading-relaxed">
                Chrome 주소창 오른쪽 메뉴(⋮) → &quot;앱에 추가&quot; 또는
                &quot;홈 화면에 추가&quot;를 선택하세요.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-[var(--text)] mb-2">
                iOS (Safari)
              </h2>
              <p className="text-[var(--muted)] leading-relaxed">
                Safari에서 공유 버튼(□↑) → &quot;홈 화면에 추가&quot;를 선택하세요.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-[var(--text)] mb-2">
                인앱 브라우저 (카카오톡·인스타그램 등)
              </h2>
              <p className="text-[var(--muted)] leading-relaxed">
                카카오톡, 인스타그램 등 앱 안에서 열린 브라우저에서는 설치가
                제한될 수 있습니다. Safari 또는 Chrome으로 주소를 복사한 뒤
                해당 브라우저에서 열어 설치해 주세요.
              </p>
            </section>
          </div>

          {/* 다음 행동 CTA (PR-C, 클릭 기반) */}
          <div className="pt-4 space-y-3">
            {isStandalone ? (
              <>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="block w-full rounded-lg bg-[var(--brand)] py-4 text-center text-base font-semibold text-white"
                >
                  앱에서 계속하기
                </button>
                <p className="text-xs text-[var(--muted)] text-center">
                  홈 화면 아이콘으로 실행 중
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={handleContinue}
                className="block w-full rounded-lg bg-[var(--brand)] py-4 text-center text-base font-semibold text-white"
              >
                /app에서 계속하기
              </button>
            )}
            <button
              type="button"
              onClick={handleContinue}
              className="block w-full rounded-lg border border-[var(--border)] py-3 text-center text-sm font-medium"
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
