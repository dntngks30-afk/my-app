'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SURVEY_QUESTIONS } from '@/data/survey-questions';

export default function FreeSurveyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentQuestion = SURVEY_QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / SURVEY_QUESTIONS.length) * 100;
  
  const handleAnswer = (value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };
  
  const handleNext = () => {
    if (currentStep < SURVEY_QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleSubmit();
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // 설문 응답을 localStorage에 저장
      localStorage.setItem('free_survey_responses', JSON.stringify(responses));
      localStorage.setItem('free_survey_completed_at', new Date().toISOString());
      
      // 결과 페이지로 이동
      router.push('/free-survey/result');
    } catch (error) {
      console.error('제출 에러:', error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isAnswered = !!responses[currentQuestion.id];
  
  // 카테고리 아이콘
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'posture': return '🧍';
      case 'pain': return '😣';
      case 'lifestyle': return '🏃';
      case 'goal': return '🎯';
      default: return '📋';
    }
  };
  
  // 카테고리 이름
  const getCategoryName = (category: string) => {
    switch (category) {
      case 'posture': return '자세 느낌';
      case 'pain': return '불편한 느낌';
      case 'lifestyle': return '생활 습관';
      case 'goal': return '운동 목표';
      default: return '설문';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* 헤더 */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-white">포스처랩</h1>
          </Link>
          <p className="mt-2 text-sm text-slate-400">무료 자세 체크 설문 (약 3분)</p>
          <div className="mt-3 inline-block rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1">
            <span className="text-xs font-semibold text-green-400">💯 완전 무료</span>
          </div>
        </div>
        
        {/* 진행 바 */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-slate-400">
            <span>질문 {currentStep + 1} / {SURVEY_QUESTIONS.length}</span>
            <span>{Math.round(progress)}% 완료</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-[#f97316] to-[#fb923c] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* 질문 카드 */}
        <div className="mb-8 rounded-2xl border border-slate-700 bg-slate-900/50 p-6 sm:p-8 backdrop-blur">
          {/* 카테고리 배지 */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs">
            <span>{getCategoryIcon(currentQuestion.category)}</span>
            <span className="text-slate-300">{getCategoryName(currentQuestion.category)}</span>
          </div>
          
          {/* 질문 */}
          <h2 className="mb-2 text-xl font-bold text-slate-100 sm:text-2xl">
            {currentQuestion.question}
            {currentQuestion.required && <span className="ml-2 text-red-400">*</span>}
          </h2>
          
          {currentQuestion.description && (
            <p className="mb-6 text-sm text-slate-400">{currentQuestion.description}</p>
          )}
          
          {/* 선택지 */}
          <div className="space-y-3">
            {currentQuestion.type === 'single' ? (
              currentQuestion.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition ${
                    responses[currentQuestion.id] === option.id
                      ? 'border-[#f97316] bg-[#f97316]/10'
                      : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={option.id}
                    checked={responses[currentQuestion.id] === option.id}
                    onChange={(e) => handleAnswer(e.target.value)}
                    className="h-5 w-5 text-[#f97316]"
                  />
                  <span className="flex-1 text-slate-200">{option.label}</span>
                </label>
              ))
            ) : (
              currentQuestion.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition ${
                    ((responses[currentQuestion.id] as string[]) || []).includes(option.id)
                      ? 'border-[#f97316] bg-[#f97316]/10'
                      : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option.id}
                    checked={((responses[currentQuestion.id] as string[]) || []).includes(option.id)}
                    onChange={(e) => {
                      const currentValues = (responses[currentQuestion.id] as string[]) || [];
                      const newValues = e.target.checked
                        ? [...currentValues, option.id]
                        : currentValues.filter(v => v !== option.id);
                      handleAnswer(newValues);
                    }}
                    className="h-5 w-5 text-[#f97316]"
                  />
                  <span className="flex-1 text-slate-200">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
        
        {/* 버튼 */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 sm:flex-none sm:px-8"
            >
              이전
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={!isAnswered || isSubmitting}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] px-6 py-3 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:px-8"
          >
            {isSubmitting ? '제출 중...' : currentStep === SURVEY_QUESTIONS.length - 1 ? '결과 보기' : '다음'}
          </button>
        </div>
        
        {/* 하단 안내 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            💡 무료 버전은 간단한 자세 경향만 확인됩니다
            <br />
            더 상세한 분석은 결과 확인 후 선택하실 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
