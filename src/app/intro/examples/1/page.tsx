'use client';

/**
 * intro examples 1: 올바른 움직임 vs 보상 패턴
 */
import { IntroSlide } from '@/components/public/IntroSlide';
import { Check, X } from 'lucide-react';

export default function IntroExamples1Page() {
  return (
    <IntroSlide currentPath="/intro/examples/1" tapLabel="위로 스와이프하여 계속하기">
      <div className="max-w-md w-full space-y-6">
        <p
          className="text-center text-lg font-bold text-slate-100"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          같은 동작도,{' '}
          <span className="text-[#ff7b00]">방식은 다를 수 있습니다</span>
        </p>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-start gap-4">
            <div className="shrink-0 size-10 rounded-full border-2 border-emerald-400/60 flex items-center justify-center">
              <Check className="size-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Good Pattern
              </span>
              <p className="text-white font-bold mt-1">올바른 움직임</p>
              <p className="text-slate-400 text-sm mt-0.5">
                신체 정렬이 유지되며 주동근이 효율적으로 활성화됨
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-start gap-4">
            <div className="shrink-0 size-10 rounded-full border-2 border-red-400/60 flex items-center justify-center">
              <X className="size-5 text-red-400" />
            </div>
            <div>
              <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
                Compensation
              </span>
              <p className="text-white font-bold mt-1">잘못된 움직임</p>
              <p className="text-slate-400 text-sm mt-0.5">
                불필요한 보상 작용으로 관절에 과도한 스트레스 발생
              </p>
            </div>
          </div>
        </div>
      </div>
    </IntroSlide>
  );
}
