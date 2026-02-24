/**
 * 7일 루틴 일차 계산
 * started_at 기준으로 "오늘"이 며칠 차인지 계산
 */

/**
 * startedAt 기준 오늘의 일차 (1..7)
 * day = floor((now - started_at) / 86400000) + 1, clamped to 1..7
 */
export function computeTodayDay(
  startedAt: string | Date,
  now: Date = new Date()
): number {
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const ms = now.getTime() - start.getTime();
  const day = Math.floor(ms / 86400000) + 1;
  return Math.max(1, Math.min(7, day));
}
