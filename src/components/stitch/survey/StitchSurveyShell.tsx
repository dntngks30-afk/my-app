'use client';

/**
 * movement-test survey 풀스크린 씬 — landing / intro와 동일 navy·cosmic·copper family
 * @see stitch_analysis_selection (3) code.html, DESIGN.md
 */
import { ChevronLeft } from 'lucide-react';

export type StitchSurveyShellProps = {
  /** 0-based 현재 문항 인덱스 */
  currentIndex: number;
  total: number;
  showBack: boolean;
  onBack: () => void;
  /** 세션 준비 전 배경만 표시 */
  loading?: boolean;
  children?: React.ReactNode;
};

/** intro StitchLanding / IntroSceneShell과 동일한 레이어 */
function SurveySceneBackdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 40px 70px, #ffb77d, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 50px 160px, #dce1fb, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 90px 40px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, #ffb77d, rgba(0,0,0,0))
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '250px 250px',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1]">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#ffb77d]/5 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#fcb973]/5 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[68vw] w-[68vw] max-h-[780px] max-w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffb77d]/6 blur-[140px]" />
      </div>
    </>
  );
}

export function StitchSurveyShell({
  currentIndex,
  total,
  showBack,
  onBack,
  loading,
  children,
}: StitchSurveyShellProps) {
  const displayNum = String(currentIndex + 1).padStart(2, '0');
  const pct = Math.min(100, ((currentIndex + 1) / total) * 100);

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#0c1324] text-[#dce1fb]">
      <SurveySceneBackdrop />

      {loading ? (
        <div className="relative z-10 flex min-h-[100svh] items-center justify-center">
          <p className="text-sm text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            로딩 중...
          </p>
        </div>
      ) : (
        <div className="relative z-10 flex min-h-[100svh] flex-col">
          <header className="fixed inset-x-0 top-0 z-50 mx-auto flex w-full max-w-screen-2xl items-center justify-start bg-transparent px-6 py-6 md:px-8">
            <div className="flex min-w-0 items-center gap-4">
              {showBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex size-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-slate-400/80 transition-colors duration-500 hover:bg-white/5 hover:text-[#ffb68e]"
                  aria-label="이전"
                >
                  <ChevronLeft className="size-6" strokeWidth={1.5} />
                </button>
              ) : null}
            </div>
          </header>

          <main className="public-chapter-content-light flex min-h-0 flex-1 flex-col overflow-hidden pt-[5.5rem] pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)]">
            {children}
          </main>

          <div
            role="progressbar"
            aria-label={`설문 진행 ${currentIndex + 1}번째, 전체 ${total}문항`}
            aria-valuenow={currentIndex + 1}
            aria-valuemin={1}
            aria-valuemax={total}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px)+0.75rem)] pt-6"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="text-[10px] font-light uppercase tracking-[0.2em] text-slate-500"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                Progress
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-lg tracking-widest text-[#ffb77d] [font-family:var(--font-display)]">
                  {displayNum}{' '}
                  <span className="text-sm italic text-slate-600">/ {total}</span>
                </span>
                <div className="h-0.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#2e3447]/30">
                  <div className="h-full bg-[#ffb77d] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
