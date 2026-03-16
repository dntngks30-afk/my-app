'use client';

/**
 * 카메라 테스트 - 스쿼트
 * pose capture → evaluator → evaluatorResults 저장
 */
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import { CameraPreview } from '@/components/public/CameraPreview';
import {
  saveCameraTest,
  loadCameraTest,
  getNextStepPath,
  getPrevStepPath,
  type CameraStepId,
} from '@/lib/public/camera-test';
import { usePoseCapture } from '@/lib/camera/use-pose-capture';
import { runEvaluator } from '@/lib/camera/run-evaluators';

const BG = '#0d161f';
const ACCENT = '#ff7b00';
const STEP_ID: CameraStepId = 'squat';

const INSTRUCTION = '발을 어깨 너비로 벌리고, 허리를 펴고 천천히 앉았다 일어나세요.';

export default function CameraSquatPage() {
  const router = useRouter();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const { landmarks, start, stop } = usePoseCapture();
  const hasStartedRef = useRef(false);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        start(video);
      }
    },
    [start]
  );

  const handleNext = useCallback(() => {
    stop();
    const result = runEvaluator(STEP_ID, landmarks);
    const current = loadCameraTest();
    const completed = [...(current.completedSteps ?? []), STEP_ID];
    const evaluatorResults = { ...(current.evaluatorResults ?? {}), [STEP_ID]: result };
    saveCameraTest({
      completedSteps: completed,
      lastStepAt: new Date().toISOString(),
      evaluatorResults,
    });
    const next = getNextStepPath(STEP_ID);
    if (next) router.push(next);
  }, [router, landmarks, stop]);

  const handleRetry = useCallback(() => {
    setPermissionDenied(false);
  }, []);

  const handleSurveyFallback = useCallback(() => {
    router.push('/movement-test/survey');
  }, [router]);

  const prevPath = getPrevStepPath(STEP_ID);

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      <header className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-12">
          {prevPath ? (
            <Link
              href={prevPath}
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="이전"
            >
              <ChevronLeft className="size-6" style={{ color: ACCENT }} />
            </Link>
          ) : (
            <Link
              href="/movement-test/camera"
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="이전"
            >
              <ChevronLeft className="size-6" style={{ color: ACCENT }} />
            </Link>
          )}
        </div>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          1 / 3
        </p>
        <div className="w-12" />
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-4 overflow-hidden">
        <h1
          className="text-xl font-bold text-slate-100 mb-2"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          스쿼트
        </h1>
        <p
          className="text-slate-400 text-sm mb-4 text-center break-keep"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {INSTRUCTION}
        </p>

        {permissionDenied ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-md">
            <p className="text-slate-400 text-sm text-center">
              카메라 접근이 거부되었습니다.
              <br />
              브라우저 설정에서 카메라 권한을 허용해 주세요.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={handleSurveyFallback}
                className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                설문형으로 전환
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full max-w-md flex-1 min-h-0 flex flex-col items-center">
              <CameraPreview
                onVideoReady={handleVideoReady}
                onError={() => setPermissionDenied(true)}
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={handleNext}
              className="w-full max-w-md mt-4 min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음
            </button>
          </>
        )}
      </main>
    </div>
  );
}
