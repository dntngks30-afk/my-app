/**
 * Read-only home summary for bootstrap.
 * No insert/update. Safe defaults when progress is null.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BootstrapHomeSummary } from '../types';

const DEFAULT_TOTAL_SESSIONS = 16;

export async function getHomeSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<BootstrapHomeSummary> {
  const [progressRes, planRes] = await Promise.all([
    supabase
      .from('session_program_progress')
      .select('total_sessions, completed_sessions, active_session_number, last_completed_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('session_plans')
      .select('session_number, status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const progress = progressRes.data as {
    total_sessions?: number;
    completed_sessions?: number;
    active_session_number?: number | null;
    last_completed_at?: string | null;
  } | null;

  const totalSessions = progress?.total_sessions ?? DEFAULT_TOTAL_SESSIONS;
  const completedSessions = progress?.completed_sessions ?? 0;
  const activeSessionNumber = progress?.active_session_number ?? null;

  let activeStatus: string | null = null;
  if (activeSessionNumber != null) {
    const { data: activePlan } = await supabase
      .from('session_plans')
      .select('status')
      .eq('user_id', userId)
      .eq('session_number', activeSessionNumber)
      .maybeSingle();
    activeStatus = (activePlan as { status?: string } | null)?.status ?? 'draft';
  }

  const lastCompletedPlan = planRes.data as { session_number?: number } | null;
  const lastCompletedSessionNumber = lastCompletedPlan?.session_number ?? null;

  const currentSessionNumber =
    activeSessionNumber != null ? activeSessionNumber : (completedSessions + 1);

  return {
    current_session_number: currentSessionNumber,
    total_sessions: totalSessions,
    completed_sessions: completedSessions,
    active_session_exists: activeSessionNumber != null,
    active_session_status: activeStatus,
    last_completed_session_number: lastCompletedSessionNumber,
  };
}
