'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SURVEY_QUESTIONS } from '@/data/survey-questions';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';

type PageStep = 'photos' | 'survey';

interface UploadedPhoto {
  side: 'front' | 'side';
  file: File;
  preview: string;
  uploaded: boolean;
  url?: string;
}

export default function FreeSurveyPage() {
  const router = useRouter();
  const [pageStep, setPageStep] = useState<PageStep>('photos');
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 사진 업로드 상태
  const [frontPhoto, setFrontPhoto] = useState<UploadedPhoto | null>(null);
  const [sidePhoto, setSidePhoto] = useState<UploadedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // 사진 선택 핸들러
  const handlePhotoSelect = (side: 'front' | 'side', file: File) => {
    const preview = URL.createObjectURL(file);
    const photo: UploadedPhoto = {
      side,
      file,
      preview,
      uploaded: false,
    };
    
    if (side === 'front') {
      // 이전 preview URL 해제
      if (frontPhoto?.preview) {
        URL.revokeObjectURL(frontPhoto.preview);
      }
      setFrontPhoto(photo);
    } else {
      // 이전 preview URL 해제
      if (sidePhoto?.preview) {
        URL.revokeObjectURL(sidePhoto.preview);
      }
      setSidePhoto(photo);
    }
  };

  // 사진 업로드 (서버로 전송)
  const uploadPhoto = async (photo: UploadedPhoto): Promise<string> => {
    const formData = new FormData();
    formData.append('file', photo.file);
    formData.append('side', photo.side);
    formData.append('user_id', localStorage.getItem('user_id') || `anonymous-${Date.now()}`);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || '업로드 실패');
    }

    const data = await res.json();
    return data.url;
  };

  // 사진 업로드 완료 → 설문 단계로
  const handlePhotosComplete = async () => {
    if (!frontPhoto || !sidePhoto) {
      alert('정면과 측면 사진을 모두 선택해주세요.');
      return;
    }

    setUploading(true);
    try {
      // 두 사진 모두 업로드
      const [frontUrl, sideUrl] = await Promise.all([
        uploadPhoto(frontPhoto),
        uploadPhoto(sidePhoto),
      ]);

      // localStorage에 사진 URL 저장
      localStorage.setItem('free_survey_front_photo', frontUrl);
      localStorage.setItem('free_survey_side_photo', sideUrl);

      setFrontPhoto({ ...frontPhoto, uploaded: true, url: frontUrl });
      setSidePhoto({ ...sidePhoto, uploaded: true, url: sideUrl });
      
      // 설문 단계로 전환
      setPageStep('survey');
    } catch (error) {
      alert('사진 업로드 실패: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const currentQuestion = pageStep === 'survey' ? SURVEY_QUESTIONS[currentStep] : null;
  const progress = pageStep === 'survey' ? ((currentStep + 1) / SURVEY_QUESTIONS.length) * 100 : 0;
  
  const handleAnswer = (value: string | string[]) => {
    if (!currentQuestion) return;
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
  
  const isAnswered = currentQuestion ? !!responses[currentQuestion.id] : false;
  
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
  
  // 사진 업로드 단계 렌더링
  if (pageStep === 'photos') {
    return (
      <NeoPageLayout maxWidth="lg">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-slate-800">포스처랩</h1>
          </Link>
          <p className="mt-2 text-sm text-slate-600">무료 자세 체크 (1단계: 사진 업로드)</p>
          <div className="mt-3 inline-block rounded-full border-2 border-slate-900 bg-orange-100 px-4 py-1 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <span className="text-xs font-semibold text-orange-600">💯 완전 무료</span>
          </div>
        </div>

        {/* 안내 메시지 */}
        <NeoCard className="mb-8 p-6">
          <h2 className="mb-3 text-xl font-bold text-slate-800">📸 사진 2장만 있으면 시작!</h2>
          <p className="mb-4 text-sm text-slate-600">
            정면과 측면 사진을 올려주세요. 
            전문가가 체형을 확인하고 맞춤 가이드를 제공합니다.
          </p>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-orange-500">✓</span>
              <span>전신이 보이도록 촬영 (머리부터 발끝까지)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-500">✓</span>
              <span>밝은 곳에서 촬영</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-500">✓</span>
              <span>몸에 딱 맞는 옷 착용 (헐렁한 옷 X)</span>
            </div>
          </div>
        </NeoCard>

        {/* 사진 업로드 카드 */}
        <div className="grid gap-6 md:grid-cols-2">
          <NeoCard className="p-6 border-dashed">
            <h3 className="mb-4 text-center text-lg font-semibold text-slate-800">
                정면 사진
              </h3>
              
              {frontPhoto ? (
                <div className="relative">
                  <img
                    src={frontPhoto.preview}
                    alt="정면 사진 미리보기"
                    className="h-80 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setFrontPhoto(null)}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white hover:bg-red-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {frontPhoto.uploaded && (
                    <div className="absolute left-2 top-2 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                      ✓ 업로드 완료
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex h-80 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900 bg-[#F8F6F0] hover:border-orange-400 hover:bg-orange-50 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <svg className="mb-4 h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">사진 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoSelect('front', file);
                    }}
                  />
                </label>
              )}
          </NeoCard>

          <NeoCard className="p-6 border-dashed">
            <h3 className="mb-4 text-center text-lg font-semibold text-slate-800">
                측면 사진
              </h3>
              
              {sidePhoto ? (
                <div className="relative">
                  <img
                    src={sidePhoto.preview}
                    alt="측면 사진 미리보기"
                    className="h-80 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setSidePhoto(null)}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white hover:bg-red-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {sidePhoto.uploaded && (
                    <div className="absolute left-2 top-2 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                      ✓ 업로드 완료
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex h-80 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900 bg-[#F8F6F0] hover:border-orange-400 hover:bg-orange-50 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <svg className="mb-4 h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">사진 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoSelect('side', file);
                    }}
                  />
                </label>
              )}
          </NeoCard>
        </div>

        <div className="mt-8 flex justify-center">
          <NeoButton
            variant="orange"
            className="px-8 py-4 text-lg"
            onClick={handlePhotosComplete}
            disabled={!frontPhoto || !sidePhoto || uploading}
          >
            {uploading ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-white border-t-transparent" />
                <span>업로드 중...</span>
              </>
            ) : (
              <>
                <span>다음: 간단한 설문</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </NeoButton>
        </div>
      </NeoPageLayout>
    );
  }

  // 설문 단계 렌더링
  if (!currentQuestion) return null;
  
  return (
    <NeoPageLayout maxWidth="md">
      {/* 헤더 */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-block">
          <h1 className="text-2xl font-bold text-slate-800">포스처랩</h1>
        </Link>
        <p className="mt-2 text-sm text-slate-600">무료 자세 체크 (2단계: 간단한 설문, 약 3분)</p>
        <div className="mt-3 inline-block rounded-full border-2 border-slate-900 bg-orange-100 px-4 py-1 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
          <span className="text-xs font-semibold text-orange-600">💯 완전 무료</span>
        </div>
      </div>
        
      {/* 진행 바 */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>질문 {currentStep + 1} / {SURVEY_QUESTIONS.length}</span>
            <span>{Math.round(progress)}% 완료</span>
          </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-300 border-2 border-slate-900">
          <div
            className="h-full bg-orange-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
        
      {/* 질문 카드 */}
      <NeoCard className="mb-8 p-6 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-slate-100 px-3 py-1 text-xs shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <span>{getCategoryIcon(currentQuestion.category)}</span>
          <span className="text-slate-700">{getCategoryName(currentQuestion.category)}</span>
          </div>
          
        <h2 className="mb-2 text-xl font-bold text-slate-800 sm:text-2xl">
            {currentQuestion.question}
            {currentQuestion.required && <span className="ml-2 text-red-400">*</span>}
          </h2>
          
        {currentQuestion.description && (
          <p className="mb-6 text-sm text-slate-600">{currentQuestion.description}</p>
        )}
          
          {/* 선택지 */}
          <div className="space-y-3">
            {currentQuestion.type === 'single' ? (
              currentQuestion.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition ${
                    responses[currentQuestion.id] === option.id
                      ? 'border-slate-900 bg-orange-100 shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
                      : 'border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:border-orange-400'
                  }`}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={option.id}
                    checked={responses[currentQuestion.id] === option.id}
                    onChange={(e) => handleAnswer(e.target.value)}
                    className="h-5 w-5 text-orange-500"
                  />
                  <span className="flex-1 text-slate-800">{option.label}</span>
                </label>
              ))
            ) : (
              currentQuestion.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition ${
                    ((responses[currentQuestion.id] as string[]) || []).includes(option.id)
                      ? 'border-slate-900 bg-orange-100 shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
                      : 'border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:border-orange-400'
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
                    className="h-5 w-5 text-orange-500"
                  />
                  <span className="flex-1 text-slate-800">{option.label}</span>
                </label>
              ))
            )}
          </div>
      </NeoCard>
        
      {/* 버튼 */}
      <div className="flex gap-3">
        {currentStep > 0 && (
          <NeoButton
            variant="secondary"
            className="flex-1 sm:flex-none sm:px-8"
            onClick={handleBack}
          >
            이전
          </NeoButton>
        )}
        
        <NeoButton
          variant="orange"
          className="flex-1 sm:px-8"
          onClick={handleNext}
          disabled={!isAnswered || isSubmitting}
        >
          {isSubmitting ? '제출 중...' : currentStep === SURVEY_QUESTIONS.length - 1 ? '결과 보기' : '다음'}
        </NeoButton>
      </div>
        
      {/* 하단 안내 */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500">
            💡 무료 버전은 간단한 자세 경향만 확인됩니다
            <br />
          더 상세한 분석은 결과 확인 후 선택하실 수 있습니다
        </p>
      </div>
    </NeoPageLayout>
  );
}
