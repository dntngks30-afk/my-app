'use client';

/**
 * PR-PUBLIC-BRIDGE-01 — 설문 baseline 완료 직후, 최종 결과(전체 렌더) 전 선택 브리지.
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import {
  MoveReFullscreenScreen,
  MoveReHeroBlock,
  MoveRePrimaryCTA,
  MoveReSecondaryCTA,
  MoveReSurfaceCard,
} from '@/components/public-brand';

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

  if (!ready) {
    return (
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            준비 중...
          </p>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="flex min-h-0 flex-1 flex-col justify-center px-6 py-10">
        <div className="animate-in fade-in mx-auto w-full max-w-md space-y-8">
          <MoveReHeroBlock
            className="items-start text-left"
            eyebrow="다음 단계"
            eyebrowClassName="text-[var(--mr-public-accent)] opacity-90"
            title={
              <h1 className="text-2xl font-bold leading-snug break-keep text-slate-100">
                설문 결과는 준비됐어요
              </h1>
            }
            showAccentDivider
            subtitle={
              <p className="pt-1 text-sm leading-relaxed break-keep text-slate-400">
                원하시면 20~30초 동작 체크로 움직임 신호를 조금 더 반영할 수 있어요. 진단이 아니라, 더 맞는 운동
                시작점을 잡기 위한 간단한 확인이에요.
              </p>
            }
          />

          <div className="space-y-4">
            <MoveReSurfaceCard className="overflow-hidden p-0">
              <div className="border-b border-white/[0.06] px-4 py-4">
                <MoveRePrimaryCTA type="button" onClick={handleResultFirst} className="w-full shadow-md">
                  결과 먼저 보기
                </MoveRePrimaryCTA>
              </div>
              <div className="px-4 py-4">
                <MoveReSecondaryCTA type="button" onClick={handleCameraRefine} className="min-h-[52px] w-full">
                  카메라로 움직임 체크하기
                </MoveReSecondaryCTA>
              </div>
            </MoveReSurfaceCard>

            <p
              className="text-center text-xs break-keep text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              동작 체크 없이도 결과와 이후 단계를 모두 이용할 수 있어요.
            </p>
          </div>
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
