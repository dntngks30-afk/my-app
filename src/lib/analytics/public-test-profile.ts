/**
 * public_test_profiles — server-side writes for KPI demographics.
 *
 * MVP limitation: public_test_profiles is latest-profile-per-anon.
 * Suitable for pilot-level demographic funnel summary, not immutable historical
 * snapshots across repeated tests (same anon overwrites age_band/gender/links).
 *
 * Callers must catch errors; failures must not break public-first flows.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import type {
  AcquisitionSource,
  AgeBand,
  KpiIntroGender,
} from '@/lib/analytics/kpi-demographics-types';
import {
  isAgeBand,
  isKpiIntroGender,
} from '@/lib/analytics/kpi-demographics-types';

const ANON_ID_MAX_LEN = 128;

/** KPI demographic aggregates join only rows with this source (DB filter). */
export const KPI_DEMOGRAPHIC_PROFILE_SOURCE = 'free_test_intro' as const;

/** Matches getOrCreateAnonId output: UUID v4; allows future alphanumerics without control chars. */
export function isValidAnonIdForPublicTestProfile(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (t.length === 0 || t.length > ANON_ID_MAX_LEN) return false;
  if (/[\u0000-\u001f\u007f]/.test(t)) return false;
  const uuidV4ish = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
  if (uuidV4ish) return true;
  return /^[A-Za-z0-9_.-]+$/.test(t);
}

export async function upsertPublicTestProfile(input: {
  anonId: string;
  ageBand: AgeBand;
  gender: KpiIntroGender;
  pilotCode?: string | null;
  /** 무조건 free_test_intro 행만 유지 */
  source?: string;
}): Promise<void> {
  const anonId = input.anonId.trim();
  if (!isValidAnonIdForPublicTestProfile(anonId)) {
    throw new Error('invalid_anon_id');
  }
  if (!isAgeBand(input.ageBand) || !isKpiIntroGender(input.gender)) {
    throw new Error('invalid_demographics');
  }

  const supabase = getServerSupabaseAdmin();
  const now = new Date().toISOString();
  const source = KPI_DEMOGRAPHIC_PROFILE_SOURCE;
  /** 유입경로는 회원가입(signup_profiles)에서만 수집 — 무료테스트 행은 항상 unknown */
  const acquisitionSource: AcquisitionSource = 'unknown';

  const { data: existing, error: selErr } = await supabase
    .from('public_test_profiles')
    .select('id')
    .eq('anon_id', anonId)
    .maybeSingle();

  if (selErr) {
    throw new Error(`public_test_profiles_select_failed:${selErr.message}`);
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from('public_test_profiles')
      .update({
        age_band: input.ageBand,
        gender: input.gender,
        pilot_code: input.pilotCode ?? null,
        source,
        acquisition_source: acquisitionSource,
        updated_at: now,
      })
      .eq('anon_id', anonId);

    if (updErr) {
      throw new Error(`public_test_profiles_update_failed:${updErr.message}`);
    }
    return;
  }

  const { error: insErr } = await supabase.from('public_test_profiles').insert({
    anon_id: anonId,
    age_band: input.ageBand,
    gender: input.gender,
    pilot_code: input.pilotCode ?? null,
    source,
    acquisition_source: acquisitionSource,
    updated_at: now,
  });

  if (insErr) {
    throw new Error(`public_test_profiles_insert_failed:${insErr.message}`);
  }
}

export async function linkPublicTestProfileToResult(input: {
  anonId: string;
  publicResultId: string;
}): Promise<void> {
  const anonId = input.anonId.trim();
  const publicResultId = input.publicResultId.trim();
  if (!isValidAnonIdForPublicTestProfile(anonId) || !publicResultId) {
    throw new Error('invalid_link_input');
  }

  const supabase = getServerSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('public_test_profiles')
    .update({
      public_result_id: publicResultId,
      updated_at: now,
    })
    .eq('anon_id', anonId);

  if (error) {
    throw new Error(`public_test_profiles_link_result_failed:${error.message}`);
  }
}

export async function linkPublicTestProfileToUser(input: {
  publicResultId: string;
  userId: string;
}): Promise<void> {
  const publicResultId = input.publicResultId.trim();
  const userId = input.userId.trim();
  if (!publicResultId || !userId) {
    throw new Error('invalid_link_user_input');
  }

  const supabase = getServerSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('public_test_profiles')
    .update({
      user_id: userId,
      updated_at: now,
    })
    .eq('public_result_id', publicResultId);

  if (error) {
    throw new Error(`public_test_profiles_link_user_failed:${error.message}`);
  }
}

export async function linkPublicTestProfileAnonToUser(input: {
  anonId: string;
  userId: string;
}): Promise<void> {
  const anonId = input.anonId.trim();
  const userId = input.userId.trim();
  if (!isValidAnonIdForPublicTestProfile(anonId) || !userId) {
    throw new Error('invalid_link_anon_user_input');
  }

  const supabase = getServerSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('public_test_profiles')
    .update({
      user_id: userId,
      updated_at: now,
    })
    .eq('anon_id', anonId);

  if (error) {
    throw new Error(`public_test_profiles_link_anon_user_failed:${error.message}`);
  }
}

export type PublicTestProfileRow = {
  anon_id: string;
  public_result_id: string | null;
  user_id: string | null;
  age_band: string;
  gender: string;
  pilot_code?: string | null;
  source: string;
  acquisition_source: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

const IN_CHUNK = 120;

/** Admin KPI: batch-load profiles for join keys (aggregate only). */
export async function fetchPublicTestProfilesForKpiKeys(input: {
  anonIds: string[];
  userIds: string[];
  publicResultIds: string[];
}): Promise<PublicTestProfileRow[]> {
  const supabase = getServerSupabaseAdmin();
  const rows: PublicTestProfileRow[] = [];
  const seen = new Set<string>();

  const merge = (batch: PublicTestProfileRow[] | null) => {
    for (const r of batch ?? []) {
      const id = `${r.anon_id}:${r.public_result_id ?? ''}:${r.user_id ?? ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(r);
    }
  };

  for (const ids of chunk(Array.from(new Set(input.anonIds.filter(Boolean))), IN_CHUNK)) {
    if (ids.length === 0) continue;
    const { data, error } = await supabase
      .from('public_test_profiles')
      .select('anon_id, public_result_id, user_id, age_band, gender, pilot_code, source, acquisition_source')
      .eq('source', KPI_DEMOGRAPHIC_PROFILE_SOURCE)
      .in('anon_id', ids);
    if (error) {
      throw new Error(`public_test_profiles_fetch_anon_failed:${error.message}`);
    }
    merge(data as PublicTestProfileRow[]);
  }

  for (const ids of chunk(Array.from(new Set(input.userIds.filter(Boolean))), IN_CHUNK)) {
    if (ids.length === 0) continue;
    const { data, error } = await supabase
      .from('public_test_profiles')
      .select('anon_id, public_result_id, user_id, age_band, gender, pilot_code, source, acquisition_source')
      .eq('source', KPI_DEMOGRAPHIC_PROFILE_SOURCE)
      .in('user_id', ids);
    if (error) {
      throw new Error(`public_test_profiles_fetch_user_failed:${error.message}`);
    }
    merge(data as PublicTestProfileRow[]);
  }

  for (const ids of chunk(Array.from(new Set(input.publicResultIds.filter(Boolean))), IN_CHUNK)) {
    if (ids.length === 0) continue;
    const { data, error } = await supabase
      .from('public_test_profiles')
      .select('anon_id, public_result_id, user_id, age_band, gender, pilot_code, source, acquisition_source')
      .eq('source', KPI_DEMOGRAPHIC_PROFILE_SOURCE)
      .in('public_result_id', ids);
    if (error) {
      throw new Error(`public_test_profiles_fetch_pr_failed:${error.message}`);
    }
    merge(data as PublicTestProfileRow[]);
  }

  return rows;
}
