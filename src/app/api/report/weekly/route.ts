/**
 * GET /api/report/weekly
 * 7일 변화 리포트 (daily_conditions + routine_completions SSOT)
 * Bearer only, no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getDayKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getSevenDayRange(): {
  startDayKey: string;
  endDayKey: string;
  dayKeys: string[];
} {
  const now = new Date();
  const endDayKey = getDayKeyUtc(now);
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const startDayKey = getDayKeyUtc(startDate);

  const dayKeys: string[] = [];
  const d = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    dayKeys.push(getDayKeyUtc(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return { startDayKey, endDayKey, dayKeys };
}

type SeriesItem = {
  day_key_utc: string;
  pain_today: number | null;
  stiffness: number | null;
  sleep: number | null;
  completed: boolean;
};

type Summary = {
  pain_delta: number | null;
  stiffness_delta: number | null;
  sleep_delta: number | null;
  completed_days: number;
};

export async function GET(req: NextRequest) {
  console.log('[REPORT_WEEKLY_FETCH_START]');
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const serverNowUtc = new Date().toISOString();
  const { startDayKey, endDayKey, dayKeys } = getSevenDayRange();

  const supabase = getServerSupabaseAdmin();

  const rangeStart = `${startDayKey}T00:00:00.000Z`;
  const endDate = new Date(endDayKey);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const rangeEnd = getDayKeyUtc(endDate) + 'T00:00:00.000Z';

  const [conditionsRes, completionsRes] = await Promise.all([
    supabase
      .from('daily_conditions')
      .select('day_key_utc, pain_today, stiffness, sleep')
      .eq('user_id', userId)
      .in('day_key_utc', dayKeys),
    supabase
      .from('routine_completions')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', rangeStart)
      .lt('completed_at', rangeEnd),
  ]);

  if (conditionsRes.error) {
    console.error('[REPORT_WEEKLY_FETCH_FAIL] conditions', conditionsRes.error);
    return NextResponse.json(
      { error: '조회 실패', details: conditionsRes.error.message },
      { status: 500 }
    );
  }
  if (completionsRes.error) {
    console.error('[REPORT_WEEKLY_FETCH_FAIL] completions', completionsRes.error);
    return NextResponse.json(
      { error: '조회 실패', details: completionsRes.error.message },
      { status: 500 }
    );
  }

  const conditionsByDay = new Map<string, { pain_today: number | null; stiffness: number | null; sleep: number | null }>();
  for (const row of conditionsRes.data ?? []) {
    conditionsByDay.set(row.day_key_utc, {
      pain_today: row.pain_today,
      stiffness: row.stiffness,
      sleep: row.sleep,
    });
  }

  const completedDayKeys = new Set<string>();
  for (const row of completionsRes.data ?? []) {
    const dayKey = row.completed_at ? getDayKeyUtc(new Date(row.completed_at)) : null;
    if (dayKey && dayKeys.includes(dayKey)) completedDayKeys.add(dayKey);
  }

  const series: SeriesItem[] = dayKeys.map((dayKey) => {
    const c = conditionsByDay.get(dayKey);
    return {
      day_key_utc: dayKey,
      pain_today: c?.pain_today ?? null,
      stiffness: c?.stiffness ?? null,
      sleep: c?.sleep ?? null,
      completed: completedDayKeys.has(dayKey),
    };
  });

  function computeDelta(key: 'pain_today' | 'stiffness' | 'sleep'): number | null {
    let first: number | null = null;
    let last: number | null = null;
    for (const s of series) {
      const v = s[key];
      if (v != null && typeof v === 'number') {
        if (first === null) first = v;
        last = v;
      }
    }
    if (first === null || last === null) return null;
    return last - first;
  }

  const summary: Summary = {
    pain_delta: computeDelta('pain_today'),
    stiffness_delta: computeDelta('stiffness'),
    sleep_delta: computeDelta('sleep'),
    completed_days: completedDayKeys.size,
  };

  console.log('[REPORT_WEEKLY_FETCH_SUCCESS]');

  const res = NextResponse.json({
    server_now_utc: serverNowUtc,
    range: { start_day_key_utc: startDayKey, end_day_key_utc: endDayKey },
    series,
    summary,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
