'use client';

/**
 * PR-SESSION-PREPARING-TRANSPLANT-MIN-DWELL-02
 * - zip(9) 계열 UI는 StitchSessionPreparingScene
 * - 세션 생성 API는 마운트 직후 즉시 1회(모듈 in-flight로 중복 방지)
 * - 성공 시 리다이렉트: max(실제 완료 시각, 체류 플로어) — API를 sleep 하지 않음
 *
 * PR-SESSION-PREPARING-PROGRESS-PACING-04
 * - 가로 바: dwell 동안 0→~92%만 점진, 준비 완료+dwell 충족 후에만 100% → 짧게 뒤 이동
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { createSession } from '@/lib/session/client';
import StitchSessionPreparingScene from '@/components/stitch/postpay/StitchSessionPreparingScene';

/** 성공 경로 최소 체류(ms). env로 조정 가능, 기본 10초. PR-SESSION-PREPARING-DWELL-10S-03 */
export const SESSION_PREPARING_DWELL_FLOOR_MS =
  Number(process.env.NEXT_PUBLIC_SESSION_PREPARING_DWELL_MS) > 0
    ? Number(process.env.NEXT_PUBLIC_SESSION_PREPARING_DWELL_MS)
    : 10000;

const STAGE_LINES = [
  '지금 정리된 상태를 반영해, 운동 시작점을 맞추고 있어요.',
  '조심해야 할 움직임과 난이도에 맞춰 세션을 잡고 있어요.',
  '리셋맵에 이어질 전체 세션 구성을 준비하고 있어요.',
] as const;

type SessionCreateResult = Awaited<ReturnType<typeof createSession>>;

/** StrictMode·재마운트에서 POST 중복 방지 — 서버 dedupe와 별도로 클라이언트 단일 in-flight */
let sessionPreparingCreateInflight: Promise<SessionCreateResult> | null = null;

function runSessionPreparingCreateOnce(accessToken: string): Promise<SessionCreateResult> {
  if (!sessionPreparingCreateInflight) {
    sessionPreparingCreateInflight = createSession(accessToken, {
      condition_mood: 'ok',
      time_budget: 'normal',
      summary: true,
    });
  }
  return sessionPreparingCreateInflight;
}

/** 에러 후 재시도·재방문 시 새 요청 허용 */
function resetSessionPreparingCreateInflight() {
  sessionPreparingCreateInflight = null;
}

/** dwell 구간에서 채울 수 있는 최대 비율(100%는 준비+dwell 동시 충족 시에만) */
const PRE_COMPLETE_PROGRESS_CAP = 0.92;

/** 100% 표시 후 CSS transition·한 프레임 여유 */
const REDIRECT_AFTER_FULL_MS = 80;

export default function SessionPreparingPage() {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startPerfRef = useRef<number | null>(null);
  const sessionReadyPerfRef = useRef<number | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimeoutRef.current != null) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    clearRedirectTimer();
    resetSessionPreparingCreateInflight();
    router.replace('/onboarding-complete');
  }, [router, clearRedirectTimer]);

  useEffect(() => {
    startPerfRef.current = performance.now();
    const floorMs = SESSION_PREPARING_DWELL_FLOOR_MS;
    const stageMs = floorMs / 3;

    const t1 = window.setTimeout(() => setStageIndex(1), stageMs);
    const t2 = window.setTimeout(() => setStageIndex(2), stageMs * 2);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const floorMs = SESSION_PREPARING_DWELL_FLOOR_MS;
    progressIntervalRef.current = window.setInterval(() => {
      const t0 = startPerfRef.current ?? performance.now();
      const now = performance.now();
      const elapsed = now - t0;
      const sessionReady = sessionReadyPerfRef.current != null;
      const dwellComplete = elapsed >= floorMs;

      const dwellPhase = Math.min(1, elapsed / floorMs);
      const dwellBacked = dwellPhase * PRE_COMPLETE_PROGRESS_CAP;

      let next: number;
      if (sessionReady && dwellComplete) {
        next = 1;
      } else {
        // 준비가 먼저 끝나도 dwell 전에는 시간 기준만큼만 채움. dwell 끝났는데 준비 전이면 ~92%에서 대기
        next = Math.min(PRE_COMPLETE_PROGRESS_CAP, dwellBacked);
      }
      setVisualProgress((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
    }, 120);

    return () => {
      if (progressIntervalRef.current != null) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let dead = false;

    async function run() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (dead) return;
      if (!session?.access_token) {
        setErrorMessage('로그인이 필요합니다.');
        return;
      }

      const result = await runSessionPreparingCreateOnce(session.access_token);
      if (dead) return;

      if (!result.ok) {
        resetSessionPreparingCreateInflight();
        setErrorMessage(result.error.message ?? '세션을 준비하지 못했습니다.');
        return;
      }

      sessionReadyPerfRef.current = performance.now();
      const t0 = startPerfRef.current ?? performance.now();
      const elapsed = sessionReadyPerfRef.current - t0;
      const remaining = Math.max(0, SESSION_PREPARING_DWELL_FLOOR_MS - elapsed);

      clearRedirectTimer();
      redirectTimeoutRef.current = window.setTimeout(() => {
        if (dead) return;
        setVisualProgress(1);
        window.setTimeout(() => {
          if (dead) return;
          resetSessionPreparingCreateInflight();
          router.replace('/onboarding-complete');
        }, REDIRECT_AFTER_FULL_MS);
      }, remaining);
    }

    run().catch((e) => {
      resetSessionPreparingCreateInflight();
      if (!dead) {
        setErrorMessage(e instanceof Error ? e.message : '세션을 준비하지 못했습니다.');
      }
    });

    return () => {
      dead = true;
      clearRedirectTimer();
    };
  }, [router, clearRedirectTimer]);

  return (
    <StitchSessionPreparingScene
      stageIndex={stageIndex}
      stageLines={STAGE_LINES}
      visualProgress={visualProgress}
      errorMessage={errorMessage}
      onSkipNext={goNext}
    />
  );
}
