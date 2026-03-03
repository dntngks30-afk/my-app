/**
 * Session events audit — 운영 디버깅/증거 기반 추적.
 * service_role(admin)로만 session_events에 insert.
 * exercise_logs 원문 저장 금지. meta는 요약/메타만.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const META_MAX_BYTES = 4096;

export type LogSessionEventParams = {
  userId: string;
  eventType: string;
  sessionNumber?: number | null;
  status?: string | null;
  code?: string | null;
  meta?: Record<string, unknown> | null;
  requestId?: string | null;
};

/**
 * session_events에 이벤트 기록. fire-and-forget, 실패 시 에러 로그만.
 * meta는 JSON 크기 4KB 이상 시 잘림.
 */
export async function logSessionEvent(
  admin: SupabaseClient,
  params: LogSessionEventParams
): Promise<void> {
  try {
    let meta: Record<string, unknown> = params.meta ?? {};
    const metaStr = JSON.stringify(meta);
    if (metaStr.length > META_MAX_BYTES) {
      meta = { _truncated: true, _size: metaStr.length };
    }

    const kstDay = getKstDayIso();
    await admin.from('session_events').insert({
      user_id: params.userId,
      event_type: params.eventType,
      session_number: params.sessionNumber ?? null,
      kst_day: kstDay,
      request_id: params.requestId ?? null,
      status: params.status ?? null,
      code: params.code ?? null,
      meta,
    });
  } catch (err) {
    console.error('[session-events] log failed', params.eventType, err);
  }
}

/** KST day as YYYY-MM-DD for PostgreSQL date. */
function getKstDayIso(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

type LogItem = {
  sets?: number | null;
  reps?: number | null;
  difficulty?: number | null;
};

/**
 * exercise_logs 요약 → meta에만 저장. 원문 저장 금지.
 */
export function summarizeExerciseLogs(logs: unknown[] | null | undefined): {
  exercise_count: number;
  total_sets: number;
  total_reps: number;
  avg_difficulty: number | null;
} {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { exercise_count: 0, total_sets: 0, total_reps: 0, avg_difficulty: null };
  }

  let totalSets = 0;
  let totalReps = 0;
  let totalDiff = 0;
  let diffCount = 0;

  for (const item of logs) {
    const obj = item as LogItem;
    if (typeof obj.sets === 'number' && Number.isFinite(obj.sets)) {
      totalSets += Math.max(0, Math.floor(obj.sets));
    }
    if (typeof obj.reps === 'number' && Number.isFinite(obj.reps)) {
      totalReps += Math.max(0, Math.floor(obj.reps));
    }
    if (typeof obj.difficulty === 'number' && Number.isFinite(obj.difficulty)) {
      totalDiff += obj.difficulty;
      diffCount++;
    }
  }

  return {
    exercise_count: logs.length,
    total_sets: totalSets,
    total_reps: totalReps,
    avg_difficulty: diffCount > 0 ? Math.round(totalDiff / diffCount * 10) / 10 : null,
  };
}
