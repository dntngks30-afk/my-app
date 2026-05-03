'use client';

import { getOrCreateAnonId } from '@/lib/public-results/anon-id';
import { getPilotCodeForCurrentFlow } from '@/lib/pilot/pilot-context';
import type { AnalyticsProps } from './analytics-types';

const MAX_DEDUPE_KEY_LENGTH = 256;

export function getAnalyticsClientPersonScope(): string {
  try {
    const anonId = getOrCreateAnonId();
    return anonId ? `anon:${anonId}` : 'anon:unknown';
  } catch {
    return 'anon:unknown';
  }
}

export function getAnalyticsPilotProps(): AnalyticsProps {
  try {
    const pilotCode = getPilotCodeForCurrentFlow();
    return {
      pilot_code_present: Boolean(pilotCode),
      ...(pilotCode ? { pilot_code: pilotCode } : {}),
    };
  } catch {
    return { pilot_code_present: false };
  }
}

export function withPilotAnalyticsProps(props: AnalyticsProps = {}): AnalyticsProps {
  return {
    ...props,
    ...getAnalyticsPilotProps(),
  };
}

export function buildClientScopedDedupeKey(
  parts: Array<string | number | boolean | null | undefined>
): string {
  const scope = getAnalyticsClientPersonScope();
  return [scope, ...parts.map((part) => String(part ?? 'none'))].join(':').slice(0, MAX_DEDUPE_KEY_LENGTH);
}
