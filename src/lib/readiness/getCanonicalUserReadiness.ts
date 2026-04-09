/**
 * FLOW-07 — Canonical User Readiness (server-side read model)
 *
 * PR-FLOW-06: 계산 SSOT는 loadReadinessContext + 동일 컨텍스트 매핑.
 * 이 파일은 레거시 CanonicalUserReadiness 형태를 유지하기 위한 어댑터다.
 *
 * @see src/lib/readiness/get-session-readiness.ts (PR-FLOW-06 SSOT)
 */

import {
  buildSessionReadinessV1,
  loadReadinessContext,
  UNAUTHENTICATED_SESSION_READINESS_V1,
  type ReadinessContext,
} from './get-session-readiness';
import type { SessionReadinessV1 } from './types';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** 분석 입력 소스 (FLOW-06 source_mode와 일치) */
export type AnalysisSourceMode = 'public_result' | 'legacy_paid_deep' | null;

/** next_action 코드 (FLOW-08 ReadinessEntryGate와 정렬) */
export type NextActionCode =
  | 'login'
  | 'pay'
  | 'claim_result'
  | 'complete_onboarding'
  | 'create_session'
  | 'open_app'
  | 'blocked';

/** 세션 차단 사유 코드 (FLOW-06 ApiErrorCode와 호환) */
export type SessionBlockingReasonCode =
  | 'DAILY_LIMIT_REACHED'
  | 'PROGRAM_FINISHED'
  | 'ANALYSIS_INPUT_UNAVAILABLE'
  | 'FREQUENCY_REQUIRED'
  | 'INACTIVE_PLAN'
  | 'NO_CLAIMED_RESULT'
  | 'ONBOARDING_INCOMPLETE';

export interface CanonicalUserReadiness {
  access: {
    is_authenticated: boolean;
    has_active_plan: boolean;
    plan_status: string | null;
  };

  analysis: {
    has_claimed_public_result: boolean;
    has_legacy_deep_result: boolean;
    has_analysis_input: boolean;
    source_mode: AnalysisSourceMode;
    public_result_id: string | null;
  };

  onboarding: {
    has_target_frequency: boolean;
    has_execution_setup: boolean;
    missing_fields: string[];
  };

  session: {
    can_create_session: boolean;
    has_active_session: boolean;
    active_session_number: number | null;
    blocking_reason_code: SessionBlockingReasonCode | null;
    today_completed: boolean;
    program_finished: boolean;
  };

  next_action: {
    code: NextActionCode;
    href: string | null;
  };
}

/** 미인증 사용자용 최소 readiness 객체 */
function projectBlockingReason(readiness: SessionReadinessV1): SessionBlockingReasonCode | null {
  switch (readiness.status) {
    case 'needs_auth':
    case 'needs_payment':
      return 'INACTIVE_PLAN';
    case 'needs_result_claim':
      return 'ANALYSIS_INPUT_UNAVAILABLE';
    case 'needs_onboarding':
      return 'ONBOARDING_INCOMPLETE';
    case 'execution_blocked':
      if (readiness.execution_block === 'PROGRAM_FINISHED') {
        return 'PROGRAM_FINISHED';
      }
      if (readiness.execution_block === 'DAILY_LIMIT') {
        return 'DAILY_LIMIT_REACHED';
      }
      return null;
    default:
      return null;
  }
}

function projectNextAction(readiness: SessionReadinessV1): CanonicalUserReadiness['next_action'] {
  switch (readiness.status) {
    case 'needs_auth':
      return { code: 'login', href: '/app/auth' };
    case 'needs_payment':
      return { code: 'pay', href: null };
    case 'needs_result_claim':
      return { code: 'claim_result', href: '/movement-test/baseline' };
    case 'needs_onboarding':
      return { code: 'complete_onboarding', href: '/onboarding' };
    case 'ready_for_session_create':
      return { code: 'create_session', href: '/app/home' };
    case 'session_already_created':
      return { code: 'open_app', href: '/app/home' };
    case 'execution_blocked':
      return { code: 'blocked', href: '/app/home' };
    default:
      return { code: 'blocked', href: '/app/home' };
  }
}

export const UNAUTHENTICATED_READINESS: CanonicalUserReadiness = {
  access: {
    is_authenticated: false,
    has_active_plan: false,
    plan_status: null,
  },
  analysis: {
    has_claimed_public_result: false,
    has_legacy_deep_result: false,
    has_analysis_input: false,
    source_mode: null,
    public_result_id: null,
  },
  onboarding: {
    has_target_frequency: false,
    has_execution_setup: false,
    missing_fields: [],
  },
  session: {
    can_create_session: false,
    has_active_session: false,
    active_session_number: null,
    blocking_reason_code: projectBlockingReason(UNAUTHENTICATED_SESSION_READINESS_V1),
    today_completed: false,
    program_finished: false,
  },
  next_action: projectNextAction(UNAUTHENTICATED_SESSION_READINESS_V1),
};

function contextToCanonical(ctx: ReadinessContext): CanonicalUserReadiness {
  const readiness = buildSessionReadinessV1(ctx);

  let sourceMode: AnalysisSourceMode = null;
  if (ctx.hasClaimedPublic) {
    sourceMode = 'public_result';
  } else if (ctx.hasLegacyDeep) {
    sourceMode = 'legacy_paid_deep';
  }

  const partial: Omit<CanonicalUserReadiness, 'next_action'> = {
    access: {
      is_authenticated: true,
      has_active_plan: ctx.hasActivePlan,
      plan_status: ctx.planStatus,
    },
    analysis: {
      has_claimed_public_result: ctx.hasClaimedPublic,
      has_legacy_deep_result: ctx.hasLegacyDeep,
      has_analysis_input: ctx.hasAnalysisInput,
      source_mode: sourceMode,
      public_result_id: ctx.claimedPublic?.id ?? null,
    },
    onboarding: {
      has_target_frequency: ctx.hasTargetFrequency,
      has_execution_setup: ctx.hasExecutionSetup,
      missing_fields: ctx.missingFieldsLegacy,
    },
    session: {
      can_create_session: readiness.status === 'ready_for_session_create',
      has_active_session: ctx.hasActiveSession,
      active_session_number: ctx.activeSessionNumber,
      blocking_reason_code: projectBlockingReason(readiness),
      today_completed: ctx.todayCompleted,
      program_finished: ctx.programFinished,
    },
  };

  return {
    ...partial,
    next_action: projectNextAction(readiness),
  };
}

/**
 * getCanonicalUserReadiness — 레거시 CanonicalUserReadiness (FLOW-07/08 호환)
 *
 * READ ONLY.
 */
export async function getCanonicalUserReadiness(userId: string): Promise<CanonicalUserReadiness> {
  const ctx = await loadReadinessContext(userId);
  return contextToCanonical(ctx);
}
