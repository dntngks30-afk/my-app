'use client';

/**
 * Survey baseline completion bridge.
 * Completed survey cache is read only through the survey-session helper.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RefineBridge from '@/components/stitch/bridge/RefineBridge';
import { loadCompletedSurveyAnswersCache } from '@/lib/public/survey-session-cache';

export default function RefineBridgePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const answers = loadCompletedSurveyAnswersCache();
    if (!answers || Object.keys(answers).length === 0) {
      router.replace('/movement-test/survey');
      return;
    }
    setReady(true);
  }, [router]);

  const handleResultFirst = () => {
    router.push('/movement-test/baseline');
  };

  const handleCameraRefine = () => {
    router.push('/movement-test/camera');
  };

  return (
    <RefineBridge
      loading={!ready}
      onResultFirst={handleResultFirst}
      onCameraRefine={handleCameraRefine}
    />
  );
}
