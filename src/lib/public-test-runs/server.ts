/**
 * PR-KPI-PUBLIC-TEST-RUNS-03A — Server-only helpers for `public_test_runs`.
 *
 * - Uses service role via getServerSupabaseAdmin().
 * - All exported operations are best-effort: they return `{ ok: false }` instead of throwing
 *   so public funnel wiring (PR03B+) never blocks UX on DB errors.
 * - Do not call from client components.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { isValidAnonIdForPublicTestProfile } from '@/lib/analytics/public-test-profile';
import { sanitizePilotCode } from '@/lib/pilot/pilot-code';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_ENTRY_LEN = 300;

export type PublicTestRunResultStage = 'baseline' | 'refined';

export type PublicTestRunRefineChoice = 'baseline' | 'camera';

export type PublicTestRunMilestone =
  | 'cta_clicked'
  | 'survey_started'
  | 'survey_completed'
  | 'camera_started'
  | 'camera_completed'
  | 'result_viewed'
  | 'execution_cta_clicked'
  | 'auth_success'
  | 'checkout_success'
  | 'onboarding_completed'
  | 'session_create_success'
  | 'first_app_home_viewed'
  | 'first_session_complete_success';

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Prefer pathname; truncate; avoid storing full URLs where possible. */
function sanitizeEntryPath(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      const path = `${u.pathname}${u.search}`.slice(0, MAX_ENTRY_LEN);
      return path || null;
    }
  } catch {
    /* fall through */
  }
  return t.slice(0, MAX_ENTRY_LEN);
}

function sanitizeReferrer(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  return sanitizeEntryPath(t);
}

function milestoneColumn(m: PublicTestRunMilestone): string {
  const map: Record<PublicTestRunMilestone, string> = {
    cta_clicked: 'cta_clicked_at',
    survey_started: 'survey_started_at',
    survey_completed: 'survey_completed_at',
    camera_started: 'camera_started_at',
    camera_completed: 'camera_completed_at',
    result_viewed: 'result_viewed_at',
    execution_cta_clicked: 'execution_cta_clicked_at',
    auth_success: 'auth_success_at',
    checkout_success: 'checkout_success_at',
    onboarding_completed: 'onboarding_completed_at',
    session_create_success: 'session_create_success_at',
    first_app_home_viewed: 'first_app_home_viewed_at',
    first_session_complete_success: 'first_session_complete_success_at',
  };
  return map[m];
}

/**
 * Insert one immutable run row. `id` must equal client `runId`.
 * On primary-key conflict: success + skipped if existing row has same anon_id; otherwise failure.
 */
export async function startPublicTestRun(input: {
  runId: string;
  anonId: string;
  pilotCode?: string | null;
  entryPath?: string | null;
  entryReferrer?: string | null;
  startedAtIso?: string | null;
  ctaClickedAtIso?: string | null;
}): Promise<{ ok: boolean; id?: string; skipped?: boolean; reason?: string }> {
  try {
    const runId = input.runId.trim();
    const anonId = input.anonId.trim();
    if (!isUuid(runId)) return { ok: false, reason: 'invalid_run_id' };
    if (!isValidAnonIdForPublicTestProfile(anonId)) return { ok: false, reason: 'invalid_anon_id' };

    const pilot = sanitizePilotCode(input.pilotCode);
    const entry_path = sanitizeEntryPath(input.entryPath ?? undefined);
    const entry_referrer = sanitizeReferrer(input.entryReferrer ?? undefined);

    const started_at = input.startedAtIso ?? new Date().toISOString();
    const cta_clicked_at = input.ctaClickedAtIso ?? new Date().toISOString();

    const row = {
      id: runId,
      anon_id: anonId,
      pilot_code: pilot,
      source: 'public_funnel',
      entry_path,
      entry_referrer,
      started_at,
      cta_clicked_at,
    };

    const supabase = getServerSupabaseAdmin();
    const { error } = await supabase.from('public_test_runs').insert(row);

    if (!error) {
      return { ok: true, id: runId };
    }

    if (error.code === '23505') {
      const { data: existing, error: selErr } = await supabase
        .from('public_test_runs')
        .select('id, anon_id')
        .eq('id', runId)
        .maybeSingle();

      if (selErr || !existing) {
        return { ok: false, reason: 'conflict_fetch_failed' };
      }
      if (existing.anon_id === anonId) {
        return { ok: true, id: runId, skipped: true };
      }
      return { ok: false, reason: 'id_conflict_anon_mismatch' };
    }

    return { ok: false, reason: error.message ?? 'insert_failed' };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function markPublicTestRunMilestone(input: {
  runId: string;
  anonId: string;
  milestone: PublicTestRunMilestone;
  occurredAtIso?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  try {
    const runId = input.runId.trim();
    const anonId = input.anonId.trim();
    if (!isUuid(runId)) return { ok: false, reason: 'invalid_run_id' };
    if (!isValidAnonIdForPublicTestProfile(anonId)) return { ok: false, reason: 'invalid_anon_id' };

    const col = milestoneColumn(input.milestone);
    const at = input.occurredAtIso ?? new Date().toISOString();

    const supabase = getServerSupabaseAdmin();
    const { data: row, error: selErr } = await supabase
      .from('public_test_runs')
      .select('*')
      .eq('id', runId)
      .eq('anon_id', anonId)
      .maybeSingle();

    if (selErr) return { ok: false, reason: selErr.message };
    if (!row) return { ok: false, reason: 'run_not_found' };

    const current = row[col as keyof typeof row];
    if (current != null) {
      return { ok: true, skipped: true };
    }

    const patch: Record<string, string> = { [col]: at };
    const { error: updErr } = await supabase
      .from('public_test_runs')
      .update(patch)
      .eq('id', runId)
      .eq('anon_id', anonId);

    if (updErr) return { ok: false, reason: updErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function markPublicTestRunRefineChoice(input: {
  runId: string;
  anonId: string;
  choice: PublicTestRunRefineChoice;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  try {
    const runId = input.runId.trim();
    const anonId = input.anonId.trim();
    if (!isUuid(runId)) return { ok: false, reason: 'invalid_run_id' };
    if (!isValidAnonIdForPublicTestProfile(anonId)) return { ok: false, reason: 'invalid_anon_id' };

    const supabase = getServerSupabaseAdmin();
    const { data: row, error: selErr } = await supabase
      .from('public_test_runs')
      .select('refine_choice')
      .eq('id', runId)
      .eq('anon_id', anonId)
      .maybeSingle();

    if (selErr) return { ok: false, reason: selErr.message };
    if (!row) return { ok: false, reason: 'run_not_found' };

    const existing = row.refine_choice as string | null;
    if (existing === input.choice) return { ok: true, skipped: true };
    if (existing != null && existing !== '' && existing !== input.choice) {
      return { ok: true, skipped: true, reason: 'already_marked' };
    }

    const { error: updErr } = await supabase
      .from('public_test_runs')
      .update({ refine_choice: input.choice })
      .eq('id', runId)
      .eq('anon_id', anonId);

    if (updErr) return { ok: false, reason: updErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function linkPublicTestRunToResult(input: {
  runId: string;
  anonId: string;
  publicResultId: string;
  resultStage: PublicTestRunResultStage;
  viewedAtIso?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  try {
    const runId = input.runId.trim();
    const anonId = input.anonId.trim();
    const publicResultId = input.publicResultId.trim();
    if (!isUuid(runId)) return { ok: false, reason: 'invalid_run_id' };
    if (!isValidAnonIdForPublicTestProfile(anonId)) return { ok: false, reason: 'invalid_anon_id' };
    if (!isUuid(publicResultId)) return { ok: false, reason: 'invalid_public_result_id' };
    if (input.resultStage !== 'baseline' && input.resultStage !== 'refined') {
      return { ok: false, reason: 'invalid_result_stage' };
    }

    const viewedAt = input.viewedAtIso ?? new Date().toISOString();

    const supabase = getServerSupabaseAdmin();
    const { data: row, error: selErr } = await supabase
      .from('public_test_runs')
      .select('public_result_id, result_viewed_at')
      .eq('id', runId)
      .eq('anon_id', anonId)
      .maybeSingle();

    if (selErr) return { ok: false, reason: selErr.message };
    if (!row) return { ok: false, reason: 'run_not_found' };

    const existingPr = row.public_result_id as string | null;
    if (existingPr != null && existingPr !== publicResultId) {
      return { ok: true, skipped: true, reason: 'public_result_mismatch' };
    }

    const patch: Record<string, unknown> = {
      public_result_id: publicResultId,
      result_stage: input.resultStage,
    };
    const existingViewed = row.result_viewed_at;
    if (existingViewed == null) {
      patch.result_viewed_at = viewedAt;
    }

    const { error: updErr } = await supabase
      .from('public_test_runs')
      .update(patch)
      .eq('id', runId)
      .eq('anon_id', anonId);

    if (updErr) return { ok: false, reason: updErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

/**
 * Intended for PR03C claim route: `userId` must come from authenticated server context only.
 */
export async function linkPublicTestRunToUserByPublicResult(input: {
  publicResultId: string;
  userId: string;
  claimedAtIso?: string | null;
}): Promise<{ ok: boolean; updated?: number; skipped?: boolean; reason?: string }> {
  try {
    const publicResultId = input.publicResultId.trim();
    const userId = input.userId.trim();
    if (!isUuid(publicResultId)) return { ok: false, reason: 'invalid_public_result_id' };
    if (!isUuid(userId)) return { ok: false, reason: 'invalid_user_id' };

    const claimed_at = input.claimedAtIso ?? new Date().toISOString();
    const supabase = getServerSupabaseAdmin();

    const { data: rows, error: selErr } = await supabase
      .from('public_test_runs')
      .select('id, user_id')
      .eq('public_result_id', publicResultId);

    if (selErr) return { ok: false, reason: selErr.message };
    if (!rows?.length) return { ok: true, updated: 0, skipped: true, reason: 'no_matching_runs' };

    let updated = 0;
    for (const r of rows) {
      const uid = r.user_id as string | null;
      if (uid != null && uid !== userId) continue;

      const { error: updErr } = await supabase
        .from('public_test_runs')
        .update({ user_id: userId, claimed_at })
        .eq('id', r.id);

      if (!updErr) updated += 1;
    }

    return { ok: true, updated };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}
