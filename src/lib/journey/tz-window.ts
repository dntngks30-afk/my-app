/**
 * 최근 7일 포함 윈도우 (YYYY-MM-DD) + completed_at 필터 UTC 구간.
 */

export const FALLBACK_TZ = 'Asia/Seoul';

function formatYmdInTimeZone(dt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

export function isValidIANATimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** 순수 calendar 날짜만 증가 (표시용 문자열). */
export function addCalendarDaysPureYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86400000;
  const u = new Date(t);
  const yy = u.getUTCFullYear();
  const mm = String(u.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(u.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * 해당 IANA 존 기준 해당 캘린더 일의 시작 시각 UTC.
 * Asia/Seoul은 고정 오프셋 ISO 파싱. 그 외는 30분 간격 순회 근사(자정 포함 구간 포함).
 */
function utcAtLocalMidnight(ymd: string, timeZone: string): Date {
  if (timeZone === 'Asia/Seoul') {
    const ms = Date.parse(`${ymd}T00:00:00+09:00`);
    if (!Number.isNaN(ms)) return new Date(ms);
  }

  const anchor = Date.parse(`${ymd}T12:00:00Z`);
  const target = ymd.trim();

  let best: number | null = null;
  for (let ms = anchor - 72 * 3600000; ms <= anchor + 72 * 3600000; ms += 30 * 60 * 1000) {
    if (formatYmdInTimeZone(new Date(ms), timeZone) !== target) continue;
    if (best === null || ms < best) best = ms;
  }

  if (best !== null) return new Date(best);
  return new Date(anchor);
}

/**
 * 오늘 포함 7일(from = to − 6일), `to`는 오늘이라는 날짜 문자열 기준).
 */
export function getSevenDayInclusiveWindow(
  now: Date,
  preferredTimeZone: string | null | undefined
): { from: string; to: string; timeZone: string } {
  const tz =
    preferredTimeZone && isValidIANATimeZone(preferredTimeZone.trim())
      ? preferredTimeZone.trim()
      : FALLBACK_TZ;

  const to = formatYmdInTimeZone(now, tz);
  const from = addCalendarDaysPureYmd(to, -6);

  return { from, to, timeZone: tz };
}

/** `completed_at` ∈ [windowFrom 00:00, windowToInclusive 다음날 00:00) */
export function getCompletedAtUtcRange(
  windowFromInclusiveYmd: string,
  windowToInclusiveYmd: string,
  resolvedTimeZone: string
): { startInclusiveUtcIso: string; endExclusiveUtcIso: string } {
  const tz = isValidIANATimeZone(resolvedTimeZone) ? resolvedTimeZone : FALLBACK_TZ;
  const start = utcAtLocalMidnight(windowFromInclusiveYmd, tz);
  const exclusiveEndDay = addCalendarDaysPureYmd(windowToInclusiveYmd, 1);
  const end = utcAtLocalMidnight(exclusiveEndDay, tz);
  return {
    startInclusiveUtcIso: start.toISOString(),
    endExclusiveUtcIso: end.toISOString(),
  };
}
