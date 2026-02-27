/**
 * POST /api/admin/backfill/routine-plans
 * Admin-only: deep final 사용자의 미완료 day에 대해 day plan 멱등 생성
 * dryRun 기본 true, limit 기본 10 (max 200), onlyIncomplete=true 고정
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { ensureDeepWorkoutRoutine } from '@/lib/deep-test/ensure-deep-routine';
import { generateDayPlan } from '@/lib/routine-plan/day-plan-generator';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 10;
const DEFAULT_DAYS = [2, 3, 4, 5, 6, 7] as const;

type BackfillError = {
  user_id: string;
  routine_id?: string;
  attempt_id?: string;
  message: string;
};

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
  const cursor =
    typeof body.cursor === 'string' && body.cursor.trim() ? body.cursor.trim() : null;
  const since =
    typeof body.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.since)
      ? body.since
      : null;
  const rawDays = body.days;
  const days: number[] = Array.isArray(rawDays)
    ? rawDays.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7)
    : [...DEFAULT_DAYS];
  const onlyIncomplete = true;
  const regenerateExisting = body.regenerateExisting === true;
  const includeDay1 = body.includeDay1 === true;

  const targetDays = includeDay1 ? [1, ...days.filter((d) => d !== 1)] : days;
  const uniqueDays = [...new Set(targetDays)].sort((a, b) => a - b);

  const errors: BackfillError[] = [];
  let scannedUsers = 0;
  let createdRoutines = 0;
  let generatedPlans = 0;
  let skippedCompletedDays = 0;
  let skippedExistingPlans = 0;
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
    scannedUsers += 1;
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
        } else {
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
      }

      if (!routineId && !dryRun) {
        errors.push({ user_id: userId, message: 'Routine not created' });
        continue;
      }

      if (dryRun && !routineId) {
        continue;
      }

      const { data: completionRows } = await supabase
        .from('routine_completions')
        .select('day_number')
        .eq('user_id', userId);
      const completedDays = new Set(
        (completionRows ?? []).map((r) => r?.day_number).filter((d): d is number => typeof d === 'number')
      );

      for (const day of uniqueDays) {
        if (onlyIncomplete && completedDays.has(day)) {
          skippedCompletedDays += 1;
          continue;
        }

        const { data: existingPlan } = await supabase
          .from('routine_day_plans')
          .select('routine_id')
          .eq('routine_id', routineId!)
          .eq('day_number', day)
          .maybeSingle();

        if (existingPlan && !regenerateExisting) {
          skippedExistingPlans += 1;
          continue;
        }

        if (dryRun) {
          generatedPlans += 1;
          continue;
        }

        try {
          await generateDayPlan(routineId!, day, null, {
            forceRegenerate: regenerateExisting && !!existingPlan,
            preloadedContext: { userId },
          });
          await supabase.from('workout_routine_days').upsert(
            { routine_id: routineId!, day_number: day, exercises: [] },
            { onConflict: 'routine_id,day_number', ignoreDuplicates: true }
          );
          generatedPlans += 1;
        } catch (err) {
          errors.push({
            user_id: userId,
            routine_id: routineId ?? undefined,
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

  const reasonPayload = {
    dryRun,
    since: since ?? 'all',
    days: uniqueDays,
    limit,
    regenerateExisting,
    includeDay1,
  };
  const before = {
    scanned: scannedUsers,
    created_routines: createdRoutines,
    generated: generatedPlans,
    skipped_completed: skippedCompletedDays,
    skipped_existing: skippedExistingPlans,
    errors_count: errors.length,
  };
  const firstTargetId = userIds[0] ?? actor.id;

  const { error: auditErr } = await supabase.from('admin_actions').insert({
    actor_user_id: actor.id,
    actor_email: actor.email ?? '',
    target_user_id: firstTargetId,
    target_email: null,
    action: 'backfill_routine_plans_incomplete_days',
    reason: JSON.stringify(reasonPayload),
    before,
    after: { ...before },
  });

  if (auditErr) {
    console.error('[admin/backfill/routine-plans] admin_actions insert error:', auditErr);
  }

  const res = NextResponse.json({
    dryRun,
    since: since ?? null,
    days: uniqueDays,
    limit,
    nextCursor,
    scannedUsers,
    createdRoutines,
    generatedPlans,
    skippedCompletedDays,
    skippedExistingPlans,
    errors,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
