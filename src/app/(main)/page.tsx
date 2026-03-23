'use client';

/**
 * Public 메인 랜딩 페이지
 * PR-PUBLIC-ENTRY-02 — 단일 primary CTA → intro funnel → 설문 baseline.
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md + public-brand primitives
 */

import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { FUNNEL_KEY } from '@/lib/public/intro-funnel';
import {
  MoveReFullscreenScreen,
  MoveReHeroBlock,
  MoveRePrimaryCTA,
} from '@/components/public-brand';

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
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="flex w-full max-w-3xl flex-col items-center gap-6 md:gap-8">
          <MoveReHeroBlock
            eyebrow="Movement Type Analysis"
            title={
              <div className="flex flex-col items-center">
                <h1 className="mr-public-brand-serif text-5xl font-black leading-tight text-slate-100 md:text-7xl">
                  Move Re
                </h1>
                <div className="mt-4 space-y-2 md:space-y-3 md:mt-6">
                  <p className="text-xl font-bold text-slate-100 md:text-2xl" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    당신의 움직임은 안녕하신가요?
                  </p>
                  <p
                    className="text-sm font-medium tracking-wide text-slate-400 break-keep md:text-base"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    짧은 체크로 패턴을 정리하고, 실행까지 이어질 수 있게 도와드려요
                  </p>
                </div>
              </div>
            }
            showAccentDivider
            subtitle={null}
          />

          <div className="w-full max-w-md space-y-3 pt-2">
            <MoveRePrimaryCTA
              onClick={handleStart}
              className="min-h-[56px] text-base md:text-lg"
              aria-label="내 몸 상태 1분 체크하기 — 설문으로 시작"
            >
              내 몸 상태 1분 체크하기
            </MoveRePrimaryCTA>
            <p
              className="text-center text-[11px] font-medium leading-relaxed text-slate-500 break-keep md:text-sm"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              짧은 질문으로 시작해요. 원하시면 결과를 보기 직전에 짧은 동작 확인을 더할 수 있어요.
            </p>
          </div>

          <p
            className="mt-4 text-[11px] font-medium text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            Professional Motion Intelligence Engine
          </p>
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
