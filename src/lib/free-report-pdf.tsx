import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AnalysisResult } from '@/types/survey';
import { POSTURE_TYPE_NAMES } from './survey-analyzer';

/**
 * 무료 PDF 리포트 - 전환 유도 최적화 버전
 * 
 * 목표: 읽고 나면 찝찝함 + 궁금증이 남아서 "돈 주고 더 봐야겠다"는 결론에 도달
 * 
 * 구조:
 * 1. 한 줄 요약 (상단 강조)
 * 2. 사진 기반 관찰 (시각적 근거 포함)
 * 3. 기능적 영향 (궁금증 유발)
 * 4. 의도적 미완성 문단
 * 5. 업그레이드 CTA
 */

// CTA 분기 로직
export interface CTAConfig {
  analysisStatus: 'limited' | 'partial' | 'full';
  confidenceLevel: 'low' | 'medium' | 'high';
  hasPhotos: boolean;
  photoQualityPassed: boolean;
}

export function getCTAMessage(config: CTAConfig): { 
  mainCTA: string; 
  subCTA: string; 
  urgency: 'low' | 'medium' | 'high';
} {
  // 사진 없이 설문만 한 경우
  if (!config.hasPhotos) {
    return {
      mainCTA: '사진 2장만 추가하면 정확도가 3배 높아집니다',
      subCTA: 'BASIC 플랜에서 전문가가 직접 사진을 분석합니다',
      urgency: 'high',
    };
  }

  // 사진 품질이 낮은 경우
  if (!config.photoQualityPassed) {
    return {
      mainCTA: '사진 품질이 낮아 정확한 분석이 어렵습니다',
      subCTA: 'BASIC 플랜에서 재촬영 가이드와 함께 정밀 분석을 받아보세요',
      urgency: 'medium',
    };
  }

  // 분석 제한된 경우
  if (config.analysisStatus === 'limited') {
    return {
      mainCTA: '정확한 체형 분석은 BASIC 플랜부터 제공됩니다',
      subCTA: '전문가가 직접 확인하고 맞춤 운동 가이드를 제공합니다',
      urgency: 'high',
    };
  }

  // 신뢰도 낮은 경우
  if (config.confidenceLevel === 'low') {
    return {
      mainCTA: '단일 사진으로는 정확도에 한계가 있습니다',
      subCTA: 'BASIC 플랜에서 정면+측면 사진 기반 정밀 분석을 받아보세요',
      urgency: 'medium',
    };
  }

  // 기본 CTA
  return {
    mainCTA: '더 상세한 분석과 맞춤 운동 가이드가 필요하신가요?',
    subCTA: 'BASIC 플랜에서 전문가 피드백을 받아보세요',
    urgency: 'low',
  };
}

// 스타일 정의
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2pt solid #F97316',
    paddingBottom: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F97316',
  },
  subtitle: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 3,
  },
  freeBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  freeBadgeText: {
    fontSize: 8,
    color: '#64748B',
  },
  
  // 한 줄 요약 (강조)
  summaryBox: {
    backgroundColor: '#FFF7ED',
    borderLeft: '4pt solid #F97316',
    padding: 16,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    lineHeight: 1.5,
  },
  
  // 섹션
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  
  // 관찰 카드
  observationCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    borderLeft: '3pt solid #CBD5E1',
  },
  observationArea: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  observationText: {
    fontSize: 9,
    color: '#64748B',
    lineHeight: 1.5,
  },
  visualEvidence: {
    fontSize: 8,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  // 미완성 섹션 (블러 효과 시뮬레이션)
  incompleteSection: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  incompleteTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 6,
  },
  incompleteText: {
    fontSize: 9,
    color: '#94A3B8',
    lineHeight: 1.4,
  },
  lockIcon: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  
  // CTA 섹션
  ctaBox: {
    backgroundColor: '#F97316',
    padding: 20,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 16,
  },
  ctaMainText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaSubText: {
    fontSize: 10,
    color: '#FED7AA',
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginTop: 12,
    alignSelf: 'center',
  },
  ctaButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F97316',
    textAlign: 'center',
  },
  
  // 가격 비교
  priceCompare: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  priceCard: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  priceCardFree: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceCardPaid: {
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#F97316',
  },
  priceLabel: {
    fontSize: 8,
    color: '#64748B',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  priceFeature: {
    fontSize: 7,
    color: '#64748B',
    marginBottom: 2,
  },
  
  // 신뢰 요소
  trustSection: {
    borderTop: '1pt solid #E2E8F0',
    paddingTop: 12,
    marginTop: 16,
  },
  trustText: {
    fontSize: 8,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  expertInfo: {
    fontSize: 7,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  
  // 푸터
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTop: '1pt solid #E2E8F0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#94A3B8',
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 6,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 3,
  },
});

interface FreeReportPDFProps {
  analysis: AnalysisResult;
  ctaConfig: CTAConfig;
  userEmail?: string;
  userName?: string;
  observations?: Array<{
    area: string;
    finding: string;
    visualEvidence: string;
    functionalImpact: string;
  }>;
}

/**
 * 무료 PDF 리포트 - 전환 최적화 버전
 * 
 * 핵심 원칙:
 * - 무료에서 "충분하다"는 느낌을 주지 않음
 * - 궁금증과 찝찝함을 유발
 * - 명확한 업그레이드 경로 제시
 */
export function FreeReportPDF({ 
  analysis, 
  ctaConfig,
  userEmail,
  userName = '고객님',
  observations = [],
}: FreeReportPDFProps) {
  const cta = getCTAMessage(ctaConfig);
  
  // 한 줄 요약 생성
  const getSummaryText = () => {
    const type = POSTURE_TYPE_NAMES[analysis.postureType];
    const severity = analysis.overallSeverity;
    
    if (severity === 'severe') {
      return `현재 체형에서 ${type} 경향이 관찰되며, 전문가 확인이 권장됩니다.`;
    } else if (severity === 'moderate') {
      return `현재 체형은 ${type} 경향이 보일 수 있으며, 관리가 도움이 될 수 있습니다.`;
    } else {
      return `현재 체형에서 일부 불균형 경향이 관찰됩니다.`;
    }
  };

  return (
    <Document>
      {/* 페이지 1: 요약 + 관찰 + CTA */}
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>체형 경향 간이 리포트</Text>
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>무료 버전 | 제한된 분석</Text>
          </View>
        </View>

        {/* 한 줄 요약 (강조) */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            {getSummaryText()}
          </Text>
        </View>

        {/* 부위별 점수 (간략) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>부위별 경향 점수</Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#F97316' }}>
                {Math.round(analysis.scores.forwardHead)}
              </Text>
              <Text style={{ fontSize: 8, color: '#64748B' }}>목/경추</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#F97316' }}>
                {Math.round(analysis.scores.roundedShoulder)}
              </Text>
              <Text style={{ fontSize: 8, color: '#64748B' }}>어깨/흉추</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#F97316' }}>
                {Math.round(Math.max(analysis.scores.anteriorPelvicTilt, analysis.scores.posteriorPelvicTilt))}
              </Text>
              <Text style={{ fontSize: 8, color: '#64748B' }}>골반/허리</Text>
            </View>
          </View>
        </View>

        {/* 관찰 내용 (일부만 공개) */}
        {observations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>사진 기반 관찰 (일부)</Text>
            
            {/* 첫 번째 관찰만 공개 */}
            <View style={styles.observationCard}>
              <Text style={styles.observationArea}>[{observations[0].area}]</Text>
              <Text style={styles.observationText}>{observations[0].finding}</Text>
              <Text style={styles.visualEvidence}>
                시각적 근거: {observations[0].visualEvidence}
              </Text>
            </View>

            {/* 나머지는 잠금 */}
            {observations.length > 1 && (
              <View style={styles.incompleteSection}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.incompleteTitle}>
                  +{observations.length - 1}개 부위 분석 결과
                </Text>
                <Text style={styles.incompleteText}>
                  BASIC 플랜에서 전체 분석 결과를 확인하세요
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 기능적 영향 (궁금증 유발) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>일상에서 나타날 수 있는 패턴</Text>
          
          <View style={styles.observationCard}>
            <Text style={styles.observationText}>
              현재 관찰된 체형 경향은 일상 동작에서 특정 패턴으로 이어질 수 있습니다.
              장시간 앉아있거나 서있을 때, 운동할 때 영향을 받을 수 있습니다.
            </Text>
          </View>

          {/* 의도적 미완성 */}
          <View style={styles.incompleteSection}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.incompleteTitle}>구체적인 영향 분석</Text>
            <Text style={styles.incompleteText}>
              단일 사진으로는 하체 정렬과 움직임 패턴까지는 확인이 어렵습니다.
              정확한 분석을 위해서는 전문가 확인이 필요합니다.
            </Text>
          </View>
        </View>

        {/* 운동 가이드 (잠금) */}
        <View style={styles.incompleteSection}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.incompleteTitle}>맞춤 운동 가이드</Text>
          <Text style={styles.incompleteText}>
            본인에게 맞는 교정운동 루틴은 BASIC 플랜에서 제공됩니다.
            일반적인 운동 정보만으로는 효과를 보기 어려울 수 있습니다.
          </Text>
        </View>

        {/* CTA 섹션 */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaMainText}>{cta.mainCTA}</Text>
          <Text style={styles.ctaSubText}>{cta.subCTA}</Text>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>BASIC 플랜 알아보기 →</Text>
          </View>
        </View>

        {/* 가격 비교 */}
        <View style={styles.priceCompare}>
          <View style={[styles.priceCard, styles.priceCardFree]}>
            <Text style={styles.priceLabel}>현재</Text>
            <Text style={styles.priceValue}>무료</Text>
            <Text style={styles.priceFeature}>• 설문 기반 경향 분석</Text>
            <Text style={styles.priceFeature}>• 부위별 점수</Text>
            <Text style={[styles.priceFeature, { color: '#CBD5E1' }]}>• 상세 분석 ❌</Text>
            <Text style={[styles.priceFeature, { color: '#CBD5E1' }]}>• 운동 가이드 ❌</Text>
          </View>
          <View style={[styles.priceCard, styles.priceCardPaid]}>
            <Text style={[styles.priceLabel, { color: '#F97316' }]}>추천</Text>
            <Text style={styles.priceValue}>₩19,000</Text>
            <Text style={styles.priceFeature}>• 전문가 사진 분석</Text>
            <Text style={styles.priceFeature}>• 상세 체형 리포트</Text>
            <Text style={styles.priceFeature}>• 맞춤 운동 가이드</Text>
            <Text style={styles.priceFeature}>• 운동 영상 링크</Text>
          </View>
        </View>

        {/* 신뢰 요소 */}
        <View style={styles.trustSection}>
          <Text style={styles.trustText}>
            본 분석은 NASM-CES 기반 교정운동 전문가 설계 시스템입니다.
          </Text>
          <Text style={styles.expertInfo}>
            운영: 국제 인증 교정운동 전문가 | 1,000명+ 체형 분석 경험
          </Text>
          <Text style={[styles.trustText, { marginTop: 6 }]}>
            ⚠️ 본 서비스는 의료 행위가 아니며, 운동 가이드 목적으로만 제공됩니다.
          </Text>
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab | https://posturelab.com | 무료 체형 경향 리포트
          </Text>
          <Text style={styles.disclaimer}>
            본 문서는 참고용이며 의학적 진단을 대체할 수 없습니다. 모든 결과는 경향/가능성 표현입니다.
          </Text>
          {userEmail && (
            <Text style={[styles.footerText, { marginTop: 2 }]}>
              발송 대상: {userEmail} | 생성: {new Date().toLocaleDateString('ko-KR')}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}

export default FreeReportPDF;
