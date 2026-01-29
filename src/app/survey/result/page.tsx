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
      mild: '경미한 상태',
      moderate: '보통 상태',
      severe: '개선 필요'
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
          <p className="mt-2 text-sm text-slate-400">자세 분석 결과</p>
        </div>
        
        {/* 메인 결과 카드 */}
        <div className="mb-6 rounded-2xl border border-orange-500/50 bg-gradient-to-br from-orange-500/20 to-amber-500/20 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              🎯 분석 완료!
            </h2>
            {getSeverityBadge(analysis.overallSeverity)}
          </div>
          
          <div className="mb-4 rounded-xl bg-slate-900/50 p-4">
            <p className="mb-2 text-sm text-slate-400">주요 체형 유형</p>
            <p className="text-xl font-bold text-white sm:text-2xl">
              {POSTURE_TYPE_NAMES[analysis.postureType]}
            </p>
          </div>
          
          <p className="text-slate-300">
            상세한 분석 리포트가 이메일로 발송되었습니다. (준비 중)
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
          * 0-30점: 양호 | 30-60점: 주의 필요 | 60-100점: 개선 필요
        </p>
        
        {/* 주요 발견사항 */}
        {analysis.primaryIssues.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">🔍 주요 발견사항</h3>
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
        
        {/* 맞춤 권장사항 */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 className="mb-4 text-lg font-bold text-white">✨ 맞춤 권장사항</h3>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex gap-3 text-slate-300">
                <span className="flex-shrink-0 text-orange-500">•</span>
                <span className="flex-1 text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* CTA */}
        <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-center shadow-lg">
          <h3 className="mb-2 text-xl font-bold text-white">
            🎉 더 자세한 분석을 원하시나요?
          </h3>
          <p className="mb-4 text-sm text-white/90">
            사진 2장 + 전문가 영상 피드백으로 정확한 개선 방향을 받아보세요!
          </p>
          <Link
            href="/pricing"
            className="inline-block rounded-full bg-white px-8 py-3 font-bold text-orange-500 transition hover:bg-slate-100"
          >
            플랜 확인하기 →
          </Link>
        </div>
        
        {/* 면책 조항 */}
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-xs text-red-300">
            ⚠️ 본 결과는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.
            통증, 질병, 부상이 있는 경우 반드시 의료 전문가와 상담하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
