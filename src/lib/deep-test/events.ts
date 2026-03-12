/**
 * Deep Test funnel events — lightweight client-side tracking.
 * Fire-and-forget, noop-safe. No PII in payload.
 */

export type DeepTestEvent =
  | 'deep_test_started'
  | 'deep_test_section_viewed'
  | 'deep_test_section_completed'
  | 'deep_test_abandoned'
  | 'deep_test_submitted'
  | 'deep_result_viewed'
  | 'deep_result_cta_clicked';

export type DeepTestEventPayload = Record<string, unknown>;

const ALLOWED_EVENTS: DeepTestEvent[] = [
  'deep_test_started',
  'deep_test_section_viewed',
  'deep_test_section_completed',
  'deep_test_abandoned',
  'deep_test_submitted',
  'deep_result_viewed',
  'deep_result_cta_clicked',
];

function isValidEvent(event: string): event is DeepTestEvent {
  return ALLOWED_EVENTS.includes(event as DeepTestEvent);
}

function sanitizePayload(p: DeepTestEventPayload): DeepTestEventPayload {
  const out: DeepTestEventPayload = {};
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith('_') || k === 'answers' || k === 'raw') continue;
    if (typeof v === 'string' && v.length > 500) continue;
    out[k] = v;
  }
  return out;
}

let _token: string | null = null;

export function setDeepTrackToken(token: string | null) {
  _token = token;
}

export function trackDeepEvent(
  event: DeepTestEvent,
  payload: DeepTestEventPayload = {}
): void {
  if (!isValidEvent(event)) return;
  const safe = sanitizePayload(payload);

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.debug('[deep-track]', event, safe);
  }

  if (!_token) return;

  const url = '/api/deep-test/track';
  const body = JSON.stringify({ event, payload: safe });

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_token}`,
    },
    body,
    keepalive: true,
  }).catch(() => {});
}
