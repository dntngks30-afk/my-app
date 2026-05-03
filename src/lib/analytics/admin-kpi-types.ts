export type KpiPilotFilter = {
  pilot_code: string | null;
};

export type KpiResponseFilters = {
  pilot_code?: string;
  pilot_attribution_mode?: 'direct_or_profile';
};

export type KpiDemographicBucketRow = {
  key: string;
  label: string;
  count: number;
  ratio: number;
  low_sample?: boolean;
};

export type KpiIntroDemographicStepSummary = {
  step: string;
  label_ko: string;
  sample_size: number;
  by_age_band: KpiDemographicBucketRow[];
  by_gender: KpiDemographicBucketRow[];
};

export type KpiSignupDemographicStepSummary = {
  step: string;
  label_ko: string;
  sample_size: number;
  by_age_band: KpiDemographicBucketRow[];
  by_acquisition_source: KpiDemographicBucketRow[];
};

export type KpiDemographicsSummary = {
  limitations: string[];
  coverage?: {
    free_test_intro: {
      profile_rows_matched: number;
      unknown_age_or_gender_count: number;
    };
    signup_profile: {
      profile_rows_matched: number;
      unknown_signup_profile_count: number;
    };
    pilot_profile_rows_count: number;
  };
  /** 무료테스트 인트로(public_test_profiles · free_test_intro) — 성별·나이대만 */
  free_test_intro: {
    limitations: string[];
    funnel_steps: KpiIntroDemographicStepSummary[];
  };
  /** 회원가입(signup_profiles · signup_profile) — 생년월일 기반 연령대·유입경로 */
  signup_profile: {
    limitations: string[];
    funnel_steps: KpiSignupDemographicStepSummary[];
  };
};

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

/** 파일럿 카드용 — 분모·분자와 함께 표시 */
export type KpiPilotFraction = {
  rate_percent: number | null;
  numerator: number;
  denominator: number;
};

export type KpiSummaryResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  filters?: KpiResponseFilters;
  limitations?: string[];
  cards: {
    landing_visitors: number;
    test_start_clickers: number;
    survey_completed_vs_started: KpiPilotFraction;
    result_viewed_vs_survey_completed: KpiPilotFraction;
    execution_click_vs_result_viewed: KpiPilotFraction;
    checkout_vs_execution_click: KpiPilotFraction;
    onboarding_vs_checkout: KpiPilotFraction;
    session_create_vs_claim: KpiPilotFraction;
    first_session_complete_vs_created: KpiPilotFraction;
    app_home_vs_execution_click: KpiPilotFraction;
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
  demographics?: KpiDemographicsSummary;
};

/** 기간 내 이벤트별 고유 사용자 수 — 순차 전환율 없음 */
export type KpiActivityStep = {
  event_name: string;
  label: string;
  count: number;
};

/** 첫 단계 코호트 기준 순차 도달 — 전환율은 항상 코호트 내 부분집합 */
export type KpiCohortFunnelStep = {
  event_name: string;
  label: string;
  count: number;
  base_count: number;
  previous_count: number | null;
  conversion_from_start: number | null;
  conversion_from_previous: number | null;
  dropoff_count_from_previous: number | null;
  dropoff_rate_from_previous: number | null;
};

export type KpiFunnelResponse = {
  ok: true;
  range: { from: string; to: string; tz: string; range_clamped?: boolean };
  generated_at: string;
  source: 'raw_events' | 'daily_rollup' | 'mixed';
  filters?: KpiResponseFilters;
  limitations?: string[];
  funnel: KpiFunnelKey;
  cohort_base_label: string;
  cohort_base_event_name: string;
  cohort_steps: KpiCohortFunnelStep[];
  activity_steps: KpiActivityStep[];
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
  filters?: KpiResponseFilters;
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
  filters?: KpiResponseFilters;
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
  filters?: KpiResponseFilters;
  limitations?: string[];
  session_detail: {
    steps: KpiActivityStep[];
    close_before_complete_count: number;
    by_exercise_index: KpiDetailExerciseRow[];
    /** 집계 단위 설명 — steps 는 person-distinct, by_exercise_index 는 이벤트 건수 기준 */
    metric_note?: string;
  };
  camera: {
    steps: KpiActivityStep[];
    step_completed_by_movement: KpiDetailMovementRow[];
    fallback_reasons: KpiDetailReasonRow[];
  };
  pwa: {
    steps: KpiActivityStep[];
  };
  push: {
    steps: KpiActivityStep[];
    denied_count: number;
  };
};
