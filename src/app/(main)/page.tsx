'use client';

/**
 * Public 메인 랜딩 페이지
 * Stitch landing transplant wrapper
 * - UI: src/components/stitch/landing/StitchLanding.tsx
 * - 로직: 여기서 유지
 */

import { useRouter } from 'next/navigation';
import { FUNNEL_KEY } from '@/lib/public/intro-funnel';
import StitchLanding from '@/components/stitch/landing/StitchLanding';

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

  const handleStart = () => {
    saveSurveyEntryMode();
    router.push('/intro/welcome');
  };

  return <StitchLanding onStart={handleStart} />;
}