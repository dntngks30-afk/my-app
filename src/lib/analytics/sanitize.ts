import { randomUUID } from 'crypto';
import type {
  AnalyticsProps,
  AnalyticsSource,
  SanitizedAnalyticsEvent,
} from './analytics-types';
import { isAnalyticsEventName } from './events';

const MAX_TEXT_LENGTH = 512;
const MAX_ROUTE_LENGTH = 256;
const MAX_DEDUPE_KEY_LENGTH = 256;
const MAX_PROPS_BYTES = 8 * 1024;
const MAX_PROP_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UNSAFE_PROP_KEYS = new Set([
  'email',
  'raw_trace',
  'camera_trace',
  'raw_scoring',
  'exercise_logs',
  'stripe',
  'stripe_raw',
  'stripe_object',
]);

type RawAnalyticsEventInput = {
  event_id?: unknown;
  dedupe_key?: unknown;
  event_name?: unknown;
  event_version?: unknown;
  source?: unknown;
  anon_id?: unknown;
  user_id?: unknown;
  public_result_id?: unknown;
  session_plan_id?: unknown;
  session_number?: unknown;
  routine_id?: unknown;
  reset_map_flow_id?: unknown;
  route_path?: unknown;
  route_group?: unknown;
  client_ts?: unknown;
  props?: unknown;
  user_agent?: unknown;
  referrer?: unknown;
};

type SanitizeResult =
  | { ok: true; event: SanitizedAnalyticsEvent }
  | { ok: false; error: 'invalid_payload' };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function trimText(value: unknown, max = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function trimUuid(value: unknown): string | null {
  const text = trimText(value, 64);
  if (!text || !UUID_RE.test(text)) return null;
  return text;
}

function sanitizeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const int = Math.floor(value);
  return int >= 0 ? int : null;
}

function sanitizeEventVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  const int = Math.floor(value);
  return int >= 1 && int <= 100 ? int : 1;
}

function sanitizeClientTs(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isUnsafePropKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (UNSAFE_PROP_KEYS.has(normalized)) return true;
  if (normalized.includes('email')) return true;
  return false;
}

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (depth > MAX_PROP_DEPTH) return null;
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, MAX_TEXT_LENGTH);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeJsonValue(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = rawKey.trim();
      if (!key || isUnsafePropKey(key)) continue;
      const sanitized = sanitizeJsonValue(rawValue, depth + 1);
      if (sanitized !== undefined) output[key.slice(0, 80)] = sanitized;
    }
    return output;
  }
  return null;
}

export function sanitizeAnalyticsProps(value: unknown): AnalyticsProps | null {
  if (value == null) return {};
  if (!isPlainObject(value)) return null;

  const sanitized = sanitizeJsonValue(value, 0);
  if (!isPlainObject(sanitized)) return null;

  const size = Buffer.byteLength(JSON.stringify(sanitized), 'utf8');
  if (size > MAX_PROPS_BYTES) return null;

  return sanitized;
}

export function sanitizeAnalyticsEventInput(
  input: RawAnalyticsEventInput
): SanitizeResult {
  if (!isAnalyticsEventName(input.event_name)) {
    return { ok: false, error: 'invalid_payload' };
  }

  const source = input.source;
  if (source !== 'client' && source !== 'server') {
    return { ok: false, error: 'invalid_payload' };
  }

  const eventId = trimUuid(input.event_id) ?? randomUUID();
  const props = sanitizeAnalyticsProps(input.props);
  if (!props) return { ok: false, error: 'invalid_payload' };

  return {
    ok: true,
    event: {
      event_id: eventId,
      dedupe_key: trimText(input.dedupe_key, MAX_DEDUPE_KEY_LENGTH),
      event_name: input.event_name,
      event_version: sanitizeEventVersion(input.event_version),
      source: source as AnalyticsSource,
      anon_id: trimText(input.anon_id, 128),
      user_id: trimUuid(input.user_id),
      public_result_id: trimUuid(input.public_result_id),
      session_plan_id: trimUuid(input.session_plan_id),
      session_number: sanitizeInteger(input.session_number),
      routine_id: trimUuid(input.routine_id),
      reset_map_flow_id: trimUuid(input.reset_map_flow_id),
      route_path: trimText(input.route_path, MAX_ROUTE_LENGTH),
      route_group: trimText(input.route_group, MAX_TEXT_LENGTH),
      client_ts: sanitizeClientTs(input.client_ts),
      props,
      user_agent: trimText(input.user_agent, MAX_TEXT_LENGTH),
      referrer: trimText(input.referrer, MAX_TEXT_LENGTH),
    },
  };
}

export function isDuplicateAnalyticsInsertError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? (error as { code?: unknown }).code : null;
  return code === '23505';
}

