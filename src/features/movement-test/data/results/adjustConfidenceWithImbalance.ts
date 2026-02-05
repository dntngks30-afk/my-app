/**
 * 불균형 진단 기반 Confidence 보정 로직
 * 
 * 불균형 진단 10문항(예/아니오)을 활용해 신뢰도를 자연스럽게 보정합니다.
 * - 메인 타입을 뒤집지 않음
 * - 결과의 설득력만 강화
 */

// ============================================
// 타입 정의
// ============================================

type MainTypeCode = "D" | "N" | "B" | "H";

type Severity = "none" | "mild" | "strong";

type SubTypeBoostKey = "H_ASYM_TRANSFER" | "N_LR_IMBAL" | "B_SINGLE_DOM";

interface ImbalanceAdjustmentResult {
  /** 최종 조정된 confidence (20~99) */
  finalConfidence: number;
  
  /** 불균형 가중치가 가장 높은 타입 (보정 대상) */
  biasMainType?: MainTypeCode;
  
  /** 서브타입 선명도 보정 힌트 */
  subTypeBoost?: SubTypeBoostKey;
  
  /** 디버그 정보 */
  debug: {
    /** YES 응답 개수 */
    yesCount: number;
    
    /** 불균형 강도 */
    severity: Severity;
    
    /** H(흘림형) 가중치 합 */
    hImb: number;
    
    /** N(날림형) 가중치 합 */
    nImb: number;
    
    /** B(버팀형) 가중치 합 */
    bImb: number;
    
    /** 적용된 보정값 */
    appliedAdjustment: number;
  };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 값을 min~max 범위로 clamp
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 반올림
 */
function roundInt(x: number): number {
  return Math.round(x);
}

// ============================================
// 불균형 진단 문항 정의 (참고용)
// ============================================

/*
1. 한쪽 어깨 높이가 눈에 띄게 다르다
2. 한쪽 골반이 자주 불편하다
3. 한쪽 다리로 체중을 싣는 습관이 있다
4. 호흡 시 갈비 움직임이 좌우 다르다
5. 한쪽 무릎만 반복적으로 불편하다
6. 스쿼트 시 무게 중심이 한쪽으로 쏠린다
7. 팔 들 때 한쪽만 불편하다
8. 걷다 보면 몸이 한쪽으로 치우친다
9. 스트레칭 시 좌우 느낌 차이가 크다
10. 신발 바깥/안쪽 닳음이 다르다
*/

// ============================================
// 타입별 불균형 가중치 테이블
// ============================================

/**
 * H(흘림형) 가중치
 * - 문항 4,6,8,10 → 1.0
 * - 문항 2,3,5 → 0.3
 */
const H_WEIGHTS = [
  0,   // 문항 1: 가중치 없음
  0.3, // 문항 2
  0.3, // 문항 3
  1.0, // 문항 4
  0.3, // 문항 5
  1.0, // 문항 6
  0,   // 문항 7: 가중치 없음
  1.0, // 문항 8
  0,   // 문항 9: 가중치 없음
  1.0  // 문항 10
];

/**
 * N(날림형) 가중치
 * - 문항 1,7,9 → 1.0
 * - 문항 6,8 → 0.4
 */
const N_WEIGHTS = [
  1.0, // 문항 1
  0,   // 문항 2: 가중치 없음
  0,   // 문항 3: 가중치 없음
  0,   // 문항 4: 가중치 없음
  0,   // 문항 5: 가중치 없음
  0.4, // 문항 6
  1.0, // 문항 7
  0.4, // 문항 8
  1.0, // 문항 9
  0    // 문항 10: 가중치 없음
];

/**
 * B(버팀형) 가중치
 * - 문항 2,3,5 → 1.0
 * - 문항 6 → 0.3
 */
const B_WEIGHTS = [
  0,   // 문항 1: 가중치 없음
  1.0, // 문항 2
  1.0, // 문항 3
  0,   // 문항 4: 가중치 없음
  1.0, // 문항 5
  0.3, // 문항 6
  0,   // 문항 7: 가중치 없음
  0,   // 문항 8: 가중치 없음
  0,   // 문항 9: 가중치 없음
  0    // 문항 10: 가중치 없음
];

// ============================================
// 가중치 계산
// ============================================

/**
 * 불균형 답변 배열에서 타입별 가중치 합 계산
 * 
 * @param imbalanceAnswers - 10개 문항의 YES/NO 배열
 * @returns H, N, B 타입별 가중치 합
 */
function calculateTypeWeights(imbalanceAnswers: boolean[]): {
  hImb: number;
  nImb: number;
  bImb: number;
} {
  let hImb = 0;
  let nImb = 0;
  let bImb = 0;

  for (let i = 0; i < 10; i++) {
    if (imbalanceAnswers[i] === true) {
      hImb += H_WEIGHTS[i];
      nImb += N_WEIGHTS[i];
      bImb += B_WEIGHTS[i];
    }
  }

  return { hImb, nImb, bImb };
}

/**
 * 가중치 합이 가장 높은 타입 선택
 * - 동점일 경우 H(흘림형) 우선
 * 
 * @returns 보정 대상 타입 (D는 선택되지 않음)
 */
function selectBiasMainType(
  hImb: number,
  nImb: number,
  bImb: number
): MainTypeCode | undefined {
  // 모든 가중치가 0이면 보정 없음
  if (hImb === 0 && nImb === 0 && bImb === 0) {
    return undefined;
  }

  // 최대값 찾기
  const maxWeight = Math.max(hImb, nImb, bImb);

  // H 우선 순위 (동점 시 H 선택)
  if (hImb === maxWeight) return "H";
  if (nImb === maxWeight) return "N";
  if (bImb === maxWeight) return "B";

  return undefined;
}

// ============================================
// Confidence 보정 로직
// ============================================

/**
 * 불균형 진단 기반으로 confidence 보정
 * 
 * @param baseConfidence - 기본 confidence (0~100)
 * @param mainType - 메인 타입
 * @param imbalanceAnswers - 불균형 진단 10문항 답변 (true=YES, false=NO)
 * @returns ImbalanceAdjustmentResult
 */
export function adjustConfidenceWithImbalance(
  baseConfidence: number,
  mainType: MainTypeCode,
  imbalanceAnswers: boolean[]
): ImbalanceAdjustmentResult {
  // 1. YES 개수 카운트
  const yesCount = imbalanceAnswers.filter(ans => ans === true).length;

  // 2. 강도 판정
  let severity: Severity;
  if (yesCount <= 3) {
    severity = "none";
  } else if (yesCount <= 5) {
    severity = "mild";
  } else {
    severity = "strong";
  }

  // 3. 보정 없음 조건
  if (severity === "none") {
    return {
      finalConfidence: clamp(roundInt(baseConfidence), 20, 99),
      debug: {
        yesCount,
        severity,
        hImb: 0,
        nImb: 0,
        bImb: 0,
        appliedAdjustment: 0
      }
    };
  }

  // 4. 타입별 가중치 계산
  const { hImb, nImb, bImb } = calculateTypeWeights(imbalanceAnswers);

  // 5. 보정 대상 타입 선택
  const biasMainType = selectBiasMainType(hImb, nImb, bImb);

  // 보정 대상이 없으면 (D타입이거나 가중치 없음)
  if (!biasMainType) {
    return {
      finalConfidence: clamp(roundInt(baseConfidence), 20, 99),
      debug: {
        yesCount,
        severity,
        hImb,
        nImb,
        bImb,
        appliedAdjustment: 0
      }
    };
  }

  // 6. 보정값 범위 결정
  let minAdjustment: number;
  let maxAdjustment: number;

  if (severity === "mild") {
    minAdjustment = 2;
    maxAdjustment = 4;
  } else { // strong
    minAdjustment = 5;
    maxAdjustment = 10;
  }

  // 7. 가중치 합에 따라 보정값 계산
  const maxPossibleWeight = severity === "mild" 
    ? 3.0  // mild일 때 최대 가능 가중치 (대략적 추정)
    : 5.0; // strong일 때 최대 가능 가중치

  let relevantWeight: number;
  if (biasMainType === "H") {
    relevantWeight = hImb;
  } else if (biasMainType === "N") {
    relevantWeight = nImb;
  } else { // "B"
    relevantWeight = bImb;
  }

  // 가중치 비율 (0~1)
  const weightRatio = Math.min(relevantWeight / maxPossibleWeight, 1.0);

  // 보정값 = min + (max - min) * ratio
  const rawAdjustment = minAdjustment + (maxAdjustment - minAdjustment) * weightRatio;

  // 8. 메인 타입과 일치 여부에 따라 보정값 적용
  let finalAdjustment: number;
  if (mainType === biasMainType) {
    // 같으면 100% 적용
    finalAdjustment = rawAdjustment;
  } else {
    // 다르면 50% 적용 (메인 타입 뒤집힘 방지)
    finalAdjustment = rawAdjustment * 0.5;
  }

  // 9. 최종 confidence 계산
  const adjustedConfidence = baseConfidence + finalAdjustment;
  const finalConfidence = clamp(roundInt(adjustedConfidence), 20, 99);

  // 10. 서브타입 선명도 보정 힌트
  let subTypeBoost: SubTypeBoostKey | undefined;
  if (biasMainType === "H") {
    subTypeBoost = "H_ASYM_TRANSFER";
  } else if (biasMainType === "N") {
    subTypeBoost = "N_LR_IMBAL";
  } else if (biasMainType === "B") {
    subTypeBoost = "B_SINGLE_DOM";
  }

  return {
    finalConfidence,
    biasMainType,
    subTypeBoost,
    debug: {
      yesCount,
      severity,
      hImb,
      nImb,
      bImb,
      appliedAdjustment: roundInt(finalAdjustment * 10) / 10 // 소수점 1자리
    }
  };
}

// ============================================
// Export
// ============================================

export type {
  MainTypeCode,
  Severity,
  SubTypeBoostKey,
  ImbalanceAdjustmentResult
};
