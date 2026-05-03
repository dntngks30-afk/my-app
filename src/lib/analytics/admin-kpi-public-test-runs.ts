/**
 * PR-KPI-PUBLIC-TEST-RUNS-03D1 — Admin KPI pilot attribution via `public_test_runs`.
 *
 * Loads candidate runs for event rows (any pilot on matching keys), then decides
 * include | exclude | unknown per PR03D.plan boundary rules.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';

const IN_CHUNK = 120;
/** Range-start lookback so runs that began before the KPI window still bound events inside it. Tune with ops if needed. */
const ATTRIBUTION_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type KpiPublicTestRunRow = {
  id: string;
  anon_id: string;
  pilot_code: string | null;
  started_at: string;
  cta_clicked_at: string | null;
  survey_started_at: string | null;
  survey_completed_at: string | null;
  refine_choice: string | null;
  public_result_id: string | null;
  result_stage: string | null;
  result_viewed_at: string | null;
  user_id: string | null;
  claimed_at: string | null;
};

export type KpiRunAttributionInputRow = {
  created_at: string;
  anon_id: string | null;
  user_id: string | null;
  public_result_id: string | null;
  person_key: string;
};

export type RunAttributionDecision = 'include' | 'exclude' | 'unknown';

export type KpiRunAttributionContext = {
  pilotCode: string;
  byPublicResultId: Map<string, KpiPublicTestRunRow[]>;
  byAnonId: Map<string, KpiPublicTestRunRow[]>;
  byUserId: Map<string, KpiPublicTestRunRow[]>;
};

const RUN_SELECT =
  'id, anon_id, pilot_code, started_at, cta_clicked_at, survey_started_at, survey_completed_at, refine_choice, public_result_id, result_stage, result_viewed_at, user_id, claimed_at';

export function collectRunAttributionKeys(rows: KpiRunAttributionInputRow[]): {
  anonIds: string[];
  userIds: string[];
  publicResultIds: string[];
} {
  const anonIds = new Set<string>();
  const userIds = new Set<string>();
  const publicResultIds = new Set<string>();

  for (const row of rows) {
    if (row.anon_id) anonIds.add(row.anon_id);
    if (row.user_id) userIds.add(row.user_id);
    if (row.public_result_id) publicResultIds.add(row.public_result_id);

    if (row.person_key.startsWith('anon:')) {
      anonIds.add(row.person_key.slice('anon:'.length));
    }
    if (row.person_key.startsWith('user:')) {
      userIds.add(row.person_key.slice('user:'.length));
    }
  }

  return {
    anonIds: [...anonIds],
    userIds: [...userIds],
    publicResultIds: [...publicResultIds],
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function cmpStarted(a: KpiPublicTestRunRow, b: KpiPublicTestRunRow): number {
  const c = a.started_at.localeCompare(b.started_at);
  if (c !== 0) return c;
  return a.id.localeCompare(b.id);
}

function cmpClaimed(a: KpiPublicTestRunRow, b: KpiPublicTestRunRow): number {
  if (!a.claimed_at && !b.claimed_at) return cmpStarted(a, b);
  if (!a.claimed_at) return 1;
  if (!b.claimed_at) return -1;
  const c = a.claimed_at.localeCompare(b.claimed_at);
  if (c !== 0) return c;
  const s = cmpStarted(a, b);
  if (s !== 0) return s;
  return a.id.localeCompare(b.id);
}

function pushMapArr<K>(m: Map<K, KpiPublicTestRunRow[]>, key: K, row: KpiPublicTestRunRow) {
  const arr = m.get(key) ?? [];
  arr.push(row);
  m.set(key, arr);
}

function buildContextFromRuns(pilotCode: string, merged: Map<string, KpiPublicTestRunRow>): KpiRunAttributionContext {
  const byPublicResultId = new Map<string, KpiPublicTestRunRow[]>();
  const byAnonId = new Map<string, KpiPublicTestRunRow[]>();
  const byUserId = new Map<string, KpiPublicTestRunRow[]>();

  for (const row of merged.values()) {
    if (row.public_result_id) {
      pushMapArr(byPublicResultId, row.public_result_id, row);
    }
    pushMapArr(byAnonId, row.anon_id, row);
    if (row.user_id) {
      pushMapArr(byUserId, row.user_id, row);
    }
  }

  for (const arr of byPublicResultId.values()) {
    arr.sort(cmpStarted);
  }
  for (const arr of byAnonId.values()) {
    arr.sort(cmpStarted);
  }
  for (const arr of byUserId.values()) {
    arr.sort(cmpClaimed);
  }

  return { pilotCode, byPublicResultId, byAnonId, byUserId };
}

export function emptyRunAttributionContext(pilotCode: string): KpiRunAttributionContext {
  return {
    pilotCode,
    byPublicResultId: new Map(),
    byAnonId: new Map(),
    byUserId: new Map(),
  };
}

function resolveRangeBounds(
  rows: KpiRunAttributionInputRow[],
  range?: { fromIso: string; toExclusiveIso: string }
): { lowerBound: string; toExclusiveIso: string } {
  let fromIso = range?.fromIso;
  let toExclusiveIso = range?.toExclusiveIso;

  if (!fromIso || !toExclusiveIso) {
    if (rows.length === 0) {
      const now = Date.now();
      toExclusiveIso = new Date(now).toISOString();
      const lb = new Date(now - ATTRIBUTION_LOOKBACK_DAYS * DAY_MS);
      return { lowerBound: lb.toISOString(), toExclusiveIso };
    }
    let min = rows[0].created_at;
    let max = rows[0].created_at;
    for (const r of rows) {
      if (r.created_at.localeCompare(min) < 0) min = r.created_at;
      if (r.created_at.localeCompare(max) > 0) max = r.created_at;
    }
    fromIso = min;
    toExclusiveIso = max;
  }

  const fromMs = Date.parse(fromIso);
  const lbMs = fromMs - ATTRIBUTION_LOOKBACK_DAYS * DAY_MS;
  const lowerBound = new Date(lbMs).toISOString();
  return { lowerBound, toExclusiveIso };
}

function mapDbRow(r: Record<string, unknown>): KpiPublicTestRunRow {
  return {
    id: String(r.id),
    anon_id: String(r.anon_id),
    pilot_code: r.pilot_code == null ? null : String(r.pilot_code),
    started_at: String(r.started_at),
    cta_clicked_at: r.cta_clicked_at == null ? null : String(r.cta_clicked_at),
    survey_started_at: r.survey_started_at == null ? null : String(r.survey_started_at),
    survey_completed_at: r.survey_completed_at == null ? null : String(r.survey_completed_at),
    refine_choice: r.refine_choice == null ? null : String(r.refine_choice),
    public_result_id: r.public_result_id == null ? null : String(r.public_result_id),
    result_stage: r.result_stage == null ? null : String(r.result_stage),
    result_viewed_at: r.result_viewed_at == null ? null : String(r.result_viewed_at),
    user_id: r.user_id == null ? null : String(r.user_id),
    claimed_at: r.claimed_at == null ? null : String(r.claimed_at),
  };
}

export async function fetchPublicTestRunsForPilotAttribution(input: {
  pilotCode: string;
  rows: KpiRunAttributionInputRow[];
  range?: {
    fromIso: string;
    toExclusiveIso: string;
  };
}): Promise<KpiRunAttributionContext> {
  const { pilotCode, rows, range } = input;
  const { lowerBound, toExclusiveIso } = resolveRangeBounds(rows, range);

  const { anonIds, userIds, publicResultIds } = collectRunAttributionKeys(rows);
  if (anonIds.length === 0 && userIds.length === 0 && publicResultIds.length === 0) {
    return emptyRunAttributionContext(pilotCode);
  }

  try {
    const supabase = getServerSupabaseAdmin();
    const merged = new Map<string, KpiPublicTestRunRow>();

    const ingest = (data: unknown) => {
      for (const raw of (data as Record<string, unknown>[]) ?? []) {
        const row = mapDbRow(raw);
        merged.set(row.id, row);
      }
    };

    const runInQuery = async (column: string, ids: string[]) => {
      for (const part of chunk(ids, IN_CHUNK)) {
        if (part.length === 0) continue;
        const { data, error } = await supabase
          .from('public_test_runs')
          .select(RUN_SELECT)
          .in(column, part)
          .gte('started_at', lowerBound)
          .lt('started_at', toExclusiveIso);
        if (error) {
          console.warn('[admin-kpi-public-test-runs] fetch chunk failed', column, error.message);
          continue;
        }
        ingest(data);
      }
    };

    await Promise.all([
      anonIds.length ? runInQuery('anon_id', anonIds) : Promise.resolve(),
      userIds.length ? runInQuery('user_id', userIds) : Promise.resolve(),
      publicResultIds.length ? runInQuery('public_result_id', publicResultIds) : Promise.resolve(),
    ]);

    return buildContextFromRuns(pilotCode, merged);
  } catch (e) {
    console.warn('[admin-kpi-public-test-runs] fetchPublicTestRunsForPilotAttribution failed', e);
    return emptyRunAttributionContext(pilotCode);
  }
}

function pilotMatchDecision(run: KpiPublicTestRunRow, pilotCode: string): RunAttributionDecision {
  if (run.pilot_code === pilotCode) return 'include';
  if (run.pilot_code != null && run.pilot_code !== pilotCode) return 'exclude';
  return 'unknown';
}

function pickLatestStarted(runs: KpiPublicTestRunRow[]): KpiPublicTestRunRow {
  let best = runs[0];
  for (let i = 1; i < runs.length; i++) {
    const r = runs[i];
    if (r.started_at.localeCompare(best.started_at) > 0) best = r;
    else if (r.started_at === best.started_at && r.id.localeCompare(best.id) > 0) best = r;
  }
  return best;
}

function resolveUserId(row: KpiRunAttributionInputRow): string | null {
  if (row.user_id) return row.user_id;
  if (row.person_key.startsWith('user:')) return row.person_key.slice('user:'.length);
  return null;
}

function resolveAnonId(row: KpiRunAttributionInputRow): string | null {
  if (row.anon_id) return row.anon_id;
  if (row.person_key.startsWith('anon:')) return row.person_key.slice('anon:'.length);
  return null;
}

export function decideRunAttributionForRow(
  row: KpiRunAttributionInputRow,
  context: KpiRunAttributionContext
): RunAttributionDecision {
  const T = row.created_at;
  const pilotCode = context.pilotCode;

  const prId = row.public_result_id;
  if (prId) {
    const list = context.byPublicResultId.get(prId);
    if (list && list.length > 0) {
      const run = pickLatestStarted(list);
      return pilotMatchDecision(run, pilotCode);
    }
  }

  const uid = resolveUserId(row);
  if (uid) {
    const allUserRuns = context.byUserId.get(uid) ?? [];
    const claimedRuns = allUserRuns.filter((r) => r.claimed_at != null);
    if (claimedRuns.length > 0) {
      let activeRun: KpiPublicTestRunRow | null = null;
      for (let i = 0; i < claimedRuns.length; i++) {
        const ca = claimedRuns[i].claimed_at!;
        const nextCa = claimedRuns[i + 1]?.claimed_at;
        if (
          T.localeCompare(ca) >= 0 &&
          (nextCa == null || nextCa === '' || T.localeCompare(nextCa) < 0)
        ) {
          activeRun = claimedRuns[i];
          break;
        }
      }
      if (activeRun) {
        return pilotMatchDecision(activeRun, pilotCode);
      }
    }
  }

  const aid = resolveAnonId(row);
  if (aid) {
    const anonRuns = context.byAnonId.get(aid) ?? [];
    if (anonRuns.length > 0) {
      let activeRun: KpiPublicTestRunRow | null = null;
      for (let i = 0; i < anonRuns.length; i++) {
        const s = anonRuns[i].started_at;
        const nextS = anonRuns[i + 1]?.started_at;
        if (
          T.localeCompare(s) >= 0 &&
          (nextS == null || nextS === '' || T.localeCompare(nextS) < 0)
        ) {
          activeRun = anonRuns[i];
          break;
        }
      }
      if (activeRun) {
        return pilotMatchDecision(activeRun, pilotCode);
      }
    }
  }

  return 'unknown';
}
