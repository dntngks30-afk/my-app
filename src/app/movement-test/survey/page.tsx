'use client';

/**
 * movement-test survey 페이지 (PR3-3)
 * QUESTIONS_V2 18문항을 축별 6단계 위저드로 진행 → result
 */
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  QUESTIONS_V2,
  ANSWER_CHOICES_V2,
  calculateScoresV2,
} from '@/features/movement-test/v2';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';
import type { AnimalAxis } from '@/features/movement-test/v2';
import type { TestAnswerValue } from '@/features/movement-test/v2';

/** 설문 답변 값: 0(전혀 아니다) ~ 4(거의 항상). 미선택은 undefined */
type AnswerValue = 0 | 1 | 2 | 3 | 4;
type AnswersById = Record<string, AnswerValue | undefined>;

const KEY = 'movementTestSession:v2';

const AXIS_ORDER: AnimalAxis[] = [
  'turtle',
  'hedgehog',
  'kangaroo',
  'penguin',
  'crab',
  'meerkat',
];

const DOMAIN_TO_AXIS: Record<string, AnimalAxis> = {
  A: 'turtle',
  B: 'hedgehog',
  C: 'kangaroo',
  D: 'penguin',
  F: 'crab',
  G: 'meerkat',
};

/** id에서 도메인·슬롯 추출 (v2_A1 -> { domain: 'A', slot: 1 }) */
function parseQuestionId(id: string): { domain: string; slot: number } {
  const match = id.match(/^v2_([A-Z])(\d)$/);
  if (!match) return { domain: '', slot: 0 };
  return { domain: match[1]!, slot: parseInt(match[2]!, 10) };
}

/** 축별로 묶고, 축 내부는 q1→q2→q3 정렬 */
function groupQuestionsByAxis() {
  const byAxis = new Map<AnimalAxis, Array<{ id: string; text: string }>>();
  for (const q of QUESTIONS_V2) {
    const { domain, slot } = parseQuestionId(q.id);
    const axis = DOMAIN_TO_AXIS[domain];
    if (!axis) continue;
    if (!byAxis.has(axis)) byAxis.set(axis, []);
    byAxis.get(axis)!.push({ id: q.id, text: q.text });
  }
  for (const arr of byAxis.values()) {
    arr.sort((a, b) => {
      const slotA = parseQuestionId(a.id).slot;
      const slotB = parseQuestionId(b.id).slot;
      return slotA - slotB;
    });
  }
  return AXIS_ORDER.map((axis) => ({
    axis,
    questions: byAxis.get(axis) ?? [],
  })).filter((g) => g.questions.length > 0);
}

const GROUPS = groupQuestionsByAxis();

interface SelfTestSession {
  isCompleted: boolean;
  answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
  completedAt?: string;
}

interface SessionV2 {
  version: 'v2';
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: Record<string, TestAnswerValue>;
  selfTest?: SelfTestSession;
  finalType?:
    | AnimalAxis
    | 'armadillo'
    | 'sloth'
    | 'monkey';
}

/** 저장된 answersById를 로드. 누락된 문항은 채우지 않음.
 * - isCompleted: true → 이전 테스트 결과. 새 테스트 시작이므로 answersById는 빈 객체.
 * - 전체 0이면 prefilled로 간주해 무시.
 */
function loadSession(): SessionV2 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;

    // [원인] 완료된 세션(isCompleted: true)은 "다시 테스트" 시 이전 답변이 그대로 복원되어 체크된 것처럼 보임 → 복원하지 않음
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
  const avg =
    axisEntries.reduce((sum, item) => sum + item.score, 0) /
    axisEntries.length;
  const sorted = [...axisEntries].sort((a, b) => b.score - a.score);
  return {
    avg,
    topAxis: sorted[0]?.axis ?? 'turtle',
    topScore: sorted[0]?.score ?? 0,
  };
}

const SCALE_VALUES = [0, 1, 2, 3, 4] as const;
/** 모바일 축소 후 크기: base 36/30/24, sm 40/34/28, md+ 44/36/28 */
/** 터치 영역 최소 44px (min-w-11), 시각적 크기는 sm/md에서 확대 */
const SCALE_SIZE_CLASS: Record<number, string> = {
  0: 'min-w-11 min-h-11 w-11 h-11 sm:w-10 sm:h-10 md:w-11 md:h-11',
  1: 'min-w-11 min-h-11 w-11 h-11 sm:w-9 sm:h-9 md:w-9 md:h-9',
  2: 'min-w-11 min-h-11 w-11 h-11 sm:w-8 sm:h-8 md:w-7 md:h-7',
  3: 'min-w-11 min-h-11 w-11 h-11 sm:w-9 sm:h-9 md:w-9 md:h-9',
  4: 'min-w-11 min-h-11 w-11 h-11 sm:w-10 sm:h-10 md:w-11 md:h-11',
};

export default function MovementTestSurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answersById, setAnswersById] = useState<AnswersById>({});
  const [ready, setReady] = useState(false);
  const [showSelfTestModal, setShowSelfTestModal] = useState(false);

  // 재진입/뒤로가기/BFCache 포함, 항상 새 테스트 상태로 시작
  const resetTestState = useCallback(() => {
    const current = loadSession();
    const fresh: SessionV2 = {
      version: 'v2',
      isCompleted: false,
      startedAt: new Date().toISOString(),
      profile: current?.profile ?? {},
      answersById: {},
      selfTest: undefined,
    };
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    saveSession(fresh);
    setStep(0);
    setAnswersById({});
    setShowSelfTestModal(false);
  }, []);

  useEffect(() => {
    resetTestState();
    setReady(true);
  }, [resetTestState]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const isBackForward = navEntries[0]?.type === 'back_forward';
      if (event.persisted || isBackForward) {
        resetTestState();
        setReady(true);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [resetTestState]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [step]);

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

  const group = GROUPS[step];
  const questionIds = group?.questions.map((q) => q.id) ?? [];
  const allAnswered =
    questionIds.length > 0 &&
    questionIds.every((id) => answersById[id] !== undefined);

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

  const handleAnswer = useCallback(
    (questionId: string, value: TestAnswerValue) => {
      const next: AnswersById = { ...answersById, [questionId]: value };
      setAnswersById(next);
      persist({ answersById: next });
    },
    [answersById, persist]
  );

  const handleNext = useCallback(() => {
    if (!allAnswered) return;
    const next = { ...answersById } as Record<string, TestAnswerValue>;
    persist({ answersById: next });

    if (step >= GROUPS.length - 1) {
      const { avg, topScore } = getAxisSummary(next);
      // 자가테스트 팝업: 6축 평균 35~49(포함)일 때만 노출
      if (avg >= 35 && avg <= 49) {
        setShowSelfTestModal(true);
        return;
      }

      // 전역 안전장치: Top1<=30이면 monkey 확정(자가테스트 완료 오버라이드 없음)
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
      router.push('/movement-test/result');
    } else {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [allAnswered, answersById, step, persist, router]);

  const handleSkipToResult = useCallback(() => {
    const next = { ...answersById } as Record<string, TestAnswerValue>;
    const s = loadSession();
    const { topAxis, topScore } = getAxisSummary(next);
    // 팝업 건너뛰기 확정: Top1<=30 → monkey, 아니면 Top1 축 타입
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
    router.push('/movement-test/result');
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

  if (!ready) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-[var(--muted)]">로딩 중...</p>
      </div>
    );
  }

  if (!group) {
    router.push('/movement-test/result');
    return null;
  }

  return (
    <NeoPageLayout maxWidth="lg">
      {/* Hero */}
      <section className="py-10 sm:py-12 md:py-16 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800 mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          무료 움직임 테스트
        </h1>
        <p className="text-sm sm:text-base text-slate-600 whitespace-normal break-keep">
          아래 문장에 얼마나 해당하는지 선택해주세요
        </p>
      </section>

      {/* 카드: 진행 + 질문 */}
      <section className="pb-10 sm:pb-12">
        <NeoCard className="p-4 sm:p-6 md:p-8">
          <p className="text-slate-600 text-xs sm:text-sm mb-4 md:mb-6">
            STEP {step + 1} / 6
          </p>

          <div className="space-y-6 md:space-y-8 overflow-x-hidden">
            {group.questions.map((q) => (
              <div key={q.id}>
                <p className="text-base sm:text-lg text-slate-800 font-medium mb-4 leading-relaxed whitespace-normal break-keep">
                  {q.text}
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="flex items-center justify-between text-xs text-slate-600 w-full md:hidden whitespace-normal break-keep"
                        aria-hidden
                      >
                        <span>전혀 아니다</span>
                        <span>거의 항상</span>
                      </div>
                      {/* 스케일 행 */}
                      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full min-w-0">
                        <span className="hidden md:block text-sm text-slate-600 shrink-0 whitespace-normal break-keep">
                          전혀 아니다
                        </span>
                        <div className="flex-1 flex items-center justify-center min-w-0">
                          <div
                            className="flex items-center justify-between w-full max-w-[320px] sm:max-w-[360px] md:max-w-[420px] gap-1 sm:gap-2"
                            role="group"
                            aria-label="응답 선택"
                          >
                            {SCALE_VALUES.map((value) => {
                              const selected = answersById[q.id] === value;
                              const sizeClass =
                                SCALE_SIZE_CLASS[value] ?? 'w-7 h-7';
                              const label =
                                ANSWER_CHOICES_V2.find(
                                  (c) => c.value === value
                                )?.label ?? '';
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() =>
                                    handleAnswer(
                                      q.id,
                                      value as TestAnswerValue
                                    )
                                  }
                                  aria-label={`${value} (${label})`}
                                  aria-pressed={selected}
                                  className={`
                                    rounded-full transition-all shrink-0
                                    flex items-center justify-center
                                    focus:outline-none focus:ring-2 focus:ring-orange-400
                                    hover:border-orange-400
                                    ${sizeClass}
                                    ${
                                      selected
                                        ? 'border-2 border-slate-900 bg-orange-400'
                                        : 'border-2 border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                                    }
                                  `}
                                >
                                  {selected && value === 2 ? (
                                    <span
                                      className="rounded-full bg-white"
                                      style={{ width: 8, height: 8 }}
                                    />
                                  ) : selected && value !== 2 ? (
                                    <span
                                      className="rounded-full bg-white opacity-90"
                                      style={{ width: 10, height: 10 }}
                                    />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <span className="hidden md:block text-sm text-slate-600 shrink-0 whitespace-normal break-keep">
                          거의 항상
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

          <div className="mt-6 md:mt-8 text-center">
            <NeoButton
              variant={allAnswered ? 'orange' : 'secondary'}
              disabled={!allAnswered}
              className="w-full sm:w-auto min-h-[44px] px-8 py-4"
              onClick={handleNext}
            >
              {step >= GROUPS.length - 1 ? '결과 보기' : '다음'}
            </NeoButton>
          </div>
        </NeoCard>
      </section>

      {/* 자가테스트 안내 모달 */}
      {showSelfTestModal && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="닫기"
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowSelfTestModal(false)}
            onKeyDown={(e) => e.key === 'Enter' && setShowSelfTestModal(false)}
          />
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            aria-modal
            aria-labelledby="self-test-modal-title"
          >
            <div
              className="w-full max-w-md mx-auto rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="self-test-modal-title" className="text-lg font-bold text-slate-800 mb-2 whitespace-normal break-keep">
                더 정확한 분석을 위해 1분 자가테스트를 진행하시겠어요?
              </h2>
              <p className="text-sm text-slate-600 mb-6 whitespace-normal break-keep">
                간단한 3가지 체크로 결과의 신뢰도를 높일 수 있어요.
              </p>
              <div className="flex flex-col gap-3">
                <NeoButton variant="orange" className="w-full min-h-[44px]" onClick={handleGoToSelfTest}>
                  자가테스트 하기
                </NeoButton>
                <NeoButton variant="secondary" className="w-full min-h-[44px]" onClick={handleSkipToResult}>
                  건너뛰기
                </NeoButton>
              </div>
            </div>
          </div>
        </>
      )}
    </NeoPageLayout>
  );
}
