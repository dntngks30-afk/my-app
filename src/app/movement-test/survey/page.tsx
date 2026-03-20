'use client';

/**
 * movement-test survey 페이지
 * 18문항 1문항씩 full-screen, 원형 5개 탭 시 즉시 저장 후 자동 다음
 * QUESTIONS_V2/answersById/movementTestSession:v2 계약 유지
 */
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  QUESTIONS_V2,
  ANSWER_CHOICES_V2,
  calculateScoresV2,
} from '@/features/movement-test/v2';
import { Starfield } from '@/components/landing/Starfield';
import type { AnimalAxis } from '@/features/movement-test/v2';
import type { TestAnswerValue } from '@/features/movement-test/v2';

type AnswerValue = 0 | 1 | 2 | 3 | 4;
type AnswersById = Record<string, AnswerValue | undefined>;

const KEY = 'movementTestSession:v2';
const BG = '#0d161f';
const ACCENT = '#ff7b00';
const TOTAL = QUESTIONS_V2.length;
const AUTO_ADVANCE_MS = 200;

interface SessionV2 {
  version: 'v2';
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: Record<string, TestAnswerValue>;
  selfTest?: { isCompleted: boolean; answersById: Record<string, 0 | 1 | 2 | 3 | 4> };
  finalType?: AnimalAxis | 'armadillo' | 'sloth' | 'monkey';
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
        selfTest: data.selfTest,
        finalType: data.finalType,
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
      selfTest: data.selfTest,
      finalType: data.finalType,
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

function normalizePercent(value: number): number {
  return value <= 1 ? value * 100 : value;
}

function getAxisSummary(answersById: Record<string, TestAnswerValue>) {
  const scored = calculateScoresV2(answersById);
  const axisEntries = Object.entries(scored.axisScores).map(([axis, score]) => ({
    axis: axis as AnimalAxis,
    score: normalizePercent(score),
  }));
  const avg = axisEntries.reduce((sum, item) => sum + item.score, 0) / axisEntries.length;
  const sorted = [...axisEntries].sort((a, b) => b.score - a.score);
  return {
    avg,
    topAxis: sorted[0]?.axis ?? 'turtle',
    topScore: sorted[0]?.score ?? 0,
  };
}

/** 첫 미응답 문항 인덱스. 모두 응답 시 TOTAL 반환 */
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
  const [showSelfTestModal, setShowSelfTestModal] = useState(false);
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
        selfTest: undefined,
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
        selfTest: undefined,
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
        selfTest: current?.selfTest,
        finalType: current?.finalType,
        ...updates,
      };
      saveSession(merged);
    },
    [answersById]
  );

  const advanceOrComplete = useCallback(
    (next: Record<string, TestAnswerValue>) => {
      if (step >= TOTAL - 1) {
        const { avg, topScore } = getAxisSummary(next);
        if (avg >= 35 && avg <= 49) {
          setShowSelfTestModal(true);
          return;
        }
        const s = loadSession();
        const final: SessionV2 = {
          version: 'v2',
          isCompleted: true,
          startedAt: s?.startedAt ?? new Date().toISOString(),
          completedAt: new Date().toISOString(),
          profile: s?.profile ?? {},
          answersById: next,
          selfTest: s?.selfTest,
          finalType: topScore <= 30 ? 'monkey' : undefined,
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

  const handleSkipToResult = useCallback(() => {
    const next = { ...answersById } as Record<string, TestAnswerValue>;
    const s = loadSession();
    const { topAxis, topScore } = getAxisSummary(next);
    const finalType: SessionV2['finalType'] = topScore <= 30 ? 'monkey' : topAxis;
    const final: SessionV2 = {
      version: 'v2',
      isCompleted: true,
      startedAt: s?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      profile: s?.profile ?? {},
      answersById: next,
      selfTest: s?.selfTest,
      finalType,
    };
    saveSession(final);
    setShowSelfTestModal(false);
    router.push('/movement-test/refine-bridge');
  }, [answersById, router]);

  const handleGoToSelfTest = useCallback(() => {
    const next = { ...answersById } as Record<string, TestAnswerValue>;
    const s = loadSession();
    const session: SessionV2 = {
      version: 'v2',
      isCompleted: false,
      startedAt: s?.startedAt ?? new Date().toISOString(),
      profile: s?.profile ?? {},
      answersById: next,
      selfTest: { isCompleted: false, answersById: {} },
      finalType: undefined,
    };
    saveSession(session);
    setShowSelfTestModal(false);
    router.push('/movement-test/self-test');
  }, [answersById, router]);

  useEffect(() => {
    if (!showSelfTestModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showSelfTestModal]);

  useEffect(() => {
    if (!showSelfTestModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSelfTestModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSelfTestModal]);

  if (!ready || !question) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <p className="text-slate-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      {/* 상단: 이전 + 진행 */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-12">
          {step > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="이전"
            >
              <ChevronLeft className="size-6" style={{ color: ACCENT }} />
            </button>
          ) : (
            <span />
          )}
        </div>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {step + 1} / {TOTAL}
        </p>
        <div className="w-12" />
      </header>

      {/* 진행 바 */}
      <div className="relative z-20 px-4 pb-2">
        <div className="h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((step + 1) / TOTAL) * 100}%`,
              backgroundColor: ACCENT,
            }}
          />
        </div>
      </div>

      {/* 질문 + 선택 */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div
          key={step}
          className="w-full max-w-md space-y-8 animate-in fade-in"
        >
          <p
            className="text-lg sm:text-xl text-slate-100 leading-relaxed break-keep"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {question.text}
          </p>

          <div className="flex flex-col items-center gap-4">
            <div
              className="flex items-center justify-center gap-2 sm:gap-3 w-full min-w-0"
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
                      shrink-0 min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 rounded-full
                      flex items-center justify-center transition-all duration-150
                      focus:outline-none focus:ring-2 focus:ring-[#ff7b00] focus:ring-offset-2 focus:ring-offset-[#0d161f]
                      ${selected
                        ? 'border-2 border-[#ff7b00] bg-[#ff7b00]/30'
                        : 'border-2 border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
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
            <p className="text-slate-500 text-xs" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              전혀 아니다 ← → 거의 항상
            </p>
          </div>
        </div>
      </main>

      {/* 자가테스트 모달 */}
      {showSelfTestModal && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="닫기"
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSelfTestModal(false)}
            onKeyDown={(e) => e.key === 'Enter' && setShowSelfTestModal(false)}
          />
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            aria-modal
            aria-labelledby="self-test-modal-title"
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d161f] p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="self-test-modal-title"
                className="text-lg font-bold text-slate-100 mb-2 break-keep"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                더 정확한 분석을 위해 1분 자가테스트를 진행하시겠어요?
              </h2>
              <p
                className="text-sm text-slate-400 mb-6 break-keep"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                간단한 3가지 체크로 결과의 신뢰도를 높일 수 있어요.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleGoToSelfTest}
                  className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  자가테스트 하기
                </button>
                <button
                  type="button"
                  onClick={handleSkipToResult}
                  className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5 transition-colors"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  건너뛰기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
