import { sanitizePilotCode } from '@/lib/pilot/pilot-code';
import {
  fetchPublicTestProfilesForKpiKeys,
  type PublicTestProfileRow,
} from '@/lib/analytics/public-test-profile';
import {
  fetchSignupProfilesForUserIds,
  type SignupProfileRow,
} from '@/lib/analytics/signup-profile';
import {
  decideRunAttributionForRow,
  fetchPublicTestRunsForPilotAttribution,
  emptyRunAttributionContext,
} from '@/lib/analytics/admin-kpi-public-test-runs';

export class InvalidKpiPilotCodeError extends Error {
  constructor() {
    super('INVALID_PILOT_CODE');
    this.name = 'InvalidKpiPilotCodeError';
  }
}

export function resolveKpiPilotCodeFilter(params: URLSearchParams): string | null {
  const raw = params.get('pilot_code');
  if (raw == null || raw.trim() === '') return null;

  const sanitized = sanitizePilotCode(raw);
  if (!sanitized) throw new InvalidKpiPilotCodeError();

  return sanitized;
}

export type KpiPilotFilterableEventRow = {
  created_at: string;
  event_name: string;
  props: Record<string, unknown> | null;
  anon_id: string | null;
  user_id: string | null;
  public_result_id: string | null;
  person_key: string;
};

function buildPublicProfileMaps(profileRows: PublicTestProfileRow[]) {
  const byAnon = new Map<string, PublicTestProfileRow>();
  const byUser = new Map<string, PublicTestProfileRow>();
  const byPublicResult = new Map<string, PublicTestProfileRow>();
  for (const p of profileRows) {
    byAnon.set(p.anon_id, p);
    if (p.user_id) byUser.set(p.user_id, p);
    if (p.public_result_id) byPublicResult.set(p.public_result_id, p);
  }
  return { byAnon, byUser, byPublicResult };
}

function buildSignupMap(signupRows: SignupProfileRow[]): Map<string, SignupProfileRow> {
  const m = new Map<string, SignupProfileRow>();
  for (const r of signupRows) {
    m.set(r.user_id, r);
  }
  return m;
}

function collectPilotLookupKeys(rows: KpiPilotFilterableEventRow[]): {
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

function rowMatchesLegacyPilotCode(
  row: KpiPilotFilterableEventRow,
  pilotCode: string,
  publicMaps: ReturnType<typeof buildPublicProfileMaps>,
  signupByUser: Map<string, SignupProfileRow>
): boolean {
  const direct = row.props?.pilot_code;
  if (typeof direct === 'string' && direct === pilotCode) return true;

  if (row.anon_id) {
    const p = publicMaps.byAnon.get(row.anon_id);
    if (p?.pilot_code === pilotCode) return true;
  }
  if (row.user_id) {
    const pu = publicMaps.byUser.get(row.user_id);
    if (pu?.pilot_code === pilotCode) return true;
    const su = signupByUser.get(row.user_id);
    if (su?.pilot_code === pilotCode) return true;
  }
  if (row.public_result_id) {
    const pp = publicMaps.byPublicResult.get(row.public_result_id);
    if (pp?.pilot_code === pilotCode) return true;
  }

  if (row.person_key.startsWith('anon:')) {
    const aid = row.person_key.slice('anon:'.length);
    const pa = publicMaps.byAnon.get(aid);
    if (pa?.pilot_code === pilotCode) return true;
  }
  if (row.person_key.startsWith('user:')) {
    const uid = row.person_key.slice('user:'.length);
    const pu = publicMaps.byUser.get(uid);
    if (pu?.pilot_code === pilotCode) return true;
    const su = signupByUser.get(uid);
    if (su?.pilot_code === pilotCode) return true;
  }

  return false;
}

export async function filterRowsByPilotCode<T extends KpiPilotFilterableEventRow>(
  rows: T[],
  pilotCode: string | null,
  options?: {
    range?: {
      fromIso: string;
      toExclusiveIso: string;
    };
  }
): Promise<T[]> {
  if (!pilotCode) return rows;

  let runContext = emptyRunAttributionContext(pilotCode);
  try {
    runContext = await fetchPublicTestRunsForPilotAttribution({
      pilotCode,
      rows,
      range: options?.range,
    });
  } catch (e) {
    console.warn('[admin-kpi-pilot-filter] run attribution fetch failed; legacy-only', e);
    runContext = emptyRunAttributionContext(pilotCode);
  }

  const { anonIds, userIds, publicResultIds } = collectPilotLookupKeys(rows);

  const [publicRows, signupRows] = await Promise.all([
    fetchPublicTestProfilesForKpiKeys({
      anonIds,
      userIds,
      publicResultIds,
    }),
    fetchSignupProfilesForUserIds(userIds),
  ]);

  const publicMaps = buildPublicProfileMaps(publicRows);
  const signupByUser = buildSignupMap(signupRows);

  const out: T[] = [];
  for (const row of rows) {
    const decision = decideRunAttributionForRow(row, runContext);

    if (decision === 'include') {
      out.push(row);
      continue;
    }

    if (decision === 'exclude') {
      continue;
    }

    if (rowMatchesLegacyPilotCode(row, pilotCode, publicMaps, signupByUser)) {
      out.push(row);
    }
  }
  return out;
}
