/**
 * Confidence(신뢰도) + 불균형 보정 설명 문구 세트
 * 
 * 결과 화면에서 사용자에게 보여지는 신뢰도 설명 문구를 제공합니다.
 * - 과도한 진단·단정 표현 없이
 * - 납득과 안심을 유도하는 톤으로 작성
 */

// ============================================
// 타입 정의
// ============================================

type MainTypeCode = "D" | "N" | "B" | "H";

type ImbalanceSeverity = "none" | "mild" | "strong";

type ConfidenceLevel = "매우 높음" | "높음" | "보통" | "낮음" | "매우 낮음";

interface ConfidenceCopyResult {
  /** 분석도 라벨 (예: "높음") */
  confidenceLabel: ConfidenceLevel;
  
  /** 타이틀 (예: "분석 정확도: 높음") */
  title: string;
  
  /** 메인 설명 문구 */
  body: string;
  
  /** confidence 보조 설명 (선택) */
  sub?: string;
  
  /** 불균형 보정 설명 (선택) */
  imbalanceNote?: string;
  
  /** 타입별 추가 설명 (선택) */
  typeBiasNote?: string;
}

// ============================================
// Confidence 구간별 설명 문구
// ============================================

/**
 * Confidence 수치에서 레벨 판정
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 85) return "매우 높음";
  if (confidence >= 70) return "높음";
  if (confidence >= 55) return "보통";
  if (confidence >= 40) return "낮음";
  return "매우 낮음";
}

/**
 * Confidence 레벨별 설명 문구
 */
const CONFIDENCE_MESSAGES: Record<ConfidenceLevel, {
  body: string;
  sub?: string;
}> = {
  "매우 높음": {
    body: "답변 패턴이 비교적 뚜렷하게 일관되어, 현재 움직임 특성을 잘 반영하고 있어요.",
    sub: "지금 결과를 기준으로 교정 루틴을 시작해도 좋습니다."
  },
  
  "높음": {
    body: "답변이 꽤 일관된 방향으로 모여 있어, 현재 패턴이 비교적 안정적으로 나타나고 있어요.",
    sub: "컨디션이 달라지면 결과가 조금씩 달라질 수 있지만, 큰 흐름은 유지될 가능성이 높아요."
  },
  
  "보통": {
    body: "여러 타입 특성이 섞여 나타나고 있어요. 상황이나 컨디션에 따라 움직임 패턴이 달라질 수 있습니다.",
    sub: "1~2주 후 몸 상태가 안정된 날 다시 체크하면 더 선명한 결과를 얻을 수 있어요."
  },
  
  "낮음": {
    body: "이 결과는 무료 설문 기반의 간편 분석으로, 전반적인 경향을 파악하기 위한 참고용 결과입니다.\n",
    sub: "지금 결과도 참고할 수 있지만, 컨디션이 좋은 날 재테스트하면 더 일관된 결과를 얻을 가능성이 높아요."
  },
  
  "매우 낮음": {
    body: "이 결과는 무료 설문 기반의 간편 분석으로, 전반적인 경향을 파악하기 위한 참고용 결과입니다.\n",
    sub: "몸 상태가 안정된 날 다시 체크해보시면 더 명확한 패턴을 발견할 수 있어요."
  }
};

// ============================================
// 불균형 보정 설명 문구
// ============================================

/**
 * 불균형 강도별 설명 문구
 */
const IMBALANCE_MESSAGES: Record<Exclude<ImbalanceSeverity, "none">, string> = {
  "mild": 
    "좌우 사용 차이가 일부 보여, 비대칭 특성이 결과에 조금 더 반영되었어요. " +
    "많은 분들이 일상 습관으로 겪는 패턴이며, 인식하고 조정하면 충분히 달라질 수 있습니다.",
  
  "strong": 
    "좌우 차이 신호가 비교적 뚜렷하게 나타나, 비대칭 관련 특성이 결과에 강하게 반영되었어요. " +
    "이런 패턴은 가방 메는 쪽, 체중 싣는 다리, 앉는 자세 등 일상 습관에서 자연스럽게 만들어지는 경우가 많으며, " +
    "교정 루틴과 습관 조정으로 충분히 개선될 수 있어요."
};

// ============================================
// 타입별 보정 설명 문구
// ============================================

/**
 * 타입별 추가 설명 문구
 */
const TYPE_BIAS_MESSAGES: Record<Exclude<MainTypeCode, "D">, string> = {
  "H": "힘 전달과 연결 과정에서 좌우 차이가 나타났어요. 체인 연결과 정렬을 맞추면 양쪽이 고르게 쓰이는 느낌이 빨리 올 수 있습니다.",
  
  "N": "움직임 안정성과 컨트롤에서 좌우 차이가 보였어요. 느린 템포로 중심을 잡는 연습을 하면 균형이 빠르게 개선될 수 있습니다.",
  
  "B": "한쪽 사용 비중이 높은 단측 지배 신호가 있었어요. 비주도측(덜 쓰이는 쪽) 감각을 깨우면 자세가 곧바로 안정되는 경우가 많습니다."
};

// ============================================
// 메인 함수
// ============================================

/**
 * Confidence와 불균형 보정 정보로부터 설명 문구 생성
 * 
 * @param confidence - 신뢰도 점수 (20~99)
 * @param imbalanceSeverity - 불균형 강도 ("none" | "mild" | "strong")
 * @param biasMainType - 보정 대상 타입 ("D" | "N" | "B" | "H")
 * @returns ConfidenceCopyResult
 */
export function getConfidenceCopy(
  confidence: number,
  imbalanceSeverity?: ImbalanceSeverity,
  biasMainType?: MainTypeCode
): ConfidenceCopyResult {
  // 1. Confidence 레벨 판정
  const confidenceLabel = getConfidenceLevel(confidence);
  
  // 2. 기본 설명 문구
  const { body, sub } = CONFIDENCE_MESSAGES[confidenceLabel];
  
  // 3. 타이틀
  const title = `결과 신뢰도: ${confidenceLabel}`;
  
  // 4. 불균형 보정 설명
  let imbalanceNote: string | undefined;
  if (imbalanceSeverity && imbalanceSeverity !== "none") {
    imbalanceNote = IMBALANCE_MESSAGES[imbalanceSeverity];
  }
  
  // 5. 타입별 추가 설명
  let typeBiasNote: string | undefined;
  if (biasMainType && biasMainType !== "D" && imbalanceSeverity && imbalanceSeverity !== "none") {
    typeBiasNote = TYPE_BIAS_MESSAGES[biasMainType];
  }
  
  return {
    confidenceLabel,
    title,
    body,
    sub,
    imbalanceNote,
    typeBiasNote
  };
}

// ============================================
// Export
// ============================================

export type {
  MainTypeCode,
  ImbalanceSeverity,
  ConfidenceLevel,
  ConfidenceCopyResult
};

export {
  getConfidenceLevel,
  CONFIDENCE_MESSAGES,
  IMBALANCE_MESSAGES,
  TYPE_BIAS_MESSAGES
};
