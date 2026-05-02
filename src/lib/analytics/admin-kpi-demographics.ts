import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import type {
  KpiDemographicBucketRow,
  KpiIntroDemographicStepSummary,
  KpiSignupDemographicStepSummary,
  KpiDemographicsSummary,
  KpiRange,
} from '@/lib/analytics/admin-kpi-types';
import {
  ACQUISITION_SOURCE_LABELS,
  ACQUISITION_SOURCES,
  AGE_BANDS,
  AGE_BAND_LABELS,
  GENDER_BUCKETS,
  GENDER_LABELS,
  type AcquisitionSource,
  type AgeBand,
  type GenderBucket,
  isAcquisitionSource,
  isAgeBand,
  isGenderBucket,
} from '@/lib/analytics/kpi-demographics-types';
import {
  fetchPublicTestProfilesForKpiKeys,
  type PublicTestProfileRow,
} from '@/lib/analytics/public-test-profile';
import { fetchSignupProfilesForUserIds, type SignupProfileRow } from '@/lib/analytics/signup-profile';

const LOW_SAMPLE = 3;

export type KpiDemoEventRow = {
  id: string;
  created_at: string;
  event_name: string;
  anon_id: string | null;
  user_id: string | null;
  public_result_id: string | null;
  session_number: number | null;
  person_key: string;
};

type IntroPersonDemo = {
  ageBand: AgeBand;
  gender: GenderBucket;
};

type SignupPersonDemo = {
  ageBand: AgeBand;
  acquisitionSource: AcquisitionSource;
};

function filterFirstSessionRows(rows: KpiDemoEventRow[]): KpiDemoEventRow[] {
  return rows.filter(
    (row) =>
      row.session_number === 1 ||
      (row.event_name === ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS && row.session_number == null)
  );
}

function resolveUserIdFromRow(row: KpiDemoEventRow): string | null {
  if (row.user_id) return row.user_id;
  if (row.person_key.startsWith('user:')) return row.person_key.slice('user:'.length);
  return null;
}

function profileRowToIntroDemo(p: PublicTestProfileRow): IntroPersonDemo {
  return {
    ageBand: isAgeBand(p.age_band) ? p.age_band : 'unknown',
    gender: isGenderBucket(p.gender) ? p.gender : 'unknown',
  };
}

function signupRowToDemo(p: SignupProfileRow): SignupPersonDemo {
  const rawAcq = p.acquisition_source ?? 'unknown';
  return {
    ageBand: isAgeBand(p.signup_age_band) ? p.signup_age_band : 'unknown',
    acquisitionSource: isAcquisitionSource(rawAcq) ? rawAcq : 'unknown',
  };
}

function buildIntroLookupMaps(profileRows: PublicTestProfileRow[]) {
  const byAnon = new Map<string, PublicTestProfileRow>();
  const byUser = new Map<string, PublicTestProfileRow>();
  const byPr = new Map<string, PublicTestProfileRow>();
  for (const p of profileRows) {
    byAnon.set(p.anon_id, p);
    if (p.user_id) byUser.set(p.user_id, p);
    if (p.public_result_id) byPr.set(p.public_result_id, p);
  }
  return { byAnon, byUser, byPr };
}

function resolveIntroDemoForRow(
  row: KpiDemoEventRow,
  maps: ReturnType<typeof buildIntroLookupMaps>
): IntroPersonDemo {
  if (row.user_id) {
    const pu = maps.byUser.get(row.user_id);
    if (pu) return profileRowToIntroDemo(pu);
  }
  if (row.person_key.startsWith('user:')) {
    const uid = row.person_key.slice('user:'.length);
    const pu = maps.byUser.get(uid);
    if (pu) return profileRowToIntroDemo(pu);
  }
  if (row.person_key.startsWith('anon:')) {
    const aid = row.person_key.slice('anon:'.length);
    const pa = maps.byAnon.get(aid);
    if (pa) return profileRowToIntroDemo(pa);
  }
  if (row.anon_id) {
    const pa = maps.byAnon.get(row.anon_id);
    if (pa) return profileRowToIntroDemo(pa);
  }
  if (row.public_result_id) {
    const pp = maps.byPr.get(row.public_result_id);
    if (pp) return profileRowToIntroDemo(pp);
  }
  return {
    ageBand: 'unknown',
    gender: 'unknown',
  };
}

function buildIntroPersonDemoMap(
  rows: KpiDemoEventRow[],
  maps: ReturnType<typeof buildIntroLookupMaps>
): Map<string, IntroPersonDemo> {
  const byPerson = new Map<string, KpiDemoEventRow[]>();
  for (const r of rows) {
    const list = byPerson.get(r.person_key) ?? [];
    list.push(r);
    byPerson.set(r.person_key, list);
  }
  const out = new Map<string, IntroPersonDemo>();
  for (const [pk, list] of byPerson) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let picked: IntroPersonDemo | null = null;
    for (const row of sorted) {
      const d = resolveIntroDemoForRow(row, maps);
      if (d.ageBand !== 'unknown' || d.gender !== 'unknown') {
        picked = d;
        break;
      }
    }
    const fallbackRow = sorted[0];
    out.set(
      pk,
      picked ??
        (fallbackRow ? resolveIntroDemoForRow(fallbackRow, maps) : { ageBand: 'unknown', gender: 'unknown' })
    );
  }
  return out;
}

function buildSignupLookupMap(rows: SignupProfileRow[]): Map<string, SignupPersonDemo> {
  const m = new Map<string, SignupPersonDemo>();
  for (const r of rows) {
    m.set(r.user_id, signupRowToDemo(r));
  }
  return m;
}

function resolveSignupDemoForPerson(
  sortedRows: KpiDemoEventRow[],
  signupByUser: Map<string, SignupPersonDemo>
): SignupPersonDemo {
  for (const row of sortedRows) {
    const uid = resolveUserIdFromRow(row);
    if (uid) {
      const d = signupByUser.get(uid);
      if (d) return d;
    }
  }
  return {
    ageBand: 'unknown',
    acquisitionSource: 'unknown',
  };
}

function buildSignupPersonDemoMap(
  rows: KpiDemoEventRow[],
  signupByUser: Map<string, SignupPersonDemo>
): Map<string, SignupPersonDemo> {
  const byPerson = new Map<string, KpiDemoEventRow[]>();
  for (const r of rows) {
    const list = byPerson.get(r.person_key) ?? [];
    list.push(r);
    byPerson.set(r.person_key, list);
  }
  const out = new Map<string, SignupPersonDemo>();
  for (const [pk, list] of byPerson) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    out.set(pk, resolveSignupDemoForPerson(sorted, signupByUser));
  }
  return out;
}

function aggregateIntroStep(
  stepRows: KpiDemoEventRow[],
  stepKey: string,
  labelKo: string,
  personDemoGlobal: Map<string, IntroPersonDemo>
): KpiIntroDemographicStepSummary {
  const personKeys = new Set<string>();
  for (const r of stepRows) {
    personKeys.add(r.person_key);
  }
  const sample_size = personKeys.size;
  const ageCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();
  for (const b of AGE_BANDS) ageCounts.set(b, 0);
  for (const g of GENDER_BUCKETS) genderCounts.set(g, 0);

  for (const pk of personKeys) {
    const d = personDemoGlobal.get(pk) ?? {
      ageBand: 'unknown' as AgeBand,
      gender: 'unknown' as GenderBucket,
    };
    ageCounts.set(d.ageBand, (ageCounts.get(d.ageBand) ?? 0) + 1);
    genderCounts.set(d.gender, (genderCounts.get(d.gender) ?? 0) + 1);
  }

  const toRows = (
    keys: readonly string[],
    counts: Map<string, number>,
    labels: Record<string, string>
  ): KpiDemographicBucketRow[] =>
    keys.map((key) => {
      const count = counts.get(key) ?? 0;
      const ratio = sample_size <= 0 ? 0 : count / sample_size;
      return {
        key,
        label: labels[key] ?? key,
        count,
        ratio,
        low_sample: count > 0 && count < LOW_SAMPLE,
      };
    });

  return {
    step: stepKey,
    label_ko: labelKo,
    sample_size,
    by_age_band: toRows(AGE_BANDS, ageCounts, AGE_BAND_LABELS as Record<string, string>),
    by_gender: toRows(GENDER_BUCKETS, genderCounts, GENDER_LABELS as Record<string, string>),
  };
}

function aggregateSignupStep(
  stepRows: KpiDemoEventRow[],
  stepKey: string,
  labelKo: string,
  personDemoGlobal: Map<string, SignupPersonDemo>
): KpiSignupDemographicStepSummary {
  const personKeys = new Set<string>();
  for (const r of stepRows) {
    personKeys.add(r.person_key);
  }
  const sample_size = personKeys.size;
  const ageCounts = new Map<string, number>();
  const acquisitionCounts = new Map<string, number>();
  for (const b of AGE_BANDS) ageCounts.set(b, 0);
  for (const a of ACQUISITION_SOURCES) acquisitionCounts.set(a, 0);

  for (const pk of personKeys) {
    const d = personDemoGlobal.get(pk) ?? {
      ageBand: 'unknown' as AgeBand,
      acquisitionSource: 'unknown' as AcquisitionSource,
    };
    ageCounts.set(d.ageBand, (ageCounts.get(d.ageBand) ?? 0) + 1);
    acquisitionCounts.set(
      d.acquisitionSource,
      (acquisitionCounts.get(d.acquisitionSource) ?? 0) + 1
    );
  }

  const toRows = (
    keys: readonly string[],
    counts: Map<string, number>,
    labels: Record<string, string>
  ): KpiDemographicBucketRow[] =>
    keys.map((key) => {
      const count = counts.get(key) ?? 0;
      const ratio = sample_size <= 0 ? 0 : count / sample_size;
      return {
        key,
        label: labels[key] ?? key,
        count,
        ratio,
        low_sample: count > 0 && count < LOW_SAMPLE,
      };
    });

  return {
    step: stepKey,
    label_ko: labelKo,
    sample_size,
    by_age_band: toRows(AGE_BANDS, ageCounts, AGE_BAND_LABELS as Record<string, string>),
    by_acquisition_source: toRows(
      ACQUISITION_SOURCES,
      acquisitionCounts,
      ACQUISITION_SOURCE_LABELS as Record<string, string>
    ),
  };
}

export async function computeKpiDemographicsSummary(
  _supabase: SupabaseClient,
  _range: KpiRange,
  rows: KpiDemoEventRow[]
): Promise<KpiDemographicsSummary> {
  const topLimitations = [
    '무료테스트 블록은 source=free_test_intro 인 public_test_profiles(나이대·성별)만 사용합니다.',
    '회원가입 블록은 signup_profiles(source=signup_profile)의 생년월일 기반 연령대·유입경로만 사용합니다.',
    '두 소스는 합산하지 않으며 수집 시점이 다릅니다.',
    '동일 anon의 반복 테스트 시 무료테스트 프로필은 최신 행만 반영됩니다.',
    '표본 수가 작은 구간은 해석에 주의하세요.',
  ];

  const introLimitations = [
    '무료테스트 시작 전 화면에서 입력한 나이대·성별만 반영합니다.',
    '매칭 실패 시 unknown 으로 집계됩니다.',
  ];

  const signupLimitations = [
    '회원가입 시 입력한 생년월일·유입경로만 반영합니다.',
    '가입 프로필이 없으면 해당 사용자는 unknown 입니다.',
  ];

  try {
    const anonIds = [...new Set(rows.map((r) => r.anon_id).filter((x): x is string => Boolean(x)))];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
    const prIds = [...new Set(rows.map((r) => r.public_result_id).filter((x): x is string => Boolean(x)))];
    const rawProfiles = await fetchPublicTestProfilesForKpiKeys({
      anonIds,
      userIds,
      publicResultIds: prIds,
    });
    const profilesByAnon = new Map<string, PublicTestProfileRow>();
    for (const p of rawProfiles) {
      profilesByAnon.set(p.anon_id, p);
    }
    const profileRows = Array.from(profilesByAnon.values());
    const introMaps = buildIntroLookupMaps(profileRows);
    const introPersonDemo = buildIntroPersonDemoMap(rows, introMaps);

    const signupRows = await fetchSignupProfilesForUserIds(userIds);
    const signupByUser = buildSignupLookupMap(signupRows);
    const signupPersonDemo = buildSignupPersonDemoMap(rows, signupByUser);

    const introStepDefs = [
      { key: 'survey_started', label: '테스트 시작', event: ANALYTICS_EVENTS.SURVEY_STARTED },
      { key: 'survey_completed', label: '설문 완료', event: ANALYTICS_EVENTS.SURVEY_COMPLETED },
      { key: 'result_viewed', label: '결과 확인', event: ANALYTICS_EVENTS.RESULT_VIEWED },
      { key: 'execution_cta_clicked', label: '실행 시작 클릭', event: ANALYTICS_EVENTS.EXECUTION_CTA_CLICKED },
    ] as const;

    const introFunnelSteps: KpiIntroDemographicStepSummary[] = [];
    for (const def of introStepDefs) {
      const scoped = rows.filter((r) => r.event_name === def.event);
      introFunnelSteps.push(aggregateIntroStep(scoped, def.key, def.label, introPersonDemo));
    }

    const signupStepDefs = [
      { key: 'auth_success', label: '가입 완료', event: ANALYTICS_EVENTS.AUTH_SUCCESS },
      { key: 'checkout_success', label: '결제 완료', event: ANALYTICS_EVENTS.CHECKOUT_SUCCESS },
      {
        key: 'session_create_success',
        label: '첫 세션 생성',
        event: ANALYTICS_EVENTS.SESSION_CREATE_SUCCESS,
        sessionOneOnly: true,
      },
      {
        key: 'session_complete_success',
        label: '첫 세션 완료',
        event: ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS,
        sessionOneOnly: true,
      },
    ] as const;

    const signupFunnelSteps: KpiSignupDemographicStepSummary[] = [];
    for (const def of signupStepDefs) {
      let scoped = rows.filter((r) => r.event_name === def.event);
      if ('sessionOneOnly' in def && def.sessionOneOnly) {
        scoped = filterFirstSessionRows(scoped);
      }
      signupFunnelSteps.push(aggregateSignupStep(scoped, def.key, def.label, signupPersonDemo));
    }

    return {
      limitations: topLimitations,
      free_test_intro: {
        limitations: introLimitations,
        funnel_steps: introFunnelSteps,
      },
      signup_profile: {
        limitations: signupLimitations,
        funnel_steps: signupFunnelSteps,
      },
    };
  } catch {
    return {
      limitations: [...topLimitations, 'demographics_profiles_fetch_failed'],
      free_test_intro: { limitations: introLimitations, funnel_steps: [] },
      signup_profile: { limitations: signupLimitations, funnel_steps: [] },
    };
  }
}
