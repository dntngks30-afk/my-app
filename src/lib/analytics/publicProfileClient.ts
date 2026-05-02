'use client';

import type { AgeBand, KpiIntroGender } from '@/lib/analytics/kpi-demographics-types';

export const PENDING_PUBLIC_TEST_PROFILE_KEY = 'moveRePendingPublicTestProfile:v1';

export type PendingPublicTestProfilePayload = {
  anonId: string;
  ageBand: AgeBand;
  gender: KpiIntroGender;
  pilotCode?: string | null;
};

function isPayload(value: unknown): value is PendingPublicTestProfilePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.anonId === 'string' &&
    typeof p.ageBand === 'string' &&
    typeof p.gender === 'string' &&
    (p.pilotCode == null || typeof p.pilotCode === 'string')
  );
}

export function savePendingPublicTestProfile(payload: PendingPublicTestProfilePayload): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_PUBLIC_TEST_PROFILE_KEY, JSON.stringify(payload));
  } catch {
    // best-effort only
  }
}

export function clearPendingPublicTestProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_PUBLIC_TEST_PROFILE_KEY);
  } catch {
    // best-effort only
  }
}

function readPendingPublicTestProfile(): PendingPublicTestProfilePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_PUBLIC_TEST_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function flushPendingPublicTestProfile(): Promise<boolean> {
  const payload = readPendingPublicTestProfile();
  if (!payload) return true;

  try {
    const res = await fetch('/api/public-test-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (json?.ok !== true) return false;
    clearPendingPublicTestProfile();
    return true;
  } catch {
    return false;
  }
}
