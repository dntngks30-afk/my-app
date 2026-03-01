/**
 * Bearer 토큰 기반 사용자 ID 추출 — API 라우트 공통
 * SSOT: 단일 구현, 모든 API에서 import
 * 요청 1회당 getUser 1번만 호출 (requestAuthCache)
 */

import { NextRequest } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCachedUserId } from './requestAuthCache';

export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const supabase = getServerSupabaseAdmin();
  return getCachedUserId(req, supabase);
}
