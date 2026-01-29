'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeSurveyResults, POSTURE_TYPE_NAMES } from '@/lib/survey-analyzer';
import type { AnalysisResult } from '@/types/survey';
import Link from 'next/link';

export default function SurveyResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // localStorage에서 설문 응답 가져오기
    const responsesStr = localStorage.getItem('survey_responses');
    
    if (!responsesStr) {
      router.push('/survey');
      return;
    }
    
    try {
      const responses = JSON.parse(responsesStr);
      const result = analyzeSurveyResults(responses);
      setAnalysis(result);
    } catch (error) {
      console.error('분석 에러:', error);
      router.push('/survey');
    } finally {
      setLoading(false);
    }
  }, [router]);
  
  if (loading || !analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-slate-300">분석 중...</p>
        </div>
      </div>
    );
  }
  
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-green-500';
  };
  
  const getSeverityBadge = (severity: 'mild' | 'moderate' | 'severe') => {
    const styles = {
      mild: 'bg-green-500/20 text-green-400 border-green-500/30',
      moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      severe: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    const labels = {
      mild: '참고 수준 (경미)',
      moderate: '참고 수준 (보통)',
      severe: '전문가 상담 권장'
    };
    return (
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${styles[severity]}`}>
        {labels[severity]}
      </span>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-white">포스처랩</h1>
          </Link>
          <p className="mt-2 text-sm text-slate-400">자가 체크 결과 (참고용)</p>
        </div>
        
        {/* 메인 결과 카드 */}
        <div className="mb-6 rounded-2xl border border-orange-500/50 bg-gradient-to-br from-orange-500/20 to-amber-500/20 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              📋 자가 체크 완료
            </h2>
            {getSeverityBadge(analysis.overallSeverity)}
          </div>
          
          <div className="mb-4 rounded-xl bg-slate-900/50 p-4">
            <p className="mb-2 text-sm text-slate-400">확인된 자세 경향 (참고용)</p>
            <p className="text-xl font-bold text-white sm:text-2xl">
              {POSTURE_TYPE_NAMES[analysis.postureType]}
            </p>
          </div>
          
          <p className="text-slate-300">
            💡 아래 결과는 자가 체크 기반이며, 의학적 진단이 아닙니다.
          </p>
        </div>
        
        {/* 점수 카드 */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <p className="mb-2 text-sm text-slate-400">목/경추</p>
            <p className="mb-2 text-3xl font-bold text-white">
              {analysis.scores.forwardHead.toFixed(0)}점
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(analysis.scores.forwardHead)}`}
                style={{ width: `${analysis.scores.forwardHead}%` }}
              />
            </div>
          </div>
          
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <p className="mb-2 text-sm text-slate-400">어깨/흉추</p>
            <p className="mb-2 text-3xl font-bold text-white">
              {analysis.scores.roundedShoulder.toFixed(0)}점
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(analysis.scores.roundedShoulder)}`}
                style={{ width: `${analysis.scores.roundedShoulder}%` }}
              />
            </div>
          </div>
          
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <p className="mb-2 text-sm text-slate-400">골반 전방</p>
            <p className="mb-2 text-3xl font-bold text-white">
              {analysis.scores.anteriorPelvicTilt.toFixed(0)}점
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(analysis.scores.anteriorPelvicTilt)}`}
                style={{ width: `${analysis.scores.anteriorPelvicTilt}%` }}
              />
            </div>
          </div>
          
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <p className="mb-2 text-sm text-slate-400">골반 후방</p>
            <p className="mb-2 text-3xl font-bold text-white">
              {analysis.scores.posteriorPelvicTilt.toFixed(0)}점
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(analysis.scores.posteriorPelvicTilt)}`}
                style={{ width: `${analysis.scores.posteriorPelvicTilt}%` }}
              />
            </div>
          </div>
        </div>
        
        <p className="mb-6 text-center text-xs text-slate-500">
          * 점수는 자가 체크 기반 참고 정보이며, 의학적 평가가 아닙니다.
        </p>
        
        {/* 확인된 경향 */}
        {analysis.primaryIssues.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">🔍 확인된 자세 경향 (참고 정보)</h3>
            <div className="space-y-3">
              {analysis.primaryIssues.map((issue, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      issue.severity === 'severe' ? 'bg-red-500/20 text-red-400' :
                      issue.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      •
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">[{issue.area}]</p>
                    <p className="text-sm text-slate-300">{issue.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 참고 가이드 */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 className="mb-4 text-lg font-bold text-white">💡 참고 가이드 (추천 운동)</h3>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex gap-3 text-slate-300">
                <span className="flex-shrink-0 text-orange-500">•</span>
                <span className="flex-1 text-sm">{rec}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            * 운동 효과는 개인차가 있으며, 통증이 있는 경우 의료 전문가와 상담하세요.
          </p>
        </div>
        
        {/* 문제 인식 강화 */}
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-6">
          <h3 className="mb-3 text-lg font-bold text-amber-300">
            ⚠️ 지금 관리하지 않으면?
          </h3>
          <ul className="mb-4 space-y-2 text-sm text-slate-300">
            <li className="flex gap-2">
              <span className="text-amber-400">•</span>
              <span>불편함이 점점 강해질 수 있습니다</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">•</span>
              <span>나쁜 자세 습관이 고착화될 수 있습니다</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">•</span>
              <span>혼자 하면 잘못된 운동으로 악화될 수 있습니다</span>
            </li>
          </ul>
          <p className="mb-4 text-sm text-slate-400">
            전문가의 피드백으로 올바른 방향을 찾고 싶다면?
          </p>
          <Link
            href="/pricing"
            className="inline-block rounded-full border-2 border-amber-400 bg-transparent px-6 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-400/10"
          >
            전문가 가이드 서비스 알아보기
          </Link>
        </div>
        
        {/* 중요 안내 */}
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="mb-2 text-sm font-bold text-red-300">
              ⚠️ 필독: 본 결과의 한계
            </p>
            <ul className="space-y-1 text-xs text-red-200">
              <li>• 본 결과는 자가 체크 기반이며, 의학적 진단이 아닙니다.</li>
              <li>• AI나 전문가가 직접 판단한 것이 아닙니다.</li>
              <li>• 실제 상태와 다를 수 있으며, 참고 정보로만 활용하세요.</li>
              <li>• 통증, 질병, 부상이 있는 경우 반드시 의료기관을 방문하세요.</li>
            </ul>
          </div>
          
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-xs text-blue-200">
              💡 더 정확한 평가를 원하시면 사진 2장으로 전문가의 피드백을 받아보세요.
              (그래도 의학적 진단은 아닙니다)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
