/**
 * FLOW-07 — Canonical User Readiness (server-side read model)
 *
 * "이 사용자가 지금 실행을 시작할 수 있는가? 없다면 무엇이 부족한가?"에 대한
 * 단일 서버 진실(SSOT)을 반환한다.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - 이 유틸은 READ ONLY이다. 어떤 DB 변경도 수행하지 않는다.
 * - claim, session create, onboarding save는 각각의 FLOW PR 범위.
 * - /app entry 리와이어링은 FLOW-08 범위.
 *
 * ─── Readiness 상태 계산 순서 ──────────────────────────────────────────────────
 * 1. access: plan_status === 'active' 여부 확인
 * 2. analysis: claimed public result 존재 여부 (FLOW-05/06 기반)
 * 3. onboarding: session_user_profile 필수 필드 충족 여부 (FLOW-04 기반)
 * 4. session: 위 조건들로부터 session create 가능 여부 추론
 * 5. next_action: 위 상태로부터 단일 next action 도출
 *
 * ─── next_action 도출 우선순위 ──────────────────────────────────────────────────
 * 'login'              → 미인증
 * 'pay'                → 인증했지만 plan_status !== 'active'
 * 'claim_result'       → active이지만 claimed public result 없음
 * 'complete_onboarding'→ claimed result 있지만 onboarding 미완성
 * 'blocked'            → daily limit 또는 program finished
 * 'create_session'     → 모든 prerequisite 충족, active session 없음
 * 'open_app'           → 이미 active session 있음 (앱 진입 바로 가능)
 *
 * ─── FLOW-08 준비 ────────────────────────────────────────────────────────────
 * - next_action.code / href로 /app entry 리와이어링에 직접 사용 가능
 * - missing_fields로 개별 prerequisite 부족 원인 표시 가능
 * - analysis.source_mode로 공개/유료 경로 구분 가능
 *
 * @see src/lib/public-results/getLatestClaimedPublicResultForUser.ts (FLOW-06)
 * @see src/lib/auth/requireActivePlan.ts (plan_status 패턴)
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getLatestClaimedPublicResultForUser } from '@/lib/public-results/getLatestClaimedPublicResultForUser';
import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { getTodayCompletedAndNextUnlock } from '@/lib/time/kst';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** 분석 입력 소스 (FLOW-06 source_mode와 일치) */
export type AnalysisSourceMode = 'public_result' | 'legacy_paid_deep' | null;

/** next_action 코드 */
export type NextActionCode =
  | 'login'               // 미인증
  | 'pay'                 // 인증 but 미결제/비활성
  | 'claim_result'        // 활성 but claimed result 없음
  | 'complete_onboarding' // claimed result 있지만 onboarding 미완성
  | 'create_session'      // 모든 prerequisite 충족, session 생성 필요
  | 'open_app'            // active session 이미 존재
  | 'blocked';            // daily_limit / program_finished 등 일시 차단

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
  /** 접근/인증 상태 */
  access: {
    is_authenticated: boolean;
    has_active_plan: boolean;
    plan_status: string | null;
  };

  /** 분석 결과 상태 */
  analysis: {
    /** claimed public result 존재 여부 */
    has_claimed_public_result: boolean;
    /** legacy paid deep result 존재 여부 (backward compat) */
    has_legacy_deep_result: boolean;
    /** 실제 session create에서 사용 가능한 분석 입력 여부 */
    has_analysis_input: boolean;
    /** 입력 소스 경로 */
    source_mode: AnalysisSourceMode;
    /** claimed public result id (있는 경우) */
    public_result_id: string | null;
  };

  /** 온보딩/실행설정 상태 */
  onboarding: {
    has_target_frequency: boolean;
    /** FLOW-04 추가 필드 완성 여부 (exercise_experience_level, pain_or_discomfort_present) */
    has_execution_setup: boolean;
    /** 부족한 필수 필드 목록 */
    missing_fields: string[];
  };

  /** 세션 생성 가능 여부 */
  session: {
    /** session create를 지금 호출할 수 있는지 */
    can_create_session: boolean;
    /** 이미 active session이 있는지 */
    has_active_session: boolean;
    /** active session number (있는 경우) */
    active_session_number: number | null;
    /** 차단 이유 (없으면 null) */
    blocking_reason_code: SessionBlockingReasonCode | null;
    /** 오늘 완료 여부 */
    today_completed: boolean;
    /** 프로그램 완료 여부 */
    program_finished: boolean;
  };

  /** 다음 권장 액션 */
  next_action: {
    code: NextActionCode;
    /** 직접 이동 가능한 href (없으면 null) */
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

// ─── next_action 도출 ─────────────────────────────────────────────────────────

function deriveNextAction(
  r: Omit<CanonicalUserReadiness, 'next_action'>
): CanonicalUserReadiness['next_action'] {
  if (!r.access.is_authenticated) {
    return { code: 'login', href: '/app/auth' };
  }
  if (!r.access.has_active_plan) {
    return { code: 'pay', href: null }; // Stripe checkout는 API 호출 필요
  }
  if (!r.analysis.has_analysis_input) {
    return { code: 'claim_result', href: '/movement-test/baseline' };
  }
  if (!r.onboarding.has_target_frequency) {
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

// ─── 메인 readiness 함수 ──────────────────────────────────────────────────────

/**
 * getCanonicalUserReadiness — 현재 인증 사용자의 canonical 실행 준비 상태
 *
 * READ ONLY. 어떤 DB 변경도 수행하지 않음.
 *
 * @param userId 인증된 user id
 * @returns CanonicalUserReadiness
 */
export async function getCanonicalUserReadiness(
  userId: string
): Promise<CanonicalUserReadiness> {
  const supabase = getServerSupabaseAdmin();

  // ── 병렬 조회: users, session_user_profile, session_program_progress, claimed public result ──
  const [userRes, profileRes, progressRes, claimedPublicResult, legacyDeepSummary] =
    await Promise.all([
      supabase
        .from('users')
        .select('plan_status')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('session_user_profile')
        .select('target_frequency, exercise_experience_level, pain_or_discomfort_present')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('session_program_progress')
        .select('completed_sessions, total_sessions, active_session_number, last_completed_day_key')
        .eq('user_id', userId)
        .maybeSingle(),
      getLatestClaimedPublicResultForUser(userId),
      loadSessionDeepSummary(userId),
    ]);

  // ── 1. access ──────────────────────────────────────────────────────────────
  const planStatus = (userRes.data as { plan_status?: string | null } | null)?.plan_status ?? null;
  const hasActivePlan = planStatus === 'active';

  // ── 2. analysis ───────────────────────────────────────────────────────────
  const hasClaimedPublicResult = claimedPublicResult !== null;
  const hasLegacyDeepResult = legacyDeepSummary !== null;
  const hasAnalysisInput = hasClaimedPublicResult || hasLegacyDeepResult;

  let sourceMode: AnalysisSourceMode = null;
  if (hasClaimedPublicResult) {
    sourceMode = 'public_result';
  } else if (hasLegacyDeepResult) {
    sourceMode = 'legacy_paid_deep';
  }

  // ── 3. onboarding ─────────────────────────────────────────────────────────
  const profile = profileRes.data as {
    target_frequency?: number | null;
    exercise_experience_level?: string | null;
    pain_or_discomfort_present?: boolean | null;
  } | null;

  const hasTargetFrequency =
    typeof profile?.target_frequency === 'number' &&
    [2, 3, 4, 5].includes(profile.target_frequency);

  // FLOW-04에서 추가된 실행 설정 필드 완성 여부
  // 둘 다 null이 아닌 값으로 설정되어 있어야 execution_setup 완성으로 간주
  const hasExperienceLevel =
    typeof profile?.exercise_experience_level === 'string' &&
    profile.exercise_experience_level.length > 0;
  const hasPainFlag = typeof profile?.pain_or_discomfort_present === 'boolean';
  const hasExecutionSetup = hasExperienceLevel && hasPainFlag;

  const missingFields: string[] = [];
  if (!hasTargetFrequency) missingFields.push('target_frequency');
  if (!hasExperienceLevel) missingFields.push('exercise_experience_level');
  if (!hasPainFlag) missingFields.push('pain_or_discomfort_present');

  // ── 4. session ────────────────────────────────────────────────────────────
  const progress = progressRes.data as {
    completed_sessions?: number | null;
    total_sessions?: number | null;
    active_session_number?: number | null;
    last_completed_day_key?: string | null;
  } | null;

  const totalSessions = progress?.total_sessions ?? 16;
  const completedSessions = progress?.completed_sessions ?? 0;
  const activeSessionNumber = progress?.active_session_number ?? null;
  const hasActiveSession = activeSessionNumber !== null;

  const { todayCompleted } = getTodayCompletedAndNextUnlock(
    progress ?? { last_completed_day_key: null }
  );

  const programFinished = completedSessions >= totalSessions;

  // session create 차단 이유 결정 (우선순위 순)
  let blockingReasonCode: SessionBlockingReasonCode | null = null;
  if (!hasActivePlan) {
    blockingReasonCode = 'INACTIVE_PLAN';
  } else if (!hasAnalysisInput) {
    blockingReasonCode = 'ANALYSIS_INPUT_UNAVAILABLE';
  } else if (!hasTargetFrequency) {
    blockingReasonCode = 'FREQUENCY_REQUIRED';
  } else if (programFinished) {
    blockingReasonCode = 'PROGRAM_FINISHED';
  } else if (todayCompleted && !hasActiveSession) {
    blockingReasonCode = 'DAILY_LIMIT_REACHED';
  }

  const canCreateSession =
    hasActivePlan &&
    hasAnalysisInput &&
    hasTargetFrequency &&
    !programFinished &&
    (!todayCompleted || hasActiveSession);

  // ── 5. next_action 도출 ───────────────────────────────────────────────────
  const partial: Omit<CanonicalUserReadiness, 'next_action'> = {
    access: {
      is_authenticated: true,
      has_active_plan: hasActivePlan,
      plan_status: planStatus,
    },
    analysis: {
      has_claimed_public_result: hasClaimedPublicResult,
      has_legacy_deep_result: hasLegacyDeepResult,
      has_analysis_input: hasAnalysisInput,
      source_mode: sourceMode,
      public_result_id: claimedPublicResult?.id ?? null,
    },
    onboarding: {
      has_target_frequency: hasTargetFrequency,
      has_execution_setup: hasExecutionSetup,
      missing_fields: missingFields,
    },
    session: {
      can_create_session: canCreateSession,
      has_active_session: hasActiveSession,
      active_session_number: activeSessionNumber,
      blocking_reason_code: blockingReasonCode,
      today_completed: todayCompleted,
      program_finished: programFinished,
    },
  };

  return {
    ...partial,
    next_action: deriveNextAction(partial),
  };
}
