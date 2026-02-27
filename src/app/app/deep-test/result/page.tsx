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
import { supabase } from '@/lib/supabase';

const RESULT_TYPE_LABELS: Record<string, string> = {
  'NECK-SHOULDER': '목·어깨 경향',
  'LUMBO-PELVIS': '허리·골반 경향',
  'UPPER-LIMB': '상지 경향',
  'LOWER-LIMB': '하지 경향',
  DECONDITIONED: '전신 회복 우선',
  STABLE: '안정형',
};

const FOCUS_LABELS: Record<string, string> = {
  'NECK-SHOULDER': '목·어깨',
  'LUMBO-PELVIS': '허리·골반',
  'UPPER-LIMB': '손목·팔꿈치',
  'LOWER-LIMB': '무릎·발목',
  FULL: '전신 균형',
  NONE: '없음',
};

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
    'loading' | 'ready' | 'error' | 'auth' | 'paywall'
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
      const { data: { session } } = await supabase.auth.getSession();
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
          setErrorMessage('아직 심화 테스트 결과가 없습니다.');
          setStatus('error');
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

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-stone-600">{errorMessage}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/app/deep-test')}
              className={nbBtnSecondary}
            >
              심화 테스트 하기
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className={nbBtnPrimary}
            >
              다시 시도
            </button>
          </div>
        </main>
      </div>
    );
  }

  const att = result?.attempt;
  const resultType = att?.resultType ?? '-';
  const scores = att?.scores;
  const primaryFocus = scores?.primaryFocus;
  const secondaryFocus = scores?.secondaryFocus;
  const confidence = att?.confidence != null
    ? Math.round((att.confidence as number) * 100)
    : null;

  const isStable = resultType === 'STABLE';

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-400/90 text-slate-900 text-xs font-bold mb-4">
            심화 결과 (Deep)
          </div>

          <h1 className="text-xl font-bold text-slate-800 mb-2">
            나의 움직임 경향
          </h1>

          <div className={`${nbCard} space-y-4`}>
            <div>
              <p className="text-xs font-medium text-stone-500">
                움직임 패턴 경향
              </p>
              <p className="text-lg font-bold text-slate-800">
                {RESULT_TYPE_LABELS[resultType] ?? resultType}
              </p>
            </div>

            {isStable && (
              <p className="text-sm text-stone-600">
                안정형입니다. 전신 균형 루틴을 권장해요.
              </p>
            )}

            {primaryFocus && primaryFocus !== 'NONE' && (
              <div>
                <p className="text-xs font-medium text-stone-500">
                  우선순위 1
                </p>
                <p className="text-base font-semibold text-slate-800">
                  {FOCUS_LABELS[primaryFocus] ?? primaryFocus}
                </p>
              </div>
            )}

            {secondaryFocus && secondaryFocus !== 'NONE' && (
              <div>
                <p className="text-xs font-medium text-stone-500">
                  우선순위 2
                </p>
                <p className="text-base font-semibold text-slate-800">
                  {FOCUS_LABELS[secondaryFocus] ?? secondaryFocus}
                </p>
              </div>
            )}

            {confidence != null && (
              <div>
                <p className="text-xs font-medium text-stone-500">
                  응답 완성도
                </p>
                <p className="text-base font-semibold text-slate-800">{confidence}%</p>
              </div>
            )}
          </div>

          {/* PWA Install Hub */}
          <section className={`mt-8 ${nbCard} space-y-3`}>
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

          <div className="mt-8 flex flex-col gap-3">
            <Link href="/app/deep-test" className={nbBtnPrimaryBlock}>
              다시 테스트
            </Link>
            {isStandalone ? (
              <Link href="/app/home" className={nbBtnSecondaryBlock}>
                이제 앱에서 루틴을 시작해요
              </Link>
            ) : (
              <>
                <Link href="/app/home" className={nbBtnSecondaryBlock}>
                  홈으로
                </Link>
                <p className="text-xs text-stone-500 text-center">
                  설치하면 알림·출석이 편해져요
                </p>
              </>
            )}
          </div>
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
