import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Legacy upload/report rail boundary lock.
 *
 * Canonical public analysis owner:
 * - movement-test baseline/refine
 * - public_results handoff/bridge/claim
 *
 * Legacy compat + ops rail owner:
 * - requests: upload intake + payment/admin lifecycle
 * - solutions: legacy report content
 */
export const LEGACY_UPLOAD_REPORT_RAIL = {
  canonicalPublicAnalysisOwner: 'movement-test->public_results',
  legacyOwner: 'requests+solutions',
  freeSurveyEntryRole: 'compat-only',
  uploadIntakeRole: 'compat-ops-only',
  myReportRole: 'compat-only',
  adminRequestsRole: 'ops-only',
  sunsetDisposition: 'sunset-candidate',
} as const;

export const LEGACY_REQUEST_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const LEGACY_ADMIN_REQUESTS_SELECT =
  'id, user_id, front_url, side_url, status, created_at' as const;

export const LEGACY_MY_REPORT_REQUESTS_SELECT =
  'id, front_url, side_url, status, created_at' as const;

type LegacyUploadSide = 'front' | 'side';

interface UpsertLegacyUploadRequestIntakeInput {
  supabase: SupabaseClient;
  userId: string | null;
  side: LegacyUploadSide;
  publicUrl: string;
  now?: Date;
}

type LegacyUploadRequestIntakeResult =
  | {
      ok: true;
      action: 'updated' | 'inserted';
      requestId: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export async function upsertLegacyUploadRequestIntake({
  supabase,
  userId,
  side,
  publicUrl,
  now = new Date(),
}: UpsertLegacyUploadRequestIntakeInput): Promise<LegacyUploadRequestIntakeResult> {
  const photoField = side === 'front' ? 'front_url' : 'side_url';
  const oneDayAgo = new Date(now.getTime() - LEGACY_REQUEST_REUSE_WINDOW_MS).toISOString();

  const { data: existingRequests, error: findErr } = await supabase
    .from('requests')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1);

  if (findErr) {
    console.error('[legacy-upload-report-rail] requests lookup error:', findErr);
  }

  const existingRequestId = existingRequests?.[0]?.id ?? null;
  if (existingRequestId) {
    const { error: updateErr } = await supabase
      .from('requests')
      .update({ [photoField]: publicUrl })
      .eq('id', existingRequestId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    return {
      ok: true,
      action: 'updated',
      requestId: existingRequestId,
    };
  }

  const { data: insertData, error: insertErr } = await supabase
    .from('requests')
    .insert({
      user_id: userId,
      status: 'pending',
      [photoField]: publicUrl,
    })
    .select('id')
    .single();

  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  return {
    ok: true,
    action: 'inserted',
    requestId: insertData?.id ?? null,
  };
}
