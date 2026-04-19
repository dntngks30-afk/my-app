/**
 * PR4: compact node display bundle for home entry (display-only; no segments).
 */

import type { HomeNodeDisplayBundle, HomeNodeDisplayBundleItem } from '@/lib/session/client';
import { buildSessionNodeDisplayHydrationItem } from '@/lib/session/session-node-display-hydration-item';

type AdminClient = Awaited<ReturnType<typeof import('@/lib/supabase').getServerSupabaseAdmin>>;

export async function fetchHomeNodeDisplayBundle(
  supabase: AdminClient,
  userId: string,
  opts: {
    totalSessions: number;
    activeSessionNumber: number | null;
  }
): Promise<HomeNodeDisplayBundle> {
  const to = Math.min(20, Math.max(1, opts.totalSessions));
  const { data: rows, error } = await supabase
    .from('session_plans')
    .select('session_number, plan_json')
    .eq('user_id', userId)
    .gte('session_number', 1)
    .lte('session_number', to)
    .order('session_number', { ascending: true });

  if (error) {
    console.warn('[home-node-display-bundle] session_plans fetch failed', error.message);
    return { items: [] };
  }

  const active = opts.activeSessionNumber;
  const items: HomeNodeDisplayBundleItem[] = (rows ?? []).map(
    (row: { session_number: number; plan_json: unknown }) => {
      const pj = row.plan_json as { meta?: Record<string, unknown> } | null | undefined;
      const base = buildSessionNodeDisplayHydrationItem(row.session_number, pj?.meta);
      const source_hint: HomeNodeDisplayBundleItem['source_hint'] =
        active != null && row.session_number === active ? 'active' : 'hydrated_history';
      return { ...base, source_hint };
    }
  );

  return { items };
}
