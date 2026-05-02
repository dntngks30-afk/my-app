/**
 * 공통 intro/story funnel 설정
 * moveRePublicFunnel:v1 스키마 및 단계 정의
 */

import type { AcquisitionSource, AgeBand } from '@/lib/analytics/kpi-demographics-types';

export const FUNNEL_KEY = 'moveRePublicFunnel:v1';

/** 첫 공개 진입은 PR-PUBLIC-ENTRY-02 이후 항상 survey. `camera` 값은 과거 localStorage 호환용으로만 남을 수 있음. */
export type EntryMode = 'survey' | 'camera';

export interface FunnelData {
  entryMode: EntryMode;
  /** @deprecated 과거 연령대 select 문자열 — 신규 플로우는 age_band 사용 */
  age?: string;
  age_band?: AgeBand;
  gender?: string;
  acquisition_source?: AcquisitionSource;
  introCompletedAt?: string;
}

/** movement-test session profile과 merge 가능한 형태 (생년월일 원문은 포함하지 않음) */
export const toProfileMerge = (d: FunnelData): Record<string, unknown> => ({
  ...(d.age_band != null ? { age_band: d.age_band } : {}),
  ...(d.gender != null ? { gender: d.gender } : {}),
  ...(d.acquisition_source != null ? { acquisition_source: d.acquisition_source } : {}),
});

/** funnel 단계 순서 (1-based index) */
export const INTRO_STEPS = [
  { path: '/intro/welcome', step: 1 },
  { path: '/intro/examples/1', step: 2 },
  { path: '/intro/examples/2', step: 3 },
  { path: '/intro/types', step: 4 },
  { path: '/intro/trust', step: 5 },
  { path: '/intro/profile', step: 6 },
] as const;

export const TOTAL_STEPS = INTRO_STEPS.length;

export function getStepIndex(path: string): number {
  const i = INTRO_STEPS.findIndex((s) => s.path === path);
  return i >= 0 ? i : 0;
}

export function getPrevPath(path: string): string | null {
  const i = getStepIndex(path);
  return i > 0 ? INTRO_STEPS[i - 1].path : null;
}

export function getNextPath(path: string): string | null {
  const i = getStepIndex(path);
  return i >= 0 && i < TOTAL_STEPS - 1 ? INTRO_STEPS[i + 1].path : null;
}
