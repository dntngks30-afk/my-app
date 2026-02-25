/**
 * GET /api/deep-test/get-latest
 * user_id 湲곗? scoring_version='deep_v1' 理쒖떊 row (?놁쑝硫?404)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';

const SOURCE = 'deep';
const SCORING_VERSION = 'deep_v2';

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

  const { data: attempt, error } = await supabase
    .from('deep_test_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('scoring_version', SCORING_VERSION)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('get-latest error:', error);
    const r = NextResponse.json(
      { error: '결과를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
    r.headers.set('Cache-Control', 'no-store');
    return r;
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
    scoring_version: SCORING_VERSION,
    attempt: toAttemptPayload(attempt),
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
