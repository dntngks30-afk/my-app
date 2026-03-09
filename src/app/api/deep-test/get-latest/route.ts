/**
 * GET /api/deep-test/get-latest
 * PR-ALG-02: deep_v3 우선, 없으면 deep_v2 fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';

const SOURCE = 'deep';

function toAttemptPayload(row: {
  id: string;
  user_id: string;
  status: string;
  scoring_version: string;
  answers: unknown;
  scores: unknown;
  result_type: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    scoringVersion: row.scoring_version,
    answers: row.answers ?? {},
    scores: row.scores,
    resultType: row.result_type,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireDeepAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const supabase = getServerSupabaseAdmin();

  // deep_v3 우선, 없으면 deep_v2 fallback
  const { data: v3, error: e3 } = await supabase
    .from('deep_test_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('scoring_version', 'deep_v3')
    .eq('status', 'final')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let attempt = !e3 && v3 ? v3 : null;
  if (!attempt) {
    const { data: v2, error: e2 } = await supabase
      .from('deep_test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('scoring_version', 'deep_v2')
      .eq('status', 'final')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e2) {
      console.error('get-latest error:', e2);
      const r = NextResponse.json(
        { error: '결과를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }
    attempt = v2;
  }

  if (!attempt) {
    const r = NextResponse.json(
      { error: '심화 테스트 결과가 없습니다.' },
      { status: 404 }
    );
    r.headers.set('Cache-Control', 'no-store');
    return r;
  }

  const res = NextResponse.json({
    source: SOURCE,
    scoring_version: attempt.scoring_version ?? 'deep_v2',
    attempt: toAttemptPayload(attempt),
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
