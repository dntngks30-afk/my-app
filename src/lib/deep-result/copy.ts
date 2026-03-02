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
      '팔 올릴 때 어깨 앞/목이 뻐근',
      '벽천사 동작이 불편',
      '등이 잘 안 펴짐',
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
      '한발 서기에서 상체 흔들림',
      '골반이 한쪽으로 기울어짐',
      '허리로 버티는 느낌',
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
      '팔꿈치 지지 시 불편',
      '손목 굽힘/반복 동작에서 피로',
      '상체 운동 시 손목·팔꿈치에 과부하',
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
      '스쿼트/계단에서 무릎이 안쪽으로 말림',
      '한발 균형이 흔들림',
      '엉덩이/허벅지 앞쪽에 과부하',
    ],
    goals7d: [
      '중둔근/발 아치 지지 회복',
      '무릎 정렬 안정화',
      '골반 흔들림 감소',
    ],
    caution: '통증 있는 날은 깊은 스쿼트/점프는 강도를 낮춰요.',
  },
  DECONDITIONED: {
    badgeTitle: '통증 우세 경향',
    headline: "지금은 '강화'보다 '안정적인 움직임 복구'가 우선이에요.",
    subhead: '부하를 점진적으로 올리면서 회복 기반을 다져요.',
    symptoms: [
      '통증 강도가 움직임을 방해',
      '통증 회피로 자세가 무너짐',
      '운동 후 회복이 늦음',
    ],
    goals7d: [
      '통증 유발 패턴 최소화',
      '부하를 안전하게 분산',
      '일상 움직임 편안함 회복',
    ],
    caution: '통증이 날카롭거나 악화 중이면 의료 상담을 권장해요.',
  },
  STABLE: {
    badgeTitle: '전반적으로 안정',
    headline: '큰 제한은 적지만, 작은 습관 차이가 컨디션을 갈라요.',
    subhead: '가동성 유지와 루틴 습관화가 핵심이에요.',
    symptoms: [
      '가끔 뻐근함/피로',
      '장시간 앉으면 굳음',
      '운동 전 워밍업이 부족',
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
