'use client';

/**
 * movement-test survey 페이지
 * 18문항 1문항씩 full-screen, 원형 5개 탭 시 즉시 저장 후 자동 다음
 * 시각: stitch survey scene (로직은 기존 truth 유지)
 */
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { QUESTIONS_V2 } from '@/features/movement-test/v2';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import { StitchSurveyShell } from '@/components/stitch/survey/StitchSurveyShell';
import StitchSurveyQuestion from '@/components/stitch/survey/StitchSurveyQuestion';

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
    return <StitchSurveyShell currentIndex={0} total={TOTAL} showBack={false} onBack={handlePrev} loading />;
  }

  return (
    <StitchSurveyShell
      currentIndex={step}
      total={TOTAL}
      showBack={step > 0}
      onBack={handlePrev}
    >
      <StitchSurveyQuestion
        stepIndex={step}
        questionText={question.text}
        currentAnswer={currentAnswer}
        onSelect={handleAnswer}
      />
    </StitchSurveyShell>
  );
}
