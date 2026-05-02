export type KpiFunnelKey = 'public' | 'execution' | 'first_session';

export type KpiCohortKey = 'app_home' | 'first_session_complete';

export type KpiRange = {
  from: string;
  to: string;
  tz: string;
  fromIso: string;
  toExclusiveIso: string;
  range_clamped?: boolean;
};

export type KpiSummaryResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  limitations?: string[];
  cards: {
    visitors: number;
    test_start_rate: number | null;
    survey_completion_rate: number | null;
    result_view_rate: number | null;
    result_to_execution_rate: number | null;
    checkout_success_rate: number | null;
    onboarding_completion_rate: number | null;
    session_create_rate: number | null;
    first_session_completion_rate: number | null;
    d1_return_rate: number | null;
    d3_return_rate: number | null;
    d7_return_rate: number | null;
  };
  top_dropoff: {
    funnel: KpiFunnelKey;
    from_event: string;
    to_event: string;
    dropoff_count: number;
    dropoff_rate: number | null;
  } | null;
};

export type KpiFunnelStep = {
  event_name: string;
  label: string;
  count: number;
  conversion_from_previous: number | null;
  conversion_from_start: number | null;
  dropoff_count: number | null;
  dropoff_rate: number | null;
};

export type KpiFunnelResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  limitations?: string[];
  funnel: KpiFunnelKey;
  steps: KpiFunnelStep[];
};

export type KpiRetentionRow = {
  cohort_day: string;
  cohort_size: number;
  d1_returned: number;
  /** null when cohort is not yet eligible for D1 measurement (cohort_day+1 > today) */
  d1_rate: number | null;
  d3_returned: number;
  /** null when cohort is not yet eligible for D3 measurement (cohort_day+3 > today) */
  d3_rate: number | null;
  d7_returned: number;
  /** null when cohort is not yet eligible for D7 measurement (cohort_day+7 > today) */
  d7_rate: number | null;
  /** true when cohort_day+1 <= today_kst */
  eligible_d1: boolean;
  /** true when cohort_day+3 <= today_kst */
  eligible_d3: boolean;
  /** true when cohort_day+7 <= today_kst */
  eligible_d7: boolean;
};

export type KpiRetentionResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  limitations?: string[];
  cohort: KpiCohortKey;
  rows: KpiRetentionRow[];
};

export type KpiRawEventRow = {
  id: string;
  created_at: string;
  event_name: string;
  source: 'client' | 'server';
  anon_id_preview: string | null;
  user_id_preview: string | null;
  route_path: string | null;
  route_group: string | null;
  kst_day: string | null;
  props_preview: Record<string, unknown>;
};

export type KpiRawEventsResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  limitations?: string[];
  events: KpiRawEventRow[];
  nextCursor: string | null;
};

export type KpiDetailExerciseRow = {
  exercise_index: number;
  opened: number;
  logged: number;
  next_clicked: number;
  closed: number;
};

export type KpiDetailReasonRow = {
  reason: string;
  count: number;
};

export type KpiDetailMovementRow = {
  movement_key: string;
  count: number;
};

export type KpiDetailsResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  limitations?: string[];
  session_detail: {
    steps: KpiFunnelStep[];
    close_before_complete_count: number;
    by_exercise_index: KpiDetailExerciseRow[];
    /** 집계 단위 설명 — steps 는 person-distinct, by_exercise_index 는 이벤트 건수 기준 */
    metric_note?: string;
  };
  camera: {
    steps: KpiFunnelStep[];
    step_completed_by_movement: KpiDetailMovementRow[];
    fallback_reasons: KpiDetailReasonRow[];
  };
  pwa: {
    steps: KpiFunnelStep[];
  };
  push: {
    steps: KpiFunnelStep[];
    denied_count: number;
  };
};
