'use client';

/**
 * Movement Type Test - 설문 진행 페이지
 * 
 * 40개 질문을 여러 페이지로 나누어 진행
 * - 페이지네이션
 * - 답변 상태 관리
 * - LocalStorage 자동 저장
 * - 진행률 표시
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '../components/ProgressBar';
import MultipleChoice from '../components/MultipleChoice';
import BinaryChoice from '../components/BinaryChoice';
import { ALL_QUESTIONS } from '../data/questions';
import type { Answer, MultipleAnswer, BinaryAnswer } from '../../../types/movement-test';
import { isMultipleQuestion, isBinaryQuestion } from '../../../types/movement-test';

// 페이지당 질문 수
const QUESTIONS_PER_PAGE = 5;

export default function MovementTestSurveyPage() {
  const router = useRouter();
  
  // 현재 페이지 (1부터 시작)
  const [currentPage, setCurrentPage] = useState(1);
  
  // 답변 상태
  const [answers, setAnswers] = useState<Answer[]>([]);
  
  // 테스트 시작 시간
  const [startTime] = useState<Date>(new Date());

  // 총 페이지 수 계산
  const totalPages = Math.ceil(ALL_QUESTIONS.length / QUESTIONS_PER_PAGE);

  // 현재 페이지의 질문들
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
  const endIndex = startIndex + QUESTIONS_PER_PAGE;
  const currentQuestions = ALL_QUESTIONS.slice(startIndex, endIndex);

  // LocalStorage에서 저장된 진행 상황 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('movement-test-progress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setAnswers(data.answers || []);
        setCurrentPage(data.currentPage || 1);
      } catch (error) {
        console.error('Failed to load saved progress:', error);
      }
    }
  }, []);

  // 답변 변경 시 LocalStorage에 자동 저장
  useEffect(() => {
    if (answers.length > 0) {
      localStorage.setItem('movement-test-progress', JSON.stringify({
        answers,
        currentPage,
        lastUpdated: new Date().toISOString()
      }));
    }
  }, [answers, currentPage]);

  // 4지선다 답변 처리
  const handleMultipleChoiceAnswer = (questionId: number, optionId: string) => {
    const question = ALL_QUESTIONS.find(q => q.id === questionId);
    if (!question || !isMultipleQuestion(question)) return;

    const option = question.options?.find(opt => opt.id === optionId);
    if (!option) return;

    const newAnswer: MultipleAnswer = {
      questionId,
      selectedOptionId: optionId,
      selectedType: option.type,
      score: option.score || 1,
      answeredAt: new Date()
    };

    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questionId);
      return [...filtered, newAnswer];
    });
  };

  // 예/아니오 답변 처리
  const handleBinaryAnswer = (questionId: number, answer: boolean) => {
    const question = ALL_QUESTIONS.find(q => q.id === questionId);
    if (!question || !isBinaryQuestion(question)) return;

    const newAnswer: BinaryAnswer = {
      questionId,
      answer,
      imbalanceFlag: question.imbalanceFlag,
      answeredAt: new Date()
    };

    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questionId);
      return [...filtered, newAnswer];
    });
  };

  // 현재 페이지의 답변 확인
  const getCurrentPageAnswers = () => {
    return currentQuestions.filter(q => 
      answers.some(a => a.questionId === q.id)
    );
  };

  // 다음 페이지로 이동 가능한지 체크
  const canGoNext = () => {
    const answeredCount = getCurrentPageAnswers().length;
    return answeredCount === currentQuestions.length;
  };

  // 다음 페이지
  const handleNext = () => {
    if (!canGoNext()) return;

    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // 테스트 완료 - 결과 페이지로 이동
      handleComplete();
    }
  };

  // 이전 페이지
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 테스트 완료 처리
  const handleComplete = () => {
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // 최종 데이터 저장
    localStorage.setItem('movement-test-result', JSON.stringify({
      answers,
      completedAt: endTime.toISOString(),
      duration
    }));

    // 진행 상황 삭제
    localStorage.removeItem('movement-test-progress');

    // 결과 페이지로 이동
    router.push('/movement-test/result');
  };

  // 답변 가져오기 헬퍼
  const getAnswer = (questionId: number) => {
    return answers.find(a => a.questionId === questionId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* 진행률 표시 */}
          <div className="mb-8">
            <ProgressBar
              currentPage={currentPage}
              totalPages={totalPages}
            />
          </div>

          {/* 질문 카드 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
            <div className="space-y-8">
              {currentQuestions.map((question, index) => {
                const answer = getAnswer(question.id);
                const questionNumber = startIndex + index + 1;

                return (
                  <div key={question.id} className="pb-8 border-b border-slate-700 last:border-b-0 last:pb-0">
                    {/* 질문 헤더 */}
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-[#f97316] text-white rounded-lg flex items-center justify-center font-bold text-sm">
                          {questionNumber}
                        </span>
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {question.category}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-white leading-relaxed">
                        {question.question}
                      </h3>
                    </div>

                    {/* 질문 타입별 선택 UI */}
                    {isMultipleQuestion(question) && (
                      <MultipleChoice
                        questionId={question.id}
                        options={question.options || []}
                        selectedOptionId={(answer as MultipleAnswer)?.selectedOptionId}
                        onSelect={(optionId) => handleMultipleChoiceAnswer(question.id, optionId)}
                      />
                    )}

                    {isBinaryQuestion(question) && (
                      <BinaryChoice
                        questionId={question.id}
                        selectedAnswer={(answer as BinaryAnswer)?.answer}
                        onSelect={(ans) => handleBinaryAnswer(question.id, ans)}
                        helpText={question.helpText}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 네비게이션 버튼 */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className={`
                px-6 py-3 rounded-xl font-semibold
                transition-all duration-200
                ${currentPage === 1
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
                }
              `}
            >
              ← 이전
            </button>

            <div className="text-center">
              {!canGoNext() && (
                <p className="text-sm text-amber-400">
                  모든 질문에 답변해주세요
                </p>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className={`
                px-6 py-3 rounded-xl font-semibold
                transition-all duration-200
                ${!canGoNext()
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : currentPage === totalPages
                    ? 'bg-green-600 text-white hover:bg-green-500'
                    : 'bg-[#f97316] text-white hover:bg-[#ea580c]'
                }
              `}
            >
              {currentPage === totalPages ? '결과 보기' : '다음 →'}
            </button>
          </div>

          {/* 진행 상황 안내 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              답변은 자동으로 저장됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
