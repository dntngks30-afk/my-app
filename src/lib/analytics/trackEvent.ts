'use client';

import { getOrCreateAnonId } from '@/lib/public-results/anon-id';
import type { AnalyticsProps, AnalyticsTrackPayload } from './analytics-types';
import type { AnalyticsEventName } from './events';

type TrackEventOptions = Omit<
  Partial<AnalyticsTrackPayload>,
  'event_name' | 'props' | 'anon_id' | 'route_path' | 'client_ts'
> & {
  route_path?: string;
  anon_id?: string;
};

function buildPayload(
  eventName: AnalyticsEventName,
  props?: AnalyticsProps,
  options?: TrackEventOptions
): AnalyticsTrackPayload | null {
  if (typeof window === 'undefined') return null;

  let anonId = options?.anon_id ?? '';
  try {
    anonId = anonId || getOrCreateAnonId();
  } catch {
    anonId = '';
  }

  return {
    event_name: eventName,
    event_version: options?.event_version,
    event_id: options?.event_id,
    dedupe_key: options?.dedupe_key,
    anon_id: anonId || undefined,
    public_result_id: options?.public_result_id,
    session_plan_id: options?.session_plan_id,
    session_number: options?.session_number,
    routine_id: options?.routine_id,
    reset_map_flow_id: options?.reset_map_flow_id,
    route_path: options?.route_path ?? window.location.pathname,
    route_group: options?.route_group,
    client_ts: new Date().toISOString(),
    props: props ?? {},
  };
}

export function trackEvent(
  eventName: AnalyticsEventName,
  props?: AnalyticsProps,
  options?: TrackEventOptions
): void {
  try {
    const payload = buildPayload(eventName, props, options);
    if (!payload) return;

    const body = JSON.stringify(payload);
    const url = '/api/analytics/track';

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(
        url,
        new Blob([body], { type: 'application/json' })
      );
      if (sent) return;
    }

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      cache: 'no-store',
    }).catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[analytics] track failed', err);
      }
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[analytics] track skipped', err);
    }
  }
}

