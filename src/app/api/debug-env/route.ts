/**
 * 디버깅: Demo 관련 환경변수 확인
 * 배포 후 /api/debug-env 호출로 확인
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const val = process.env.NEXT_PUBLIC_DEMO_DEEP_TEST_ENABLED;
  return NextResponse.json({
    NEXT_PUBLIC_DEMO_DEEP_TEST_ENABLED: val,
    type: typeof val,
    check: val === '1',
  });
}
