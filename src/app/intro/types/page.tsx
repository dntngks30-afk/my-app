'use client';

/**
 * intro types: 움직임 타입 소개
 */
import { IntroSlide } from '@/components/public/IntroSlide';

export default function IntroTypesPage() {
  return (
    <IntroSlide currentPath="/intro/types" tapLabel="TAP TO CONTINUE">
      <div className="max-w-md w-full space-y-6">
        <h1
          className="text-center text-xl md:text-2xl font-bold text-slate-100 leading-snug"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          사람마다 움직임 타입이 다릅니다
        </h1>
        <ul className="space-y-3 text-slate-300 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 rounded-full shrink-0 bg-[#ff7b00]" />
            <span>어떤 사람은 안정성이 먼저 필요하고</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 rounded-full shrink-0 bg-[#ff7b00]" />
            <span>어떤 사람은 가동성부터 풀어야 합니다</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 rounded-full shrink-0 bg-[#ff7b00]" />
            <span>어떤 사람은 좌우 불균형이 먼저 드러납니다</span>
          </li>
        </ul>
      </div>
    </IntroSlide>
  );
}
