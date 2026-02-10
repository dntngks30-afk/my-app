/**
 * 움직임 타입 테스트 - 점수 계산 로직
 * 
 * 설문 응답 기반으로 메인 타입과 서브타입을 계산하고,
 * 결과의 신뢰도(Confidence)를 산출합니다.
 */

import type { 
  Question, 
  Answer, 
  MultipleAnswer, 
  BinaryAnswer,
  MovementType,
  SubType,
  TestResult,
  TypeScores as ImportedTypeScores
} from '@/types/movement-test';
import { isMultipleAnswer, isBinaryAnswer } from '@/types/movement-test';


// ============================================
// 타입 정의
// ============================================

type MainTypeCode = "D" | "N" | "B" | "H";

type ConfidenceLevel = "매우 높음" | "높음" | "보통" | "낮음" | "매우 낮음";

interface ConfidenceResult {
  confidence: number; // 0~100
  level: ConfidenceLevel;
  message: string; // 사용자용 한 줄
  debug: {
    topShare: number;     // 0~1
    marginScore: number;  // 0~1
    subClarity: number;   // 0~1
  };
}

interface TypeScores {
  담직: number;
  날림: number;
  버팀: number;
  흘림: number;
}

interface SubTypeScores {
  [key: string]: number; // SubType별 점수
}

// ============================================
// 유틸리티 함수
// ============================================

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function roundInt(x: number) {
  return Math.round(x);
}

/**
 * MovementType을 MainTypeCode로 변환
 */
function typeToCode(type: MovementType): MainTypeCode {
  const map: Record<MovementType, MainTypeCode> = {
    '담직': 'D',
    '날림': 'N',
    '버팀': 'B',
    '흘림': 'H'
  };
  return map[type];
}

/**
 * MainTypeCode를 MovementType으로 변환
 */
function codeToType(code: MainTypeCode): MovementType {
  const map: Record<MainTypeCode, MovementType> = {
    D: '담직',
    N: '날림',
    B: '버팀',
    H: '흘림'
  };
  return map[code];
}

// ============================================
// Confidence 계산 (자연스러운 방식)
// ============================================

/**
 * 3가지 요소로 신뢰도 계산:
 * 1. 메인 타입 우위도 (Top share): 1등이 전체에서 차지하는 비율
 * 2. 격차 (Margin): 1등과 2등의 점수 차이
 * 3. 서브타입 선명도 (Sub clarity): 서브타입 1등과 2등의 차이
 * 
 * @param scores - 메인 타입 점수 (D/N/B/H)
 * @param mainType - 최종 선택된 메인 타입
 * @param subScores - 해당 메인 타입 내 서브타입 점수 배열 (선택 사항)
 * @returns ConfidenceResult
 */
export function computeConfidence(
  scores: Record<MainTypeCode, number>,
  mainType: MainTypeCode,
  subScores?: number[]
): ConfidenceResult {
  const arr = (Object.entries(scores) as Array<[MainTypeCode, number]>)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);

  const top = arr[0]?.v ?? 0;
  const second = arr[1]?.v ?? 0;

  const total = arr.reduce((s, x) => s + x.v, 0);
  const safeTotal = total <= 0 ? 1 : total;

  // 1) 우위도: 1등 점수 / 총점
  const topShare = clamp01(top / safeTotal);

  // 2) 격차: (1등 - 2등) / (총점의 35% 정도로 정규화)
  // 총점이 커질수록 격차도 자연스럽게 커지도록 조정
  const marginRaw = top - second;
  const marginNormBase = Math.max(1, safeTotal * 0.35);
  const marginScore = clamp01(marginRaw / marginNormBase);

  // 3) 서브 선명도: (서브 1등 - 2등) / (서브총점의 60%로 정규화)
  let subClarity = 0.5; // subScores가 없으면 중립값
  if (subScores && subScores.length > 0) {
    const sortedSub = [...subScores].sort((a, b) => b - a);
    const subTop = sortedSub[0] ?? 0;
    const subSecond = sortedSub[1] ?? 0;
    const subTotal = subScores.reduce((s, x) => s + x, 0);
    const subBase = Math.max(1, subTotal * 0.6);
    subClarity = clamp01((subTop - subSecond) / subBase);
  }

  // 가중치 합산
  const blended =
    0.55 * topShare +
    0.30 * marginScore +
    0.15 * subClarity;

  // 0~100 변환
  let confidence = roundInt(blended * 100);

  // 너무 낮아도 UX가 무너지지 않게 하한/상한 약간 다듬기
  // (특히 설문 문항 수가 충분하면 25% 이하로 잘 내려가지 않도록)
  confidence = Math.max(20, Math.min(99, confidence));

  // 레벨 & 문구
  const { level, message } = confidenceToMessage(confidence, mainType);

  return {
    confidence,
    level,
    message,
    debug: { topShare, marginScore, subClarity }
  };
}

/**
 * Confidence 점수를 레벨과 메시지로 변환
 */
function confidenceToMessage(confidence: number, mainType: MainTypeCode) {
  if (confidence >= 85) {
    return {
      level: "매우 높음" as const,
      message: "결과가 비교적 뚜렷해요. 지금 패턴을 기준으로 루틴을 시작해도 좋아요."
    };
  }
  if (confidence >= 70) {
    return {
      level: "높음" as const,
      message: "현재 패턴이 꽤 일관되게 보여요. 교정 루틴을 적용하면 체감이 빠를 수 있어요."
    };
  }
  if (confidence >= 55) {
    return {
      level: "보통" as const,
      message: "상황에 따라 다른 특성이 섞여 보일 수 있어요. 1~2주 후 재테스트하면 더 선명해져요."
    };
  }
  if (confidence >= 40) {
    return {
      level: "낮음" as const,
      message: "몇 가지 타입 특성이 함께 나타나요. 통증/피로가 있는 날엔 결과가 흔들릴 수 있어요."
    };
  }
  return {
    level: "매우 낮음" as const,
    message: "현재 답변만으로는 단정이 어려워요. 컨디션이 안정된 날 다시 체크해보면 좋아요."
  };
}

// ============================================
// 메인 타입 점수 계산
// ============================================

/**
 * 설문 응답 배열에서 메인 타입별 점수 합산
 * 
 * @param answers - 사용자 응답 배열
 * @param questions - 질문 배열
 * @returns TypeScores
 */
export function calculateMainTypeScores(
  answers: Answer[],
  questions: Question[]
): TypeScores {
  const scores: TypeScores = {
    담직: 0,
    날림: 0,
    버팀: 0,
    흘림: 0
  };

  for (const answer of answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) continue;

    if (isMultipleAnswer(answer)) {
      const option = question.options?.find(opt => opt.id === answer.selectedOptionId);
      
      if (option && option.type) {
        scores[option.type] += option.score || 1;
      }
    } else if (isBinaryAnswer(answer)) {
      // Binary 질문은 불균형 플래그이므로, 메인 타입 점수에는 영향 없음
      // (필요시 별도 로직 추가 가능)
    }
  }

  return scores;
}

/**
 * 메인 타입 점수에서 최고 점수 타입 결정
 */
export function determineMainType(scores: TypeScores): MovementType {
  const entries = Object.entries(scores) as [MovementType, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  
  return sorted[0][0];
}

// ============================================
// 서브타입 점수 계산
// ============================================

/**
 * 메인 타입 내에서 서브타입별 점수 계산
 * 
 * - subTypeWeight: true인 질문의 subTypeModifier 값으로 서브타입 점수 누적
 * - Binary 질문의 imbalanceFlag도 고려
 * 
 * @param answers - 사용자 응답 배열
 * @param questions - 질문 배열
 * @param mainType - 확정된 메인 타입
 * @returns SubType
 */
export function calculateSubType(
  answers: Answer[],
  questions: Question[],
  mainType: MovementType
): SubType {
  const mainTypeCode = typeToCode(mainType);
  
  // 서브타입별 점수 누적
  const subScores: SubTypeScores = {};
  
  // 불균형 관련 카운트
  let imbalanceCount = 0;

  for (const answer of answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) continue;

    // Multiple 질문: subTypeWeight가 true인 경우 subTypeModifier 누적
    if (isMultipleAnswer(answer) && question.subTypeWeight) {
      const option = question.options?.find(opt => opt.id === answer.selectedOptionId);
      
      if (option && option.type === mainType && option.subTypeModifier) {
        const modifier = option.subTypeModifier;
        subScores[modifier] = (subScores[modifier] || 0) + 1;
      }
    }

    // Binary 질문: imbalanceFlag 카운트
    if (isBinaryAnswer(answer) && question.imbalanceFlag) {
      if (answer.answer === true) {
        imbalanceCount++;
      }
    }
  }

  // 서브타입 결정 로직
  const subType = determineSubTypeFromScores(
    mainTypeCode, 
    subScores, 
    imbalanceCount
  );

  return subType;
}

/**
 * 서브타입 점수와 불균형 카운트로부터 최종 서브타입 결정
 * 
 * 각 메인 타입별 4가지 서브타입 중 점수가 가장 높은 것 선택
 * 불균형 카운트가 5개 이상이면 비대칭/불균형 관련 서브타입 우선
 */
function determineSubTypeFromScores(
  mainTypeCode: MainTypeCode,
  subScores: SubTypeScores,
  imbalanceCount: number
): SubType {
  // 각 메인 타입별 서브타입 매핑
  const subTypeMap: Record<MainTypeCode, SubType[]> = {
    D: ['담직-상체고착형', '담직-하체고착형', '담직-호흡잠김형', '담직-전신둔화형'],
    N: ['날림-관절흐름형', '날림-중심이탈형', '날림-좌우불균형형', '날림-동작과속형'],
    B: ['버팀-허리의존형', '버팀-목어깨과로형', '버팀-무릎집중형', '버팀-단측지배형'],
    H: ['흘림-힘누수형', '흘림-체인단절형', '흘림-비대칭전달형', '흘림-효율저하형']
  };

  const possibleSubTypes = subTypeMap[mainTypeCode];

  // 서브타입별 매칭 키워드 (subTypeModifier와 매칭)
  const subTypeKeywords: Record<MainTypeCode, Record<string, SubType>> = {
    D: {
      '상체고착': '담직-상체고착형',
      '하체고착': '담직-하체고착형',
      '호흡잠김': '담직-호흡잠김형',
      '전신둔화': '담직-전신둔화형'
    },
    N: {
      '관절흐름': '날림-관절흐름형',
      '중심이탈': '날림-중심이탈형',
      '좌우불균형': '날림-좌우불균형형',
      '동작과속': '날림-동작과속형'
    },
    B: {
      '허리의존': '버팀-허리의존형',
      '목어깨과로': '버팀-목어깨과로형',
      '무릎집중': '버팀-무릎집중형',
      '단측지배': '버팀-단측지배형'
    },
    H: {
      '힘누수': '흘림-힘누수형',
      '체인단절': '흘림-체인단절형',
      '비대칭전달': '흘림-비대칭전달형',
      '효율저하': '흘림-효율저하형'
    }
  };

  // 불균형 카운트가 5개 이상이면 비대칭/불균형 서브타입 우선
  if (imbalanceCount >= 5) {
    if (mainTypeCode === 'N') return '날림-좌우불균형형';
    if (mainTypeCode === 'B') return '버팀-단측지배형';
    if (mainTypeCode === 'H') return '흘림-비대칭전달형';
  }

  // subScores에서 가장 높은 점수의 modifier 찾기
  const sortedScores = Object.entries(subScores)
    .sort((a, b) => b[1] - a[1]);

  if (sortedScores.length > 0) {
    const topModifier = sortedScores[0][0];
    const keywords = subTypeKeywords[mainTypeCode];
    
    // modifier와 매칭되는 서브타입 찾기
    for (const [keyword, subType] of Object.entries(keywords)) {
      if (topModifier.includes(keyword)) {
        return subType;
      }
    }
  }

  // 기본값: 첫 번째 서브타입 반환
  return possibleSubTypes[0];
}

// ============================================
// 전체 결과 계산
// ============================================

/**
 * 설문 응답으로부터 전체 테스트 결과 계산
 * 
 * @param answers - 사용자 응답 배열
 * @param questions - 질문 배열
 * @returns TestResult
 */
export function calculateTestResult(
  answers: Answer[],
  questions: Question[]
): TestResult {
  // 1. 메인 타입 점수 계산
  const typeScores = calculateMainTypeScores(answers, questions);
  const mainType = determineMainType(typeScores);

  // 2. 서브타입 계산
  const subType = calculateSubType(answers, questions, mainType);

  // 3. Confidence 계산
  const mainTypeCode = typeToCode(mainType);
  const scoresForConfidence: Record<MainTypeCode, number> = {
    D: typeScores['담직'],
    N: typeScores['날림'],
    B: typeScores['버팀'],
    H: typeScores['흘림']
  };

  // 서브타입 점수 배열 (간단히 타입별 상대 점수로 가정)
  const subScoresArray = Object.values(typeScores);
  
  const confidenceResult = computeConfidence(
    scoresForConfidence,
    mainTypeCode,
    subScoresArray
  );

  // 4. 결과 조합
  const result: TestResult = {
    mainType,
    subType,
    confidence: confidenceResult.confidence,
    typeScores,
    completedAt: new Date().toISOString(),
    answers
  };

  return result;
}

// ============================================
// Export 유틸리티
// ============================================

export type {
  MainTypeCode,
  ConfidenceLevel,
  ConfidenceResult,
  TypeScores,
  SubTypeScores
};

export {
  typeToCode,
  codeToType,
  confidenceToMessage
};
