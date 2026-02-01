'use client';

/**
 * Movement Type Test - 결과 페이지
 * 
 * 테스트 결과 표시
 * - 메인 타입 + 서브타입
 * - Confidence 해석
 * - 불균형 보정 설명
 * - 타입별 상세 가이드
 * - CTA (재테스트, 교정 루틴 등)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_QUESTIONS } from '../data/questions';
import { SUBTYPE_CONTENT, getSubTypeContent } from '../data/type-descriptions';
import { calculateTestResult } from '../data/scoring-logic';
import { adjustConfidenceWithImbalance } from '../data/adjustConfidenceWithImbalance';
import { getConfidenceCopy } from '../utils/getConfidenceCopy';
import { createResultStory } from '../utils/getResultStory';
import type { Answer, BinaryAnswer, TestResult } from '../../../types/movement-test';
import { isBinaryAnswer } from '../../../types/movement-test';

export default function MovementTestResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<any>(null);

  useEffect(() => {
    // LocalStorage에서 결과 데이터 불러오기
    const savedResult = localStorage.getItem('movement-test-result');
    
    if (!savedResult) {
      // 저장된 결과가 없으면 메인 페이지로 리다이렉트
      router.push('/movement-test');
      return;
    }

    try {
      const data = JSON.parse(savedResult);
      const answers: Answer[] = data.answers || [];

      // 1. 기본 결과 계산 (메인 타입, 서브타입, 기본 confidence)
      const testResult = calculateTestResult(answers, ALL_QUESTIONS);

      // 2. 불균형 답변 추출
      const imbalanceAnswers: boolean[] = [];
      for (let qId = 31; qId <= 40; qId++) {
        const answer = answers.find(a => a.questionId === qId);
        if (answer && isBinaryAnswer(answer)) {
          imbalanceAnswers.push((answer as BinaryAnswer).answer);
        } else {
          imbalanceAnswers.push(false);
        }
      }

      // 3. 불균형 보정 적용
      const mainTypeCode = 
        testResult.mainType === '담직' ? 'D' :
        testResult.mainType === '날림' ? 'N' :
        testResult.mainType === '버팀' ? 'B' : 'H';

      const adjustmentResult = adjustConfidenceWithImbalance(
        testResult.confidence,
        mainTypeCode,
        imbalanceAnswers
      );

      // 4. 최종 결과 업데이트
      const finalResult: TestResult = {
        ...testResult,
        confidence: adjustmentResult.finalConfidence
      };

      // 5. 서브타입 상세 정보 가져오기
      const subTypeKey = 
        testResult.subType === '담직-상체고착형' ? 'D_UPPER_LOCK' :
        testResult.subType === '담직-하체고착형' ? 'D_LOWER_LOCK' :
        testResult.subType === '담직-호흡잠김형' ? 'D_BREATH_LOCK' :
        testResult.subType === '담직-전신둔화형' ? 'D_SYSTEM_SLOW' :
        testResult.subType === '날림-관절흐름형' ? 'N_JOINT_FLOW' :
        testResult.subType === '날림-중심이탈형' ? 'N_CORE_DRIFT' :
        testResult.subType === '날림-좌우불균형형' ? 'N_LR_IMBAL' :
        testResult.subType === '날림-동작과속형' ? 'N_SPEED_OVER' :
        testResult.subType === '버팀-허리의존형' ? 'B_LOWBACK_RELY' :
        testResult.subType === '버팀-목어깨과로형' ? 'B_NECK_SHOULDER_OVER' :
        testResult.subType === '버팀-무릎집중형' ? 'B_KNEE_FOCUS' :
        testResult.subType === '버팀-단측지배형' ? 'B_SINGLE_DOM' :
        testResult.subType === '흘림-힘누수형' ? 'H_POWER_LEAK' :
        testResult.subType === '흘림-체인단절형' ? 'H_CHAIN_BREAK' :
        testResult.subType === '흘림-비대칭전달형' ? 'H_ASYM_TRANSFER' :
        'H_EFFICIENCY_LOW';

      const subTypeContent = getSubTypeContent(subTypeKey);

      // 6. Confidence 문구 생성
      const confidenceCopy = getConfidenceCopy(
        adjustmentResult.finalConfidence,
        adjustmentResult.debug.severity,
        adjustmentResult.biasMainType
      );

      // 7. 스토리 생성
      const resultStory = createResultStory({
        mainTypeName: testResult.mainType,
        subType: {
          subTypeName: subTypeContent.subTypeName,
          headline: subTypeContent.headline,
          summary: subTypeContent.summary
        },
        confidenceCopy: {
          confidenceLabel: confidenceCopy.confidenceLabel,
          confidence: adjustmentResult.finalConfidence,
          body: confidenceCopy.body,
          imbalanceNote: confidenceCopy.imbalanceNote,
          typeBiasNote: confidenceCopy.typeBiasNote
        },
        imbalanceSeverity: adjustmentResult.debug.severity
      });

      setResult(finalResult);
      setStory({
        ...resultStory,
        subTypeContent,
        adjustmentResult
      });
      setLoading(false);

    } catch (error) {
      console.error('Failed to calculate result:', error);
      router.push('/movement-test');
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">결과 분석 중...</p>
        </div>
      </div>
    );
  }

  if (!result || !story) {
    return null;
  }

  const { subTypeContent } = story;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              테스트 결과
            </h1>
          </div>

          {/* 섹션 1: 타입 선언 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <div className="text-center">
              <p className="text-slate-300 text-lg mb-4 whitespace-pre-line">
                {story.section1_typeDeclare}
              </p>
            </div>
          </div>

          {/* 섹션 2: 타입 핵심 설명 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              이 타입은 어떤 특징이 있나요?
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {story.section2_typeExplain}
              </p>
            </div>
          </div>

          {/* 섹션 3: Confidence 해석 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {story.section3_confidence}
              </p>
            </div>
          </div>

          {/* 섹션 4: 불균형 보정 설명 (조건부) */}
          {story.section4_imbalance && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-amber-700 rounded-2xl p-8 mb-6 shadow-2xl">
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                  {story.section4_imbalance}
                </p>
              </div>
            </div>
          )}

          {/* 주요 특징 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              자주 보이는 특징
            </h2>
            <ul className="space-y-3">
              {subTypeContent.signs.map((sign: string, index: number) => (
                <li key={index} className="flex items-start gap-3 text-slate-300">
                  <span className="text-[#f97316] mt-1">•</span>
                  <span>{sign}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 오해 vs 실제 원인 */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-red-900/20 border border-red-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-red-400 mb-4">
                흔한 오해
              </h3>
              <p className="text-slate-300 leading-relaxed">
                {subTypeContent.commonMisunderstanding}
              </p>
            </div>

            <div className="bg-green-900/20 border border-green-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-green-400 mb-4">
                실제 원인
              </h3>
              <p className="text-slate-300 leading-relaxed">
                {subTypeContent.realCause}
              </p>
            </div>
          </div>

          {/* 우선순위 가이드 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              가장 먼저 잡을 것
            </h2>
            <ul className="space-y-3">
              {subTypeContent.firstFocus.map((focus: string, index: number) => (
                <li key={index} className="flex items-start gap-3 text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#f97316] text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{focus}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 피해야 할 것 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              당분간 피하면 좋은 것
            </h2>
            <ul className="space-y-3">
              {subTypeContent.avoid.map((item: string, index: number) => (
                <li key={index} className="flex items-start gap-3 text-slate-300">
                  <span className="text-amber-500 mt-1">⚠️</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Win */}
          <div className="bg-gradient-to-r from-[#f97316]/20 to-[#ea580c]/20 border border-[#f97316] rounded-2xl p-8 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">
              💡 바로 체감되는 변화
            </h2>
            <p className="text-slate-200 leading-relaxed text-lg">
              {subTypeContent.quickWin}
            </p>
          </div>

          {/* 섹션 5: 다음 행동(CTA) */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {story.section5_nextAction}
              </p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                localStorage.removeItem('movement-test-result');
                router.push('/movement-test');
              }}
              className="py-4 px-6 rounded-xl font-semibold text-lg bg-slate-700 text-white hover:bg-slate-600 transition-all duration-200"
            >
              다시 테스트하기
            </button>

            <button
              onClick={() => router.push('/coaching')}
              className="py-4 px-6 rounded-xl font-semibold text-lg bg-[#f97316] text-white hover:bg-[#ea580c] transition-all duration-200"
            >
              1:1 코칭 신청하기
            </button>
          </div>

          {/* 디버그 정보 (개발용, 추후 제거 가능) */}
          {process.env.NODE_ENV === 'development' && story.adjustmentResult && (
            <div className="mt-8 bg-slate-900/50 border border-slate-700 rounded-xl p-6">
              <details>
                <summary className="text-slate-400 cursor-pointer hover:text-slate-300 mb-4">
                  🔧 디버그 정보
                </summary>
                <div className="space-y-2 text-sm text-slate-400 font-mono">
                  <p>메인 타입: {result.mainType}</p>
                  <p>서브타입: {result.subType}</p>
                  <p>Confidence: {result.confidence}%</p>
                  <p>불균형 YES: {story.adjustmentResult.debug.yesCount}/10</p>
                  <p>불균형 강도: {story.adjustmentResult.debug.severity}</p>
                  <p>보정 적용: +{story.adjustmentResult.debug.appliedAdjustment}</p>
                  <p>H 가중치: {story.adjustmentResult.debug.hImb.toFixed(1)}</p>
                  <p>N 가중치: {story.adjustmentResult.debug.nImb.toFixed(1)}</p>
                  <p>B 가중치: {story.adjustmentResult.debug.bImb.toFixed(1)}</p>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
