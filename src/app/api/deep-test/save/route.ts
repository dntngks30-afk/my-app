/**
 * POST /api/deep-test/save
 * draft만 업데이트 (answers merge), final 상태면 409
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';

const SOURCE = 'deep';
const SCORING_VERSION = 'deep_v1';

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
  const { attemptId, patchAnswers } = body;

  if (!attemptId || !patchAnswers || typeof patchAnswers !== 'object') {
    return NextResponse.json(
      { error: 'attemptId와 patchAnswers가 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseAdmin();

  const { data: attempt, error: fetchError } = await supabase
    .from('deep_test_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !attempt) {
    return NextResponse.json(
      { error: 'attempt를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (attempt.status !== 'draft') {
    return NextResponse.json(
      { error: '이미 확정된 결과는 수정할 수 없습니다.' },
      { status: 409 }
    );
  }

  const currentAnswers = (attempt.answers ?? {}) as Record<string, unknown>;
  const merged = { ...currentAnswers, ...patchAnswers };

  const { data: updated, error: updateError } = await supabase
    .from('deep_test_attempts')
    .update({
      answers: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .select()
    .single();

  if (updateError) {
    console.error('save error:', updateError);
    return NextResponse.json(
      { error: '저장에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    source: SOURCE,
    scoring_version: SCORING_VERSION,
    attempt: toAttemptPayload(updated),
  });
}
