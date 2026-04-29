'use client';

import Image from 'next/image';

const LOADING_COPIES = [
  '리셋맵을 여는 중이에요',
  '오늘의 세션을 확인하는 중',
];

interface BootSplashProps {
  /** 로딩 문구 (기본: 첫 번째) */
  copy?: string;
  /** aria-live 영역용 보조 문구 */
  status?: string;
}

export default function BootSplash({ copy = LOADING_COPIES[0], status }: BootSplashProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0c1324] px-6 text-[#dce1fb]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-12"
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
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1]">
        <div className="absolute left-1/2 top-1/3 h-[min(380px,80vw)] w-[min(380px,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#ffb77d_0%,rgba(255,183,125,0)_68%)] opacity-20 blur-[64px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Logo */}
        <div className="relative mb-6 animate-in fade-in" style={{ animationDuration: '500ms' }}>
          <div className="relative h-24 w-48 sm:h-28 sm:w-56">
            <Image
              src="/brand/move-re-icon-512.png"
              alt="MOVE RE"
              fill
              priority
              sizes="(max-width: 640px) 192px, 224px"
              className="object-contain"
            />
          </div>
        </div>

        {/* Wordmark */}
        <p
          className="mb-4 text-xl font-bold tracking-tight text-[#dce1fb] animate-in fade-in"
          style={{
            animationDuration: '500ms',
            animationDelay: '100ms',
            animationFillMode: 'both',
            fontFamily: 'var(--font-display)',
          }}
        >
          MOVE RE
        </p>

        {/* Loading copy */}
        <p
          className="max-w-[19rem] text-center text-sm font-light leading-relaxed text-[#c6c6cd]/90 animate-in fade-in"
          style={{ animationDuration: '500ms', animationDelay: '200ms', animationFillMode: 'both', fontFamily: 'var(--font-sans-noto)' }}
        >
          {copy}
        </p>

        {/* Shimmer bar */}
        <div
          className="mt-6 h-[3px] w-36 overflow-hidden rounded-full bg-[#2e3447]/35 animate-in fade-in"
          style={{ animationDuration: '500ms', animationDelay: '300ms', animationFillMode: 'both' }}
        >
          <div className="boot-shimmer h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#ffb77d]/55 to-transparent" />
        </div>

        {/* Screen reader status */}
        {status ? <span className="sr-only">{status}</span> : null}
      </div>
    </div>
  );
}
