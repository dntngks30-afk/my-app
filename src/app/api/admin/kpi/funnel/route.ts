import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getKpiFunnel, resolveKpiRange } from '@/lib/analytics/admin-kpi';
import type { KpiFunnelKey } from '@/lib/analytics/admin-kpi-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isFunnelKey(value: string | null): value is KpiFunnelKey {
  return value === 'public' || value === 'execution' || value === 'first_session';
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    admin.headers.set('Cache-Control', 'no-store');
    return admin;
  }

  try {
    const params = new URL(req.url).searchParams;
    const funnel = params.get('funnel');
    if (!isFunnelKey(funnel)) {
      const bad = NextResponse.json({ ok: false, error: 'INVALID_FUNNEL' }, { status: 400 });
      bad.headers.set('Cache-Control', 'no-store');
      return bad;
    }
    const range = resolveKpiRange(params);
    const data = await getKpiFunnel(admin.supabase, range, funnel);
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    const res = NextResponse.json({ ok: false, error: 'KPI_FUNNEL_FAILED' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}

