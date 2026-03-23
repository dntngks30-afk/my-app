'use client';

/**
 * 카메라 테스트 entry - 권한 안내 + 비의료 안내 + 시작 버튼
 */
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import {
  MoveReFullscreenScreen,
  MoveReHeroBlock,
  MoveRePrimaryCTA,
} from '@/components/public-brand';
import { CAMERA_SQUAT_PATH, resetCameraTest, saveCameraTest } from '@/lib/public/camera-test';
import { clearCameraResult } from '@/lib/camera/camera-result';

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
    router.push(CAMERA_SQUAT_PATH);
  };

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          <MoveReHeroBlock
            title={
              <span
                className="block text-2xl font-bold md:text-3xl"
                style={{ fontFamily: 'var(--font-serif-noto)' }}
              >
                AI 기반 카메라 분석
              </span>
            }
            subtitle={
              <>
                <p>
                  카메라를 사용해 2가지 동작을 촬영합니다.
                  <br />
                  전신이 보이도록 프레임에 맞춰 주세요.
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  본 분석은 의학적 진단이 아니며 참고용입니다.
                </p>
              </>
            }
          />
          <MoveRePrimaryCTA onClick={handleStart}>시작하기</MoveRePrimaryCTA>
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
