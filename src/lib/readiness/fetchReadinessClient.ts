/**
 * FLOW-08 / PR-FLOW-06 — Readiness Client Fetcher (browser-side)
 *
 * GET /api/readiness — SessionReadinessV1.
 *
 * @see src/app/api/readiness/route.ts
 * @see src/lib/readiness/get-session-readiness.ts
 */

import { supabaseBrowser } from '@/lib/supabase';
import type { SessionReadinessV1 } from './types';

export type { SessionReadinessV1 };

/**
 * fetchReadinessClient — 브라우저에서 readiness 조회 (best-effort)
 */
export async function fetchReadinessClient(): Promise<SessionReadinessV1 | null> {
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

    const json = await res.json() as { ok?: boolean; data?: SessionReadinessV1 };
    if (!json.ok || !json.data) return null;

    return json.data;
  } catch {
    return null;
  }
}
