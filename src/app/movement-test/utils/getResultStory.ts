/**
 * 설문 결과 화면 스토리 구성
 * 
 * 결과 화면에 표시될 전체 문구를 하나의 자연스러운 스토리 흐름으로 구성합니다.
 * - 타입 선언 → 핵심 설명 → 신뢰도 → 불균형 보정 → 다음 행동
 * - 전문적이되 부담 없는 톤
 * - 진단/문제/이상 표현 금지
 */

// ============================================
// 타입 정의
// ============================================

type ImbalanceSeverity = "none" | "mild" | "strong";

interface ResultStoryInput {
  /** 메인 타입명 (예: "버팀형") */
  mainTypeName: string;
  
  /** 서브타입명 (예: "허리의존형") */
  subTypeName: string;
  
  /** 서브타입 한 줄 요약 */
  subTypeHeadline: string;
  
  /** 서브타입 핵심 설명 */
  subTypeSummary: string;
  
  /** Confidence 점수 (20~99) */
  confidence: number;
  
  /** Confidence 라벨 */
  confidenceLabel: string;
  
  /** Confidence 설명 문구 */
  confidenceBody: string;
  
  /** 불균형 강도 */
  imbalanceSeverity?: ImbalanceSeverity;
  
  /** 불균형 보정 설명 문구 */
  imbalanceNote?: string;
  
  /** 타입별 불균형 해석 문구 */
  typeBiasNote?: string;
}

interface ResultStory {
  /** 섹션 1: 타입 선언 */
  section1_typeDeclare: string;
  
  /** 섹션 2: 타입 핵심 설명 */
  section2_typeExplain: string;
  
  /** 섹션 3: Confidence 해석 */
  section3_confidence: string;
  
  /** 섹션 4: 불균형 보정 설명 (있는 경우만) */
  section4_imbalance?: string;
  
  /** 섹션 5: 다음 행동(CTA) 안내 */
  section5_nextAction: string;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 설문 결과를 하나의 스토리로 구성
 * 
 * @param input - 결과 데이터
 * @returns ResultStory - 5개 섹션으로 구성된 스토리
 */
export function getResultStory(input: ResultStoryInput): ResultStory {
  const {
    mainTypeName,
    subTypeName,
    subTypeHeadline,
    subTypeSummary,
    confidence,
    confidenceLabel,
    confidenceBody,
    imbalanceSeverity,
    imbalanceNote,
    typeBiasNote
  } = input;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 섹션 1: 타입 선언
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const section1_typeDeclare = 
    `당신의 움직임 타입은\n**${mainTypeName} – ${subTypeName}**입니다.`;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 섹션 2: 타입 핵심 설명
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const section2_typeExplain = 
    `${subTypeHeadline}\n\n${subTypeSummary}\n\n` +
    `이런 패턴은 특정 움직임을 오랜 시간 반복하거나, ` +
    `특정 부위에 의존하는 몸 사용 습관에서 자연스럽게 만들어집니다.`;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 섹션 3: Confidence 해석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const section3_confidence = 
    `**결과 신뢰도: ${confidenceLabel}** (${confidence}점)\n\n` +
    `${confidenceBody}`;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 섹션 4: 불균형 보정 설명 (조건부)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let section4_imbalance: string | undefined;

  if (
    imbalanceSeverity && 
    imbalanceSeverity !== "none" && 
    imbalanceNote
  ) {
    // 기본 불균형 설명
    let imbalanceText = `**좌우 사용 패턴 보정**\n\n${imbalanceNote}`;
    
    // 타입별 추가 해석이 있으면 연결
    if (typeBiasNote) {
      imbalanceText += `\n\n${typeBiasNote}`;
    }
    
    section4_imbalance = imbalanceText;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 섹션 5: 다음 행동(CTA) 안내
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const section5_nextAction = generateNextActionCopy(
    confidenceLabel,
    imbalanceSeverity,
    mainTypeName
  );

  return {
    section1_typeDeclare,
    section2_typeExplain,
    section3_confidence,
    section4_imbalance,
    section5_nextAction
  };
}

// ============================================
// CTA 생성 로직
// ============================================

/**
 * Confidence와 불균형 상태에 따라 적절한 CTA 생성
 * 
 * @param confidenceLabel - 신뢰도 라벨
 * @param imbalanceSeverity - 불균형 강도
 * @param mainTypeName - 메인 타입명
 * @returns CTA 문구
 */
function generateNextActionCopy(
  confidenceLabel: string,
  imbalanceSeverity: ImbalanceSeverity | undefined,
  mainTypeName: string
): string {
  // 신뢰도가 낮은 경우: 재테스트 권장
  if (confidenceLabel === "낮음" || confidenceLabel === "매우 낮음") {
    return (
      `**다음 단계**\n\n` +
      `지금 결과도 참고할 수 있지만, 컨디션이 안정된 날 다시 테스트하면 ` +
      `더 일관된 패턴을 발견할 수 있어요.\n\n` +
      `아래 가이드를 보면서 몸의 변화를 관찰해보세요. ` +
      `2주 정도 적용한 후 재테스트하면 결과가 더 선명해질 가능성이 높습니다.`
    );
  }

  // 불균형이 강한 경우: 비대칭 중심 안내
  if (imbalanceSeverity === "strong") {
    return (
      `**다음 단계**\n\n` +
      `좌우 차이가 비교적 뚜렷하게 나타났으니, ` +
      `비주도측(덜 쓰이는 쪽) 감각을 깨우는 운동부터 시작하면 좋아요.\n\n` +
      `아래 가이드에서 한쪽씩 천천히 진행하는 동작을 우선적으로 따라해보세요. ` +
      `균형이 맞아들면 자세가 빠르게 안정되는 걸 체감할 수 있습니다.`
    );
  }

  // 일반적인 경우: 루틴 시작 권장
  return (
    `**다음 단계**\n\n` +
    `${mainTypeName}은 순서와 강도만 맞춰도 움직임 느낌이 크게 달라질 수 있어요.\n\n` +
    `아래 교정 가이드를 천천히 따라하면서, ` +
    `몸의 변화를 관찰해보세요. ` +
    `작은 변화라도 느껴진다면 올바른 방향으로 가고 있는 겁니다.`
  );
}

// ============================================
// Export
// ============================================

export type {
  ImbalanceSeverity,
  ResultStoryInput,
  ResultStory
};

// ============================================
// 통합 함수 (간편 사용)
// ============================================

/**
 * type-descriptions.ts + getConfidenceCopy.ts 결과를 받아서
 * 바로 스토리 생성
 * 
 * 사용 예:
 * const story = createResultStory({
 *   mainType: "버팀형",
 *   subType: subTypeContent,
 *   confidenceCopy: confidenceResult,
 *   imbalanceSeverity: "mild"
 * });
 */
export interface QuickStoryInput {
  mainTypeName: string;
  subType: {
    subTypeName: string;
    headline: string;
    summary: string;
  };
  confidenceCopy: {
    confidenceLabel: string;
    confidence: number;
    body: string;
    imbalanceNote?: string;
    typeBiasNote?: string;
  };
  imbalanceSeverity?: ImbalanceSeverity;
}

export function createResultStory(input: QuickStoryInput): ResultStory {
  return getResultStory({
    mainTypeName: input.mainTypeName,
    subTypeName: input.subType.subTypeName,
    subTypeHeadline: input.subType.headline,
    subTypeSummary: input.subType.summary,
    confidence: input.confidenceCopy.confidence,
    confidenceLabel: input.confidenceCopy.confidenceLabel,
    confidenceBody: input.confidenceCopy.body,
    imbalanceSeverity: input.imbalanceSeverity,
    imbalanceNote: input.confidenceCopy.imbalanceNote,
    typeBiasNote: input.confidenceCopy.typeBiasNote
  });
}
