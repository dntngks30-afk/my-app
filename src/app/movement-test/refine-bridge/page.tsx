'use client';

/**
 * PR-PUBLIC-BRIDGE-01 — 설문 baseline 완료 직후, 최종 결과(전체 렌더) 전 선택 브리지.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import RefineBridge from '@/components/stitch/bridge/RefineBridge';

const SESSION_KEY = 'movementTestSession:v2';

interface StoredSessionV2 {
  version: string;
  isCompleted: boolean;
  answersById: Record<string, TestAnswerValue>;
}

function loadCompletedSurveyAnswers(): Record<string, TestAnswerValue> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: StoredSessionV2 = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    if (!data.isCompleted) return null;
    return data.answersById ?? {};
  } catch {
    return null;
  }
}

export default function RefineBridgePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const answers = loadCompletedSurveyAnswers();
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
