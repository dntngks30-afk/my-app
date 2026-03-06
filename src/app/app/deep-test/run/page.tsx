'use client';

/**
 * Deep Test 진행 페이지 - 4섹션 Stepper UX (1페이지 = 1개 동작)
 * Section 1: 기본(5) / Section 2: 스쿼트(3) / Section 3: 벽천사(3) / Section 4: 한발서기(3)
 * - 버튼 클릭 시에만 save, autosave 없음
 * - UI-DEEP-ONB-ONE: Section 0에 주당 빈도(2/3/4/5) 추가, "다음" 시 profile best-effort 저장
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppTopBar from '../../_components/AppTopBar';
import BottomNav from '../../_components/BottomNav';
import { getSessionSafe } from '@/lib/supabase';
import { postSessionProfile } from '@/lib/session/client';
import { DEEP_V2_QUESTIONS, type DeepQuestion } from '../_data/questions';
import type { DeepAnswerValue } from '@/lib/deep-test/types';
import MovementGuideCard from '@/components/deep-test/MovementGuideCard';
import TargetFrequencyPicker, { type TargetFrequency } from '@/components/session/TargetFrequencyPicker';

const SESSION_FREQUENCY_DRAFT_KEY = 'session_target_frequency_draft';

type Status = 'loading' | 'ready' | 'error' | 'auth' | 'paywall' | 'finalizing';

/** PR3: 4섹션 고정 — 1페이지 = 1개 동작 (questions.ts 변경 없음) */
const STEPPER_SECTIONS = [
  {
    id: 'basic',
    title: '기본 정보',
    questionIds: [
      'deep_basic_age',
      'deep_basic_gender',
      'deep_basic_experience',
      'deep_basic_workstyle',
      'deep_basic_primary_discomfort',
      'deep_basic_more_uncomfortable_side',
      'deep_basic_main_limitation_type',
      'deep_basic_discomfort_frequency',
      'deep_basic_discomfort_trigger',
    ],
  },
  {
    id: 'squat',
    title: '스쿼트',
    questionIds: [
      'deep_squat_pain_intensity',
      'deep_squat_pain_location',
      'deep_squat_knee_alignment',
    ],
  },
  {
    id: 'wallangel',
    title: '벽천사',
    questionIds: [
      'deep_wallangel_pain_intensity',
      'deep_wallangel_pain_location',
      'deep_wallangel_quality',
    ],
  },
  {
    id: 'sls',
    title: '한발서기',
    questionIds: [
      'deep_sls_pain_intensity',
      'deep_sls_pain_location',
      'deep_sls_quality',
    ],
  },
] as const;

function getQuestionsForSection(questionIds: readonly string[]): DeepQuestion[] {
  return questionIds
    .map((id) => DEEP_V2_QUESTIONS.find((q) => q.id === id))
    .filter((q): q is DeepQuestion => q != null);
}

function getSectionIndexFromAnswers(answers: Record<string, DeepAnswerValue>): number {
  for (let i = STEPPER_SECTIONS.length - 1; i >= 0; i--) {
    const ids = STEPPER_SECTIONS[i].questionIds;
    if (ids.some((id) => {
      const v = answers[id];
      return v !== undefined && v !== null && v !== '';
    })) {
      return i;
    }
  }
  return 0;
}

function isQuestionAnswered(q: DeepQuestion, answers: Record<string, DeepAnswerValue>): boolean {
  const v = answers[q.id];
  if (q.type === 'number') return typeof v === 'number' && !Number.isNaN(v);
  if (q.type === 'single') return typeof v === 'string' && v.trim() !== '';
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
  return false;
}

export default function DeepTestRunPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DeepAnswerValue>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [targetFrequency, setTargetFrequency] = useState<TargetFrequency>(3);
  const frequencyDraftLoaded = useRef(false);

  useEffect(() => {
    if (frequencyDraftLoaded.current) return;
    frequencyDraftLoaded.current = true;
    try {
      const draft = sessionStorage.getItem(SESSION_FREQUENCY_DRAFT_KEY);
      if (draft) {
        const n = parseInt(draft, 10);
        if ([2, 3, 4, 5].includes(n)) setTargetFrequency(n as TargetFrequency);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const getToken = useCallback(async () => {
    const { session } = await getSessionSafe();
    return session?.access_token ?? null;
  }, []);

  const saveAnswers = useCallback(
    async (payload: Record<string, DeepAnswerValue>) => {
      const token = await getToken();
      if (!token || !attemptId) return { ok: false as const, error: '인증이 필요합니다.' };

      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/deep-test/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ attemptId, patchAnswers: payload }),
        });
        if (res.ok || res.status === 409) return { ok: true as const };
        const err = await res.json().catch(() => ({}));
        return { ok: false as const, error: err?.error || '저장에 실패했습니다.' };
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
          if (att.status === 'final') {
            if (!cancelled) router.push('/app/deep-test/result');
            return;
          }
          const loadedAnswers = (att.answers ?? {}) as Record<string, DeepAnswerValue>;
          setAttemptId(att.id);
          setAnswers(loadedAnswers);
          setSectionIndex(getSectionIndexFromAnswers(loadedAnswers));
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

  const currentSection = STEPPER_SECTIONS[sectionIndex];
  const questions = currentSection
    ? getQuestionsForSection(currentSection.questionIds)
    : [];
  const isLastSection = sectionIndex >= STEPPER_SECTIONS.length - 1;

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

  const mainRef = useRef<HTMLElement>(null);

  const canProceedFromSection = (idx: number): boolean => {
    const ids = STEPPER_SECTIONS[idx].questionIds;
    const qs = getQuestionsForSection(ids);
    return qs.every((q) => isQuestionAnswered(q, answers));
  };

  function buildPatchForSection(idx: number): Record<string, DeepAnswerValue> {
    const ids = STEPPER_SECTIONS[idx].questionIds;
    const patch: Record<string, DeepAnswerValue> = {};
    for (const id of ids) {
      const v = answers[id];
      if (v !== undefined && v !== null && v !== '') {
        if (Array.isArray(v) && v.length === 0) continue;
        patch[id] = v;
      }
    }
    return patch;
  }

  const scrollToTop = () => {
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrev = () => {
    setSaveError(null);
    setSectionIndex((i) => Math.max(0, i - 1));
    scrollToTop();
  };

  const handleNext = async () => {
    if (!canProceedFromSection(sectionIndex)) {
      setSaveError('모든 질문에 답해주세요.');
      return;
    }
    setSaveError(null);

    const patch = buildPatchForSection(sectionIndex);
    if (Object.keys(patch).length > 0) {
      const result = await saveAnswers(patch);
      if (!result.ok) {
        setSaveError(result.error ?? '저장에 실패했습니다.');
        return;
      }
    }

    if (sectionIndex === 0) {
      const token = await getToken();
      if (token) {
        try {
          const profileResult = await postSessionProfile(token, {
            target_frequency: targetFrequency,
          });
          if (!profileResult.ok) {
            try {
              sessionStorage.setItem(SESSION_FREQUENCY_DRAFT_KEY, String(targetFrequency));
            } catch {
              /* ignore */
            }
          } else {
            try {
              sessionStorage.removeItem(SESSION_FREQUENCY_DRAFT_KEY);
            } catch {
              /* ignore */
            }
          }
        } catch {
          try {
            sessionStorage.setItem(SESSION_FREQUENCY_DRAFT_KEY, String(targetFrequency));
          } catch {
            /* ignore */
          }
        }
      }
    }

    if (isLastSection) {
      setStatus('finalizing');
      const token = await getToken();
      if (!token || !attemptId) {
        setStatus('error');
        setErrorMessage('인증이 필요합니다.');
        return;
      }

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
        setSaveError(err?.error || '확정에 실패했습니다.');
        setStatus('ready');
        return;
      }

      router.push('/app/deep-test/result');
    } else {
      setSectionIndex((i) => i + 1);
      scrollToTop();
    }
  };

  const nbBtnPrimary = 'rounded-full border-2 border-slate-900 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-0';
  const nbBtnSecondary = 'rounded-full border-2 border-slate-900 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)] disabled:opacity-50';

  if (status === 'loading' || status === 'finalizing') {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex flex-col">
        <AppTopBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-stone-500">
            {status === 'finalizing' ? '결과 계산 중...' : '불러오는 중...'}
          </p>
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
                `/app/auth?next=${encodeURIComponent('/app/deep-test/run')}`
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
          <button
            type="button"
            onClick={() => router.push('/app/deep-test')}
            className={nbBtnSecondary}
          >
            다시 시도
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-24">
      <AppTopBar />
      <main ref={mainRef} className="container mx-auto px-4 py-6">
        <span className="text-sm font-semibold text-orange-500">
          {sectionIndex + 1} / {STEPPER_SECTIONS.length}
        </span>
        <h2 className="mt-2 text-lg font-bold text-slate-800 mb-6">
          {currentSection?.title}
        </h2>

        <div className="space-y-6">
          {sectionIndex === 1 && (
            <MovementGuideCard
              title="스쿼트"
              subtitle="맨몸 스쿼트 5회만 해보고, 느낌에 맞게 답해주세요."
              bullets={[
                '발 어깨너비, 발바닥 전체가 바닥에.',
                '엉덩이를 뒤로 빼며 내려가고, 무릎은 발끝 방향.',
                '통증이 있으면 가능한 범위까지만.',
              ]}
              videoMp4Src="/deep-test/guides/squat.mp4"
              videoAlt="스쿼트 동작 가이드"
            />
          )}
          {sectionIndex === 2 && (
            <MovementGuideCard
              title="벽천사"
              subtitle="벽에 등을 대고 팔을 위아래로 5회 움직여보세요."
              bullets={[
                '뒤통수/등/엉덩이를 벽에(허리는 과하게 뜨지 않게).',
                '팔꿈치·손등이 벽에서 떨어지지 않게 천천히.',
                '통증/저림이 올라오면 범위를 줄이기.',
              ]}
              videoMp4Src="/deep-test/guides/wall-angel.mp4"
              videoAlt="벽천사 동작 가이드"
            />
          )}
          {sectionIndex === 3 && (
            <MovementGuideCard
              title="한발서기"
              subtitle="한 발로 10초 버틴 뒤, 흔들림/통증을 체크하세요."
              bullets={[
                '시선 정면, 골반 수평 유지.',
                '버티는 발은 엄지·새끼·뒤꿈치 3점 지지.',
                '무릎은 발끝 방향(안쪽으로 무너지지 않게).',
              ]}
              videoMp4Src="/deep-test/guides/one-leg-stand.mp4"
              videoAlt="한발서기 동작 가이드"
            />
          )}
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
            >
              {q.helperText && (
                <p className="text-xs text-stone-500 mb-2">{q.helperText}</p>
              )}
              <p className="text-sm font-semibold text-slate-800 mb-3">
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
                  className="w-full rounded-lg border-2 border-slate-900 bg-white px-4 py-3 text-slate-800"
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
                      className={`rounded-full border-2 px-4 py-3 text-left text-sm font-medium transition ${
                        answers[q.id] === opt.value
                          ? 'border-slate-900 bg-slate-800 text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
                          : 'border-slate-900 bg-white text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multi' && q.options && (
                <>
                  <p className="text-xs text-stone-500 mb-2">
                    1~2개 권장
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => {
                      const arr = (answers[q.id] ?? []) as string[];
                      const checked = arr.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-3 rounded-full border-2 border-slate-900 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              handleMultiChange(q.id, opt.value, e.target.checked)
                            }
                            className="rounded border-2 border-slate-900"
                          />
                          <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
          {sectionIndex === 0 && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 shadow-[4px_4px_0_0_rgba(251,191,36,0.5)]">
              <p className="text-sm font-semibold text-amber-900 mb-2">운동 계획 / 세션 설정</p>
              <p className="text-xs text-amber-800/80 mb-3">
                주당 목표 횟수는 진단 결과와 무관하게 세션 배분에만 사용됩니다.
              </p>
              <TargetFrequencyPicker
                value={targetFrequency}
                onChange={setTargetFrequency}
              />
            </div>
          )}
        </div>

        {saveError && (
          <p className="mt-4 text-sm text-amber-600 font-medium">
            {saveError}
          </p>
        )}
        <div className="mt-8 flex items-center justify-between gap-3">
          {saving ? (
            <span className="text-xs text-stone-500">저장 중...</span>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            {sectionIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={saving}
                className={nbBtnSecondary}
              >
                이전
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={saving || !canProceedFromSection(sectionIndex)}
              className={nbBtnPrimary}
            >
              {isLastSection ? '결과 보기' : '다음'}
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
