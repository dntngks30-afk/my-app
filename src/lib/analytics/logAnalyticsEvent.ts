import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import type {
  AnalyticsInsertResult,
  AnalyticsProps,
} from './analytics-types';
import type { AnalyticsEventName } from './events';
import {
  isDuplicateAnalyticsInsertError,
  sanitizeAnalyticsEventInput,
} from './sanitize';
import { upsertAnalyticsIdentityLink } from './identity';

type LogAnalyticsEventParams = {
  event_name: AnalyticsEventName;
  event_id?: string;
  event_version?: number;
  user_id?: string | null;
  anon_id?: string | null;
  public_result_id?: string | null;
  session_plan_id?: string | null;
  session_number?: number | null;
  routine_id?: string | null;
  reset_map_flow_id?: string | null;
  route_path?: string | null;
  route_group?: string | null;
  dedupe_key?: string | null;
  props?: AnalyticsProps;
  supabase?: SupabaseClient;
};

export async function logAnalyticsEvent(
  params: LogAnalyticsEventParams
): Promise<AnalyticsInsertResult> {
  const sanitized = sanitizeAnalyticsEventInput({
    ...params,
    source: 'server',
    user_id: params.user_id ?? undefined,
    anon_id: params.anon_id ?? undefined,
    public_result_id: params.public_result_id ?? undefined,
    session_plan_id: params.session_plan_id ?? undefined,
    session_number: params.session_number ?? undefined,
    routine_id: params.routine_id ?? undefined,
    reset_map_flow_id: params.reset_map_flow_id ?? undefined,
    route_path: params.route_path ?? undefined,
    route_group: params.route_group ?? undefined,
    dedupe_key: params.dedupe_key ?? undefined,
  });

  if (!sanitized.ok) {
    return { ok: false, dropped: true };
  }

  try {
    const supabase = params.supabase ?? getServerSupabaseAdmin();
    const { error } = await supabase
      .from('analytics_events')
      .insert(sanitized.event);

    if (error) {
      if (isDuplicateAnalyticsInsertError(error)) {
        return { ok: true, deduped: true };
      }
      console.error('[analytics] server insert failed', sanitized.event.event_name);
      return { ok: false, dropped: true };
    }

    await upsertAnalyticsIdentityLink({
      anon_id: sanitized.event.anon_id,
      user_id: sanitized.event.user_id,
      source: 'server_helper',
      supabase,
    });

    return { ok: true };
  } catch {
    return { ok: false, dropped: true };
  }
}

