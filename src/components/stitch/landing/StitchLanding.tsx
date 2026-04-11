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

      <main className="public-chapter-content-default relative z-10 flex min-h-[100svh] flex-col items-center justify-center space-y-12 px-6 text-center">
        <h2
          className="inline-block align-bottom pt-5 text-[30px] font-bold tracking-[-0.8px] text-[#fcb973] md:text-3xl"
          style={{ fontFamily: '"Noto Serif KR"' }}
        >
          Move Re
        </h2>

        <div className="w-full max-w-3xl space-y-12">
          <div className="space-y-6">
            <h1
              className="font-bold text-[#dce1fb] text-[35px] leading-[44px] tracking-[-2px] md:text-6xl md:leading-[1.12] md:tracking-tight"
              style={{ fontFamily: '"Noto Serif KR"' }}
            >
              당신의 <span className="text-[#FCB973]">움직임</span>,
              <br />
              알고 계신가요?
            </h1>

            <p
              className="mx-auto !my-0 h-[30px] max-w-xl text-[15px] font-light leading-[19px] text-[#c6c6cd]"
              style={{ fontFamily: '"Noto Sans KR"' }}
            >
              1분 체크로 몸의 상태를 확인하고,
              <br />
              나에게 필요한 운동방향을 알려드릴게요
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 pt-8">
            <button
              type="button"
              onClick={onStart}
              className="-mt-[23px] -mb-[23px] group inline-flex min-h-[64px] items-center justify-center rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] px-12 py-5 text-base font-semibold text-[#4d2600] shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition-all duration-500 hover:opacity-90 active:scale-[0.985] md:text-lg"
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
              className="mt-[7px] mb-[7px] max-w-xs text-center text-xs leading-relaxed text-[#909097] opacity-80 md:text-[13px]"
              style={{ fontFamily: '"Noto Sans KR"' }}
            >
              회원가입 없이 짧은 질문으로 시작해요
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
