import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdmin } from '@/lib/supabase';

type UpsertAnalyticsIdentityLinkParams = {
  anon_id?: string | null;
  user_id?: string | null;
  source?: string;
  supabase?: SupabaseClient;
};

export async function upsertAnalyticsIdentityLink({
  anon_id,
  user_id,
  source = 'track_endpoint',
  supabase,
}: UpsertAnalyticsIdentityLinkParams): Promise<{ ok: true } | { ok: false }> {
  if (!anon_id || !user_id) return { ok: true };

  try {
    const client = supabase ?? getServerSupabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await client
      .from('analytics_identity_links')
      .upsert(
        {
          anon_id,
          user_id,
          source,
          last_seen_at: now,
        },
        { onConflict: 'anon_id,user_id' }
      );

    if (error) {
      console.error('[analytics.identity] upsert failed');
      return { ok: false };
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function getAnalyticsPersonKey(input: {
  user_id?: string | null;
  anon_id?: string | null;
}): string | null {
  return input.user_id ?? input.anon_id ?? null;
}

