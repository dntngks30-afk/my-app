import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AnalysisResult } from '@/types/survey';
import { POSTURE_TYPE_NAMES } from './survey-analyzer';

/**
 * 🆓 FREE PDF 리포트 - 신뢰 확보 + 갈증 유발 버전
 * 
 * 🎯 목적:
 * - 사용자가 "이 서비스 믿을 수 있다"고 느끼게 만들 것
 * - 그러나 "이걸로는 아직 부족하다"는 갈증을 남길 것
 * 
 * 📌 핵심 원칙:
 * - 개인 단정 ❌ → "일반적으로 이런 경향이 있습니다" 톤
 * - 구체 운동 ❌ → 방향성만 제시
 * - 주차별 계획 ❌ → 유료에서만 제공
 * - 실행 로드맵 ❌ → 유료에서만 제공
 * 
 * 🚫 절대 하지 말 것:
 * - 개인 맞춤 단정 ("당신은 반드시 ~ 상태입니다" ❌)
 * - 구체적인 운동 조합
 * - 실행 로드맵
 * - 회복·생활습관 세부 가이드
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
  if (!config.hasPhotos) {
    return {
      mainCTA: '사진 2장만 추가하면 정확도가 3배 높아집니다',
      subCTA: 'BASIC 플랜에서 전문가가 직접 사진을 분석합니다',
      urgency: 'high',
    };
  }

  if (!config.photoQualityPassed) {
    return {
      mainCTA: '사진 품질이 낮아 정확한 분석이 어렵습니다',
      subCTA: 'BASIC 플랜에서 재촬영 가이드와 함께 정밀 분석을 받아보세요',
      urgency: 'medium',
    };
  }

  if (config.analysisStatus === 'limited') {
    return {
      mainCTA: '정확한 체형 분석은 BASIC 플랜부터 제공됩니다',
      subCTA: '전문가가 직접 확인하고 맞춤 운동 가이드를 제공합니다',
      urgency: 'high',
    };
  }

  if (config.confidenceLevel === 'low') {
    return {
      mainCTA: '단일 사진으로는 정확도에 한계가 있습니다',
      subCTA: 'BASIC 플랜에서 정면+측면 사진 기반 정밀 분석을 받아보세요',
      urgency: 'medium',
    };
  }

  return {
    mainCTA: '더 상세한 분석과 맞춤 운동 가이드가 필요하신가요?',
    subCTA: 'BASIC 플랜에서 전문가 피드백을 받아보세요',
    urgency: 'low',
  };
}

// 스타일 정의
const colors = {
  primary: '#F97316',
  dark: '#1E293B',
  gray: '#64748B',
  lightGray: '#94A3B8',
  background: '#F8FAFC',
  white: '#FFFFFF',
  border: '#E2E8F0',
  warning: '#F59E0B',
};

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    padding: 40,
    fontFamily: 'Helvetica',
  },
  
  // 헤더
  header: {
    marginBottom: 20,
    borderBottom: `2pt solid ${colors.primary}`,
    paddingBottom: 12,
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 9,
    color: colors.lightGray,
    marginTop: 3,
  },
  freeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  freeBadgeText: {
    fontSize: 8,
    color: '#92400E',
    fontWeight: 'bold',
  },
  
  // 섹션
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `1pt solid ${colors.border}`,
  },
  
  // 요약 박스
  summaryBox: {
    backgroundColor: '#FFF7ED',
    borderLeft: `4pt solid ${colors.primary}`,
    padding: 14,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 11,
    color: colors.dark,
    lineHeight: 1.6,
  },
  
  // 카드
  card: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    border: `1pt solid ${colors.border}`,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 6,
  },
  
  // 텍스트
  text: {
    fontSize: 9,
    color: colors.gray,
    lineHeight: 1.6,
    marginBottom: 4,
  },
  textSmall: {
    fontSize: 8,
    color: colors.lightGray,
    lineHeight: 1.5,
  },
  
  // 리스트
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    width: 14,
    fontSize: 9,
    color: colors.primary,
  },
  listText: {
    flex: 1,
    fontSize: 9,
    color: colors.gray,
    lineHeight: 1.5,
  },
  
  // 잠금 섹션
  lockedSection: {
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 6,
    marginBottom: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  lockedTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.lightGray,
    marginBottom: 4,
  },
  lockedText: {
    fontSize: 8,
    color: colors.lightGray,
    lineHeight: 1.4,
  },
  lockIcon: {
    fontSize: 12,
    color: colors.lightGray,
    marginBottom: 4,
  },
  
  // CTA 섹션
  ctaBox: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  ctaMainText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  ctaSubText: {
    fontSize: 9,
    color: '#FED7AA',
    textAlign: 'center',
  },
  
  // 신뢰 요소
  trustSection: {
    borderTop: `1pt solid ${colors.border}`,
    paddingTop: 12,
    marginTop: 12,
  },
  trustText: {
    fontSize: 7,
    color: colors.lightGray,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  
  // 푸터
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTop: `1pt solid ${colors.border}`,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 6,
    color: colors.lightGray,
    textAlign: 'center',
  },
});

// 일반적 경향 설명 (개인 단정 ❌)
const GENERAL_TENDENCY_DESCRIPTIONS: Record<string, string> = {
  '목/경추': '장시간 앉아서 생활하는 현대인들에게서 목이 앞으로 나오는 경향이 자주 관찰됩니다. 이는 컴퓨터나 스마트폰 사용 습관과 관련이 있을 수 있습니다.',
  '어깨/흉추': '어깨가 앞으로 말리는 경향은 데스크 워크가 많은 분들에게서 흔히 나타납니다. 가슴 근육이 짧아지고 등 근육이 늘어나는 패턴과 연관될 수 있습니다.',
  '골반/허리': '골반의 기울기 변화는 앉는 자세, 운동 습관, 근육 균형 등 다양한 요인에 의해 영향을 받을 수 있습니다.',
};

// 일반적 방향성 (구체 운동 ❌)
const GENERAL_DIRECTIONS: Record<string, string[]> = {
  '목/경추': [
    '목 주변 근육의 균형을 고려한 운동이 도움이 될 수 있습니다',
    '장시간 같은 자세를 피하고 자주 스트레칭하는 것이 권장됩니다',
  ],
  '어깨/흉추': [
    '가슴과 등 근육의 균형을 맞추는 방향의 운동이 고려될 수 있습니다',
    '어깨를 뒤로 당기는 동작을 일상에서 자주 해보는 것이 좋습니다',
  ],
  '골반/허리': [
    '코어 근육과 둔부 근육의 활성화가 도움이 될 수 있습니다',
    '앉는 자세와 서있는 자세를 점검해보는 것이 권장됩니다',
  ],
};

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
 * 🆓 FREE PDF 리포트 컴포넌트
 */
export function FreeReportPDF({ 
  analysis, 
  ctaConfig,
  userEmail,
  userName = '고객님',
  observations = [],
}: FreeReportPDFProps) {
  const cta = getCTAMessage(ctaConfig);
  const postureTypeName = POSTURE_TYPE_NAMES[analysis.postureType];
  
  // 상위 1~2개 문제만 표시 (FREE 제한)
  const topIssues = analysis.primaryIssues.slice(0, 2);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 1️⃣ 헤더 - "무료 체험 리포트" 명확히 표기 */}
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>체형 경향 간이 분석 리포트</Text>
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>무료 체험 리포트</Text>
          </View>
        </View>

        {/* 2️⃣ 사용자 요약 (간결) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>컨디션 전반 요약</Text>
          
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              설문 응답을 분석한 결과, {userName}님의 체형에서{'\n'}
              <Text style={{ fontWeight: 'bold', color: colors.primary }}>
                {postureTypeName}
              </Text>
              {' '}경향이 관찰될 수 있습니다.
            </Text>
          </View>

          <Text style={styles.text}>
            이 결과는 설문 데이터를 기반으로 한 일반적인 경향 분석이며,
            정확한 개인 맞춤 분석을 위해서는 추가 정보가 필요합니다.
          </Text>
        </View>

        {/* 3️⃣ 문제 인식 중심 분석 (개인 단정 ❌, 일반적 경향 톤) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>눈에 띄는 경향 (1~2가지)</Text>
          
          {topIssues.length > 0 ? (
            topIssues.map((issue, index) => (
              <View key={index} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {index + 1}. {issue.area} 영역
                </Text>
                <Text style={styles.text}>
                  {GENERAL_TENDENCY_DESCRIPTIONS[issue.area] || 
                   '이 부위에서 일부 불균형 경향이 관찰될 수 있습니다.'}
                </Text>
                <Text style={styles.textSmall}>
                  * 이는 일반적인 경향이며, 개인마다 다를 수 있습니다.
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.card}>
              <Text style={styles.text}>
                특별히 주의가 필요한 경향은 확인되지 않았습니다.
                현재 상태를 유지하시는 것이 좋습니다.
              </Text>
            </View>
          )}
        </View>

        {/* 4️⃣ 방향성 제안 (구체 운동 ❌, 우선순위 ❌) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>일반적인 방향성 제안</Text>
          
          {topIssues.length > 0 && topIssues[0] && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>참고할 수 있는 방향</Text>
              {(GENERAL_DIRECTIONS[topIssues[0].area] || [
                '전문가와 상담하여 본인에게 맞는 운동을 찾아보세요',
                '일상에서 자세를 자주 점검하는 습관이 도움이 됩니다',
              ]).map((direction, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listText}>{direction}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.textSmall}>
            * 위 내용은 일반적인 방향성이며, 구체적인 운동 프로그램은 
            개인 상태에 맞게 설계되어야 합니다.
          </Text>
        </View>

        {/* 🔒 잠금 섹션 - 유료에서만 제공되는 내용 */}
        <View style={styles.lockedSection}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockedTitle}>유료 종합 리포트에서 제공되는 내용</Text>
          <Text style={styles.lockedText}>
            • 개인 맞춤 심층 문제 분석 (원인, 리스크, 해결 방향){'\n'}
            • 체형 & 움직임 패턴 정밀 분석{'\n'}
            • 반드시 해야 할 운동 / 피해야 할 운동{'\n'}
            • 생활습관 & 회복 전략{'\n'}
            • 4주 실행 로드맵 (주차별 목표 & 행동 포인트)
          </Text>
        </View>

        {/* 5️⃣ CTA (매우 중요) */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaMainText}>{cta.mainCTA}</Text>
          <Text style={styles.ctaSubText}>{cta.subCTA}</Text>
        </View>

        {/* 신뢰 요소 */}
        <View style={styles.trustSection}>
          <Text style={styles.trustText}>
            본 분석은 NASM-CES 기반 교정운동 전문가 설계 시스템입니다.{'\n'}
            ⚠️ 본 서비스는 의료 행위가 아니며, 운동 가이드 목적으로만 제공됩니다.
          </Text>
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab | 무료 체험 리포트 | {new Date().toLocaleDateString('ko-KR')}
          </Text>
          <Text style={[styles.footerText, { marginTop: 2 }]}>
            보다 정확한 체형 분석, 개인 맞춤 운동 전략, 4주 실천 가이드는 유료 종합 리포트에서 제공됩니다.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default FreeReportPDF;
