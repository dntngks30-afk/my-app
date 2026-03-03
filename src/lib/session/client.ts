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
      const nextUnlockAt = typeof rawErr === 'object' && rawErr !== null && typeof rawErr.next_unlock_at === 'string'
        ? rawErr.next_unlock_at
        : undefined;
      return { ok: false, status: res.status, error: { code, message, ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }) } };
    }

    return { ok: true, data: body as T };
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
};

export type SessionPlanSegmentItem = {
  order: number;
  templateId: string;
  name: string;
  sets?: number;
  reps?: number;
  hold_seconds?: number;
  focus_tag?: string | null;
};

export type SessionPlanSegment = {
  title: string;
  duration_sec: number;
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

export type CreateSessionResponse = {
  progress: SessionProgress;
  active: SessionPlan;
  idempotent: boolean;
} | {
  done: true;
  progress: SessionProgress;
};

// ─── API 함수 ──────────────────────────────────────────────────────────────────

/** GET /api/session/active — 진행 중 세션 조회 */
export async function getActiveSession(
  token: string
): Promise<ApiResult<ActiveSessionResponse>> {
  return sessionFetch<ActiveSessionResponse>('/api/session/active', token, {
    method: 'GET',
  });
}

export type CreateSessionInput = {
  condition_mood: 'good' | 'ok' | 'bad';
  time_budget: 'short' | 'normal';
  pain_flags?: string[];
  equipment?: string;
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

export type ExerciseLogItem = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
};

export type CompleteSessionInput = {
  session_number: number;
  duration_seconds: number;
  completion_mode: 'all_done' | 'partial_done' | 'stop_early';
  exercise_logs?: ExerciseLogItem[];
};

export type CompleteSessionResponse = {
  progress: SessionProgress;
  next_theme: string | null;
  idempotent: boolean;
  exercise_logs?: ExerciseLogItem[] | null;
};

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
