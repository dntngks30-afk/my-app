/**
 * POST /api/session/profile
 *
 * 온보딩: 주당 목표 횟수(target_frequency) 저장 + total_sessions(8/12/16/20) 확정.
 *
 * 동작:
 *   1) auth: userId 확보 (401 fail-close)
 *   2) session_user_profile upsert (target_frequency, lifestyle_tag)
 *   3) total_sessions 매핑: 2→8, 3→12, 4→16, 5→20
 *   4) session_program_progress upsert (total_sessions만 업데이트, completed/active 건드리지 않음)
 *
 * BE-ONB-01: 온보딩 프로필 저장.
 * Auth: Bearer token (session APIs와 동일). Write: service role (RLS bypass).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FREQUENCY_TO_TOTAL: Record<number, number> = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

const VALID_FREQUENCIES = [2, 3, 4, 5] as const;

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawFreq = body.target_frequency;
    const targetFrequency = typeof rawFreq === 'number' && VALID_FREQUENCIES.includes(rawFreq as 2 | 3 | 4 | 5)
      ? (rawFreq as 2 | 3 | 4 | 5)
      : null;

    if (targetFrequency === null) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'target_frequency는 2, 3, 4, 5 중 하나여야 합니다.' } },
        { status: 400 }
      );
    }

    const lifestyleTag = typeof body.lifestyle_tag === 'string'
      ? body.lifestyle_tag.trim() || null
      : null;

    const totalSessions = FREQUENCY_TO_TOTAL[targetFrequency];
    const supabase = getServerSupabaseAdmin();

    // 기존 progress 조회 (completed_sessions 체크용)
    const { data: existingProgress } = await supabase
      .from('session_program_progress')
      .select('completed_sessions, active_session_number')
      .eq('user_id', userId)
      .maybeSingle();

    const completedSessions = existingProgress?.completed_sessions ?? 0;
    if (totalSessions < completedSessions) {
      return fail(
        409,
        ApiErrorCode.POLICY_LOCKED,
        `이미 ${completedSessions}회 완료되어 total_sessions를 ${totalSessions}로 줄일 수 없습니다.`
      );
    }

    // 1) session_user_profile upsert
    const { data: profile, error: profileErr } = await supabase
      .from('session_user_profile')
      .upsert(
        {
          user_id: userId,
          target_frequency: targetFrequency,
          lifestyle_tag: lifestyleTag,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (profileErr || !profile) {
      console.error('[session/profile] profile upsert failed', profileErr);
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '프로필 저장에 실패했습니다.' } },
        { status: 500 }
      );
    }

    // 2) session_program_progress upsert (total_sessions만, completed/active 건드리지 않음)
    let progress: Record<string, unknown>;
    if (existingProgress) {
      const { data: updated, error: progressErr } = await supabase
        .from('session_program_progress')
        .update({ total_sessions: totalSessions })
        .eq('user_id', userId)
        .select()
        .single();

      if (progressErr || !updated) {
        console.error('[session/profile] progress update failed', progressErr);
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: '진행 상태 업데이트에 실패했습니다.' } },
          { status: 500 }
        );
      }
      progress = updated;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('session_program_progress')
        .insert({
          user_id: userId,
          total_sessions: totalSessions,
          completed_sessions: 0,
          active_session_number: null,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        console.error('[session/profile] progress insert failed', insertErr);
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: '진행 상태 초기화에 실패했습니다.' } },
          { status: 500 }
        );
      }
      progress = inserted;
    }

    const warning =
      completedSessions > 0
        ? '이미 완료된 세션이 있습니다. total_sessions 변경 시 진행률 해석에 주의하세요.'
        : undefined;

    const res = NextResponse.json({
      profile,
      progress,
      ...(warning && { warning }),
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[session/profile]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
