/**
 * KST (UTC+9) time SSOT — 서버 TZ와 무관하게 동일 결과.
 * Session rail "하루 1세션" 정책: last_completed_day_key + next_unlock_at.
 * Intl/process.env.TZ 의존 금지. 순수 UTC+9 오프셋 계산.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * KST day key: 'YYYY-MM-DD' (KST 기준).
 * nowUtcMs + 9h => kstMs, then toISOString().slice(0,10)
 */
export function getKstDayKeyUTC(nowUtc?: Date): string {
  const now = nowUtc ?? new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  return new Date(kstMs).toISOString().slice(0, 10);
}

/**
 * 다음 KST 자정의 UTC ISO string (next_unlock_at용).
 * KST 기준 다음날 00:00을 UTC로 환산.
 */
export function getNextKstMidnightUtcIso(nowUtc?: Date): string {
  const now = nowUtc ?? new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kstDate = new Date(kstMs);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth();
  const date = kstDate.getUTCDate();
  const nextKstMidnightUtcMs = Date.UTC(year, month, date + 1, 0, 0, 0, 0) - KST_OFFSET_MS;
  return new Date(nextKstMidnightUtcMs).toISOString();
}

/**
 * dayKey가 현재 KST day와 같은지.
 */
export function isSameKstDay(dayKey: string, nowUtc?: Date): boolean {
  return getKstDayKeyUTC(nowUtc) === dayKey;
}

/**
 * completed_at 등 타임스탬프 → KST day_key.
 * DB (completed_at AT TIME ZONE 'Asia/Seoul')::date 와 포맷 일치.
 */
export function toKstDayKeyFromTimestamp(ts: Date | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return getKstDayKeyUTC(d);
}

/**
 * today_completed + next_unlock_at 계산 (라우트용).
 * progress.last_completed_day_key와 현재 KST day 비교.
 */
export function getTodayCompletedAndNextUnlock(progress: {
  last_completed_day_key?: string | Date | null;
} | null): { todayCompleted: boolean; nextUnlockAt: string | null } {
  const todayKey = getKstDayKeyUTC();
  const lastKey = progress?.last_completed_day_key != null
    ? String(progress.last_completed_day_key)
    : null;
  const todayCompleted = !!lastKey && lastKey === todayKey;
  const nextUnlockAt = todayCompleted ? getNextKstMidnightUtcIso() : null;
  return { todayCompleted, nextUnlockAt };
}
