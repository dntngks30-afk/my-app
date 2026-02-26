'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { analyzeSurveyResults } from '@/lib/survey-analyzer';
import { POSTURE_TYPE_NAMES } from '@/lib/survey-analyzer';
import type { AnalysisResult } from '@/types/survey';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';

interface PhotoAnalysisResult {
  qualityCheck: {
    canAnalyze: boolean;
    passedChecks: number;
    totalChecks: number;
    issues: string[];
  };
  analysis: {
    observations: Array<{
      area: string;
      finding: string;
      visualEvidence: string;
      functionalImpact: string;
    }>;
    summary: string;
  };
  recommendations: {
    exercises: string[];
    retakeSuggestions: string[];
  };
  disclaimer: string;
}

export default function FreeSurveyResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoAnalysisError, setPhotoAnalysisError] = useState<string | null>(null);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [hasPhotos, setHasPhotos] = useState(false);

  useEffect(() => {
    // localStorage에서 설문 응답 가져오기
    const responsesStr = localStorage.getItem('free_survey_responses');
    
    if (!responsesStr) {
      // 설문을 완료하지 않았다면 설문 페이지로 리다이렉트
      router.push('/free-survey');
      return;
    }

    try {
      const responses = JSON.parse(responsesStr);
      const result = analyzeSurveyResults(responses);
      setAnalysis(result);

      // 사진 URL 확인
      const frontPhotoUrl = localStorage.getItem('free_survey_front_photo');
      const sidePhotoUrl = localStorage.getItem('free_survey_side_photo');

      if (frontPhotoUrl || sidePhotoUrl) {
        setHasPhotos(true);
        // 사진 분석 시작
        analyzePhotos(frontPhotoUrl, sidePhotoUrl, responses);
      }
    } catch (error) {
      console.error('분석 오류:', error);
      router.push('/free-survey');
    }
  }, [router]);

  // 사진 분석 함수
  const analyzePhotos = async (
    frontPhotoUrl: string | null,
    sidePhotoUrl: string | null,
    surveyResponses: Record<string, string | string[]>
  ) => {
    if (!frontPhotoUrl && !sidePhotoUrl) return;

    // 임시: 사진 분석 기능 비활성화 (OpenAI 크레딧 필요)
    const ENABLE_PHOTO_ANALYSIS = false; // true로 변경하면 사진 분석 활성화
    
    if (!ENABLE_PHOTO_ANALYSIS) {
      setPhotoAnalysisError(
        'OpenAI 크레딧이 필요합니다. 현재는 설문 기반 분석만 제공됩니다.'
      );
      return;
    }

    setPhotoAnalyzing(true);
    setPhotoAnalysisError(null);

    try {
      const response = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontPhotoUrl,
          sidePhotoUrl,
          surveyData: surveyResponses,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '사진 분석 실패');
      }

      if (data.success && data.analysis) {
        setPhotoAnalysis(data.analysis);
      } else {
        throw new Error('분석 결과를 받지 못했습니다');
      }
    } catch (error) {
      console.error('사진 분석 에러:', error);
      const errorMessage = error instanceof Error ? error.message : '사진 분석 중 오류가 발생했습니다';
      
      // 429 에러 (할당량 초과) 특별 처리
      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        setPhotoAnalysisError(
          'OpenAI API 할당량이 초과되었습니다. 크레딧을 충전한 후 다시 시도해주세요. 현재는 설문 기반 분석 결과를 확인하실 수 있습니다.'
        );
      } else {
        setPhotoAnalysisError(errorMessage);
      }
    } finally {
      setPhotoAnalyzing(false);
    }
  };

  if (!analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6F0]">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-orange-400 border-t-transparent mx-auto" />
          <p className="text-slate-600">결과 분석 중...</p>
        </div>
      </div>
    );
  }

  const getSeverityLabel = (severity: 'mild' | 'moderate' | 'severe') => {
    const labels = { mild: '가벼움', moderate: '보통', severe: '주의 필요' };
    return labels[severity];
  };

  const getSeverityColor = (severity: 'mild' | 'moderate' | 'severe') => {
    return severity === 'severe' ? 'text-red-600' : severity === 'moderate' ? 'text-amber-600' : 'text-green-600';
  };

  return (
    <>
    <NeoPageLayout maxWidth="lg">
      {/* 헤더 */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block mb-4">
          <h1 className="text-2xl font-bold text-slate-800">포스처랩</h1>
        </Link>
        <div className="inline-block rounded-full border-2 border-slate-900 bg-orange-100 px-4 py-1.5 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
          <span className="text-sm font-semibold text-orange-600">✅ 무료 분석 완료</span>
        </div>
      </div>

      {/* 사진 분석 결과 (있는 경우) */}
      {hasPhotos && (
        <NeoCard className="mb-8 p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">📸</span>
            <h2 className="text-3xl font-bold text-slate-800">사진 기반 체형 관찰</h2>
          </div>

          {photoAnalyzing && (
            <div className="flex items-center gap-4 rounded-xl border-2 border-slate-900 bg-slate-100 p-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <div>
                  <p className="font-semibold text-slate-200">AI가 사진을 분석하고 있습니다...</p>
                  <p className="text-sm text-slate-400">약 10-20초 소요됩니다</p>
                </div>
              </div>
            )}

            {photoAnalysisError && (
              <div className="rounded-xl border-2 border-slate-900 bg-amber-50 p-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="text-lg font-bold text-amber-700">사진 분석 일시 중단</h3>
                </div>
                <p className="text-sm text-slate-700 mb-3">{photoAnalysisError}</p>

                <div className="rounded-lg border-2 border-slate-900 bg-white p-4 mt-4 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <p className="text-sm font-semibold text-slate-800 mb-2">
                    💡 사진 분석을 원하시나요?
                  </p>
                  <p className="text-xs text-slate-600 mb-3">
                    BASIC 플랜으로 업그레이드하시면 전문가가 직접 사진을 분석하고
                    맞춤 운동 가이드를 제공합니다.
                  </p>
                  <a
                    href="#basic-plan"
                    className="inline-flex items-center justify-center font-bold rounded-2xl border-2 border-slate-900 bg-orange-400 px-4 py-2 text-sm text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                  >
                    BASIC 플랜 보기 ↓
                  </a>
                </div>

                <p className="mt-4 text-xs text-slate-600">
                  설문 기반 분석 결과는 아래에서 확인하실 수 있습니다.
                </p>
              </div>
            )}

            {!photoAnalyzing && !photoAnalysisError && photoAnalysis && (
              <div className="space-y-6">
                {/* 사진 품질 체크 */}
                <div className={`rounded-xl p-6 border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)] ${
                  photoAnalysis.qualityCheck.canAnalyze
                    ? 'bg-green-50'
                    : 'bg-amber-50'
                }`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl">
                      {photoAnalysis.qualityCheck.canAnalyze ? '✅' : '⚠️'}
                    </span>
                    <h3 className="text-lg font-bold text-slate-800">
                      사진 품질 체크: {photoAnalysis.qualityCheck.passedChecks}/{photoAnalysis.qualityCheck.totalChecks}
                    </h3>
                  </div>
                  {photoAnalysis.qualityCheck.issues.length > 0 && (
                    <ul className="space-y-1 text-sm text-slate-700">
                      {photoAnalysis.qualityCheck.issues.map((issue, index) => (
                        <li key={index}>• {issue}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 전체 요약 */}
                {photoAnalysis.analysis.summary && (
                  <div className="rounded-xl border-2 border-slate-900 bg-slate-100 p-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <h3 className="mb-3 text-lg font-bold text-slate-800">📋 전체 관찰 요약</h3>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {photoAnalysis.analysis.summary}
                    </p>
                  </div>
                )}

                {/* 관찰 내용 */}
                {photoAnalysis.analysis.observations.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">🔍 상세 관찰 내용</h3>
                    {photoAnalysis.analysis.observations.map((obs, index) => (
                      <div key={index} className="rounded-xl border-2 border-slate-900 bg-white p-5 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                        <h4 className="mb-2 font-bold text-orange-600">[{obs.area}]</h4>
                        <div className="mb-3 text-sm text-slate-700">
                          <span className="font-semibold text-slate-600">관찰: </span>
                          {obs.finding}
                        </div>
                        <div className="mb-3 text-sm text-slate-600">
                          <span className="font-semibold">시각적 근거: </span>
                          {obs.visualEvidence}
                        </div>
                        <div className="text-sm text-slate-600">
                          <span className="font-semibold">가능성 있는 영향: </span>
                          {obs.functionalImpact}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 추천 운동 방향 */}
                {photoAnalysis.recommendations.exercises.length > 0 && (
                  <div className="rounded-xl border-2 border-slate-900 bg-orange-50 p-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <h3 className="mb-3 text-lg font-bold text-slate-800">💪 추천 운동 방향</h3>
                    <ul className="space-y-2">
                      {photoAnalysis.recommendations.exercises.map((exercise, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-orange-500">✓</span>
                          <span>{exercise}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 면책사항 */}
                <div className="rounded-xl border-2 border-slate-900 bg-red-50 p-4 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <p className="text-xs leading-relaxed text-slate-700">
                    <span className="font-semibold text-red-600">⚠️ 중요: </span>
                    {photoAnalysis.disclaimer}
                  </p>
                </div>
              </div>
            )}
        </NeoCard>
        )}

      {/* 결과 요약 카드 */}
      <NeoCard className="mb-8 p-8">
        <h2 className="mb-4 text-3xl font-bold text-slate-800">
          설문 기반 자세 경향
        </h2>
        <div className="mb-6 rounded-xl border-2 border-slate-900 bg-slate-100 p-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
          <div className="mb-2 text-sm text-slate-600">확인된 패턴</div>
          <div className="text-2xl font-bold text-orange-600">
            {POSTURE_TYPE_NAMES[analysis.postureType]}
          </div>
          <div className="mt-3 text-sm">
            <span className="text-slate-600">경향 수준: </span>
            <span className={`font-semibold ${getSeverityColor(analysis.overallSeverity)}`}>
              {getSeverityLabel(analysis.overallSeverity)}
            </span>
          </div>
        </div>

        {/* 부위별 점수 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">부위별 경향 점수</h3>

          <div className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">목/경추 부위</span>
              <span className="text-xl font-bold text-orange-600">{Math.round(analysis.scores.forwardHead)}점</span>
            </div>
          </div>

          <div className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">어깨/흉추 부위</span>
              <span className="text-xl font-bold text-orange-600">{Math.round(analysis.scores.roundedShoulder)}점</span>
            </div>
          </div>

          <div className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">골반/허리 부위</span>
              <span className="text-xl font-bold text-orange-600">
                {Math.round(Math.max(analysis.scores.anteriorPelvicTilt, analysis.scores.posteriorPelvicTilt))}점
              </span>
            </div>
          </div>
        </div>
      </NeoCard>

      {/* 업셀 섹션 - BASIC 플랜 */}
      <div id="basic-plan" className="mb-8 space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">
            더 정확한 분석을 원하시나요?
          </h3>
          <p className="text-slate-600">
            사진 기반 전문가 분석으로 맞춤 운동 가이드를 받아보세요
          </p>
        </div>

        {/* BASIC 플랜 카드 */}
        <NeoCard className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="mb-2 inline-block rounded-full bg-orange-400 px-4 py-1 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                <span className="text-sm font-bold text-white">BASIC 플랜</span>
              </div>
              <h4 className="text-3xl font-bold text-slate-800">₩19,000</h4>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-600">+α</div>
              <div className="text-xs text-slate-600">더 상세하게</div>
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 bg-orange-100 text-orange-600">✓</div>
              <div>
                <div className="font-semibold text-slate-800">정면·측면 사진 분석</div>
                <div className="text-sm text-slate-600">NASM 전문가가 직접 확인</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 bg-orange-100 text-orange-600">✓</div>
              <div>
                <div className="font-semibold text-slate-800">맞춤 운동 루틴 PDF</div>
                <div className="text-sm text-slate-600">24시간 내 이메일 전송</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 bg-orange-100 text-orange-600">✓</div>
              <div>
                <div className="font-semibold text-slate-800">운동 가이드 영상 링크</div>
                <div className="text-sm text-slate-600">따라하기 쉬운 설명</div>
              </div>
            </div>
          </div>

          {/* 샘플 PDF 보기 버튼 */}
          <NeoButton variant="secondary" className="mb-4 w-full" onClick={() => setShowSampleModal(true)}>
            📄 BASIC 플랜 PDF 샘플 보기
          </NeoButton>

          {/* 결제 버튼 */}
          <Link
            href="/pricing"
            className="block w-full rounded-2xl border-2 border-slate-900 bg-orange-400 py-4 text-center text-lg font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
          >
            BASIC 플랜 결제하기
          </Link>
        </NeoCard>
      </div>

      {/* 신뢰 요소 */}
      <NeoCard className="p-6">
        <div className="mb-4 text-center">
          <h3 className="text-lg font-bold text-slate-800">전문가 기반 분석 시스템</h3>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-slate-700">NASM-CES 인증</span>
          </div>
          <div className="h-4 w-px bg-slate-400" />
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <span className="text-slate-700">1,000명+ 분석</span>
          </div>
          <div className="h-4 w-px bg-slate-400" />
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-slate-700">개인정보 보호</span>
          </div>
        </div>

        <div className="rounded-lg border-2 border-slate-900 bg-red-50 p-4 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="font-semibold text-red-600">중요 안내</h4>
              <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                본 서비스는 <strong>의료 행위가 아니며</strong>, 운동 가이드 목적으로만 제공됩니다.
                질병, 통증, 부상이 있는 경우 반드시 의료기관을 방문하세요.
                모든 분석 결과는 "경향" 또는 "가능성"을 나타내며, 의학적 진단을 대체할 수 없습니다.
              </p>
            </div>
          </div>
        </div>
      </NeoCard>

      {/* 홈으로 버튼 */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-200 px-6 py-2 font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:bg-slate-300/80 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </NeoPageLayout>

      {/* 샘플 PDF 모달 */}
      {showSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mb-2 inline-block rounded-full bg-orange-400 px-3 py-1 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <span className="text-xs font-bold text-white">BASIC 플랜</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">결제 시 받게 될 PDF 샘플</h2>
                <p className="mt-2 text-sm text-slate-600">
                  실제 리포트는 고객님의 사진과 설문을 기반으로 맞춤 제작됩니다
                </p>
              </div>
              <button
                onClick={() => setShowSampleModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-200 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:bg-slate-300 active:translate-x-0.5 active:translate-y-0.5"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF 샘플 콘텐츠 */}
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-slate-900 bg-slate-100 p-6 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                <h3 className="mb-3 text-lg font-bold text-orange-600">📋 포함 내용</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>✓ 전문가 분석 코멘트</li>
                  <li>✓ 사진 기반 자세 평가</li>
                  <li>✓ 맞춤 운동 루틴 (4주 프로그램)</li>
                  <li>✓ 운동 영상 QR 코드</li>
                  <li>✓ 주의사항 및 팁</li>
                </ul>
              </div>

              <div className="rounded-xl border-2 border-slate-900 bg-orange-50 p-4 text-center shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                <p className="text-sm text-slate-700">
                  💡 실제 PDF는 8~12페이지 분량으로 제공됩니다
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <NeoButton variant="secondary" className="flex-1" onClick={() => setShowSampleModal(false)}>
                닫기
              </NeoButton>
              <Link
                href="/pricing"
                className="flex flex-1 items-center justify-center rounded-2xl border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)] py-3"
              >
                지금 결제하기
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
