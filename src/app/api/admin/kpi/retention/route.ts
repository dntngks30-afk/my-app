import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getKpiRetention, resolveKpiRange } from '@/lib/analytics/admin-kpi';
import {
  InvalidKpiPilotCodeError,
  resolveKpiPilotCodeFilter,
} from '@/lib/analytics/admin-kpi-pilot-filter';
import type { KpiCohortKey } from '@/lib/analytics/admin-kpi-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isCohortKey(value: string | null): value is KpiCohortKey {
  return value === 'app_home' || value === 'first_session_complete';
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    admin.headers.set('Cache-Control', 'no-store');
    return admin;
  }

  try {
    const params = new URL(req.url).searchParams;
    const cohort = params.get('cohort');
    if (!isCohortKey(cohort)) {
      const bad = NextResponse.json({ ok: false, error: 'INVALID_COHORT' }, { status: 400 });
      bad.headers.set('Cache-Control', 'no-store');
      return bad;
    }
    const range = resolveKpiRange(params);
    const pilotCode = resolveKpiPilotCodeFilter(params);
    const data = await getKpiRetention(admin.supabase, range, cohort, pilotCode);
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    if (error instanceof InvalidKpiPilotCodeError) {
      const res = NextResponse.json({ ok: false, error: 'INVALID_PILOT_CODE' }, { status: 400 });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
    const res = NextResponse.json({ ok: false, error: 'KPI_RETENTION_FAILED' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}

