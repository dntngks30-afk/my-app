/**
 * GET /api/admin/rls-audit
 *
 * RLS 감사 — admin 전용. x-admin-audit-key 헤더 (ADMIN_AUDIT_KEY env).
 * 테이블 존재 여부만 service_role로 확인. 상세 정책은 문서 SQL로 점검.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TABLES = ['session_program_progress', 'session_plans', 'session_events', 'request_dedupe_keys'];

export async function GET(req: NextRequest) {
  const auditKey = req.headers.get('x-admin-audit-key');
  const expected = process.env.ADMIN_AUDIT_KEY;
  if (!expected || auditKey !== expected) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const supabase = getServerSupabaseAdmin();
  const tableExists: Record<string, boolean> = {};

  for (const t of TABLES) {
    const { error } = await supabase.from(t).select('*').limit(0);
    tableExists[t] = !error;
  }

  const audit = {
    table_exists: tableExists,
    note: 'Full RLS/policy audit: run SQL from docs/ssot/session-pivot/PR_P0_HARDEN08_rls_audit.md',
    timestamp: new Date().toISOString(),
  };

  const res = NextResponse.json(audit);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
