'use client';

import { useRouter } from 'next/navigation';
import StitchSessionPreparingScene from '@/components/stitch/postpay/StitchSessionPreparingScene';
import { useSessionPreparingOrchestrator } from './useSessionPreparingOrchestrator';

export default function SessionPreparingPage() {
  const router = useRouter();
  const { stageIndex, visualProgress, errorMessage, onSkipNext } =
    useSessionPreparingOrchestrator({
      onReadyRedirect: () => router.replace('/onboarding-complete'),
    });

  return (
    <StitchSessionPreparingScene
      stageIndex={stageIndex}
      visualProgress={visualProgress}
      errorMessage={errorMessage}
      onSkipNext={onSkipNext}
    />
  );
}
