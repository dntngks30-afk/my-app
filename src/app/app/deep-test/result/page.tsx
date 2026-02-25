'use client';

/**
 * Deep Test 결과 페이지
 * source='deep' 확인, 무료와 혼동 방지
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppTopBar from '../../_components/AppTopBar';
import BottomNav from '../../_components/BottomNav';
import { supabase } from '@/lib/supabase';

interface DeepResult {
  source: string;
  scoring_version: string;
  attempt: {
    id: string;
    status: string;
    scores: Record<string, number> | null;
    resultType: string | null;
    confidence: number | null;
  };
}

export default function DeepTestResultPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'auth' | 'paywall'>('loading');
  const [result, setResult] = useState<DeepResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const handleRetry = () => {
    setErrorMessage('');
    setStatus('loading');
    setRetryTrigger((c) => c + 1);
  };

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
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (res.status === 401) { setStatus('auth'); return; }
        if (res.status === 403) { setStatus('paywall'); return; }
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
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--muted)]">결과 불러오는 중...</p>
        </main>
      </div>
    );
  }

  if (status === 'auth') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[var(--muted)]">로그인이 필요합니다.</p>
          <button
            type="button"
            onClick={() => router.push(`/app/auth?next=${encodeURIComponent('/app/deep-test/result')}`)}
            className="rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white"
          >
            로그인
          </button>
        </main>
      </div>
    );
  }

  if (status === 'paywall') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[var(--muted)]">유료 플랜이 필요합니다.</p>
          <button
            type="button"
            onClick={() => router.push('/deep-analysis?pay=1')}
            className="rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white"
          >
            유료 플랜 알아보기
          </button>
        </main>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[var(--muted)]">{errorMessage}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/app/deep-test')}
              className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-semibold"
            >
              심화 테스트 하기
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        </main>
      </div>
    );
  }

  const att = result?.attempt;
  const scores = att?.scores ?? {};
  const resultType = att?.resultType ?? '-';
  const confidence = att?.confidence != null ? Math.round((att.confidence as number) * 100) : null;

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand)]/20 text-[var(--brand)] text-xs font-semibold mb-4">
            심화 결과 (Deep)
          </div>

          <h1 className="text-xl font-bold text-[var(--text)] mb-2">
            나의 움직임 패턴
          </h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            source: {result?.source}, scoring_version: {result?.scoring_version}
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">결과 타입</p>
              <p className="text-lg font-semibold text-[var(--text)]">{resultType}</p>
            </div>
            {confidence != null && (
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">신뢰도</p>
                <p className="text-lg font-semibold text-[var(--text)]">{confidence}%</p>
              </div>
            )}
            {Object.keys(scores).length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-2">축별 점수</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(scores).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-lg bg-[var(--surface-2)] px-3 py-1 text-sm"
                    >
                      {k}: {typeof v === 'number' ? Math.round(v * 100) : v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/app/deep-test"
              className="block w-full rounded-lg bg-[var(--brand)] py-4 text-center text-base font-semibold text-white"
            >
              다시 테스트
            </Link>
            <Link
              href="/app"
              className="block w-full rounded-lg border border-[var(--border)] py-4 text-center text-base font-semibold"
            >
              홈으로
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
