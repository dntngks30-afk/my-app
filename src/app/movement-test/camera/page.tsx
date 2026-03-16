'use client';

/**
 * 카메라 테스트 entry - 권한 안내 + 비의료 안내 + 시작 버튼
 */
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { CAMERA_SETUP_PATH, resetCameraTest, saveCameraTest } from '@/lib/public/camera-test';
import { clearCameraResult } from '@/lib/camera/camera-result';

const BG = '#0d161f';
const ACCENT = '#ff7b00';

export default function CameraEntryPage() {
  const router = useRouter();

  const handleStart = () => {
    resetCameraTest();
    clearCameraResult();
    saveCameraTest({
      startedAt: new Date().toISOString(),
      completedSteps: [],
      evaluatorResults: {},
      guardrailResults: {},
    });
    router.push(CAMERA_SETUP_PATH);
  };

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
            AI 기반 카메라 분석
          </h1>
          <p
            className="text-slate-400 text-sm leading-relaxed"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            카메라를 사용해 2가지 동작을 촬영합니다.
            <br />
            전신이 보이도록 프레임에 맞춰 주세요.
          </p>
          <p
            className="text-slate-500 text-xs leading-relaxed"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            본 분석은 의학적 진단이 아니며 참고용입니다.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="w-full max-w-md mx-auto block min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            시작하기
          </button>
        </div>
      </main>
    </div>
  );
}
