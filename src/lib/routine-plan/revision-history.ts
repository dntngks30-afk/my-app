/**
 * routine_day_plan_revisions / routine_day_plan_audit SELECT
 * 관리자·디버깅용 revision/audit 히스토리 조회
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';

export interface RevisionRow {
  id: string;
  routine_id: string;
  day_number: number;
  revision_no: number;
  reason: string;
  old_hash: string | null;
  new_hash: string;
  created_at_utc: string;
  created_by: string | null;
}

export interface AuditRow {
  id: string;
  routine_id: string;
  day_number: number;
  old_plan_hash: string | null;
  new_plan_hash: string | null;
  reason: string;
  revision_no: number | null;
  created_at_utc: string;
  created_by: string | null;
}

export async function getPlanRevisions(
  routineId: string,
  dayNumber: number
): Promise<RevisionRow[]> {
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from('routine_day_plan_revisions')
    .select('id, routine_id, day_number, revision_no, reason, old_hash, new_hash, created_at_utc, created_by')
    .eq('routine_id', routineId)
    .eq('day_number', dayNumber)
    .order('created_at_utc', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as RevisionRow[];
}

export async function getPlanAuditTrail(
  routineId: string,
  dayNumber: number
): Promise<AuditRow[]> {
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from('routine_day_plan_audit')
    .select('id, routine_id, day_number, old_plan_hash, new_plan_hash, reason, revision_no, created_at_utc, created_by')
    .eq('routine_id', routineId)
    .eq('day_number', dayNumber)
    .order('created_at_utc', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditRow[];
}
