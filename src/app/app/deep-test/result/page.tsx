'use client';

/**
 * Deep Test 결과 페이지
 * 경향/우선순위 톤, 진단 금지
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppTopBar from '../../_components/AppTopBar';
import BottomNav from '../../_components/BottomNav';
import PwaInstallModal from '@/components/pwa/PwaInstallModal';
import { usePwaInstall } from '@/lib/pwa/usePwaInstall';
import { getSessionSafe } from '@/lib/supabase';
import DeepResultViewClient from '@/components/deep-result/DeepResultViewClient';

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

export default function DeepTestResultPage() {
  const router = useRouter();
  const { canPromptInstall, isStandalone } = usePwaInstall();
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'empty' | 'error' | 'auth' | 'paywall'
  >('loading');
  const [result, setResult] = useState<DeepResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const handleRetry = () => {
    setErrorMessage('');
    setStatus('loading');
    setRetryTrigger((c) => c + 1);
  };

  const nbCard = 'rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]';
  const nbBtnPrimary = 'rounded-full border-2 border-slate-900 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';
  const nbBtnPrimaryBlock = 'block w-full rounded-full border-2 border-slate-900 bg-slate-800 py-4 text-center text-base font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';
  const nbBtnSecondary = 'rounded-full border-2 border-slate-900 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';
  const nbBtnSecondaryBlock = 'block w-full rounded-full border-2 border-slate-900 bg-white py-4 text-center text-base font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';

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
          setErrorMessage('결과를 불러오는데 실패했습니다.');
          setStatus('error');
          return;
        }

        const data = await res.json();
        if (data?.source === 'deep') {
          setResult(data);
          setStatus('ready');
        } else {
          setErrorMessage('잘못된 결과 형식입니다.');
          setStatus('error');
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('네트워크 오류가 발생했습니다.');
          setStatus('error');
        }
      }
    }

    load();
  }, [retryTrigger]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-stone-500">결과 불러오는 중...</p>
        </main>
      </div>
    );
  }

  if (status === 'auth') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-stone-600">로그인이 필요합니다.</p>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/app/auth?next=${encodeURIComponent('/app/deep-test/result')}`
              )
            }
            className={nbBtnPrimary}
          >
            로그인
          </button>
        </main>
      </div>
    );
  }

  if (status === 'paywall') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-stone-600">유료 플랜이 필요합니다.</p>
          <button
            type="button"
            onClick={() => router.push('/deep-analysis?pay=1')}
            className={nbBtnPrimary}
          >
            유료 플랜 알아보기
          </button>
        </main>
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
              아직 결과가 없어요. 심화 테스트를 완료하면 결과가 표시됩니다.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/app/deep-test" className={nbBtnPrimaryBlock}>
                심화 테스트 하러가기
              </Link>
              <Link href="/app/home" className={nbBtnSecondaryBlock}>
                홈으로
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
            <p className="text-base text-stone-600">
              결과를 불러오지 못했어요.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className={nbBtnPrimaryBlock}
              >
                다시 시도
              </button>
              <Link href="/app/home" className={nbBtnSecondaryBlock}>
                홈으로
              </Link>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const att = result?.attempt;
  const derived = att?.scores?.derived;
  const derivedForView = {
    result_type: att?.resultType ?? undefined,
    algorithm_scores: derived?.algorithm_scores,
    focus_tags: derived?.focus_tags ?? [],
    avoid_tags: derived?.avoid_tags ?? [],
  };

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">
              나의 움직임 경향
            </h1>
          </div>

          <DeepResultViewClient derived={derivedForView} variant="paid" />

          {/* 다음 단계 카드 */}
          <section className={`${nbCard} space-y-3`}>
            <h2 className="text-sm font-bold text-slate-800">다음 단계</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
              <li>루틴 탭에서 &apos;Start&apos;로 7일 여정을 시작</li>
              <li>오늘 루틴 5~8분만 완료</li>
              <li>체크인에서 컨디션 기록(선택)</li>
            </ol>
          </section>

          {/* CTA 섹션 */}
          <div className="flex flex-col gap-3">
            <Link href="/app/routine" className={nbBtnPrimaryBlock}>
              7일 맞춤 루틴 시작하기
            </Link>
            <Link href="/app/home" className={nbBtnSecondaryBlock}>
              홈으로
            </Link>
            <Link href="/app/deep-test" className="block w-full rounded-full border-2 border-slate-300 bg-white py-3 text-center text-sm font-medium text-slate-600 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95">
              심화 테스트 다시하기
            </Link>
          </div>

          {/* PWA Install Hub */}
          <section className={`${nbCard} space-y-3`}>
            <h2 className="text-sm font-bold text-slate-800">
              앱으로 설치하기
            </h2>
            <p className="text-xs text-stone-600">
              {isStandalone ? '앱에서 실행 중' : '홈 화면에 설치하면 앱처럼 실행'}
            </p>
            <div className="flex flex-wrap gap-2">
              {canPromptInstall && (
                <button
                  type="button"
                  onClick={() => setInstallModalOpen(true)}
                  className="flex-1 min-w-[120px] rounded-full border-2 border-slate-900 bg-slate-800 py-3 text-center text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  바로 설치하기
                </button>
              )}
              <Link
                href="/app/install?from=/app/deep-test/result"
                className="flex-1 min-w-[120px] rounded-full border-2 border-slate-900 bg-white py-3 text-center text-sm font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
              >
                설치 방법 보기
              </Link>
              <button
                type="button"
                className="rounded-full border-2 border-stone-300 bg-white px-4 py-3 text-sm font-medium text-slate-800"
              >
                나중에 하기
              </button>
            </div>
          </section>
        </div>
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
