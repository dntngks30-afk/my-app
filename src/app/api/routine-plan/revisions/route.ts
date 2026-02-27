/**
 * GET /api/routine-plan/revisions?routineId=&dayNumber=
 *
 * Revision/Audit 히스토리 조회 (관리자·디버깅용).
 * Bearer only, routine 소유자만 조회 가능.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getPlanRevisions, getPlanAuditTrail } from '@/lib/routine-plan/revision-history';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const routineId = searchParams.get('routineId');
    const dayNumber = searchParams.get('dayNumber');

    if (!routineId || !dayNumber) {
      return NextResponse.json(
        { error: 'routineId와 dayNumber가 필요합니다.' },
        { status: 400 }
      );
    }

    const day = Math.max(1, Math.min(7, Math.floor(Number(dayNumber))));

    const supabase = getServerSupabaseAdmin();
    const { data: routine } = await supabase
      .from('workout_routines')
      .select('user_id')
      .eq('id', routineId)
      .single();

    if (!routine || routine.user_id !== userId) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const [revisions, auditTrail] = await Promise.all([
      getPlanRevisions(routineId, day),
      getPlanAuditTrail(routineId, day),
    ]);

    const res = NextResponse.json({
      success: true,
      routineId,
      dayNumber: day,
      revisions,
      auditTrail,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error('[routine-plan/revisions]', error);
    return NextResponse.json(
      {
        error: '히스토리 조회에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
