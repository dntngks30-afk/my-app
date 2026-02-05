'use client';

/**
 * SurveyForm - 설문 진행 공용 컴포넌트
 * 
 * 3~4문항/페이지 구조 (데스크톱 4문항, 모바일 3문항)
 */
import { CTA } from '@/features/movement-test/copy/cta';
import { DESCRIPTIONS } from '@/features/movement-test/copy/descriptions';
import { TITLES } from '@/features/movement-test/copy/titles';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ProgressMini from '@/components/ProgressMini';
import ChoiceTile from '@/components/ChoiceTile';
import Card from '@/components/Card';
import { ALL_QUESTIONS } from '@/features/movement-test/data/questions';
import type { Answer, MultipleAnswer, BinaryAnswer } from '@/types/movement-test';
import { isMultipleQuestion, isBinaryQuestion } from '@/types/movement-test';

// multiple 가중치
const MULTI_WEIGHTS = [1.0, 0.5] as const;

// localStorage 키 (스펙 고정)
const SESSION_STORAGE_KEY = 'movementTestSession:v1';

// 페이지당 질문 수
const QUESTIONS_PER_PAGE_DESKTOP = 4;
const QUESTIONS_PER_PAGE_MOBILE = 3;

// 세션 스키마 (스펙 기준)
interface SessionData {
  answers: Record<string, any>; // questionId -> answer payload
  questionIndex: number; // 페이지 시작 인덱스 (0부터 시작)
  updatedAt: number; // Date.now()
  isCompleted: boolean;
  result?: any;
}

export default function SurveyForm() {
  const router = useRouter();
  const pathname = usePathname();

  // 현재 페이지 시작 인덱스 (0부터 시작)
  const [questionIndex, setQuestionIndex] = useState(0);

  // 첫 렌더 여부 추적
  const didInitialRender = useRef(false);

  // 페이지당 질문 수 (반응형)
  const [perPage, setPerPage] = useState(QUESTIONS_PER_PAGE_DESKTOP);

  // 질문 카드 맨 위 기준점
  const topRef = useRef<HTMLDivElement | null>(null);

  // 질문별 ref (스크롤용)
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 답변 상태 (Record 형식으로 저장, 스펙 준수)
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // 미답변 검증 표시 상태
  const [showValidation, setShowValidation] = useState(false);

  // 총 질문 수
  const totalQuestions = ALL_QUESTIONS.length;

  // 반응형 처리
  useEffect(() => {
    const updatePerPage = () => {
      setPerPage(window.innerWidth < 640 ? QUESTIONS_PER_PAGE_MOBILE : QUESTIONS_PER_PAGE_DESKTOP);
    };
    
    updatePerPage();
    window.addEventListener('resize', updatePerPage);
    return () => window.removeEventListener('resize', updatePerPage);
  }, []);

  // 현재 페이지의 질문들
  const pageStart = questionIndex;
  const pageEnd = Math.min(pageStart + perPage, totalQuestions);
  const pageQuestions = ALL_QUESTIONS.slice(pageStart, pageEnd);

  // 페이지 변경 후 맨 위로 스크롤
  useEffect(() => {
    // 첫 렌더에서 홈 첫 페이지면 스크롤 금지
    if (!didInitialRender.current) {
      didInitialRender.current = true;
      if (pathname === '/' && questionIndex === 0) return;
    }
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [questionIndex, pathname]);

  // 세션 저장 함수
  const saveSession = (updates: Partial<SessionData> = {}) => {
    try {
      const session: SessionData = {
        answers,
        questionIndex,
        updatedAt: Date.now(),
        isCompleted: false,
        ...updates,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  // LocalStorage에서 저장된 세션 복구
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const data: SessionData = JSON.parse(saved);
        
        if (data.answers && typeof data.questionIndex === 'number' && data.questionIndex >= 0) {
          setAnswers(data.answers || {});
          setQuestionIndex(data.questionIndex);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // 답변 변경 시 즉시 저장
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveSession();
    }
  }, [answers]);

  // 질문 이동 시 저장
  useEffect(() => {
    saveSession();
  }, [questionIndex]);

  /**
   * multiple 선택(최대 2개) 답변 처리
   */
  const handleMultipleChoiceAnswer = (questionId: number, selectedOptionIds: string[]) => {
    setShowValidation(false); // 답 선택 시 검증 메시지 숨김
    
    const question = ALL_QUESTIONS.find((q) => q.id === questionId);
    if (!question || !isMultipleQuestion(question)) return;
    if (!question.options || question.options.length === 0) return;

    const ids = selectedOptionIds.slice(0, 2);
    const selectedOptions = ids
      .map((id) => question.options!.find((opt) => opt.id === id))
      .filter(Boolean);

    const selectedTypes = selectedOptions.map((opt) => opt!.type);

    let score = 0;
    for (let i = 0; i < selectedOptions.length; i++) {
      const opt = selectedOptions[i]!;
      const weight = MULTI_WEIGHTS[i] ?? 0;
      const optScore = typeof opt.score === 'number' ? opt.score : 1;
      score += optScore * weight;
    }

    const newAnswer: MultipleAnswer = {
      questionId,
      selectedOptionIds: ids,
      selectedTypes,
      score,
      answeredAt: new Date(),
    };

    setAnswers((prev) => ({
      ...prev,
      [questionId]: newAnswer,
    }));
  };

  // 예/아니오 답변 처리
  const handleBinaryAnswer = (questionId: number, answer: boolean) => {
    setShowValidation(false); // 답 선택 시 검증 메시지 숨김
    
    const question = ALL_QUESTIONS.find((q) => q.id === questionId);
    if (!question || !isBinaryQuestion(question)) return;

    const newAnswer: BinaryAnswer = {
      questionId,
      answer,
      imbalanceFlag: question.imbalanceFlag,
      answeredAt: new Date(),
    };

    setAnswers((prev) => ({
      ...prev,
      [questionId]: newAnswer,
    }));
  };

  // 특정 질문의 답변 확인
  const hasAnswerForQuestion = (question: typeof ALL_QUESTIONS[0]) => {
    if (!question) return false;
    const answer = answers[question.id];
    if (!answer) return false;

    if (isMultipleQuestion(question)) {
      const multipleAnswer = answer as MultipleAnswer;
      return multipleAnswer.selectedOptionIds && multipleAnswer.selectedOptionIds.length > 0;
    }

    if (isBinaryQuestion(question)) {
      const binaryAnswer = answer as BinaryAnswer;
      return typeof binaryAnswer.answer === 'boolean';
    }

    return false;
  };

  // 전체 답변 완료 수 계산
  const answeredCount = ALL_QUESTIONS.filter((q) => hasAnswerForQuestion(q)).length;

  // 현재 페이지 완료 여부
  const pageCompleted = pageQuestions.every((q) => hasAnswerForQuestion(q));

  // 첫 번째 미답변 질문 찾기
  const firstUnansweredQuestion = pageQuestions.find((q) => !hasAnswerForQuestion(q));

  // 다음 페이지
  const handleNext = () => {
    if (!pageCompleted) {
      setShowValidation(true);
      // 첫 번째 미답변 질문으로 스크롤
      if (firstUnansweredQuestion) {
        const ref = questionRefs.current[firstUnansweredQuestion.id];
        if (ref) {
          ref.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
      return;
    }

    const nextStart = pageStart + perPage;
    if (nextStart < totalQuestions) {
      setQuestionIndex(nextStart);
      setShowValidation(false);
    } else {
      handleComplete();
    }
  };

  // 이전 페이지
  const handlePrevious = () => {
    const prevStart = Math.max(0, pageStart - perPage);
    if (prevStart !== pageStart) {
      setQuestionIndex(prevStart);
      setShowValidation(false);
    }
  };

  // 테스트 완료 처리
  const handleComplete = () => {
    saveSession({
      isCompleted: true,
    });
    router.push('/movement-test/result');
  };

  if (pageQuestions.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
        {/* 스크롤 기준점 */}
        <div ref={topRef} />

        {/* 진행률 표시 */}
        <ProgressMini current={answeredCount} total={totalQuestions} />

        {/* 질문 카드들 */}
        <div className="space-y-6 mb-6">
          {pageQuestions.map((question) => {
            const answer = answers[question.id];
            const isMultiple = isMultipleQuestion(question);
            const isBinary = isBinaryQuestion(question);

            return (
              <Card
                key={question.id}
                className="p-6 md:p-8"
                ref={(el) => {
                  if (el) {
                    questionRefs.current[question.id] = el;
                  }
                }}
              >
                {/* 질문 헤더 */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      {question.category}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-[var(--text)] leading-relaxed">
                    {question.question}
                  </h2>
                </div>

                {/* 선택지 UI */}
                {isMultiple && question.options && (() => {
                  const selectedIds = (answer as MultipleAnswer | undefined)?.selectedOptionIds || [];
                  return (
                    <div className="space-y-3">
                      {question.options.map((option) => {
                        const isSelected = selectedIds.includes(option.id);
                        const rank = isSelected ? selectedIds.indexOf(option.id) + 1 : undefined;
                        const isDisabled = selectedIds.length >= 2 && !isSelected;

                        return (
                          <ChoiceTile
                            key={option.id}
                            option={option}
                            isSelected={isSelected}
                            isDisabled={isDisabled}
                            rank={rank}
                            onClick={() => {
                              const currentIds = selectedIds;
                              let nextIds: string[];
                              
                              if (isSelected) {
                                // 선택 해제
                                nextIds = currentIds.filter((id) => id !== option.id);
                              } else {
                                // 선택 추가 (최대 2개)
                                if (currentIds.length >= 2) {
                                  nextIds = [currentIds[0]!, option.id];
                                } else {
                                  nextIds = [...currentIds, option.id];
                                }
                              }
                              
                              handleMultipleChoiceAnswer(question.id, nextIds);
                            }}
                          />
                        );
                      })}
                      {selectedIds.length > 0 && (
                        <p className="text-xs text-[var(--muted)] mt-2">
                          최대 2개까지 선택 가능합니다 ({selectedIds.length}/2)
                        </p>
                      )}
                    </div>
                  );
                })()}

                {isBinary && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleBinaryAnswer(question.id, true)}
                      className={`
                        w-full min-h-[var(--tile-h)] px-[var(--tile-px)] py-[var(--tile-py)]
                        rounded-[var(--radius)] border
                        font-medium text-base
                        transition-all duration-150
                        active:scale-[0.99]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]
                        ${
                          (answer as BinaryAnswer | undefined)?.answer === true
                            ? 'bg-[var(--brand-soft)] border-[color:var(--brand)] shadow-[var(--shadow-1)] text-[var(--text)] font-semibold'
                            : 'bg-[var(--surface)] border-[color:var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-0)] hover:border-[color:var(--border-strong)]'
                        }
                      `}
                      aria-pressed={(answer as BinaryAnswer | undefined)?.answer === true}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">✓</span>
                        <span>예</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBinaryAnswer(question.id, false)}
                      className={`
                        w-full min-h-[var(--tile-h)] px-[var(--tile-px)] py-[var(--tile-py)]
                        rounded-[var(--radius)] border
                        font-medium text-base
                        transition-all duration-150
                        active:scale-[0.99]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]
                        ${
                          (answer as BinaryAnswer | undefined)?.answer === false
                            ? 'bg-[var(--brand-soft)] border-[color:var(--brand)] shadow-[var(--shadow-1)] text-[var(--text)] font-semibold'
                            : 'bg-[var(--surface)] border-[color:var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-0)] hover:border-[color:var(--border-strong)]'
                        }
                      `}
                      aria-pressed={(answer as BinaryAnswer | undefined)?.answer === false}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">✗</span>
                        <span>아니오</span>
                      </div>
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* 미답변 안내 */}
        {showValidation && !pageCompleted && (
          <Card variant="subtle" className="mb-6 p-4">
            <p className="text-sm text-[var(--warn-text)] text-center">
              모든 질문에 답변해주세요
            </p>
          </Card>
        )}

        {/* 네비게이션 버튼 */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handlePrevious}
            disabled={pageStart === 0}
            className={`
              px-6 py-3 rounded-[var(--radius)] font-medium
              transition-all duration-200
              ${
                pageStart === 0
                  ? 'bg-[var(--surface-2)] text-[var(--muted)] cursor-not-allowed'
                  : 'bg-[var(--surface)] border border-[color:var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]'
              }
            `}
          >
            ← 이전
          </button>

          <button
            onClick={handleNext}
            disabled={!pageCompleted}
            className={`
              px-6 py-3 rounded-[var(--radius)] font-semibold
              transition-all duration-200
              ${
                !pageCompleted
                  ? 'bg-[var(--surface-2)] text-[var(--muted)] cursor-not-allowed'
                  : pageEnd >= totalQuestions
                    ? 'bg-[var(--brand)] text-white hover:brightness-95'
                    : 'bg-[var(--brand)] text-white hover:brightness-95'
              }
            `}
          >
            {pageEnd >= totalQuestions ? '제출' : '다음 →'}
          </button>
        </div>

        {/* 진행 상황 안내 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[var(--muted)]">답변은 자동으로 저장됩니다</p>
        </div>
        </div>
      </div>
    </section>
  );
}
