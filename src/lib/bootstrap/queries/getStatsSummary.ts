/**
 * Read-only stats summary for bootstrap.
 * Lightweight first-card data only. No heavy history/graph payloads.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BootstrapStatsSummary } from '../types';

export async function getStatsSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<BootstrapStatsSummary> {
  try {
    const { data: progress } = await supabase
      .from('session_program_progress')
      .select('completed_sessions, total_sessions, last_completed_at, last_completed_day_key')
      .eq('user_id', userId)
      .maybeSingle();

    const completed = progress?.completed_sessions ?? 0;
    const total = progress?.total_sessions ?? 16;
    const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

    const lastCheckinAt =
      typeof (progress as { last_completed_at?: string | null })?.last_completed_at === 'string'
        ? (progress as { last_completed_at: string }).last_completed_at
        : null;

    const lastDayKey = (progress as { last_completed_day_key?: string | null })?.last_completed_day_key;
    const streakDays =
      typeof lastDayKey === 'string' && lastDayKey.length >= 10
        ? 1
        : completed > 0
          ? Math.min(completed, 7)
          : 0;

    return {
      completed_sessions: completed,
      completion_rate: completionRate,
      streak_days: streakDays,
      last_checkin_at: lastCheckinAt,
    };
  } catch {
    return {
      completed_sessions: 0,
      completion_rate: 0,
      streak_days: 0,
      last_checkin_at: null,
    };
  }
}
