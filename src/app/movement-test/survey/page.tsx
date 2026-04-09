'use client';

/**
 * movement-test survey page
 * 18 questions, one full-screen question at a time.
 * Current run owner is React state, and localStorage is only draft recovery cache.
 */
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { QUESTIONS_V2 } from '@/features/movement-test/v2';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import { StitchSurveyShell } from '@/components/stitch/survey/StitchSurveyShell';
import StitchSurveyQuestion from '@/components/stitch/survey/StitchSurveyQuestion';
import {
  createFreshSurveySession,
  loadSurveySessionCache,
  saveSurveySessionCache,
} from '@/lib/public/survey-session-cache';

type AnswerValue = 0 | 1 | 2 | 3 | 4;
type AnswersById = Record<string, AnswerValue | undefined>;

const TOTAL = QUESTIONS_V2.length;
const AUTO_ADVANCE_MS = 200;

type SurveyRunState = {
  startedAt: string;
  profile: Record<string, unknown>;
  answersById: AnswersById;
};

function getFirstUnansweredIndex(answersById: AnswersById): number {
  for (let i = 0; i < TOTAL; i++) {
    if (answersById[QUESTIONS_V2[i].id] === undefined) return i;
  }
  return TOTAL;
}

export default function MovementTestSurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [runState, setRunState] = useState<SurveyRunState>({
    startedAt: '',
    profile: {},
    answersById: {},
  });
  const [ready, setReady] = useState(false);
  const isTransitioningRef = useRef(false);
  const isCompletingRef = useRef(false);

  const initFromSession = useCallback(() => {
    const current = loadSurveySessionCache();

    const session =
      !current ||
      current.isCompleted === true ||
      Object.keys(current.answersById).length === 0
        ? createFreshSurveySession(current?.profile)
        : current;

    if (!current || current.isCompleted === true || Object.keys(current.answersById).length === 0) {
      saveSurveySessionCache(session);
    }

    isCompletingRef.current = false;
    setRunState({
      startedAt: session.startedAt,
      profile: session.profile ?? {},
      answersById: session.answersById,
    });

    const idx = getFirstUnansweredIndex(session.answersById);
    setStep(Math.min(idx, TOTAL - 1));
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

  useEffect(() => {
    if (!ready || isCompletingRef.current || !runState.startedAt) return;
    saveSurveySessionCache({
      version: 'v2',
      isCompleted: false,
      startedAt: runState.startedAt,
      profile: runState.profile,
      answersById: Object.fromEntries(
        Object.entries(runState.answersById).filter(([, value]) => value !== undefined)
      ) as Record<string, TestAnswerValue>,
    });
  }, [ready, runState]);

  const question = QUESTIONS_V2[step];
  const currentAnswer = question ? runState.answersById[question.id] : undefined;

  const advanceOrComplete = useCallback(
    (next: Record<string, TestAnswerValue>) => {
      if (step >= TOTAL - 1) {
        isCompletingRef.current = true;
        saveSurveySessionCache({
          version: 'v2',
          isCompleted: true,
          startedAt: runState.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          profile: runState.profile,
          answersById: next,
        });
        router.push('/movement-test/refine-bridge');
      } else {
        setStep((s) => s + 1);
      }
    },
    [step, runState.startedAt, runState.profile, router]
  );

  const handleAnswer = useCallback(
    (value: TestAnswerValue) => {
      if (!question || isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      const next: AnswersById = { ...runState.answersById, [question.id]: value };
      setRunState((prev) => ({
        ...prev,
        answersById: next,
      }));

      setTimeout(() => {
        advanceOrComplete(next as Record<string, TestAnswerValue>);
        isTransitioningRef.current = false;
      }, AUTO_ADVANCE_MS);
    },
    [question, runState.answersById, advanceOrComplete]
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
