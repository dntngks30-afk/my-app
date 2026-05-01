'use client';

/**
 * Public 메인 랜딩 페이지
 * Stitch landing transplant wrapper
 * - UI: src/components/stitch/landing/StitchLanding.tsx
 * - 로직: 여기서 유지
 * - PR-PILOT-ENTRY-01: ?pilot= attribution only; CTA cleanup runs only when this visit had valid pilot query
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  useEffect(() => {
    const code = getPilotCodeFromCurrentUrl();
    if (!code) return;
    pilotCodeThisVisitRef.current = code;
    savePilotContextFromCode(code, 'root_query');
  }, []);

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
    const readiness = await fetchReadinessClient();
    const hasConfiguredExecutionAccount =
      readiness?.onboarding?.is_complete === true &&
      (readiness.next_action.code === 'GO_APP_HOME' ||
        readiness.next_action.code === 'GO_SESSION_CREATE');

    if (hasConfiguredExecutionAccount) {
      setExistingAccountReadiness(readiness);
      setModalOpen(true);
      return;
    }

    runStartFlow();
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
      <StitchLanding onStart={handleStart} />
      <LandingReturnHomeCta />
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
