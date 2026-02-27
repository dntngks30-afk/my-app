/**
 * GET /api/daily-condition/today
 * 오늘(서버 UTC 기준) 컨디션 조회
 * Bearer only, no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

function getDayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const dayKeyUtc = getDayKeyUtc();
  const serverNowUtc = new Date().toISOString();

  const supabase = getServerSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('daily_conditions')
    .select('id, pain_today, stiffness, sleep, time_available_min, equipment_available, created_at_utc, updated_at_utc')
    .eq('user_id', userId)
    .eq('day_key_utc', dayKeyUtc)
    .maybeSingle();

  if (error) {
    console.error('[daily-condition/today]', error);
    return NextResponse.json(
      { error: '조회 실패', details: error.message },
      { status: 500 }
    );
  }

  const condition = row
    ? {
        id: row.id,
        pain_today: row.pain_today,
        stiffness: row.stiffness,
        sleep: row.sleep,
        time_available_min: row.time_available_min,
        equipment_available: row.equipment_available ?? [],
        created_at_utc: row.created_at_utc,
        updated_at_utc: row.updated_at_utc,
      }
    : null;

  const res = NextResponse.json({
    day_key_utc: dayKeyUtc,
    server_now_utc: serverNowUtc,
    condition,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
