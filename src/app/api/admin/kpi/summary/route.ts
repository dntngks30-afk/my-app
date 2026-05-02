import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getKpiSummary, resolveKpiRange } from '@/lib/analytics/admin-kpi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    admin.headers.set('Cache-Control', 'no-store');
    return admin;
  }

  try {
    const range = resolveKpiRange(new URL(req.url).searchParams);
    const data = await getKpiSummary(admin.supabase, range);
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    const res = NextResponse.json({ ok: false, error: 'KPI_SUMMARY_FAILED' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}

