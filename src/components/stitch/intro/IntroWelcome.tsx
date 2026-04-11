'use client';

/**
 * stitch code.html Screen 2 — Welcome
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroWelcome() {
  return (
    <IntroSceneShell currentPath="/intro/welcome">
      <div className="w-full max-w-2xl text-center">
        <h1
          className="mb-8 text-[32px] font-normal leading-[38px] tracking-[-1.3px] text-[#dce1fb] [font-family:var(--font-serif-noto)]"
        >
          <span className="inline-flex items-baseline justify-center gap-0 whitespace-nowrap">
            <span className="text-[32px] font-bold [font-family:var(--font-serif-noto)]">MOVE RE</span>
            <span className="text-[24px] leading-[36px] [font-family:var(--font-serif-noto)]">는</span>
          </span>
          <br />
          <span className="block text-[24px] leading-[33px] [font-family:var(--font-serif-noto)]">
            <span
              className="text-[27px] font-bold text-[#ffb77d] opacity-80"
              style={{ fontFamily: '"Noto Serif KR"' }}
            >
              움직임 패턴
            </span>
            을 통해
            <br />
            맞춤형 운동방향을
            <br />
            안내합니다.
          </span>
        </h1>

        <p
          className="mb-12 text-[13px] font-light text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          간단한 테스트를 통해 몸의 균형을 찾아가는 과정입니다.
        </p>

        <IntroStepIndicator step={1} />
      </div>
    </IntroSceneShell>
  );
}
