'use client';

/**
 * Demo Deep Test - Multi-step wizard (NO API, localStorage only)
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEEP_V2_QUESTIONS, DEEP_SECTIONS, type DeepQuestion } from '@/app/app/deep-test/_data/questions';
import type { DeepAnswerValue } from '@/lib/deep-test/types';
import { calculateDeepV2, extendDeepV2 } from '@/lib/deep-test/scoring/deep_v2';
import { load, saveAnswers, saveDerived } from '@/lib/demo/deepTestDemoStorage';
import MovementGuideCard from '@/components/deep-test/MovementGuideCard';

function getQuestionsForSection(questionIds: readonly string[]): DeepQuestion[] {
  return questionIds
    .map((id) => DEEP_V2_QUESTIONS.find((q) => q.id === id))
    .filter((q): q is DeepQuestion => q != null);
}

function isQuestionAnswered(q: DeepQuestion, answers: Record<string, DeepAnswerValue>): boolean {
  const v = answers[q.id];
  if (q.type === 'number') return typeof v === 'number' && !Number.isNaN(v);
  if (q.type === 'single') return typeof v === 'string' && v.trim() !== '';
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
  return false;
}

function toAnswersRecord(partial: Record<string, unknown>): Record<string, DeepAnswerValue> {
  const out: Record<string, DeepAnswerValue> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      out[k] = v;
    } else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      out[k] = v as string[];
    }
  }
  return out;
}

const nbCard = 'rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_0_rgba(2,6,23,1)]';
const nbBtnPrimary = 'rounded-full border-2 border-slate-950 bg-slate-800 px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(2,6,23,1)] transition hover:opacity-95 disabled:opacity-50';
const nbBtnSecondary = 'rounded-full border-2 border-slate-950 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:opacity-95';

const GUIDE_CONFIG = {
  squat: {
    title: '스쿼트',
    subtitle: '맨몸 스쿼트 5회만 해보고, 느낌에 맞게 답해주세요.',
    bullets: [
      '발 어깨너비, 발바닥 전체가 바닥에.',
      '엉덩이를 뒤로 빼며 내려가고, 무릎은 발끝 방향.',
      '통증이 있으면 가능한 범위까지만.',
    ],
    videoMp4Src: '/deep-test/guides/squat.mp4',
    videoAlt: '스쿼트 동작 가이드',
  },
  wallangel: {
    title: '벽천사',
    subtitle: '벽에 등을 대고 팔을 위아래로 5회 움직여보세요.',
    bullets: [
      '뒤통수/등/엉덩이를 벽에(허리는 과하게 뜨지 않게).',
      '팔꿈치·손등이 벽에서 떨어지지 않게 천천히.',
      '통증/저림이 올라오면 범위를 줄이기.',
    ],
    videoMp4Src: '/deep-test/guides/wall-angel.mp4',
    videoAlt: '벽천사 동작 가이드',
  },
  sls: {
    title: '한발서기',
    subtitle: '한 발로 10초 버틴 뒤, 흔들림/통증을 체크하세요.',
    bullets: [
      '시선 정면, 골반 수평 유지.',
      '버티는 발은 엄지·새끼·뒤꿈치 3점 지지.',
      '무릎은 발끝 방향(안쪽으로 무너지지 않게).',
    ],
    videoMp4Src: '/deep-test/guides/one-leg-stand.mp4',
    videoAlt: '한발서기 동작 가이드',
  },
} as const;

export default function DemoWizard() {
  const router = useRouter();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DeepAnswerValue>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [ageWarning, setAgeWarning] = useState(false);

  useEffect(() => {
    const data = load();
    if (data?.answers && typeof data.answers === 'object') {
      setAnswers(toAnswersRecord(data.answers));
    }
  }, []);

  const currentSection = DEEP_SECTIONS[sectionIndex];
  const questions = currentSection
    ? getQuestionsForSection([...currentSection.questionIds])
    : [];
  const isLastSection = sectionIndex >= DEEP_SECTIONS.length - 1;

  const handleAnswer = (qId: string, value: DeepAnswerValue) => {
    setAgeWarning(false);
    setAnswers((prev) => {
      const next = { ...prev, [qId]: value };
      saveAnswers(next as Record<string, unknown>);
      return next;
    });
  };

  const handleMultiChange = (qId: string, optValue: string, checked: boolean) => {
    const current = (answers[qId] ?? []) as string[];
    const arr = Array.isArray(current) ? [...current] : [];

    setAgeWarning(false);
    if (optValue === '없음') {
      if (checked) {
        setAnswers((prev) => {
          const next = { ...prev, [qId]: ['없음'] };
          saveAnswers(next as Record<string, unknown>);
          return next;
        });
        return;
      }
      setAnswers((prev) => {
        const next = { ...prev, [qId]: arr.filter((x) => x !== '없음') };
        saveAnswers(next as Record<string, unknown>);
        return next;
      });
      return;
    }

    if (checked) {
      const nextArr = arr.filter((x) => x !== '없음').concat(optValue);
      setAnswers((prev) => {
        const next = { ...prev, [qId]: nextArr };
        saveAnswers(next as Record<string, unknown>);
        return next;
      });
    } else {
      setAnswers((prev) => {
        const next = { ...prev, [qId]: arr.filter((x) => x !== optValue) };
        saveAnswers(next as Record<string, unknown>);
        return next;
      });
    }
  };

  const topRef = useRef<HTMLDivElement>(null);

  const canProceedFromSection = (idx: number): boolean => {
    const section = DEEP_SECTIONS[idx];
    if (!section) return false;
    const qs = getQuestionsForSection([...section.questionIds]);
    return qs.every((q) => isQuestionAnswered(q, answers));
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrev = () => {
    setSectionIndex((i) => Math.max(0, i - 1));
    scrollToTop();
  };

  const handleNext = () => {
    if (!canProceedFromSection(sectionIndex)) {
      setAgeWarning(true);
      return;
    }
    setAgeWarning(false);

    if (isLastSection) {
      setFinalizing(true);
      try {
        const v2 = calculateDeepV2(answers);
        const extended = extendDeepV2(v2);
        saveDerived(extended as unknown as Record<string, unknown>);
        router.push('/deep-test/result');
      } catch (err) {
        console.error('Demo scoring error:', err);
        setFinalizing(false);
      }
    } else {
      setSectionIndex((i) => i + 1);
      scrollToTop();
    }
  };

  const guideKey = currentSection?.id;
  const guide = guideKey && guideKey in GUIDE_CONFIG ? GUIDE_CONFIG[guideKey as keyof typeof GUIDE_CONFIG] : null;

  if (finalizing) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-stone-500">결과 계산 중...</p>
      </div>
    );
  }

  return (
    <div ref={topRef} className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/deep-test" className="text-sm text-slate-600 hover:underline">
          ← 돌아가기
        </Link>
        <span className="text-sm font-semibold text-slate-600">
          {sectionIndex + 1} / {DEEP_SECTIONS.length}
        </span>
      </div>

      <h2 className="text-lg font-bold text-slate-800">
        {currentSection?.title}
      </h2>

      {guide && (
        <MovementGuideCard
          title={guide.title}
          subtitle={guide.subtitle}
          bullets={guide.bullets}
          videoMp4Src={guide.videoMp4Src}
          videoAlt={guide.videoAlt}
        />
      )}

      <div className="space-y-6">
        {questions.map((q) => (
          <div key={q.id} className={nbCard}>
            <p className="text-sm font-semibold text-slate-800 mb-3">{q.title}</p>

            {q.type === 'number' && (
              <input
                type="number"
                min={1}
                max={120}
                value={typeof answers[q.id] === 'number' ? (answers[q.id] as number) : ''}
                onChange={(e) => {
                  setAgeWarning(false);
                  const n = parseInt(e.target.value, 10);
                  if (e.target.value === '') {
                    setAnswers((prev) => {
                      const next = { ...prev };
                      delete next[q.id];
                      saveAnswers(next as Record<string, unknown>);
                      return next;
                    });
                  } else {
                    handleAnswer(q.id, Number.isNaN(n) ? 0 : n);
                  }
                }}
                className="w-full rounded-lg border-2 border-slate-950 bg-white px-4 py-3 text-slate-800"
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
                        ? 'border-slate-950 bg-slate-800 text-white shadow-[4px_4px_0_0_rgba(2,6,23,1)]'
                        : 'border-slate-950 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multi' && q.options && (
              <>
                <p className="text-xs text-stone-500 mb-2">1~2개 권장</p>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt) => {
                    const arr = (answers[q.id] ?? []) as string[];
                    const checked = arr.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-3 rounded-full border-2 border-slate-950 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => handleMultiChange(q.id, opt.value, e.target.checked)}
                          className="rounded border-2 border-slate-950"
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
      </div>

      {ageWarning && (
        <p className="text-sm text-amber-600 font-medium">모든 질문에 답해주세요.</p>
      )}

      <div className="flex gap-3 justify-end pt-4">
        {sectionIndex > 0 && (
          <button type="button" onClick={handlePrev} className={nbBtnSecondary}>
            이전
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceedFromSection(sectionIndex)}
          className={nbBtnPrimary}
        >
          {isLastSection ? '결과 보기' : '다음'}
        </button>
      </div>
    </div>
  );
}
