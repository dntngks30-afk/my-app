/**
 * FLOW-07 — Canonical User Readiness (server-side read model)
 *
 * PR-FLOW-06: 계산 SSOT는 loadReadinessContext + 동일 컨텍스트 매핑.
 * 이 파일은 레거시 CanonicalUserReadiness 형태를 유지하기 위한 어댑터다.
 *
 * @see src/lib/readiness/get-session-readiness.ts (PR-FLOW-06 SSOT)
 */

import {
  loadReadinessContext,
  type ReadinessContext,
} from './get-session-readiness';

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
    blocking_reason_code: 'INACTIVE_PLAN',
    today_completed: false,
    program_finished: false,
  },
  next_action: {
    code: 'login',
    href: '/app/auth',
  },
};

function deriveBlockingReason(ctx: ReadinessContext): SessionBlockingReasonCode | null {
  if (!ctx.hasActivePlan) return 'INACTIVE_PLAN';
  if (!ctx.hasAnalysisInput) return 'ANALYSIS_INPUT_UNAVAILABLE';
  if (!ctx.onboardingComplete) return 'ONBOARDING_INCOMPLETE';
  if (ctx.programFinished) return 'PROGRAM_FINISHED';
  if (ctx.todayCompleted && !ctx.hasActiveSession) return 'DAILY_LIMIT_REACHED';
  return null;
}

function deriveNextActionLegacy(r: Omit<CanonicalUserReadiness, 'next_action'>): CanonicalUserReadiness['next_action'] {
  if (!r.access.is_authenticated) {
    return { code: 'login', href: '/app/auth' };
  }
  if (!r.access.has_active_plan) {
    return { code: 'pay', href: null };
  }
  if (!r.analysis.has_analysis_input) {
    return { code: 'claim_result', href: '/movement-test/baseline' };
  }
  // PR-FLOW-06: 주간 빈도 + 경험 + 통증 확인 최소 세트
  if (!r.onboarding.has_target_frequency || !r.onboarding.has_execution_setup) {
    return { code: 'complete_onboarding', href: '/onboarding' };
  }
  if (r.session.program_finished) {
    return { code: 'blocked', href: '/app/home' };
  }
  if (r.session.today_completed) {
    return { code: 'blocked', href: '/app/home' };
  }
  if (r.session.has_active_session) {
    return { code: 'open_app', href: '/app/home' };
  }
  if (r.session.can_create_session) {
    return { code: 'create_session', href: '/app/home' };
  }
  return { code: 'blocked', href: '/app/home' };
}

function contextToCanonical(ctx: ReadinessContext): CanonicalUserReadiness {
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
      can_create_session: ctx.canCreateSession,
      has_active_session: ctx.hasActiveSession,
      active_session_number: ctx.activeSessionNumber,
      blocking_reason_code: deriveBlockingReason(ctx),
      today_completed: ctx.todayCompleted,
      program_finished: ctx.programFinished,
    },
  };

  return {
    ...partial,
    next_action: deriveNextActionLegacy(partial),
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
