import type { NextRequest } from 'next/server';
import type { SessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import type { getServerSupabaseAdmin } from '@/lib/supabase';
import type { Phase, PhaseLengths, PhasePolicyOptions } from '@/lib/session/phase';
import type { AdaptiveModifiers, AdaptationTrace } from '@/lib/session/adaptive-progression';
import type { AdaptiveModifier } from '@/lib/session/adaptive-modifier-resolver';
import type { ResolvedAdaptivePlanControls } from '@/lib/session/adaptive-merge';
import type { SessionAnalysisSourceMode } from '@/lib/session/resolveSessionAnalysisInput';
import type {
  ConditionMood,
  TimeBudget,
  PlanJsonOutput,
} from '@/lib/session/plan-generator';
import type { ExerciseExperienceLevel } from '@/lib/session/profile';
import type { AlignmentAuditTrace } from '@/lib/session/session-snapshot';

export type SessionCreateAdminClient = ReturnType<typeof getServerSupabaseAdmin>;

export type SessionCreateTimings = Record<string, number>;

export type { AdaptiveModifier, AdaptationTrace };

export type SessionCreateRequestBody = {
  conditionMood: ConditionMood;
  timeBudget: TimeBudget;
  painFlags: string[];
  equipment: string;
  isDebug: boolean;
};

export type SessionCreatePlanRow = {
  session_number: number;
  status: string;
  theme: string;
  plan_json: unknown;
  condition: unknown;
};

export type SessionCreateProgressRow = {
  user_id: string;
  total_sessions: number;
  completed_sessions: number;
  active_session_number: number | null;
  last_completed_day_key?: string | null;
} & Record<string, unknown>;

export type ResolvedTotalSessions = {
  totalSessions: number;
  source: 'profile' | 'default';
  profile: { target_frequency?: number; exercise_experience_level?: string | null } | null;
};

export type RequestGateContinue = {
  kind: 'continue';
  req: NextRequest;
  userId: string;
  supabase: SessionCreateAdminClient;
  timings: SessionCreateTimings;
  t0: number;
  requestBody: SessionCreateRequestBody;
};

export type RequestGateResult =
  | RequestGateContinue
  | { kind: 'auth_required' }
  | { kind: 'request_deduped' };

export type ProgressGateContinue = {
  kind: 'continue';
  req: NextRequest;
  userId: string;
  supabase: SessionCreateAdminClient;
  timings: SessionCreateTimings;
  t0: number;
  requestBody: SessionCreateRequestBody;
  progress: SessionCreateProgressRow;
  resolved: ResolvedTotalSessions;
  nextSessionNumber: number;
  todayCompleted: boolean;
  nextUnlockAt: string | null;
};

export type ProgressGateResult =
  | ProgressGateContinue
  | { kind: 'frequency_required' }
  | { kind: 'progress_init_failed' }
  | { kind: 'program_finished' }
  | { kind: 'daily_limit_reached'; nextUnlockAt: string }
  | {
      kind: 'active_idempotent';
      progress: SessionCreateProgressRow;
      existingPlan: SessionCreatePlanRow | null;
      todayCompleted: boolean;
      nextUnlockAt: string | null;
    };

export type GenerationInputContinue = ProgressGateContinue & {
  kind: 'continue';
  deepSummary: SessionDeepSummary;
  analysisSourceMode: SessionAnalysisSourceMode;
  sourcePublicResultId: string | null;
  /** PR-PILOT-BASELINE-SESSION-ALIGN-01: public result(baseline 또는 refined)가 truth owner인지 */
  isPublicResultTruthOwner: boolean;
  /** PR-PILOT-BASELINE-SESSION-ALIGN-01: fallback 사용 시 이유 */
  fallbackReason: string | null;
  totalSessionsForPhase: number;
  policyOptions: PhasePolicyOptions;
  phaseLengths: PhaseLengths;
  phase: Phase;
  theme: string;
  usedTemplateIds: string[];
  modifiers: AdaptiveModifiers;
  summary: {
    id?: string;
    completion_ratio: number;
    skipped_exercises: number;
    dropout_risk_score: number;
    discomfort_burden_score: number;
    flags: string[];
    avg_rpe: number | null;
    avg_discomfort: number | null;
    created_at: string;
  } | null;
  adaptiveModifier: AdaptiveModifier;
  mergedControls: ResolvedAdaptivePlanControls;
  mergedVolume: number | undefined;
  adaptiveCtx: {
    priority_vector: Record<string, number> | null;
    pain_mode: 'none' | 'caution' | 'protected' | null;
  };
  sourceSessionNumbers: number[];
  exerciseExperienceForSession1?: ExerciseExperienceLevel;
  effectivePainFlags: string[];
  cacheInput: {
    userId: string;
    sessionNumber: number;
    totalSessions: number;
    phase: number;
    theme: string;
    timeBudget: string;
    conditionMood: string;
    focus: string[];
    avoid: string[];
    painFlags: string[];
    usedTemplateIds: string[];
    adaptiveOverlay?: Record<string, unknown>;
    volumeModifier?: number;
    priority_vector?: Record<string, number> | null;
    pain_mode?: string | null;
    exercise_experience_level?: ExerciseExperienceLevel | null;
    survey_session_hints?: unknown | null;
    session_camera_translation?: unknown | null;
    /** PR-PILOT-BASELINE-SESSION-ALIGN-01 */
    baseline_session_anchor?: string | null;
  };
};

export type GenerationInputResult =
  | GenerationInputContinue
  | { kind: 'analysis_input_unavailable' };

export type PlanMaterializeResult = GenerationInputContinue & {
  planJson: PlanJsonOutput | Record<string, unknown>;
  condition: {
    condition_mood: ConditionMood;
    time_budget: TimeBudget;
    pain_flags: string[];
    equipment: string;
  };
  deepSummarySnapshot: Record<string, unknown>;
  profileSnapshot: Record<string, unknown>;
  adaptationTrace: AdaptationTrace;
  generationTrace: Record<string, unknown> & { alignment_audit?: AlignmentAuditTrace };
  planPayload: {
    user_id: string;
    session_number: number;
    status: 'draft';
    theme: string;
    plan_json: PlanJsonOutput | Record<string, unknown>;
    condition: {
      condition_mood: ConditionMood;
      time_budget: TimeBudget;
      pain_flags: string[];
      equipment: string;
    };
    plan_version: string;
    source_deep_attempt_id: string | null;
    deep_summary_snapshot_json: Record<string, unknown>;
    profile_snapshot_json: Record<string, unknown>;
    generation_trace_json: Record<string, unknown> & { alignment_audit?: AlignmentAuditTrace };
  };
};

export type PersistenceCommitResult =
  | {
      kind: 'success';
      progress: SessionCreateProgressRow;
      plan: SessionCreatePlanRow;
      finalProgress: SessionCreateProgressRow;
      todayCompleted: boolean;
      nextUnlockAt: string | null;
    }
  | {
      kind: 'completed_conflict';
      progress: SessionCreateProgressRow;
      existingPlan: SessionCreatePlanRow;
      todayCompleted: boolean;
      nextUnlockAt: string | null;
    }
  | {
      kind: 'race_conflict';
      progress: SessionCreateProgressRow;
      racedPlan: SessionCreatePlanRow;
      finalProgress: SessionCreateProgressRow;
    }
  | { kind: 'plan_update_failed' }
  | { kind: 'plan_insert_failed' }
  | { kind: 'plan_missing' };
