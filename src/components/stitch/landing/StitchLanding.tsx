'use client';

type StitchLandingProps = {
  onStart: () => void;
};

export default function StitchLanding({ onStart }: StitchLandingProps) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#0c1324] text-[#dce1fb]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[0] opacity-20"
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
        <div className="absolute left-1/2 top-1/2 h-[70vw] w-[70vw] max-h-[820px] max-w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffb77d]/6 blur-[140px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-20 mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-6 md:px-8">
        <div className="flex items-center gap-4">
          <span className="text-xl italic tracking-tighter text-[#ffb77d] [font-family:var(--font-display)]">
            Move Re
          </span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <span className="text-xs font-light uppercase tracking-[0.2em] text-slate-400/70">
            Methodology
          </span>
          <span className="text-xs font-light uppercase tracking-[0.2em] text-slate-400/70">
            Journal
          </span>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-3xl space-y-12">
          <div className="space-y-4">
            <span className="inline-block rounded-full border border-[#ffb77d]/20 px-4 py-1 text-[10px] uppercase tracking-[0.3em] text-[#ffb77d]">
              Movement Type Analysis
            </span>

            <h2 className="text-2xl tracking-widest text-[#ffb77d] md:text-3xl [font-family:var(--font-display)]">
              Move Re
            </h2>
          </div>

          <div className="space-y-6">
            <h1
              className="text-4xl font-bold leading-tight tracking-tight text-[#dce1fb] md:text-6xl"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              당신의 움직임은 안녕하신가요?
            </h1>

            <p
              className="mx-auto max-w-xl text-lg font-light leading-relaxed text-[#c6c6cd] md:text-xl"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              짧은 체크로 패턴을 정리하고,
              <br className="hidden md:block" />
              실행까지 이어질 수 있게 도와드려요
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 pt-8">
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex min-h-[64px] items-center justify-center rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] px-12 py-5 text-base font-semibold text-[#4d2600] shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition-all duration-500 hover:opacity-90 active:scale-[0.985] md:text-lg"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
              aria-label="내 몸 상태 1분 체크하기"
            >
              <span className="flex items-center gap-3">
                내 몸 상태 1분 체크하기
                <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
            </button>

            <p
              className="max-w-xs text-center text-xs leading-relaxed text-[#909097] opacity-80 md:text-[13px]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              짧은 질문으로 시작해요. 원하시면 결과를 보기 직전에
              <br />
              짧은 동작 확인을 더할 수 있어요.
            </p>
          </div>
        </div>
      </main>

      <footer className="pointer-events-none fixed bottom-0 left-0 z-20 flex w-full items-center justify-center px-8 py-10">
        <div className="flex flex-col items-center gap-4 opacity-45">
          <div className="h-12 w-px bg-gradient-to-b from-transparent to-[#ffb77d]/50" />
          <p
            className="text-[10px] uppercase tracking-[0.4em] text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            Professional Motion Intelligence Engine
          </p>
        </div>
      </footer>
    </div>
  );
}