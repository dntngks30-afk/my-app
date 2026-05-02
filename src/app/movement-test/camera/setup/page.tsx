'use client';

/**
 * 카메라 테스트 - 공통 Setup
 * squat 전 framing/거리/조명 준비. 동작 분석 없음.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/trackEvent';
import { Starfield } from '@/components/landing/Starfield';
import { CameraPreview } from '@/components/public/CameraPreview';
import { usePoseCapture } from '@/lib/camera/use-pose-capture';
import { getSetupFramingHint } from '@/lib/camera/setup-framing';
import { CAMERA_STEPS } from '@/lib/public/camera-test';

const IS_DEV = process.env.NODE_ENV !== 'production';
const SETUP_NEXT_PATH = CAMERA_STEPS[0]?.path ?? '/movement-test/camera/squat';

export default function CameraSetupPage() {
  const router = useRouter();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const { landmarks, pushFrame, start } = usePoseCapture();

  const framingHint = useMemo(() => getSetupFramingHint(landmarks), [landmarks]);
  const hintText = framingHint ?? '준비가 되면 다음으로 넘어가세요';

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      start(video);
      setCameraReady(true);
    },
    [start]
  );

  const handleNext = useCallback(() => {
    router.push(SETUP_NEXT_PATH);
  }, [router]);

  const handleError = useCallback(() => {
    setPermissionDenied(true);
  }, []);

  useEffect(() => {
    trackEvent('camera_setup_viewed', {
      route_group: 'camera_refine',
      route_path: '/movement-test/camera/setup',
    });
  }, []);

  return (
    <div className="relative min-h-[100svh] max-h-[100svh] overflow-hidden flex flex-col mr-public-funnel-shell">
      <Starfield />

      <header className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="w-12">
          <Link
            href="/movement-test/camera"
            className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="이전"
          >
            <ChevronLeft className="size-6 text-[var(--mr-public-accent)]" />
          </Link>
        </div>
        <span className="text-slate-500 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          준비
        </span>
        <div className="w-12" />
      </header>

      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center px-4 pb-4 overflow-hidden">
        <p
          className="text-slate-400 text-sm text-center mb-3 shrink-0"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          휴대폰을 벽이나 가구에 기대 세워 주세요.
          <br />
          머리부터 발끝까지 화면 안에 들어오면 됩니다.
        </p>

        {permissionDenied ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-md">
            <p className="text-slate-400 text-sm text-center">
              카메라 접근이 거부되었습니다.
              <br />
              브라우저 설정에서 카메라 권한을 허용해 주세요.
            </p>
            <button
              type="button"
              onClick={() => router.push('/movement-test/camera')}
              className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              돌아가기
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 w-full max-w-md flex flex-col items-center">
              <CameraPreview
                onVideoReady={handleVideoReady}
                onPoseFrame={pushFrame}
                onError={handleError}
                showPoseDebugOverlay={IS_DEV}
                guideTone="neutral"
                guideVariant="default"
                guideBadges={['전신', '1.8~2m 거리', '폰 낮게']}
                className="w-full h-full min-h-[280px]"
              />
            </div>
            <div className="w-full max-w-md mt-3 shrink-0 space-y-3">
              <p
                className="text-center text-xs text-slate-500"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {hintText}
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                준비됐어요
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
