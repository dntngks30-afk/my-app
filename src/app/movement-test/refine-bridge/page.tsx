'use client';

/**
 * Survey baseline completion bridge.
 * Completed survey cache is read only through the survey-session helper.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withPilotAnalyticsProps } from '@/lib/analytics/client-context';
import { trackEvent } from '@/lib/analytics/trackEvent';
import RefineBridge from '@/components/stitch/bridge/RefineBridge';
import { loadCompletedSurveyAnswersCache } from '@/lib/public/survey-session-cache';
import { markPublicTestRunRefineChoiceClient } from '@/lib/public-test-runs/client';

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
    trackEvent(
      'refine_bridge_choice_clicked',
      withPilotAnalyticsProps({
        route_group: 'refine_bridge',
        choice: 'baseline',
      }),
      {
        route_group: 'refine_bridge',
      }
    );
    void markPublicTestRunRefineChoiceClient('baseline');
    router.push('/movement-test/baseline');
  };

  const handleCameraRefine = () => {
    trackEvent(
      'refine_bridge_choice_clicked',
      withPilotAnalyticsProps({
        route_group: 'refine_bridge',
        choice: 'camera',
      }),
      {
        route_group: 'refine_bridge',
      }
    );
    void markPublicTestRunRefineChoiceClient('camera');
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
