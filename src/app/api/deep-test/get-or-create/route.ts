/**
 * POST /api/deep-test/get-or-create
 * Idempotent: (user_id, scoring_version) 湲곗? upsert, ?놁쑝硫?insert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';

const SOURCE = 'deep';
const DEFAULT_VERSION = 'deep_v2';

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

export async function POST(req: NextRequest) {
  const auth = await requireDeepAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => ({}));
  const scoringVersion =
    body.scoringVersion ?? body.scoring_version ?? DEFAULT_VERSION;
  if (scoringVersion !== 'deep_v1' && scoringVersion !== 'deep_v2') {
    return NextResponse.json(
      { error: '吏?먰븯吏 ?딅뒗 scoring_version?낅땲??' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseAdmin();

  const { data: existing } = await supabase
    .from('deep_test_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('scoring_version', scoringVersion)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      source: SOURCE,
      scoring_version: scoringVersion,
      attempt: toAttemptPayload(existing),
    });
  }

  const { data: inserted, error } = await supabase
    .from('deep_test_attempts')
    .insert({
      user_id: userId,
      scoring_version: scoringVersion,
      status: 'draft',
      answers: {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: row } = await supabase
        .from('deep_test_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('scoring_version', scoringVersion)
        .single();
      if (row) {
        return NextResponse.json({
          source: SOURCE,
          scoring_version: scoringVersion,
          attempt: toAttemptPayload(row),
        });
      }
    }
    console.error('get-or-create error:', error);
    return NextResponse.json(
      { error: 'attempt ?앹꽦???ㅽ뙣?덉뒿?덈떎.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    source: SOURCE,
    scoring_version: scoringVersion,
    attempt: toAttemptPayload(inserted),
  });
}
