/**
 * POST /api/daily-condition/upsert
 * 오늘(서버 UTC 기준) 컨디션 멱등 업서트
 * Bearer only, no-store
 * Body: { pain_today?, stiffness?, sleep?, time_available_min?, equipment_available? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

const VALID_TIME = [5, 10, 15] as const;

function getDayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function validate0to10(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > 10) return null;
  return n;
}

function validateTime(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return VALID_TIME.includes(n as (typeof VALID_TIME)[number]) ? n : null;
}

function validateEquipment(v: unknown): string[] | null {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === 'string');
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const pain_today = validate0to10(body.pain_today);
  const stiffness = validate0to10(body.stiffness);
  const sleep = validate0to10(body.sleep);
  const time_available_min = validateTime(body.time_available_min);
  const equipment_available = validateEquipment(body.equipment_available);

  if (body.pain_today != null && pain_today === null) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: ['pain_today must be 0-10 or null'] },
      { status: 400 }
    );
  }
  if (body.stiffness != null && stiffness === null) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: ['stiffness must be 0-10 or null'] },
      { status: 400 }
    );
  }
  if (body.sleep != null && sleep === null) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: ['sleep must be 0-10 or null'] },
      { status: 400 }
    );
  }
  if (body.time_available_min != null && time_available_min === null) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: ['time_available_min must be 5, 10, or 15'] },
      { status: 400 }
    );
  }

  const dayKeyUtc = getDayKeyUtc();

  const payload: Record<string, unknown> = {
    user_id: userId,
    day_key_utc: dayKeyUtc,
    pain_today: pain_today ?? null,
    stiffness: stiffness ?? null,
    sleep: sleep ?? null,
    time_available_min: time_available_min ?? null,
    equipment_available: equipment_available ?? [],
  };

  const supabase = getServerSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('daily_conditions')
    .upsert(payload, {
      onConflict: 'user_id,day_key_utc',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error('[daily-condition/upsert]', error);
    return NextResponse.json(
      { error: '저장 실패', details: error.message },
      { status: 500 }
    );
  }

  const condition = row
    ? {
        id: row.id,
        user_id: row.user_id,
        day_key_utc: row.day_key_utc,
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
    ok: true,
    day_key_utc: dayKeyUtc,
    condition,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
