/**
 * Bearer 토큰 기반 사용자 ID 추출 — API 라우트 공통
 * SSOT: 단일 구현, 모든 API에서 import
 */

import { NextRequest } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabase = getServerSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user.id;
}
