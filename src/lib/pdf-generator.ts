import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { AnalysisResult } from '@/types/survey';
import { POSTURE_TYPE_NAMES } from './survey-analyzer';

// 한글 폰트 등록 (Noto Sans KR - Google Fonts)
// 프로덕션에서는 실제 폰트 파일 경로 필요
// Font.register({
//   family: 'Noto Sans KR',
//   src: 'https://fonts.gstatic.com/s/notosanskr/v27/PbykFmXiEBPT4ITbgNA5Cgm20xz64px_1hVWr0wuPNGmlQNMEfD4.ttf',
// });

// PDF 스타일 정의
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  
  // 헤더
  header: {
    marginBottom: 30,
    borderBottom: '2pt solid #F97316',
    paddingBottom: 15,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F97316',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  
  // 제목
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  
  // 섹션
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 10,
    borderLeft: '3pt solid #F97316',
    paddingLeft: 8,
  },
  
  // 텍스트
  text: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  boldText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  
  // 카드
  card: {
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    border: '1pt solid #E2E8F0',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    border: '1pt solid #FCD34D',
  },
  dangerCard: {
    backgroundColor: '#FEE2E2',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    border: '1pt solid #FCA5A5',
  },
  successCard: {
    backgroundColor: '#D1FAE5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    border: '1pt solid #6EE7B7',
  },
  
  // 리스트
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    width: 15,
    fontSize: 10,
    color: '#F97316',
  },
  listText: {
    flex: 1,
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.5,
  },
  
  // 점수 카드
  scoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  scoreLabel: {
    fontSize: 11,
    color: '#334155',
    fontWeight: 'bold',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F97316',
  },
  
  // 푸터
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1pt solid #E2E8F0',
    paddingTop: 10,
    fontSize: 8,
    color: '#94A3B8',
    textAlign: 'center',
  },
  
  // 표
  table: {
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #E2E8F0',
    paddingVertical: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottom: '2pt solid #CBD5E1',
    paddingVertical: 10,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: '#475569',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E293B',
  },
});

// PDF 문서 컴포넌트
export function SurveyReportPDF({ analysis, userEmail }: { analysis: AnalysisResult; userEmail?: string }) {
  const getSeverityLabel = (severity: 'mild' | 'moderate' | 'severe') => {
    const labels = {
      mild: '참고 수준 (경미)',
      moderate: '참고 수준 (보통)',
      severe: '전문가 상담 권장'
    };
    return labels[severity];
  };

  const getSeverityColor = (severity: 'mild' | 'moderate' | 'severe') => {
    return severity === 'severe' ? '#DC2626' : severity === 'moderate' ? '#F59E0B' : '#10B981';
  };

  return (
    <Document>
      {/* 페이지 1: 표지 & 요약 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>자가 체크 기반 자세 경향 리포트 (참고용)</Text>
        </View>

        <View style={{ marginTop: 60, marginBottom: 40 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1E293B', marginBottom: 10 }}>
            자세 경향 체크 결과
          </Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            자가 인식 기반 참고 자료
          </Text>
        </View>

        <View style={styles.successCard}>
          <Text style={styles.sectionTitle}>확인된 자세 경향 (참고용)</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 10 }}>
            {POSTURE_TYPE_NAMES[analysis.postureType]}
          </Text>
          <Text style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
            경향 수준: {getSeverityLabel(analysis.overallSeverity)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>부위별 경향성 점수 (참고 정보)</Text>
          
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>목/경추 부위</Text>
            <Text style={[styles.scoreValue, { color: getSeverityColor(analysis.primaryIssues[0]?.severity || 'mild') }]}>
              {Math.round(analysis.scores.forwardHead)}점
            </Text>
          </View>
          
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>어깨/흉추 부위</Text>
            <Text style={[styles.scoreValue, { color: getSeverityColor(analysis.primaryIssues[1]?.severity || 'mild') }]}>
              {Math.round(analysis.scores.roundedShoulder)}점
            </Text>
          </View>
          
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>골반/허리 부위</Text>
            <Text style={[styles.scoreValue, { color: getSeverityColor(analysis.primaryIssues[2]?.severity || 'mild') }]}>
              {Math.round(Math.max(analysis.scores.anteriorPelvicTilt, analysis.scores.posteriorPelvicTilt))}점
            </Text>
          </View>
        </View>

        <View style={styles.dangerCard}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#991B1B', marginBottom: 5 }}>
            ⚠️ 중요 안내
          </Text>
          <Text style={{ fontSize: 8, color: '#991B1B', lineHeight: 1.5 }}>
            본 결과는 자가 체크 기반이며, AI나 전문가가 직접 판단한 것이 아닙니다. 
            의학적 진단이 아니므로 참고 정보로만 활용하세요. 
            통증이나 질병이 있는 경우 반드시 의료기관을 방문하시기 바랍니다.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>PostureLab | 자세 경향 자가 체크 서비스 | https://posturelab.com</Text>
          <Text style={{ marginTop: 3 }}>본 문서는 운동 가이드 참고 목적이며, 의료 진단이 아닙니다.</Text>
        </View>
      </Page>

      {/* 페이지 2: 확인된 경향 상세 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>페이지 2/5</Text>
        </View>

        <Text style={styles.pageTitle}>확인된 자세 경향 (참고 정보)</Text>

        {analysis.primaryIssues.length > 0 ? (
          analysis.primaryIssues.map((issue, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.boldText}>[{issue.area}]</Text>
              <Text style={[styles.text, { color: getSeverityColor(issue.severity) }]}>
                {getSeverityLabel(issue.severity)}
              </Text>
              <Text style={styles.text}>{issue.description}</Text>
            </View>
          ))
        ) : (
          <View style={styles.successCard}>
            <Text style={styles.text}>
              특별히 주의가 필요한 경향은 확인되지 않았습니다. 
              현재 상태를 유지하는 것을 권장합니다.
            </Text>
          </View>
        )}

        <View style={styles.warningCard}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400E', marginBottom: 5 }}>
            💡 참고 사항
          </Text>
          <Text style={{ fontSize: 8, color: '#92400E', lineHeight: 1.5 }}>
            위 내용은 자가 체크 응답을 기반으로 한 경향성이며, 실제 상태와 다를 수 있습니다. 
            정확한 평가가 필요하다면 전문가의 상담을 권장합니다.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>본 결과는 참고용이며, 의학적 진단을 대체할 수 없습니다.</Text>
        </View>
      </Page>

      {/* 페이지 3: 방치 시 리스크 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>페이지 3/5</Text>
        </View>

        <Text style={styles.pageTitle}>지금 관리하지 않으면?</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>장기간 방치할 경우 나타날 수 있는 경향</Text>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              불편함이 점점 강해질 수 있습니다. 처음에는 가벼운 뻐근함이었던 것이 시간이 지나면서 
              일상생활에 지장을 줄 수 있습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              나쁜 자세 습관이 고착화될 수 있습니다. 몸이 잘못된 자세에 적응하면서 
              바른 자세로 돌아가기가 더 어려워질 수 있습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              다른 부위에도 영향을 줄 수 있습니다. 한 부위의 불균형이 연쇄적으로 
              다른 부위의 보상 패턴을 유발할 수 있습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              활동량이 줄어들 수 있습니다. 불편함 때문에 운동이나 활동을 피하게 되면서 
              전반적인 건강에도 영향을 줄 수 있습니다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>혼자 운동할 때의 한계</Text>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              잘못된 자세로 운동하면 오히려 악화될 수 있습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              어떤 운동이 본인에게 필요한지 판단하기 어렵습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              꾸준히 하기 어렵고, 효과를 느끼기까지 시간이 오래 걸립니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>
              진행 상황을 객관적으로 확인하기 어렵습니다.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>조기 관리가 장기적인 건강에 도움이 될 수 있습니다.</Text>
        </View>
      </Page>

      {/* 페이지 4: 참고 가이드 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>페이지 4/5</Text>
        </View>

        <Text style={styles.pageTitle}>참고 운동 가이드</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시도해볼 수 있는 운동 (일반적인 가이드)</Text>
          
          {analysis.recommendations.map((rec, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{rec}</Text>
            </View>
          ))}
        </View>

        <View style={styles.warningCard}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400E', marginBottom: 5 }}>
            ⚠️ 운동 시 주의사항
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={[styles.listText, { color: '#92400E' }]}>
              통증이 있는 경우 즉시 중단하고 전문가와 상담하세요.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={[styles.listText, { color: '#92400E' }]}>
              무리하지 않고 본인의 페이스에 맞춰 진행하세요.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={[styles.listText, { color: '#92400E' }]}>
              정확한 자세가 중요합니다. 잘못된 자세는 오히려 해로울 수 있습니다.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={[styles.listText, { color: '#92400E' }]}>
              효과는 개인차가 있으며, 즉각적인 변화를 기대하기 어렵습니다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>전문가 가이드의 장점</Text>
          
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableHeaderCell}>혼자 할 때</Text>
              <Text style={styles.tableHeaderCell}>전문가와 함께</Text>
            </View>
            
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>일반적인 운동 정보</Text>
              <Text style={styles.tableCell}>본인에게 맞는 맞춤 가이드</Text>
            </View>
            
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>자세 확인 어려움</Text>
              <Text style={styles.tableCell}>실시간 피드백과 교정</Text>
            </View>
            
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>동기 부여 부족</Text>
              <Text style={styles.tableCell}>지속적인 관리와 격려</Text>
            </View>
            
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>진행 상황 불명확</Text>
              <Text style={styles.tableCell}>정기적인 평가와 조정</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>체계적인 가이드가 효과적인 개선에 도움이 될 수 있습니다.</Text>
        </View>
      </Page>

      {/* 페이지 5: 다음 단계 & 면책 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>PostureLab</Text>
          <Text style={styles.subtitle}>페이지 5/5</Text>
        </View>

        <Text style={styles.pageTitle}>다음 단계 안내</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>더 정확한 평가를 원하신다면?</Text>
          
          <View style={styles.card}>
            <Text style={styles.boldText}>사진 기반 전문가 피드백 서비스</Text>
            <Text style={styles.text}>
              측면/정면 사진 2장만 있으면, 전문가가 직접 영상으로 피드백을 드립니다.
            </Text>
            <Text style={{ fontSize: 9, color: '#F97316', marginTop: 5 }}>
              (단, 이것도 의학적 진단은 아닙니다)
            </Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.boldText}>지속적인 관리 프로그램</Text>
            <Text style={styles.text}>
              주간 영상 피드백, 월간 재평가, 맞춤 운동 프로그램을 통해 
              체계적으로 관리할 수 있습니다.
            </Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.boldText}>1:1 화상 상담 (VIP)</Text>
            <Text style={styles.text}>
              실시간 Zoom 세션을 통해 직접 소통하며 가이드를 받을 수 있습니다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>서비스 이용 안내</Text>
          <Text style={styles.text}>
            웹사이트: https://posturelab.com
          </Text>
          <Text style={styles.text}>
            이메일: support@posturelab.com
          </Text>
          {userEmail && (
            <Text style={[styles.text, { marginTop: 10 }]}>
              본 리포트 발송 대상: {userEmail}
            </Text>
          )}
        </View>

        <View style={styles.dangerCard}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#991B1B', marginBottom: 8 }}>
            ⚠️ 필독: 본 리포트의 한계와 면책사항
          </Text>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              본 리포트는 자가 체크 설문 응답을 기반으로 자동 생성되었습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              AI나 전문가가 사진을 분석하거나 직접 판단한 것이 아닙니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              의학적 진단, 처방, 치료를 목적으로 하지 않으며, 이를 대체할 수 없습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              실제 상태와 다를 수 있으며, 참고 정보로만 활용하시기 바랍니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              통증, 질병, 부상이 있는 경우 반드시 의료기관을 방문하세요.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              운동 중 발생하는 부상에 대한 책임은 사용자 본인에게 있습니다.
            </Text>
          </View>
          
          <View style={styles.listItem}>
            <Text style={[styles.bullet, { color: '#991B1B' }]}>•</Text>
            <Text style={[styles.listText, { fontSize: 8, color: '#991B1B' }]}>
              본 서비스는 운동 가이드 및 과정 관리만을 제공합니다.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>PostureLab © 2026 | 본 문서는 참고용이며 의료 진단을 대체할 수 없습니다.</Text>
          <Text style={{ marginTop: 3 }}>생성일시: {new Date().toLocaleString('ko-KR')}</Text>
        </View>
      </Page>
    </Document>
  );
}
