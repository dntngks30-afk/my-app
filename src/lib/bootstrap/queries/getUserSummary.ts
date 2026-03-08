/**
 * Read-only user summary for bootstrap.
 * users + deep_test_attempts (has_deep_result).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BootstrapUserSummary } from '../types';

export async function getUserSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<BootstrapUserSummary> {
  const [userRes, deepRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, plan_status, email, created_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('deep_test_attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'final')
      .limit(1)
      .maybeSingle(),
  ]);

  const user = userRes.data as { id?: string; plan_status?: string | null; email?: string | null } | null;
  const displayName =
    (user?.email && user.email.length > 0)
      ? user.email.split('@')[0] ?? '무버'
      : '무버';

  return {
    id: userId,
    plan_status: user?.plan_status ?? null,
    display_name: displayName,
    has_deep_result: !!deepRes.data,
  };
}
