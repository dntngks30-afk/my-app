/**
 * Bearer 토큰 기반 사용자 ID 추출 — API 라우트 공통
 * SSOT: 단일 구현, 모든 API에서 import
 * 요청 1회당 getUser 1번만 호출 (requestAuthCache)
 * supabase 미전달 시 내부에서 생성 (호환)
 */

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCachedUserId } from './requestAuthCache';

export async function getCurrentUserId(
  req: NextRequest,
  supabase?: SupabaseClient
): Promise<string | null> {
  const client = supabase ?? getServerSupabaseAdmin();
  return getCachedUserId(req, client);
}
