/**
 * signup_profiles — 회원가입 시점 KPI 인구통계 (무료테스트 public_test_profiles 와 분리).
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import type { AcquisitionSource, AgeBand } from '@/lib/analytics/kpi-demographics-types';
import { isAcquisitionSource, isAgeBand } from '@/lib/analytics/kpi-demographics-types';

export const KPI_SIGNUP_PROFILE_SOURCE = 'signup_profile' as const;

export type SignupProfileRow = {
  user_id: string;
  birth_date: string;
  signup_age_band: string;
  acquisition_source: string;
  pilot_code?: string | null;
  source: string;
};

export async function upsertSignupProfile(input: {
  userId: string;
  birthDateIso: string;
  signupAgeBand: AgeBand;
  acquisitionSource: AcquisitionSource;
  pilotCode?: string | null;
}): Promise<void> {
  const userId = input.userId.trim();
  if (!userId) throw new Error('invalid_user_id');
  if (!isAgeBand(input.signupAgeBand) || input.signupAgeBand === 'unknown') {
    throw new Error('invalid_signup_age_band');
  }
  const acq: AcquisitionSource =
    input.acquisitionSource != null && isAcquisitionSource(input.acquisitionSource)
      ? input.acquisitionSource
      : 'unknown';

  const supabase = getServerSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase.from('signup_profiles').upsert(
    {
      user_id: userId,
      birth_date: input.birthDateIso,
      signup_age_band: input.signupAgeBand,
      acquisition_source: acq,
      pilot_code: input.pilotCode ?? null,
      source: KPI_SIGNUP_PROFILE_SOURCE,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`signup_profiles_upsert_failed:${error.message}`);
  }
}

/** Admin KPI: user_id 목록으로 배치 로드 */
export async function fetchSignupProfilesForUserIds(userIds: string[]): Promise<SignupProfileRow[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const supabase = getServerSupabaseAdmin();
  const chunkSize = 120;
  const rows: SignupProfileRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('signup_profiles')
      .select('user_id, birth_date, signup_age_band, acquisition_source, pilot_code, source')
      .eq('source', KPI_SIGNUP_PROFILE_SOURCE)
      .in('user_id', slice);

    if (error) {
      throw new Error(`signup_profiles_fetch_failed:${error.message}`);
    }
    for (const r of data ?? []) {
      const row = r as SignupProfileRow;
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      rows.push(row);
    }
  }

  return rows;
}
