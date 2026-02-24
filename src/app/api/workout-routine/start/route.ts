/**
 * 운동 루틴 시작 API (멱등)
 *
 * POST /api/workout-routine/start
 *
 * Body: { routineId?: string, force?: boolean }
 * - routineId 있으면 해당 루틴 시작 시도 (소유권 확인)
 * - 없으면: active 우선 반환, 없으면 draft(최신) 선택 후 시작
 * - force: 이번 PR에서 무시
 *
 * 응답: { ok, routineId, status, startedAt, changed }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = getServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    let body: { routineId?: string; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // empty body ok
    }

    const { routineId } = body;
    const supabase = getServerSupabaseAdmin();

    let target: { id: string; status: string; started_at: string | null } | null = null;

    if (routineId) {
      const { data, error } = await supabase
        .from('workout_routines')
        .select('id, status, started_at')
        .eq('id', routineId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: '해당 루틴을 찾을 수 없거나 권한이 없습니다.' },
          { status: 404 }
        );
      }
      target = data;
    } else {
      const { data: active } = await supabase
        .from('workout_routines')
        .select('id, status, started_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) {
        target = active;
      } else {
        const { data: draft } = await supabase
          .from('workout_routines')
          .select('id, status, started_at')
          .eq('user_id', userId)
          .is('started_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!draft) {
          return NextResponse.json(
            { error: '시작할 루틴이 없습니다.' },
            { status: 404 }
          );
        }
        target = draft;
      }
    }

    if (!target) {
      return NextResponse.json({ error: '루틴을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (target.status === 'active' && target.started_at) {
      return NextResponse.json({
        ok: true,
        routineId: target.id,
        status: 'active',
        startedAt: target.started_at,
        changed: false,
      });
    }

    const { data: existingActive } = await supabase
      .from('workout_routines')
      .select('id, started_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('id', target.id)
      .maybeSingle();

    if (existingActive) {
      return NextResponse.json({
        ok: true,
        routineId: existingActive.id,
        status: 'active',
        startedAt: existingActive.started_at ?? null,
        changed: false,
      });
    }

    if (target.started_at) {
      return NextResponse.json({
        ok: true,
        routineId: target.id,
        status: target.status,
        startedAt: target.started_at,
        changed: false,
      });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('workout_routines')
      .update({
        started_at: now,
        status: 'active',
        updated_at: now,
      })
      .eq('id', target.id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Start update error:', updateError);
      return NextResponse.json(
        { error: '시작 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      routineId: target.id,
      status: 'active',
      startedAt: now,
      changed: true,
    });
  } catch (err) {
    console.error('Start API error:', err);
    return NextResponse.json(
      {
        error: '처리 중 오류가 발생했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
