/**
 * deep finalize 시 workout_routines 멱등 생성
 * PR-1-DeepFinalize-CreateRoutine-01
 * UNIQUE(user_id, source, source_id) WHERE source_id IS NOT NULL 전제
 */

import { SupabaseClient } from '@supabase/supabase-js';

function maskId(id: string | null): string {
  if (!id || id.length < 8) return '****';
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

/**
 * deep attempt 기준 workout_routine 인스턴스 멱등 생성
 * @returns { routineId, created } - 기존 row면 created=false
 */
export async function ensureDeepWorkoutRoutine(
  supabase: SupabaseClient,
  userId: string,
  deepAttemptId: string
): Promise<{ routineId: string; created: boolean }> {
  const existing = await supabase
    .from('workout_routines')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'deep')
    .eq('source_id', deepAttemptId)
    .maybeSingle();

  if (existing.data?.id) {
    return { routineId: existing.data.id, created: false };
  }

  const { data: inserted, error } = await supabase
    .from('workout_routines')
    .insert({
      user_id: userId,
      source: 'deep',
      source_id: deepAttemptId,
      status: 'draft',
      started_at: null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const retry = await supabase
        .from('workout_routines')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'deep')
        .eq('source_id', deepAttemptId)
        .maybeSingle();
      if (retry.data?.id) {
        return { routineId: retry.data.id, created: false };
      }
    }
    throw error;
  }

  return { routineId: inserted!.id, created: true };
}

export { maskId };
