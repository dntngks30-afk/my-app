/**
 * Deep Test API 인증/권한 헬퍼
 * SSOT: plan_status='active' (requireActivePlan 재사용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';

export interface AuthContext {
  userId: string;
}

/** 401/403 응답 또는 AuthContext 반환 */
export async function requireDeepAuth(
  req: NextRequest
): Promise<NextResponse | AuthContext> {
  const result = await requireActivePlan(req);
  if (result instanceof NextResponse) return result;
  return { userId: result.userId };
}
