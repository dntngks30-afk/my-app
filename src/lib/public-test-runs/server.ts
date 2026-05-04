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

type PublicTestRunMilestonePatchResult = {
  ok: boolean;
  updated?: number;
  skipped?: boolean;
  reason?: string;
};

type PublicTestRunLateMilestoneRow = {
  id: string;
  user_id: string | null;
  started_at?: string | null;
  claimed_at?: string | null;
} & Record<string, unknown>;

function warnPublicTestRunObserver(helper: string, reason: unknown): void {
  console.warn('[public-test-runs]', helper, reason);
}

async function patchRunMilestoneIfEmpty(input: {
  runId: string;
  column: string;
  occurredAtIso?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  const patch: Record<string, string> = {
    [input.column]: input.occurredAtIso ?? new Date().toISOString(),
  };
  if (input.userId) patch.user_id = input.userId;

  const supabase = getServerSupabaseAdmin();
  const { error } = await supabase
    .from('public_test_runs')
    .update(patch)
    .eq('id', input.runId)
    .is(input.column, null);

  if (error) {
    warnPublicTestRunObserver('patchRunMilestoneIfEmpty', error.message);
    return false;
  }
  return true;
}

export async function markPublicTestRunMilestoneByPublicResult(input: {
  publicResultId: string;
  milestone: PublicTestRunMilestone;
  userId?: string | null;
  occurredAtIso?: string | null;
}): Promise<PublicTestRunMilestonePatchResult> {
  try {
    const publicResultId = input.publicResultId.trim();
    const userId = input.userId?.trim() || null;
    if (!isUuid(publicResultId)) return { ok: false, reason: 'invalid_public_result_id' };
    if (userId && !isUuid(userId)) return { ok: false, reason: 'invalid_user_id' };

    const col = milestoneColumn(input.milestone);
    const supabase = getServerSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from('public_test_runs')
      .select('*')
      .eq('public_result_id', publicResultId)
      .order('started_at', { ascending: false });

    if (error) {
      warnPublicTestRunObserver('markPublicTestRunMilestoneByPublicResult:select', error.message);
      return { ok: false, reason: error.message };
    }
    if (!rows?.length) return { ok: true, updated: 0, skipped: true, reason: 'no_matching_runs' };

    const target = (rows as PublicTestRunLateMilestoneRow[]).find((row) => {
      if (userId && row.user_id != null && row.user_id !== userId) return false;
      return true;
    });
    if (!target) return { ok: true, updated: 0, skipped: true, reason: 'user_mismatch' };
    if (target[col] != null) return { ok: true, updated: 0, skipped: true, reason: 'already_marked' };

    const updated = await patchRunMilestoneIfEmpty({
      runId: target.id,
      column: col,
      occurredAtIso: input.occurredAtIso,
      userId: userId && target.user_id == null ? userId : null,
    });

    return updated ? { ok: true, updated: 1 } : { ok: false, updated: 0, reason: 'write_failed' };
  } catch (e) {
    warnPublicTestRunObserver('markPublicTestRunMilestoneByPublicResult', e instanceof Error ? e.message : e);
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function markLatestPublicTestRunMilestoneByUser(input: {
  userId: string;
  milestone: PublicTestRunMilestone;
  occurredAtIso?: string | null;
}): Promise<PublicTestRunMilestonePatchResult> {
  try {
    const userId = input.userId.trim();
    if (!isUuid(userId)) return { ok: false, reason: 'invalid_user_id' };

    const col = milestoneColumn(input.milestone);
    const supabase = getServerSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from('public_test_runs')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      warnPublicTestRunObserver('markLatestPublicTestRunMilestoneByUser:select', error.message);
      return { ok: false, reason: error.message };
    }
    if (!rows?.length) return { ok: true, updated: 0, skipped: true, reason: 'no_matching_runs' };

    const target = (rows as PublicTestRunLateMilestoneRow[])
      .sort((a, b) => {
        const aClaimed = a.claimed_at ?? '';
        const bClaimed = b.claimed_at ?? '';
        if (aClaimed !== bClaimed) return bClaimed.localeCompare(aClaimed);
        return (b.started_at ?? '').localeCompare(a.started_at ?? '');
      })[0];

    if (!target) return { ok: true, updated: 0, skipped: true, reason: 'no_matching_runs' };
    if (target[col] != null) return { ok: true, updated: 0, skipped: true, reason: 'already_marked' };

    const updated = await patchRunMilestoneIfEmpty({
      runId: target.id,
      column: col,
      occurredAtIso: input.occurredAtIso,
    });

    return updated ? { ok: true, updated: 1 } : { ok: false, updated: 0, reason: 'write_failed' };
  } catch (e) {
    warnPublicTestRunObserver('markLatestPublicTestRunMilestoneByUser', e instanceof Error ? e.message : e);
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function linkLatestPublicTestRunToUserByAnon(input: {
  anonId: string;
  userId: string;
  pilotCode?: string | null;
  markAuthSuccess?: boolean;
  occurredAtIso?: string | null;
}): Promise<PublicTestRunMilestonePatchResult> {
  try {
    const anonId = input.anonId.trim();
    const userId = input.userId.trim();
    if (!isValidAnonIdForPublicTestProfile(anonId)) return { ok: false, reason: 'invalid_anon_id' };
    if (!isUuid(userId)) return { ok: false, reason: 'invalid_user_id' };

    const pilot = sanitizePilotCode(input.pilotCode);
    const supabase = getServerSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from('public_test_runs')
      .select('id, user_id, pilot_code, started_at, auth_success_at')
      .eq('anon_id', anonId)
      .order('started_at', { ascending: false });

    if (error) {
      warnPublicTestRunObserver('linkLatestPublicTestRunToUserByAnon:select', error.message);
      return { ok: false, reason: error.message };
    }
    if (!rows?.length) return { ok: true, updated: 0, skipped: true, reason: 'no_matching_runs' };

    const typedRows = rows as Array<PublicTestRunLateMilestoneRow & { pilot_code: string | null }>;
    const target =
      (pilot
        ? typedRows.find((row) => row.pilot_code == null || row.pilot_code === pilot)
        : typedRows[0]) ?? typedRows[0];

    if (!target) return { ok: true, updated: 0, skipped: true, reason: 'no_matching_runs' };
    if (target.user_id != null && target.user_id !== userId) {
      return { ok: true, updated: 0, skipped: true, reason: 'user_mismatch' };
    }

    const patch: Record<string, string> = {};
    if (target.user_id == null) patch.user_id = userId;
    if (input.markAuthSuccess === true && target.auth_success_at == null) {
      patch.auth_success_at = input.occurredAtIso ?? new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) {
      return { ok: true, updated: 0, skipped: true, reason: 'already_marked' };
    }

    const { error: updErr } = await supabase
      .from('public_test_runs')
      .update(patch)
      .eq('id', target.id);

    if (updErr) {
      warnPublicTestRunObserver('linkLatestPublicTestRunToUserByAnon:update', updErr.message);
      return { ok: false, updated: 0, reason: updErr.message };
    }
    return { ok: true, updated: 1 };
  } catch (e) {
    warnPublicTestRunObserver('linkLatestPublicTestRunToUserByAnon', e instanceof Error ? e.message : e);
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function linkPublicTestRunToUserByRun(input: {
  runId: string;
  anonId: string;
  userId: string;
  pilotCode?: string | null;
  markAuthSuccess?: boolean;
  occurredAtIso?: string | null;
}): Promise<PublicTestRunMilestonePatchResult> {
  try {
    const runId = input.runId.trim();
    const anonId = input.anonId.trim();
    const userId = input.userId.trim();
    if (!isUuid(runId)) return { ok: false, reason: 'invalid_run_id' };
    if (!isValidAnonIdForPublicTestProfile(anonId)) return { ok: false, reason: 'invalid_anon_id' };
    if (!isUuid(userId)) return { ok: false, reason: 'invalid_user_id' };

    const pilot = sanitizePilotCode(input.pilotCode);
    const supabase = getServerSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('public_test_runs')
      .select('id, user_id, pilot_code, auth_success_at')
      .eq('id', runId)
      .eq('anon_id', anonId)
      .maybeSingle();

    if (error) {
      warnPublicTestRunObserver('linkPublicTestRunToUserByRun:select', error.message);
      return { ok: false, reason: error.message };
    }
    if (!row) return { ok: true, updated: 0, skipped: true, reason: 'run_not_found' };

    const currentUserId = row.user_id as string | null;
    const currentPilot = row.pilot_code as string | null;
    const authSuccessAt = row.auth_success_at as string | null;

    if (pilot && currentPilot != null && currentPilot !== pilot) {
      return { ok: true, updated: 0, skipped: true, reason: 'pilot_mismatch' };
    }
    if (currentUserId != null && currentUserId !== userId) {
      return { ok: true, updated: 0, skipped: true, reason: 'user_mismatch' };
    }

    if (currentUserId != null && (input.markAuthSuccess !== true || authSuccessAt != null)) {
      return { ok: true, updated: 0, skipped: true, reason: 'already_marked' };
    }

    let updated = 0;
    if (currentUserId == null) {
      const { data, error: linkErr } = await supabase
        .from('public_test_runs')
        .update({ user_id: userId })
        .eq('id', runId)
        .eq('anon_id', anonId)
        .is('user_id', null)
        .select('id');

      if (linkErr) {
        warnPublicTestRunObserver('linkPublicTestRunToUserByRun:user_id', linkErr.message);
        return { ok: false, updated: 0, reason: linkErr.message };
      }
      updated += data?.length ?? 0;
    }

    if (input.markAuthSuccess === true && authSuccessAt == null) {
      const { data, error: authErr } = await supabase
        .from('public_test_runs')
        .update({ auth_success_at: input.occurredAtIso ?? new Date().toISOString() })
        .eq('id', runId)
        .eq('anon_id', anonId)
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .is('auth_success_at', null)
        .select('id');

      if (authErr) {
        warnPublicTestRunObserver('linkPublicTestRunToUserByRun:auth_success_at', authErr.message);
        return { ok: false, updated, reason: authErr.message };
      }
      updated += data?.length ?? 0;
    }

    if (updated === 0) return { ok: true, updated: 0, skipped: true, reason: 'already_marked' };
    return { ok: true, updated };
  } catch (e) {
    warnPublicTestRunObserver('linkPublicTestRunToUserByRun', e instanceof Error ? e.message : e);
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
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
