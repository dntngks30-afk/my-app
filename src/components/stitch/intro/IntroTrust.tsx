'use client';

/**
 * stitch code.html Screen 7 — Trust
 */
import { Info } from 'lucide-react';
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroTrust() {
  return (
    <IntroSceneShell currentPath="/intro/trust">
      <div className="w-full max-w-2xl px-2 text-center">
        <h2 className="mb-8 text-4xl font-light text-[#dce1fb] md:text-5xl [font-family:var(--font-display)]">
          잘못된 움직임은 습관이 됩니다
        </h2>

        <p
          className="mb-12 text-xl font-light leading-relaxed text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          몸은 편한 방식으로 버티고, 그게 반복됩니다
        </p>

        <div className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-[#23293c]/90 px-6 py-4">
          <Info className="size-5 shrink-0 text-[#fcb973]" strokeWidth={1.5} aria-hidden />
          <p className="text-left text-sm text-[#c6c6cd]/80" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            본 분석은 의학적 진단이 아니며 참고용입니다.
            <br />
            규칙 기반 알고리즘으로 제공됩니다.
          </p>
        </div>

        <div className="mt-16 flex justify-center">
          <IntroStepIndicator step={6} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
