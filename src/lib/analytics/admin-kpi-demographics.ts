import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import type {
  KpiDemographicBucketRow,
  KpiDemographicStepSummary,
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

export type KpiPersonDemo = {
  ageBand: AgeBand;
  gender: GenderBucket;
  acquisitionSource: AcquisitionSource;
};

function filterFirstSessionRows(rows: KpiDemoEventRow[]): KpiDemoEventRow[] {
  return rows.filter(
    (row) =>
      row.session_number === 1 ||
      (row.event_name === ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS && row.session_number == null)
  );
}

function profileRowToDemo(p: PublicTestProfileRow): KpiPersonDemo {
  const rawAcq = p.acquisition_source ?? 'unknown';
  return {
    ageBand: isAgeBand(p.age_band) ? p.age_band : 'unknown',
    gender: isGenderBucket(p.gender) ? p.gender : 'unknown',
    acquisitionSource: isAcquisitionSource(rawAcq) ? rawAcq : 'unknown',
  };
}

function buildLookupMaps(profileRows: PublicTestProfileRow[]) {
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

function resolveDemographicsForRow(
  row: KpiDemoEventRow,
  maps: ReturnType<typeof buildLookupMaps>
): KpiPersonDemo {
  if (row.user_id) {
    const pu = maps.byUser.get(row.user_id);
    if (pu) return profileRowToDemo(pu);
  }
  if (row.person_key.startsWith('user:')) {
    const uid = row.person_key.slice('user:'.length);
    const pu = maps.byUser.get(uid);
    if (pu) return profileRowToDemo(pu);
  }
  if (row.person_key.startsWith('anon:')) {
    const aid = row.person_key.slice('anon:'.length);
    const pa = maps.byAnon.get(aid);
    if (pa) return profileRowToDemo(pa);
  }
  if (row.anon_id) {
    const pa = maps.byAnon.get(row.anon_id);
    if (pa) return profileRowToDemo(pa);
  }
  if (row.public_result_id) {
    const pp = maps.byPr.get(row.public_result_id);
    if (pp) return profileRowToDemo(pp);
  }
  return {
    ageBand: 'unknown',
    gender: 'unknown',
    acquisitionSource: 'unknown',
  };
}

function buildPersonDemoMap(
  rows: KpiDemoEventRow[],
  maps: ReturnType<typeof buildLookupMaps>
): Map<string, KpiPersonDemo> {
  const byPerson = new Map<string, KpiDemoEventRow[]>();
  for (const r of rows) {
    const list = byPerson.get(r.person_key) ?? [];
    list.push(r);
    byPerson.set(r.person_key, list);
  }
  const out = new Map<string, KpiPersonDemo>();
  for (const [pk, list] of byPerson) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let picked: KpiPersonDemo | null = null;
    for (const row of sorted) {
      const d = resolveDemographicsForRow(row, maps);
      if (
        d.ageBand !== 'unknown' ||
        d.gender !== 'unknown' ||
        d.acquisitionSource !== 'unknown'
      ) {
        picked = d;
        break;
      }
    }
    const fallbackRow = sorted[0];
    out.set(
      pk,
      picked ??
        (fallbackRow
          ? resolveDemographicsForRow(fallbackRow, maps)
          : {
              ageBand: 'unknown',
              gender: 'unknown',
              acquisitionSource: 'unknown',
            })
    );
  }
  return out;
}

function aggregateStep(
  stepRows: KpiDemoEventRow[],
  stepKey: string,
  labelKo: string,
  personDemoGlobal: Map<string, KpiPersonDemo>
): KpiDemographicStepSummary {
  const personKeys = new Set<string>();
  for (const r of stepRows) {
    personKeys.add(r.person_key);
  }
  const sample_size = personKeys.size;
  const ageCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();
  const acquisitionCounts = new Map<string, number>();
  for (const b of AGE_BANDS) ageCounts.set(b, 0);
  for (const g of GENDER_BUCKETS) genderCounts.set(g, 0);
  for (const a of ACQUISITION_SOURCES) acquisitionCounts.set(a, 0);

  for (const pk of personKeys) {
    const d = personDemoGlobal.get(pk) ?? {
      ageBand: 'unknown' as AgeBand,
      gender: 'unknown' as GenderBucket,
      acquisitionSource: 'unknown' as AcquisitionSource,
    };
    ageCounts.set(d.ageBand, (ageCounts.get(d.ageBand) ?? 0) + 1);
    genderCounts.set(d.gender, (genderCounts.get(d.gender) ?? 0) + 1);
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
    by_gender: toRows(GENDER_BUCKETS, genderCounts, GENDER_LABELS as Record<string, string>),
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
  const limitations = [
    '성별·연령대·유입경로는 source가 free_test_intro인 public_test_profiles 행만 반영합니다.',
    '회원가입 계정 메타데이터 등은 KPI 인구통계에 포함하지 않으며, 매칭 실패 시 unknown입니다.',
    '동일 anon의 반복 테스트 시 최신 프로필만 반영되며 과거 스냅샷은 보존되지 않습니다.',
    '일부 퍼널 단계는 해당 analytics event가 없으면 표에서 생략됩니다.',
    '표본 수가 작은 구간은 해석에 주의하세요.',
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
    const maps = buildLookupMaps(profileRows);
    const personDemo = buildPersonDemoMap(rows, maps);

    const stepDefs = [
      { key: 'test_started', label: '테스트 시작', event: ANALYTICS_EVENTS.SURVEY_STARTED, firstOnly: false },
      { key: 'test_completed', label: '테스트 완료', event: ANALYTICS_EVENTS.SURVEY_COMPLETED, firstOnly: false },
      { key: 'result_viewed', label: '결과 조회', event: ANALYTICS_EVENTS.RESULT_VIEWED, firstOnly: false },
      {
        key: 'first_session_completed',
        label: '첫 세션 완료',
        event: ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS,
        firstOnly: true,
      },
    ] as const;

    const funnel_steps: KpiDemographicStepSummary[] = [];
    for (const def of stepDefs) {
      let scoped = rows.filter((r) => r.event_name === def.event);
      if (def.firstOnly) scoped = filterFirstSessionRows(scoped);
      funnel_steps.push(aggregateStep(scoped, def.key, def.label, personDemo));
    }

    const test_started_rows = rows.filter((r) => r.event_name === ANALYTICS_EVENTS.SURVEY_STARTED);
    const test_completed_rows = rows.filter((r) => r.event_name === ANALYTICS_EVENTS.SURVEY_COMPLETED);
    const first_completed_rows = filterFirstSessionRows(
      rows.filter((r) => r.event_name === ANALYTICS_EVENTS.SESSION_COMPLETE_SUCCESS)
    );

    const totalAndStarted = aggregateStep(test_started_rows, 'test_started', '테스트 시작', personDemo);

    return {
      limitations,
      total: totalAndStarted,
      test_started: totalAndStarted,
      test_completed: aggregateStep(test_completed_rows, 'test_completed', '테스트 완료', personDemo),
      first_session_completed: aggregateStep(
        first_completed_rows,
        'first_session_completed',
        '첫 세션 완료',
        personDemo
      ),
      funnel_steps,
    };
  } catch {
    limitations.push('demographics_profiles_fetch_failed');
    return {
      limitations,
      funnel_steps: [],
    };
  }
}
