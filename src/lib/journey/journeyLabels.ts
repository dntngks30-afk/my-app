/**
 * Journey 탭 전용 movement 타입 라벨·요약 (공개 결과 카피와 완전 일치할 때만 동일 문구).
 */

import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';

export const JOURNEY_NO_ANALYSIS = {
  label: '분석 결과 없음',
  summary: '움직임 체크를 완료하면 현재 타입이 여기에 표시돼요.',
} as const;

export const JOURNEY_PENDING_KNOWN_COPY = {
  label: '분석 결과 확인 중',
  summary: '현재 움직임 분석 결과를 안전하게 불러오는 중이에요.',
} as const;

/** unified primary → Journey 한 줄 요약 (명시 스펙) */
export const JOURNEY_PRIMARY_SUMMARY: Partial<Record<UnifiedPrimaryType, { label: string; summary: string }>> = {
  UPPER_IMMOBILITY: {
    label: '상체 긴장형',
    summary: '목과 어깨 주변 긴장이 높고, 흉추 움직임이 제한된 패턴이에요.',
  },
  LOWER_INSTABILITY: {
    label: '하체 불안정형',
    summary: '골반과 하체 안정성이 흔들려 움직임이 쉽게 무너지는 패턴이에요.',
  },
  /** 스펙 명칭 LOWER_MOBILITY — repo enum은 LOWER_MOBILITY_RESTRICTION */
  LOWER_MOBILITY_RESTRICTION: {
    label: '하체 가동성 제한형',
    summary: '발목, 고관절, 하체 움직임 범위가 제한된 패턴이에요.',
  },
  CORE_CONTROL_DEFICIT: {
    label: '코어 조절 부족형',
    summary: '몸통 중심을 유지하는 힘과 조절 능력이 부족한 패턴이에요.',
  },
  DECONDITIONED: {
    label: '전신 저활성형',
    summary: '전반적인 활동량과 움직임 준비도가 낮아진 패턴이에요.',
  },
};

/** 레거시/딥 문자열로 등장 가능한 비표준 키 */
const ALIAS_PRIMARY: Record<string, UnifiedPrimaryType | 'ASYMMETRY'> = {
  LOWER_MOBILITY: 'LOWER_MOBILITY_RESTRICTION',
  LOWER_STABILITY: 'LOWER_INSTABILITY',
};

const UNIFIED_PRIMARIES = new Set<UnifiedPrimaryType>([
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
  'DECONDITIONED',
  'STABLE',
  'UNKNOWN',
]);

export function normalizePrimaryType(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t === '') return null;
  const up = t.toUpperCase();
  if (up in ALIAS_PRIMARY) return ALIAS_PRIMARY[up] ?? up;
  return up;
}

function isUnifiedPrimary(u: string): u is UnifiedPrimaryType {
  return UNIFIED_PRIMARIES.has(u as UnifiedPrimaryType);
}

/**
 * 사용자 대면 레이블/요약. STABLE·UNKNOWN 및 지원 목록 외 타입은 "확인 중" 카피.
 */
export function getJourneyMovementCopy(primaryRaw: string, secondaryRaw: string | null | undefined): {
  label: string;
  summary: string;
  primary_normalized: string;
  secondary_normalized: string | null;
} {
  const p = normalizePrimaryType(primaryRaw) ?? 'UNKNOWN';
  const sRaw = normalizePrimaryType(secondaryRaw);
  const secondary_normalized = sRaw && sRaw !== p ? sRaw : null;

  const primary_normalized = (ALIAS_PRIMARY[p] as string | undefined) ?? p;

  if (!primary_normalized || primary_normalized === 'UNKNOWN') {
    return {
      primary_normalized,
      secondary_normalized,
      ...JOURNEY_PENDING_KNOWN_COPY,
    };
  }

  if (primary_normalized === 'STABLE') {
    return {
      primary_normalized,
      secondary_normalized,
      ...JOURNEY_PENDING_KNOWN_COPY,
    };
  }

  if (primary_normalized === 'ASYMMETRY' || p === 'ASYMMETRY') {
    return {
      primary_normalized: 'ASYMMETRY',
      secondary_normalized,
      label: '좌우 비대칭형',
      summary: '좌우 움직임 차이가 커서 한쪽으로 부담이 쏠리는 패턴이에요.',
    };
  }

  if (!isUnifiedPrimary(primary_normalized)) {
    return {
      primary_normalized,
      secondary_normalized,
      ...JOURNEY_PENDING_KNOWN_COPY,
    };
  }

  const row = JOURNEY_PRIMARY_SUMMARY[primary_normalized];
  if (row) {
    return {
      primary_normalized,
      secondary_normalized,
      label: row.label,
      summary: row.summary,
    };
  }

  return {
    primary_normalized,
    secondary_normalized,
    ...JOURNEY_PENDING_KNOWN_COPY,
  };
}
