'use client';

/**
 * intro 리포트 소개 화면
 */
import { IntroSlide } from '@/components/public/IntroSlide';

export default function IntroReportPage() {
  return (
    <IntroSlide currentPath="/intro/report" tapLabel="TAP TO EXPLORE">
      <div className="max-w-md w-full text-center space-y-6">
        <h1
          className="text-2xl md:text-3xl font-bold text-slate-100 leading-snug"
          style={{ fontFamily: 'var(--font-serif-noto)' }}
        >
          MOVE RE 움직임 패턴 리포트
        </h1>
        <p
          className="text-slate-400 text-sm leading-relaxed"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          당신의 몸은 반복되는 방식으로 움직입니다.
          <br />
          그 패턴은 불편함과 운동 방식에 영향을 줍니다.
        </p>
      </div>
    </IntroSlide>
  );
}
