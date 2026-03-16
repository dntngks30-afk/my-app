'use client';

/**
 * intro 첫 화면: 환영 + MOVE RE 소개
 */
import { IntroSlide } from '@/components/public/IntroSlide';

export default function IntroWelcomePage() {
  return (
    <IntroSlide currentPath="/intro/welcome" tapLabel="TAP TO CONTINUE">
      <div className="max-w-md w-full text-center space-y-6">
        <p
          className="text-slate-400 text-base"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          안녕하세요,
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold text-slate-100 leading-snug"
          style={{ fontFamily: 'var(--font-serif-noto)' }}
        >
          MOVE RE가 당신의 움직임 패턴을
          <br />
          분석해드립니다
        </h1>
        <p
          className="text-slate-400 text-sm"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          당신도 몰랐던 몸의 반복 패턴을 알려드릴게요
        </p>
      </div>
    </IntroSlide>
  );
}
