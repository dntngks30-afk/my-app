'use client';

/**
 * stitch code.html Screen 4 — Examples 1 (비교 카드)
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroExamples1() {
  return (
    <IntroSceneShell currentPath="/intro/examples/1">
      <div className="w-full max-w-6xl px-2">
        <h2 className="mb-12 text-center text-3xl font-light text-[#dce1fb] md:text-4xl [font-family:var(--font-display)]">
          같은 동작도,{' '}
          <span className="text-[#ffb77d]">방식은 다를 수 있습니다</span>
        </h2>

        <div className="grid min-h-[280px] gap-8 md:grid-cols-2 md:min-h-[360px]">
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#23293c]/80">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-60"
            />
            <div className="relative flex h-full min-h-[240px] flex-col justify-end p-6">
              <span className="mb-2 inline-block w-max bg-[#ffb77d]/20 px-3 py-1 text-xs uppercase tracking-widest text-[#ffb77d]">
                Good Pattern
              </span>
              <h3 className="text-lg font-light text-white" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                올바른 움직임
              </h3>
              <p className="mt-1 text-sm font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                신체 정렬이 유지되며 주동근이 효율적으로 활성화됨
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#23293c]/80">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-50 grayscale"
            />
            <div className="relative flex h-full min-h-[240px] flex-col justify-end p-6">
              <span className="mb-2 inline-block w-max bg-[#2e3447] px-3 py-1 text-xs uppercase tracking-widest text-[#c6c6cd]">
                Compensation
              </span>
              <h3 className="text-lg font-light text-white" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                잘못된 움직임
              </h3>
              <p className="mt-1 text-sm font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                불필요한 보상 작용으로 관절에 과도한 스트레스 발생
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <IntroStepIndicator step={3} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
