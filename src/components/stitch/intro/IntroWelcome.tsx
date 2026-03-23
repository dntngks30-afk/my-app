'use client';

/**
 * stitch code.html Screen 2 — Welcome
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroWelcome() {
  return (
    <IntroSceneShell currentPath="/intro/welcome">
      <div className="w-full max-w-2xl text-center">
        <span
          className="mb-4 block text-sm tracking-[0.3em] text-[#ffb77d] opacity-80"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          안녕하세요,
        </span>

        <h1 className="mb-8 text-4xl font-extralight leading-tight tracking-tight text-[#dce1fb] md:text-5xl lg:text-6xl [font-family:var(--font-display)]">
          MOVE RE가 당신의
          <br />
          <span className="italic text-[#ffb77d]">움직임 패턴</span>을 분석해드립니다
        </h1>

        <p
          className="mb-12 text-lg font-light text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          당신도 몰랐던 몸의 반복 패턴을 알려드릴게요
        </p>

        <IntroStepIndicator step={1} />
      </div>
    </IntroSceneShell>
  );
}
