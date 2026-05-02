'use client';

/**
 * 카메라 테스트 entry - 권한 안내 + 비의료 안내 + 시작 버튼
 */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics/trackEvent';
import { CAMERA_SQUAT_PATH, resetCameraTest, saveCameraTest } from '@/lib/public/camera-test';
import { clearCameraResult } from '@/lib/camera/camera-result';
import CameraEntry from '@/components/stitch/camera/CameraEntry';

export default function CameraEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const entryFrom =
      typeof document !== 'undefined' && document.referrer.includes('/movement-test/refine-bridge')
        ? 'refine_bridge'
        : 'direct';

    trackEvent('camera_flow_started', {
      route_group: 'camera_refine',
      entry_from: entryFrom,
    });
  }, []);

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

  return <CameraEntry onStart={handleStart} />;
}
