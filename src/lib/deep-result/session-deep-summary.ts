/**
 * Lightweight Deep Result summary for Session Path B.
 * Single query, no template selection, no media sign.
 * Used by /api/session/create only.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';

export interface SessionDeepSummary {
  result_type: string;
  confidence: number;
  focus: string[];
  avoid: string[];
  scoring_version: string;
}

/**
 * Load minimal Deep Result summary for session create.
 * Returns null if no final deep_v2 result exists → 404 DEEP_RESULT_MISSING.
 */
export async function loadSessionDeepSummary(
  userId: string
): Promise<SessionDeepSummary | null> {
  const supabase = getServerSupabaseAdmin();

  const { data: attempt, error } = await supabase
    .from('deep_test_attempts')
    .select('result_type, confidence, scoring_version, scores')
    .eq('user_id', userId)
    .eq('status', 'final')
    .eq('scoring_version', 'deep_v2')
    .order('finalized_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !attempt) return null;

  const scores = attempt.scores as Record<string, unknown> | null;
  const derived = scores?.derived as Record<string, unknown> | null | undefined;

  const focus = Array.isArray(derived?.focus_tags)
    ? (derived.focus_tags as string[]).filter((x): x is string => typeof x === 'string')
    : [];
  const avoid = Array.isArray(derived?.avoid_tags)
    ? (derived.avoid_tags as string[]).filter((x): x is string => typeof x === 'string')
    : [];

  return {
    result_type: typeof attempt.result_type === 'string' ? attempt.result_type : 'UNKNOWN',
    confidence: typeof attempt.confidence === 'number' ? attempt.confidence : 0,
    focus,
    avoid,
    scoring_version: attempt.scoring_version ?? 'deep_v2',
  };
}
