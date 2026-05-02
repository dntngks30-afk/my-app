import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { buildAdminFeedbackPageSummary } from '@/lib/feedback/admin-feedback';
import type { FeedbackCategory, FeedbackReportRow, FeedbackStatus } from '@/lib/feedback/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_SET = new Set<FeedbackStatus>(['new', 'reviewing', 'resolved', 'archived']);
const CATEGORY_SET = new Set<FeedbackCategory>(['general', 'bug', 'question', 'improvement']);

function parseDateOnlyKstBounds(from: string | null, to: string | null): { fromIso: string | null; toIso: string | null } {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  let fromIso: string | null = null;
  let toIso: string | null = null;
  if (from && dateRe.test(from)) {
    fromIso = `${from}T00:00:00+09:00`;
  }
  if (to && dateRe.test(to)) {
    toIso = `${to}T23:59:59.999+09:00`;
  }
  return { fromIso, toIso };
}

function clampLimit(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : 100;
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(200, n);
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    admin.headers.set('Cache-Control', 'no-store');
    return admin;
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const categoryParam = url.searchParams.get('category');
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const limit = clampLimit(url.searchParams.get('limit'));

  if (statusParam && !STATUS_SET.has(statusParam as FeedbackStatus)) {
    const res = NextResponse.json({ ok: false, error: 'INVALID_STATUS' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (categoryParam && !CATEGORY_SET.has(categoryParam as FeedbackCategory)) {
    const res = NextResponse.json({ ok: false, error: 'INVALID_CATEGORY' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const { fromIso, toIso } = parseDateOnlyKstBounds(fromParam, toParam);

  let q = admin.supabase.from('feedback_reports').select(
    'id, user_id, user_email, category, message, status, source, user_agent, referer, created_at, resolved_at, admin_note',
  );

  if (statusParam) {
    q = q.eq('status', statusParam);
  }
  if (categoryParam) {
    q = q.eq('category', categoryParam);
  }
  if (fromIso) {
    q = q.gte('created_at', fromIso);
  }
  if (toIso) {
    q = q.lte('created_at', toIso);
  }

  q = q.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await q;

  if (error) {
    console.error('[admin/feedback] list failed', error);
    const res = NextResponse.json({ ok: false, error: 'LIST_FAILED' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const items = (data ?? []) as FeedbackReportRow[];
  /** Summary matches returned `items` only (paginated slice); not totals for all rows matching filters. */
  const summary = buildAdminFeedbackPageSummary(items);

  const res = NextResponse.json({
    ok: true,
    items,
    summary,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) {
    admin.headers.set('Cache-Control', 'no-store');
    return admin;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const payload = body as {
    id?: unknown;
    status?: unknown;
    admin_note?: unknown;
  };

  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  if (!id) {
    const res = NextResponse.json({ ok: false, error: 'MISSING_ID' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const hasStatus = payload.status !== undefined;
  const hasNote = payload.admin_note !== undefined;
  if (!hasStatus && !hasNote) {
    const res = NextResponse.json({ ok: false, error: 'EMPTY_PATCH' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const patch: Record<string, unknown> = {};
  if (hasStatus) {
    const s = payload.status;
    if (typeof s !== 'string' || !STATUS_SET.has(s as FeedbackStatus)) {
      const res = NextResponse.json({ ok: false, error: 'INVALID_STATUS' }, { status: 400 });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
    patch.status = s;
    if (s === 'resolved') {
      patch.resolved_at = new Date().toISOString();
    }
  }

  if (hasNote) {
    patch.admin_note =
      payload.admin_note === null ? null : typeof payload.admin_note === 'string' ? payload.admin_note : undefined;
    if (patch.admin_note === undefined) {
      const res = NextResponse.json({ ok: false, error: 'INVALID_ADMIN_NOTE' }, { status: 400 });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  }

  const { data, error } = await admin.supabase
    .from('feedback_reports')
    .update(patch)
    .eq('id', id)
    .select(
      'id, user_id, user_email, category, message, status, source, user_agent, referer, created_at, resolved_at, admin_note',
    )
    .maybeSingle();

  if (error) {
    console.error('[admin/feedback] patch failed', error);
    const res = NextResponse.json({ ok: false, error: 'PATCH_FAILED' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (!data) {
    const res = NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const res = NextResponse.json({ ok: true, item: data as FeedbackReportRow });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
