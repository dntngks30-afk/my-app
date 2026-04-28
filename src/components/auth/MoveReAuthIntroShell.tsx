'use client';

/**
 * IntroSceneShell의 시각 레이어만 복제 (noise / star tiles / 중앙 copper glow).
 * intro step·navigation·intro-funnel 경로 로직 없음 — auth 전용.
 * @see src/components/stitch/intro/IntroSceneShell.tsx (배경부만 정렬)
 */
import { cn } from '@/lib/utils';

export interface MoveReAuthIntroShellProps {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
}

export function MoveReAuthIntroShell({
  children,
  className,
  mainClassName,
}: MoveReAuthIntroShellProps) {
  return (
    <div className={cn('relative min-h-[100svh] overflow-hidden bg-[#0c1324] text-[#dce1fb]', className)}>
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
            'public-chapter-content-default flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:px-11',
            mainClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
