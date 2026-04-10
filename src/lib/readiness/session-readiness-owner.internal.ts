/**
 * PR-FLOW-06 — Session readiness owner implementation (internal)
 *
 * 단일 데이터 로드(loadReadinessContext) + V1 빌드. 세션 생성·클레임·저장 부수효과 없음.
 *
 * 이 파일은 **export hygiene**을 위해 owner 구현을 분리한 것이다. 정본 계산 규칙의 SSOT는
 * `get-session-readiness.ts` 모듈(공개 진입 + 본 주석)과 동일하다.
 *
 * 일반 앱 코드는 여기서 `ReadinessContext` / `loadReadinessContext` / `buildSessionReadinessV1`를
 * import하지 말 것. 공개 소비자는 `getSessionReadiness` + `SessionReadinessV1`만 사용한다.
 *
 * @see src/lib/readiness/get-session-readiness.ts
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getLatestClaimedPublicResultForUser } from '@/lib/public-results/getLatestClaimedPublicResultForUser';
import type { ClaimedPublicResultRow } from '@/lib/public-results/getLatestClaimedPublicResultForUser';
import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import { extractSessionReadinessResultSummary } from './result-summary';
import { evaluateOnboardingMinimum } from './onboarding-completeness';
import type { SessionReadinessV1, SessionReadinessStatus, SessionReadinessNextAction } from './types';

// ─── 미인증 ───────────────────────────────────────────────────────────────────

export const UNAUTHENTICATED_SESSION_READINESS_V1: SessionReadinessV1 = {
  version: 'v1',
  status: 'needs_auth',
  next_action: { code: 'GO_AUTH' },
  user_id: null,
  public_result_id: null,
  result_summary: null,
  onboarding: {
    is_complete: false,
    required_fields: ['frequency_level', 'experience_level', 'pain_confirmed'],
    snapshot: null,
  },
  active_session: { has_active_session: false, session_id: null },
  has_legacy_deep_analysis: false,
  execution_block: null,
};

/** 레거시 compat projection과 공유하는 서버 읽기 컨텍스트 (READ ONLY) */
export interface ReadinessContext {
  userId: string;
  planStatus: string | null;
  hasActivePlan: boolean;
  claimedPublic: ClaimedPublicResultRow | null;
  legacyDeep: Awaited<ReturnType<typeof loadSessionDeepSummary>>;
  profile: {
    target_frequency?: number | null;
    exercise_experience_level?: string | null;
    pain_or_discomfort_present?: boolean | null;
  } | null;
  progress: {
    completed_sessions?: number | null;
    total_sessions?: number | null;
    active_session_number?: number | null;
    last_completed_day_key?: string | null;
  } | null;
  hasClaimedPublic: boolean;
  hasLegacyDeep: boolean;
  hasAnalysisInput: boolean;
  onboardingEval: ReturnType<typeof evaluateOnboardingMinimum>;
  onboardingComplete: boolean;
  hasTargetFrequency: boolean;
  hasExecutionSetup: boolean;
  missingFieldsLegacy: string[];
  totalSessions: number;
  completedSessions: number;
  activeSessionNumber: number | null;
  hasActiveSession: boolean;
  todayCompleted: boolean;
  programFinished: boolean;
  canCreateSession: boolean;
}

export async function loadReadinessContext(userId: string): Promise<ReadinessContext> {
  const supabase = getServerSupabaseAdmin();

  const [userRes, profileRes, progressRes, claimedPublic, legacyDeep] = await Promise.all([
    supabase.from('users').select('plan_status').eq('id', userId).maybeSingle(),
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

  const planStatus = (userRes.data as { plan_status?: string | null } | null)?.plan_status ?? null;
  const hasActivePlan = planStatus === 'active';

  const profile = profileRes.data as ReadinessContext['profile'];
  const hasClaimedPublic = claimedPublic !== null;
  const hasLegacyDeep = legacyDeep !== null;
  const hasAnalysisInput = hasClaimedPublic || hasLegacyDeep;

  const hasTargetFrequency =
    typeof profile?.target_frequency === 'number' &&
    [2, 3, 4, 5].includes(profile.target_frequency);

  const hasExperienceLevel =
    typeof profile?.exercise_experience_level === 'string' &&
    profile.exercise_experience_level.length > 0;
  const hasPainFlag = typeof profile?.pain_or_discomfort_present === 'boolean';
  const hasExecutionSetup = hasExperienceLevel && hasPainFlag;

  const missingFieldsLegacy: string[] = [];
  if (!hasTargetFrequency) missingFieldsLegacy.push('target_frequency');
  if (!hasExperienceLevel) missingFieldsLegacy.push('exercise_experience_level');
  if (!hasPainFlag) missingFieldsLegacy.push('pain_or_discomfort_present');

  const onboardingEval = evaluateOnboardingMinimum(profile);
  const onboardingComplete = onboardingEval.is_complete;

  const progress = progressRes.data as ReadinessContext['progress'];

  const totalSessions = progress?.total_sessions ?? 16;
  const completedSessions = progress?.completed_sessions ?? 0;
  const activeSessionNumber = progress?.active_session_number ?? null;
  const hasActiveSession = activeSessionNumber !== null;

  const { todayCompleted } = getTodayCompletedAndNextUnlock(
    progress ?? { last_completed_day_key: null }
  );
  const programFinished = completedSessions >= totalSessions;

  const canCreateSession =
    hasActivePlan &&
    hasAnalysisInput &&
    onboardingComplete &&
    !programFinished &&
    (!todayCompleted || hasActiveSession);

  return {
    userId,
    planStatus,
    hasActivePlan,
    claimedPublic,
    legacyDeep,
    profile,
    progress,
    hasClaimedPublic,
    hasLegacyDeep,
    hasAnalysisInput,
    onboardingEval,
    onboardingComplete,
    hasTargetFrequency,
    hasExecutionSetup,
    missingFieldsLegacy,
    totalSessions,
    completedSessions,
    activeSessionNumber,
    hasActiveSession,
    todayCompleted,
    programFinished,
    canCreateSession,
  };
}

export function buildSessionReadinessV1(ctx: ReadinessContext): SessionReadinessV1 {
  const { claimedPublic, profile, onboardingEval, onboardingComplete } = ctx;

  const result_summary = ctx.hasClaimedPublic && claimedPublic
    ? extractSessionReadinessResultSummary(claimedPublic.stage, claimedPublic.result)
    : null;

  const onboardingSnapshot = {
    frequency_level:
      typeof profile?.target_frequency === 'number' ? String(profile.target_frequency) : null,
    experience_level: profile?.exercise_experience_level ?? null,
    pain_confirmed:
      typeof profile?.pain_or_discomfort_present === 'boolean'
        ? profile.pain_or_discomfort_present
        : null,
    constraints: null as string[] | null,
  };

  const base: Omit<SessionReadinessV1, 'status' | 'next_action' | 'execution_block'> = {
    version: 'v1',
    user_id: ctx.userId,
    public_result_id: claimedPublic?.id ?? null,
    result_summary,
    onboarding: {
      is_complete: onboardingComplete,
      /** 아직 채워야 할 최소 필드 id (완료 시 빈 배열) */
      required_fields: onboardingComplete
        ? []
        : [...onboardingEval.missing_fields],
      snapshot: onboardingSnapshot,
    },
    active_session: {
      has_active_session: ctx.hasActiveSession,
      session_id: null,
    },
    has_legacy_deep_analysis: ctx.hasLegacyDeep,
  };

  let status: SessionReadinessStatus;
  let next: SessionReadinessNextAction;
  let execution_block: SessionReadinessV1['execution_block'] = null;

  if (!ctx.hasActivePlan) {
    status = 'needs_payment';
    next = 'GO_PAYMENT';
  } else if (!ctx.hasAnalysisInput) {
    status = 'needs_result_claim';
    next = 'GO_RESULT';
  } else if (!onboardingComplete) {
    status = 'needs_onboarding';
    next = 'GO_ONBOARDING';
  } else if (ctx.hasActiveSession) {
    status = 'session_already_created';
    next = 'GO_APP_HOME';
  } else if (ctx.programFinished) {
    status = 'execution_blocked';
    next = 'GO_APP_HOME';
    execution_block = 'PROGRAM_FINISHED';
  } else if (ctx.todayCompleted) {
    status = 'execution_blocked';
    next = 'GO_APP_HOME';
    execution_block = 'DAILY_LIMIT';
  } else if (ctx.canCreateSession) {
    status = 'ready_for_session_create';
    next = 'GO_SESSION_CREATE';
  } else {
    status = 'execution_blocked';
    next = 'GO_APP_HOME';
    execution_block = 'DAILY_LIMIT';
  }

  return {
    ...base,
    status,
    next_action: { code: next },
    execution_block,
  };
}

/**
 * getSessionReadiness — 현재 사용자의 canonical session readiness (V1)
 */
export async function getSessionReadiness(userId: string | null): Promise<SessionReadinessV1> {
  if (!userId || userId.trim() === '') {
    return UNAUTHENTICATED_SESSION_READINESS_V1;
  }
  const ctx = await loadReadinessContext(userId);
  return buildSessionReadinessV1(ctx);
}
