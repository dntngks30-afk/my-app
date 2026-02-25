import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AnalysisResult, PostureScores, PostureType } from '@/types/survey';

/**
 * 프리미엄 유료 PDF 리포트
 * 
 * 10년 경력 전문 트레이너 수준의 리포트
 * 5~10만원대 유료 서비스 품질
 * 
 * 핵심 원칙:
 * 1. 신뢰감 (논리, 근거, 구조)
 * 2. 디테일 (개인 맞춤 분석 느낌)
 * 3. 실행 가능성 (바로 행동할 수 있는 가이드)
 */

// ============================================
// 스타일 정의
// ============================================
const colors = {
  primary: '#F97316',
  primaryDark: '#EA580C',
  dark: '#1E293B',
  gray: '#64748B',
  lightGray: '#94A3B8',
  background: '#F8FAFC',
  white: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: '#E2E8F0',
};

const styles = StyleSheet.create({
  // 페이지 기본
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    padding: 40,
    fontFamily: 'Helvetica',
  },
  
  // 표지 전용
  coverPage: {
    flexDirection: 'column',
    backgroundColor: colors.dark,
    padding: 0,
    fontFamily: 'Helvetica',
  },
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  coverSubtitle: {
    fontSize: 14,
    color: colors.lightGray,
    textAlign: 'center',
    marginBottom: 40,
  },
  coverUserName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverDate: {
    fontSize: 11,
    color: colors.lightGray,
    textAlign: 'center',
  },
  coverBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 40,
  },
  coverBadgeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  coverFooter: {
    padding: 30,
    borderTop: `1pt solid ${colors.gray}`,
  },
  coverFooterText: {
    fontSize: 8,
    color: colors.lightGray,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  
  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingBottom: 12,
    borderBottom: `2pt solid ${colors.primary}`,
  },
  headerLogo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerPage: {
    fontSize: 9,
    color: colors.lightGray,
  },
  
  // 섹션 제목
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 20,
    paddingBottom: 8,
    borderBottom: `1pt solid ${colors.border}`,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.gray,
    marginBottom: 12,
  },
  
  // 카드
  card: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    border: `1pt solid ${colors.border}`,
  },
  cardHighlight: {
    backgroundColor: '#FFF7ED',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeft: `4pt solid ${colors.primary}`,
  },
  cardWarning: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeft: `4pt solid ${colors.warning}`,
  },
  cardDanger: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeft: `4pt solid ${colors.danger}`,
  },
  cardSuccess: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeft: `4pt solid ${colors.success}`,
  },
  
  // 텍스트
  text: {
    fontSize: 10,
    color: colors.gray,
    lineHeight: 1.7,
    marginBottom: 6,
  },
  textBold: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.dark,
    lineHeight: 1.7,
    marginBottom: 6,
  },
  textSmall: {
    fontSize: 8,
    color: colors.lightGray,
    lineHeight: 1.5,
  },
  textLarge: {
    fontSize: 12,
    color: colors.dark,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  
  // 리스트
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 4,
  },
  listBullet: {
    width: 16,
    fontSize: 10,
    color: colors.primary,
  },
  listText: {
    flex: 1,
    fontSize: 10,
    color: colors.gray,
    lineHeight: 1.6,
  },
  
  // 점수 표시
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 8,
    color: colors.gray,
    marginTop: 4,
  },
  
  // 테이블
  table: {
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1pt solid ${colors.border}`,
    paddingVertical: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottom: `2pt solid ${colors.border}`,
    paddingVertical: 10,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: colors.gray,
    paddingHorizontal: 8,
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.dark,
    paddingHorizontal: 8,
  },
  
  // 푸터
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTop: `1pt solid ${colors.border}`,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: colors.lightGray,
    textAlign: 'center',
  },
  
  // 주차별 가이드
  weekCard: {
    backgroundColor: colors.white,
    padding: 14,
    marginBottom: 10,
    borderRadius: 6,
    border: `1pt solid ${colors.border}`,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekNumber: {
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  weekTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.dark,
  },
  
  // 프로필 요약
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  profileItem: {
    width: '50%',
    paddingVertical: 8,
    paddingRight: 12,
  },
  profileLabel: {
    fontSize: 8,
    color: colors.lightGray,
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.dark,
  },
});

// ============================================
// 타입 정의
// ============================================
interface PremiumReportProps {
  analysis: AnalysisResult;
  userProfile: {
    name: string;
    email: string;
    age?: string;
    gender?: string;
    occupation?: string;
  };
  surveyResponses: Record<string, string | string[]>;
}

// ============================================
// 헬퍼 함수
// ============================================
function getOverallScore(scores: PostureScores): number {
  const values = Object.values(scores);
  const avgIssueScore = values.reduce((a, b) => a + b, 0) / values.length;
  // 문제 점수가 높을수록 컨디션 점수는 낮음
  return Math.round(100 - avgIssueScore);
}

function getScoreGrade(score: number): string {
  if (score >= 85) return 'A (우수)';
  if (score >= 70) return 'B (양호)';
  if (score >= 55) return 'C (보통)';
  if (score >= 40) return 'D (주의)';
  return 'F (관리 필요)';
}

function getPostureTypeName(type: PostureType): string {
  const names: Record<PostureType, string> = {
    neutral: '균형 잡힌 자세',
    forward_head: '전방 두부 자세 (Forward Head Posture)',
    rounded_shoulder: '라운드 숄더 (Rounded Shoulder)',
    upper_cross_syndrome: '상부 교차 증후군 (Upper Cross Syndrome)',
    anterior_pelvic_tilt: '골반 전방 경사 (Anterior Pelvic Tilt)',
    posterior_pelvic_tilt: '골반 후방 경사 (Posterior Pelvic Tilt)',
    swayback: '스웨이백 자세 (Swayback Posture)',
    flat_back: '플랫백 자세 (Flat Back Posture)',
  };
  return names[type];
}

// ============================================
// 문제 진단 상세 데이터
// ============================================
const PROBLEM_DETAILS: Record<string, {
  definition: string;
  whyProblem: string;
  risks: string[];
  whyFix: string;
}> = {
  '목/경추': {
    definition: '경추(목뼈)가 정상적인 C자 커브를 잃고 앞으로 돌출된 상태입니다. 머리 무게 중심이 어깨선 앞으로 이동하여 목 주변 근육에 과도한 부하가 발생합니다.',
    whyProblem: '머리 무게는 약 5kg입니다. 머리가 1인치(2.5cm) 앞으로 나올 때마다 목에 가해지는 하중은 약 4.5kg씩 증가합니다. 3인치 전방 이동 시 목은 약 18kg의 하중을 지탱해야 합니다. 이는 경추 후방 근육(상부 승모근, 견갑거근)의 만성 긴장과 전방 근육(심부 경추 굴곡근)의 약화를 유발합니다.',
    risks: [
      '경추 디스크 압박 증가 및 퇴행 가속화',
      '긴장성 두통 및 만성 목 통증 발생 가능성',
      '어깨 충돌 증후군으로 이어질 수 있는 견갑골 위치 변화',
      '흉곽 출구 증후군 위험 증가',
    ],
    whyFix: '목 정렬이 개선되면 두통 빈도가 감소하고, 어깨 가동 범위가 증가하며, 전반적인 상체 피로도가 크게 줄어듭니다. 무엇보다 장기적인 경추 건강을 보호할 수 있습니다.',
  },
  '어깨/흉추': {
    definition: '어깨가 전방으로 말리고 흉추(등뼈)의 후만이 증가된 상태입니다. 대흉근과 소흉근이 단축되고, 중하부 승모근과 능형근이 늘어나 약화된 패턴입니다.',
    whyProblem: '현대인의 생활 패턴(컴퓨터, 스마트폰 사용)은 지속적으로 어깨를 전방으로 당기는 자세를 유발합니다. 이로 인해 견갑골이 외전(벌어짐)되고 상방 회전되어, 어깨 관절의 정상적인 움직임 패턴이 손상됩니다. 특히 오버헤드 동작 시 충돌 위험이 높아집니다.',
    risks: [
      '회전근개 손상 및 어깨 충돌 증후군',
      '흉추 가동성 감소로 인한 요추 과부하',
      '호흡 효율 저하 (횡격막 기능 제한)',
      '만성 등 통증 및 견갑골 주변 불편감',
    ],
    whyFix: '어깨 정렬 개선은 상체 운동 능력을 향상시키고, 어깨 부상 위험을 크게 낮춥니다. 또한 호흡이 깊어지고 자세가 당당해져 자신감에도 긍정적 영향을 미칩니다.',
  },
  '골반/허리': {
    definition: '골반이 정상 위치에서 앞으로(전방 경사) 또는 뒤로(후방 경사) 기울어진 상태입니다. 이는 요추의 곡선과 복부/둔부 근육의 균형에 직접적인 영향을 미칩니다.',
    whyProblem: '골반은 상체와 하체를 연결하는 핵심 구조물입니다. 골반 경사가 발생하면 요추에 비정상적인 압력이 가해지고, 고관절 가동성이 제한됩니다. 전방 경사 시 요추 전만이 과도해지고 복근이 약화되며, 후방 경사 시 요추 곡선이 소실되고 햄스트링이 과긴장됩니다.',
    risks: [
      '요추 디스크 압박 불균형 및 퇴행',
      '고관절 굴곡근 또는 신전근 기능 장애',
      '하지 정렬 문제 (무릎, 발목에 영향)',
      '만성 요통 및 좌골신경통 위험 증가',
    ],
    whyFix: '골반 정렬이 바로잡히면 허리 통증이 감소하고, 하체 운동 효율이 크게 향상됩니다. 스쿼트, 데드리프트 등 복합 운동의 수행 능력이 개선되고, 일상 동작에서의 안정성이 높아집니다.',
  },
};

// ============================================
// 체형별 운동 전략
// ============================================
const EXERCISE_STRATEGIES: Record<PostureType, {
  mustDo: { name: string; reason: string }[];
  avoid: { name: string; reason: string }[];
  priority: { level: string; exercises: string[] }[];
}> = {
  neutral: {
    mustDo: [
      { name: '전신 밸런스 운동', reason: '현재의 좋은 상태를 유지하기 위해' },
      { name: '코어 안정화 운동', reason: '자세 유지 근육 강화' },
    ],
    avoid: [],
    priority: [
      { level: '유지', exercises: ['플랭크', '버드독', '데드버그', '글루트 브릿지'] },
    ],
  },
  forward_head: {
    mustDo: [
      { name: '친 턱 (Chin Tuck)', reason: '심부 경추 굴곡근 활성화 및 경추 정렬 회복' },
      { name: '흉추 신전 운동', reason: '상부 흉추 가동성 확보로 경추 부담 감소' },
      { name: '상부 승모근 스트레칭', reason: '과긴장된 목 뒤 근육 이완' },
    ],
    avoid: [
      { name: '무거운 숄더 슈러그', reason: '이미 과긴장된 상부 승모근을 더 강화시킴' },
      { name: '목 뒤로 젖히는 동작', reason: '경추 후방 구조물에 추가 압박' },
    ],
    priority: [
      { level: '초급', exercises: ['친 턱 (벽에 기대고)', '흉추 폼롤러 신전', '상부 승모근 스트레칭'] },
      { level: '중급', exercises: ['친 턱 (저항 밴드)', '쿼드러피드 친 턱', 'Y-T-W 레이즈'] },
    ],
  },
  rounded_shoulder: {
    mustDo: [
      { name: '대흉근/소흉근 스트레칭', reason: '단축된 가슴 근육 이완으로 어깨 후방 이동 유도' },
      { name: '중하부 승모근 강화', reason: '견갑골 내전 및 하강 능력 회복' },
      { name: '외회전 운동', reason: '어깨 관절의 정상적인 회전 패턴 회복' },
    ],
    avoid: [
      { name: '과도한 벤치프레스', reason: '대흉근 단축을 악화시킬 수 있음' },
      { name: '전방 삼각근 위주 운동', reason: '어깨 전방 당김을 강화' },
    ],
    priority: [
      { level: '초급', exercises: ['도어웨이 스트레칭', '페이스 풀', '밴드 풀 어파트'] },
      { level: '중급', exercises: ['케이블 외회전', '프론 Y레이즈', '시티드 로우 (견갑골 집중)'] },
    ],
  },
  upper_cross_syndrome: {
    mustDo: [
      { name: '통합 상체 교정 루틴', reason: '목과 어깨 문제가 연결되어 있어 동시 접근 필요' },
      { name: '흉추 가동성 운동', reason: '상부 교차 패턴의 핵심 원인 해결' },
      { name: '심부 안정화 근육 활성화', reason: '표면 근육 과사용 패턴 교정' },
    ],
    avoid: [
      { name: '고중량 오버헤드 프레스', reason: '불안정한 어깨에서 부상 위험' },
      { name: '크런치 (목 당기기)', reason: '이미 과긴장된 목 굴곡근에 추가 부담' },
    ],
    priority: [
      { level: '초급', exercises: ['월 슬라이드', '오픈 북 스트레칭', '친 턱 + 견갑골 세팅'] },
      { level: '중급', exercises: ['쿼드러피드 T-스파인 로테이션', '하프 닐링 케이블 프레스', '데드버그'] },
    ],
  },
  anterior_pelvic_tilt: {
    mustDo: [
      { name: '고관절 굴곡근 스트레칭', reason: '단축된 장요근/대퇴직근 이완' },
      { name: '둔근 활성화 운동', reason: '억제된 둔근 기능 회복' },
      { name: '복부 강화 (골반 후방 경사 유도)', reason: '골반을 중립으로 당기는 힘 확보' },
    ],
    avoid: [
      { name: '과도한 요추 신전 운동', reason: '이미 과신전된 요추에 추가 부담' },
      { name: '무거운 스쿼트 (교정 전)', reason: '잘못된 패턴이 강화될 수 있음' },
    ],
    priority: [
      { level: '초급', exercises: ['하프 닐링 힙 플렉서 스트레칭', '글루트 브릿지', '데드버그'] },
      { level: '중급', exercises: ['90-90 힙 리프트', '힙 에어플레인', '팔로프 프레스'] },
    ],
  },
  posterior_pelvic_tilt: {
    mustDo: [
      { name: '햄스트링 스트레칭', reason: '과긴장된 햄스트링 이완으로 골반 자유도 확보' },
      { name: '요추 신전 운동', reason: '소실된 요추 전만 회복' },
      { name: '고관절 굴곡근 강화', reason: '약화된 장요근 기능 회복' },
    ],
    avoid: [
      { name: '과도한 복부 운동', reason: '이미 우세한 복직근을 더 강화' },
      { name: '둥근 등 자세 운동', reason: '후방 경사 패턴 강화' },
    ],
    priority: [
      { level: '초급', exercises: ['캣-카우 스트레칭', '스탠딩 햄스트링 스트레칭', '슈퍼맨 (가벼운 버전)'] },
      { level: '중급', exercises: ['리버스 하이퍼', '굿모닝', '힙 힌지 패턴 연습'] },
    ],
  },
  swayback: {
    mustDo: [
      { name: '전신 정렬 인식 훈련', reason: '복합적인 자세 문제로 전체적 접근 필요' },
      { name: '코어 통합 운동', reason: '앞뒤 근육 균형 회복' },
      { name: '자세 인식 훈련', reason: '일상에서의 자세 교정' },
    ],
    avoid: [
      { name: '고중량 복합 운동 (교정 전)', reason: '잘못된 패턴이 고착화될 위험' },
    ],
    priority: [
      { level: '초급', exercises: ['월 스탠딩 정렬 연습', '데드버그', '버드독'] },
      { level: '중급', exercises: ['팔로프 프레스', '싱글레그 데드리프트', '케이블 우드찹'] },
    ],
  },
  flat_back: {
    mustDo: [
      { name: '척추 가동성 운동', reason: '경직된 척추에 움직임 회복' },
      { name: '요추 전만 회복 운동', reason: '정상적인 S자 커브 유도' },
      { name: '흉추 신전 운동', reason: '전체 척추 커브 정상화' },
    ],
    avoid: [
      { name: '과도한 플랭크', reason: '이미 평평한 척추를 더 고정시킴' },
    ],
    priority: [
      { level: '초급', exercises: ['캣-카우', '프론 프레스업', '흉추 폼롤러 신전'] },
      { level: '중급', exercises: ['제퍼슨 컬', '세그멘탈 캣-카우', '스위스볼 익스텐션'] },
    ],
  },
};

// ============================================
// 생활습관 가이드
// ============================================
const LIFESTYLE_GUIDE = {
  sleep: {
    title: '수면 최적화',
    recommendations: [
      '7-8시간의 일관된 수면 시간 확보',
      '수면 30분 전 블루라이트 차단 (스마트폰, 컴퓨터)',
      '침실 온도 18-20도 유지',
      '기상 후 10분 내 자연광 노출',
    ],
  },
  activity: {
    title: '일상 활동량',
    recommendations: [
      '50분 앉으면 10분 움직이기 (포모도로 기법 응용)',
      '하루 8,000보 이상 걷기 목표',
      '엘리베이터 대신 계단 사용',
      '점심시간 10분 산책 습관화',
    ],
  },
  stress: {
    title: '스트레스 관리',
    recommendations: [
      '하루 5분 호흡 명상 (4-7-8 호흡법)',
      '주 2회 이상 취미 활동 시간 확보',
      '업무 중 2시간마다 1분 심호흡',
      '잠들기 전 감사 일기 3줄 작성',
    ],
  },
  nutrition: {
    title: '영양 방향성',
    recommendations: [
      '단백질 섭취 (체중 kg당 1.2-1.6g)',
      '충분한 수분 섭취 (체중 kg x 30ml)',
      '가공식품 줄이고 자연식품 위주',
      '식사 시간 규칙적으로 유지',
    ],
  },
};

// ============================================
// 4주 행동 가이드
// ============================================
const WEEKLY_PLAN = [
  {
    week: 1,
    title: '적응 & 인식',
    focus: '현재 상태 인식 및 기초 동작 학습',
    tasks: [
      '매일 아침 2분 자세 체크 (거울 앞)',
      '기초 스트레칭 루틴 학습 (10분)',
      '하루 3회 자세 알람 설정',
      '수면/활동 패턴 기록 시작',
    ],
    frequency: '스트레칭 매일, 운동 주 2회',
  },
  {
    week: 2,
    title: '패턴 교정',
    focus: '잘못된 움직임 패턴 인식 및 수정',
    tasks: [
      '교정 운동 루틴 추가 (15분)',
      '업무 중 자세 교정 실천',
      '스트레칭 강도 점진적 증가',
      '주간 컨디션 변화 기록',
    ],
    frequency: '스트레칭 매일, 운동 주 3회',
  },
  {
    week: 3,
    title: '강도 상승',
    focus: '운동 강도 증가 및 습관 강화',
    tasks: [
      '운동 시간 20분으로 증가',
      '저항 운동 추가 (밴드/덤벨)',
      '일상 동작에서 교정 패턴 적용',
      '중간 점검 (1주차 대비 변화)',
    ],
    frequency: '스트레칭 매일, 운동 주 4회',
  },
  {
    week: 4,
    title: '습관화',
    focus: '지속 가능한 루틴 확립',
    tasks: [
      '전체 루틴 25-30분으로 완성',
      '자가 평가 및 목표 재설정',
      '장기 운동 계획 수립',
      '4주 변화 종합 정리',
    ],
    frequency: '스트레칭 매일, 운동 주 4-5회',
  },
];

// ============================================
// PDF 컴포넌트
// ============================================
export function PremiumReportPDF({ 
  analysis, 
  userProfile,
  surveyResponses,
}: PremiumReportProps) {
  const overallScore = getOverallScore(analysis.scores);
  const scoreGrade = getScoreGrade(overallScore);
  const postureTypeName = getPostureTypeName(analysis.postureType);
  const exerciseStrategy = EXERCISE_STRATEGIES[analysis.postureType];
  
  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      {/* ============================================ */}
      {/* 1️⃣ 표지 (Cover Page) */}
      {/* ============================================ */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContent}>
          <Text style={styles.coverTitle}>
            개인 체형 & 컨디션{'\n'}종합 분석 리포트
          </Text>
          <Text style={styles.coverSubtitle}>
            설문 데이터 기반 AI 퍼스널 트레이닝 분석
          </Text>
          
          <View style={{ marginTop: 40, marginBottom: 40 }}>
            <Text style={styles.coverUserName}>
              {userProfile.name}님 맞춤 분석
            </Text>
            <Text style={styles.coverDate}>
              분석일: {currentDate}
            </Text>
          </View>
          
          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>
              PREMIUM ANALYSIS REPORT
            </Text>
          </View>
        </View>
        
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>
            본 리포트는 운동역학, 교정운동학, 생활습관 데이터를 종합 분석하여 작성되었습니다.{'\n'}
            PostureLab | NASM-CES 기반 전문 분석 시스템
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 2️⃣ 사용자 요약 프로필 (Executive Summary) */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>Executive Summary</Text>
        </View>

        <Text style={styles.sectionTitle}>사용자 요약 프로필</Text>

        {/* 기본 정보 */}
        <View style={styles.profileGrid}>
          <View style={styles.profileItem}>
            <Text style={styles.profileLabel}>이름</Text>
            <Text style={styles.profileValue}>{userProfile.name}</Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.profileLabel}>분석일</Text>
            <Text style={styles.profileValue}>{currentDate}</Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.profileLabel}>운동 목표</Text>
            <Text style={styles.profileValue}>
              {analysis.userGoal === 'posture' ? '자세 교정' : 
               analysis.userGoal === 'pain' ? '통증 완화' :
               analysis.userGoal === 'performance' ? '운동 능력 향상' : '전반적 건강'}
            </Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.profileLabel}>투자 가능 시간</Text>
            <Text style={styles.profileValue}>
              {analysis.timeCommitment === 'minimal' ? '주 1-2회' :
               analysis.timeCommitment === 'moderate' ? '주 3-4회' : '주 5회 이상'}
            </Text>
          </View>
        </View>

        {/* 전체 컨디션 점수 */}
        <View style={styles.cardHighlight}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.dark, marginBottom: 12 }}>
            전체 컨디션 점수
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 48, fontWeight: 'bold', color: colors.primary, marginRight: 16 }}>
              {overallScore}
            </Text>
            <View>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.dark }}>
                / 100점
              </Text>
              <Text style={{ fontSize: 11, color: colors.gray, marginTop: 2 }}>
                등급: {scoreGrade}
              </Text>
            </View>
          </View>
          <Text style={styles.text}>
            {overallScore >= 70 
              ? '전반적으로 양호한 상태입니다. 현재 상태를 유지하면서 약점 부위를 보완하면 더욱 좋아질 수 있습니다.'
              : overallScore >= 50
              ? '개선이 필요한 부분이 확인됩니다. 아래 분석 내용을 참고하여 체계적인 관리를 시작하시기 바랍니다.'
              : '적극적인 관리가 필요한 상태입니다. 전문가 가이드와 함께 단계적으로 개선해 나가시기를 권장합니다.'}
          </Text>
        </View>

        {/* 핵심 문제 3가지 요약 */}
        <Text style={styles.sectionSubtitle}>핵심 문제 요약 (TOP 3)</Text>
        
        {analysis.primaryIssues.length > 0 ? (
          analysis.primaryIssues.map((issue, index) => (
            <View key={index} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ 
                  fontSize: 10, 
                  fontWeight: 'bold', 
                  color: colors.white,
                  backgroundColor: issue.severity === 'severe' ? colors.danger : 
                                   issue.severity === 'moderate' ? colors.warning : colors.success,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 4,
                  marginRight: 8,
                }}>
                  {index + 1}순위
                </Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.dark }}>
                  {issue.area}
                </Text>
              </View>
              <Text style={styles.text}>{issue.description}</Text>
            </View>
          ))
        ) : (
          <View style={styles.cardSuccess}>
            <Text style={styles.text}>
              특별히 주의가 필요한 문제가 발견되지 않았습니다. 현재 상태를 유지하시기 바랍니다.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 2
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 3️⃣ 핵심 문제 분석 (상세) */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>Problem Diagnosis</Text>
        </View>

        <Text style={styles.sectionTitle}>핵심 문제 분석</Text>
        
        <Text style={styles.textLarge}>
          설문 분석 결과, {userProfile.name}님의 주요 체형 패턴은 
          <Text style={{ fontWeight: 'bold', color: colors.primary }}> {postureTypeName}</Text>
          으로 확인됩니다.
        </Text>

        {analysis.primaryIssues.slice(0, 2).map((issue, index) => {
          const details = PROBLEM_DETAILS[issue.area] || PROBLEM_DETAILS['목/경추'];
          
          return (
            <View key={index} style={{ marginBottom: 16 }}>
              <View style={styles.cardDanger}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.danger, marginBottom: 8 }}>
                  🔍 문제 {index + 1}: {issue.area} 영역
                </Text>
                <Text style={styles.text}>{details.definition}</Text>
              </View>

              <View style={styles.card}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.dark, marginBottom: 6 }}>
                  📉 왜 문제가 되는가?
                </Text>
                <Text style={styles.text}>{details.whyProblem}</Text>
              </View>

              <View style={styles.cardWarning}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.warning, marginBottom: 6 }}>
                  ⚠️ 이 상태가 지속될 경우의 리스크
                </Text>
                {details.risks.map((risk, riskIndex) => (
                  <View key={riskIndex} style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.listText}>{risk}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardSuccess}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.success, marginBottom: 6 }}>
                  🎯 해결해야 하는 이유
                </Text>
                <Text style={styles.text}>{details.whyFix}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 3
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 4️⃣ 체형·움직임 패턴 분석 */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>Movement Pattern Analysis</Text>
        </View>

        <Text style={styles.sectionTitle}>체형·움직임 패턴 분석</Text>

        {/* 부위별 점수 */}
        <Text style={styles.sectionSubtitle}>부위별 불균형 지수</Text>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { 
              color: analysis.scores.forwardHead > 50 ? colors.danger : 
                     analysis.scores.forwardHead > 30 ? colors.warning : colors.success 
            }]}>
              {Math.round(analysis.scores.forwardHead)}
            </Text>
            <Text style={styles.scoreLabel}>목/경추</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { 
              color: analysis.scores.roundedShoulder > 50 ? colors.danger : 
                     analysis.scores.roundedShoulder > 30 ? colors.warning : colors.success 
            }]}>
              {Math.round(analysis.scores.roundedShoulder)}
            </Text>
            <Text style={styles.scoreLabel}>어깨/흉추</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { 
              color: analysis.scores.anteriorPelvicTilt > 50 ? colors.danger : 
                     analysis.scores.anteriorPelvicTilt > 30 ? colors.warning : colors.success 
            }]}>
              {Math.round(analysis.scores.anteriorPelvicTilt)}
            </Text>
            <Text style={styles.scoreLabel}>골반(전방)</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { 
              color: analysis.scores.posteriorPelvicTilt > 50 ? colors.danger : 
                     analysis.scores.posteriorPelvicTilt > 30 ? colors.warning : colors.success 
            }]}>
              {Math.round(analysis.scores.posteriorPelvicTilt)}
            </Text>
            <Text style={styles.scoreLabel}>골반(후방)</Text>
          </View>
        </View>

        <Text style={styles.textSmall}>
          * 점수가 높을수록 해당 부위의 불균형 가능성이 높습니다. 50점 이상은 적극적 관리 권장.
        </Text>

        {/* 근육 패턴 분석 */}
        <Text style={styles.sectionSubtitle}>근육 사용 패턴 분석</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>구분</Text>
            <Text style={styles.tableCellHeader}>과사용 (단축) 근육</Text>
            <Text style={styles.tableCellHeader}>저사용 (약화) 근육</Text>
          </View>
          
          {analysis.scores.forwardHead > 30 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>목/경추</Text>
              <Text style={styles.tableCell}>상부 승모근, 견갑거근, 후두하근</Text>
              <Text style={styles.tableCell}>심부 경추 굴곡근, 하부 승모근</Text>
            </View>
          )}
          
          {analysis.scores.roundedShoulder > 30 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>어깨/흉추</Text>
              <Text style={styles.tableCell}>대흉근, 소흉근, 전면 삼각근</Text>
              <Text style={styles.tableCell}>중하부 승모근, 능형근, 외회전근</Text>
            </View>
          )}
          
          {analysis.scores.anteriorPelvicTilt > 30 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>골반/허리</Text>
              <Text style={styles.tableCell}>장요근, 대퇴직근, 척추기립근</Text>
              <Text style={styles.tableCell}>복직근, 대둔근, 햄스트링</Text>
            </View>
          )}
          
          {analysis.scores.posteriorPelvicTilt > 30 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>골반/허리</Text>
              <Text style={styles.tableCell}>햄스트링, 복직근, 대둔근</Text>
              <Text style={styles.tableCell}>장요근, 척추기립근, 대퇴직근</Text>
            </View>
          )}
        </View>

        {/* 체형 패턴 설명 */}
        <View style={styles.cardHighlight}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.dark, marginBottom: 8 }}>
            {postureTypeName} 패턴 특성
          </Text>
          <Text style={styles.text}>
            {analysis.postureType === 'upper_cross_syndrome' 
              ? '상부 교차 증후군은 목과 어깨의 복합적인 불균형 패턴입니다. 앞쪽 근육(대흉근, 상부 승모근)은 단축되고, 뒤쪽 근육(심부 경추 굴곡근, 중하부 승모근)은 약화되어 X자 형태의 불균형이 나타납니다.'
              : analysis.postureType === 'anterior_pelvic_tilt'
              ? '골반 전방 경사는 골반이 앞으로 기울어지면서 허리가 과도하게 젖혀지는 패턴입니다. 고관절 굴곡근이 단축되고 복근과 둔근이 약화되어 요추에 과도한 압력이 가해집니다.'
              : analysis.postureType === 'posterior_pelvic_tilt'
              ? '골반 후방 경사는 골반이 뒤로 기울어지면서 허리의 자연스러운 곡선이 소실되는 패턴입니다. 햄스트링이 과긴장되고 고관절 굴곡근이 약화되어 척추 가동성이 제한됩니다.'
              : analysis.postureType === 'forward_head'
              ? '전방 두부 자세는 머리가 어깨선 앞으로 돌출된 패턴입니다. 경추 후방 근육이 과긴장되고 전방 심부 근육이 약화되어 목과 어깨에 만성적인 긴장이 발생합니다.'
              : analysis.postureType === 'rounded_shoulder'
              ? '라운드 숄더는 어깨가 앞으로 말리고 견갑골이 벌어진 패턴입니다. 가슴 근육이 단축되고 등 근육이 약화되어 어깨 관절의 정상적인 움직임이 제한됩니다.'
              : '현재 체형 패턴에 맞는 맞춤 운동 전략이 필요합니다.'}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 4
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 5️⃣ 맞춤 운동 전략 제안 */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>Exercise Strategy</Text>
        </View>

        <Text style={styles.sectionTitle}>맞춤 운동 전략 제안</Text>

        {/* 반드시 해야 할 운동 */}
        <Text style={styles.sectionSubtitle}>✅ 반드시 해야 할 운동</Text>
        {exerciseStrategy.mustDo.map((exercise, index) => (
          <View key={index} style={styles.cardSuccess}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.dark, marginBottom: 4 }}>
              {exercise.name}
            </Text>
            <Text style={styles.text}>
              <Text style={{ fontWeight: 'bold' }}>왜 필요한가:</Text> {exercise.reason}
            </Text>
          </View>
        ))}

        {/* 피해야 할 운동 */}
        {exerciseStrategy.avoid.length > 0 && (
          <>
            <Text style={styles.sectionSubtitle}>❌ 당분간 피해야 할 운동</Text>
            {exerciseStrategy.avoid.map((exercise, index) => (
              <View key={index} style={styles.cardDanger}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.dark, marginBottom: 4 }}>
                  {exercise.name}
                </Text>
                <Text style={styles.text}>
                  <Text style={{ fontWeight: 'bold' }}>피해야 하는 이유:</Text> {exercise.reason}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* 우선순위 운동 가이드 */}
        <Text style={styles.sectionSubtitle}>📋 우선순위 운동 가이드</Text>
        {exerciseStrategy.priority.map((level, index) => (
          <View key={index} style={styles.card}>
            <Text style={{ 
              fontSize: 10, 
              fontWeight: 'bold', 
              color: colors.white,
              backgroundColor: index === 0 ? colors.success : colors.primary,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 4,
              marginBottom: 8,
              alignSelf: 'flex-start',
            }}>
              {level.level}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {level.exercises.map((ex, exIndex) => (
                <Text key={exIndex} style={{ 
                  fontSize: 9, 
                  color: colors.gray,
                  backgroundColor: colors.background,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  marginRight: 6,
                  marginBottom: 6,
                }}>
                  {ex}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.cardWarning}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.warning, marginBottom: 4 }}>
            💡 운동 전략 핵심 원칙
          </Text>
          <Text style={styles.textSmall}>
            세트/횟수보다 중요한 것은 '올바른 자세'와 '목표 근육 인식'입니다. 
            처음에는 가볍게 시작하여 동작을 완벽히 익힌 후 강도를 높이세요.
            통증이 있으면 즉시 중단하고 전문가와 상담하시기 바랍니다.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 5
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 6️⃣ 생활습관 & 회복 가이드 */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>Lifestyle & Recovery</Text>
        </View>

        <Text style={styles.sectionTitle}>생활습관 & 회복 가이드</Text>

        <Text style={styles.textLarge}>
          운동만으로는 체형 개선에 한계가 있습니다. 
          일상 생활습관의 최적화가 함께 이루어져야 지속적인 효과를 얻을 수 있습니다.
        </Text>

        {Object.entries(LIFESTYLE_GUIDE).map(([key, guide]) => (
          <View key={key} style={styles.card}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.dark, marginBottom: 8 }}>
              {guide.title}
            </Text>
            {guide.recommendations.map((rec, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listBullet}>•</Text>
                <Text style={styles.listText}>{rec}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.cardHighlight}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.primary, marginBottom: 6 }}>
            🎯 {userProfile.name}님을 위한 우선순위 습관
          </Text>
          <Text style={styles.text}>
            {analysis.overallSeverity === 'severe'
              ? '현재 상태에서는 수면 최적화와 스트레스 관리가 가장 중요합니다. 몸이 회복할 시간을 충분히 확보해야 운동 효과도 극대화됩니다.'
              : analysis.overallSeverity === 'moderate'
              ? '일상 활동량을 늘리고 규칙적인 스트레칭 습관을 들이는 것이 우선입니다. 작은 변화부터 시작하여 점진적으로 확장하세요.'
              : '현재 좋은 상태를 유지하면서 전반적인 생활습관을 점검하고 최적화하시기 바랍니다.'}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 6
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 7️⃣ 4주 행동 가이드 (Action Plan) */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>4-Week Action Plan</Text>
        </View>

        <Text style={styles.sectionTitle}>4주 행동 가이드</Text>

        <Text style={styles.textLarge}>
          "이 리포트를 보고 뭘 하면 되나요?"에 대한 명확한 답입니다.
          아래 4주 플랜을 따라 단계적으로 실행하시기 바랍니다.
        </Text>

        {WEEKLY_PLAN.map((week) => (
          <View key={week.week} style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekNumber}>{week.week}주차</Text>
              <Text style={styles.weekTitle}>{week.title}</Text>
            </View>
            <Text style={{ fontSize: 9, color: colors.primary, marginBottom: 8 }}>
              Focus: {week.focus}
            </Text>
            {week.tasks.map((task, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listBullet}>□</Text>
                <Text style={styles.listText}>{task}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 8, color: colors.lightGray, marginTop: 6 }}>
              권장 빈도: {week.frequency}
            </Text>
          </View>
        ))}

        <View style={styles.cardSuccess}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.success, marginBottom: 4 }}>
            ✅ 4주 후 기대 효과
          </Text>
          <Text style={styles.text}>
            • 자세 인식 능력 향상 및 일상에서의 자가 교정 습관화{'\n'}
            • 주요 문제 부위의 불편감 감소{'\n'}
            • 운동 수행 능력 및 자세 안정성 향상{'\n'}
            • 지속 가능한 운동 루틴 확립
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 7
          </Text>
        </View>
      </Page>

      {/* ============================================ */}
      {/* 8️⃣ 면책 및 신뢰 문구 */}
      {/* ============================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>PostureLab</Text>
          <Text style={styles.headerPage}>Disclaimer & Trust</Text>
        </View>

        <Text style={styles.sectionTitle}>면책 및 안내사항</Text>

        <View style={styles.cardDanger}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.danger, marginBottom: 10 }}>
            ⚠️ 중요 면책사항
          </Text>
          <Text style={styles.text}>
            본 리포트는 의료 분석이 아니며, 설문 기반 데이터와 운동과학적 원리를 토대로 한 
            컨디션 분석 및 가이드 자료입니다.
          </Text>
          <View style={{ marginTop: 10 }}>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>
                본 리포트의 내용은 의학적 분석, 가이드, 개선을 대체할 수 없습니다.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>
                통증, 질병, 부상이 있는 경우 반드시 의료 전문가와 상담하시기 바랍니다.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>
                운동 중 발생하는 부상에 대한 책임은 사용자 본인에게 있습니다.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>
                본 서비스는 운동 가이드 및 컨디션 관리 목적으로만 제공됩니다.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.dark, marginBottom: 10 }}>
            🏆 분석 시스템 신뢰 기반
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>
              NASM-CES (교정운동 전문가) 국제 인증 기반 분석 알고리즘
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>
              운동역학 및 기능해부학 원리 적용
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>
              1,000명 이상의 체형 분석 데이터 기반 검증
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>
              피트니스 현장 10년+ 경력 전문가 설계
            </Text>
          </View>
        </View>

        <View style={styles.cardHighlight}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary, marginBottom: 10 }}>
            📞 추가 지원 안내
          </Text>
          <Text style={styles.text}>
            더 상세한 분석이나 1:1 맞춤 가이드가 필요하시면 
            프리미엄 서비스를 이용해 주세요.
          </Text>
          <Text style={{ fontSize: 9, color: colors.gray, marginTop: 8 }}>
            웹사이트: https://posturelab.com{'\n'}
            이메일: support@posturelab.com
          </Text>
        </View>

        <View style={{ marginTop: 30, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: colors.lightGray, textAlign: 'center' }}>
            본 리포트는 {userProfile.name}님을 위해 {currentDate}에 생성되었습니다.
          </Text>
          <Text style={{ fontSize: 9, color: colors.lightGray, textAlign: 'center', marginTop: 4 }}>
            PostureLab Premium Analysis Report v2.0
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PostureLab Premium Report | {userProfile.name}님 맞춤 분석 | Page 8
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default PremiumReportPDF;
