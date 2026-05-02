import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYTICS_EVENTS } from './events';
import type {
  KpiCohortKey,
  KpiFunnelKey,
  KpiFunnelResponse,
  KpiFunnelStep,
  KpiRange,
  KpiRawEventRow,
  KpiRawEventsResponse,
  KpiRetentionResponse,
  KpiRetentionRow,
  KpiSummaryResponse,
} from './admin-kpi-types';

const KST_TZ = 'Asia/Seoul';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 7;
const RAW_EVENTS_DEFAULT_LIMIT = 100;
const RAW_EVENTS_MAX_LIMIT = 200;
const SAFE_PROP_KEYS = new Set([
  'route_group',
  'target_path',
  'entry_mode',
  'total_questions',
  'resumed',
  'duration_ms',
  'choice',
  'result_stage',
  'source_mode',
  'provider',
  'next_path',
  'plan_tier',
  'target_frequency',
  'exercise_experience_level',
  'pain_or_discomfort_present',
  'outcome',
  'anon_id_present',
  'source_public_result_id',
  'analysis_source_mode',
  'idempotent',
  'active_session_number',
  'completed_sessions',
  'total_sessions',
  'status',
  'exercise_count',
  'exercise_index',
  'template_id',
  'completion_mode',
  'duration_seconds',
  'session_number',
]);
const UNSAFE_PROP_KEYS = ['email', 'stripe', 'raw_trace', 'camera_trace', 'raw_scoring', 'exercise_logs'];

type AnalyticsEventRow = {
  id: string;
  created_at: string;
  event_name: string;
  source: 'client' | 'server';
  anon_id: string | null;
  user_id: string | null;
  route_path: string | null;
  route_group: string | null;
  kst_day: string | null;
  props: Record<string, unknown> | null;
  session_number: number | null;
};

type IdentityLinkRow = {
  anon_id: string;
  user_id: string;
  last_seen_at: string;
};

type EventWithPersonKey = AnalyticsEventRow & {
  person_key: string;
};

type FunnelDefinition = {
  event_name: string;
  label: string;
};

const FUNNEL_DEFINITIONS: Record<KpiFunnelKey, FunnelDefinition[]> = {
  public: [
    { event_name: ANALYTICS_EVENTS.LANDING_VIEWED, label: 'Landing Viewed' },
    { event_name: ANALYTICS_EVENTS.PUBLIC_CTA_CLICKED, label: 'Test Start Clicked' },
    { event_name: ANALYTICS_EVENTS.SURVEY_STARTED, label: 'Survey Started' },
    { event_name: ANALYTICS_EVENTS.SURVEY_COMPLETED, label: 'Survey Completed' },
    { event_name: ANALYTICS_EVENTS.RESULT_VIEWED, label: 'Result Viewed' },
    { event_name: ANALYTICS_EVENTS.EXECUTION_CTA_CLICKED, label: 'Execution CTA Clicked' },
  ],
  execution: [
    { event_name: ANALYTICS_EVENTS.EXECUTION_CTA_CLICKED, label: 'Execution CTA Clicked' },
    { event_name: ANALYTICS_EVENTS.AUTH_SUCCESS, label: 'Auth Success' },
    { event_name: ANALYTICS_EVENTS.CHECKOUT_SUCCESS, label: 'Checkout Success' },
    { event_name: ANALYTICS_EVENTS.ONBOARDING_COMPLETED, label: 'Onboarding Completed' },
    { event_name: ANALYTICS_EVENTS.PUBLIC_RESULT_CLAIM_SUCCESS, label: 'Public Result Claimed' },
    { event_name: ANALYTICS_EVENTS.SESSION_CREATE_SUCCESS, label: 'Session Created' },
    { event_name: ANALYTICS_EVENTS.APP_HOME_VIEWED, label: 'App Home Viewed' },
  ],
  first_session: [
    { event_name: ANALYTICS_EVENTS.SESSION_CREATE_SUCCESS, label: 'Session 1 Created' },
    { event_name: ANALYTICS_EVENTS.APP_HOME_VIEWED, label: 'App Home Reached' },
    { event_name: ANALYTICS_EVENTS.RESET_MAP_OPENED, label: 'Reset Map Opened' },
    { event_name: ANALYTICS_EVENTS.SESSION_PANEL_OPENED, label: 'Session Panel Opened' },
    { event_name: ANALYTICS_EVENTS.EXERCISE_PLAYER_OPENED, label: 'Exercise Player Opened' },
    { event_name: ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS, label: 'Session 1 Completed' },
  ],
};

const RETURN_EVENT_SET = new Set<string>([
  ANALYTICS_EVENTS.APP_HOME_VIEWED,
  ANALYTICS_EVENTS.SESSION_PANEL_OPENED,
  ANALYTICS_EVENTS.EXERCISE_PLAYER_OPENED,
  ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS,
]);

function roundRate(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return roundRate((numerator / denominator) * 100);
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatKstDay(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST_TZ,
  }).format(date);
}

function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const baseMs = Date.UTC(year, month - 1, date);
  return new Date(baseMs + delta * DAY_MS).toISOString().slice(0, 10);
}

function kstDayToUtcIso(day: string, endExclusive = false): string {
  const [year, month, date] = day.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, date + (endExclusive ? 1 : 0), 0, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function parseRangeBound(value: string | null | undefined, fallbackDay: string, isEnd: boolean): { day: string; iso: string } {
  if (!value) {
    const day = fallbackDay;
    return {
      day,
      iso: kstDayToUtcIso(day, isEnd),
    };
  }

  if (isDateOnly(value)) {
    return {
      day: value,
      iso: kstDayToUtcIso(value, isEnd),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      day: fallbackDay,
      iso: kstDayToUtcIso(fallbackDay, isEnd),
    };
  }

  const day = formatKstDay(parsed);
  return {
    day,
    iso: parsed.toISOString(),
  };
}

export function resolveKpiRange(params: URLSearchParams, defaultDays = DEFAULT_RANGE_DAYS): KpiRange {
  const now = new Date();
  const todayKst = formatKstDay(now);
  const defaultFrom = addDays(todayKst, -(Math.max(1, defaultDays) - 1));
  const fromBound = parseRangeBound(params.get('from'), defaultFrom, false);
  const toBound = parseRangeBound(params.get('to'), todayKst, true);

  const requestedSpan = Math.floor(
    (new Date(kstDayToUtcIso(toBound.day)).getTime() - new Date(kstDayToUtcIso(fromBound.day)).getTime()) / DAY_MS
  ) + 1;
  const cappedToDay = requestedSpan > MAX_RANGE_DAYS ? addDays(fromBound.day, MAX_RANGE_DAYS - 1) : toBound.day;

  return {
    from: fromBound.day,
    to: cappedToDay,
    tz: params.get('tz') || KST_TZ,
    fromIso: isDateOnly(params.get('from') ?? '') || !params.get('from') ? kstDayToUtcIso(fromBound.day) : fromBound.iso,
    toExclusiveIso: isDateOnly(params.get('to') ?? '') || !params.get('to') ? kstDayToUtcIso(cappedToDay, true) : toBound.iso,
  };
}

async function fetchIdentityLinkMap(
  supabase: SupabaseClient,
  anonIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (anonIds.length === 0) return map;

  const { data, error } = await supabase
    .from('analytics_identity_links')
    .select('anon_id, user_id, last_seen_at')
    .in('anon_id', anonIds)
    .order('last_seen_at', { ascending: false });

  if (error) {
    throw new Error('analytics_identity_links_read_failed');
  }

  for (const row of (data ?? []) as IdentityLinkRow[]) {
    if (!map.has(row.anon_id)) {
      map.set(row.anon_id, row.user_id);
    }
  }

  return map;
}

function buildPersonKey(row: AnalyticsEventRow, linkMap: Map<string, string>): string {
  if (row.user_id) return `user:${row.user_id}`;
  if (row.anon_id) {
    const linked = linkMap.get(row.anon_id);
    if (linked) return `user:${linked}`;
    return `anon:${row.anon_id}`;
  }
  return `event:${row.id}`;
}

async function fetchAnalyticsEvents(
  supabase: SupabaseClient,
  range: KpiRange,
  eventNames: string[]
): Promise<EventWithPersonKey[]> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('id, created_at, event_name, source, anon_id, user_id, route_path, route_group, kst_day, props, session_number')
    .gte('created_at', range.fromIso)
    .lt('created_at', range.toExclusiveIso)
    .in('event_name', eventNames);

  if (error) {
    throw new Error('analytics_events_read_failed');
  }

  const rows = (data ?? []) as AnalyticsEventRow[];
  const anonIds = Array.from(
    new Set(
      rows
        .map((row) => row.anon_id)
        .filter((value): value is string => Boolean(value))
    )
  );
  const linkMap = await fetchIdentityLinkMap(supabase, anonIds);

  return rows.map((row) => ({
    ...row,
    person_key: buildPersonKey(row, linkMap),
  }));
}

function filterFirstSessionRows(rows: EventWithPersonKey[]): EventWithPersonKey[] {
  return rows.filter((row) => row.session_number === 1 || (row.event_name === ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS && row.session_number == null));
}

function distinctCountForEvent(rows: EventWithPersonKey[], eventName: string): number {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.event_name === eventName) {
      set.add(row.person_key);
    }
  }
  return set.size;
}

function buildFunnelSteps(rows: EventWithPersonKey[], funnel: KpiFunnelKey): KpiFunnelStep[] {
  const scopedRows = funnel === 'first_session' ? filterFirstSessionRows(rows) : rows;
  const definitions = FUNNEL_DEFINITIONS[funnel];
  const counts = definitions.map((def) => distinctCountForEvent(scopedRows, def.event_name));
  const startCount = counts[0] ?? 0;

  return definitions.map((def, index) => {
    const count = counts[index] ?? 0;
    const previous = index > 0 ? counts[index - 1] ?? 0 : 0;
    const dropoffCount = index > 0 ? Math.max(previous - count, 0) : null;
    return {
      event_name: def.event_name,
      label: def.label,
      count,
      conversion_from_previous: index === 0 ? null : percentage(count, previous),
      conversion_from_start: percentage(count, startCount),
      dropoff_count: dropoffCount,
      dropoff_rate: index === 0 || dropoffCount == null ? null : percentage(dropoffCount, previous),
    };
  });
}

function findTopDropoff(
  publicSteps: KpiFunnelStep[],
  executionSteps: KpiFunnelStep[],
  firstSessionSteps: KpiFunnelStep[]
): KpiSummaryResponse['top_dropoff'] {
  const candidates: Array<KpiSummaryResponse['top_dropoff']> = [];

  for (const [funnel, steps] of [
    ['public', publicSteps],
    ['execution', executionSteps],
    ['first_session', firstSessionSteps],
  ] as const) {
    for (let i = 1; i < steps.length; i += 1) {
      const previous = steps[i - 1];
      const current = steps[i];
      candidates.push({
        funnel,
        from_event: previous.event_name,
        to_event: current.event_name,
        dropoff_count: previous.count - current.count,
        dropoff_rate: current.dropoff_rate,
      });
    }
  }

  const valid = candidates.filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (valid.length === 0) return null;

  valid.sort((a, b) => {
    if (b.dropoff_count !== a.dropoff_count) return b.dropoff_count - a.dropoff_count;
    return (b.dropoff_rate ?? -1) - (a.dropoff_rate ?? -1);
  });

  return valid[0] ?? null;
}

function getRetentionCohortRows(
  rows: EventWithPersonKey[],
  cohort: KpiCohortKey
): KpiRetentionRow[] {
  const cohortEvent = cohort === 'app_home'
    ? ANALYTICS_EVENTS.APP_HOME_VIEWED
    : ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS;

  const cohortRows = rows
    .filter((row) =>
      row.event_name === cohortEvent &&
      (cohort === 'app_home' || row.session_number === 1 || row.session_number == null)
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const firstCohortByPerson = new Map<string, string>();
  for (const row of cohortRows) {
    if (row.kst_day && !firstCohortByPerson.has(row.person_key)) {
      firstCohortByPerson.set(row.person_key, row.kst_day);
    }
  }

  const returnDaysByPerson = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.kst_day || !RETURN_EVENT_SET.has(row.event_name)) continue;
    const current = returnDaysByPerson.get(row.person_key) ?? new Set<string>();
    current.add(row.kst_day);
    returnDaysByPerson.set(row.person_key, current);
  }

  const grouped = new Map<string, KpiRetentionRow>();
  for (const [personKey, cohortDay] of firstCohortByPerson.entries()) {
    const row = grouped.get(cohortDay) ?? {
      cohort_day: cohortDay,
      cohort_size: 0,
      d1_returned: 0,
      d1_rate: null,
      d3_returned: 0,
      d3_rate: null,
      d7_returned: 0,
      d7_rate: null,
    };
    row.cohort_size += 1;

    const returnDays = returnDaysByPerson.get(personKey) ?? new Set<string>();
    if (returnDays.has(addDays(cohortDay, 1))) row.d1_returned += 1;
    if (returnDays.has(addDays(cohortDay, 3))) row.d3_returned += 1;
    if (returnDays.has(addDays(cohortDay, 7))) row.d7_returned += 1;

    grouped.set(cohortDay, row);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.cohort_day.localeCompare(b.cohort_day))
    .map((row) => ({
      ...row,
      d1_rate: percentage(row.d1_returned, row.cohort_size),
      d3_rate: percentage(row.d3_returned, row.cohort_size),
      d7_rate: percentage(row.d7_returned, row.cohort_size),
    }));
}

function maskIdPreview(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function sanitizePropsPreview(input: Record<string, unknown> | null): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const preview: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (UNSAFE_PROP_KEYS.some((unsafe) => key.toLowerCase().includes(unsafe))) continue;
    if (!SAFE_PROP_KEYS.has(key)) continue;

    if (
      value == null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      preview[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      preview[key] = value.length > 80 ? `${value.slice(0, 77)}...` : value;
      continue;
    }

    if (Array.isArray(value)) {
      preview[key] = `[${value.length} items]`;
      continue;
    }

    if (typeof value === 'object') {
      preview[key] = '{...}';
    }
  }

  return preview;
}

export async function getKpiSummary(
  supabase: SupabaseClient,
  range: KpiRange
): Promise<KpiSummaryResponse> {
  const eventNames = Array.from(
    new Set(
      Object.values(FUNNEL_DEFINITIONS)
        .flat()
        .map((item) => item.event_name)
    )
  );
  const rows = await fetchAnalyticsEvents(supabase, range, eventNames);

  const publicSteps = buildFunnelSteps(rows, 'public');
  const executionSteps = buildFunnelSteps(rows, 'execution');
  const firstSessionSteps = buildFunnelSteps(rows, 'first_session');
  const appHomeRetention = getRetentionCohortRows(rows, 'app_home');

  const visitorsFromLanding = publicSteps[0]?.count ?? 0;
  const visitorsFromAppHome = executionSteps[6]?.count ?? 0;
  const visitors = visitorsFromLanding > 0 ? visitorsFromLanding : visitorsFromAppHome;
  const latestRetention = appHomeRetention.at(-1) ?? null;

  return {
    ok: true,
    range: { from: range.from, to: range.to, tz: range.tz },
    cards: {
      visitors,
      test_start_rate: publicSteps[1]?.conversion_from_previous ?? null,
      survey_completion_rate: percentage(publicSteps[3]?.count ?? 0, publicSteps[2]?.count ?? 0),
      result_view_rate: percentage(publicSteps[4]?.count ?? 0, publicSteps[3]?.count ?? 0),
      result_to_execution_rate: publicSteps[5]?.conversion_from_previous ?? null,
      checkout_success_rate: percentage(executionSteps[2]?.count ?? 0, executionSteps[0]?.count ?? 0),
      onboarding_completion_rate: percentage(executionSteps[3]?.count ?? 0, executionSteps[2]?.count ?? 0),
      session_create_rate: percentage(executionSteps[5]?.count ?? 0, executionSteps[4]?.count ?? 0),
      first_session_completion_rate: percentage(firstSessionSteps[5]?.count ?? 0, firstSessionSteps[0]?.count ?? 0),
      d1_return_rate: latestRetention?.d1_rate ?? null,
      d3_return_rate: latestRetention?.d3_rate ?? null,
      d7_return_rate: latestRetention?.d7_rate ?? null,
    },
    top_dropoff: findTopDropoff(publicSteps, executionSteps, firstSessionSteps),
  };
}

export async function getKpiFunnel(
  supabase: SupabaseClient,
  range: KpiRange,
  funnel: KpiFunnelKey
): Promise<KpiFunnelResponse> {
  const eventNames = FUNNEL_DEFINITIONS[funnel].map((item) => item.event_name);
  const rows = await fetchAnalyticsEvents(supabase, range, eventNames);
  return {
    ok: true,
    funnel,
    steps: buildFunnelSteps(rows, funnel),
  };
}

export async function getKpiRetention(
  supabase: SupabaseClient,
  range: KpiRange,
  cohort: KpiCohortKey
): Promise<KpiRetentionResponse> {
  const eventNames = Array.from(RETURN_EVENT_SET);
  const required = cohort === 'app_home'
    ? [ANALYTICS_EVENTS.APP_HOME_VIEWED]
    : [ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS];
  const rows = await fetchAnalyticsEvents(
    supabase,
    range,
    Array.from(new Set([...eventNames, ...required]))
  );

  return {
    ok: true,
    cohort,
    rows: getRetentionCohortRows(rows, cohort),
  };
}

export async function getKpiRawEvents(
  supabase: SupabaseClient,
  range: KpiRange,
  eventName: string | null,
  limitInput: string | null,
  cursor: string | null
): Promise<KpiRawEventsResponse> {
  const limit = Math.min(
    RAW_EVENTS_MAX_LIMIT,
    Math.max(1, Number.parseInt(limitInput ?? `${RAW_EVENTS_DEFAULT_LIMIT}`, 10) || RAW_EVENTS_DEFAULT_LIMIT)
  );

  let query = supabase
    .from('analytics_events')
    .select('id, created_at, event_name, source, anon_id, user_id, route_path, route_group, kst_day, props')
    .gte('created_at', range.fromIso)
    .lt('created_at', range.toExclusiveIso)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (eventName) {
    query = query.eq('event_name', eventName);
  }
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error('analytics_events_raw_read_failed');
  }

  const rows = (data ?? []) as Array<AnalyticsEventRow & { props: Record<string, unknown> | null }>;
  const nextCursor = rows.length > limit ? rows[limit - 1]?.created_at ?? null : null;
  const sliced = rows.slice(0, limit);

  return {
    ok: true,
    events: sliced.map((row): KpiRawEventRow => ({
      id: row.id,
      created_at: row.created_at,
      event_name: row.event_name,
      source: row.source,
      anon_id_preview: maskIdPreview(row.anon_id),
      user_id_preview: maskIdPreview(row.user_id),
      route_path: row.route_path,
      route_group: row.route_group,
      kst_day: row.kst_day,
      props_preview: sanitizePropsPreview(row.props),
    })),
    nextCursor,
  };
}

