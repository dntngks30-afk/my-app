'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { createSession } from '@/lib/session/client';
import {
  loadBridgeContext,
  clearBridgeContext,
} from '@/lib/public-results/public-result-bridge';
import { claimPublicResultClient } from '@/lib/public-results/useClaimPublicResult';
import { redeemPilotAccessClient } from '@/lib/pilot/redeemPilotAccessClient';
import { mapPilotRedeemErrorToMessage } from '@/lib/pilot/pilot-redeem-ui-messages';

// Minimum dwell on the success path. Env override allowed, default 10s.
export const SESSION_PREPARING_DWELL_FLOOR_MS =
  Number(process.env.NEXT_PUBLIC_SESSION_PREPARING_DWELL_MS) > 0
    ? Number(process.env.NEXT_PUBLIC_SESSION_PREPARING_DWELL_MS)
    : 10000;

type PipelineResult =
  | { ok: true }
  | { ok: false; stage: 'auth' | 'claim' | 'pilot_redeem' | 'create'; message: string };

// Module-level in-flight owner: covers the full claim+create pipeline.
// Prevents duplicate runs across StrictMode/remount.
let sessionPreparingPipelineInflight: Promise<PipelineResult> | null = null;

async function runPipeline(accessToken: string): Promise<PipelineResult> {
  const ctx = loadBridgeContext();
  const hadBridge = Boolean(ctx?.publicResultId);
  let claimSucceeded = false;

  if (ctx?.publicResultId) {
    const claimResult = await claimPublicResultClient(ctx.publicResultId, ctx.anonId ?? null);
    if (!claimResult.ok) {
      return { ok: false, stage: 'claim', message: '결과를 연결하지 못했습니다.' };
    }
    claimSucceeded = true;
  }

  const redeemResult = await redeemPilotAccessClient(accessToken);
  if (!redeemResult.ok) {
    return {
      ok: false,
      stage: 'pilot_redeem',
      message: mapPilotRedeemErrorToMessage(redeemResult.code, redeemResult.message),
    };
  }

  if (hadBridge && claimSucceeded) {
    clearBridgeContext();
  }

  const createResult = await createSession(accessToken, {
    condition_mood: 'ok',
    time_budget: 'normal',
    summary: true,
  });

  if (!createResult.ok) {
    return {
      ok: false,
      stage: 'create',
      message: createResult.error.message ?? '세션을 준비하지 못했습니다.',
    };
  }

  return { ok: true };
}

function runPipelineOnce(accessToken: string): Promise<PipelineResult> {
  if (!sessionPreparingPipelineInflight) {
    sessionPreparingPipelineInflight = runPipeline(accessToken);
  }
  return sessionPreparingPipelineInflight;
}

// Allow a fresh pipeline after a failure or explicit exit.
function resetPipelineInflight() {
  sessionPreparingPipelineInflight = null;
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
};

const AUTH_REQUIRED_MESSAGE = '로그인이 필요합니다.';

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
    resetPipelineInflight();
    onReadyRedirect();
  }, [clearRedirectTimer, onReadyRedirect]);

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

      const result = await runPipelineOnce(session.access_token);
      if (dead) return;

      if (!result.ok) {
        resetPipelineInflight();
        setErrorMessage(result.message);
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
      resetPipelineInflight();
      if (!dead) {
        setErrorMessage(e instanceof Error ? e.message : '세션을 준비하지 못했습니다.');
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
  };
}
