/**
 * PR-V2-06 — Public Result 표시 레이블 SSOT
 *
 * Deep Result V2 어휘 → 한국어 UI 레이블 매핑.
 * 이 파일이 baseline/refined/future-loaded 모든 공개 결과 표면의 레이블 SSOT다.
 *
 * ⚠️ 이 파일에 동물 이름(kangaroo, hedgehog 등)을 headline label로 추가 금지.
 * 모든 레이블은 paid-deep-style / Deep Result V2 어휘 기반이어야 한다.
 *
 * @see src/lib/result/deep-result-v2-contract.ts (타입 SSOT)
 */

import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';

// ─── Primary Type ─────────────────────────────────────────────────────────────

/** UnifiedPrimaryType → 간결 표시 레이블 */
export const PRIMARY_TYPE_LABELS: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체 안정성 패턴',
  LOWER_MOBILITY_RESTRICTION: '하체 가동성 제한',
  UPPER_IMMOBILITY:           '상체 가동성 제한',
  CORE_CONTROL_DEFICIT:       '체간 조절 패턴',
  DECONDITIONED:              '복합 재조정 패턴',
  STABLE:                     '균형형',
  UNKNOWN:                    '분석 정보 부족',
};

/** UnifiedPrimaryType → 간략 설명 (gate/card용) */
export const PRIMARY_TYPE_BRIEF: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체의 안정성 신호가 가장 두드러집니다.',
  LOWER_MOBILITY_RESTRICTION: '발목·고관절의 가동 범위 제한 신호가 나타납니다.',
  UPPER_IMMOBILITY:           '흉추·어깨의 가동성 제한 신호가 나타납니다.',
  CORE_CONTROL_DEFICIT:       '허리·골반 조절 패턴 신호가 가장 두드러집니다.',
  DECONDITIONED:              '복수 부위에서 동시에 신호가 나타납니다.',
  STABLE:                     '전반적으로 균형이 잡힌 움직임 패턴입니다.',
  UNKNOWN:                    '충분한 신호를 얻지 못했습니다.',
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
};

// ─── Missing Signals ──────────────────────────────────────────────────────────

/** missing_signal → 한국어 안내 문구 */
export const MISSING_SIGNAL_LABELS: Record<string, string> = {
  pain_intensity_missing:              '통증 강도 정보 (유료 딥테스트에서 측정)',
  pain_location_missing:               '통증 위치 정보 (유료 딥테스트에서 측정)',
  objective_movement_test_missing:     '객관 동작 테스트 (카메라 분석에서 측정)',
  camera_evidence_partial:             '카메라 신호 일부 제한 (재촬영 시 개선 가능)',
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

/** 화면 1: 짧은 패턴 불릿 3개 */
export const PRIMARY_TYPE_SCREEN1_BULLETS: Record<UnifiedPrimaryType, readonly [string, string, string]> = {
  LOWER_INSTABILITY: [
    '하체에 체중이 한 번에 실리거나 흔들림이 느껴질 수 있어요',
    '무릎·발목 방향이 안쪽으로 모이기 쉬운 날이 있어요',
    '오래 서 있거나 계단·러닝 후 하체 피로가 빨리 쌓일 수 있어요',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '발목·고관절이 굳게 느껴지는 날이 있어요',
    '앉았다 일어날 때 하체가 뻐근하게 느껴질 수 있어요',
    '스쿼트·런지 때 깊이가 잘 안 나오는 느낌이 들 수 있어요',
  ],
  UPPER_IMMOBILITY: [
    '목·어깨가 자주 뭉치거나 앞으로 당겨지기 쉬워요',
    '팔을 위로 올릴 때 견갑·어깨 쪽이 먼저 끼일 수 있어요',
    '장시간 모니터·스마트폰 자세 후 상체가 무거워요',
  ],
  CORE_CONTROL_DEFICIT: [
    '허리·골반 주변에서 버티는 느낌이 먼저 올 수 있어요',
    '숨을 참거나 얕게 쉬는 순간이 잦을 수 있어요',
    '앉은 자세에서 허리 꺾임이나 골반 전방이 느껴져요',
  ],
  DECONDITIONED: [
    '여러 부위가 동시에 불편하게 느껴지는 날이 있어요',
    '운동을 쉬었다 다시 시작할 때 부담이 클 수 있어요',
    '강도·시간 조절 없이 하면 다음 날 피로가 남기 쉬워요',
  ],
  STABLE: [
    '전반적으로 균형이 괜찮은 편이에요',
    '그래도 강도·수면·스트레스에 따라 컨디션은 달라져요',
    '꾸준한 유지·점진적 증량이 중요해요',
  ],
  UNKNOWN: [
    '패턴을 더 정리하려면 추가 정보가 도움이 돼요',
    '무리한 강도보다 가벼운 루틴부터 시작해 보세요',
    '불편이 있으면 범위를 줄이고 전문가 상담을 고려하세요',
  ],
};

/** 화면 2: 일상에서 조심하면 좋은 점 (비진단 톤) */
export const PRIMARY_TYPE_CAREFUL_MOVEMENTS: Record<UnifiedPrimaryType, readonly string[]> = {
  LOWER_INSTABILITY: [
    '갑자기 무거운 중량·점프부터 시작하지 않기',
    '무릎이 안쪽으로 말리는 자세를 오래 유지하지 않기',
    '한쪽 다리에만 체중이 쏠리는 동작 반복 줄이기',
    '하체 피로가 쌓인 날은 강도와 시간을 줄이기',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '같은 자세로 오래 앉아 있기 전에 가볍게 스트레칭하기',
    '발목·종아리가 뻣뻣할 때 무리한 스트레칭·런닝 피하기',
    '워밍업 없이 깊은 스쿼트·런지를 바로 하지 않기',
    '통증이 있으면 무리한 가동 범위 확장 시도 줄이기',
  ],
  UPPER_IMMOBILITY: [
    '턱을 앞으로 내미는 자세를 오래 유지하지 않기',
    '어깨만으로 팔을 들어 올리려 하지 않기(숨·갈비 활용)',
    '장시간 동일한 팔·목 각도 반복 줄이기',
    '뭉침이 있을 때 무리한 셀프 마사지·강한 스트레칭 피하기',
  ],
  CORE_CONTROL_DEFICIT: [
    '배만 힘주고 숨을 참는 패턴 줄이기',
    '허리만 꺾어 버티는 동작 반복 줄이기',
    '갑자기 강한 코어 운동만 반복하지 않기',
    '피로·수면 부족일 때 고강도 코어·허리 운동 피하기',
  ],
  DECONDITIONED: [
    '한 번에 여러 부위를 모두 자극하려 하지 않기',
    '오랜 공백 후 바로 예전 강도로 돌아가지 않기',
    '통증이 남는 날은 다음 세션까지 휴식·강도 조절하기',
    '일상 활동량이 급변할 때 운동량도 함께 맞추기',
  ],
  STABLE: [
    '컨디션이 나쁜 날까지 강도를 올리지 않기',
    '수면·스트레스가 쌓인 날 회복 루틴 우선하기',
    '갑작스러운 볼륨·거리 증가는 단계적으로 하기',
    '불편이 생기면 그날은 강도를 낮추기',
  ],
  UNKNOWN: [
    '통증·저림이 있으면 무리한 스트레칭·운동 피하기',
    '원인을 단정하지 말고 범위를 줄여 시도하기',
    '증상이 지속되면 전문가 상담을 고려하기',
    '한 번에 많은 정보에 과몰입하지 않기',
  ],
};

/** 화면 3: 추천 운동 2가지 (가벼운 예시) */
export const PRIMARY_TYPE_RECOMMENDED_MOVES: Record<UnifiedPrimaryType, readonly [string, string]> = {
  LOWER_INSTABILITY: ['맨몸 미니 스쿼트·힙 힌지 패턴', '한 발 서기·밸런스 드릴(짧게)'],
  LOWER_MOBILITY_RESTRICTION: ['발목·고관절 모빌리티 루틴', '가벼운 힙 오프닝·종아리 스트레칭'],
  UPPER_IMMOBILITY: ['벽 슬라이드·숨과 함께 팔 올리기', '흉추 회전·어깨 블레이드 가벼운 활성화'],
  CORE_CONTROL_DEFICIT: ['복식 호흡·데드버그 변형', '골반 중립 느끼는 브릿지·버드독(저강도)'],
  DECONDITIONED: ['전신 순환 가벼운 워킹·자전거', '상·하체 나눠 부담 적은 루틴'],
  STABLE: ['유지용 전신 순환 루틴', '유연성·호흡 밸런스 위주 보조 운동'],
  UNKNOWN: ['가벼운 워밍업·걷기', '불편 없는 범위의 관절 풀기'],
};

/** 화면 3: 생활 습관 3가지 */
export const PRIMARY_TYPE_LIFESTYLE_HABITS: Record<UnifiedPrimaryType, readonly [string, string, string]> = {
  LOWER_INSTABILITY: [
    '앉았다 일어날 때 천천히 하체에 체중 실어주기',
    '계단·러닝 전 짧은 워밍업 습관 들이기',
    '하체 피로 날에는 수면·보행량도 함께 점검하기',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '한 자세로 오래 앉기 전 알람으로 자세 바꾸기',
    '샤워 후·취침 전 짧은 하체 풀기',
    '신발·쪼금 걸음 습관도 함께 눈여겨보기',
  ],
  UPPER_IMMOBILITY: [
    '모니터 높이·거리 한 번씩 점검하기',
    '30~40분마다 목·어깨 가볍게 풀기',
    '스마트폰을 아래로만 보지 않기',
  ],
  CORE_CONTROL_DEFICIT: [
    '앉을 때 등받이·발바닥 지지 작게라도 챙기기',
    '숨을 깊게 쉬는 순간 하루에 몇 번이라도 넣기',
    '허리만 쓰는 동작 대신 엉덩이·복부 함께 쓰기 연습',
  ],
  DECONDITIONED: [
    '운동·일상 활동량을 한 번에 크게 바꾸지 않기',
    '수면·수분·단백질 패턴을 함께 보기',
    '다음 날 피로를 남기지 않는 선에서만 진행하기',
  ],
  STABLE: [
    '규칙적인 수면·가벼운 활동 유지',
    '스트레스 높은 주에는 강도만 조절하기',
    '몸 상태 체크 후 그날 루틴 선택하기',
  ],
  UNKNOWN: [
    '불편 범위 안에서만 움직이기',
    '하루에 한 가지 습관만 바꿔 보기',
    '지속 증상은 전문가와 상의하기',
  ],
};

/** 화면 3: 운동 순서 프리뷰 (3단계) */
export const PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW: Record<UnifiedPrimaryType, readonly [string, string, string]> = {
  LOWER_INSTABILITY: [
    '호흡·코어 정리로 안정감 잡기',
    '발목·고관절 가볍게 풀기',
    '미니 스쿼트·밸런스로 마무리',
  ],
  LOWER_MOBILITY_RESTRICTION: [
    '호흡·전신 가볍게 깨우기',
    '발목·고관절 모빌리티',
    '가동 범위 안 스쿼트·런지 패턴',
  ],
  UPPER_IMMOBILITY: [
    '호흡·갈비·견갑 가볍게 깨우기',
    '흉추·어깨 가동 루틴',
    '팔 올리기·자세 교정 패턴으로 마무리',
  ],
  CORE_CONTROL_DEFICIT: [
    '복식 호흡·골반·갈비 연결',
    '데드버그·버드독 등 저부하 코어',
    '일상 자세에 옮겨 쓰기',
  ],
  DECONDITIONED: [
    '짧은 워밍업·순환',
    '상·하체 나눠 가벼운 동작',
    '다음 날 피로 체크하며 마무리',
  ],
  STABLE: [
    '유지·순환 위주 워밍업',
    '전신 밸런스 루틴',
    '회복·유연성으로 정리',
  ],
  UNKNOWN: [
    '가벼운 워밍업',
    '불편 없는 범위 관절 풀기',
    '짧게 마무리 스트레칭',
  ],
};

/** 화면 3 상단 한 줄 훅 */
export const PRIMARY_TYPE_START_HOOK: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY: '지금은 하체 안정을 먼저 쌓는 흐름이 좋아요.',
  LOWER_MOBILITY_RESTRICTION: '지금은 가동성을 부드럽게 열어 주는 흐름이 좋아요.',
  UPPER_IMMOBILITY: '지금은 상체 가동성·호흡을 함께 푸는 흐름이 좋아요.',
  CORE_CONTROL_DEFICIT: '지금은 호흡·체간 연결을 먼저 잡는 흐름이 좋아요.',
  DECONDITIONED: '지금은 강도보다 꾸준함·회복을 우선하는 흐름이 좋아요.',
  STABLE: '지금은 유지·점진적 발전을 이어가는 흐름이 좋아요.',
  UNKNOWN: '지금은 가볍게 범위를 확인하며 시작하는 흐름이 좋아요.',
};

/**
 * summary_copy에서 괄호로 붙는 메타 문구 제거 (본문만 남김)
 */
export function stripSummaryMetaSuffix(summary: string): string {
  return summary.replace(/\s*[\(（][^)）]*[)）]\s*$/u, '').trim();
}

// ─── PR-CONVERSION-PREVIEW-04 — Step 3 실행 순서·전환 가치 (표현 전용) ─

/** Step 3 메인 헤드라인 */
export const STEP3_HEADLINE = '지금 이렇게 시작하는 게 좋아요';

/**
 * 시작 순서 3단계 — 단계 이름(고정).
 * PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW의 한 줄과 짝을 이룸.
 */
export const EXECUTION_ORDER_PHASE_TITLES = [
  '가볍게 풀기 · 호흡·이동',
  '준비 · 스트레칭·가동성',
  '활성화 · 패턴에 맞춘 동작',
] as const;

/** 순서 블록 직후 — 사실 안전한 면책(과장 금지) */
export const STEP3_PREVIEW_DISCLAIMER =
  '아래 순서는 지금 결과를 바탕으로 한 시작 흐름 예시예요. 실제 루틴은 실행 단계에서 자동으로 이어져요.';

/** 실행 이어가기 가치 — 결제=실행 unlock 정렬 */
export const STEP3_VALUE_PILLARS: readonly string[] = [
  '결제 후 바로 실행 화면으로 이어져요',
  '오늘 정리한 상태를 반영해 순서가 자동으로 잡혀요',
  '분석을 열기 위한 결제가 아니라, 실행을 시작하기 위한 단계예요',
];

/** refined일 때만 Step 3 상단에 덧붙이는 한 줄 */
export const STEP3_REFINED_CONTEXT_LINE = '짧은 동작 체크를 반영한 시작 순서예요.';

/** 추천 동작 카드 소제목 — 순서 예시에 붙는 동작 힌트 */
export const STEP3_RECOMMENDED_SECTION_TITLE = '이 흐름에 들어갈 수 있는 동작 예시';

/** 생활 습관 카드 소제목 */
export const STEP3_LIFESTYLE_SECTION_TITLE = '짧게 챙기면 좋은 생활 팁';
