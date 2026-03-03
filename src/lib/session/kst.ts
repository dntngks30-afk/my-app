/**
 * KST (Asia/Seoul) day helpers — server-side only.
 * Used for "max 1 completed session per KST day" enforcement.
 */

/** KST day key: YYYY-MM-DD in Asia/Seoul */
export function getKstDayKey(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Compute today_completed and next_unlock_at from progress.
 * Shared by /api/session/active and /api/session/create.
 */
export function getTodayCompletedAndNextUnlock(progress: {
  last_completed_day_key?: string | Date | null;
} | null): { todayCompleted: boolean; nextUnlockAt: string | null } {
  const todayKstDayKey = getKstDayKey(new Date());
  const lastDayKey = progress?.last_completed_day_key != null
    ? String(progress.last_completed_day_key)
    : null;
  const todayCompleted = lastDayKey === todayKstDayKey;
  const nextUnlockAt = todayCompleted ? getNextKstMidnightUtcIso(new Date()) : null;
  return { todayCompleted, nextUnlockAt };
}

/**
 * Next KST midnight as UTC ISO string.
 * Used for next_unlock_at when today_completed=true.
 * KST = UTC+9, so 00:00 KST = 15:00 UTC previous day.
 */
export function getNextKstMidnightUtcIso(now: Date = new Date()): string {
  const todayKst = getKstDayKey(now);
  const [y, m, d] = todayKst.split('-').map(Number);
  const nextMidnightKst = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const nextMidnightUtc = new Date(nextMidnightKst.getTime() - kstOffsetMs);
  return nextMidnightUtc.toISOString();
}
