'use client';

/**
 * movement-test survey 페이지
 * 18문항 1문항씩 full-screen, 원형 5개 탭 시 즉시 저장 후 자동 다음
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md + public-brand primitives
 */
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { QUESTIONS_V2, ANSWER_CHOICES_V2 } from '@/features/movement-test/v2';
import { Starfield } from '@/components/landing/Starfield';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import { MoveReFullscreenScreen, MoveReProgressRail } from '@/components/public-brand';

type AnswerValue = 0 | 1 | 2 | 3 | 4;
type AnswersById = Record<string, AnswerValue | undefined>;

const KEY = 'movementTestSession:v2';
const TOTAL = QUESTIONS_V2.length;
const AUTO_ADVANCE_MS = 200;

interface SessionV2 {
  version: 'v2';
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: Record<string, TestAnswerValue>;
}

function loadSession(): SessionV2 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    if (data?.isCompleted === true) {
      return {
        version: 'v2',
        isCompleted: true,
        startedAt: data.startedAt ?? new Date().toISOString(),
        completedAt: data.completedAt,
        profile: data.profile,
        answersById: {},
      };
    }
    const rawById = data.answersById ?? {};
    const answersById: Record<string, TestAnswerValue> = {};
    let allZeros = true;
    for (const [k, v] of Object.entries(rawById)) {
      if (typeof v === 'number' && v >= 0 && v <= 4) {
        answersById[k] = v as TestAnswerValue;
        if (v !== 0) allZeros = false;
      }
    }
    const safeById = allZeros && Object.keys(answersById).length > 0 ? {} : answersById;
    return {
      version: 'v2',
      isCompleted: data.isCompleted ?? false,
      startedAt: data.startedAt ?? new Date().toISOString(),
      completedAt: data.completedAt,
      profile: data.profile,
      answersById: safeById,
    };
  } catch {
    return null;
  }
}

function saveSession(session: SessionV2) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch (e) {
    console.error('session save failed:', e);
  }
}

function getFirstUnansweredIndex(answersById: AnswersById): number {
  for (let i = 0; i < TOTAL; i++) {
    if (answersById[QUESTIONS_V2[i].id] === undefined) return i;
  }
  return TOTAL;
}

export default function MovementTestSurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answersById, setAnswersById] = useState<AnswersById>({});
  const [ready, setReady] = useState(false);
  const isTransitioningRef = useRef(false);

  const initFromSession = useCallback(() => {
    const current = loadSession();
    if (current?.isCompleted === true) {
      const fresh: SessionV2 = {
        version: 'v2',
        isCompleted: false,
        startedAt: new Date().toISOString(),
        profile: current.profile ?? {},
        answersById: {},
      };
      saveSession(fresh);
      setStep(0);
      setAnswersById({});
    } else if (current?.answersById && Object.keys(current.answersById).length > 0) {
      setAnswersById(current.answersById as AnswersById);
      const idx = getFirstUnansweredIndex(current.answersById as AnswersById);
      setStep(Math.min(idx, TOTAL - 1));
    } else {
      const fresh: SessionV2 = {
        version: 'v2',
        isCompleted: false,
        startedAt: new Date().toISOString(),
        profile: current?.profile ?? {},
        answersById: {},
      };
      saveSession(fresh);
      setStep(0);
      setAnswersById({});
    }
    setReady(true);
  }, []);

  useEffect(() => {
    initFromSession();
  }, [initFromSession]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) initFromSession();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [initFromSession]);

  const question = QUESTIONS_V2[step];
  const currentAnswer = question ? answersById[question.id] : undefined;

  const persist = useCallback(
    (updates: Partial<SessionV2>) => {
      const current = loadSession();
      const merged: SessionV2 = {
        version: 'v2',
        isCompleted: current?.isCompleted ?? false,
        startedAt: current?.startedAt ?? new Date().toISOString(),
        completedAt: current?.completedAt,
        profile: current?.profile ?? {},
        answersById: { ...(current?.answersById ?? {}), ...answersById },
        ...updates,
      };
      saveSession(merged);
    },
    [answersById]
  );

  const advanceOrComplete = useCallback(
    (next: Record<string, TestAnswerValue>) => {
      if (step >= TOTAL - 1) {
        const s = loadSession();
        const final: SessionV2 = {
          version: 'v2',
          isCompleted: true,
          startedAt: s?.startedAt ?? new Date().toISOString(),
          completedAt: new Date().toISOString(),
          profile: s?.profile ?? {},
          answersById: next,
        };
        saveSession(final);
        router.push('/movement-test/refine-bridge');
      } else {
        setStep((s) => s + 1);
      }
    },
    [step, router]
  );

  const handleAnswer = useCallback(
    (value: TestAnswerValue) => {
      if (!question || isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      const next: AnswersById = { ...answersById, [question.id]: value };
      setAnswersById(next);
      persist({ answersById: next });

      setTimeout(() => {
        advanceOrComplete(next as Record<string, TestAnswerValue>);
        isTransitioningRef.current = false;
      }, AUTO_ADVANCE_MS);
    },
    [question, answersById, persist, advanceOrComplete]
  );

  const handlePrev = useCallback(() => {
    if (step > 0 && !isTransitioningRef.current) setStep((s) => s - 1);
  }, [step]);

  if (!ready || !question) {
    return (
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">로딩 중...</p>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center justify-between px-4 pb-2 pt-4">
          <div className="w-12">
            {step > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex size-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
                aria-label="이전"
              >
                <ChevronLeft className="size-6 text-[var(--mr-public-accent)]" />
              </button>
            ) : (
              <span />
            )}
          </div>
          <p className="text-sm text-slate-400">
            {step + 1} / {TOTAL}
          </p>
          <div className="w-12" />
        </header>

        <MoveReProgressRail current={step + 1} total={TOTAL} className="pt-0" />

        <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          <div key={step} className="animate-in fade-in w-full max-w-md space-y-8">
            <p className="break-keep text-lg leading-relaxed text-slate-100 sm:text-xl">
              {question.text}
            </p>

            <div className="flex flex-col items-center gap-4">
              <div
                className="flex min-w-0 w-full items-center justify-center gap-2 sm:gap-3"
                role="group"
                aria-label="응답 선택"
              >
                {ANSWER_CHOICES_V2.map((choice) => {
                  const selected = currentAnswer === choice.value;
                  const label = choice.label;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => handleAnswer(choice.value)}
                      aria-label={label}
                      aria-pressed={selected}
                      className={`
                      flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-2
                      transition-all duration-150 sm:h-12 sm:w-12
                      focus:outline-none focus:ring-2 focus:ring-[var(--mr-public-accent)] focus:ring-offset-2 focus:ring-offset-[var(--mr-public-bg-base)]
                      ${
                        selected
                          ? 'mr-public-survey-choice-selected'
                          : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      }
                    `}
                    >
                      {selected && (
                        <span
                          className="rounded-full bg-white"
                          style={{ width: choice.value === 2 ? 8 : 10, height: choice.value === 2 ? 8 : 10 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">전혀 아니다 ← → 거의 항상</p>
            </div>
          </div>
        </main>
      </div>
    </MoveReFullscreenScreen>
  );
}
