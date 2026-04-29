'use client';

const BOOT_FLAG = 'move-re-app-booted';

export function setAppBooted(): void {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(BOOT_FLAG, '1');
    } catch {
      /* ignore */
    }
  }
}

export function isAppBooted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(BOOT_FLAG) === '1';
  } catch {
    return false;
  }
}

interface AppEntryLoaderProps {
  /** aria-live용 보조 문구 */
  status?: string;
}

export default function AppEntryLoader({ status = '로딩 중' }: AppEntryLoaderProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0c1324] px-6 text-[#dce1fb]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* subtle cosmic — StitchSceneShell / postpay 계열 톤 정렬 */}
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
        className="pointer-events-none fixed inset-0 z-0 opacity-15"
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
        <div className="absolute left-1/2 top-1/2 h-[min(420px,85vw)] w-[min(420px,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#ffb77d_0%,rgba(255,183,125,0)_68%)] opacity-25 blur-[72px]" />
      </div>

      <div className="relative z-10 flex max-w-[19rem] flex-col items-center text-center">
        <div className="relative mb-8 flex justify-center">
          <div
            aria-hidden
            className="absolute inset-[-6px] rounded-full bg-[radial-gradient(circle,rgba(255,183,125,0.35)_0%,transparent_70%)] opacity-70 blur-[8px]"
          />
          <div
            className="relative h-10 w-10 rounded-full border-2 border-white/20 border-t-[#ffb77d] app-entry-spinner shadow-[0_0_20px_rgba(255,183,125,0.15)]"
            aria-hidden
          />
        </div>

        <p
          className="text-base font-medium text-[#dce1fb]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          리셋맵을 여는 중이에요
        </p>
        <p
          className="mt-3 text-[13px] font-light leading-snug text-[#c6c6cd]/80"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          오늘의 세션을 불러오고 있어요
        </p>

        {status ? <span className="sr-only">{status}</span> : null}
      </div>
    </div>
  );
}
