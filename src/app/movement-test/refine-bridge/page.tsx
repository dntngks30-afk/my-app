'use client';

/**
 * PR-PUBLIC-BRIDGE-01 — 설문 baseline 완료 직후, 최종 결과(전체 렌더) 전 선택 브리지.
 *
 * - 카메라는 optional refine evidence (별도 동등 진입·별도 truth 아님).
 * - 두 선택만 제공: 결과 먼저 | 카메라 동작 체크 (기존 /movement-test/camera 경로 재사용).
 *
 * @see docs/SSOT_PUBLIC_FIRST_2026_03.md §4-3, §4-4
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import type { TestAnswerValue } from '@/features/movement-test/v2';

const SESSION_KEY = 'movementTestSession:v2';
const BG = '#0d161f';
const ACCENT = '#ff7b00';

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
      <div className="min-h-[100svh] flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          준비 중...
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6 animate-in fade-in">
          <div className="text-center space-y-2">
            <p
              className="text-xs text-slate-500 uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음 단계
            </p>
            <h1
              className="text-2xl font-bold text-slate-100 break-keep leading-snug"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              설문 결과는 준비됐어요
            </h1>
            <p
              className="text-sm text-slate-400 leading-relaxed break-keep pt-1"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              원하시면 20~30초 동작 체크로 움직임 신호를 조금 더 반영할 수 있어요. 진단이 아니라, 더 맞는 운동
              시작점을 잡기 위한 간단한 확인이에요.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleResultFirst}
              className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors"
              style={{ backgroundColor: ACCENT, fontFamily: 'var(--font-sans-noto)' }}
            >
              결과 먼저 보기
            </button>
            <button
              type="button"
              onClick={handleCameraRefine}
              className="w-full min-h-[48px] rounded-2xl font-medium text-slate-300 border border-white/20 hover:bg-white/5 transition-colors"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              카메라로 움직임 체크하기
            </button>
          </div>

          <p
            className="text-xs text-slate-500 text-center break-keep"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            동작 체크 없이도 결과와 이후 단계를 모두 이용할 수 있어요.
          </p>
        </div>
      </main>
    </div>
  );
}
