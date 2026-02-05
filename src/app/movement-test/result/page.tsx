'use client';

import { useEffect, useMemo, useState } from 'react';
import { TITLES } from '@/features/movement-test/copy/titles';
import { DESCRIPTIONS } from '@/features/movement-test/copy/descriptions';

import { useRouter } from 'next/navigation';
import { ALL_QUESTIONS } from '@/features/movement-test/data/questions';
import { calculateTestResult } from '@/lib/movement-test/scoring-logic';
import { getSubTypeContent } from '@/features/movement-test/data/results/type-descriptions';
import { getConfidenceCopy } from '@/features/movement-test/utils/getConfidenceCopy';
import { createResultStory } from '@/features/movement-test/utils/getResultStory';
import ShareButtons from '../components/ShareButtons';
import type { Answer, SubTypeKey } from '@/types/movement-test';
import { adjustConfidenceWithImbalance } from '@/features/movement-test/data/results/adjustConfidenceWithImbalance';



// I3: 세션 키 통일 (SDD 준수)
const SESSION_STORAGE_KEY = 'movementTestSession:v1';
const LEGACY_STORAGE_KEY = 'movement-test-result'; // 호환성 유지

export default function ResultPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // 우선: 새로운 세션 키에서 읽기 (SDD 준수)
      const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionRaw) {
        const sessionData = JSON.parse(sessionRaw);
        if (sessionData.isCompleted && sessionData.answers) {
          // Record<string, any> -> Answer[] 변환
          const answersArray: Answer[] = Object.values(sessionData.answers).filter(
            (a): a is Answer => a !== null && typeof a === 'object'
          );
          setAnswers(answersArray.length > 0 ? answersArray : null);
          setLoading(false);
          return;
        }
      }

      // 호환성: 기존 키에서 읽기
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacyData = JSON.parse(legacyRaw);
        setAnswers(legacyData.answers || null);
        setLoading(false);
        return;
      }

      setAnswers(null);
    } catch {
      setAnswers(null);
    }
    setLoading(false);
  }, []);

  const result = useMemo(() => {
    if (!answers) return null;
    return calculateTestResult(answers, ALL_QUESTIONS);
  }, [answers]);

  const adjustedResult = useMemo(() => {
    if (!result || !answers) return null;

    const imbalanceAnswers = answers
      .filter((a) => {
        const q = ALL_QUESTIONS.find((qq) => qq.id === a.questionId);
        return q && 'imbalanceFlag' in q && q.imbalanceFlag === true;
      })
      .map((a) => {
        return 'answer' in a && a.answer === true;
      });

    const mainTypeCode =
      result.mainType === '담직' ? 'D' : result.mainType === '날림' ? 'N' : result.mainType === '버팀' ? 'B' : 'H';

    const adjustment = adjustConfidenceWithImbalance(result.confidence, mainTypeCode, imbalanceAnswers);

    return {
      ...result,
      confidence: adjustment.finalConfidence,
      imbalanceSeverity: adjustment.debug.severity,
      biasMainType: adjustment.biasMainType,
    };
  }, [result, answers]);

  const story = useMemo(() => {
    if (!adjustedResult) return null;

    const subTypeKey =
      adjustedResult.subType === '담직-상체고착형'
        ? 'D_UPPER_LOCK'
        : adjustedResult.subType === '담직-하체고착형'
          ? 'D_LOWER_LOCK'
          : adjustedResult.subType === '담직-호흡잠김형'
            ? 'D_BREATH_LOCK'
            : adjustedResult.subType === '담직-전신둔화형'
              ? 'D_SYSTEM_SLOW'
              : adjustedResult.subType === '날림-관절흐름형'
                ? 'N_JOINT_FLOW'
                : adjustedResult.subType === '날림-중심이탈형'
                  ? 'N_CORE_DRIFT'
                  : adjustedResult.subType === '날림-좌우불균형형'
                    ? 'N_LR_IMBAL'
                    : adjustedResult.subType === '날림-동작과속형'
                      ? 'N_SPEED_OVER'
                      : adjustedResult.subType === '버팀-허리의존형'
                        ? 'B_LOWBACK_RELY'
                        : adjustedResult.subType === '버팀-목어깨과로형'
                          ? 'B_NECK_SHOULDER_OVER'
                          : adjustedResult.subType === '버팀-무릎집중형'
                            ? 'B_KNEE_FOCUS'
                            : adjustedResult.subType === '버팀-단측지배형'
                              ? 'B_SINGLE_DOM'
                              : adjustedResult.subType === '흘림-힘누수형'
                                ? 'H_POWER_LEAK'
                                : adjustedResult.subType === '흘림-체인단절형'
                                  ? 'H_CHAIN_BREAK'
                                  : adjustedResult.subType === '흘림-비대칭전달형'
                                    ? 'H_ASYM_TRANSFER'
                                    : 'H_EFFICIENCY_LOW';

    const subTypeContent = getSubTypeContent(subTypeKey as SubTypeKey);
    const confidenceCopy = getConfidenceCopy(
      adjustedResult.confidence,
      adjustedResult.imbalanceSeverity,
      adjustedResult.biasMainType
    );

    return createResultStory({
      mainTypeName: adjustedResult.mainType,
      subType: {
        subTypeName: subTypeContent.subTypeName,
        headline: subTypeContent.headline,
        summary: subTypeContent.summary,
      },
      confidenceCopy: {
        confidenceLabel: confidenceCopy.confidenceLabel,
        confidence: adjustedResult.confidence,
        body: confidenceCopy.body,
        imbalanceNote: confidenceCopy.imbalanceNote,
        typeBiasNote: confidenceCopy.typeBiasNote,
      },
      imbalanceSeverity: adjustedResult.imbalanceSeverity,
    });
  }, [adjustedResult]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--text)] text-lg">결과 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!result || !story || !adjustedResult) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-4">{DESCRIPTIONS.noResult}</h1>
          <p className="text-[var(--muted)] mb-8">테스트를 먼저 진행해주세요.</p>
          <button
            onClick={() => router.push('/test')}
            className="px-6 py-3 rounded-xl bg-[var(--brand)] text-white font-semibold hover:bg-[#ea580c] transition-all duration-200"
          >
            테스트 하러 가기
          </button>
        </div>
      </div>
    );
  }

  const subTypeKey =
    adjustedResult.subType === '담직-상체고착형'
      ? 'D_UPPER_LOCK'
      : adjustedResult.subType === '담직-하체고착형'
        ? 'D_LOWER_LOCK'
        : adjustedResult.subType === '담직-호흡잠김형'
          ? 'D_BREATH_LOCK'
          : adjustedResult.subType === '담직-전신둔화형'
            ? 'D_SYSTEM_SLOW'
            : adjustedResult.subType === '날림-관절흐름형'
              ? 'N_JOINT_FLOW'
              : adjustedResult.subType === '날림-중심이탈형'
                ? 'N_CORE_DRIFT'
                : adjustedResult.subType === '날림-좌우불균형형'
                  ? 'N_LR_IMBAL'
                  : adjustedResult.subType === '날림-동작과속형'
                    ? 'N_SPEED_OVER'
                    : adjustedResult.subType === '버팀-허리의존형'
                      ? 'B_LOWBACK_RELY'
                      : adjustedResult.subType === '버팀-목어깨과로형'
                        ? 'B_NECK_SHOULDER_OVER'
                        : adjustedResult.subType === '버팀-무릎집중형'
                          ? 'B_KNEE_FOCUS'
                          : adjustedResult.subType === '버팀-단측지배형'
                            ? 'B_SINGLE_DOM'
                            : adjustedResult.subType === '흘림-힘누수형'
                              ? 'H_POWER_LEAK'
                              : adjustedResult.subType === '흘림-체인단절형'
                                ? 'H_CHAIN_BREAK'
                                : adjustedResult.subType === '흘림-비대칭전달형'
                                  ? 'H_ASYM_TRANSFER'
                                  : 'H_EFFICIENCY_LOW';

  const subTypeContent = getSubTypeContent(subTypeKey as SubTypeKey);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/movement-test/shared/...` : '';

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-12">
          <h1 className="text-2xl font-bold text-[var(--text)] mb-4">{TITLES.result}</h1>
          </div>

          {/* 섹션 1: 타입 선언 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <div className="text-center">
              <p className="text-[var(--text)] text-lg mb-4 whitespace-pre-line">
                {story.section1_typeDeclare.replace(/\*\*/g, '')}
              </p>
            </div>
          </div>

          {/* 섹션 2: 타입 핵심 설명 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[var(--text)] mb-6">이 타입은 어떤 특징이 있나요?</h2>
            <div className="prose max-w-none">
              <p className="text-[var(--text)] leading-relaxed whitespace-pre-line">
                {story.section2_typeExplain.replace(/\*\*/g, '')}
              </p>
            </div>
          </div>

          {/* 섹션 3: Confidence 해석 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <div className="prose max-w-none">
              <p className="text-[var(--text)] leading-relaxed whitespace-pre-line">
                {story.section3_confidence.replace(/\*\*/g, '')}
              </p>
            </div>
          </div>

          {/* 섹션 4: 불균형 보정 설명 */}
          {story.section4_imbalance && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
              <div className="prose max-w-none">
                <p className="text-[var(--text)] leading-relaxed whitespace-pre-line">
                  {story.section4_imbalance.replace(/\*\*/g, '')}
                </p>
              </div>
            </div>
          )}

          {/* 주요 특징 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[var(--text)] mb-6">자주 보이는 특징</h2>
            <ul className="space-y-3">
              {subTypeContent.signs.map((sign: string, index: number) => (
                <li key={index} className="flex items-start gap-3 text-[var(--text)]">
                  <span className="text-[var(--brand)] mt-1">•</span>
                  <span>{sign}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Win */}
          <div className="bg-[var(--brand-soft)] border border-[var(--brand)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[var(--text)] mb-4">💡 바로 체감되는 변화</h2>
            <p className="text-[var(--text)] leading-relaxed text-lg">{subTypeContent.quickWin}</p>
          </div>

          {/* 다음 행동 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <div className="prose max-w-none">
              <p className="text-[var(--text)] leading-relaxed whitespace-pre-line">
                {story.section5_nextAction.replace(/\*\*/g, '')}
              </p>
            </div>
          </div>

          {/* CTA: 심층분석 (정보형) - I4 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 mb-6 shadow-sm">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-[var(--text)] mb-3">더 자세한 분석이 필요하신가요?</h3>
              <p className="text-[var(--muted)] mb-6 leading-relaxed">
                사진/영상 업로드와 전문가 코멘트를 통해<br />
                더 정확하고 맞춤형인 움직임 분석을 받아보세요
              </p>
              <button
                onClick={() => router.push('/deep-analysis')}
                className="px-6 py-3 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--text)] font-medium rounded-xl transition-all duration-200"
              >
                심층분석 알아보기
              </button>
            </div>
          </div>

          {/* CTA: 다시 테스트하기 */}
          <div className="bg-[var(--brand)] rounded-xl p-6 md:p-8 text-center shadow-sm">
            <h3 className="text-2xl font-bold text-white mb-4">다시 테스트하기</h3>
            <p className="text-white/90 mb-6">몸 상태가 달라지면 결과도 달라질 수 있어요</p>
            <button
              onClick={() => router.push('/test')}
              className="px-8 py-4 bg-white text-[var(--brand)] font-bold rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              다시 테스트하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
