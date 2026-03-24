/**
 * PR-V2-06 — Public Result 표시 레이블 SSOT
 *
 * Deep Result V2 어휘 → 한국어 UI 레이블 매핑.
 * 이 파일이 baseline/refined/future-loaded 모든 공개 결과 표면의 레이블 SSOT다.
 *
 * ⚠️ 이 파일에 동물 이름(kangaroo, hedgehog 등)을 headline label로 추가 금지.
 * PR-BASELINE-COPY-REWRITE-06 / PR-BASELINE-TYPE-UI-AND-COPY-07:
 * 사용자 대면 카피는 실행 직전 이해 톤(비진단·비내부용어). Step1 슬롯은 07 정본.
 *
 * @see src/lib/result/deep-result-v2-contract.ts (타입 SSOT)
 */

import type {
  EvidenceLevel,
  SourceMode,
  UnifiedPrimaryType,
} from '@/lib/result/deep-result-v2-contract';

// ─── PR-RESULT-EXPLANATION-UPGRADE-01 — 이유 기반 보조 설명 (표현 전용) ─
// PR-RESULT-EXPLANATION-COVERAGE-02 — reason/missing 카피·선택 우선순위 보강 (표현 전용)
// 계약/스코어링 불변. 숫자·벡터·raw 코드 노출 금지.

// ─── Primary Type ─────────────────────────────────────────────────────────────

/**
 * UnifiedPrimaryType → 사용자에게 보여줄 타입 이름(짧은 호칭, 표현 전용).
 * 폴백·로깅·DISPLAY_NAMES 미적용 시에도 동일 톤 유지.
 */
/** PR-BASELINE-STEP-IA-09 — 사용자 대면 타입 호칭(6형 + UNKNOWN 안내) */
export const PRIMARY_TYPE_LABELS: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체 불안정형',
  LOWER_MOBILITY_RESTRICTION: '하체 경직형',
  UPPER_IMMOBILITY:           '상체 긴장형',
  CORE_CONTROL_DEFICIT:       '중심 흐트러짐형',
  DECONDITIONED:              '전신 무거움형',
  STABLE:                     '균형형',
  UNKNOWN:                    '가볍게 확인하며 시작해요',
};

/**
 * UnifiedPrimaryType → Step1 히어로 큰 글씨(행동 한 줄, 표현 전용).
 */
export const PRIMARY_TYPE_DISPLAY_NAMES: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체 균형을 먼저 잡아요',
  LOWER_MOBILITY_RESTRICTION: '굳은 하체를 먼저 풀어요',
  UPPER_IMMOBILITY:           '목·어깨 긴장을 먼저 풀어요',
  CORE_CONTROL_DEFICIT:       '몸통 중심을 먼저 이어요',
  DECONDITIONED:              '천천히 컨디션을 올려가요',
  STABLE:                     '지금 균형을 유지해요',
  UNKNOWN:                    '가볍게 확인하며 시작해요',
};

/**
 * UnifiedPrimaryType → Step 1 메인 해석 블록(실행 직전 이해, 비보고서 톤).
 */
export const PRIMARY_TYPE_BRIEF: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:
    '힘이 부족해서가 아니라, 서 있거나 걸을 때 하체가 먼저 버티거나 흔들리기 쉬운 상태예요. 더 세게 밀기 전에 무릎·발목이 덜 지치게 균형을 잡는 쪽이 먼저예요.',
  LOWER_MOBILITY_RESTRICTION:
    '발목·골반 주변이 굳게 느껴질 수 있어요. 깊이부터 억지로 내기보다, 먼저 부드럽게 움직일 수 있는 범위를 넓혀 보는 게 좋아요.',
  UPPER_IMMOBILITY:
    '목·어깨·앞가슴이 자주 당겨져 있을 수 있어요. 자세를 억지로 펴려 하기보다, 숨과 함께 가볍게 풀어 주는 게 먼저예요.',
  CORE_CONTROL_DEFICIT:
    '숨이 얕아지거나 허리·배만 바짝 쓰는 느낌이 쉽게 올 수 있어요. 더 세게 조이기보다, 숨과 몸통이 자연스럽게 이어지게 만드는 쪽이 먼저예요.',
  DECONDITIONED:
    '운동이나 일상이 한동안 끊겼거나, 여러 곳이 동시에 무겁게 느껴질 수 있어요. 한 번에 다 잡으려 하지 말고, 짧고 가볍게 몸의 리듬부터 되찾는 게 좋아요.',
  STABLE:
    '전반적으로 움직임 균형이 괜찮은 편이에요. 지금 리듬을 유지하면서, 조금씩만 발전시키면 충분해요.',
  UNKNOWN:
    '아직 방향을 단정하기엔 정보가 부족해요. 불편 없는 범위에서 가볍게 움직이며, 내 몸의 반응을 살피는 것부터 시작해요.',
};

/** UnifiedPrimaryType → accent 색상 */
export const PRIMARY_TYPE_COLOR: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '#60a5fa',
  LOWER_MOBILITY_RESTRICTION: '#34d399',
  UPPER_IMMOBILITY:           '#a78bfa',
  CORE_CONTROL_DEFICIT:       '#f97316',
  DECONDITIONED:              '#fb923c',
  STABLE:                     '#4ade80',
  UNKNOWN:                    '#94a3b8',
};

// ─── PR-BASELINE-STEP1-FINAL-COPY-11 — Step1 본문·타입명 확정(6형 문단, UNKNOWN 별도) ─
// Step3 슬롯(pattern/today/reset)은 그대로.

/** Step1 맨 위 한 줄(스테이지 eyebrow 제거 후 고정) */
export const BASELINE_STEP1_HERO_OVERLINE = '당신의 움직임 타입';

export type BaselineStep1ResultSlots = {
  typeName: string;
  /** Step1 본문: 6형은 확정 문단(보통 1블록), UNKNOWN은 짧은 안내 2~3줄 */
  heroCoreLines: readonly string[];
  patternToWatch: string;
  todayCaution: string;
  firstResetDirection: string;
};

export const BASELINE_STEP1_RESULT_SLOTS: Record<UnifiedPrimaryType, BaselineStep1ResultSlots> = {
  LOWER_INSTABILITY: {
    typeName: PRIMARY_TYPE_LABELS.LOWER_INSTABILITY,
    heroCoreLines: [
      '당신의 움직임 타입은 오래 앉아 있거나, 한쪽 다리에 기대 서 있거나, 준비 없이 갑자기 일어나 움직이는 습관에서 비롯되었을 수 있습니다. 이런 패턴이 쌓이면 엉덩이와 몸통이 함께 중심을 잡기보다 무릎과 발목이 먼저 버티는 방식이 익숙해지기 쉽습니다. 그래서 쪼그려 앉았다 일어나거나 계단을 오르내릴 때 중심이 한쪽으로 쏠리거나 하체가 흔들리는 느낌이 먼저 나타날 수 있습니다. 지금은 발바닥·발목·엉덩이가 함께 체중을 받쳐주는 감각을 다시 만드는 것이 중요합니다.',
    ],
    patternToWatch: '한쪽 다리에 기대거나 내려앉을 때 무릎이 안쪽으로 모이기 쉬워요.',
    todayCaution:
      '무거운 중량·점프부터 시작하지 말고, 양발에 체중을 고르게 싣는 감각부터 확인해 보세요.',
    firstResetDirection: '하체에 힘을 몰기보다 발목·고관절을 풀고 중심을 다시 잡는 방향으로 시작해요.',
  },
  LOWER_MOBILITY_RESTRICTION: {
    typeName: PRIMARY_TYPE_LABELS.LOWER_MOBILITY_RESTRICTION,
    heroCoreLines: [
      '당신의 움직임 타입은 오래 앉아 있는 시간, 걷는 양이 줄어든 생활, 그리고 발목과 골반을 충분히 접고 펴지 않는 습관에서 비롯되었을 수 있습니다. 이런 생활이 이어지면 발목과 고관절이 부드럽게 움직이기보다 점점 굳고, 그 부족한 움직임을 허리나 무릎이 대신 메우는 패턴이 생기기 쉽습니다. 그래서 낮은 곳에 앉거나 물건을 집으려고 숙일 때 하체가 잘 접히지 않고, 허리나 무릎이 먼저 불편하게 느껴질 수 있습니다. 지금은 깊게 내려가려 하기보다 발목과 고관절이 자연스럽게 움직이는 길을 다시 열어주는 것이 먼저입니다.',
    ],
    patternToWatch:
      '스쿼트나 런지에서 깊이가 잘 안 나오고, 앉았다 일어날 때 하체가 뻣뻣하게 느껴질 수 있어요.',
    todayCaution: '오래 앉아 있었다면 바로 깊은 동작부터 하지 말고, 짧게 풀어준 뒤 시작해 보세요.',
    firstResetDirection: '깊이를 억지로 늘리기보다 발목·고관절 움직임을 부드럽게 여는 방향으로 시작해요.',
  },
  UPPER_IMMOBILITY: {
    typeName: PRIMARY_TYPE_LABELS.UPPER_IMMOBILITY,
    heroCoreLines: [
      '당신의 움직임 타입은 컴퓨터나 스마트폰을 오래 보는 자세, 고개를 앞으로 내민 습관, 그리고 가슴 위쪽으로 짧게 숨 쉬는 패턴에서 비롯되었을 수 있습니다. 이런 상태가 계속되면 목과 어깨 앞쪽, 가슴 주변이 먼저 굳고, 등과 견갑은 부드럽게 움직이지 못한 채 상체 전체가 긴장으로 버티게 됩니다. 그래서 팔을 들거나 옷을 갈아입고 머리를 감을 때 어깨가 먼저 답답하고, 오래 앉아 있을수록 목과 어깨가 쉽게 무거워질 수 있습니다. 지금은 자세를 억지로 세우기보다 숨을 편하게 만들고, 가슴·등·어깨가 함께 움직이도록 긴장을 먼저 풀어주는 것이 중요합니다.',
    ],
    patternToWatch: '팔을 올릴 때 어깨가 먼저 답답하고, 오래 앉아 있으면 목과 어깨가 쉽게 무거워져요.',
    todayCaution:
      '어깨를 억지로 내리거나 강하게 스트레칭하기보다, 숨을 내쉬며 상체 긴장을 먼저 줄여보세요.',
    firstResetDirection: '자세 교정보다 호흡과 함께 목·어깨·흉추를 풀어주는 방향으로 시작해요.',
  },
  CORE_CONTROL_DEFICIT: {
    typeName: PRIMARY_TYPE_LABELS.CORE_CONTROL_DEFICIT,
    heroCoreLines: [
      '당신의 움직임 타입은 오래 앉아 있는 생활, 몸통 전체보다 허리만 세워 버티는 습관, 그리고 숨을 편하게 쉬기보다 배나 허리를 먼저 조이는 패턴에서 비롯되었을 수 있습니다. 이런 상태가 반복되면 배·갈비·골반이 함께 중심을 잡기보다 허리와 골반이 먼저 긴장해 몸통을 대신 지탱하는 방식이 굳어지기 쉽습니다. 그래서 허리를 숙이거나 방향을 바꿀 때 몸통이 부드럽게 이어지기보다 허리와 골반이 먼저 뻣뻣해지고, 움직일수록 허리가 더 힘들게 느껴질 수 있습니다. 지금은 배에 힘을 더 주는 것보다, 호흡과 함께 몸통 중심이 자연스럽게 연결되도록 다시 정리하는 것이 먼저입니다.',
    ],
    patternToWatch: '허리나 골반이 먼저 버티고, 움직일수록 몸통보다 허리에 힘이 몰리기 쉬워요.',
    todayCaution:
      '숨을 참은 채 버티는 운동부터 몰아 하지 말고, 편하게 내쉬며 중심 감각부터 확인해 보세요.',
    firstResetDirection: '강한 복근만 반복하기보다 호흡·골반·갈비를 다시 연결하는 방향으로 시작해요.',
  },
  DECONDITIONED: {
    typeName: PRIMARY_TYPE_LABELS.DECONDITIONED,
    heroCoreLines: [
      '당신의 움직임 타입은 운동 공백이 길었거나, 수면과 회복이 불규칙하고, 활동량이 들쭉날쭉한 생활 패턴에서 비롯되었을 수 있습니다. 이런 흐름이 이어지면 특정 한 부위보다 몸 전체가 쉽게 무겁고 둔하게 느껴지고, 움직임을 시작할 때 필요한 기본 리듬이 떨어지기 쉽습니다. 그래서 조금만 움직여도 여러 부위가 함께 피곤해지거나, 잠깐 괜찮다가도 금방 지치면서 자세가 전체적으로 흐트러질 수 있습니다. 지금은 한 부위를 집중해서 바꾸기보다 몸 전체가 다시 가볍게 움직일 수 있는 기본 체력과 회복 리듬을 되찾는 것이 중요합니다.',
    ],
    patternToWatch:
      '여러 부위가 함께 무겁게 느껴지거나, 쉬었다가 다시 시작할 때 피로가 크게 올라오기 쉬워요.',
    todayCaution: '예전 강도로 바로 돌아가려 하지 말고, 짧게 끝까지 해내는 흐름을 먼저 만들어 보세요.',
    firstResetDirection: '강도보다 꾸준함을 우선하고, 전신을 가볍게 깨우는 방향으로 시작해요.',
  },
  STABLE: {
    typeName: PRIMARY_TYPE_LABELS.STABLE,
    heroCoreLines: [
      '당신의 움직임 타입은 현재 몸의 큰 흐름이 비교적 잘 정리되어 있고, 한 부위가 과하게 무너져 전체 움직임을 끌고 가는 패턴은 크지 않은 상태에 가깝습니다. 다만 이것이 항상 같은 상태로 유지된다는 뜻은 아니며, 수면 부족이나 피로, 스트레스가 쌓이면 몸의 균형도 생각보다 쉽게 흔들릴 수 있습니다. 그래서 평소에는 편하게 움직여도 컨디션이 떨어진 날에는 특정 부위가 먼저 뻣뻣해지거나 힘이 몰리는 변화가 나타날 수 있습니다. 지금은 크게 고치기보다 이 균형을 유지하면서 몸 상태에 맞춰 강도와 회복을 조절하는 방식이 가장 잘 맞습니다.',
    ],
    patternToWatch:
      '큰 불균형보다는 수면·스트레스·피로에 따라 컨디션이 흔들릴 때 운동 감각이 달라질 수 있어요.',
    todayCaution: '괜찮은 날에도 강도를 한 번에 올리지 말고, 몸 상태를 보며 조금씩 조절해 보세요.',
    firstResetDirection: '지금 균형을 유지하면서 전신 리듬과 회복을 함께 챙기는 방향으로 시작해요.',
  },
  UNKNOWN: {
    typeName: PRIMARY_TYPE_LABELS.UNKNOWN,
    heroCoreLines: [
      '지금은 정보가 부족해 한 가지 타입으로 딱 자르기 어려워요. 불편 없는 범위에서 가볍게 움직이며 반응만 보면 돼요.',
      '오늘은 짧게 끝내고, 내일 이어서 조정해도 괜찮아요.',
      '깊게 해석하려 하기보다, 오늘 느낀 범위만 기억해 두면 다음에 더 맞출 수 있어요.',
    ],
    patternToWatch: '한꺼번에 깊게 해석하려 하기보다, 조금씩 몸의 느낌을 쌓아가는 편이 좋아요.',
    todayCaution: '오늘은 짧게 끝내는 것만 목표로 잡아도 충분해요.',
    firstResetDirection: '편한 범위에서 호흡과 가벼운 움직임으로 몸을 깨우는 방향으로 시작해요.',
  },
};

export function getBaselineStep1ResultSlots(pt: UnifiedPrimaryType): BaselineStep1ResultSlots {
  return BASELINE_STEP1_RESULT_SLOTS[pt];
}

/** Step2 요약 카드(제목 고정 + 타입별 짧은 본문). 동적 reason/보조는 3번째 카드에 합성. */
export type ResultMiniCard = { title: string; body: string };

const BASELINE_STEP2_CARD_TITLES = [
  '몸이 먼저 반응하기 쉬운 부위',
  '자주 나타나는 보상 움직임',
  '함께 겹쳐 보이기 쉬운 경향',
] as const;

export const BASELINE_STEP2_CARD_BODIES: Record<
  UnifiedPrimaryType,
  readonly [string, string, string]
> = {
  LOWER_INSTABILITY: [
    '서 있거나 걸을 때 다리·발목이 먼저 긴장하기 쉬워요.',
    '한쪽으로 체중이 기우는 느낌, 무릎이 안으로 모이려는 움직임이 자주 붙어요.',
    '하체 쪽 신호가 여러 갈래로 겹쳐 읽힐 수 있어요.',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '발목·엉덩이 주변이 먼저 뻣뻣하게 느껴지기 쉬워요.',
    '깊게 앉기 전에 몸이 먼저 버티려 하거나 범위를 줄이려 해요.',
    '가동성과 안정 신호가 함께 겹쳐 보일 수 있어요.',
  ],
  UPPER_IMMOBILITY: [
    '목·어깨·앞가슴이 먼저 당겨지거나 뭉치기 쉬워요.',
    '팔을 올릴 때 어깨만 먼저 올라가거나 턱을 내밀기 쉬워요.',
    '상체 쪽 신호가 겹쳐 읽힐 수 있어요.',
  ],
  CORE_CONTROL_DEFICIT: [
    '숨이 얕아지거나 배·허리가 먼저 조여지기 쉬워요.',
    '움직일수록 몸통보다 허리에 힘이 먼저 실리려 해요.',
    '체간 조절과 다른 축이 함께 겹쳐 보일 수 있어요.',
  ],
  DECONDITIONED: [
    '여러 부위가 동시에 무겁게 느껴지는 날이 있어요.',
    '한 번에 세게 하려는 순간이 오기 쉬워요.',
    '전신 컨디션 신호가 한꺼번에 올라와 보일 수 있어요.',
  ],
  STABLE: [
    '전반적으로 움직임은 무난한 편이에요.',
    '그날 컨디션에 따라 감각만 달라질 수 있어요.',
    '큰 부담 신호 없이 균형 쪽으로 정리돼 보일 수 있어요.',
  ],
  UNKNOWN: [
    '아직 어디가 먼저인지 한 줄로 고정하기 어려워요.',
    '가볍게 움직이며 반응을 살피는 게 먼저예요.',
    '정보가 더 쌓이면 시작점을 더 맞출 수 있어요.',
  ],
};

/**
 * Step2 카드 3장. 보조 경향 문장·reason 불릿이 있으면 3번째 카드 본문을 그쪽으로 대체(중복 최소화).
 */
export function buildBaselineStep2Cards(
  pt: UnifiedPrimaryType,
  reasonInsightLines: string[],
  secondaryTendencyLine: string | null
): ResultMiniCard[] {
  const bodies = BASELINE_STEP2_CARD_BODIES[pt];
  const titles = BASELINE_STEP2_CARD_TITLES;
  const cards: ResultMiniCard[] = titles.map((title, i) => ({ title, body: bodies[i] }));

  const dynamicParts: string[] = [];
  if (secondaryTendencyLine) dynamicParts.push(secondaryTendencyLine);
  for (const line of reasonInsightLines.slice(0, 2)) {
    if (line?.trim()) dynamicParts.push(line.trim());
  }
  if (dynamicParts.length > 0) {
    cards[2] = { title: titles[2], body: dynamicParts.join(' ') };
  }
  return cards;
}

// ─── Evidence & Stage ────────────────────────────────────────────────────────

/** evidence_level → 배지 레이블 */
export const EVIDENCE_LEVEL_LABELS: Record<string, string> = {
  lite:    '기초 분석',
  partial: '부분 분석',
  full:    '정밀 분석',
};

/** camera evidence quality → 배지 레이블 */
export const CAMERA_QUALITY_LABELS: Record<string, string> = {
  strong:  '동작 분석 확인',
  partial: '동작 분석 일부',
  minimal: '신호 제한적',
};

// ─── Axis ─────────────────────────────────────────────────────────────────────

/** priority_vector 축 → 한국어 레이블 */
export const AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정성',
  lower_mobility:  '하체 가동성',
  upper_mobility:  '상체 가동성',
  trunk_control:   '체간 조절',
  asymmetry:       '좌우 균형',
  deconditioned:   '전신 조건화',
};

// ─── Reason Codes ────────────────────────────────────────────────────────────

/** reason_code → 간략 설명 */
export const REASON_CODE_LABELS: Record<string, string> = {
  top_axis_lower_stability:       '하체 안정성 신호 강함',
  top_axis_lower_mobility:        '하체 가동성 제한 신호',
  top_axis_upper_mobility:        '상체 가동성 제한 신호',
  top_axis_trunk_control:         '체간 조절 신호 강함',
  top_axis_asymmetry:             '좌우 비대칭 신호',
  secondary_axis_lower_stability: '하체 안정성 보조 신호',
  secondary_axis_lower_mobility:  '하체 가동성 보조 신호',
  secondary_axis_upper_mobility:  '상체 가동성 보조 신호',
  secondary_axis_trunk_control:   '체간 조절 보조 신호',
  secondary_axis_asymmetry:       '비대칭 보조 신호',
  stable_gate:                    '균형형 판정',
  deconditioned_gate:             '복합 패턴 판정',
  asymmetry_detected:             '좌우 비대칭 감지',
  lumbar_dominant_pattern:        '허리 주도 패턴',
  thoracic_closure_pattern:       '흉추 닫힘 패턴',
  lateral_imbalance_pattern:      '측면 불균형 패턴',
  anterior_head_pattern:          '경추 전방화 패턴',
  ankle_mobility_restriction:     '발목 가동성 제한',
  global_bracing_pattern:         '전신 긴장 패턴',
  balanced_movement_pattern:      '균형 움직임 패턴',
  composite_pattern:              '복합 패턴 감지',
  camera_evidence_partial:        '카메라 일부 신호 기반',
  pain_protected_mode:            '통증 보호 모드 반영',
  pain_caution_mode:              '통증 주의 신호 반영',
};

/**
 * reason_code → 분석 근거를 사람 말로 풀어 쓴 짧은 문장 (Step 2 보조 불릿용).
 * REASON_CODE_LABELS(짧은 라벨)보다 한 줄 설명에 가깝게 — 중복 키는 동일 의미로 유지.
 */
export const REASON_CODE_INSIGHT_PHRASES: Record<string, string> = {
  top_axis_lower_stability:
    '정리해 보면 하체 쪽 안정성 신호가 가장 앞에 서 있어요.',
  top_axis_lower_mobility:
    '하체 가동 범위 쪽 신호가 먼저 눈에 띄는 편이에요.',
  top_axis_upper_mobility:
    '상체·어깨 쪽 가동성 신호가 두드러져요.',
  top_axis_trunk_control:
    '허리·골반 주변 ‘조절’ 쪽 신호가 강하게 잡혀요.',
  top_axis_asymmetry:
    '이번 판정에서 좌우 균형 차이가 가장 앞에 서 있어요.',
  secondary_axis_lower_stability: '하체 안정성 쪽 보조 신호도 겹쳐 보여요.',
  secondary_axis_lower_mobility: '하체 가동성 쪽 보조 신호도 겹쳐 보여요.',
  secondary_axis_upper_mobility: '상체 가동성 쪽 보조 신호도 겹쳐 보여요.',
  secondary_axis_trunk_control: '체간 조절 쪽 보조 신호도 겹쳐 보여요.',
  secondary_axis_asymmetry: '비대칭 쪽 보조 신호도 겹쳐 보여요.',
  stable_gate: '큰 부담 신호 없이 균형형에 가깝게 묶이는 판정이에요.',
  deconditioned_gate: '여러 축이 동시에 올라와 복합적으로 읽혀요.',
  asymmetry_detected: '좌우 차이는 다른 축과 함께 덧붙여 읽혔어요.',
  pain_protected_mode: '통증이 강하게 잡혀서 보호 쪽으로 안전하게 묶었어요.',
  pain_caution_mode: '통증 신호가 있어서 무리하지 않게 짚는 쪽으로 맞췄어요.',
  composite_pattern: '한 가지 축만이 아니라 겹치는 패턴으로 읽혀요.',
  camera_evidence_partial: '동작 영상에서는 일부 구간만 또렷해서, 그 범위 안에서 보완했어요.',
  balanced_movement_pattern: '전반적인 움직임 균형 쪽으로 정리돼요.',
};

/** reason_codes 정렬 시 우선 노출할 코드(앞쪽일수록 먼저). */
const REASON_INSIGHT_PRIORITY: string[] = [
  'pain_protected_mode',
  'pain_caution_mode',
  'top_axis_lower_stability',
  'top_axis_lower_mobility',
  'top_axis_upper_mobility',
  'top_axis_trunk_control',
  'top_axis_asymmetry',
  'stable_gate',
  'deconditioned_gate',
  'asymmetry_detected',
  'composite_pattern',
  'lumbar_dominant_pattern',
  'thoracic_closure_pattern',
  'lateral_imbalance_pattern',
  'anterior_head_pattern',
  'ankle_mobility_restriction',
  'global_bracing_pattern',
  'balanced_movement_pattern',
  'secondary_axis_lower_stability',
  'secondary_axis_lower_mobility',
  'secondary_axis_upper_mobility',
  'secondary_axis_trunk_control',
  'secondary_axis_asymmetry',
  'camera_evidence_partial',
];

function priorityIndex(code: string): number {
  const i = REASON_INSIGHT_PRIORITY.indexOf(code);
  return i === -1 ? 999 : i;
}

/** 동작 refine 직전·직후 비교를 반영한 코드(baseline_was_*)가 있는지 */
export function hasBaselineShiftReason(reasonCodes: readonly string[]): boolean {
  return reasonCodes.some((c) => c.startsWith('baseline_was_'));
}

/**
 * Step 2: 분석 근거에서 짧은 불릿 1~2개(사람이 읽기 좋은 문장).
 * raw reason_code 문자열은 화면에 찍지 않는다.
 */
export function pickReasonInsightBullets(
  reasonCodes: readonly string[],
  max = 2
): string[] {
  const seen = new Set<string>();
  const ordered = [...reasonCodes].filter((c) => !c.startsWith('baseline_was_'));
  ordered.sort((a, b) => priorityIndex(a) - priorityIndex(b));

  const out: string[] = [];
  for (const code of ordered) {
    const phrase = REASON_CODE_INSIGHT_PHRASES[code] ?? REASON_CODE_LABELS[code];
    if (!phrase || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Step 2(refined): 타입이 바뀌었을 때만 쓰는 한 줄 — 디버그 느낌 나지 않게 일반화.
 */
export function buildRefinementShiftSupportLine(
  reasonCodes: readonly string[],
  stage: 'baseline' | 'refined' | 'fallback'
): string | null {
  if (stage !== 'refined' || !hasBaselineShiftReason(reasonCodes)) return null;
  return '짧은 동작 체크를 더하면서, 처음 설문만으로 보이던 경향과 겹치는 부분을 다시 맞춰 봤어요.';
}

/** 보조 경향 문장에서 쓸 짧은 명사 (PRIMARY_TYPE_LABELS 직접 노출 방지) */
const SECONDARY_TENDENCY_NOUNS: Partial<Record<UnifiedPrimaryType, string>> = {
  LOWER_INSTABILITY:          '하체 쪽',
  LOWER_MOBILITY_RESTRICTION: '하체 가동',
  UPPER_IMMOBILITY:           '상체 쪽',
  CORE_CONTROL_DEFICIT:       '몸통 중심',
  DECONDITIONED:              '전반 컨디션',
  STABLE:                     '균형 쪽',
  UNKNOWN:                    '다른 쪽 움직임',
};

/**
 * Step 1: 보조 패턴을 라벨 나열 대신 한 문장으로 (primary_type은 이미 제목에 있음).
 */
export function buildSecondaryTendencySentence(
  secondary: UnifiedPrimaryType | null | undefined,
  primary: UnifiedPrimaryType
): string | null {
  if (secondary == null || secondary === primary) return null;
  const noun = SECONDARY_TENDENCY_NOUNS[secondary] ?? PRIMARY_TYPE_LABELS[secondary] ?? String(secondary);
  return `${noun} 쪽 경향도 함께 겹쳐 보여요.`;
}

/**
 * 헤더 우측 한 줄: 출처·정밀도 느낌만 살짝 (숫자·배지 과다 금지).
 */
export function buildPublicResultHeaderHint(params: {
  stage: 'baseline' | 'refined' | 'fallback';
  cameraEvidenceQuality?: 'strong' | 'partial' | 'minimal';
  sourceMode: SourceMode;
  evidenceLevel: EvidenceLevel;
}): string {
  const { stage, cameraEvidenceQuality, sourceMode, evidenceLevel } = params;
  if (stage === 'fallback') return '설문 기준 안내';

  if (stage === 'baseline') {
    return evidenceLevel === 'lite' ? '설문 기초 분석 · 시작점' : '설문 분석 · 시작점';
  }

  if (sourceMode === 'camera') {
    if (cameraEvidenceQuality === 'partial') return '설문+동작(일부) · 조정';
    return '설문+동작 반영 · 조정';
  }
  return '설문+동작 반영';
}

/**
 * missing_signals 중 1개만, 가벼운 안내(선택).
 * PR-RESULT-EXPLANATION-COVERAGE-02: 배열 앞 순서가 아니라 공개 흐름에 의미 있는 우선순위로 뽑아요.
 */
const MISSING_HINT_PRIORITY: readonly string[] = [
  'camera_evidence_partial',
  'camera_evidence_minimal',
  'objective_movement_test_missing',
  'subjective_fatigue_missing',
  'pain_intensity_missing',
  'pain_location_missing',
];

export function pickLightMissingHintLine(signals: readonly string[]): string | null {
  const displayable = filterDisplayableMissingSignals([...signals]);
  if (displayable.length === 0) return null;
  const present = new Set(displayable);
  for (const key of MISSING_HINT_PRIORITY) {
    if (!present.has(key)) continue;
    if (key === 'camera_evidence_partial') {
      return '동작 영상 신호가 일부만 또렷해서, 그 범위 안에서 정리했어요.';
    }
    if (key === 'camera_evidence_minimal') {
      return '동작 영상 신호가 매우 제한적이라, 설문 쪽 비중을 더 두고 정리했어요.';
    }
    if (key === 'objective_movement_test_missing') {
      return '객관 동작 측정은 다음에 더 붙이면 시작점을 더 맞출 수 있어요.';
    }
    if (key === 'subjective_fatigue_missing') {
      return '피로·컨디션 정보는 아직 없어요. 나중에 맞추면 더 안전해져요.';
    }
    if (key === 'pain_intensity_missing' || key === 'pain_location_missing') {
      return '통증 정보는 아직 넣지 않았어요. 나중에 더하면 보호에 맞출 수 있어요.';
    }
  }
  return null;
}

/** Step 3: 순서 제안이 왜 맞는지 한 줄 (타입 기반, 실행 연결) */
export const STEP3_ORDER_FIT_BY_PRIMARY: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:
    '오늘은 몸을 풀고 → 범위를 열고 → 그다음에 움직임을 붙이는 순서가 하체 균형에 잘 맞아요.',
  LOWER_MOBILITY_RESTRICTION:
    '굳은 하체는 깊이부터 밀기보다, 먼저 가볍게 깨운 뒤에 움직임을 얹는 순서가 편해요.',
  UPPER_IMMOBILITY:
    '목·어깨는 숨과 함께 먼저 풀어 주고, 그다음에 팔 움직임을 붙이는 순서가 부담이 적어요.',
  CORE_CONTROL_DEFICIT:
    '호흡과 몸통이 먼저 이어지면, 그 위에 동작을 올리기가 훨씬 수월해요.',
  DECONDITIONED:
    '짧게 돌고 쉬고, 다음 날 컨디션을 보며 이어가는 순서가 다시 시작하기에 잘 맞아요.',
  STABLE:
    '지금 컨디션을 해치지 않는 선에서, 순환·유지를 이어가는 순서가 잘 맞아요.',
  UNKNOWN:
    '불편 없는 범위에서 짧게 확인하고, 반응을 보며 이어가는 순서가 좋아요.',
};

/**
 * Step 2: 일상 조심 항목과 오늘의 시작점을 잇는 한 줄.
 */
export const CAREFUL_FIT_BY_PRIMARY: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:
    '이건 하체에 부담이 한꺼번에 몰리지 않게, 먼저 편하게 가져가려는 안내예요.',
  LOWER_MOBILITY_RESTRICTION:
    '이건 움직임이 묶였을 때 무리한 범위·강도를 피하려는 안내예요.',
  UPPER_IMMOBILITY:
    '이건 목·어깨에 쌓이기 쉬운 습관을 줄이려는 안내예요.',
  CORE_CONTROL_DEFICIT:
    '이건 숨을 참거나 허리만 버티는 습관을 덜 만들려는 안내예요.',
  DECONDITIONED:
    '이건 여러 부위에 부담이 동시에 올라가지 않게 나누려는 안내예요.',
  STABLE:
    '이건 괜찮은 날에도 강도를 한 번에 올리지 않게 완충하려는 안내예요.',
  UNKNOWN:
    '이건 아직 방향이 불명확할 때 무리한 시도를 줄이려는 안내예요.',
};

// ─── Missing Signals ──────────────────────────────────────────────────────────

/** missing_signal → 한국어 안내 문구 */
export const MISSING_SIGNAL_LABELS: Record<string, string> = {
  pain_intensity_missing:              '통증 강도 정보 (유료 딥테스트에서 측정)',
  pain_location_missing:               '통증 위치 정보 (유료 딥테스트에서 측정)',
  objective_movement_test_missing:     '객관 동작 테스트 (카메라 분석에서 측정)',
  camera_evidence_partial:             '카메라 신호 일부 제한 (재촬영 시 개선 가능)',
  camera_evidence_minimal:             '동작 영상 신호 매우 제한 (재시도 시 개선 가능)',
  subjective_fatigue_missing:          '주관적 피로도 (설문 항목에 없음)',
};

/** missing_signals 목록에서 UI에 표시할 항목만 필터링 */
export function filterDisplayableMissingSignals(signals: string[]): string[] {
  return signals.filter(
    (s) =>
      !s.includes('_empty') &&
      !s.includes('_step_') &&
      s in MISSING_SIGNAL_LABELS
  );
}

// ─── PR-RESULT-IA-03 — 2~3단 액션 지향 결과 (presentation 전용, 계약 필드 의미 불변) ─

/** 화면 1: 짧은 패턴 불릿 3개 (현재 Step1 미연결 시에도 SSOT 정합) */
export const PRIMARY_TYPE_SCREEN1_BULLETS: Record<UnifiedPrimaryType, readonly [string, string, string]> = {
  LOWER_INSTABILITY: [
    '서 있거나 걸을 때 하체가 먼저 버티는 느낌이 들 수 있어요',
    '무릎·발목이 안쪽으로 모이기 쉬운 날이 있어요',
    '계단·오래 서 있기 후 하체가 빨리 지칠 수 있어요',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '앉았다 일어날 때 하체가 뻐근할 수 있어요',
    '발목·엉덩이 주변이 굳게 느껴질 수 있어요',
    '깊게 앉거나 굽히는 동작이 처음부터 잘 안 나올 수 있어요',
  ],
  UPPER_IMMOBILITY: [
    '목·어깨가 자주 당겨지거나 뭉치기 쉬워요',
    '팔을 올릴 때 어깨만 먼저 올라가는 느낌이 들 수 있어요',
    '모니터·휴대폰을 오래 본 뒤 상체가 무겁게 느껴져요',
  ],
  CORE_CONTROL_DEFICIT: [
    '숨이 얕아지거나 참는 순간이 잦을 수 있어요',
    '앉을 때 허리·배만 바짝 쓰는 느낌이 들 수 있어요',
    '움직일 때 몸통이 한 덩어리로 안 움직이는 느낌이 들 수 있어요',
  ],
  DECONDITIONED: [
    '여러 곳이 동시에 무겁게 느껴지는 날이 있어요',
    '운동을 쉬었다 다시 시작할 때 숨이 많이 차요',
    '한 번에 세게 하면 다음 날 피로가 남기 쉬워요',
  ],
  STABLE: [
    '전반적으로 움직임이 무난한 편이에요',
    '수면·스트레스에 따라 그날 컨디션은 달라져요',
    '지금 리듬을 유지하며 조금씩만 키우면 돼요',
  ],
  UNKNOWN: [
    '아직 내 몸 반응을 더 살보면 좋아요',
    '가벼운 루틴부터 시작해 보세요',
    '불편이 있으면 범위를 줄이고, 필요하면 전문가와 상의하세요',
  ],
};

/** 일상에서 조심하면 좋은 점 (비진단·실행 연결) */
export const PRIMARY_TYPE_CAREFUL_MOVEMENTS: Record<UnifiedPrimaryType, readonly string[]> = {
  LOWER_INSTABILITY: [
    '갑자기 무거운 중량·점프부터 시작하지 않기',
    '무릎이 안쪽으로 말리는 자세를 오래 유지하지 않기',
    '한쪽 다리에만 체중이 쏠리는 동작 반복 줄이기',
    '하체가 피곤한 날은 시간·강도를 한 단계 낮추기',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '오래 앉기 전에 가볍게 자리에서 일어나기',
    '발목·종아리가 뻣뻣할 때 무리한 달리기·깊은 스트레칭 피하기',
    '몸을 덜 풀고 깊은 스쿼트·런지부터 하지 않기',
    '아플 때는 범위를 억지로 넓히지 않기',
  ],
  UPPER_IMMOBILITY: [
    '턱을 오래 앞으로 내밀지 않기',
    '어깨만으로 팔 올리지 않기 — 숨과 함께 가볍게',
    '같은 팔·목 각도로 오래 고정되지 않기',
    '뭉쳤다고 세게 눌러 풀지 않기',
  ],
  CORE_CONTROL_DEFICIT: [
    '배만 조이고 숨 참지 않기',
    '허리만 꺾어 버티는 동작 줄이기',
    '갑자기 강한 복근 운동만 반복하지 않기',
    '피곤한 날 고강도 허리·복근 루틴은 피하기',
  ],
  DECONDITIONED: [
    '한 번에 온몸을 다 자극하려 하지 않기',
    '오랜만에 예전 강도로 바로 돌아가지 않기',
    '다음 날까지 아프면 그날은 쉬거나 가볍게만 하기',
    '일상 활동이 급변할 때 운동량도 같이 맞추기',
  ],
  STABLE: [
    '몸이 무거운 날까지 강도만 올리지 않기',
    '스트레스·수면이 부족한 날은 회복을 먼저 하기',
    '거리·볼륨은 한 번에 크게 늘리지 않기',
    '불편이 생기면 그날은 강도를 낮추기',
  ],
  UNKNOWN: [
    '아프거나 저리면 무리한 스트레칭·운동 피하기',
    '범위를 줄여서 천천히 시도하기',
    '오래 가면 전문가와 상의하기',
    '정보에만 몰두하지 않기',
  ],
};

/** 실행 예시 동작 2가지 */
export const PRIMARY_TYPE_RECOMMENDED_MOVES: Record<UnifiedPrimaryType, readonly [string, string]> = {
  LOWER_INSTABILITY: ['맨몸 미니 스쿼트·힙 힌지(가볍게)', '짧은 한 발 서기·균형 잡기'],
  LOWER_MOBILITY_RESTRICTION: ['발목·엉덩이 가볍게 풀기', '짧은 걷기 후 가벼운 하체 풀기'],
  UPPER_IMMOBILITY: ['벽에 기대 숨 쉬며 팔 올리기', '가볍게 목·어깨 원 그리기'],
  CORE_CONTROL_DEFICIT: ['누워서 복식 호흡·짧은 다리 움직임', '엉덩이·배 함께 쓰는 낮은 브릿지·버드독'],
  DECONDITIONED: ['천천히 걷기·가벼운 자전거', '상체·하체 나눠 짧게 돌리기'],
  STABLE: ['전신 가볍게 순환하기', '호흡·유연성 보조 동작'],
  UNKNOWN: ['가벼운 걷기·워밍업', '불편 없는 범위 관절 풀기'],
};

/** 오늘부터 바꿔볼 습관 3가지 */
export const PRIMARY_TYPE_LIFESTYLE_HABITS: Record<UnifiedPrimaryType, readonly [string, string, string]> = {
  LOWER_INSTABILITY: [
    '일어날 때 천천히 체중 실어주기',
    '계단·달리기 전 1~2분만 몸 풀기',
    '하체 피곤한 날 수면·걸음 수도 같이 보기',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '한 자세로 오래 앉기 전 알람으로 자리 비우기',
    '저녁에 하체 2~3분만 가볍게 풀기',
    '신발·걸음 습관도 가볍게 점검하기',
  ],
  UPPER_IMMOBILITY: [
    '화면 높이·거리 한 번씩 맞추기',
    '30~40분마다 목·어깨만 살짝 풀기',
    '휴대폰만 아래로 보지 않기',
  ],
  CORE_CONTROL_DEFICIT: [
    '앉을 때 발바닥·등받이 작게라도 쓰기',
    '하루에 숨 깊게 쉬는 순간 몇 번 넣기',
    '허리만 쓰지 말고 엉덩이·배 같이 쓰기 연습',
  ],
  DECONDITIONED: [
    '운동·일상을 한 번에 크게 바꾸지 않기',
    '물·수면 챙기기',
    '다음 날까지 남는 피로 없이 오늘은 여기까지',
  ],
  STABLE: [
    '가벼운 활동·수면 리듬 유지하기',
    '바쁜 주에는 강도만 살짝 내리기',
    '그날 몸 느낌 보고 루틴 고르기',
  ],
  UNKNOWN: [
    '불편 없는 범위에서만 움직이기',
    '하루에 습관 하나만 바꿔 보기',
    '오래 가면 전문가와 이야기하기',
  ],
};

/** 시작 순서 예시 3단(몸 풀기 → 범위 → 움직임 붙이기 흐름과 짝) */
export const PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW: Record<UnifiedPrimaryType, readonly [string, string, string]> = {
  LOWER_INSTABILITY: [
    '숨 정리하며 몸 가볍게 깨우기',
    '발목·골반 주변 부드럽게 풀기',
    '짧은 스쿼트·균형으로 마무리',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '호흡과 함께 전신 가볍게 깨우기',
    '발목·엉덩이 천천히 풀기',
    '편한 범위에서 스쿼트·런지 느낌만 잡기',
  ],
  UPPER_IMMOBILITY: [
    '숨과 함께 가슴·어깨 가볍게 깨우기',
    '목·어깨 돌리고 팔 범위 넓히기',
    '팔 올리기·자세는 가볍게만 연결하기',
  ],
  CORE_CONTROL_DEFICIT: [
    '복식 호흡으로 몸통 이어 느끼기',
    '낮은 부하로 몸통·골반 같이 움직이기',
    '일어서기·앉기에 옮겨 쓰기',
  ],
  DECONDITIONED: [
    '짧게 워밍업하고 순환하기',
    '위·아래 나눠 가볍게 돌리기',
    '내일 컨디션 보며 마무리',
  ],
  STABLE: [
    '가볍게 순환 워밍업',
    '전신 밸런스 유지 동작',
    '유연성·호흡으로 정리',
  ],
  UNKNOWN: [
    '가벼운 워밍업',
    '불편 없는 범위 관절 풀기',
    '짧게 마무리 스트레칭',
  ],
};

/** Step1·Step3 공통: 첫 실행 방향 한 줄 */
export const PRIMARY_TYPE_START_HOOK: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY: '오늘은 하체 균형을 먼저 살피는 흐름이 좋아요.',
  LOWER_MOBILITY_RESTRICTION: '오늘은 굳은 하체를 먼저 부드럽게 푸는 흐름이 좋아요.',
  UPPER_IMMOBILITY: '오늘은 목·어깨 긴장을 먼저 풀고 움직임을 붙이는 흐름이 좋아요.',
  CORE_CONTROL_DEFICIT: '오늘은 숨과 몸통 중심을 먼저 이어 주는 흐름이 좋아요.',
  DECONDITIONED: '오늘은 강도보다 짧게·꾸준히, 회복을 같이 보는 흐름이 좋아요.',
  STABLE: '오늘은 지금 리듬을 유지하며 조금씩만 발전시키는 흐름이 좋아요.',
  UNKNOWN: '오늘은 불편 없는 범위에서 가볍게 확인하며 시작하는 흐름이 좋아요.',
};

/**
 * summary_copy에서 괄호로 붙는 메타 문구 제거 (본문만 남김)
 */
export function stripSummaryMetaSuffix(summary: string): string {
  return summary.replace(/\s*[\(（][^)）]*[)）]\s*$/u, '').trim();
}

// ─── PR-CONVERSION-PREVIEW-04 — Step 3 실행 순서·전환 가치 (표현 전용) ─

/** Step 3 메인 헤드라인 */
export const STEP3_HEADLINE = '지금 몸 상태로 이렇게 시작해요';

/** Step 3 순서 예시 카드 제목 */
export const STEP3_ORDER_PREVIEW_SECTION_TITLE = '지금 시작 순서 예시';

/**
 * 시작 순서 3단계 — 단계 이름(고정).
 * PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW의 한 줄과 짝을 이룸.
 */
export const EXECUTION_ORDER_PHASE_TITLES = ['몸 풀기', '범위 열기', '움직임 붙이기'] as const;

/** 순서 블록 직후 — 사실 안전한 면책(과장 금지) */
export const STEP3_PREVIEW_DISCLAIMER =
  '아래 순서는 지금 몸 상태를 기준으로 먼저 시작하기 좋은 흐름이에요. 실제 루틴은 실행 단계에서 자연스럽게 이어져요.';

/** 실행 이어가기 가치 — 결제=실행 unlock 정렬 */
export const STEP3_VALUE_PILLARS: readonly string[] = [
  '결제 후 바로 첫 실행 화면으로 이어져요',
  '지금 결과를 반영해 시작 순서가 자동으로 정리돼요',
  '분석을 보는 단계가 아니라, 내 루틴을 시작하는 단계예요',
];

/** refined일 때만 Step 3 상단에 덧붙이는 한 줄 */
export const STEP3_REFINED_CONTEXT_LINE = '짧은 동작 체크를 반영한 시작 순서예요.';

/** 추천 동작 카드 소제목 */
export const STEP3_RECOMMENDED_SECTION_TITLE = '이렇게 시작할 수 있어요';

/** 생활 습관 카드 소제목 */
export const STEP3_LIFESTYLE_SECTION_TITLE = '오늘부터 가볍게 바꿔볼 습관';
