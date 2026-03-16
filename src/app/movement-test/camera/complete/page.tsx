'use client';

/**
 * 카메라 테스트 완료 (evaluator는 다음 PR)
 */
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';

const BG = '#0d161f';
const ACCENT = '#ff7b00';

export default function CameraCompletePage() {
  const router = useRouter();

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-slate-100"
            style={{ fontFamily: 'var(--font-serif-noto)' }}
          >
            촬영이 완료되었습니다
          </h1>
          <p
            className="text-slate-400 text-sm"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            3가지 동작 촬영이 저장되었습니다.
            <br />
            분석 결과는 곧 제공될 예정입니다.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => router.push('/movement-test/survey')}
              className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              설문형 테스트로 전환
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              홈으로
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
