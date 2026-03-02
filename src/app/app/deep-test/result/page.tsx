'use client';

/**
 * Deep Test 寃곌낵 ?섏씠吏 (濡쒓렇??
 * - Backend: GET /api/deep-test/get-latest (Bearer)
 * - 寃곌낵 UI??_components/DeepTestResultContent.tsx (???곕え 怨듯넻)
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import AppTopBar from '../../_components/AppTopBar';
import BottomNav from '../../_components/BottomNav';
import PwaInstallModal from '@/components/pwa/PwaInstallModal';
import { usePwaInstall } from '@/lib/pwa/usePwaInstall';
import { getSessionSafe } from '@/lib/supabase';
import DeepTestResultContent from './_components/DeepTestResultContent';

interface DeepResult {
  source: string;
  scoring_version: string;
  attempt: {
    id: string;
    status: string;
    scores?: {
      objectiveScores?: Record<string, number>;
      finalScores?: Record<string, number>;
      primaryFocus?: string;
      secondaryFocus?: string;
      derived?: {
        focus_tags?: string[];
        avoid_tags?: string[];
        algorithm_scores?: {
          upper_score?: number;
          lower_score?: number;
          core_score?: number;
          balance_score?: number;
          pain_risk?: number;
        };
      };
    };
    resultType?: string | null;
    confidence?: number | null;
  };
}

type StatusState = 'loading' | 'ready' | 'empty' | 'error' | 'auth' | 'paywall';

export default function DeepTestResultPage() {
  const router = useRouter();
  const { canPromptInstall, isStandalone } = usePwaInstall();
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const [status, setStatus] = useState<StatusState>('loading');
  const [result, setResult] = useState<DeepResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const handleRetry = () => {
    setErrorMessage('');
    setStatus('loading');
    setRetryTrigger((c) => c + 1);
  };

  const nbCard =
    'rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]';
  const nbBtnPrimary =
    'rounded-full border-2 border-slate-900 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';
  const nbBtnPrimaryBlock =
    'block w-full rounded-[24px] border-[3px] border-black bg-[#FFB800] py-5 text-center text-lg font-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition active:translate-x-[4px] active:translate-y-[4px] active:shadow-none uppercase tracking-widest';
  const nbBtnSecondaryBlock =
    'block w-full rounded-full border-2 border-slate-900 bg-white py-4 text-center text-base font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        if (!cancelled) setStatus('auth');
        return;
      }

      try {
        const res = await fetch('/api/deep-test/get-latest', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (res.status === 401) {
          setStatus('auth');
          return;
        }
        if (res.status === 403) {
          setStatus('paywall');
          return;
        }
        if (res.status === 404) {
          setStatus('empty');
          return;
        }
        if (!res.ok) {
          setErrorMessage('寃곌낵瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.');
          setStatus('error');
          return;
        }

        const data = await res.json();
        if (data?.source === 'deep') {
          setResult(data);
          setStatus('ready');
        } else {
          setErrorMessage('?섎せ??寃곌낵 ?뺤떇?낅땲??');
          setStatus('error');
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('?ㅽ듃?뚰겕 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
          setStatus('error');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [retryTrigger]);

  // ?????????????????????????????????????????
  // ?곹깭 ?붾㈃(湲곗〈 ?좎?)
  // ?????????????????????????????????????????

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F7F3EE] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="bg-white border-[3px] border-black rounded-[32px] p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-2/3 bg-stone-200 rounded" />
                <div className="h-4 w-full bg-stone-200 rounded" />
                <div className="h-4 w-5/6 bg-stone-200 rounded" />
                <div className="h-10 w-full bg-stone-200 rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (status === 'auth') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-stone-600">濡쒓렇?몄씠 ?꾩슂?⑸땲??</p>
          <button
            type="button"
            onClick={() =>
              router.push(`/app/auth?next=${encodeURIComponent('/app/deep-test/result')}`)
            }
            className={nbBtnPrimary}
          >
            濡쒓렇??
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (status === 'paywall') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-stone-600">?좊즺 ?뚮옖???꾩슂?⑸땲??</p>
          <button
            type="button"
            onClick={() => router.push('/deep-analysis?pay=1')}
            className={nbBtnPrimary}
          >
            ?좊즺 ?뚮옖 ?뚯븘蹂닿린
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className={`${nbCard} max-w-md w-full p-6 text-center space-y-4`}>
            <p className="text-base text-stone-600">
              ?꾩쭅 寃곌낵媛 ?놁뼱?? ?ы솕 ?뚯뒪?몃? ?꾨즺?섎㈃ 寃곌낵媛 ?쒖떆?⑸땲??
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/app/deep-test" className={nbBtnPrimaryBlock}>
                ?ы솕 ?뚯뒪???섎윭媛湲?
              </Link>
              <Link href="/app/home" className={nbBtnSecondaryBlock}>
                ?덉쑝濡?
              </Link>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className={`${nbCard} max-w-md w-full p-6 text-center space-y-4`}>
            <p className="text-base text-stone-600">寃곌낵瑜?遺덈윭?ㅼ? 紐삵뻽?댁슂.</p>
            {errorMessage && (
              <p className="text-xs text-stone-500 font-medium break-keep">{errorMessage}</p>
            )}
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleRetry} className={nbBtnPrimaryBlock}>
                ?ㅼ떆 ?쒕룄
              </button>
              <Link href="/app/home" className={nbBtnSecondaryBlock}>
                ?덉쑝濡?
              </Link>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Ready: 怨듯넻 DeepTestResultContent ?ъ슜
  const att = result?.attempt;
  const derived = att?.scores?.derived;

  return (
    <div className="min-h-screen bg-[#F7F3EE] pb-24">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <DeepTestResultContent
          resultType={att?.resultType ?? null}
          confidence={att?.confidence ?? null}
          focusTags={derived?.focus_tags ?? []}
          avoidTags={derived?.avoid_tags ?? []}
          algorithmScores={derived?.algorithm_scores}
          scoringVersion={result?.scoring_version}
          attemptId={att?.id}
          variant="app"
          showPwaSection
          isStandalone={isStandalone}
          canPromptInstall={canPromptInstall}
          onInstallClick={() => setInstallModalOpen(true)}
        />
      </main>
      <BottomNav />
      <PwaInstallModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        context="deepResult"
      />
    </div>
  );
}
