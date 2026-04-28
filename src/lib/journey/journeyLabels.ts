/**
 * Journey 탭 movement 타입 표시 — 설문/공개 결과와 동일 SSOT
 * (`public-result-labels.ts`의 PRIMARY_TYPE_LABELS / PRIMARY_TYPE_BRIEF).
 */

import {
  PRIMARY_TYPE_BRIEF,
  PRIMARY_TYPE_LABELS,
} from '@/components/public-result/public-result-labels';
import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';

export const JOURNEY_NO_ANALYSIS = {
  label: '분석 결과 없음',
  summary: '움직임 체크를 완료하면 현재 타입이 여기에 표시돼요.',
} as const;

export const JOURNEY_PENDING_KNOWN_COPY = {
  label: '분석 결과 확인 중',
  summary: '현재 움직임 분석 결과를 안전하게 불러오는 중이에요.',
} as const;

/** 공개 결과 Step1 과 동일한 타입명·메인 해석 블록 */
export function surveyResultCopy(pt: UnifiedPrimaryType): {
  label: string;
  summary: string;
} {
  return {
    label: PRIMARY_TYPE_LABELS[pt],
    summary: PRIMARY_TYPE_BRIEF[pt],
  };
}

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

  if (primary_normalized === 'ASYMMETRY' || p === 'ASYMMETRY') {
    return {
      primary_normalized: 'ASYMMETRY',
      secondary_normalized,
      label: '좌우 비대칭형',
      summary: '좌우 움직임 차이가 커서 한쪽으로 부담이 쏠리는 패턴이에요.',
    };
  }

  if (!primary_normalized || !isUnifiedPrimary(primary_normalized)) {
    return {
      primary_normalized,
      secondary_normalized,
      ...JOURNEY_PENDING_KNOWN_COPY,
    };
  }

  const typed = primary_normalized as UnifiedPrimaryType;
  const fromSurvey = surveyResultCopy(typed);

  return {
    primary_normalized,
    secondary_normalized,
    label: fromSurvey.label,
    summary: fromSurvey.summary,
  };
}
