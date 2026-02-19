'use client';

/**
 * Movement Type Test - 공유된 결과 페이지
 * 
 * /movement-test/shared/[shareId]
 * 
 * 다른 사람이 공유한 테스트 결과를 볼 수 있는 읽기 전용 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSubTypeContent } from '@/features/movement-test/data/results/type-descriptions';
import { getConfidenceCopy } from '@/features/movement-test/utils/getConfidenceCopy';
import { createResultStory } from '@/features/movement-test/utils/getResultStory';
import ShareButtons from '../../components/ShareButtons';
import type { SubTypeKey } from '@/types/movement-test';


interface SharedResult {
  shareId: string;
  mainType: string;
  subType: string;
  confidence: number;
  typeScores: Record<string, number>;
  imbalanceYesCount: number;
  imbalanceSeverity: 'none' | 'mild' | 'strong';
  biasMainType?: 'D' | 'N' | 'B' | 'H';
  completedAt: string;
  viewCount: number;
}

export default function SharedResultPage() {
  const router = useRouter();
  const params = useParams();
  const shareId = params.shareId as string;

  const [result, setResult] = useState<SharedResult | null>(null);
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;

    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/movement-test/get-result/${shareId}`);
        
        if (!response.ok) {
          throw new Error('결과를 찾을 수 없습니다.');
        }

        const data = await response.json();
        const sharedResult: SharedResult = data.result;
        setResult(sharedResult);

        // 서브타입 상세 정보 가져오기
        const subTypeKey = 
          sharedResult.subType === '담직-상체고착형' ? 'D_UPPER_LOCK' :
          sharedResult.subType === '담직-하체고착형' ? 'D_LOWER_LOCK' :
          sharedResult.subType === '담직-호흡잠김형' ? 'D_BREATH_LOCK' :
          sharedResult.subType === '담직-전신둔화형' ? 'D_SYSTEM_SLOW' :
          sharedResult.subType === '날림-관절흐름형' ? 'N_JOINT_FLOW' :
          sharedResult.subType === '날림-중심이탈형' ? 'N_CORE_DRIFT' :
          sharedResult.subType === '날림-좌우불균형형' ? 'N_LR_IMBAL' :
          sharedResult.subType === '날림-동작과속형' ? 'N_SPEED_OVER' :
          sharedResult.subType === '버팀-허리의존형' ? 'B_LOWBACK_RELY' :
          sharedResult.subType === '버팀-목어깨과로형' ? 'B_NECK_SHOULDER_OVER' :
          sharedResult.subType === '버팀-무릎집중형' ? 'B_KNEE_FOCUS' :
          sharedResult.subType === '버팀-단측지배형' ? 'B_SINGLE_DOM' :
          sharedResult.subType === '흘림-힘누수형' ? 'H_POWER_LEAK' :
          sharedResult.subType === '흘림-체인단절형' ? 'H_CHAIN_BREAK' :
          sharedResult.subType === '흘림-비대칭전달형' ? 'H_ASYM_TRANSFER' :
          'H_EFFICIENCY_LOW' as SubTypeKey;

        const subTypeContent = getSubTypeContent(subTypeKey);

        // Confidence 문구 생성
        const confidenceCopy = getConfidenceCopy(
          sharedResult.confidence,
          sharedResult.imbalanceSeverity,
          sharedResult.biasMainType
        );

        // 스토리 생성
        const resultStory = createResultStory({
          mainTypeName: sharedResult.mainType,
          subType: {
            subTypeName: subTypeContent.subTypeName,
            headline: subTypeContent.headline,
            summary: subTypeContent.summary
          },
          confidenceCopy: {
            confidenceLabel: confidenceCopy.confidenceLabel,
            confidence: sharedResult.confidence,
            body: confidenceCopy.body,
            imbalanceNote: confidenceCopy.imbalanceNote,
            typeBiasNote: confidenceCopy.typeBiasNote
          },
          imbalanceSeverity: sharedResult.imbalanceSeverity
        });

        setStory({
          ...resultStory,
          subTypeContent
        });
        setLoading(false);

      } catch (err) {
        console.error('Failed to fetch shared result:', err);
        setError((err as Error).message);
        setLoading(false);
      }
    };

    fetchResult();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">결과 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !result || !story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-white mb-4">
            결과를 찾을 수 없습니다
          </h1>
          <p className="text-slate-400 mb-8">
            {error || '공유 링크가 올바르지 않거나 만료되었습니다.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl bg-[#f97316] text-white font-semibold hover:bg-[#ea580c] transition-all duration-200"
          >
            나도 테스트하기
          </button>
        </div>
      </div>
    );
  }

  const { subTypeContent } = story;
  const shareUrl = `${window.location.origin}/movement-test/shared/${shareId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* 공유 배지 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316]/20 border border-[#f97316] rounded-full text-[#f97316] text-sm font-semibold mb-4">
              <span>🔗</span>
              <span>공유된 결과</span>
            </div>
            <p className="text-slate-400 text-sm">
              {result.viewCount}명이 이 결과를 확인했습니다
            </p>
          </div>

          {/* 헤더 */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              움직임 타입 테스트 결과
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

          {/* Quick Win */}
          <div className="bg-gradient-to-r from-[#f97316]/20 to-[#ea580c]/20 border border-[#f97316] rounded-2xl p-8 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">
              💡 바로 체감되는 변화
            </h2>
            <p className="text-slate-200 leading-relaxed text-lg">
              {subTypeContent.quickWin}
            </p>
          </div>

          {/* 공유 버튼 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6 shadow-2xl">
            <ShareButtons
              shareUrl={shareUrl}
              title="움직임 타입 테스트"
              description={story.section2_typeExplain.split('\n')[0]}
              mainType={result.mainType}
              subType={result.subType}
            />
          </div>

          {/* CTA: 나도 테스트하기 */}
          <div className="bg-gradient-to-r from-[#f97316] to-[#ea580c] rounded-2xl p-8 text-center shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">
              나의 움직임 타입이 궁금하다면?
            </h3>
            <p className="text-white/90 mb-6">
              10분이면 나의 움직임 패턴과 맞춤형 교정 가이드를 확인할 수 있어요
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 bg-white text-[#f97316] font-bold rounded-xl hover:bg-slate-100 transition-all duration-200 transform hover:scale-105"
            >
              무료로 테스트하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
