/**
 * 움직임 타입 테스트 시스템 - TypeScript 인터페이스 정의
 * 
 * 이 파일은 움직임 타입 테스트의 모든 데이터 구조를 정의합니다.
 * - 질문 및 선택지 타입
 * - 답변 및 결과 타입
 * - 타입 설명 및 운동 가이드 타입
 */

// ============================================
// 기본 타입 정의
// ============================================

/**
 * 4가지 기본 움직임 타입
 */
export type MovementType = '담직' | '날림' | '버팀' | '흘림';

/**
 * 질문 타입 (4지선다 또는 예/아니오)
 */
export type QuestionType = 'multiple' | 'binary';

/**
 * 질문 카테고리
 */
export type QuestionCategory = 
  | '보행'
  | '자세'
  | '운동선호'
  | '일상동작'
  | '통증불편'
  | '근력유연성'
  | '불균형진단';

// ============================================
// 질문 관련 인터페이스
// ============================================

/**
 * 4지선다 선택지 인터페이스
 */
export interface Option {
  /** 선택지 고유 ID (예: 'q1_a', 'q1_b') */
  id: string;
  
  /** 선택지 텍스트 */
  text: string;
  
  /** 이 선택지가 부여하는 타입 */
  type: MovementType;
  
  /** 점수 (1-5, 일반적으로 3) */
  score: number;
  
  /** 서브타입 수정자 (선택적) */
  subTypeModifier?: string;
}

/**
 * 질문 인터페이스
 */
export interface Question {
  /** 질문 고유 ID */
  id: number;
  
  /** 질문 타입 */
  type: QuestionType;
  
  /** 질문 텍스트 */
  question: string;
  
  /** 질문 카테고리 */
  category: QuestionCategory;
  
  /** 4지선다 선택지 (multiple 타입인 경우) */
  options?: Option[];
  
  /** 서브타입 가중치 질문 여부 */
  subTypeWeight?: boolean;
  
  /** 불균형 플래그 (binary 타입인 경우) */
  imbalanceFlag?: string;
  
  /** 도움말 텍스트 (선택적) */
  helpText?: string;
}

// ============================================
// 답변 관련 인터페이스
// ============================================

/**
 * 4지선다 답변 인터페이스
 */
export interface MultipleAnswer {
  /** 질문 ID */
  questionId: number;
  
  /** 선택된 옵션 ID */
  selectedOptionId: string;
  
  /** 선택된 타입 */
  selectedType: MovementType;
  
  /** 획득 점수 */
  score: number;
  
  /** 답변 시간 */
  answeredAt: Date;
}

/**
 * 예/아니오 답변 인터페이스
 */
export interface BinaryAnswer {
  /** 질문 ID */
  questionId: number;
  
  /** 답변 (true: 예, false: 아니오) */
  answer: boolean;
  
  /** 불균형 플래그 */
  imbalanceFlag?: string;
  
  /** 답변 시간 */
  answeredAt: Date;
}

/**
 * 통합 답변 타입
 */
export type Answer = MultipleAnswer | BinaryAnswer;

// ============================================
// 점수 및 결과 관련 인터페이스
// ============================================

/**
 * 타입별 점수
 */
export interface TypeScores {
  담직: number;
  날림: number;
  버팀: number;
  흘림: number;
}

/**
 * 16가지 서브타입
 */
export type SubType =
  // 담직 계열
  | '담직-상체고착형'
  | '담직-하체고착형'
  | '담직-호흡잠김형'
  | '담직-전신둔화형'
  // 날림 계열
  | '날림-관절흐름형'
  | '날림-중심이탈형'
  | '날림-좌우불균형형'
  | '날림-동작과속형'
  // 버팀 계열
  | '버팀-허리의존형'
  | '버팀-목어깨과로형'
  | '버팀-무릎집중형'
  | '버팀-단측지배형'
  // 흘림 계열
  | '흘림-힘누수형'
  | '흘림-체인단절형'
  | '흘림-비대칭전달형'
  | '흘림-효율저하형';

/**
 * 테스트 결과 인터페이스
 */
export interface TestResult {
  /** 메인 타입 */
  mainType: MovementType;
  
  /** 서브타입 */
  subType: SubType;
  
  /** 타입별 점수 */
  typeScores: TypeScores;
  
  /** 신뢰도 점수 (0-100) */
  confidence: number;
  
  /** 테스트 완료 시간 */
  completedAt: Date | string;
  
  /** 사용자 응답 배열 */
  answers: Answer[];
  
  /** 총 소요 시간 (초) - 선택 사항 */
  totalDuration?: number;
}

// ============================================
// 운동 관련 인터페이스
// ============================================

/**
 * 운동 정보 인터페이스
 */
export interface Exercise {
  /** 운동 고유 ID */
  id: string;
  
  /** 운동 이름 */
  name: string;
  
  /** 운동 설명 */
  description: string;
  
  /** 세트 수 (선택적) */
  sets?: string;
  
  /** 반복 횟수 (선택적) */
  reps?: string;
  
  /** 빈도 (예: '주 3회') (선택적) */
  frequency?: string;
  
  /** 운동 카테고리 */
  category?: 'stretching' | 'strengthening' | 'mobility' | 'stability';
  
  /** 우선순위 (1-5, 1이 가장 높음) */
  priority?: number;
  
  /** 영상 링크 (선택적) */
  videoUrl?: string;
  
  /** 이미지 URL (선택적) */
  imageUrl?: string;
}

/**
 * 불균형 정보 인터페이스
 */
export interface ImbalanceInfo {
  /** 불균형 플래그 */
  flag: string;
  
  /** 불균형 이름 */
  name: string;
  
  /** 설명 */
  description: string;
  
  /** 심각도 (low, medium, high) */
  severity: 'low' | 'medium' | 'high';
  
  /** 관련 운동 ID 목록 */
  relatedExercises: string[];
}

// ============================================
// 타입 설명 관련 인터페이스
// ============================================

/**
 * 타입 설명 인터페이스
 */
export interface TypeDescription {
  /** 메인 타입 */
  mainType: MovementType;
  
  /** 서브타입 */
  subType: SubType;
  
  /** 타입 제목 (예: '안정적인 지지형') */
  title: string;
  
  /** 부제목 (한 줄 요약) */
  subtitle: string;
  
  /** 상세 설명 (2-3 문단) */
  description: string;
  
  /** 주요 특징 목록 */
  characteristics: string[];
  
  /** 강점 */
  strengths: string[];
  
  /** 개선 필요 영역 */
  weaknesses: string[];
  
  /** 추천 운동 목록 */
  recommendedExercises: Exercise[];
  
  /** 피해야 할 운동/동작 */
  avoidExercises: string[];
  
  /** 생활습관 조언 */
  lifestyleTips: string[];
  
  /** 유명인 예시 (선택적) */
  celebrities?: string[];
  
  /** 타입 색상 (hex) */
  color: string;
  
  /** 타입 아이콘 이모지 */
  icon: string;
}

// ============================================
// 상태 관리 관련 인터페이스
// ============================================

/**
 * 테스트 진행 상태 인터페이스
 */
export interface TestState {
  /** 현재 페이지 번호 (0부터 시작) */
  currentPage: number;
  
  /** 전체 페이지 수 */
  totalPages: number;
  
  /** 4지선다 답변 목록 */
  multipleAnswers: MultipleAnswer[];
  
  /** 예/아니오 답변 목록 */
  binaryAnswers: BinaryAnswer[];
  
  /** 테스트 결과 (완료 시) */
  result: TestResult | null;
  
  /** 테스트 완료 여부 */
  isComplete: boolean;
  
  /** 테스트 시작 시간 */
  startedAt: Date | null;
  
  /** 현재 진행률 (0-100) */
  progress: number;
}

/**
 * 페이지 검증 결과 인터페이스
 */
export interface PageValidation {
  /** 페이지 완료 여부 */
  isValid: boolean;
  
  /** 미답변 질문 ID 목록 */
  unansweredQuestions: number[];
  
  /** 오류 메시지 */
  errorMessage?: string;
}

// ============================================
// localStorage 저장 인터페이스
// ============================================

/**
 * localStorage에 저장되는 진행 상황
 */
export interface SavedProgress {
  /** 저장 버전 (마이그레이션용) */
  version: string;
  
  /** 테스트 상태 */
  state: TestState;
  
  /** 저장 시간 */
  savedAt: Date;
  
  /** 만료 시간 (선택적) */
  expiresAt?: Date;
}

// ============================================
// 유틸리티 타입
// ============================================

/**
 * 답변 타입 가드: MultipleAnswer 확인
 */
export function isMultipleAnswer(answer: Answer): answer is MultipleAnswer {
  return 'selectedOptionId' in answer;
}

/**
 * 답변 타입 가드: BinaryAnswer 확인
 */
export function isBinaryAnswer(answer: Answer): answer is BinaryAnswer {
  return 'answer' in answer && typeof (answer as BinaryAnswer).answer === 'boolean';
}

/**
 * 질문 타입 가드: 4지선다 질문 확인
 */
export function isMultipleQuestion(question: Question): question is Question & { options: Option[] } {
  return question.type === 'multiple' && !!question.options;
}

/**
 * 질문 타입 가드: 예/아니오 질문 확인
 */
export function isBinaryQuestion(question: Question): question is Question & { imbalanceFlag: string } {
  return question.type === 'binary' && !!question.imbalanceFlag;
}

// ============================================
// 설정 및 상수
// ============================================

/**
 * 테스트 설정
 */
export interface TestConfig {
  /** 한 페이지당 질문 수 */
  questionsPerPage: number;
  
  /** 4지선다 질문 수 */
  multipleQuestionCount: number;
  
  /** 예/아니오 질문 수 */
  binaryQuestionCount: number;
  
  /** localStorage 키 */
  storageKey: string;
  
  /** 진행 상황 저장 간격 (ms) */
  autoSaveInterval: number;
  
  /** 진행 상황 만료 시간 (일) */
  progressExpiryDays: number;
}

/**
 * 기본 테스트 설정
 */
export const DEFAULT_TEST_CONFIG: TestConfig = {
  questionsPerPage: 5,
  multipleQuestionCount: 30,
  binaryQuestionCount: 10,
  storageKey: 'movement_test_progress',
  autoSaveInterval: 30000, // 30초
  progressExpiryDays: 7, // 7일
};

/**
 * 타입별 색상 매핑
 */
export const TYPE_COLORS: Record<MovementType, string> = {
  담직: '#3B82F6', // 파란색 - 안정감
  날림: '#F59E0B', // 주황색 - 역동성
  버팀: '#EF4444', // 빨간색 - 힘
  흘림: '#10B981', // 초록색 - 조화
};

/**
 * 타입별 아이콘 이모지
 */
export const TYPE_ICONS: Record<MovementType, string> = {
  담직: '🏔️',
  날림: '🦅',
  버팀: '💪',
  흘림: '🌊',
};

/**
 * 타입별 키워드
 */
export const TYPE_KEYWORDS: Record<MovementType, string[]> = {
  담직: ['안정', '균형', '지지', '중심', '견고'],
  날림: ['빠름', '민첩', '가벼움', '순발력', '반응'],
  버팀: ['힘', '근력', '강함', '지속', '버티기'],
  흘림: ['유연', '자연', '흐름', '조화', '적응'],
};
