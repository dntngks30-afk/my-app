/**
 * Read-only my/profile summary for bootstrap.
 * First-card identity/program data only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BootstrapMySummary } from '../types';

const FREQUENCY_TO_TOTAL: Record<number, number> = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

export async function getMySummary(
  supabase: SupabaseClient,
  userId: string
): Promise<BootstrapMySummary> {
  try {
    const [userRes, profileRes] = await Promise.all([
      supabase
        .from('users')
        .select('plan_status, email, created_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('session_user_profile')
        .select('target_frequency')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const user = userRes.data as { plan_status?: string | null; email?: string | null; created_at?: string | null } | null;
    const profile = profileRes.data as { target_frequency?: number } | null;

    const displayName =
      user?.email && user.email.length > 0
        ? user.email.split('@')[0] ?? '무버'
        : '무버';

    const freq = profile?.target_frequency ?? 4;
    const total = typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL
      ? FREQUENCY_TO_TOTAL[freq]
      : 16;
    const programLabel = `주 ${freq}회 / 총 ${total}세션`;

    const joinedAt =
      typeof user?.created_at === 'string' ? user.created_at : null;

    return {
      display_name: displayName,
      plan_status: user?.plan_status ?? null,
      program_label: programLabel,
      joined_at: joinedAt,
    };
  } catch {
    return {
      display_name: '무버',
      plan_status: null,
      program_label: '주 4회 / 총 16세션',
      joined_at: null,
    };
  }
}
