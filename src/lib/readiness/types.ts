/**
 * PR-FLOW-06 — Canonical Session Readiness (V1) — **공개 계약 타입**
 *
 * 신규 코드는 readiness를 읽을 때 이 파일의 `SessionReadiness*` 타입과
 * `getSessionReadiness` / `fetchReadinessClient`만 사용한다.
 * 레거시 FLOW-07 묶음 타입은 `canonical-user-readiness.compat.ts`에 격리되어 있다.
 *
 * 실행 진입 직전 단일 진실 레이어. 스코어링/렌더러/세션 컴포저와 분리한다.
 *
 * @see src/lib/readiness/get-session-readiness.ts
 */

/** 공개 결과 단계(baseline / refined) — DB public_results.result_stage 및 요약용 */
export type PublicResultStageLabel = 'baseline' | 'refined';

export type SessionReadinessStatus =
  | 'needs_auth'
  | 'needs_payment'
  | 'needs_result_claim'
  | 'needs_onboarding'
  | 'ready_for_session_create'
  | 'session_already_created'
  /** 일일 제한·프로그램 종료 등 세션 생성은 불가하지만 앱 홈으로는 안내 */
  | 'execution_blocked';

export type SessionReadinessNextAction =
  | 'GO_AUTH'
  | 'GO_PAYMENT'
  | 'GO_RESULT'
  | 'GO_ONBOARDING'
  | 'GO_SESSION_CREATE'
  | 'GO_APP_HOME';

/** priority_vector는 축 키 나열로만 전달 (값 재해석 없음) */
export type SessionReadinessResultSummary = {
  /** 공개 클레임 결과의 단계(설문 baseline vs 카메라 refined 등) */
  source_mode: PublicResultStageLabel;
  primary_type: string;
  secondary_type?: string | null;
  priority_vector?: string[];
  pain_mode?: 'none' | 'caution' | 'protected' | null;
};

export type SessionReadinessV1 = {
  version: 'v1';
  status: SessionReadinessStatus;
  next_action: {
    code: SessionReadinessNextAction;
  };

  user_id?: string | null;
  public_result_id?: string | null;

  result_summary?: SessionReadinessResultSummary | null;

  onboarding?: {
    is_complete: boolean;
    required_fields: string[];
    snapshot?: {
      frequency_level?: string | null;
      experience_level?: string | null;
      pain_confirmed?: boolean | null;
      constraints?: string[] | null;
    } | null;
  };

  active_session?: {
    has_active_session: boolean;
    session_id?: string | null;
  };

  /** legacy paid deep 등 비공개 분석 입력이 있으면 true (세션 생성 입력 가능) */
  has_legacy_deep_analysis?: boolean;

  /** execution_blocked일 때만 의미 */
  execution_block?: 'DAILY_LIMIT' | 'PROGRAM_FINISHED' | null;
};
