'use client';

/**
 * stitch code.html Screen 5 — Examples 2 (glass 비교 카드)
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroExamples2() {
  return (
    <IntroSceneShell currentPath="/intro/examples/2">
      <div className="w-full max-w-4xl px-2 text-center">
        <h2 className="mb-6 text-3xl font-light text-[#dce1fb] md:text-5xl [font-family:var(--font-display)]">
          반복되는 보상 패턴은 몸에 <span className="italic text-[#fcb973]">흔적</span>을 남깁니다
        </h2>

        <p
          className="mb-12 text-lg font-light text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          한쪽으로 쏠린 힘의 불균형이 당신의 골격 구조를 변형시키고 있습니다.
        </p>

        <div className="flex flex-col items-stretch gap-8 md:flex-row md:justify-center">
          <div className="flex-1 rounded-lg border border-white/10 bg-[rgba(46,52,71,0.4)] p-8 backdrop-blur-xl">
            <div className="mb-4 flex h-40 items-center justify-center rounded bg-[#2e3447]/80">
              <div className="h-24 w-24 rounded-full bg-gradient-to-b from-cyan-400/30 to-transparent" aria-hidden />
            </div>
            <h4
              className="text-sm uppercase tracking-widest text-[#ffb77d]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              Optimal
            </h4>
            <p className="mt-2 text-lg font-light text-white" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              균형 잡힌 정렬
            </p>
            <p className="mt-1 text-sm font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              무게 중심이 중앙에 위치하여 관절의 마모를 최소화합니다.
            </p>
          </div>

          <div className="flex-1 rounded-lg border border-white/10 bg-[rgba(46,52,71,0.4)] p-8 backdrop-blur-xl">
            <div className="mb-4 flex h-40 items-center justify-center rounded bg-[#2e3447]/80">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-orange-500/20 to-transparent mix-blend-screen" aria-hidden />
            </div>
            <h4
              className="text-sm uppercase tracking-widest text-slate-400"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              Pattern 02
            </h4>
            <p className="mt-2 text-lg font-light text-white" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              비대칭적 보상
            </p>
            <p className="mt-1 text-sm font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              특정 근육의 과사용으로 인해 골반이 회전된 상태입니다.
            </p>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <IntroStepIndicator step={4} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
