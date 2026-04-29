'use client';

/**
 * Public 메인 랜딩 페이지
 * Stitch landing transplant wrapper
 * - UI: src/components/stitch/landing/StitchLanding.tsx
 * - 로직: 여기서 유지
 * - PR-PILOT-ENTRY-01: ?pilot= attribution only; CTA cleanup runs only when this visit had valid pilot query
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FUNNEL_KEY } from '@/lib/public/intro-funnel';
import StitchLanding from '@/components/stitch/landing/StitchLanding';
import LandingReturnHomeCta from '@/components/landing/LandingReturnHomeCta';
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

export default function LandingPage() {
  const router = useRouter();
  const pilotCodeThisVisitRef = useRef<string | null>(null);

  useEffect(() => {
    const code = getPilotCodeFromCurrentUrl();
    if (!code) return;
    pilotCodeThisVisitRef.current = code;
    savePilotContextFromCode(code, 'root_query');
  }, []);

  const handleStart = () => {
    const pilotCode = pilotCodeThisVisitRef.current;
    if (pilotCode) {
      clearPublicPreAuthTempStateForPilotStart();
      savePilotContextFromCode(pilotCode, 'root_query');
    }
    saveSurveyEntryMode();
    router.push('/intro/welcome');
  };

  return (
    <>
      <StitchLanding onStart={handleStart} />
      <LandingReturnHomeCta />
    </>
  );
}