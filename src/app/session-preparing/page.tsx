'use client';

/**
 * PR-GENERATION-STAGE-07 — 온보딩 직후 짧은 실행 준비(세션 구성) 스테이징
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StitchSessionPreparingScene from '@/components/stitch/postpay/StitchSessionPreparingScene';

/** 총 체감 ~1.8~2.2초 — 단계 전환 간격(ms) */
const STEP_MS = 650;
const FINAL_HOLD_MS = 550;

const STAGE_LINES = [
  '지금 정리된 상태를 반영해, 운동 시작점을 맞추고 있어요.',
  '조심해야 할 움직임과 난이도에 맞춰 세션을 잡고 있어요.',
  '리셋맵에 이어질 전체 세션 구성을 준비하고 있어요.',
] as const;

export default function SessionPreparingPage() {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(0);

  const goNext = useCallback(() => {
    router.replace('/onboarding-complete');
  }, [router]);

  useEffect(() => {
    const t1 = window.setTimeout(() => setStageIndex(1), STEP_MS);
    const t2 = window.setTimeout(() => setStageIndex(2), STEP_MS * 2);
    const t3 = window.setTimeout(() => {
      router.replace('/onboarding-complete');
    }, STEP_MS * 2 + FINAL_HOLD_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [router]);

  return (
    <StitchSessionPreparingScene stageIndex={stageIndex} stageLines={STAGE_LINES} onSkipNext={goNext} />
  );
}
