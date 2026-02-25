'use client';

/**
 * Deep Test 진행 페이지 - Stepper + autosave
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppTopBar from '../../_components/AppTopBar';
import BottomNav from '../../_components/BottomNav';
import { supabase } from '@/lib/supabase';
import { DEEP_SECTIONS } from '../_data/questions';
import type { DeepAnswerValue } from '@/lib/deep-test/types';

type Status = 'loading' | 'ready' | 'error' | 'auth' | 'paywall' | 'finalizing';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export default function DeepTestRunPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DeepAnswerValue>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const debouncedAnswers = useDebounce(answers, 800);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const saveAnswers = useCallback(async (payload: Record<string, DeepAnswerValue>) => {
    const token = await getToken();
    if (!token || !attemptId) return false;

    setSaving(true);
    try {
      const res = await fetch('/api/deep-test/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attemptId, patchAnswers: payload }),
      });
      if (res.ok) return true;
      if (res.status === 409) return true;
      return false;
    } finally {
      setSaving(false);
    }
  }, [attemptId, getToken]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = await getToken();
      if (!token) {
        if (!cancelled) setStatus('auth');
        return;
      }

      try {
        const res = await fetch('/api/deep-test/get-or-create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ scoringVersion: 'deep_v1' }),
        });

        if (cancelled) return;
        if (res.status === 401) { setStatus('auth'); return; }
        if (res.status === 403) { setStatus('paywall'); return; }
        if (!res.ok) {
          setErrorMessage('시작에 실패했습니다.');
          setStatus('error');
          return;
        }

        const data = await res.json();
        const att = data?.attempt;
        if (att?.id) {
          setAttemptId(att.id);
          setAnswers((att.answers ?? {}) as Record<string, DeepAnswerValue>);
        }
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setErrorMessage('네트워크 오류');
          setStatus('error');
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [getToken]);

  useEffect(() => {
    if (status !== 'ready' || !attemptId || Object.keys(debouncedAnswers).length === 0) return;
    saveAnswers(debouncedAnswers);
  }, [debouncedAnswers, status, attemptId, saveAnswers]);

  const currentSection = DEEP_SECTIONS[sectionIndex];
  const isLastSection = sectionIndex >= DEEP_SECTIONS.length - 1;

  const handleAnswer = (qId: string, value: DeepAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleNext = async () => {
    if (isLastSection) {
      setStatus('finalizing');
      const token = await getToken();
      if (!token || !attemptId) {
        setStatus('error');
        setErrorMessage('인증이 필요합니다.');
        return;
      }

      await saveAnswers(answers);

      const res = await fetch('/api/deep-test/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attemptId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err?.error || '확정에 실패했습니다.');
        setStatus('error');
        return;
      }

      router.push('/app/deep-test/result');
    } else {
      setSectionIndex((i) => i + 1);
    }
  };

  const allAnsweredInSection = currentSection?.questions.every(
    (q) => answers[q.id] !== undefined && answers[q.id] !== null
  );

  if (status === 'loading' || status === 'finalizing') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--muted)]">
            {status === 'finalizing' ? '결과 계산 중...' : '불러오는 중...'}
          </p>
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
            onClick={() => router.push(`/app/auth?next=${encodeURIComponent('/app/deep-test/run')}`)}
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
          <button
            type="button"
            onClick={() => router.push('/app/deep-test')}
            className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-semibold"
          >
            다시 시도
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <AppTopBar />
      <main className="container mx-auto px-4 py-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)] mb-2">
          Step {sectionIndex + 1} / {DEEP_SECTIONS.length}
        </p>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-6">
          {currentSection?.title}
        </h2>

        <div className="space-y-6">
          {currentSection?.questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm font-medium text-[var(--text)] mb-3">{q.text}</p>
              <div className="flex flex-col gap-2">
                {q.options?.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAnswer(q.id, opt.value)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      answers[q.id] === opt.value
                        ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                        : 'border-[var(--border)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          {saving && <span className="text-xs text-[var(--muted)]">저장 중...</span>}
          {!saving && <span />}
          <button
            type="button"
            onClick={handleNext}
            disabled={!allAnsweredInSection}
            className="rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLastSection ? '완료' : '다음'}
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
