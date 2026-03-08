/**
 * Bootstrap API response types — minimal summary for app init.
 * Read-only. No full plan_json, media URLs, or heavy payloads.
 */

export type BootstrapUserSummary = {
  id: string;
  plan_status: string | null;
  display_name: string;
  has_deep_result: boolean;
};

export type BootstrapHomeSummary = {
  current_session_number: number;
  total_sessions: number;
  completed_sessions: number;
  active_session_exists: boolean;
  active_session_status: string | null;
  last_completed_session_number: number | null;
};

export type BootstrapStatsSummary = {
  completed_sessions: number;
  completion_rate: number;
  streak_days: number;
  last_checkin_at: string | null;
};

export type BootstrapMySummary = {
  display_name: string;
  plan_status: string | null;
  program_label: string;
  joined_at: string | null;
};

export type BootstrapData = {
  user: BootstrapUserSummary;
  home: BootstrapHomeSummary;
  stats_summary: BootstrapStatsSummary;
  my_summary: BootstrapMySummary;
};

export type BootstrapDebugTimings = {
  auth_ms: number;
  user_ms: number;
  home_ms: number;
  stats_ms: number;
  my_ms: number;
  total_ms: number;
};
