'use client';

/**
 * 1분 자가테스트 페이지 (PR-FEATURE, v2: 4→3개)
 * 설문 완료 후 "자가테스트 하기" 선택 시 이동.
 * 3가지 가이드 + 각 1문항(0~4 스케일), 완료 시 결과 페이지로.
 */
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import type { AnimalAxis, TestAnswerValue } from '@/features/movement-test/v2';

const KEY = 'movementTestSession:v2';
const SELF_IDS = ['self1', 'self2', 'self3'] as const;
type SelfTestId = (typeof SELF_IDS)[number];
type SelfFinalType = 'turtle' | 'kangaroo' | 'penguin' | 'crab' | 'monkey';

const SELF_TESTS: Array<{
  id: SelfTestId;
  title: string;
  bullets: string[];
  question: string;
  options: Array<{ label: string; type: SelfFinalType }>;
}> = [
  {
    id: 'self1',
    title: '벽 천사(팔 올리기) 5회',
    bullets: [
      '뒤통수–등–엉덩이를 벽에 가볍게 붙이고, 허리가 과하게 뜨지 않게 유지한 채 팔을 위로 올렸다 내리기 5회.',
    ],
    question: '가장 가까운 느낌은?',
    options: [
      { label: '목이 뻐근하고 어깨가 올라가며 턱이 앞으로 나온다', type: 'turtle' },
      { label: '팔을 올리려면 허리가 뜨거나 꺾이며 허리로 버틴다', type: 'kangaroo' },
      { label: '팔 올릴 때 다리 힘이 흔들리고 무릎이 안쪽으로 모이기 쉽다', type: 'penguin' },
      { label: '왼쪽/오른쪽 차이가 확실하다(한쪽만 유독 막히거나 불편)', type: 'crab' },
      { label: '해당사항 없음', type: 'monkey' },
    ],
  },
  {
    id: 'self2',
    title: '제자리 스쿼트 5회',
    bullets: [
      '발은 어깨너비, 발바닥 전체로 바닥을 누르며 가능한 범위까지 앉았다 일어나기 5회(통증 범위 X).',
    ],
    question: '가장 가까운 현상은?',
    options: [
      { label: '내려갈 때 발이 안쪽으로 무너지거나 무릎이 안쪽으로 모인다', type: 'penguin' },
      { label: '내려가거나 올라올 때 허리가 꺾이거나 배 힘이 풀리며 허리로 버틴다', type: 'kangaroo' },
      { label: '상체가 앞으로 쏠리고 목이 앞으로 빠지며 버티는 느낌이다', type: 'turtle' },
      { label: '한쪽으로 체중이 쏠리거나 한쪽만 유독 불편하다', type: 'crab' },
      { label: '해당사항 없음', type: 'monkey' },
    ],
  },
  {
    id: 'self3',
    title: '한발서기 좌/우 10초',
    bullets: [
      '좌 10초 + 우 10초. “더 불안정했던 쪽” 기준으로 선택(한쪽이라도 문제면 그 보기 선택).',
    ],
    question: '(한쪽이라도) 가장 가까운 현상은?',
    options: [
      { label: '버티려다 목·어깨가 올라가고 숨을 멈추게 된다', type: 'turtle' },
      { label: '버티는 동안 허리가 꺾이거나 엉덩이가 앞으로 빠진다', type: 'kangaroo' },
      { label: '발이 크게 흔들리고 무릎이 안쪽으로 말린다', type: 'penguin' },
      { label: '좌우 차이가 뚜렷하고 한쪽만 유독 흔들리거나 불편하다', type: 'crab' },
      { label: '해당사항 없음', type: 'monkey' },
    ],
  },
];

interface SessionV2 {
  version: string;
  isCompleted?: boolean;
  startedAt?: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
  selfTest?: {
    isCompleted: boolean;
    answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
    finalType?: SelfFinalType;
    completedAt?: string;
  };
  finalType?: AnimalAxis | 'armadillo' | 'sloth' | 'monkey';
}

function loadSession(): SessionV2 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    return {
      version: data.version,
      isCompleted: data.isCompleted,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      profile: data.profile,
      answersById: data.answersById ?? {},
      selfTest: data.selfTest,
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

export default function SelfTestPage() {
  const router = useRouter();
  const [answersById, setAnswersById] = useState<
    Record<SelfTestId, number | undefined>
  >({ self1: undefined, self2: undefined, self3: undefined });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s?.answersById || Object.keys(s.answersById).length === 0) {
      router.replace('/movement-test/survey');
      return;
    }
    const prev = s?.selfTest?.answersById ?? {};
    const restored: Record<SelfTestId, number | undefined> = {
      self1: typeof prev.self1 === 'number' && prev.self1 >= 0 && prev.self1 <= 4 ? prev.self1 : undefined,
      self2: typeof prev.self2 === 'number' && prev.self2 >= 0 && prev.self2 <= 4 ? prev.self2 : undefined,
      self3: typeof prev.self3 === 'number' && prev.self3 >= 0 && prev.self3 <= 4 ? prev.self3 : undefined,
    };
    if (restored.self1 !== undefined || restored.self2 !== undefined || restored.self3 !== undefined) {
      setAnswersById(restored);
    }
    setReady(true);
  }, [router]);

  const handleAnswer = useCallback((id: SelfTestId, value: TestAnswerValue) => {
    setAnswersById((prev) => {
      const next = { ...prev, [id]: value };
      const s = loadSession();
      if (s?.answersById && Object.keys(s.answersById).length > 0) {
        const selfAnswers: Partial<Record<SelfTestId, 0 | 1 | 2 | 3 | 4>> = {};
        for (const k of SELF_IDS) {
          const v = next[k];
          if (typeof v === 'number') selfAnswers[k] = v as TestAnswerValue;
        }
        saveSession({
          ...s,
          selfTest: {
            isCompleted: false,
            answersById: selfAnswers,
          },
        });
      }
      return next;
    });
  }, []);

  const allAnswered = SELF_IDS.every((id) => answersById[id] !== undefined);

  const handleComplete = useCallback(() => {
    if (!allAnswered) return;
    const s = loadSession();
    if (!s?.answersById || Object.keys(s.answersById).length === 0) {
      router.replace('/movement-test/survey');
      return;
    }
    const selfAnswers: Record<SelfTestId, 0 | 1 | 2 | 3 | 4> = {} as Record<
      SelfTestId,
      0 | 1 | 2 | 3 | 4
    >;
    for (const id of SELF_IDS) {
      const v = answersById[id];
      if (typeof v === 'number' && v >= 0 && v <= 4) selfAnswers[id] = v as TestAnswerValue;
    }

    // 자가테스트 확정 규칙: 3문항 점수 합산(동점 시 한발서기 > 스쿼트 > 벽천사)
    const pickedTypeById: Partial<Record<SelfTestId, SelfFinalType>> = {};
    for (const item of SELF_TESTS) {
      const selected = selfAnswers[item.id];
      pickedTypeById[item.id] = item.options[selected]?.type;
    }
    const points: Record<SelfFinalType, number> = {
      turtle: 0,
      kangaroo: 0,
      penguin: 0,
      crab: 0,
      monkey: 0,
    };
    for (const id of SELF_IDS) {
      const picked = pickedTypeById[id];
      if (picked) points[picked] += 1;
    }
    const maxPoint = Math.max(...Object.values(points));
    const tiedTypes = (Object.keys(points) as SelfFinalType[]).filter(
      (k) => points[k] === maxPoint
    );
    let finalType: SelfFinalType = tiedTypes[0] ?? 'monkey';
    const tiePriority: SelfTestId[] = ['self3', 'self2', 'self1'];
    for (const qid of tiePriority) {
      const picked = pickedTypeById[qid];
      if (picked && tiedTypes.includes(picked)) {
        finalType = picked;
        break;
      }
    }

    const session: SessionV2 = {
      version: 'v2',
      isCompleted: true,
      startedAt: s.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      profile: s.profile ?? {},
      answersById: s.answersById,
      selfTest: {
        isCompleted: true,
        answersById: selfAnswers,
        finalType,
        completedAt: new Date().toISOString(),
      },
      finalType,
    };
    saveSession(session);
    router.push('/movement-test/result');
  }, [allAnswered, answersById, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-[var(--muted)]">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      <section className="py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1
              className="text-2xl sm:text-3xl font-bold text-[var(--text)] mb-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              1분 자가테스트
            </h1>
            <p className="text-sm text-[var(--muted)] whitespace-normal break-keep">
              아래 3가지만 따라 해보시고, 바로 아래 질문에 체크해주세요.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-10 sm:pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div
              className="
                rounded-[var(--radius)]
                bg-[var(--surface)]
                border border-[color:var(--border)]
                shadow-[var(--shadow-0)]
                p-4 sm:p-6 md:p-8
              "
            >
              <div className="space-y-8">
                {SELF_TESTS.map((item) => (
                  <div key={item.id}>
                    <h3 className="text-base font-semibold text-[var(--text)] mb-2">
                      {item.title}
                    </h3>
                    <ul className="text-sm text-[var(--muted)] space-y-1 mb-4 list-disc list-inside whitespace-normal break-keep">
                      {item.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                    <p className="text-sm sm:text-base text-[var(--text)] font-medium mb-2">
                      {item.question}
                    </p>
                    <div className="space-y-2">
                      {item.options.map((opt, idx) => {
                        const selected = answersById[item.id] === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAnswer(item.id, idx as TestAnswerValue)}
                            aria-pressed={selected}
                            className={`
                              w-full text-left min-h-[44px]
                              rounded-[var(--radius)] border px-3 py-2
                              transition-colors
                              ${selected
                                ? 'bg-[var(--brand)] text-white border-[color:var(--brand)]'
                                : 'bg-[var(--surface)] text-[var(--text)] border-[color:var(--border)] hover:border-[color:var(--brand)]'}
                            `}
                          >
                            <span className="text-sm sm:text-base whitespace-normal break-keep">
                              {idx + 1}) {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={!allAnswered}
                  className={`
                    w-full min-h-[44px]
                    inline-flex items-center justify-center
                    rounded-[var(--radius)]
                    px-8 py-4 font-bold
                    shadow-[var(--shadow-0)]
                    transition-all duration-200
                    ${
                      allAnswered
                        ? 'bg-[var(--brand)] text-white hover:opacity-95'
                        : 'bg-[var(--surface)] border border-[color:var(--border)] text-[var(--muted)] cursor-not-allowed'
                    }
                  `}
                >
                  최종 결과 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
