'use client';

import MoveReAuthBackground from '@/components/auth/MoveReAuthBackground';

interface MoveReAuthScreenProps {
  /** 로그인/회원가입 헤드라인 */
  headline: string;
  subcopy?: string | null;
  children: React.ReactNode;
}

/**
 * MOVE RE auth 전용 레이아웃 — presentation만 (routing/auth 계약 없음).
 */
export default function MoveReAuthScreen({
  headline,
  subcopy,
  children,
}: MoveReAuthScreenProps) {
  return (
    <div
      className="relative min-h-[100svh] min-h-dvh overflow-x-hidden text-[#dce1fb]"
      style={{ fontFamily: 'var(--font-sans-noto), system-ui, sans-serif' }}
    >
      <MoveReAuthBackground />
      <main className="relative z-[1] mx-auto flex w-full max-w-[min(100%,440px)] flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-8 space-y-3 text-center">
          <p
            className="text-[1.125rem] font-semibold tracking-[0.18em] text-[#dce1fb]"
            style={{ fontFamily: 'var(--font-display-gowun), var(--font-sans-noto)' }}
          >
            MOVE RE
          </p>
          <h1 className="text-xl font-semibold leading-snug text-[#dce1fb] sm:text-2xl">
            {headline}
          </h1>
          {subcopy ? (
            <p className="text-sm leading-relaxed text-[#dce1fb]/80">{subcopy}</p>
          ) : null}
        </header>
        {children}
      </main>
    </div>
  );
}
