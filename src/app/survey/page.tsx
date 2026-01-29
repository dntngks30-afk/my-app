'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SURVEY_QUESTIONS } from '@/data/survey-questions';
import Link from 'next/link';

export default function SurveyPage() {
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
      // 임시로 localStorage에 저장 (나중에 API 연동)
      localStorage.setItem('survey_responses', JSON.stringify(responses));
      localStorage.setItem('survey_completed_at', new Date().toISOString());
      
      // 결과 페이지로 이동
      router.push('/survey/result');
    } catch (error) {
      console.error('제출 에러:', error);
      alert('네트워크 오류가 발생했습니다.');
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
      case 'posture': return '자세 관찰';
      case 'pain': return '불편함/통증';
      case 'lifestyle': return '생활 습관';
      case 'goal': return '목표';
      default: return '설문';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* 헤더 */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-white">포스처랩</h1>
          </Link>
          <p className="mt-2 text-sm text-slate-400">자세 자가 체크 (약 3분, 참고용)</p>
        </div>
        
        {/* 진행 바 */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-slate-400">
            <span>질문 {currentStep + 1} / {SURVEY_QUESTIONS.length}</span>
            <span>{Math.round(progress)}% 완료</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* 질문 카드 */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          {/* 카테고리 배지 */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">
              <span>{getCategoryIcon(currentQuestion.category)}</span>
              {getCategoryName(currentQuestion.category)}
            </span>
          </div>
          
          {/* 질문 */}
          <h2 className="mb-2 text-xl font-bold text-slate-100 sm:text-2xl">
            {currentQuestion.question}
          </h2>
          
          {currentQuestion.description && (
            <p className="mb-6 text-sm text-slate-400">
              {currentQuestion.description}
            </p>
          )}
          
          {/* 답변 옵션 */}
          <div className="space-y-3">
            {currentQuestion.type === 'single' || currentQuestion.type === 'scale' || currentQuestion.type === 'boolean' ? (
              // 단일 선택
              currentQuestion.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(option.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    responses[currentQuestion.id] === option.id
                      ? 'border-orange-500 bg-orange-500/10 text-slate-100'
                      : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      responses[currentQuestion.id] === option.id
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-slate-600'
                    }`}>
                      {responses[currentQuestion.id] === option.id && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </div>
                </button>
              ))
            ) : (
              // 복수 선택
              currentQuestion.options.map(option => {
                const current = (responses[currentQuestion.id] as string[]) || [];
                const selected = current.includes(option.id);
                
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (selected) {
                        handleAnswer(current.filter(id => id !== option.id));
                      } else {
                        handleAnswer([...current, option.id]);
                      }
                    }}
                    className={`w-full rounded-xl border-2 p-4 text-left transition ${
                      selected
                        ? 'border-orange-500 bg-orange-500/10 text-slate-100'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        selected
                          ? 'border-orange-500 bg-orange-500'
                          : 'border-slate-600'
                      }`}>
                        {selected && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1">{option.label}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          
          {/* 버튼 */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="rounded-full border-2 border-slate-700 px-6 py-3 font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900/50"
              >
                ← 이전
              </button>
            )}
            
            <button
              onClick={handleNext}
              disabled={!isAnswered || isSubmitting}
              className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  분석 중...
                </span>
              ) : currentStep === SURVEY_QUESTIONS.length - 1 ? (
                '결과 확인 →'
              ) : (
                '다음 →'
              )}
            </button>
          </div>
          
          {/* 복수 선택 안내 */}
          {currentQuestion.type === 'multiple' && (
            <p className="mt-4 text-center text-xs text-slate-500">
              💡 여러 개 선택 가능합니다
            </p>
          )}
        </div>
        
        {/* 하단 안내 */}
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-2 text-center text-xs font-bold text-amber-300">
            ⚠️ 중요: 본 체크의 목적과 한계
          </p>
          <ul className="space-y-1 text-xs text-slate-400">
            <li>• 본 설문은 자가 인식을 돕기 위한 참고 도구입니다.</li>
            <li>• AI나 전문가가 판단하는 것이 아닙니다.</li>
            <li>• 결과는 의학적 진단이 아니며, 참고 정보로만 활용하세요.</li>
            <li>• 통증이나 질병이 있다면 반드시 의료기관을 방문하세요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
