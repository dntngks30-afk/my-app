/**
 * FLOW-08 — Readiness Client Fetcher (browser-side)
 *
 * GET /api/readiness를 브라우저에서 호출하는 best-effort 헬퍼.
 * 실패 시 null 반환 (UX 블로킹 없음).
 *
 * @see src/app/api/readiness/route.ts (FLOW-07)
 * @see src/lib/readiness/getCanonicalUserReadiness.ts (FLOW-07)
 */

import { supabaseBrowser } from '@/lib/supabase';
import type { CanonicalUserReadiness } from './getCanonicalUserReadiness';

export type { CanonicalUserReadiness };

/**
 * fetchReadinessClient — 브라우저에서 readiness 조회 (best-effort)
 *
 * @returns CanonicalUserReadiness (성공) | null (인증 없음 또는 실패)
 */
export async function fetchReadinessClient(): Promise<CanonicalUserReadiness | null> {
  try {
    const { data: { session } } = await supabaseBrowser.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch('/api/readiness', { headers, cache: 'no-store' });
    if (!res.ok) return null;

    const json = await res.json() as { ok?: boolean; data?: CanonicalUserReadiness };
    if (!json.ok || !json.data) return null;

    return json.data;
  } catch {
    return null;
  }
}
