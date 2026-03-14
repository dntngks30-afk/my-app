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
    badgeTitle: '어깨·목 움직임 제한',
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
    badgeTitle: '몸통 안정성 부족',
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
    badgeTitle: '손목·팔꿈치 부담 집중',
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
    badgeTitle: '무릎·발목 흔들림',
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
    badgeTitle: '기초 회복 우선',
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
    badgeTitle: '전반적으로 안정적',
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

/** PR-ALG-02: deep_v3 처방 근거 narrative (priority_vector / pain_mode 기반) */
export interface V3PrescriptionNarrative {
  movementFeatures: string[];
  cautionPoints: string[];
  sessionGoals: string[];
  expectedFeeling: string;
}

export interface BriefSessionRationale {
  headline: string;
  detail: string;
}

export interface DeepResultReasonBridge {
  bullets: string[];
}

export interface FirstSessionBridge {
  headline: string;
  principles: string[];
  /** priority_vector 기반 chip 라벨 (하체 안정, 좌우 균형 등) */
  chips?: string[];
  /** pain_mode caution/protected 시 표시 */
  conservativeNote?: string;
  note?: string;
}

/** PR-UX-22: user-facing chip/axis labels. 전문 용어 최소화. */
const AXIS_TO_FEATURE: Record<string, string> = {
  lower_stability: '하체 안정성',
  lower_mobility: '발목·고관절 움직임',
  upper_mobility: '어깨·등 움직임',
  trunk_control: '몸통 안정성',
  asymmetry: '좌우 균형',
  deconditioned: '기초 회복',
};

/** PR-UX-22: resultType → 첫 문장 앵커. "왜 이렇게 판단했는지" 사용자 언어. */
const RESULT_TYPE_TO_ANCHOR: Record<string, string> = {
  'UPPER-LIMB': '손목·팔꿈치 부위에 부담이 쌓이는 패턴이 우선으로 잡혔어요.',
  'NECK-SHOULDER': '어깨·목 쪽 움직임 제한이 우선으로 보여요.',
  'LOWER-LIMB': '무릎·발목 쪽 흔들림이 우선으로 잡혔어요.',
  'LUMBO-PELVIS': '몸통이 흔들릴 때 보상이 커지는 패턴이 우선이에요.',
  'DECONDITIONED': '지금은 강도보다 기본 움직임 복구가 우선이에요.',
  'STABLE': '큰 제한은 적고, 작은 습관 차이가 컨디션을 갈라요.',
};

const AXIS_TO_CAUTION: Record<string, string> = {
  lower_stability: '빠른 단측 하중은 당분간 보수적으로 접근합니다',
  lower_mobility: '깊은 스쿼트·넓은 범위 동작은 점진적으로',
  upper_mobility: '팔 올리기·지지 동작은 통증 없는 범위에서',
  trunk_control: '한발 서기·회전 동작 시 몸통 흔들림 주의',
  asymmetry: '한쪽만 과사용하지 않도록 의식적으로 균형을 맞추세요',
  deconditioned: '강도보다 일관된 움직임 복구가 우선입니다',
};

const AXIS_TO_GOAL: Record<string, string> = {
  lower_stability: '골반 안정',
  lower_mobility: '발목·고관절 움직임',
  upper_mobility: '어깨·등 움직임',
  trunk_control: '몸통 안정성',
  asymmetry: '균형 회복',
  deconditioned: '기초 회복',
};

const AXIS_TO_FEELING: Record<string, string> = {
  lower_stability: '한발 설 때 흔들림 감소',
  lower_mobility: '앉았다 일어날 때 편안함',
  upper_mobility: '팔 올릴 때 막힘 감소',
  trunk_control: '한발 설 때 상체 흔들림 감소',
  asymmetry: '좌우 차이 체감 감소',
  deconditioned: '아침에 몸이 덜 무거움',
};

const AXIS_TO_REASON: Record<string, string> = {
  lower_stability: '하체가 무너지지 않게 버티는 안정성 신호가 우선순위로 잡혔어요.',
  lower_mobility: '깊은 범위보다 발목·고관절 가동 범위를 먼저 정리할 필요가 보여요.',
  upper_mobility: '팔 올림과 상체 가동성 쪽 관리 우선순위가 높게 잡혔어요.',
  trunk_control: '몸통이 보상하지 않도록 제어를 먼저 잡는 흐름이 더 맞아요.',
  asymmetry: '좌우 균형 차이를 먼저 줄이는 쪽이 더 효율적인 상태로 보여요.',
  deconditioned: '강도보다 기본 움직임을 편하게 복구하는 쪽이 먼저예요.',
};

/** PR-UX-22: resultType → 첫 세션 headline 앵커. "왜 이런 운동이 나오는지" */
const RESULT_TYPE_TO_FIRST_HEADLINE: Record<string, string> = {
  'UPPER-LIMB': '손목·팔꿈치 부담을 줄이면서 어깨 안정화부터 시작해요.',
  'NECK-SHOULDER': '어깨·목 움직임을 정리하면서 흉추·견갑부터 시작해요.',
  'LOWER-LIMB': '무릎·발목 안정을 잡으면서 골반·중둔근부터 시작해요.',
  'LUMBO-PELVIS': '몸통 안정을 잡으면서 호흡·코어 연결부터 시작해요.',
  'DECONDITIONED': '기본 움직임을 편하게 복구하는 쪽부터 시작해요.',
  'STABLE': '가동성 유지와 루틴 습관화 중심으로 시작해요.',
};

const AXIS_TO_SESSION_PRINCIPLE: Record<string, string> = {
  lower_stability: '하체 안정과 무릎 정렬 중심',
  lower_mobility: '깊이보다 발목·고관절 가동 범위 중심',
  upper_mobility: '상체 가동성과 팔 올림 연결 중심',
  trunk_control: '몸통 제어와 흔들림 감소 중심',
  asymmetry: '좌우 균형과 한쪽 과사용 감소 중심',
  deconditioned: '강도보다 기본 움직임 복구 중심',
};

const TAG_TO_LABEL: Record<string, string> = {
  thoracic_mobility: '흉추 모빌리티',
  scapular_control: '견갑 안정화',
  neck_stability: '목/경추 안정화',
  hip_mobility: '고관절 리셋',
  ankle_mobility: '발목 가동성',
  glute_medius: '중둔근 활성화',
  core_bracing: '코어 브레이싱',
  breathing_reset: '호흡 리셋',
};

function getTopAxes(priorityVector?: Record<string, number> | null, count = 2): string[] {
  if (!priorityVector || typeof priorityVector !== 'object') return [];
  return Object.entries(priorityVector)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, count)
    .map(([axis]) => axis);
}

function labelFocusTag(tag: string): string {
  return TAG_TO_LABEL[tag] ?? tag.replace(/_/g, ' ');
}

export function getV3PrescriptionNarrative(
  priorityVector?: Record<string, number> | null,
  painMode?: 'none' | 'caution' | 'protected' | null,
  focusTags?: string[]
): V3PrescriptionNarrative | null {
  if (!priorityVector || typeof priorityVector !== 'object') return null;

  const axes = Object.entries(priorityVector)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  if (axes.length === 0) return null;

  const top2 = axes.slice(0, 2);
  const movementFeatures = top2.map(
    ([k]) => `${AXIS_TO_FEATURE[k] ?? k}이(가) 먼저 필요합니다`
  );
  const cautionPoints = top2.map(([k]) => AXIS_TO_CAUTION[k]).filter(Boolean);
  if (painMode === 'caution') {
    cautionPoints.unshift('통증이 있으면 강도를 낮추고 범위를 줄여요.');
  } else if (painMode === 'protected') {
    cautionPoints.unshift('통증이 강하면 보호 모드로 진행해요. 무리하지 마세요.');
  }
  const sessionGoals = top2.map(([k]) => AXIS_TO_GOAL[k]).filter(Boolean);
  if (focusTags?.length && sessionGoals.length < 3) {
    const tagLabels = focusTags.slice(0, 2).map((t) => t.replace(/_/g, ' '));
    sessionGoals.push(...tagLabels);
  }
  const topAxis = top2[0]?.[0];
  const expectedFeeling = (topAxis && AXIS_TO_FEELING[topAxis]) ?? '움직임이 조금 더 편해짐';

  return {
    movementFeatures,
    cautionPoints: cautionPoints.slice(0, 2),
    sessionGoals: [...new Set(sessionGoals)].slice(0, 3),
    expectedFeeling,
  };
}

/** PR-UX-22: resultType = 1차 앵커, priority_vector = 보조 이유. */
export function buildDeepResultReasonBridge(
  resultType?: string | null,
  priorityVector?: Record<string, number> | null,
  painMode?: 'none' | 'caution' | 'protected' | null,
  focusTags?: string[]
): DeepResultReasonBridge | null {
  const anchor = resultType && RESULT_TYPE_TO_ANCHOR[resultType];
  const topAxes = getTopAxes(priorityVector, 2);
  const supplementBullets = topAxes.map(
    (axis) => AXIS_TO_REASON[axis] ?? `${AXIS_TO_FEATURE[axis] ?? axis} 우선순위가 높게 잡혔어요.`
  );

  const bullets: string[] = [];
  if (anchor) bullets.push(anchor);
  if (painMode === 'protected') {
    bullets.push('통증 응답이 커서 첫 단계는 보호 모드로, 통증 없는 범위 안에서 시작해요.');
  } else if (painMode === 'caution') {
    bullets.push('통증 응답이 있어 초반 강도와 범위는 보수적으로 잡아요.');
  }
  bullets.push(...supplementBullets.filter((b) => !bullets.includes(b)));
  if (focusTags?.[0] && bullets.length < 3) {
    bullets.push(`${labelFocusTag(focusTags[0])} 쪽을 먼저 정리하면 초기 체감이 더 빨라질 수 있어요.`);
  }

  if (bullets.length === 0 && !anchor) return null;
  return {
    bullets: [...new Set(bullets)].slice(0, 4),
  };
}

/** PR-UX-22: resultType = 1차 앵커, priority_vector chips = 보조. */
export function buildFirstSessionBridge(
  resultType?: string | null,
  priorityVector?: Record<string, number> | null,
  painMode?: 'none' | 'caution' | 'protected' | null,
  focusTags?: string[]
): FirstSessionBridge | null {
  const topAxes = getTopAxes(priorityVector, 3);
  const hasAnchor = resultType && RESULT_TYPE_TO_FIRST_HEADLINE[resultType];
  if (!hasAnchor && topAxes.length === 0) return null;

  const headline =
    (resultType && RESULT_TYPE_TO_FIRST_HEADLINE[resultType]) ??
    (topAxes.length > 0
      ? `${topAxes
          .map((axis) => AXIS_TO_GOAL[axis] ?? AXIS_TO_FEATURE[axis] ?? axis)
          .filter(Boolean)
          .slice(0, 2)
          .join(' + ')}을 첫 세션 우선순위로 잡았어요.`
      : '첫 세션은 무리하게 많이 하기보다, 우선순위가 높은 패턴부터 정리하는 흐름이에요.');

  const principles = topAxes.map(
    (axis) => AXIS_TO_SESSION_PRINCIPLE[axis] ?? `${AXIS_TO_FEATURE[axis] ?? axis} 중심`
  );

  if (painMode === 'protected' || painMode === 'caution') {
    principles.push('통증 없는 범위에서 강도와 범위를 보수적으로 시작');
  } else if (focusTags?.[0]) {
    principles.push(`${labelFocusTag(focusTags[0])} 같은 기본 연결부터 함께 정리`);
  }

  const chips = topAxes.map((axis) => AXIS_TO_FEATURE[axis] ?? axis).filter(Boolean);
  const conservativeNote =
    painMode === 'protected' || painMode === 'caution'
      ? '초반 강도는 보수적으로 설정됩니다'
      : undefined;
  const note =
    painMode === 'protected'
      ? '불편감이 강하면 강도보다 안정적인 연결을 먼저 회복해요.'
      : painMode === 'caution'
        ? '불편감이 올라오지 않도록 깊이와 속도를 천천히 맞춰 진행해요.'
        : undefined;

  return {
    headline,
    principles: [...new Set(principles)].slice(0, 3),
    chips: [...new Set(chips)].slice(0, 4),
    conservativeNote,
    note,
  };
}

export function buildBriefSessionRationale(
  priorityVector?: Record<string, number> | null,
  painMode?: 'none' | 'caution' | 'protected' | null,
  focusTags?: string[]
): BriefSessionRationale | null {
  const narrative = getV3PrescriptionNarrative(priorityVector, painMode, focusTags);
  if (!narrative) return null;

  const goal = narrative.sessionGoals[0] ?? '움직임 정리';
  const headline = `이번 세션은 ${goal}을 먼저 정리하는 흐름이에요.`;

  if (painMode === 'protected') {
    return {
      headline,
      detail: '오늘은 강도보다 편안한 범위와 안정적인 연결을 우선합니다.',
    };
  }
  if (painMode === 'caution') {
    return {
      headline,
      detail: '불편감이 올라오지 않도록 강도와 범위를 보수적으로 맞춰 진행해요.',
    };
  }
  return {
    headline,
    detail: `${narrative.expectedFeeling}을 느끼기 쉽게 순서를 구성했어요.`,
  };
}
