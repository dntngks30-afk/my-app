/**
 * FLOW-07 — Legacy CanonicalUserReadiness projection (compat / internal)
 *
 * PR-FLOW-06: 계산 SSOT는 `session-readiness-owner.internal.ts`의
 * `loadReadinessContext` + 동일 컨텍스트 매핑.
 *
 * 이 파일은 **레거시** `CanonicalUserReadiness` 형태를 유지하기 위한 어댑터다.
 * 정본 계약은 `SessionReadinessV1` (`types.ts` + `getSessionReadiness`)만 사용한다.
 *
 * @see src/lib/readiness/get-session-readiness.ts (공개 진입)
 * @see src/lib/readiness/session-readiness-owner.internal.ts (owner 구현)
 */

import {
  buildSessionReadinessV1,
  loadReadinessContext,
  UNAUTHENTICATED_SESSION_READINESS_V1,
  type ReadinessContext,
} from './session-readiness-owner.internal';
import type { SessionReadinessV1 } from './types';

// ─── 레거시 compat 타입 (정본이 아님) ───────────────────────────────────────

/** @internal 레거시 FLOW-06 source_mode 표현 */
export type CompatAnalysisSourceMode = 'public_result' | 'legacy_paid_deep' | null;

/** @internal 레거시 next_action 코드 (FLOW-08 이전 명명) */
export type CompatNextActionCode =
  | 'login'
  | 'pay'
  | 'claim_result'
  | 'complete_onboarding'
  | 'create_session'
  | 'open_app'
  | 'blocked';

/** @internal 레거시 세션 차단 사유 코드 */
export type CompatSessionBlockingReasonCode =
  | 'DAILY_LIMIT_REACHED'
  | 'PROGRAM_FINISHED'
  | 'ANALYSIS_INPUT_UNAVAILABLE'
  | 'FREQUENCY_REQUIRED'
  | 'INACTIVE_PLAN'
  | 'NO_CLAIMED_RESULT'
  | 'ONBOARDING_INCOMPLETE';

/** @internal 레거시 readiness 묶음 (SessionReadinessV1과 병행 금지 — 마이그레이션·스모크 전용) */
export interface CompatCanonicalUserReadiness {
  access: {
    is_authenticated: boolean;
    has_active_plan: boolean;
    plan_status: string | null;
  };

  analysis: {
    has_claimed_public_result: boolean;
    has_legacy_deep_result: boolean;
    has_analysis_input: boolean;
    source_mode: CompatAnalysisSourceMode;
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
    blocking_reason_code: CompatSessionBlockingReasonCode | null;
    today_completed: boolean;
    program_finished: boolean;
  };

  next_action: {
    code: CompatNextActionCode;
    href: string | null;
  };
}

function projectBlockingReason(
  readiness: SessionReadinessV1
): CompatSessionBlockingReasonCode | null {
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

function projectNextAction(readiness: SessionReadinessV1): CompatCanonicalUserReadiness['next_action'] {
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

/** @internal 미인증 사용자용 레거시 readiness 상수 */
export const COMPAT_UNAUTHENTICATED_LEGACY_READINESS: CompatCanonicalUserReadiness = {
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

function contextToCompatCanonical(ctx: ReadinessContext): CompatCanonicalUserReadiness {
  const readiness = buildSessionReadinessV1(ctx);

  let sourceMode: CompatAnalysisSourceMode = null;
  if (ctx.hasClaimedPublic) {
    sourceMode = 'public_result';
  } else if (ctx.hasLegacyDeep) {
    sourceMode = 'legacy_paid_deep';
  }

  const partial: Omit<CompatCanonicalUserReadiness, 'next_action'> = {
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
 * getCompatCanonicalUserReadiness — 레거시 CompatCanonicalUserReadiness (FLOW-07/08 호환)
 *
 * READ ONLY. 정본 조회는 `getSessionReadiness` 사용.
 */
export async function getCompatCanonicalUserReadiness(
  userId: string
): Promise<CompatCanonicalUserReadiness> {
  const ctx = await loadReadinessContext(userId);
  return contextToCompatCanonical(ctx);
}
