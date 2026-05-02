export const ANALYTICS_EVENTS = {
  LANDING_VIEWED: 'landing_viewed',
  PUBLIC_CTA_CLICKED: 'public_cta_clicked',
  SURVEY_STARTED: 'survey_started',
  SURVEY_COMPLETED: 'survey_completed',
  REFINE_BRIDGE_CHOICE_CLICKED: 'refine_bridge_choice_clicked',
  RESULT_VIEWED: 'result_viewed',
  EXECUTION_CTA_CLICKED: 'execution_cta_clicked',
  AUTH_SUCCESS: 'auth_success',
  CHECKOUT_SUCCESS: 'checkout_success',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PUBLIC_RESULT_CLAIM_SUCCESS: 'public_result_claim_success',
  SESSION_CREATE_SUCCESS: 'session_create_success',
  APP_HOME_VIEWED: 'app_home_viewed',
  RESET_MAP_OPENED: 'reset_map_opened',
  SESSION_PANEL_OPENED: 'session_panel_opened',
  EXERCISE_PLAYER_OPENED: 'exercise_player_opened',
  SESSION_COMPLETE_SUCCESS: 'session_complete_success',
  ANALYTICS_SMOKE_TEST: 'analytics_smoke_test',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ANALYTICS_EVENT_NAMES = Object.values(
  ANALYTICS_EVENTS
) as readonly AnalyticsEventName[];

const ANALYTICS_EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && ANALYTICS_EVENT_NAME_SET.has(value);
}

