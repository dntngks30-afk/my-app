'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { createSession } from '@/lib/session/client';

// Minimum dwell on the success path. Env override allowed, default 10s.
export const SESSION_PREPARING_DWELL_FLOOR_MS =
  Number(process.env.NEXT_PUBLIC_SESSION_PREPARING_DWELL_MS) > 0
    ? Number(process.env.NEXT_PUBLIC_SESSION_PREPARING_DWELL_MS)
    : 10000;

type SessionCreateResult = Awaited<ReturnType<typeof createSession>>;

// Module-level in-flight owner to prevent duplicate POSTs across StrictMode/remount.
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

// Allow a fresh request after a failure or explicit exit.
function resetSessionPreparingCreateInflight() {
  sessionPreparingCreateInflight = null;
}

// Progress can only fill to ~92% until both readiness and dwell complete.
const PRE_COMPLETE_PROGRESS_CAP = 0.92;

// Small frame gap so the 100% transition can paint before redirect.
const REDIRECT_AFTER_FULL_MS = 80;

type UseSessionPreparingOrchestratorOptions = {
  onReadyRedirect: () => void;
};

type UseSessionPreparingOrchestratorResult = {
  stageIndex: number;
  visualProgress: number;
  errorMessage: string | null;
  onSkipNext: () => void;
};

const AUTH_REQUIRED_MESSAGE = '\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
const CREATE_FAILED_MESSAGE = '\uC138\uC158\uC744 \uC900\uBE44\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.';

export function useSessionPreparingOrchestrator({
  onReadyRedirect,
}: UseSessionPreparingOrchestratorOptions): UseSessionPreparingOrchestratorResult {
  const [stageIndex, setStageIndex] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startPerfRef = useRef<number | null>(null);
  const sessionReadyPerfRef = useRef<number | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimeoutRef.current != null) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  const finishAndRedirect = useCallback(() => {
    clearRedirectTimer();
    resetSessionPreparingCreateInflight();
    onReadyRedirect();
  }, [clearRedirectTimer, onReadyRedirect]);

  const onSkipNext = useCallback(() => {
    finishAndRedirect();
  }, [finishAndRedirect]);

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
        setErrorMessage(AUTH_REQUIRED_MESSAGE);
        return;
      }

      const result = await runSessionPreparingCreateOnce(session.access_token);
      if (dead) return;

      if (!result.ok) {
        resetSessionPreparingCreateInflight();
        setErrorMessage(result.error.message ?? CREATE_FAILED_MESSAGE);
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
          finishAndRedirect();
        }, REDIRECT_AFTER_FULL_MS);
      }, remaining);
    }

    run().catch((e) => {
      resetSessionPreparingCreateInflight();
      if (!dead) {
        setErrorMessage(e instanceof Error ? e.message : CREATE_FAILED_MESSAGE);
      }
    });

    return () => {
      dead = true;
      clearRedirectTimer();
    };
  }, [clearRedirectTimer, finishAndRedirect]);

  return {
    stageIndex,
    visualProgress,
    errorMessage,
    onSkipNext,
  };
}
