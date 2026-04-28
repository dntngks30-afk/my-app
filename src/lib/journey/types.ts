/**
 * GET /api/journey/summary 응답 계약 (PR-JOURNEY-BACKEND-01)
 */

export type JourneyMovementSource =
  | 'claimed_public_result'
  | 'legacy_paid_deep'
  | 'session_plan_meta'
  | 'none';

export type JourneyMovementTypeBlock = {
  primary_type: string;
  secondary_type: string | null;
  label: string;
  summary: string;
  source: JourneyMovementSource;
  analyzed_at: string | null;
};

export type JourneyRecent7dBlock = {
  window: { from: string; to: string };
  target_frequency: number;
  target_frequency_source: 'onboarding' | 'default';
  completed_count: number;
  completion_label: string;
  difficulty: {
    label: string;
    source_count: number;
    avg_score: number | null;
  };
  quality: {
    label: string;
    source_count: number;
    avg_score: number | null;
  };
  summary: string;
};

export type JourneySummaryResponse = {
  movement_type: JourneyMovementTypeBlock;
  recent_7d: JourneyRecent7dBlock;
};
