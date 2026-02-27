/**
 * Admin API용: Bearer 토큰 검증 + isAdmin 체크
 * @returns { user, supabase } or NextResponse (401/403)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { isAdmin } from './admin';

export async function requireAdmin(req: NextRequest): Promise<
  | { user: { id: string; email: string | null }; supabase: ReturnType<typeof getServerSupabaseAdmin> }
  | NextResponse
> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const supabase = getServerSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const adminOk = await isAdmin(user.email ?? null, user.id, supabase);
  if (!adminOk) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  return { user: { id: user.id, email: user.email ?? null }, supabase };
}
