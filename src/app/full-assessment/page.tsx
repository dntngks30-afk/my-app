'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SURVEY_QUESTIONS } from '@/data/survey-questions';

type Step = 'photos' | 'survey' | 'info' | 'result';

interface UploadedPhoto {
  side: 'front' | 'side';
  file: File;
  preview: string;
  uploaded: boolean;
  url?: string;
}

export default function FullAssessmentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('photos');
  
  // 사진 업로드 상태
  const [frontPhoto, setFrontPhoto] = useState<UploadedPhoto | null>(null);
  const [sidePhoto, setSidePhoto] = useState<UploadedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // 설문 응답 상태
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  
  // 사용자 정보 상태
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  
  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
      setFrontPhoto(photo);
    } else {
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

  // Step 1 → Step 2: 사진 업로드 완료
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

      setFrontPhoto({ ...frontPhoto, uploaded: true, url: frontUrl });
      setSidePhoto({ ...sidePhoto, uploaded: true, url: sideUrl });
      
      setCurrentStep('survey');
    } catch (error) {
      alert('사진 업로드 실패: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Step 2 → Step 3: 설문 완료
  const handleSurveyComplete = () => {
    // 필수 질문 체크
    const requiredQuestions = SURVEY_QUESTIONS.filter(q => q.required);
    const missingAnswers = requiredQuestions.filter(q => !responses[q.id]);
    
    if (missingAnswers.length > 0) {
      alert('모든 필수 질문에 답변해주세요.');
      return;
    }

    setCurrentStep('info');
  };

  // Step 3 → 최종 제출
  const handleFinalSubmit = async () => {
    if (!email || !email.includes('@')) {
      alert('유효한 이메일 주소를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // 설문 분석 및 PDF 생성 API 호출
      const res = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          email,
          name: name || '고객',
          userId: localStorage.getItem('user_id'),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '제출 실패');
      }

      const data = await res.json();
      
      // 성공 시 결과 페이지로 이동
      setCurrentStep('result');
      
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 설문 응답 핸들러
  const handleResponseChange = (questionId: string, value: string | string[]) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-100">
              포스처랩
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
                홈으로
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 진행 단계 표시 */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Step 1 */}
            <div className={`flex flex-1 items-center ${currentStep === 'photos' ? 'opacity-100' : currentStep === 'survey' || currentStep === 'info' ? 'opacity-50' : 'opacity-100'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep === 'photos' ? 'border-[#f97316] bg-[#f97316] text-white' : currentStep === 'survey' || currentStep === 'info' ? 'border-green-500 bg-green-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                {currentStep === 'survey' || currentStep === 'info' || currentStep === 'result' ? '✓' : '1'}
              </div>
              <span className="ml-3 text-sm font-medium text-slate-300">사진 업로드</span>
            </div>

            <div className="h-px flex-1 bg-slate-700"></div>

            {/* Step 2 */}
            <div className={`flex flex-1 items-center ${currentStep === 'survey' ? 'opacity-100' : currentStep === 'info' ? 'opacity-50' : 'opacity-30'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep === 'survey' ? 'border-[#f97316] bg-[#f97316] text-white' : currentStep === 'info' || currentStep === 'result' ? 'border-green-500 bg-green-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                {currentStep === 'info' || currentStep === 'result' ? '✓' : '2'}
              </div>
              <span className="ml-3 text-sm font-medium text-slate-300">설문 작성</span>
            </div>

            <div className="h-px flex-1 bg-slate-700"></div>

            {/* Step 3 */}
            <div className={`flex flex-1 items-center ${currentStep === 'info' ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep === 'info' ? 'border-[#f97316] bg-[#f97316] text-white' : currentStep === 'result' ? 'border-green-500 bg-green-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                {currentStep === 'result' ? '✓' : '3'}
              </div>
              <span className="ml-3 text-sm font-medium text-slate-300">정보 입력</span>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        
        {/* Step 1: 사진 업로드 */}
        {currentStep === 'photos' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
                자세 사진 등록
              </h1>
              <p className="mt-3 text-slate-400">
                정면과 측면 사진 2장이 필요해요
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* 정면 사진 */}
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">정면 사진</h3>
                {frontPhoto ? (
                  <div className="space-y-4">
                    <img src={frontPhoto.preview} alt="정면" className="w-full rounded-lg" />
                    <button
                      onClick={() => setFrontPhoto(null)}
                      className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      다시 선택
                    </button>
                  </div>
                ) : (
                  <label className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 hover:border-[#f97316]">
                    <div className="text-6xl">📷</div>
                    <p className="mt-4 text-sm text-slate-400">클릭하여 사진 선택</p>
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
              </div>

              {/* 측면 사진 */}
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">측면 사진</h3>
                {sidePhoto ? (
                  <div className="space-y-4">
                    <img src={sidePhoto.preview} alt="측면" className="w-full rounded-lg" />
                    <button
                      onClick={() => setSidePhoto(null)}
                      className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      다시 선택
                    </button>
                  </div>
                ) : (
                  <label className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 hover:border-[#f97316]">
                    <div className="text-6xl">📐</div>
                    <p className="mt-4 text-sm text-slate-400">클릭하여 사진 선택</p>
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
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handlePhotosComplete}
                disabled={!frontPhoto || !sidePhoto || uploading}
                className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-3 font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? '업로드 중...' : '다음 단계'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 설문 작성 */}
        {currentStep === 'survey' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
                자세 체크 설문
              </h1>
              <p className="mt-3 text-slate-400">
                16개 질문 (자가 인식 기준)
              </p>
            </div>

            <div className="space-y-6">
              {SURVEY_QUESTIONS.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                  <div className="mb-4">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-slate-100">
                        Q{index + 1}. {question.question}
                      </h3>
                      {question.required && (
                        <span className="ml-2 text-sm text-red-400">*</span>
                      )}
                    </div>
                    {question.description && (
                      <p className="text-sm text-slate-400">{question.description}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {question.type === 'single' ? (
                      question.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4 transition hover:border-[#f97316]"
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={responses[question.id] === option.id}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            className="h-5 w-5 text-[#f97316]"
                          />
                          <span className="text-slate-300">{option.label}</span>
                        </label>
                      ))
                    ) : (
                      question.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4 transition hover:border-[#f97316]"
                        >
                          <input
                            type="checkbox"
                            value={option.id}
                            checked={((responses[question.id] as string[]) || []).includes(option.id)}
                            onChange={(e) => {
                              const currentValues = (responses[question.id] as string[]) || [];
                              const newValues = e.target.checked
                                ? [...currentValues, option.id]
                                : currentValues.filter(v => v !== option.id);
                              handleResponseChange(question.id, newValues);
                            }}
                            className="h-5 w-5 text-[#f97316]"
                          />
                          <span className="text-slate-300">{option.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('photos')}
                className="rounded-full border border-slate-700 px-8 py-3 font-semibold text-slate-300 hover:bg-slate-800"
              >
                이전
              </button>
              <button
                onClick={handleSurveyComplete}
                className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-3 font-semibold text-white shadow-lg"
              >
                다음 단계
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 정보 입력 */}
        {currentStep === 'info' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
                결과 받기
              </h1>
              <p className="mt-3 text-slate-400">
                운동 가이드 PDF를 받을 이메일을 입력해주세요
              </p>
            </div>

            <div className="mx-auto max-w-md space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  이메일 <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  이름 (선택)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                />
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('survey')}
                className="rounded-full border border-slate-700 px-8 py-3 font-semibold text-slate-300 hover:bg-slate-800"
              >
                이전
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-3 font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 완료 */}
        {currentStep === 'result' && (
          <div className="space-y-8 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
                접수 완료!
              </h1>
              <p className="mt-3 text-slate-400">
                입력하신 이메일로 운동 가이드 PDF를 보내드렸습니다.
              </p>
            </div>

            <div className="mx-auto max-w-md rounded-xl border border-slate-700 bg-slate-900/50 p-6">
              <div className="space-y-3 text-left text-sm text-slate-300">
                <p>✅ 사진 등록 완료</p>
                <p>✅ 설문 작성 완료</p>
                <p>✅ PDF 생성 완료</p>
                <p>✅ 이메일 발송 완료</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Link
                href="/"
                className="rounded-full border border-slate-700 px-8 py-3 font-semibold text-slate-300 hover:bg-slate-800"
              >
                홈으로
              </Link>
              <Link
                href="/pricing"
                className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-3 font-semibold text-white shadow-lg"
              >
                프리미엄 플랜 보기
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
