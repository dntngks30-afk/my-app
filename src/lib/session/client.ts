import type { SessionDisplayContract } from '@/lib/session/session-display-contract';
import type { FinalAlignmentAuditV1 } from '@/lib/session/final-plan-display-reconciliation';
import type { ExerciseLogItem } from './types';

/**
 * /api/session/* 클라이언트 fetch 헬퍼 (Path B 전용)
 *
 * 규칙:
 *   - 에러는 { error: { code, message } } 형태로 정규화
 *   - 201/200 OK는 data 필드로 반환
 *   - 재시도 없음 (멱등은 서버 보장)
 *   - 이 파일은 클라이언트 전용 (server action/route 사용 금지)
 */

export type SessionApiError = {
  code: string;
  message: string;
  next_unlock_at?: string;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: SessionApiError };

async function sessionFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      const rawErr = body?.error as Record<string, unknown> | string | undefined;
      const code = typeof rawErr === 'object' && rawErr !== null
        ? (rawErr.code as string) ?? 'UNKNOWN'
        : 'UNKNOWN';
      const message = typeof rawErr === 'object' && rawErr !== null
        ? (rawErr.message as string) ?? res.statusText
        : typeof rawErr === 'string' ? rawErr : res.statusText;
      const details = typeof rawErr === 'object' && rawErr !== null ? (rawErr.details as Record<string, unknown>) : undefined;
      const nextUnlockAt = typeof rawErr === 'object' && rawErr !== null && typeof rawErr.next_unlock_at === 'string'
        ? rawErr.next_unlock_at
        : (details && typeof details.next_unlock_at === 'string' ? details.next_unlock_at : undefined);
      return { ok: false, status: res.status, error: { code, message, ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }) } };
    }

    const data = (body?.ok === true && body?.data != null) ? (body.data as T) : (body as T);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.',
      },
    };
  }
}

// ─── 타입 ──────────────────────────────────────────────────────────────────────

export type SessionPlanMeta = {
  session_number: number;
  phase: number;
  result_type: string;
  confidence: 'high' | 'mid' | 'low';
  focus: string[];
  avoid: string[];
  scoring_version: string;
  /** PR-C optional enrichment */
  deep_level?: 1 | 2 | 3;
  pain_risk?: number;
  red_flags?: boolean;
  safety_mode?: 'red' | 'yellow' | 'none';
  finalTargetLevel?: number;
  maxLevel?: number;
  /** PR-ALG-02: deep_v3 additive */
  primary_type?: string;
  secondary_type?: string | null;
  priority_vector?: Record<string, number>;
  pain_mode?: 'none' | 'caution' | 'protected';
  /** PR-SESSION-QUALITY-01 */
  session_rationale?: string | null;
  session_focus_axes?: string[];
  constraint_flags?: {
    avoid_filter_applied?: boolean;
    duplicate_filtered_count?: number;
    focus_diversity_enforced?: boolean;
    fallback_used?: boolean;
    short_mode_applied?: boolean;
    recovery_mode_applied?: boolean;
    priority_applied?: boolean;
    pain_gate_applied?: boolean;
    first_session_guardrail_applied?: boolean;
  };
} & Partial<SessionDisplayContract>;

export type SessionPlanSegmentItem = {
  order: number;
  templateId: string;
  name: string;
  sets?: number;
  reps?: number;
  hold_seconds?: number;
  focus_tag?: string | null;
  media_ref?: unknown;
  /** PR-ALG-10: 운동 처방 근거 */
  rationale?: string | null;
};

export type SessionPlanSegment = {
  title: string;
  duration_sec?: number;
  items: SessionPlanSegmentItem[];
};

export type SessionPlanJson = {
  version: string;
  meta: SessionPlanMeta;
  flags: { recovery: boolean; short: boolean };
  segments: SessionPlanSegment[];
};

export type SessionPlan = {
  session_number: number;
  status: 'draft' | 'started' | 'completed';
  theme: string;
  plan_json: SessionPlanJson;
  condition: {
    condition_mood: 'good' | 'ok' | 'bad';
    time_budget: 'short' | 'normal';
    pain_flags?: string[];
    equipment?: string;
  };
  created_at: string;
  started_at: string | null;
};

export type SessionProgress = {
  user_id: string;
  total_sessions: number;
  completed_sessions: number;
  active_session_number: number | null;
  last_completed_at: string | null;
  last_completed_day_key?: string | null;
  updated_at: string;
};

export type ActiveSessionResponse = {
  progress: SessionProgress;
  active: SessionPlan | null;
  today_completed?: boolean;
  next_unlock_at?: string;
};

/** Home 초기 로드용 경량 응답 — plan_json 제외 */
export type ActivePlanSummary = { session_number: number; status: string };

export type ActiveSessionLiteResponse = {
  progress: SessionProgress;
  active: ActivePlanSummary | null;
  today_completed?: boolean;
  next_unlock_at?: string;
  /** plan_status from users table — paywall check용, AppAuthGate에서 재사용 */
  plan_status?: string | null;
};

export type CreateSessionResponse = {
  progress: SessionProgress;
  active: SessionPlan;
  idempotent: boolean;
} | {
  done: true;
  progress: SessionProgress;
};

// ─── API 함수 ──────────────────────────────────────────────────────────────────

/** GET /api/session/active — 진행 중 세션 조회 (전체 plan_json 포함) */
export async function getActiveSession(
  token: string
): Promise<ApiResult<ActiveSessionResponse>> {
  return sessionFetch<ActiveSessionResponse>('/api/session/active', token, {
    method: 'GET',
  });
}

/** GET /api/session/active-lite — Home 초기 로드용 경량 조회 (plan_json 제외) */
export async function getActiveSessionLite(
  token: string,
  opts?: { debug?: boolean }
): Promise<ApiResult<ActiveSessionLiteResponse>> {
  const path = opts?.debug ? '/api/session/active-lite?debug=1' : '/api/session/active-lite';
  return sessionFetch<ActiveSessionLiteResponse>(path, token, { method: 'GET' });
}

/** GET /api/session/plan?session_number=N — 과거/현재 세션 plan 조회 (read-only) */
export async function getSessionPlan(
  token: string,
  sessionNumber: number,
  opts?: { debug?: boolean }
): Promise<ApiResult<SessionPlan>> {
  const path = opts?.debug
    ? `/api/session/plan?session_number=${encodeURIComponent(sessionNumber)}&debug=1`
    : `/api/session/plan?session_number=${encodeURIComponent(sessionNumber)}`;
  return sessionFetch<SessionPlan>(path, token, { method: 'GET' });
}

/** GET /api/session/plan-detail?session_number=N — 플레이어용 전체 plan_json (media, cues, metadata) */
export async function getSessionPlanDetail(
  token: string,
  sessionNumber: number
): Promise<ApiResult<SessionPlanJson>> {
  const path = `/api/session/plan-detail?session_number=${encodeURIComponent(sessionNumber)}`;
  return sessionFetch<SessionPlanJson>(path, token, { method: 'GET' });
}

/** GET /api/session/plan-summary — 패널 첫 렌더용 경량 조회 (segments + rationale). Full plan_json 아님. */
export type PlanSummaryResponse = {
  session_number: number;
  status: string;
  rationale?: {
    focus?: string[];
    priority_vector?: Record<string, number>;
    pain_mode?: 'none' | 'caution' | 'protected';
    session_rationale?: string | null;
    session_focus_axes?: string[];
    primary_type?: string;
    result_type?: string;
    phase?: number;
    constraint_flags?: Record<string, unknown>;
    session_number?: number;
  } & Partial<SessionDisplayContract>;
  /** PR-TRUTH-02: optional drift observability */
  final_alignment_audit?: FinalAlignmentAuditV1;
  adaptation_summary?: string;
  segments: Array<{
    title: string;
    items: Array<{
      templateId: string;
      name: string;
      order: number;
      sets?: number;
      reps?: number;
      hold_seconds?: number;
      rationale?: string | null;
    }>;
  }>;
  /** 완료된 세션 재조회 시 저장된 실제 기록 (templateId 기준 병합용) */
  exercise_logs?: ExerciseLogItem[];
};

/** extractSessionExercises 등에서 사용. summary/full plan_json 모두 segments만 있으면 동작. */
export type PlanJsonSegmentsForDisplay = {
  segments?: Array<{
    title?: string;
    items?: Array<{
      templateId?: string;
      name?: string;
      order?: number;
      sets?: number;
      reps?: number;
      hold_seconds?: number;
      rationale?: string | null;
    }>;
  }>;
};

export async function getSessionPlanSummary(
  token: string,
  sessionNumber: number,
  opts?: { debug?: boolean }
): Promise<ApiResult<PlanSummaryResponse>> {
  const path = opts?.debug
    ? `/api/session/plan-summary?session_number=${encodeURIComponent(sessionNumber)}&debug=1`
    : `/api/session/plan-summary?session_number=${encodeURIComponent(sessionNumber)}`;
  return sessionFetch<PlanSummaryResponse>(path, token, { method: 'GET' });
}

/** PR-LEGACY-HYDRATION: display-only batch (no segments). */
export type SessionNodeDisplayHydrationItem = {
  session_number: number;
  session_role_code?: string;
  session_role_label?: string;
  session_goal_code?: string;
  session_goal_label?: string;
  session_goal_hint?: string;
  session_rationale?: string | null;
  session_focus_axes?: string[];
  priority_vector?: Record<string, number>;
  pain_mode?: 'none' | 'caution' | 'protected';
  focus?: string[];
  /** Read-time derivation signals (compact echo; same family as plan_json.meta). */
  primary_type?: string;
  result_type?: string;
  phase?: number;
  constraint_flags?: Record<string, unknown>;
};

export type SessionNodeDisplayHydrationResponse = {
  items: SessionNodeDisplayHydrationItem[];
};

/** PR4 home-entry bundle: display-only compact items + optional provenance hint (resolver ignores unknown keys). */
export type HomeNodeDisplayBundleSourceHint =
  | 'active'
  | 'summary'
  | 'hydrated_history'
  | 'bootstrap'
  | 'next_preview';

export type HomeNodeDisplayBundleItem = SessionNodeDisplayHydrationItem & {
  source_hint?: HomeNodeDisplayBundleSourceHint;
};

export type HomeNodeDisplayBundle = {
  items: HomeNodeDisplayBundleItem[];
};

/** GET /api/home/active-lite — 홈/탭 active-lite canonical bundle */
export type HomeActiveLiteResponse = {
  activeLite: ActiveSessionLiteResponse;
  /** PR4: compact node display slice for first paint (same family as node-display-batch). */
  nodeDisplayBundle?: HomeNodeDisplayBundle;
};

export type BootstrapResponse = HomeActiveLiteResponse;

/** Canonical fetch helper for home-lite owner route. */
export async function getHomeActiveLite(
  token: string,
  opts?: { debug?: boolean }
): Promise<ApiResult<HomeActiveLiteResponse>> {
  const path = opts?.debug ? '/api/home/active-lite?debug=1' : '/api/home/active-lite';
  return sessionFetch<HomeActiveLiteResponse>(path, token, { method: 'GET' });
}

export async function getBootstrap(
  token: string,
  opts?: { debug?: boolean }
): Promise<ApiResult<BootstrapResponse>> {
  return getHomeActiveLite(token, opts);
}

/** GET /api/session/node-display-batch — 기존 계정 히스토리 노드 display 습수 (read-time derivation). */
export async function getSessionNodeDisplayBatch(
  token: string,
  input: { from?: number; to?: number }
): Promise<ApiResult<SessionNodeDisplayHydrationResponse>> {
  const from = input.from ?? 1;
  const to = input.to ?? 20;
  const path = `/api/session/node-display-batch?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return sessionFetch<SessionNodeDisplayHydrationResponse>(path, token, { method: 'GET' });
}

export type SessionBootstrapResponse = {
  session_number: number;
  phase: number;
  theme: string;
  segments: Array<{
    title: string;
    items: Array<{
      templateId: string;
      name: string;
      order: number;
      sets?: number;
      reps?: number;
      hold_seconds?: number;
    }>;
  }>;
  estimated_duration: number;
  focus_axes: string[];
  constraint_flags: string[];
};

export type SessionPreviewResponse = SessionBootstrapResponse;

/** Canonical fetch helper for session-preview owner route. */
export async function getSessionPreview(
  token: string,
  input?: { session_number?: number; debug?: boolean }
): Promise<ApiResult<SessionPreviewResponse>> {
  const body: Record<string, unknown> = {};
  if (typeof input?.session_number === 'number') body.session_number = input.session_number;
  if (input?.debug) body.debug = true;
  return sessionFetch<SessionPreviewResponse>('/api/session/preview', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function bootstrapSession(
  token: string,
  input?: { session_number?: number; debug?: boolean }
): Promise<ApiResult<SessionBootstrapResponse>> {
  return getSessionPreview(token, input);
}

export type CreateSessionInput = {
  condition_mood: 'good' | 'ok' | 'bad';
  time_budget: 'short' | 'normal';
  pain_flags?: string[];
  equipment?: string;
  /** debug: true → response에 timings 포함 (측정용) */
  debug?: boolean;
  /** summary: true → active.plan_json을 segments+minimal meta만 반환 (패널 첫 렌더용). Full plan_json 아님. */
  summary?: boolean;
};

/** POST /api/session/create — 세션 멱등 생성 */
export async function createSession(
  token: string,
  input: CreateSessionInput
): Promise<ApiResult<CreateSessionResponse>> {
  return sessionFetch<CreateSessionResponse>('/api/session/create', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ─── complete ──────────────────────────────────────────────────────────────────

export type { ExerciseLogItem, ExerciseLogItemWithIdentity, SessionPlanItemIdentity, SessionCompletionStateMap } from './types';

/** PR-P2-1: optional feedback payload */
export type SessionFeedbackInput = {
  overallRpe?: number;
  painAfter?: number;
  difficultyFeedback?: 'too_easy' | 'ok' | 'too_hard';
  completionRatio?: number;
  timeOverrun?: boolean;
  note?: string;
  painAreas?: string[];
  /** PR-UX-03 */
  bodyStateChange?: 'better' | 'same' | 'worse';
  discomfortArea?: string;
};

export type ExerciseFeedbackInput = {
  exerciseKey: string;
  completionRatio?: number;
  perceivedDifficulty?: number;
  painDelta?: number;
  wasReplaced?: boolean;
  skipped?: boolean;
  dislikedReason?: string;
};

export type CompleteSessionInput = {
  session_number: number;
  duration_seconds: number;
  completion_mode: 'all_done' | 'partial_done' | 'stop_early';
  exercise_logs?: ExerciseLogItem[];
  feedback?: {
    sessionFeedback?: SessionFeedbackInput;
    exerciseFeedback?: ExerciseFeedbackInput[];
  };
};

export type CompleteSessionResponse = {
  progress: SessionProgress;
  next_theme: string | null;
  idempotent: boolean;
  exercise_logs?: ExerciseLogItem[] | null;
  feedback_saved?: boolean;
};

/** PR-EXEC-02: POST /api/session/progress — 진행 저장 (완료 트리거 없음) */
export type SaveProgressItem = {
  template_id: string;
  plan_item_key?: string;
  segment_index?: number;
  item_index?: number;
  sets: number;
  reps: number;
  hold_seconds: number;
  rpe: number | null;
  completed: boolean;
  skipped: boolean;
};

export async function saveSessionProgress(
  token: string,
  sessionNumber: number,
  items: SaveProgressItem[]
): Promise<ApiResult<{ saved: boolean }>> {
  if (items.length === 0) return { ok: true, data: { saved: true } };
  return sessionFetch<{ saved: boolean }>('/api/session/progress', token, {
    method: 'POST',
    body: JSON.stringify({ session_number: sessionNumber, items }),
  });
}

/** PR-UX-03: POST /api/session/reflection — 세션 리플렉션 저장 */
export async function saveSessionReflection(
  token: string,
  data: { session_number: number; difficulty: number; body_state_change: string; discomfort_area?: string | null }
): Promise<ApiResult<{ saved: boolean }>> {
  return sessionFetch<{ saved: boolean }>('/api/session/reflection', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** POST /api/session/complete — 세션 완료 (유저 명시적 액션 전용) */
export async function completeSession(
  token: string,
  input: CompleteSessionInput
): Promise<ApiResult<CompleteSessionResponse>> {
  return sessionFetch<CompleteSessionResponse>('/api/session/complete', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ─── history (read-only, calendar/history UI) ───────────────────────────────────

export type SessionHistoryItem = {
  session_number: number;
  completed_at: string;
  duration_seconds: number | null;
  completion_mode: string | null;
  theme: string;
  exercise_logs?: ExerciseLogItem[] | null;
};

export type SessionHistoryResponse = {
  progress: {
    completed_sessions: number;
    total_sessions: number;
    last_completed_at: string | null;
  };
  items: SessionHistoryItem[];
};

// ─── progress report (PR-P2-2) ─────────────────────────────────────────────

export type ProgressWindowReport = {
  window_size: 4;
  available_sessions: number;
  sufficient_data: boolean;
  baseline: {
    result_type?: string | null;
    primary_focus?: string | null;
    secondary_focus?: string | null;
    effective_confidence?: number | null;
    safety_mode?: 'none' | 'yellow' | 'red' | null;
    scoring_version?: string | null;
  };
  current: {
    completed_sessions_in_window: number;
    completion_rate?: number | null;
    avg_rpe?: number | null;
    avg_pain_after?: number | null;
    avg_completion_ratio?: number | null;
    difficulty_mix?: { too_easy: number; ok: number; too_hard: number };
    top_problem_exercises?: Array<{
      exercise_key: string;
      pain_delta_avg?: number | null;
      skip_count?: number;
      replace_count?: number;
    }>;
  };
  trends: {
    adherence: 'up' | 'steady' | 'down' | 'unknown';
    exertion: 'up' | 'steady' | 'down' | 'unknown';
    pain_burden: 'improving' | 'steady' | 'worsening' | 'unknown';
    session_tolerance: 'improving' | 'steady' | 'worsening' | 'unknown';
  };
  summary: {
    headline: string;
    bullets: string[];
    caution?: string | null;
  };
};

/** GET /api/session/progress-report — 4세션 변화 요약 (read-only) */
export async function getProgressReport(
  token: string,
  windowSize?: number
): Promise<ApiResult<ProgressWindowReport>> {
  const qs = windowSize ? `?window_size=${windowSize}` : '';
  return sessionFetch<ProgressWindowReport>(`/api/session/progress-report${qs}`, token, {
    method: 'GET',
  });
}

// ─── history (read-only, calendar/history UI) ───────────────────────────────────

/** GET /api/session/history — 완료된 세션 목록 (캘린더/히스토리용, read-only) */
export async function getSessionHistory(
  token: string,
  limit = 60
): Promise<ApiResult<SessionHistoryResponse>> {
  const path = `/api/session/history?limit=${Math.min(120, Math.max(1, limit))}`;
  return sessionFetch<SessionHistoryResponse>(path, token, { method: 'GET' });
}

// ─── profile (온보딩: 주당 빈도) ─────────────────────────────────────────────────

export type PostSessionProfileInput = {
  target_frequency: 2 | 3 | 4 | 5;
  lifestyle_tag?: string;
};

export type PostSessionProfileResponse = {
  profile: Record<string, unknown>;
  progress: Record<string, unknown>;
  warning?: string;
};

/** POST /api/session/profile — 주당 목표 횟수 저장 (best-effort, fail-open) */
export async function postSessionProfile(
  token: string,
  input: PostSessionProfileInput
): Promise<ApiResult<PostSessionProfileResponse>> {
  return sessionFetch<PostSessionProfileResponse>('/api/session/profile', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
