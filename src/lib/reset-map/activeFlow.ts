/**
 * PR-RESET-06: Active flow helper.
 * At most one active flow (started | preview_ready) per user.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const ACTIVE_STATES = ['started', 'preview_ready'];

export type ResetMapFlowRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  state: string;
  result: string | null;
  flow_version: string;
  variant_tag: string | null;
  started_at: string;
  applied_at: string | null;
  aborted_at: string | null;
  created_at: string;
  updated_at: string;
  preview_snapshot?: unknown;
};

/**
 * Fetch current active flow for user. Null if none.
 */
export async function getActiveFlowByUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ResetMapFlowRow | null> {
  const { data, error } = await supabase
    .from('reset_map_flow')
    .select('*')
    .eq('user_id', userId)
    .in('state', ACTIVE_STATES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[activeFlow] fetch failed', error);
    return null;
  }

  return data as ResetMapFlowRow | null;
}
