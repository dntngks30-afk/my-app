import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getKpiSummary, resolveKpiRange } from '@/lib/analytics/admin-kpi';
import {
  InvalidKpiPilotCodeError,
  resolveKpiPilotCodeFilter,
} from '@/lib/analytics/admin-kpi-pilot-filter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    admin.headers.set('Cache-Control', 'no-store');
    return admin;
  }

  try {
    const params = new URL(req.url).searchParams;
    const range = resolveKpiRange(params);
    const pilotCode = resolveKpiPilotCodeFilter(params);
    const data = await getKpiSummary(admin.supabase, range, pilotCode);
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    if (error instanceof InvalidKpiPilotCodeError) {
      const res = NextResponse.json({ ok: false, error: 'INVALID_PILOT_CODE' }, { status: 400 });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
    const res = NextResponse.json({ ok: false, error: 'KPI_SUMMARY_FAILED' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}

