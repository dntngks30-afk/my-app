import type { AnalyticsEventName } from './events';

export type AnalyticsSource = 'client' | 'server';

export type AnalyticsProps = Record<string, unknown>;

export type AnalyticsTrackPayload = {
  event_id?: string;
  dedupe_key?: string;
  event_name: AnalyticsEventName;
  event_version?: number;
  anon_id?: string;
  public_result_id?: string;
  session_plan_id?: string;
  session_number?: number;
  routine_id?: string;
  reset_map_flow_id?: string;
  route_path?: string;
  route_group?: string;
  client_ts?: string;
  props?: AnalyticsProps;
};

export type SanitizedAnalyticsEvent = {
  event_id: string;
  dedupe_key: string | null;
  event_name: AnalyticsEventName;
  event_version: number;
  source: AnalyticsSource;
  anon_id: string | null;
  user_id: string | null;
  public_result_id: string | null;
  session_plan_id: string | null;
  session_number: number | null;
  routine_id: string | null;
  reset_map_flow_id: string | null;
  route_path: string | null;
  route_group: string | null;
  client_ts: string | null;
  props: AnalyticsProps;
  user_agent: string | null;
  referrer: string | null;
};

export type AnalyticsInsertResult =
  | { ok: true; deduped?: boolean }
  | { ok: false; dropped: true };

