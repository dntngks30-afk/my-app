/**
 * PR-RESET-10: Reset Map metrics query layer.
 * Lightweight server-side aggregation from flows and events.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ResetMapMetricsParams = {
  supabase: SupabaseClient;
  /** Optional: scope to user. If omitted, aggregates all users. */
  userId?: string | null;
  /** Optional: only include flows/events since this timestamp (ISO). */
  since?: string | null;
};

export type ResetMapMetrics = {
  flow_counts: {
    starts: number;
    applied: number;
    aborted: number;
    active: number;
  };
  event_counts: {
    started: number;
    active_flow_reused: number;
    duplicate_start_prevented: number;
    preview_ready: number;
    preview_blocked: number;
    applied: number;
    apply_blocked_preview_required: number;
  };
  blocked_reason_distribution: Record<string, number>;
  funnel: {
    started: number;
    preview_ready: number;
    applied: number;
  };
  timing_ms: {
    start_to_preview_ready_median: number | null;
    start_to_preview_ready_avg: number | null;
    start_to_apply_median: number | null;
    start_to_apply_avg: number | null;
  };
};

function parseSince(since: string | null | undefined): string | undefined {
  if (!since || typeof since !== 'string') return undefined;
  const d = new Date(since);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Compute reset-map metrics from flow and event tables.
 */
export async function getResetMapMetrics(
  params: ResetMapMetricsParams
): Promise<ResetMapMetrics> {
  const { supabase, userId, since } = params;
  const sinceTs = parseSince(since);

  let flowQuery = supabase
    .from('reset_map_flow')
    .select('id, state, started_at, applied_at, created_at');
  if (userId) flowQuery = flowQuery.eq('user_id', userId);
  if (sinceTs) flowQuery = flowQuery.gte('created_at', sinceTs);

  let eventQuery = supabase.from('reset_map_events').select('flow_id, name, attrs, ts');
  if (userId) eventQuery = eventQuery.eq('user_id', userId);
  if (sinceTs) eventQuery = eventQuery.gte('ts', sinceTs);

  const [flowsRes, eventsRes] = await Promise.all([
    flowQuery,
    eventQuery,
  ]);

  const flows = flowsRes.data ?? [];
  const events = eventsRes.data ?? [];

  const flowCounts = {
    starts: flows.filter((f) => f.state).length,
    applied: flows.filter((f) => f.state === 'applied').length,
    aborted: flows.filter((f) => f.state === 'aborted').length,
    active: flows.filter((f) =>
      ['started', 'preview_ready'].includes(f.state ?? '')
    ).length,
  };

  const eventCounts: ResetMapMetrics['event_counts'] = {
    started: 0,
    active_flow_reused: 0,
    duplicate_start_prevented: 0,
    preview_ready: 0,
    preview_blocked: 0,
    applied: 0,
    apply_blocked_preview_required: 0,
  };

  const blockedReasons: Record<string, number> = {};
  const flowToStarted: Record<string, number> = {};
  const flowToPreviewReady: Record<string, number> = {};
  const flowToApplied: Record<string, number> = {};
  const flowStartedAt: Record<string, number> = {};

  for (const e of events) {
    const name = e.name as string;
    if (name in eventCounts) eventCounts[name as keyof typeof eventCounts]++;

    if (name === 'preview_blocked') {
      const reasons = (e.attrs as Record<string, unknown>)?.reasons as
        | string[]
        | undefined;
      if (Array.isArray(reasons)) {
        for (const r of reasons) {
          blockedReasons[r] = (blockedReasons[r] ?? 0) + 1;
        }
      }
    }

    const fid = e.flow_id as string;
    const ts = new Date((e.ts as string) ?? 0).getTime();
    if (name === 'started') {
      flowToStarted[fid] = ts;
      flowStartedAt[fid] = ts;
    } else if (name === 'preview_ready') flowToPreviewReady[fid] = ts;
    else if (name === 'applied') flowToApplied[fid] = ts;
  }

  const funnel = {
    started: Object.keys(flowToStarted).length,
    preview_ready: Object.keys(flowToPreviewReady).length,
    applied: Object.keys(flowToApplied).length,
  };

  const startToPreviewDurations: number[] = [];
  const startToApplyDurations: number[] = [];
  for (const fid of Object.keys(flowToStarted)) {
    const t0 = flowStartedAt[fid];
    const tPr = flowToPreviewReady[fid];
    const tAp = flowToApplied[fid];
    if (tPr != null) startToPreviewDurations.push(tPr - t0);
    if (tAp != null) startToApplyDurations.push(tAp - t0);
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    flow_counts: flowCounts,
    event_counts: eventCounts,
    blocked_reason_distribution: blockedReasons,
    funnel,
    timing_ms: {
      start_to_preview_ready_median: median(startToPreviewDurations),
      start_to_preview_ready_avg: avg(startToPreviewDurations),
      start_to_apply_median: median(startToApplyDurations),
      start_to_apply_avg: avg(startToApplyDurations),
    },
  };
}
