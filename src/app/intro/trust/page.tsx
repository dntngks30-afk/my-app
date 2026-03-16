'use client';

/**
 * intro trust: 비의료/참고용/규칙 기반 안내
 */
import { IntroSlide } from '@/components/public/IntroSlide';

export default function IntroTrustPage() {
  return (
    <IntroSlide currentPath="/intro/trust" tapLabel="TAP TO CONTINUE">
      <div className="max-w-md w-full text-center space-y-6">
        <h1
          className="text-xl md:text-2xl font-bold text-slate-100 leading-snug"
          style={{ fontFamily: 'var(--font-serif-noto)' }}
        >
          잘못된 움직임은 습관이 됩니다
        </h1>
        <p
          className="text-slate-400 text-sm"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          몸은 편한 방식으로 버티고, 그게 반복됩니다
        </p>
        <p
          className="text-slate-500 text-xs leading-relaxed"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          본 분석은 의학적 진단이 아니며 참고용입니다.
          <br />
          규칙 기반 알고리즘으로 제공됩니다.
        </p>
      </div>
    </IntroSlide>
  );
}
