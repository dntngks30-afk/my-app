'use client';

/**
 * Deep Test 시작/재개 페이지 (AppAuthGate 뒤)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppTopBar from '../_components/AppTopBar';
import BottomNav from '../_components/BottomNav';
import { supabase } from '@/lib/supabase';

interface AttemptInfo {
  id: string;
  status: string;
  answers: Record<string, unknown>;
}

export default function DeepTestStartPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'auth' | 'paywall'>('loading');
  const [attempt, setAttempt] = useState<AttemptInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setStatus('auth');
          return;
        }

        const res = await fetch('/api/deep-test/get-or-create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ scoringVersion: 'deep_v2' }),
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
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setErrorMessage(err?.error || '불러오기에 실패했습니다.');
          setStatus('error');
          return;
        }

        const data = await res.json();
        if (data?.source === 'deep' && data?.attempt) {
          setAttempt(data.attempt);
        }
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setErrorMessage('네트워크 오류가 발생했습니다.');
          setStatus('error');
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const hasAnswers = attempt && typeof attempt.answers === 'object' && Object.keys(attempt.answers).length > 0;

  const handleStart = () => {
    router.push('/app/deep-test/run');
  };

  const nbCard = 'rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]';
  const nbBtnPrimary = 'rounded-full border-2 border-slate-900 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';
  const nbBtnSecondary = 'rounded-full border-2 border-slate-900 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-stone-500">확인 중...</p>
        </main>
      </div>
    );
  }

  if (status === 'auth') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <h2 className="text-lg font-bold text-slate-800">로그인이 필요해요</h2>
          <p className="text-sm text-stone-600 text-center max-w-sm">
            심화 테스트를 하려면 로그인해 주세요.
          </p>
          <Link
            href={`/app/auth?next=${encodeURIComponent('/app/deep-test')}`}
            className={nbBtnPrimary}
          >
            로그인하기
          </Link>
        </main>
      </div>
    );
  }

  if (status === 'paywall') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <h2 className="text-lg font-bold text-slate-800">유료 권한이 필요해요</h2>
          <p className="text-sm text-stone-600 text-center max-w-sm">
            심화 테스트는 유료 플랜 사용자만 이용할 수 있어요.
          </p>
          <Link
            href="/deep-analysis?pay=1"
            className={nbBtnPrimary}
          >
            유료 플랜 알아보기
          </Link>
        </main>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <h2 className="text-lg font-bold text-slate-800">문제가 생겼어요</h2>
          <p className="text-sm text-stone-600 text-center">{errorMessage}</p>
          <button
            type="button"
            onClick={() => { setStatus('loading'); setErrorMessage(''); router.refresh(); }}
            className={nbBtnSecondary}
          >
            다시 시도
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className={nbCard}>
            <span className="text-sm font-semibold text-orange-500">심화 테스트 (Deep)</span>
            <h1 className="mt-2 text-xl font-bold text-slate-800 mb-2">
              나의 움직임 패턴 심층 분석
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              14개 문항으로 더 정밀한 움직임 경향과 우선순위를 확인할 수 있어요.
            </p>

            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-full border-2 border-slate-900 bg-slate-800 py-4 text-base font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
            >
              {hasAnswers ? '이어하기' : '시작하기'}
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
