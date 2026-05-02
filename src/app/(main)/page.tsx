'use client';

/**
 * Public 메인 랜딩 페이지
 * Stitch landing transplant wrapper
 * - UI: src/components/stitch/landing/StitchLanding.tsx
 * - 로직: 여기서 유지
 * - PR-PILOT-ENTRY-01: ?pilot= attribution only; CTA cleanup runs only when this visit had valid pilot query
 * - PR-WEB-PERF-02: landing readiness single-flight + polite route prefetch
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics/trackEvent';
import { FUNNEL_KEY } from '@/lib/public/intro-funnel';
import StitchLanding from '@/components/stitch/landing/StitchLanding';
import LandingReturnHomeCta from '@/components/landing/LandingReturnHomeCta';
import LandingExistingAccountModal from '@/components/landing/LandingExistingAccountModal';
import { fetchReadinessClient } from '@/lib/readiness/fetchReadinessClient';
import type { SessionReadinessV1 } from '@/lib/readiness/types';
import { supabaseBrowser } from '@/lib/supabase';
import {
  clearPublicPreAuthTempStateForPilotStart,
  getPilotCodeFromCurrentUrl,
  savePilotContextFromCode,
} from '@/lib/pilot/pilot-context';

type ReadinessLoadState = 'idle' | 'loading' | 'ready' | 'error';

function saveSurveyEntryMode() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      FUNNEL_KEY,
      JSON.stringify({ entryMode: 'survey' as const }),
    );
  } catch {
    // ignore
  }
}

function resolveExistingAccountDestination(readiness: SessionReadinessV1 | null): string {
  switch (readiness?.next_action.code) {
    case 'GO_APP_HOME':
      return '/app/home';
    case 'GO_SESSION_CREATE':
      return '/session-preparing';
    case 'GO_ONBOARDING':
      return '/onboarding';
    default:
      return '/app/home';
  }
}

export default function LandingPage() {
  const router = useRouter();
  const pilotCodeThisVisitRef = useRef<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingStartFresh, setLoadingStartFresh] = useState(false);
  const [existingAccountReadiness, setExistingAccountReadiness] = useState<SessionReadinessV1 | null>(null);

  const [readiness, setReadiness] = useState<SessionReadinessV1 | null>(null);
  const [readinessState, setReadinessState] = useState<ReadinessLoadState>('idle');
  const readinessPromiseRef = useRef<Promise<SessionReadinessV1 | null> | null>(null);
  const mountedRef = useRef(false);
  const startPendingRef = useRef(false);
  const landingTrackedRef = useRef(false);
  const [startPending, setStartPending] = useState(false);

  const loadReadinessOnce = useCallback(() => {
    if (readinessPromiseRef.current) return readinessPromiseRef.current;

    if (mountedRef.current) setReadinessState('loading');

    readinessPromiseRef.current = fetchReadinessClient()
      .then((value) => {
        if (mountedRef.current) {
          setReadiness(value);
          setReadinessState('ready');
        }
        return value;
      })
      .catch(() => {
        if (mountedRef.current) {
          setReadiness(null);
          setReadinessState('error');
        }
        return null;
      });

    return readinessPromiseRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadReadinessOnce();

    return () => {
      mountedRef.current = false;
    };
  }, [loadReadinessOnce]);

  useEffect(() => {
    const run = () => {
      try {
        router.prefetch('/intro/welcome');
        router.prefetch('/movement-test/survey');
        router.prefetch('/app/auth');
      } catch {
        /* prefetch best-effort */
      }
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const id = idleWindow.requestIdleCallback(run, { timeout: 2000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(run, 800);
    return () => window.clearTimeout(id);
  }, [router]);

  useEffect(() => {
    const code = getPilotCodeFromCurrentUrl();
    if (!code) return;
    pilotCodeThisVisitRef.current = code;
    savePilotContextFromCode(code, 'root_query');
  }, []);

  useEffect(() => {
    if (landingTrackedRef.current) return;
    landingTrackedRef.current = true;

    trackEvent(
      'landing_viewed',
      {
        route_group: 'public_landing',
      },
      {
        route_group: 'public_landing',
        dedupe_key: `landing_viewed:${new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Asia/Seoul',
        }).format(new Date())}`,
      }
    );
  }, []);

  const canReturnHome =
    readinessState === 'ready' &&
    readiness?.next_action.code === 'GO_APP_HOME' &&
    readiness?.onboarding?.is_complete === true;

  const runStartFlow = () => {
    const pilotCode = pilotCodeThisVisitRef.current;
    if (pilotCode) {
      clearPublicPreAuthTempStateForPilotStart();
      savePilotContextFromCode(pilotCode, 'root_query');
    }
    saveSurveyEntryMode();
    router.push('/intro/welcome');
  };

  const handleStart = async () => {
    if (startPendingRef.current) return;

    trackEvent(
      'public_cta_clicked',
      {
        route_group: 'public_landing',
        target_path: '/intro/welcome',
        entry_mode: 'survey',
      },
      {
        route_group: 'public_landing',
      }
    );

    startPendingRef.current = true;
    setStartPending(true);

    try {
      const current = await loadReadinessOnce();

      const code = current?.next_action?.code;
      const hasConfiguredExecutionAccount =
        current?.onboarding?.is_complete === true &&
        (code === 'GO_APP_HOME' || code === 'GO_SESSION_CREATE');

      if (hasConfiguredExecutionAccount && current) {
        setExistingAccountReadiness(current);
        setModalOpen(true);
        return;
      }

      runStartFlow();
    } finally {
      startPendingRef.current = false;
      setStartPending(false);
    }
  };

  const handleContinueExisting = () => {
    const destination = resolveExistingAccountDestination(existingAccountReadiness);
    setModalOpen(false);
    router.push(destination);
  };

  const handleStartFresh = async () => {
    try {
      setLoadingStartFresh(true);
      const { error } = await supabaseBrowser.auth.signOut();
      if (error) {
        alert('새 테스트 시작을 위해 로그아웃에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      clearPublicPreAuthTempStateForPilotStart();
      const pilotCode = pilotCodeThisVisitRef.current;
      if (pilotCode) {
        savePilotContextFromCode(pilotCode, 'root_query');
      }
      saveSurveyEntryMode();
      setModalOpen(false);
      router.push('/intro/welcome');
    } finally {
      setLoadingStartFresh(false);
    }
  };

  return (
    <>
      <StitchLanding onStart={handleStart} isStarting={startPending} />
      <LandingReturnHomeCta canReturnHome={canReturnHome} />
      <LandingExistingAccountModal
        open={modalOpen}
        onContinueAccount={handleContinueExisting}
        onStartFresh={handleStartFresh}
        onClose={() => setModalOpen(false)}
        isStartingFresh={loadingStartFresh}
      />
    </>
  );
}
