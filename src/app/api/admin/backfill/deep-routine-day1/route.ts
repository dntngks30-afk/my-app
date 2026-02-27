/**
 * POST /api/admin/backfill/deep-routine-day1
 * Admin-only: deep final 사용자 중 루틴/Day1 plan 없는 케이스 멱등 백필
 * dryRun 기본 true, limit 기본 10 (max 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { ensureDeepWorkoutRoutine } from '@/lib/deep-test/ensure-deep-routine';
import { seedDay1PlanIfRoutine } from '@/lib/deep-test/seed-day1';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 10;

type BackfillError = { user_id: string; attempt_id?: string; message: string };

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user: actor, supabase } = auth;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const dryRun = body.dryRun !== false;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT)
  );
  const cursor = typeof body.cursor === 'string' && body.cursor.trim() ? body.cursor.trim() : null;
  const since =
    typeof body.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.since)
      ? body.since
      : null;

  const errors: BackfillError[] = [];
  let scanned = 0;
  let createdRoutines = 0;
  let seededDay1 = 0;
  let skipped = 0;
  let nextCursor: string | null = null;

  let query = supabase
    .from('deep_test_attempts')
    .select('user_id')
    .eq('status', 'final')
    .order('user_id', { ascending: true })
    .limit(limit * 50);

  if (since) {
    query = query.gte('finalized_at', `${since}T00:00:00Z`);
  }
  if (cursor) {
    query = query.gt('user_id', cursor);
  }

  const { data: rows, error: qErr } = await query;

  if (qErr) {
    return NextResponse.json(
      { error: 'QUERY_FAILED', details: qErr.message },
      { status: 500 }
    );
  }

  const seen = new Set<string>();
  const userIds: string[] = [];
  for (const r of rows ?? []) {
    const id = r?.user_id;
    if (!id || typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    userIds.push(id);
    if (userIds.length >= limit) break;
  }

  for (const userId of userIds) {
    scanned += 1;
    nextCursor = userId;

    try {
      const { data: attempt, error: attemptErr } = await supabase
        .from('deep_test_attempts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'final')
        .order('finalized_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attemptErr || !attempt?.id) {
        errors.push({ user_id: userId, message: 'No final attempt found' });
        continue;
      }

      const attemptId = attempt.id as string;

      let routineId: string | null = null;
      const { data: existingRoutine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'deep')
        .eq('source_id', attemptId)
        .maybeSingle();

      if (existingRoutine?.id) {
        routineId = existingRoutine.id as string;
      } else {
        if (dryRun) {
          createdRoutines += 1;
          seededDay1 += 1;
          continue;
        }
        try {
          const { routineId: rid } = await ensureDeepWorkoutRoutine(
            supabase,
            userId,
            attemptId
          );
          routineId = rid;
          createdRoutines += 1;
        } catch (err) {
          errors.push({
            user_id: userId,
            attempt_id: attemptId,
            message: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }

      if (!routineId) {
        skipped += 1;
        continue;
      }

      const { data: existingPlan } = await supabase
        .from('routine_day_plans')
        .select('routine_id')
        .eq('routine_id', routineId)
        .eq('day_number', 1)
        .maybeSingle();

      if (existingPlan) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        seededDay1 += 1;
      } else {
        try {
          await seedDay1PlanIfRoutine(supabase, routineId, userId);
          seededDay1 += 1;
        } catch (err) {
          errors.push({
            user_id: userId,
            attempt_id: attemptId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      errors.push({
        user_id: userId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const reason = `dryRun=${dryRun} limit=${limit} since=${since ?? 'all'} cursor=${cursor ?? 'none'}`;
  const before = { scanned, created_routines: createdRoutines, seeded_day1: seededDay1, errors_count: errors.length };
  const after = { ...before };

  const firstTargetId = userIds[0] ?? actor.id;
  const { error: auditErr } = await supabase.from('admin_actions').insert({
    actor_user_id: actor.id,
    actor_email: actor.email ?? '',
    target_user_id: firstTargetId,
    target_email: null,
    action: 'backfill_deep_routine_day1',
    reason,
    before,
    after,
  });

  if (auditErr) {
    console.error('[admin/backfill] admin_actions insert error:', auditErr);
  }

  const res = NextResponse.json({
    dryRun,
    since: since ?? null,
    limit,
    nextCursor,
    scanned,
    created_routines: createdRoutines,
    seeded_day1: seededDay1,
    skipped,
    errors,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
