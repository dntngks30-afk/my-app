'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { analyzeSurveyResults } from '@/lib/survey-analyzer';
import { POSTURE_TYPE_NAMES } from '@/lib/survey-analyzer';
import type { AnalysisResult } from '@/types/survey';

export default function FreeSurveyResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showSampleModal, setShowSampleModal] = useState(false);

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
    } catch (error) {
      console.error('분석 오류:', error);
      router.push('/free-survey');
    }
  }, [router]);

  if (!analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f97316] border-t-transparent mx-auto" />
          <p className="text-slate-400">결과 분석 중...</p>
        </div>
      </div>
    );
  }

  const getSeverityLabel = (severity: 'mild' | 'moderate' | 'severe') => {
    const labels = { mild: '가벼움', moderate: '보통', severe: '주의 필요' };
    return labels[severity];
  };

  const getSeverityColor = (severity: 'mild' | 'moderate' | 'severe') => {
    return severity === 'severe' ? 'text-red-400' : severity === 'moderate' ? 'text-yellow-400' : 'text-green-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-2xl font-bold text-white">포스처랩</h1>
          </Link>
          <div className="inline-block rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5">
            <span className="text-sm font-semibold text-green-400">✅ 무료 분석 완료</span>
          </div>
        </div>

        {/* 결과 요약 카드 */}
        <div className="mb-8 rounded-2xl border-2 border-[#f97316] bg-gradient-to-br from-[#f97316]/10 to-slate-900 p-8">
          <h2 className="mb-4 text-3xl font-bold text-slate-100">
            나의 자세 경향
          </h2>
          <div className="mb-6 rounded-xl bg-slate-950/50 p-6">
            <div className="mb-2 text-sm text-slate-400">확인된 패턴</div>
            <div className="text-2xl font-bold text-[#f97316]">
              {POSTURE_TYPE_NAMES[analysis.postureType]}
            </div>
            <div className="mt-3 text-sm">
              <span className="text-slate-400">경향 수준: </span>
              <span className={`font-semibold ${getSeverityColor(analysis.overallSeverity)}`}>
                {getSeverityLabel(analysis.overallSeverity)}
              </span>
            </div>
          </div>

          {/* 부위별 점수 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-200">부위별 경향 점수</h3>
            
            <div className="rounded-lg bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">목/경추 부위</span>
                <span className="text-xl font-bold text-[#f97316]">{Math.round(analysis.scores.forwardHead)}점</span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">어깨/흉추 부위</span>
                <span className="text-xl font-bold text-[#f97316]">{Math.round(analysis.scores.roundedShoulder)}점</span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">골반/허리 부위</span>
                <span className="text-xl font-bold text-[#f97316]">
                  {Math.round(Math.max(analysis.scores.anteriorPelvicTilt, analysis.scores.posteriorPelvicTilt))}점
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 업셀 섹션 - BASIC 플랜 */}
        <div className="mb-8 space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-100 mb-2">
              더 정확한 분석을 원하시나요?
            </h3>
            <p className="text-slate-400">
              사진 기반 전문가 분석으로 맞춤 운동 가이드를 받아보세요
            </p>
          </div>

          {/* BASIC 플랜 카드 */}
          <div className="rounded-2xl border-2 border-[#f97316] bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mb-2 inline-block rounded-full bg-[#f97316] px-4 py-1">
                  <span className="text-sm font-bold text-white">BASIC 플랜</span>
                </div>
                <h4 className="text-3xl font-bold text-slate-100">₩19,000</h4>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#f97316]">+α</div>
                <div className="text-xs text-slate-400">더 상세하게</div>
              </div>
            </div>

            <div className="mb-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316]/20 text-[#f97316]">✓</div>
                <div>
                  <div className="font-semibold text-slate-200">정면·측면 사진 분석</div>
                  <div className="text-sm text-slate-400">NASM 전문가가 직접 확인</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316]/20 text-[#f97316]">✓</div>
                <div>
                  <div className="font-semibold text-slate-200">맞춤 운동 루틴 PDF</div>
                  <div className="text-sm text-slate-400">24시간 내 이메일 전송</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316]/20 text-[#f97316]">✓</div>
                <div>
                  <div className="font-semibold text-slate-200">운동 가이드 영상 링크</div>
                  <div className="text-sm text-slate-400">따라하기 쉬운 설명</div>
                </div>
              </div>
            </div>

            {/* 샘플 PDF 보기 버튼 */}
            <button
              onClick={() => setShowSampleModal(true)}
              className="mb-4 w-full rounded-xl border-2 border-[#f97316]/50 bg-slate-950/50 py-3 text-center font-semibold text-[#f97316] transition hover:bg-slate-950"
            >
              📄 BASIC 플랜 PDF 샘플 보기
            </button>

            {/* 결제 버튼 */}
            <Link
              href="/pricing"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white shadow-lg transition hover:shadow-xl"
            >
              BASIC 플랜 결제하기
            </Link>
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 text-center">
          <p className="text-sm text-slate-400">
            ⚠️ 이 결과는 자가 체크 기반이며, 참고 정보로만 활용하세요.
            <br />
            통증이나 질병이 있다면 의료기관을 방문해주세요.
          </p>
        </div>

        {/* 홈으로 버튼 */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block rounded-full border border-slate-700 px-6 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>

      {/* 샘플 PDF 모달 */}
      {showSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mb-2 inline-block rounded-full bg-[#f97316] px-3 py-1">
                  <span className="text-xs font-bold text-white">BASIC 플랜</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">결제 시 받게 될 PDF 샘플</h2>
                <p className="mt-2 text-sm text-slate-400">
                  실제 리포트는 고객님의 사진과 설문을 기반으로 맞춤 제작됩니다
                </p>
              </div>
              <button
                onClick={() => setShowSampleModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:bg-slate-900"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF 샘플 콘텐츠 */}
            <div className="space-y-4 text-slate-300">
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                <h3 className="mb-3 text-lg font-bold text-[#f97316]">📋 포함 내용</h3>
                <ul className="space-y-2 text-sm">
                  <li>✓ 전문가 분석 코멘트</li>
                  <li>✓ 사진 기반 자세 평가</li>
                  <li>✓ 맞춤 운동 루틴 (4주 프로그램)</li>
                  <li>✓ 운동 영상 QR 코드</li>
                  <li>✓ 주의사항 및 팁</li>
                </ul>
              </div>

              <div className="rounded-xl bg-slate-800/50 p-4 text-center">
                <p className="text-sm text-slate-400">
                  💡 실제 PDF는 8~12페이지 분량으로 제공됩니다
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowSampleModal(false)}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-slate-300 transition hover:bg-slate-800"
              >
                닫기
              </button>
              <Link
                href="/pricing"
                className="flex-1 rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-3 text-center font-bold text-white transition hover:shadow-lg"
              >
                지금 결제하기
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
