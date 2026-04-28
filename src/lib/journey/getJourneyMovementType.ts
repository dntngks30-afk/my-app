/**
 * Journey 움직임 타입 — resolveSessionAnalysisInput + analyzed_at 보강 + plan meta fallback.
 */

import { resolveSessionAnalysisInput } from '@/lib/session/resolveSessionAnalysisInput';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import {
  getJourneyMovementCopy,
  JOURNEY_NO_ANALYSIS,
} from '@/lib/journey/journeyLabels';
import type { JourneyMovementSource, JourneyMovementTypeBlock } from '@/lib/journey/types';

function pickPlanJsonMeta(primary: string | null): { primary: string | null; secondary: string | null } {
  if (!primary || typeof primary !== 'string') return { primary: null, secondary: null };
  const t = primary.trim();
  if (!t) return { primary: null, secondary: null };
  return { primary: t, secondary: null };
}

export async function getJourneyMovementType(userId: string): Promise<JourneyMovementTypeBlock> {
  const resolved = await resolveSessionAnalysisInput(userId);

  if (resolved) {
    const summary = resolved.summary;
    const primaryRaw =
      (typeof summary.primary_type === 'string' && summary.primary_type.trim().length > 0
        ? summary.primary_type
        : null) ??
      (typeof summary.result_type === 'string' && summary.result_type.trim().length > 0
        ? summary.result_type
        : 'UNKNOWN');
    const secondaryRaw =
      summary.secondary_type !== undefined && summary.secondary_type !== null
        ? String(summary.secondary_type)
        : null;

    let analyzedAt: string | null = null;
    let src: JourneyMovementSource =
      resolved.source.mode === 'public_result' ? 'claimed_public_result' : 'legacy_paid_deep';

    if (resolved.source.mode === 'public_result' && resolved.source.public_result_id) {
      const supabase = getServerSupabaseAdmin();
      const { data } = await supabase
        .from('public_results')
        .select('created_at')
        .eq('id', resolved.source.public_result_id)
        .maybeSingle();
      if (data && typeof (data as { created_at?: string }).created_at === 'string') {
        analyzedAt = (data as { created_at: string }).created_at;
      }
    } else if (resolved.source.mode === 'legacy_paid_deep' && summary.source_deep_attempt_id) {
      const supabase = getServerSupabaseAdmin();
      const { data } = await supabase
        .from('deep_test_attempts')
        .select('finalized_at')
        .eq('id', summary.source_deep_attempt_id)
        .maybeSingle();
      const fin = (data as { finalized_at?: string } | null)?.finalized_at;
      if (typeof fin === 'string' && fin.trim().length > 0) analyzedAt = fin;
    }

    const copy = getJourneyMovementCopy(primaryRaw ?? 'UNKNOWN', secondaryRaw);

    return {
      primary_type: copy.primary_normalized,
      secondary_type: copy.secondary_normalized,
      label: copy.label,
      summary: copy.summary,
      source: src,
      analyzed_at: analyzedAt,
    };
  }

  const supabase = getServerSupabaseAdmin();
  const { data: latestPlan } = await supabase
    .from('session_plans')
    .select('session_number, plan_json, created_at')
    .eq('user_id', userId)
    .order('session_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planJson = latestPlan?.plan_json as Record<string, unknown> | null | undefined;
  const meta = planJson?.meta as Record<string, unknown> | undefined;
  const pt =
    typeof meta?.primary_type === 'string' && meta.primary_type.trim().length > 0
      ? meta.primary_type.trim()
      : null;

  if (!pt) {
    return {
      primary_type: 'UNKNOWN',
      secondary_type: null,
      label: JOURNEY_NO_ANALYSIS.label,
      summary: JOURNEY_NO_ANALYSIS.summary,
      source: 'none',
      analyzed_at: null,
    };
  }

  const mapped = pickPlanJsonMeta(pt);
  const copy = getJourneyMovementCopy(mapped.primary ?? 'UNKNOWN', mapped.secondary);

  const analyzed =
    typeof latestPlan?.created_at === 'string' && latestPlan.created_at.trim().length > 0
      ? latestPlan.created_at
      : null;

  return {
    primary_type: copy.primary_normalized,
    secondary_type: copy.secondary_normalized,
    label: copy.label,
    summary: copy.summary,
    source: 'session_plan_meta',
    analyzed_at: analyzed,
  };
}
