/**
 * PDF Factory - FREE vs PAID 분기 시스템
 * 
 * 📌 공통 시스템 역할:
 * 피트니스·체형·생활습관 분석 리포트를 제작하는 전문 AI 퍼스널 트레이너
 * 
 * 🔀 분기 조건:
 * - FREE: 신뢰 확보용 (갈증 유발)
 * - PAID: 결제 정당화용 (전문가 컨설팅 느낌)
 */

import React from 'react';
import { renderToBuffer, Document } from '@react-pdf/renderer';
import type { CTAConfig } from './free-report-pdf';
import { FreeReportPDF, getCTAMessage } from './free-report-pdf';
import { PremiumReportPDF } from './premium-report-pdf';
import type { AnalysisResult } from '@/types/survey';

// PDF 타입 정의
export type PDFType = 'FREE' | 'PAID';

// PDF 생성 옵션
export interface PDFGenerationOptions {
  pdfType: PDFType;
  analysis: AnalysisResult;
  userProfile: {
    name: string;
    email: string;
    age?: string;
    gender?: string;
  };
  surveyResponses: Record<string, string | string[]>;
  ctaConfig?: CTAConfig;
  observations?: Array<{
    area: string;
    finding: string;
    visualEvidence: string;
    functionalImpact: string;
  }>;
}

// PDF 생성 결과
export interface PDFGenerationResult {
  buffer: Buffer;
  filename: string;
  pdfType: PDFType;
  pageCount: number;
}

/**
 * FREE vs PAID PDF 분기 생성
 */
export async function generatePDF(options: PDFGenerationOptions): Promise<PDFGenerationResult> {
  const { pdfType, analysis, userProfile, surveyResponses, ctaConfig, observations } = options;

  if (pdfType === 'FREE') {
    return generateFreePDF(analysis, userProfile, ctaConfig, observations);
  } else {
    return generatePaidPDF(analysis, userProfile, surveyResponses);
  }
}

/**
 * 🆓 FREE PDF 생성 (신뢰 확보용)
 * 
 * 🎯 목적:
 * - 사용자가 "이 서비스 믿을 수 있다"고 느끼게 만들 것
 * - 그러나 "이걸로는 아직 부족하다"는 갈증을 남길 것
 * 
 * ✅ 포함 요소:
 * 1. 표지 - "무료 체험 리포트" 명확히 표기
 * 2. 사용자 요약 (간결) - 문제 1~2가지만
 * 3. 문제 인식 중심 분석 - 개인 단정 ❌, 일반적 경향 톤
 * 4. 방향성 제안 - 구체 운동 ❌, 우선순위 ❌, 주차별 계획 ❌
 * 5. CTA - 유료 종합 리포트 유도
 * 
 * 🚫 절대 하지 말 것:
 * - 개인 맞춤 단정
 * - 구체적인 운동 조합
 * - 실행 로드맵
 * - 회복·생활습관 세부 가이드
 */
async function generateFreePDF(
  analysis: AnalysisResult,
  userProfile: { name: string; email: string },
  ctaConfig?: CTAConfig,
  observations?: Array<{
    area: string;
    finding: string;
    visualEvidence: string;
    functionalImpact: string;
  }>
): Promise<PDFGenerationResult> {
  
  // 기본 CTA 설정
  const defaultCtaConfig: CTAConfig = ctaConfig || {
    analysisStatus: 'limited',
    confidenceLevel: 'low',
    hasPhotos: false,
    photoQualityPassed: false,
  };

  const element = React.createElement(FreeReportPDF, {
    analysis,
    ctaConfig: defaultCtaConfig,
    userEmail: userProfile.email,
    userName: userProfile.name,
    observations: observations || [],
  }) as React.ReactElement<React.ComponentProps<typeof Document>>;

  const buffer = await renderToBuffer(element);
  const filename = `PostureLab_무료체험_${userProfile.name}_${formatDate()}.pdf`;

  return {
    buffer,
    filename,
    pdfType: 'FREE',
    pageCount: 1, // FREE는 1페이지
  };
}

/**
 * 💰 PAID PDF 생성 (결제 정당화용)
 * 
 * 🎯 목적:
 * - "이건 전문가 컨설팅 받은 느낌이다"라고 느끼게 만들 것
 * 
 * ✅ 포함 요소:
 * 1. 프리미엄 표지 - 사용자 이름, 분석 신뢰 문구
 * 2. 정밀 사용자 요약 - TOP 3 문제, 우선 해결 순위
 * 3. 심층 문제 분석 - 문제 정의, 원인, 리스크, 해결 필요성
 * 4. 체형 & 움직임 패턴 분석 - 개인 분석 느낌
 * 5. 개인 맞춤 운동 전략 - 반드시/피해야 할 운동, 우선순위
 * 6. 생활습관 & 회복 전략 - 수면, 활동량, 스트레스
 * 7. 4주 실행 로드맵 - FREE에는 절대 없음 (결정적 차이)
 * 8. 프리미엄 마무리 문구
 */
async function generatePaidPDF(
  analysis: AnalysisResult,
  userProfile: { name: string; email: string; age?: string; gender?: string },
  surveyResponses: Record<string, string | string[]>
): Promise<PDFGenerationResult> {
  
  const element = React.createElement(PremiumReportPDF, {
    analysis,
    userProfile,
    surveyResponses,
  }) as React.ReactElement<React.ComponentProps<typeof Document>>;

  const buffer = await renderToBuffer(element);
  const filename = `PostureLab_종합분석_${userProfile.name}_${formatDate()}.pdf`;

  return {
    buffer,
    filename,
    pdfType: 'PAID',
    pageCount: 8, // PAID는 8페이지
  };
}

/**
 * PDF 타입 결정 로직
 */
export function determinePDFType(
  userPlan: 'free' | 'basic' | 'standard' | 'premium' | 'vip'
): PDFType {
  if (userPlan === 'free') {
    return 'FREE';
  }
  return 'PAID';
}

/**
 * 날짜 포맷
 */
function formatDate(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * FREE vs PAID 차이점 요약
 */
export const PDF_DIFFERENCES = {
  FREE: {
    pages: 1,
    includes: [
      '무료 체험 리포트 표기',
      '컨디션 전반 요약',
      '문제 1~2가지 (개괄적)',
      '일반적 경향 분석',
      '방향성 제안 (구체 운동 ❌)',
      '유료 업그레이드 CTA',
    ],
    excludes: [
      '개인 맞춤 단정',
      '구체적 운동 조합',
      '실행 로드맵',
      '4주 행동 가이드',
      '생활습관 세부 가이드',
      '체형 패턴 심층 분석',
    ],
  },
  PAID: {
    pages: 8,
    includes: [
      '프리미엄 표지 (이름 명시)',
      'TOP 3 문제 + 우선순위',
      '심층 문제 분석 (원인, 리스크)',
      '체형 & 움직임 패턴 분석',
      '개인 맞춤 운동 전략',
      '생활습관 & 회복 전략',
      '4주 실행 로드맵 ⭐',
      '프리미엄 마무리 문구',
    ],
    excludes: [],
  },
};

export default {
  generatePDF,
  determinePDFType,
  getCTAMessage,
  PDF_DIFFERENCES,
};
