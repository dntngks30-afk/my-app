'use client';

/**
 * stitch code.html Screen 3 — Report (glass panel)
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroReport() {
  return (
    <IntroSceneShell currentPath="/intro/report">
      <div className="w-full max-w-3xl px-2 text-center">
        <h2 className="mb-8 text-3xl font-light text-[#dce1fb] md:text-5xl [font-family:var(--font-display)]">
          MOVE RE 움직임 패턴 리포트
        </h2>

        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[rgba(46,52,71,0.45)] p-8 backdrop-blur-xl md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] opacity-[0.05]"
          />
          <p
            className="relative text-lg font-light leading-relaxed text-[#c6c6cd] md:text-xl"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            당신의 몸은 반복되는 방식으로 움직입니다.
            <br />
            그 패턴은 불편함과 운동 방식에 영향을 줍니다.
          </p>
        </div>

        <div className="mt-12">
          <IntroStepIndicator step={2} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
