'use client';

/**
 * 카메라 테스트 완료
 * evaluatorResults → normalize → moveReCameraResult:v1 저장
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { loadCameraTest, CAMERA_STEPS } from '@/lib/public/camera-test';
import { normalizeCameraResult } from '@/lib/camera/normalize';
import { saveCameraResult } from '@/lib/camera/camera-result';

const BG = '#0d161f';
const ACCENT = '#ff7b00';

export default function CameraCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const data = loadCameraTest();
    const results = data.evaluatorResults ?? {};
    const allResults = CAMERA_STEPS.map((s) => results[s.id]).filter(Boolean);
    if (allResults.length >= 3) {
      const normalized = normalizeCameraResult(allResults);
      saveCameraResult(normalized);
    }
  }, []);

  const handleViewResult = () => {
    router.push('/movement-test/result');
  };

  const handleSurveyFallback = () => {
    router.push('/movement-test/survey');
  };

  const handleHome = () => {
    router.push('/');
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
            촬영이 완료되었습니다
          </h1>
          <p
            className="text-slate-400 text-sm"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            3가지 동작 분석이 완료되었습니다.
            <br />
            결과를 확인해 보세요.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleViewResult}
              className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              결과 보기
            </button>
            <button
              type="button"
              onClick={handleSurveyFallback}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              설문형 테스트로 전환
            </button>
            <button
              type="button"
              onClick={handleHome}
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
