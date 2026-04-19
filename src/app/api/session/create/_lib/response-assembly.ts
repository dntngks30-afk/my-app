import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { getKstDayKeyUTC, getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import type {
  AdaptiveModifier,
  PlanMaterializeResult,
  PersistenceCommitResult,
  ProgressGateResult,
  RequestGateResult,
  SessionCreatePlanRow,
  SessionCreateProgressRow,
  SessionCreateTimings,
} from './types';
import { toSummaryPlan } from './helpers';

const MSG_AUTH_REQUIRED = '\ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4';
const MSG_REQUEST_DEDUPED = '\uc694\uccad\uc774 \ucc98\ub9ac \uc911\uc785\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694';
const MSG_FREQUENCY_REQUIRED =
  '\uc8fc\ub2f9 \ubaa9\ud45c \ube48\ub3c4\ub97c \uba3c\uc800 \uc124\uc815\ud574 \uc8fc\uc138\uc694. \uc2ec\uce35 \ud14c\uc2a4\ud2b8 \uacb0\uacfc \ubcf4\uae30\uc5d0\uc11c \ube48\ub3c4\ub97c \uc120\ud0dd\ud55c \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.';
const MSG_PROGRESS_INIT_FAILED = '\uc9c4\ud589 \uc0c1\ud0dc \ucd08\uae30\ud654\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4';
const MSG_PROGRAM_FINISHED = '\ubaa8\ub4e0 \uc138\uc158\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4';
const MSG_DAILY_LIMIT_REACHED = '\uc624\ub298\uc740 \uc774\ubbf8 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4';
const MSG_ANALYSIS_INPUT_UNAVAILABLE =
  '\ubd84\uc11d \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. \ubb34\ub8cc \ud14c\uc2a4\ud2b8\ub97c \uc644\ub8cc\ud558\uac70\ub098 \uc2ec\uce35 \ud14c\uc2a4\ud2b8\ub97c \uba3c\uc800 \uc9c4\ud589\ud574 \uc8fc\uc138\uc694.';
const MSG_PLAN_UPDATE_FAILED = '\uc138\uc158 \ud50c\ub79c \uc5c5\ub370\uc774\ud2b8\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4';
const MSG_PLAN_INSERT_FAILED = '\uc138\uc158 \ud50c\ub79c \uc0dd\uc131\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4';
const MSG_PLAN_MISSING = '\uc138\uc158 \ud50c\ub79c\uc744 \uac00\uc838\uc62c \uc218 \uc5c6\uc2b5\ub2c8\ub2e4';
const MSG_INTERNAL = '\uc11c\ubc84 \uc624\ub958';

function buildIdempotentData(
  progress: SessionCreateProgressRow,
  activePlan: SessionCreatePlanRow | null,
  todayCompleted: boolean,
  nextUnlockAt: string | null,
  activePlanProfileGuard?: 'match' | 'snapshot_absent_reuse' | 'mismatch_reuse_unsafe'
) {
  const active = activePlan ? toSummaryPlan(activePlan) : null;
  return {
    progress,
    active,
    idempotent: true,
    today_completed: todayCompleted,
    ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }),
    ...(activePlanProfileGuard != null &&
      activePlan?.session_number === 1 && {
        active_plan_profile_guard: activePlanProfileGuard,
      }),
  };
}

export function assembleRequestGateResponse(result: RequestGateResult) {
  if (result.kind === 'auth_required') {
    return fail(401, ApiErrorCode.AUTH_REQUIRED, MSG_AUTH_REQUIRED);
  }
  return fail(409, ApiErrorCode.REQUEST_DEDUPED, MSG_REQUEST_DEDUPED);
}

export function assembleProgressGateResponse(result: Exclude<ProgressGateResult, { kind: 'continue' }>) {
  switch (result.kind) {
    case 'frequency_required':
      return fail(
        409,
        ApiErrorCode.FREQUENCY_REQUIRED,
        MSG_FREQUENCY_REQUIRED,
        { fallback_blocked: true, rail_ready: false }
      );
    case 'progress_init_failed':
      return fail(500, ApiErrorCode.INTERNAL_ERROR, MSG_PROGRESS_INIT_FAILED);
    case 'program_finished':
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, MSG_PROGRAM_FINISHED);
    case 'daily_limit_reached':
      return fail(
        409,
        ApiErrorCode.DAILY_LIMIT_REACHED,
        MSG_DAILY_LIMIT_REACHED,
        { next_unlock_at: result.nextUnlockAt, kst_day: getKstDayKeyUTC() },
        { next_unlock_at: result.nextUnlockAt }
      );
    case 'active_idempotent': {
      const data = buildIdempotentData(
        result.progress,
        result.existingPlan,
        result.todayCompleted,
        result.nextUnlockAt,
        result.activePlanProfileGuard
      );
      return ok(data, data);
    }
  }
}

export function assembleAnalysisUnavailableResponse() {
  return fail(404, ApiErrorCode.ANALYSIS_INPUT_UNAVAILABLE, MSG_ANALYSIS_INPUT_UNAVAILABLE);
}

function buildDebugExtras(
  timings: SessionCreateTimings,
  materialized: PlanMaterializeResult,
  adaptiveModifier: AdaptiveModifier,
  mergedVolume: number | undefined
) {
  const planJson = materialized.planJson as
    | {
        meta?: {
          constraint_engine?: {
            reasons?: unknown[];
            flags?: Record<string, boolean>;
            summary?: Record<string, unknown>;
            applied_rule_count?: number;
          };
        };
      }
    | undefined;

  return {
    debug: {
      ...timings,
      freq_source: materialized.resolved.source,
      profile_present: !!materialized.resolved.profile,
      target_frequency: materialized.resolved.profile?.target_frequency ?? null,
      ...(planJson?.meta?.constraint_engine && {
        constraint_engine: {
          reasons: planJson.meta.constraint_engine.reasons ?? [],
          flags: planJson.meta.constraint_engine.flags ?? {},
          summary: planJson.meta.constraint_engine.summary ?? {},
          applied_rule_count: planJson.meta.constraint_engine.applied_rule_count ?? 0,
        },
      }),
      ...(adaptiveModifier && {
        adaptive_modifier: {
          volume_modifier: adaptiveModifier.volume_modifier,
          complexity_cap: adaptiveModifier.complexity_cap,
          recovery_bias: adaptiveModifier.recovery_bias,
        },
      }),
      adaptive_consumption_trace: {
        summary_consumed: materialized.summary
          ? {
              id: materialized.summary.id,
              created_at: materialized.summary.created_at,
              flags: materialized.summary.flags,
            }
          : null,
        modifier: adaptiveModifier
          ? {
              volume_modifier: adaptiveModifier.volume_modifier,
              complexity_cap: adaptiveModifier.complexity_cap,
              recovery_bias: adaptiveModifier.recovery_bias,
            }
          : null,
        merged_controls: {
          targetLevelDelta: materialized.mergedControls.targetLevelDelta,
          forceShort: materialized.mergedControls.forceShort,
          forceRecovery: materialized.mergedControls.forceRecovery,
          avoidTemplateIds: materialized.mergedControls.avoidTemplateIds,
          maxDifficultyCap: materialized.mergedControls.maxDifficultyCap,
          volumeModifier: mergedVolume,
        },
        merge_reasons: materialized.mergedControls.reasons,
        sources: materialized.mergedControls.sources,
      },
    },
  };
}

export function assemblePersistenceResponse(
  result: Exclude<PersistenceCommitResult, { kind: 'success' }>
) {
  switch (result.kind) {
    case 'completed_conflict': {
      const data = buildIdempotentData(
        result.progress,
        result.existingPlan,
        result.todayCompleted,
        result.nextUnlockAt
      );
      return ok(data, data);
    }
    case 'race_conflict': {
      const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(result.finalProgress);
      const data = {
        progress: result.finalProgress,
        active: toSummaryPlan(result.racedPlan),
        idempotent: true,
        today_completed: todayCompleted,
        ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }),
      };
      return ok(data, data);
    }
    case 'plan_update_failed':
      return fail(500, ApiErrorCode.INTERNAL_ERROR, MSG_PLAN_UPDATE_FAILED);
    case 'plan_insert_failed':
      return fail(500, ApiErrorCode.INTERNAL_ERROR, MSG_PLAN_INSERT_FAILED);
    case 'plan_missing':
      return fail(500, ApiErrorCode.INTERNAL_ERROR, MSG_PLAN_MISSING);
  }
}

export function assembleSuccessResponse(
  materialized: PlanMaterializeResult & { timings: SessionCreateTimings },
  result: Extract<PersistenceCommitResult, { kind: 'success' }>
) {
  const active = toSummaryPlan(result.plan, materialized.adaptationTrace);
  const data = {
    progress: result.finalProgress,
    active,
    idempotent: false,
    today_completed: result.todayCompleted,
    ...(result.nextUnlockAt != null && { next_unlock_at: result.nextUnlockAt }),
  };

  const debugExtras = materialized.requestBody.isDebug
    ? buildDebugExtras(
        materialized.timings,
        materialized,
        materialized.adaptiveModifier,
        materialized.mergedVolume
      )
    : undefined;

  return ok(data, debugExtras);
}

export function assembleInternalErrorResponse() {
  return fail(500, ApiErrorCode.INTERNAL_ERROR, MSG_INTERNAL);
}
