import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYTICS_EVENTS } from './events';
import { resolveAnalyticsPersonKeyForKpi } from './admin-person-key';
import type {
  KpiActivityStep,
  KpiCohortFunnelStep,
  KpiCohortKey,
  KpiDetailsResponse,
  KpiFunnelKey,
  KpiFunnelResponse,
  KpiPilotFraction,
  KpiRange,
  KpiRawEventRow,
  KpiRawEventsResponse,
  KpiResponseFilters,
  KpiRetentionResponse,
  KpiRetentionRow,
  KpiSummaryResponse,
} from './admin-kpi-types';
import { computeKpiDemographicsSummary } from '@/lib/analytics/admin-kpi-demographics';
import { filterRowsByPilotCode } from '@/lib/analytics/admin-kpi-pilot-filter';

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
  'pilot_code',
  'pilot_code_present',
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
  'segment_title',
  'has_value',
  'close_source',
  'logged_count',
  'code',
  'entry_from',
  'movement_key',
  'pass_latched',
  'retry_count',
  'evidence_quality',
  'completed_steps',
  'reason',
  'mode',
  'installed',
  'standalone',
  'permission_state',
  'supported',
  'permission_before',
  'permission_after',
  'platform',
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
  public_result_id: string | null;
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

/** 순차 코호트 퍼널 정의 — 첫 이벤트가 코호트 기준 */
const PUBLIC_COHORT_DEFINITIONS: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.PUBLIC_CTA_CLICKED, label: 'Test Start Clicked' },
  { event_name: ANALYTICS_EVENTS.SURVEY_STARTED, label: 'Survey Started' },
  { event_name: ANALYTICS_EVENTS.SURVEY_COMPLETED, label: 'Survey Completed' },
  { event_name: ANALYTICS_EVENTS.RESULT_VIEWED, label: 'Result Viewed' },
  { event_name: ANALYTICS_EVENTS.EXECUTION_CTA_CLICKED, label: 'Execution CTA Clicked' },
];

/** 이벤트별 독립 distinct — 순차 전환율 해석 금지 */
const PUBLIC_ACTIVITY_DEFINITIONS: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.LANDING_VIEWED, label: 'Landing Viewed' },
  ...PUBLIC_COHORT_DEFINITIONS,
];

const EXECUTION_COHORT_DEFINITIONS: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.EXECUTION_CTA_CLICKED, label: 'Execution CTA Clicked' },
  { event_name: ANALYTICS_EVENTS.AUTH_SUCCESS, label: 'Auth Success' },
  { event_name: ANALYTICS_EVENTS.CHECKOUT_SUCCESS, label: 'Checkout Success' },
  { event_name: ANALYTICS_EVENTS.ONBOARDING_COMPLETED, label: 'Onboarding Completed' },
  { event_name: ANALYTICS_EVENTS.PUBLIC_RESULT_CLAIM_SUCCESS, label: 'Public Result Claimed' },
  { event_name: ANALYTICS_EVENTS.SESSION_CREATE_SUCCESS, label: 'Session Created' },
  { event_name: ANALYTICS_EVENTS.APP_HOME_VIEWED, label: 'App Home Viewed' },
];

const FIRST_SESSION_COHORT_DEFINITIONS: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.SESSION_CREATE_SUCCESS, label: 'Session 1 Created' },
  { event_name: ANALYTICS_EVENTS.APP_HOME_VIEWED, label: 'App Home Reached' },
  { event_name: ANALYTICS_EVENTS.RESET_MAP_OPENED, label: 'Reset Map Opened' },
  { event_name: ANALYTICS_EVENTS.SESSION_PANEL_OPENED, label: 'Session Panel Opened' },
  { event_name: ANALYTICS_EVENTS.EXERCISE_PLAYER_OPENED, label: 'Exercise Player Opened' },
  { event_name: ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS, label: 'Session 1 Completed' },
];

function cohortDefinitionsFor(funnel: KpiFunnelKey): FunnelDefinition[] {
  if (funnel === 'public') return PUBLIC_COHORT_DEFINITIONS;
  if (funnel === 'execution') return EXECUTION_COHORT_DEFINITIONS;
  return FIRST_SESSION_COHORT_DEFINITIONS;
}

function activityDefinitionsFor(funnel: KpiFunnelKey): FunnelDefinition[] {
  if (funnel === 'public') return PUBLIC_ACTIVITY_DEFINITIONS;
  if (funnel === 'execution') return EXECUTION_COHORT_DEFINITIONS;
  return FIRST_SESSION_COHORT_DEFINITIONS;
}

/** KPI 요약·퍼널 API에서 조회할 이벤트 이름 합집합 */
function allKpiDashboardEventNames(): string[] {
  return Array.from(
    new Set([
      ...PUBLIC_ACTIVITY_DEFINITIONS.map((d) => d.event_name),
      ...EXECUTION_COHORT_DEFINITIONS.map((d) => d.event_name),
      ...FIRST_SESSION_COHORT_DEFINITIONS.map((d) => d.event_name),
    ]),
  );
}

const RETURN_EVENT_SET = new Set<string>([
  ANALYTICS_EVENTS.APP_HOME_VIEWED,
  ANALYTICS_EVENTS.SESSION_PANEL_OPENED,
  ANALYTICS_EVENTS.EXERCISE_PLAYER_OPENED,
  ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS,
]);

const SESSION_DETAIL_DEFINITION: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.SESSION_PANEL_OPENED, label: 'Session Panel Opened' },
  { event_name: ANALYTICS_EVENTS.EXERCISE_PLAYER_OPENED, label: 'Exercise Player Opened' },
  { event_name: ANALYTICS_EVENTS.EXERCISE_LOGGED, label: 'Exercise Logged' },
  { event_name: ANALYTICS_EVENTS.SESSION_COMPLETE_CLICKED, label: 'Session Complete Clicked' },
  { event_name: ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS, label: 'Session Complete Success' },
];

const CAMERA_DETAIL_DEFINITION: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.CAMERA_FLOW_STARTED, label: 'Camera Flow Started' },
  { event_name: ANALYTICS_EVENTS.CAMERA_SETUP_VIEWED, label: 'Camera Setup Viewed' },
  { event_name: ANALYTICS_EVENTS.CAMERA_STEP_STARTED, label: 'Camera Step Started' },
  { event_name: ANALYTICS_EVENTS.CAMERA_STEP_COMPLETED, label: 'Camera Step Completed' },
  { event_name: ANALYTICS_EVENTS.CAMERA_REFINE_COMPLETED, label: 'Camera Refine Completed' },
];

const PWA_DETAIL_DEFINITION: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.PWA_INSTALL_CARD_SHOWN, label: 'PWA Card Shown' },
  { event_name: ANALYTICS_EVENTS.PWA_INSTALL_CTA_CLICKED, label: 'PWA CTA Clicked' },
  { event_name: ANALYTICS_EVENTS.PWA_INSTALL_PROMPT_ACCEPTED, label: 'PWA Prompt Accepted' },
];

const PUSH_DETAIL_DEFINITION: FunnelDefinition[] = [
  { event_name: ANALYTICS_EVENTS.PUSH_CARD_SHOWN, label: 'Push Card Shown' },
  { event_name: ANALYTICS_EVENTS.PUSH_PERMISSION_REQUESTED, label: 'Push Permission Requested' },
  { event_name: ANALYTICS_EVENTS.PUSH_PERMISSION_GRANTED, label: 'Push Permission Granted' },
  { event_name: ANALYTICS_EVENTS.PUSH_SUBSCRIBE_SUCCESS, label: 'Push Subscribe Success' },
];

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
  const rangeClamped = requestedSpan > MAX_RANGE_DAYS;
  const cappedToDay = rangeClamped ? addDays(fromBound.day, MAX_RANGE_DAYS - 1) : toBound.day;

  return {
    from: fromBound.day,
    to: cappedToDay,
    tz: params.get('tz') || KST_TZ,
    range_clamped: rangeClamped,
    fromIso: kstDayToUtcIso(fromBound.day),
    toExclusiveIso: kstDayToUtcIso(cappedToDay, true),
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

function pilotFiltersMeta(pilotCode: string | null | undefined): KpiResponseFilters | undefined {
  if (!pilotCode) return undefined;
  return { pilot_code: pilotCode, pilot_attribution_mode: 'runs_first_then_legacy' };
}

async function attachPersonKeysToRows(
  supabase: SupabaseClient,
  rows: AnalyticsEventRow[]
): Promise<EventWithPersonKey[]> {
  const anonIds = Array.from(
    new Set(rows.map((row) => row.anon_id).filter((value): value is string => Boolean(value)))
  );
  const linkMap = await fetchIdentityLinkMap(supabase, anonIds);

  return rows.map((row) => ({
    ...row,
    person_key: resolveAnalyticsPersonKeyForKpi(row, linkMap),
  }));
}

async function fetchAnalyticsEvents(
  supabase: SupabaseClient,
  range: KpiRange,
  eventNames: string[]
): Promise<EventWithPersonKey[]> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select(
      'id, created_at, event_name, source, anon_id, user_id, public_result_id, route_path, route_group, kst_day, props, session_number'
    )
    .gte('created_at', range.fromIso)
    .lt('created_at', range.toExclusiveIso)
    .in('event_name', eventNames);

  if (error) {
    throw new Error('analytics_events_read_failed');
  }

  const rows = (data ?? []) as AnalyticsEventRow[];
  return attachPersonKeysToRows(supabase, rows);
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

function pilotFraction(numerator: number, denominator: number): KpiPilotFraction {
  return {
    numerator,
    denominator,
    rate_percent: percentage(numerator, denominator),
  };
}

/** 코호트 기준 이벤트 타임라인 순서: 이전 단계 시각 이후 첫 발생만 인정 → 단조 감소 보장 */
function buildSequentialCohortCounts(
  rows: EventWithPersonKey[],
  definitions: FunnelDefinition[],
): number[] {
  const byPerson = new Map<string, EventWithPersonKey[]>();
  for (const row of rows) {
    const list = byPerson.get(row.person_key) ?? [];
    list.push(row);
    byPerson.set(row.person_key, list);
  }
  for (const list of byPerson.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  const baseEv = definitions[0].event_name;
  let eligible = new Set<string>();
  let cursorByPerson = new Map<string, string>();

  for (const [pk, events] of byPerson) {
    const baseHits = events.filter((e) => e.event_name === baseEv);
    if (baseHits.length === 0) continue;
    let firstBase = baseHits[0];
    for (const h of baseHits) {
      if (h.created_at < firstBase.created_at) firstBase = h;
    }
    eligible.add(pk);
    cursorByPerson.set(pk, firstBase.created_at);
  }

  const counts: number[] = [];

  for (let i = 0; i < definitions.length; i++) {
    counts.push(eligible.size);

    if (i === definitions.length - 1) break;

    const nextEv = definitions[i + 1].event_name;
    const nextEligible = new Set<string>();
    const nextCursor = new Map<string, string>();

    for (const pk of eligible) {
      const cursor = cursorByPerson.get(pk);
      if (!cursor) continue;
      const events = byPerson.get(pk);
      if (!events) continue;
      const hit = events.find((e) => e.event_name === nextEv && e.created_at >= cursor);
      if (hit) {
        nextEligible.add(pk);
        nextCursor.set(pk, hit.created_at);
      }
    }

    eligible = nextEligible;
    cursorByPerson = nextCursor;
  }

  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[i - 1]) {
      console.warn('[admin-kpi] cohort counts not monotone — algorithm bug?', {
        definitions: definitions.map((d) => d.event_name),
        counts,
      });
    }
  }

  return counts;
}

function mapCountsToCohortSteps(
  definitions: FunnelDefinition[],
  counts: number[],
): KpiCohortFunnelStep[] {
  const base_count = counts[0] ?? 0;

  return definitions.map((def, index) => {
    const count = counts[index] ?? 0;
    const previous_count = index === 0 ? null : counts[index - 1] ?? 0;

    const conversion_from_start = percentage(count, base_count);
    const conversion_from_previous =
      previous_count === null || previous_count <= 0 ? null : percentage(count, previous_count);

    if (
      (conversion_from_start != null && conversion_from_start > 100.05) ||
      (conversion_from_previous != null && conversion_from_previous > 100.05)
    ) {
      console.warn('[admin-kpi] cohort conversion exceeds 100% — check ordering', {
        event_name: def.event_name,
        count,
        base_count,
        previous_count,
        conversion_from_start,
        conversion_from_previous,
      });
    }

    let dropoff_count_from_previous: number | null = null;
    let dropoff_rate_from_previous: number | null = null;
    if (previous_count !== null) {
      dropoff_count_from_previous = Math.max(0, previous_count - count);
      dropoff_rate_from_previous =
        previous_count <= 0 ? null : percentage(dropoff_count_from_previous, previous_count);
    }

    return {
      event_name: def.event_name,
      label: def.label,
      count,
      base_count,
      previous_count,
      conversion_from_start,
      conversion_from_previous,
      dropoff_count_from_previous,
      dropoff_rate_from_previous,
    };
  });
}

function buildActivitySteps(rows: EventWithPersonKey[], definitions: FunnelDefinition[]): KpiActivityStep[] {
  return definitions.map((def) => ({
    event_name: def.event_name,
    label: def.label,
    count: distinctCountForEvent(rows, def.event_name),
  }));
}

function buildCohortAndActivityForFunnel(
  rows: EventWithPersonKey[],
  funnel: KpiFunnelKey,
): {
  cohort_steps: KpiCohortFunnelStep[];
  activity_steps: KpiActivityStep[];
} {
  const scoped = funnel === 'first_session' ? filterFirstSessionRows(rows) : rows;
  const cohortDefs = cohortDefinitionsFor(funnel);
  const counts = buildSequentialCohortCounts(scoped, cohortDefs);
  const cohort_steps = mapCountsToCohortSteps(cohortDefs, counts);
  const activity_steps = buildActivitySteps(scoped, activityDefinitionsFor(funnel));
  return { cohort_steps, activity_steps };
}

function findTopDropoff(
  publicSteps: KpiCohortFunnelStep[],
  executionSteps: KpiCohortFunnelStep[],
  firstSessionSteps: KpiCohortFunnelStep[],
): KpiSummaryResponse['top_dropoff'] {
  const candidates: Array<NonNullable<KpiSummaryResponse['top_dropoff']>> = [];

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
        dropoff_count: Math.max(0, previous.count - current.count),
        dropoff_rate: current.dropoff_rate_from_previous,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.dropoff_count !== a.dropoff_count) return b.dropoff_count - a.dropoff_count;
    return (b.dropoff_rate ?? -1) - (a.dropoff_rate ?? -1);
  });

  return candidates[0] ?? null;
}

function computeWeightedRetentionRates(rows: KpiRetentionRow[]): {
  d1: number | null;
  d3: number | null;
  d7: number | null;
} {
  let d1ReturnedSum = 0, d1SizeSum = 0;
  let d3ReturnedSum = 0, d3SizeSum = 0;
  let d7ReturnedSum = 0, d7SizeSum = 0;

  for (const row of rows) {
    if (row.eligible_d1) { d1ReturnedSum += row.d1_returned; d1SizeSum += row.cohort_size; }
    if (row.eligible_d3) { d3ReturnedSum += row.d3_returned; d3SizeSum += row.cohort_size; }
    if (row.eligible_d7) { d7ReturnedSum += row.d7_returned; d7SizeSum += row.cohort_size; }
  }

  return {
    d1: percentage(d1ReturnedSum, d1SizeSum),
    d3: percentage(d3ReturnedSum, d3SizeSum),
    d7: percentage(d7ReturnedSum, d7SizeSum),
  };
}

function buildKpiMeta(range: KpiRange, limitations?: string[]): {
  generated_at: string;
  source: 'raw_events';
  limitations?: string[];
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
} {
  return {
    generated_at: new Date().toISOString(),
    source: 'raw_events',
    limitations: limitations && limitations.length > 0 ? limitations : undefined,
    range: {
      from: range.from,
      to: range.to,
      tz: range.tz,
      range_clamped: range.range_clamped,
    },
  };
}

function getRetentionCohortRows(
  rows: EventWithPersonKey[],
  cohort: KpiCohortKey,
  todayKst: string
): KpiRetentionRow[] {
  const cohortEvent = cohort === 'app_home'
    ? ANALYTICS_EVENTS.APP_HOME_VIEWED
    : ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS;

  const cohortRows = rows
    .filter((row) => {
      if (row.event_name !== cohortEvent) return false;
      // first_session_complete: session_number === 1 엄격 적용.
      // session_number null/undefined 는 미확인 세션으로 코호트에서 제외.
      if (cohort === 'first_session_complete' && row.session_number !== 1) return false;
      return true;
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const firstCohortByPerson = new Map<string, string>();
  for (const row of cohortRows) {
    if (row.kst_day && !firstCohortByPerson.has(row.person_key)) {
      firstCohortByPerson.set(row.person_key, row.kst_day);
    }
  }

  // 복귀일 집합 — 코호트 자격 이벤트 당일 활동은 D1 판정에서 자동 제외됨
  // (D1 = cohort_day+1 이므로 당일 return 은 어떤 Dk 에도 해당하지 않음).
  const returnDaysByPerson = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.kst_day || !RETURN_EVENT_SET.has(row.event_name)) continue;
    const current = returnDaysByPerson.get(row.person_key) ?? new Set<string>();
    current.add(row.kst_day);
    returnDaysByPerson.set(row.person_key, current);
  }

  type RetentionAccumulator = {
    cohort_day: string;
    cohort_size: number;
    d1_returned: number;
    d3_returned: number;
    d7_returned: number;
  };

  const grouped = new Map<string, RetentionAccumulator>();
  for (const [personKey, cohortDay] of firstCohortByPerson.entries()) {
    const row = grouped.get(cohortDay) ?? {
      cohort_day: cohortDay,
      cohort_size: 0,
      d1_returned: 0,
      d3_returned: 0,
      d7_returned: 0,
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
    .map((acc): KpiRetentionRow => {
      const eligible_d1 = addDays(acc.cohort_day, 1) <= todayKst;
      const eligible_d3 = addDays(acc.cohort_day, 3) <= todayKst;
      const eligible_d7 = addDays(acc.cohort_day, 7) <= todayKst;
      return {
        cohort_day: acc.cohort_day,
        cohort_size: acc.cohort_size,
        d1_returned: acc.d1_returned,
        d1_rate: eligible_d1 ? percentage(acc.d1_returned, acc.cohort_size) : null,
        d3_returned: acc.d3_returned,
        d3_rate: eligible_d3 ? percentage(acc.d3_returned, acc.cohort_size) : null,
        d7_returned: acc.d7_returned,
        d7_rate: eligible_d7 ? percentage(acc.d7_returned, acc.cohort_size) : null,
        eligible_d1,
        eligible_d3,
        eligible_d7,
      };
    });
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

function getPropString(row: EventWithPersonKey, key: string): string | null {
  const value = row.props?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPropNumber(row: EventWithPersonKey, key: string): number | null {
  const value = row.props?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function countByMovement(rows: EventWithPersonKey[], eventName: string) {
  const counts = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.event_name !== eventName) continue;
    const movementKey = getPropString(row, 'movement_key');
    if (!movementKey) continue;
    const current = counts.get(movementKey) ?? new Set<string>();
    current.add(row.person_key);
    counts.set(movementKey, current);
  }
  return Array.from(counts.entries())
    .map(([movement_key, persons]) => ({ movement_key, count: persons.size }))
    .sort((a, b) => b.count - a.count || a.movement_key.localeCompare(b.movement_key));
}

function countByReason(rows: EventWithPersonKey[], eventName: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.event_name !== eventName) continue;
    const reason = getPropString(row, 'reason') ?? 'unknown';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function buildExerciseIndexRows(rows: EventWithPersonKey[]) {
  const grouped = new Map<number, {
    exercise_index: number;
    opened: number;
    logged: number;
    next_clicked: number;
    closed: number;
  }>();

  for (const row of rows) {
    const exerciseIndex = getPropNumber(row, 'exercise_index');
    if (exerciseIndex == null) continue;
    const current = grouped.get(exerciseIndex) ?? {
      exercise_index: exerciseIndex,
      opened: 0,
      logged: 0,
      next_clicked: 0,
      closed: 0,
    };
    if (row.event_name === ANALYTICS_EVENTS.EXERCISE_PLAYER_OPENED) current.opened += 1;
    if (row.event_name === ANALYTICS_EVENTS.EXERCISE_LOGGED) current.logged += 1;
    if (row.event_name === ANALYTICS_EVENTS.EXERCISE_NEXT_CLICKED) current.next_clicked += 1;
    if (row.event_name === ANALYTICS_EVENTS.EXERCISE_PLAYER_CLOSED) current.closed += 1;
    grouped.set(exerciseIndex, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.exercise_index - b.exercise_index);
}

export async function getKpiSummary(
  supabase: SupabaseClient,
  range: KpiRange,
  pilotCode?: string | null
): Promise<KpiSummaryResponse> {
  const todayKst = formatKstDay(new Date());
  const eventNames = allKpiDashboardEventNames();
  const rowsAll = await fetchAnalyticsEvents(supabase, range, eventNames);
  const rows = await filterRowsByPilotCode(rowsAll, pilotCode ?? null, { range });

  const { cohort_steps: pubCohort } = buildCohortAndActivityForFunnel(rows, 'public');
  const { cohort_steps: exCohort } = buildCohortAndActivityForFunnel(rows, 'execution');
  const { cohort_steps: fsCohort } = buildCohortAndActivityForFunnel(rows, 'first_session');

  const appHomeRetention = getRetentionCohortRows(rows, 'app_home', todayKst);
  const weightedRetention = computeWeightedRetentionRates(appHomeRetention);

  const demographics = await computeKpiDemographicsSummary(supabase, range, rows);

  const landing_visitors = distinctCountForEvent(rows, ANALYTICS_EVENTS.LANDING_VIEWED);
  const test_start_clickers = distinctCountForEvent(rows, ANALYTICS_EVENTS.PUBLIC_CTA_CLICKED);

  const pc = (i: number) => pubCohort[i]?.count ?? 0;
  const ec = (i: number) => exCohort[i]?.count ?? 0;
  const fc = (i: number) => fsCohort[i]?.count ?? 0;

  const summaryLimitations = [
    'cohort_funnel_ordered_by_person_timeline',
    'activity_counts_are_event_independent_distinct',
    'retention_rates_use_weighted_eligible_cohorts',
    'immature_retention_cohorts_are_excluded_from_rates',
    ...(pilotCode ? (['kpi_rows_filtered_by_pilot_code_runs_first_then_legacy'] as const) : []),
  ];

  return {
    ok: true,
    ...buildKpiMeta(range, [...summaryLimitations]),
    filters: pilotFiltersMeta(pilotCode ?? null),
    cards: {
      landing_visitors,
      test_start_clickers,
      /** 무료 퍼널 요약은 테스트 시작 클릭 코호트(pc[0])를 공통 분모로 둠 */
      survey_completed_vs_started: pilotFraction(pc(2), pc(0)),
      result_viewed_vs_survey_completed: pilotFraction(pc(3), pc(0)),
      execution_click_vs_result_viewed: pilotFraction(pc(4), pc(0)),
      checkout_vs_execution_click: pilotFraction(ec(2), ec(0)),
      onboarding_vs_checkout: pilotFraction(ec(3), ec(2)),
      session_create_vs_claim: pilotFraction(ec(5), ec(4)),
      first_session_complete_vs_created: pilotFraction(fc(5), fc(0)),
      app_home_vs_execution_click: pilotFraction(ec(6), ec(0)),
      d1_return_rate: weightedRetention.d1,
      d3_return_rate: weightedRetention.d3,
      d7_return_rate: weightedRetention.d7,
    },
    top_dropoff: findTopDropoff(pubCohort, exCohort, fsCohort),
    demographics,
  };
}

export async function getKpiFunnel(
  supabase: SupabaseClient,
  range: KpiRange,
  funnel: KpiFunnelKey,
  pilotCode?: string | null
): Promise<KpiFunnelResponse> {
  const activityDefs = activityDefinitionsFor(funnel);
  const eventNames = Array.from(new Set(activityDefs.map((item) => item.event_name)));
  const rowsAll = await fetchAnalyticsEvents(supabase, range, eventNames);
  const rows = await filterRowsByPilotCode(rowsAll, pilotCode ?? null, { range });
  const { cohort_steps, activity_steps } = buildCohortAndActivityForFunnel(rows, funnel);
  const cohortDefs = cohortDefinitionsFor(funnel);
  const baseDef = cohortDefs[0];

  return {
    ok: true,
    ...buildKpiMeta(
      range,
      pilotCode ? ['kpi_rows_filtered_by_pilot_code_runs_first_then_legacy'] : undefined
    ),
    filters: pilotFiltersMeta(pilotCode ?? null),
    funnel,
    cohort_base_label: baseDef.label,
    cohort_base_event_name: baseDef.event_name,
    cohort_steps,
    activity_steps,
  };
}

export async function getKpiRetention(
  supabase: SupabaseClient,
  range: KpiRange,
  cohort: KpiCohortKey,
  pilotCode?: string | null
): Promise<KpiRetentionResponse> {
  const todayKst = formatKstDay(new Date());
  const eventNames = Array.from(RETURN_EVENT_SET);
  const required = cohort === 'app_home'
    ? [ANALYTICS_EVENTS.APP_HOME_VIEWED]
    : [ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS];
  const rowsAll = await fetchAnalyticsEvents(
    supabase,
    range,
    Array.from(new Set([...eventNames, ...required]))
  );
  const rows = await filterRowsByPilotCode(rowsAll, pilotCode ?? null, { range });

  return {
    ok: true,
    ...buildKpiMeta(range, [
      'immature_retention_cohorts_are_excluded_from_rates',
      ...(pilotCode ? ['kpi_rows_filtered_by_pilot_code_runs_first_then_legacy'] : []),
    ]),
    filters: pilotFiltersMeta(pilotCode ?? null),
    cohort,
    rows: getRetentionCohortRows(rows, cohort, todayKst),
  };
}

export async function getKpiDetails(
  supabase: SupabaseClient,
  range: KpiRange,
  pilotCode?: string | null
): Promise<KpiDetailsResponse> {
  const eventNames = Array.from(
    new Set([
      ...SESSION_DETAIL_DEFINITION.map((item) => item.event_name),
      ANALYTICS_EVENTS.EXERCISE_PLAYER_CLOSED,
      ...CAMERA_DETAIL_DEFINITION.map((item) => item.event_name),
      ANALYTICS_EVENTS.CAMERA_REFINE_FAILED_OR_FALLBACK,
      ...PWA_DETAIL_DEFINITION.map((item) => item.event_name),
      ANALYTICS_EVENTS.PWA_INSTALL_PROMPT_DISMISSED,
      ...PUSH_DETAIL_DEFINITION.map((item) => item.event_name),
      ANALYTICS_EVENTS.PUSH_PERMISSION_DENIED,
      ANALYTICS_EVENTS.PUSH_SUBSCRIBE_FAILED,
    ])
  );

  const rowsAll = await fetchAnalyticsEvents(supabase, range, eventNames);
  const rows = await filterRowsByPilotCode(rowsAll, pilotCode ?? null, { range });

  return {
    ok: true,
    ...buildKpiMeta(range, [
      'exercise_index_table_is_event_count_not_person_distinct',
      ...(pilotCode ? ['kpi_rows_filtered_by_pilot_code_runs_first_then_legacy'] : []),
    ]),
    filters: pilotFiltersMeta(pilotCode ?? null),
    session_detail: {
      steps: buildActivitySteps(filterFirstSessionRows(rows), SESSION_DETAIL_DEFINITION),
      close_before_complete_count: distinctCountForEvent(rows, ANALYTICS_EVENTS.EXERCISE_PLAYER_CLOSED),
      by_exercise_index: buildExerciseIndexRows(rows),
      metric_note: '운동 index 표는 이벤트 건수 기준입니다. Steps 는 person-distinct 기준.',
    },
    camera: {
      steps: buildActivitySteps(rows, CAMERA_DETAIL_DEFINITION),
      step_completed_by_movement: countByMovement(rows, ANALYTICS_EVENTS.CAMERA_STEP_COMPLETED),
      fallback_reasons: countByReason(rows, ANALYTICS_EVENTS.CAMERA_REFINE_FAILED_OR_FALLBACK),
    },
    pwa: {
      steps: buildActivitySteps(rows, PWA_DETAIL_DEFINITION),
    },
    push: {
      steps: buildActivitySteps(rows, PUSH_DETAIL_DEFINITION),
      denied_count: distinctCountForEvent(rows, ANALYTICS_EVENTS.PUSH_PERMISSION_DENIED),
    },
  };
}

export async function getKpiRawEvents(
  supabase: SupabaseClient,
  range: KpiRange,
  eventName: string | null,
  limitInput: string | null,
  cursor: string | null,
  pilotCode?: string | null
): Promise<KpiRawEventsResponse> {
  const limit = Math.min(
    RAW_EVENTS_MAX_LIMIT,
    Math.max(1, Number.parseInt(limitInput ?? `${RAW_EVENTS_DEFAULT_LIMIT}`, 10) || RAW_EVENTS_DEFAULT_LIMIT)
  );

  let query = supabase
    .from('analytics_events')
    .select(
      'id, created_at, event_name, source, anon_id, user_id, public_result_id, route_path, route_group, kst_day, props, session_number'
    )
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
  const pageWindow = rows.slice(0, limit);
  const withPersonKey = await attachPersonKeysToRows(supabase, pageWindow);
  const filtered = await filterRowsByPilotCode(withPersonKey, pilotCode ?? null, { range });

  const rawLimitations = pilotCode
    ? ['raw_events_time_window_unchanged_pilot_may_reduce_visible_rows']
    : undefined;

  return {
    ok: true,
    ...buildKpiMeta(range, rawLimitations),
    filters: pilotFiltersMeta(pilotCode ?? null),
    events: filtered.map((row): KpiRawEventRow => ({
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
