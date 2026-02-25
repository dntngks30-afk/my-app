'use client';

/**
 * Deep Test 진행 페이지 - 14문항 (number/single/multi)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppTopBar from '../../_components/AppTopBar';
import BottomNav from '../../_components/BottomNav';
import { supabase } from '@/lib/supabase';
import {
  DEEP_V2_QUESTIONS,
  DEEP_SECTIONS,
  type DeepQuestion,
} from '../_data/questions';
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

function getQuestionsForSection(sectionId: string): DeepQuestion[] {
  const section = DEEP_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  return section.questionIds
    .map((id) => DEEP_V2_QUESTIONS.find((q) => q.id === id))
    .filter((q): q is DeepQuestion => q != null);
}

export default function DeepTestRunPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DeepAnswerValue>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const debouncedAnswers = useDebounce(answers, 600);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const saveAnswers = useCallback(
    async (payload: Record<string, DeepAnswerValue>) => {
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
    },
    [attemptId, getToken]
  );

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
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (
      status !== 'ready' ||
      !attemptId ||
      Object.keys(debouncedAnswers).length === 0
    )
      return;
    saveAnswers(debouncedAnswers);
  }, [debouncedAnswers, status, attemptId, saveAnswers]);

  const currentSection = DEEP_SECTIONS[sectionIndex];
  const questions = currentSection
    ? getQuestionsForSection(currentSection.id)
    : [];
  const isLastSection = sectionIndex >= DEEP_SECTIONS.length - 1;

  const handleAnswer = (qId: string, value: DeepAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleMultiChange = (qId: string, optValue: string, checked: boolean) => {
    const current = (answers[qId] ?? []) as string[];
    const arr = Array.isArray(current) ? [...current] : [];

    if (optValue === '없음') {
      if (checked) {
        setAnswers((prev) => ({ ...prev, [qId]: ['없음'] }));
        return;
      }
      setAnswers((prev) => ({ ...prev, [qId]: arr.filter((x) => x !== '없음') }));
      return;
    }

    if (checked) {
      const next = arr.filter((x) => x !== '없음').concat(optValue);
      setAnswers((prev) => ({ ...prev, [qId]: next }));
    } else {
      setAnswers((prev) => ({
        ...prev,
        [qId]: arr.filter((x) => x !== optValue),
      }));
    }
  };

  const allAnsweredInSection = questions.every((q) => {
    const v = answers[q.id];
    if (q.type === 'number') {
      return typeof v === 'number' && !Number.isNaN(v);
    }
    if (q.type === 'single') {
      return typeof v === 'string' && v.length > 0;
    }
    if (q.type === 'multi') {
      const arr = v as string[] | undefined;
      return Array.isArray(arr) && arr.length > 0;
    }
    return false;
  });

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
            onClick={() =>
              router.push(
                `/app/auth?next=${encodeURIComponent('/app/deep-test/run')}`
              )
            }
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
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              {q.helperText && (
                <p className="text-xs text-[var(--muted)] mb-2">{q.helperText}</p>
              )}
              <p className="text-sm font-medium text-[var(--text)] mb-3">
                {q.title}
              </p>

              {q.type === 'number' && (
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={
                    typeof answers[q.id] === 'number'
                      ? (answers[q.id] as number)
                      : ''
                  }
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (e.target.value === '') {
                      setAnswers((prev) => {
                        const next = { ...prev };
                        delete next[q.id];
                        return next;
                      });
                    } else {
                      handleAnswer(q.id, Number.isNaN(n) ? 0 : n);
                    }
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)]"
                  placeholder="나이 입력"
                />
              )}

              {q.type === 'single' && q.options && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt) => (
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
              )}

              {q.type === 'multi' && q.options && (
                <>
                  <p className="text-xs text-[var(--muted)] mb-2">
                    1~2개 권장
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => {
                      const arr = (answers[q.id] ?? []) as string[];
                      const checked = arr.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 cursor-pointer hover:bg-[var(--surface-2)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              handleMultiChange(q.id, opt.value, e.target.checked)
                            }
                            className="rounded border-[var(--border)]"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          {saving && (
            <span className="text-xs text-[var(--muted)]">저장 중...</span>
          )}
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
