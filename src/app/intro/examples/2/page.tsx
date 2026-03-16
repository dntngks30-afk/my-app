'use client';

/**
 * intro examples 2: 보상 패턴 흔적
 */
import { IntroSlide } from '@/components/public/IntroSlide';

export default function IntroExamples2Page() {
  return (
    <IntroSlide currentPath="/intro/examples/2" tapLabel="다음 분석 결과 확인">
      <div className="max-w-md w-full space-y-6">
        <h1
          className="text-center text-xl md:text-2xl font-bold text-slate-100 leading-snug"
          style={{ fontFamily: 'var(--font-serif-noto)' }}
        >
          반복되는 보상 패턴은 몸에 흔적을 남깁니다
        </h1>
        <p
          className="text-center text-slate-400 text-sm"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          한쪽으로 쏠린 힘의 불균형이 당신의 골격 구조를 변형시키고 있습니다.
        </p>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <span className="text-cyan-400/90 text-xs font-bold uppercase tracking-wider">
              Optimal
            </span>
            <p className="text-white font-bold mt-1">균형 잡힌 정렬</p>
            <p className="text-slate-400 text-sm mt-0.5">
              무게 중심이 중앙에 위치하여 관절의 마모를 최소화합니다.
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <span className="text-[#ff7b00] text-xs font-bold uppercase tracking-wider">
              Pattern 02
            </span>
            <p className="text-white font-bold mt-1">비대칭적 보상</p>
            <p className="text-slate-400 text-sm mt-0.5">
              특정 근육의 과사용으로 인해 골반이 회전된 상태입니다.
            </p>
          </div>
        </div>
      </div>
    </IntroSlide>
  );
}
