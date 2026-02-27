/**
 * Day1 plan 멱등 시드 — routine_day_plans + workout_routine_days
 * deep finalize / admin 백필 등에서 재사용
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateDayPlan } from '@/lib/routine-plan/day-plan-generator';
import { maskId } from '@/lib/deep-test/ensure-deep-routine';

export async function seedDay1PlanIfRoutine(
  supabase: SupabaseClient,
  routineId: string,
  userId: string
): Promise<void> {
  try {
    await generateDayPlan(routineId, 1, null, { preloadedContext: { userId } });
    await supabase.from('workout_routine_days').upsert(
      { routine_id: routineId, day_number: 1, exercises: [] },
      { onConflict: 'routine_id,day_number', ignoreDuplicates: true }
    );
    console.log('[DEEP_FINALIZE] day1 plan seeded', { routineId: maskId(routineId) });
  } catch (err) {
    console.warn('[DEEP_FINALIZE_DAY1_SEED_FAIL]', {
      routineId: maskId(routineId),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
