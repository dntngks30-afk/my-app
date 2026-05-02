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
  EXERCISE_LOGGED: 'exercise_logged',
  EXERCISE_NEXT_CLICKED: 'exercise_next_clicked',
  EXERCISE_SKIPPED: 'exercise_skipped',
  EXERCISE_PLAYER_CLOSED: 'exercise_player_closed',
  SESSION_COMPLETE_CLICKED: 'session_complete_clicked',
  SESSION_COMPLETE_BLOCKED: 'session_complete_blocked',
  CAMERA_FLOW_STARTED: 'camera_flow_started',
  CAMERA_SETUP_VIEWED: 'camera_setup_viewed',
  CAMERA_STEP_STARTED: 'camera_step_started',
  CAMERA_STEP_COMPLETED: 'camera_step_completed',
  CAMERA_REFINE_COMPLETED: 'camera_refine_completed',
  CAMERA_REFINE_FAILED_OR_FALLBACK: 'camera_refine_failed_or_fallback',
  PWA_INSTALL_CARD_SHOWN: 'pwa_install_card_shown',
  PWA_INSTALL_CTA_CLICKED: 'pwa_install_cta_clicked',
  PWA_INSTALL_DISMISSED: 'pwa_install_dismissed',
  PWA_INSTALL_PROMPT_ACCEPTED: 'pwa_install_prompt_accepted',
  PWA_INSTALL_PROMPT_DISMISSED: 'pwa_install_prompt_dismissed',
  PUSH_CARD_SHOWN: 'push_card_shown',
  PUSH_PERMISSION_REQUESTED: 'push_permission_requested',
  PUSH_PERMISSION_GRANTED: 'push_permission_granted',
  PUSH_PERMISSION_DENIED: 'push_permission_denied',
  PUSH_SUBSCRIBE_SUCCESS: 'push_subscribe_success',
  PUSH_SUBSCRIBE_FAILED: 'push_subscribe_failed',
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
