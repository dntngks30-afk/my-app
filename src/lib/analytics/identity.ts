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

/**
 * 수집(쓰기) 경로 전용 raw 헬퍼. user_id 또는 anon_id 를 그대로 반환하며,
 * `user:` / `anon:` 접두사와 analytics_identity_links 링크 해석을 포함하지 않습니다.
 * KPI 어드민 집계에는 src/lib/analytics/admin-person-key.ts 의
 * resolveAnalyticsPersonKeyForKpi 를 사용하세요.
 */
export function getAnalyticsPersonKey(input: {
  user_id?: string | null;
  anon_id?: string | null;
}): string | null {
  return input.user_id ?? input.anon_id ?? null;
}

