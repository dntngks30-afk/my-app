'use client';

/**
 * intro 6장 공용 풀스크린 씬 — StitchLanding과 동일 navy / cosmic / copper family
 * @see stitch_analysis_selection code.html
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getNextPath, getPrevPath, TOTAL_STEPS } from '@/lib/public/intro-funnel';
import { cn } from '@/lib/utils';

export type IntroNavVariant = 'next-only' | 'prev-next' | 'hidden';

export type IntroSceneShellProps = {
  currentPath: string;
  children: React.ReactNode;
  /** 미지정 시 currentPath로 자동: welcome → next-only, profile → hidden, 나머지 prev-next */
  navVariant?: IntroNavVariant;
  /** `<main>`에 병합 (예: 프로필 전용 세로 패딩) */
  mainClassName?: string;
};

function resolveNavVariant(path: string, explicit?: IntroNavVariant): IntroNavVariant {
  if (explicit) return explicit;
  if (path === '/intro/welcome') return 'next-only';
  if (path === '/intro/profile') return 'hidden';
  return 'prev-next';
}

/** Step n/N + 얇은 진행 막대 (통일된 chapter 느낌) */
export function IntroStepIndicator({ step }: { step: number }) {
  const pct = (step / TOTAL_STEPS) * 100;
  return (
    <div className="flex flex-col items-center gap-2 opacity-40">
      <span
        className="text-xs uppercase tracking-widest text-slate-300"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        Step {step}/{TOTAL_STEPS}
      </span>
      <div className="h-px w-32 overflow-hidden bg-[#2e3447]">
        <div className="h-full bg-[#ffb77d]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function IntroSceneShell({ currentPath, children, navVariant, mainClassName }: IntroSceneShellProps) {
  const router = useRouter();
  const variant = resolveNavVariant(currentPath, navVariant);
  const prevPath = getPrevPath(currentPath);
  const nextPath = getNextPath(currentPath);

  useEffect(() => {
    if (nextPath) router.prefetch(nextPath);
    if (prevPath) router.prefetch(prevPath);
  }, [router, nextPath, prevPath]);

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#0c1324] text-[#dce1fb]">
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

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
        <div className="absolute left-1/2 top-1/2 h-[68vw] w-[68vw] max-h-[780px] max-w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffb77d]/6 blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <main
          className={cn(
            'public-chapter-content-default flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 md:px-11',
            mainClassName,
          )}
        >
          {children}
        </main>

        {variant !== 'hidden' ? (
          <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center px-8 py-10 md:px-12">
            {variant === 'prev-next' && prevPath ? (
              <div className="flex w-full items-center justify-between">
                <Link
                  href={prevPath}
                  className="group flex items-center gap-2 text-slate-500/80 transition-colors hover:text-[#fcb973]"
                  aria-label="이전"
                >
                  <ChevronLeft className="size-5 shrink-0" strokeWidth={1.5} />
                  <span
                    className="text-xs font-light uppercase tracking-[0.2em]"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    이전
                  </span>
                </Link>
                {nextPath ? (
                  <Link
                    href={nextPath}
                    className="group flex items-center gap-2 font-medium text-[#ffb77d] transition-all duration-300 hover:-translate-y-0.5"
                    aria-label="다음"
                  >
                    <span
                      className="text-xs font-light uppercase tracking-[0.2em]"
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      다음
                    </span>
                    <ChevronRight className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} />
                  </Link>
                ) : (
                  <span className="w-16" aria-hidden />
                )}
              </div>
            ) : (
              <div className="flex w-full justify-end">
                {nextPath ? (
                  <Link
                    href={nextPath}
                    className="group flex items-center gap-2 font-medium text-[#ffb77d] transition-all duration-300 hover:-translate-y-0.5"
                    aria-label="다음"
                  >
                    <span
                      className="text-xs font-light uppercase tracking-[0.2em]"
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      다음
                    </span>
                    <ChevronRight className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} />
                  </Link>
                ) : null}
              </div>
            )}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
