/**
 * Deep Result 카피 SSOT
 * result_type별 문구를 단일 매핑으로 고정. 6개 타입 누락 시 컴파일 실패.
 */

import type { DeepV2ResultType } from '@/lib/deep-test/types';

export interface DeepResultCopy {
  badgeTitle: string;
  headline: string;
  subhead: string;
  symptoms: string[];
  goals7d: string[];
  caution: string;
}

const FALLBACK_COPY: DeepResultCopy = {
  badgeTitle: '결과 요약',
  headline: '결과를 요약할 수 있어요.',
  subhead: '테스트를 완료하면 맞춤 문구가 표시됩니다.',
  symptoms: [],
  goals7d: [],
  caution: '강도를 올리기 전, 폼과 호흡을 먼저 고정해요.',
};

export const DEEP_RESULT_COPY = {
  'NECK-SHOULDER': {
    badgeTitle: '상체 가동성 제한 경향',
    headline: '어깨·흉추가 막히면 목/허리에 보상 움직임이 생기기 쉬워요.',
    subhead: '팔 올리기, 등 펴기 동작에서 제한이 느껴질 수 있어요.',
    symptoms: [
      '기지개 켤 때 어깨가 찝히거나 목이 꽉 막힌 느낌이 들어요.',
      '뒷지퍼를 올리거나 등 뒤로 손을 맞잡는 게 유독 힘들어요.',
      '컴퓨터를 조금만 해도 누가 어깨 위에 앉아있는 듯 묵직해요.',
    ],
    goals7d: [
      '흉추 신전/회전 회복',
      '견갑 움직임 정상화',
      '목·어깨 긴장 완화',
    ],
    caution: '저림/방사통이 있으면 무리한 스트레칭은 피하고 범위를 줄여요.',
  },
  'LUMBO-PELVIS': {
    badgeTitle: '코어 컨트롤 부족 경향',
    headline: '몸통이 흔들리면 팔다리가 대신 버텨서 허리/골반에 부담이 실려요.',
    subhead: '한발 서기, 계단 오르기에서 보상이 커질 수 있어요.',
    symptoms: [
      '바지 입으려고 한 발로 설 때 중심 잡기가 힘들어 휘청여요.',
      '오래 서 있으면 나도 모르게 한쪽 골반에만 체중을 싣게 돼요.',
      '조금만 걸어도 허리 아래쪽이 뻐근해져서 자꾸 두드리게 돼요.',
    ],
    goals7d: [
      '호흡-코어 연결',
      '골반 중립 유지',
      '상체 흔들림 감소',
    ],
    caution: '허리 통증이 올라오면 강도를 즉시 낮추고 호흡부터 재정렬.',
  },
  'UPPER-LIMB': {
    badgeTitle: '상지 부위 경향',
    headline: '손목·팔꿈치 부위에 과부하가 쌓이기 쉬워요.',
    subhead: '팔꿈치 지지, 손목 굽힘 동작에서 불편함이 느껴질 수 있어요.',
    symptoms: [
      '바닥을 짚고 일어날 때 손목이 시큰해서 주먹을 쥐게 돼요.',
      '마우스나 스마트폰을 오래 쓰면 팔꿈치 주변이 찌릿하고 무거워요.',
      '무거운 장바구니를 들고 나면 팔 아래쪽 근육이 딱딱하게 굳어요.',
    ],
    goals7d: [
      '손목·팔꿈치 가동성 개선',
      '어깨 안정화로 부하 분산',
      '과사용 부위 회복',
    ],
    caution: '저림이나 통증이 있으면 무리한 지지 동작은 피해요.',
  },
  'LOWER-LIMB': {
    badgeTitle: '하체 불안정 경향',
    headline: '무릎·골반이 흔들리면 힘이 분산돼 통증/피로가 쌓이기 쉬워요.',
    subhead: '스쿼트, 계단, 한발 서기에서 불안정이 느껴질 수 있어요.',
    symptoms: [
      '계단을 내려갈 때 무릎이 힘없이 흔들리거나 방향이 어긋나요.',
      '앉았다 일어날 때 무릎에서 소리가 나거나 앞쪽이 당기는 느낌이에요.',
      '운동 후 엉덩이보다는 허벅지 앞쪽만 유독 터질 듯이 아파요.',
    ],
    goals7d: [
      '중둔근/발 아치 지지 회복',
      '무릎 정렬 안정화',
      '골반 흔들림 감소',
    ],
    caution: '통증 있는 날은 깊은 스쿼트/점프는 강도를 낮춰요.',
  },
  'DECONDITIONED': {
    badgeTitle: '통증 우세 경향',
    headline: "지금은 '강화'보다 '안정적인 움직임 복구'가 우선이에요.",
    subhead: '부하를 점진적으로 올리면서 회복 기반을 다져요.',
    symptoms: [
      '아픈 곳을 피해서 움직이다 보니 몸 전체가 삐딱해진 느낌이에요.',
      '자고 일어나도 몸이 천근만근이고, 작은 움직임도 겁이 나요.',
      '운동이 몸을 살리는 게 아니라 오히려 병나게 할까 봐 걱정돼요.',
    ],
    goals7d: [
      '통증 유발 패턴 최소화',
      '부하를 안전하게 분산',
      '일상 움직임 편안함 회복',
    ],
    caution: '통증이 날카롭거나 악화 중이면 의료 상담을 권장해요.',
  },
  'STABLE': {
    badgeTitle: '전반적으로 안정',
    headline: '큰 제한은 적지만, 작은 습관 차이가 컨디션을 갈라요.',
    subhead: '가동성 유지와 루틴 습관화가 핵심이에요.',
    symptoms: [
      '평소 큰 통증은 없지만, 몸이 예전만큼 가볍지는 않다고 느껴요.',
      '오후만 되면 몸이 뻣뻣해져서 "아이구" 소리가 절로 나와요.',
      '운동은 하고 싶지만, 어디서부터 어떻게 시작할지 막막해요.',
    ],
    goals7d: [
      '가동성 유지',
      '피로 누적 방지',
      '루틴 습관화',
    ],
    caution: '강도를 올리기 전, 폼/호흡/가동 범위를 먼저 고정해요.',
  },
} satisfies Record<DeepV2ResultType, DeepResultCopy>;

const VALID_TYPES = Object.keys(DEEP_RESULT_COPY) as DeepV2ResultType[];

export function getCopy(
  resultType: string | null | undefined
): DeepResultCopy {
  if (!resultType || typeof resultType !== 'string') return FALLBACK_COPY;
  const key = resultType.trim() as DeepV2ResultType;
  if (VALID_TYPES.includes(key)) return DEEP_RESULT_COPY[key];
  return FALLBACK_COPY;
}

export type ConfidenceLabel = 'high' | 'medium' | 'low';

export function getConfidenceLabel(confidence: number | null | undefined): ConfidenceLabel {
  if (confidence == null || typeof confidence !== 'number' || Number.isNaN(confidence)) return 'medium';
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/** Soft-copy subhead override for low-confidence cases */
export function getSoftSubhead(resultType: string | null | undefined): string | null {
  if (!resultType || resultType === 'STABLE' || resultType === 'DECONDITIONED') return null;
  return '복합적인 패턴이 함께 보여 단일 유형으로 단정하기는 어렵습니다. 우선순위를 참고해 점진적으로 진행해 보세요.';
}
