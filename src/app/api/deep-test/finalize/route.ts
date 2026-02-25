/**
 * POST /api/deep-test/finalize
 * draft → final, 스코어 계산. scoring_version별 계산기 사용.
 * 이미 final이면 멱등 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';
import { calculateDeepV1 } from '@/lib/deep-test/scoring/deep_v1';
import { calculateDeepV2 } from '@/lib/deep-test/scoring/deep_v2';
import type { DeepAnswerValue } from '@/lib/deep-test/types';

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

export async function POST(req: NextRequest) {
  const auth = await requireDeepAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => ({}));
  const { attemptId } = body;

  if (!attemptId) {
    return NextResponse.json(
      { error: 'attemptId가 필요합니다.' },
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

  if (attempt.status === 'final') {
    return NextResponse.json({
      source: SOURCE,
      scoring_version: attempt.scoring_version,
      result: {
        scores: attempt.scores,
        result_type: attempt.result_type,
        confidence: attempt.confidence,
      },
      attempt: toAttemptPayload(attempt),
    });
  }

  const answers = (attempt.answers ?? {}) as Record<string, DeepAnswerValue>;
  const scoringVersion = attempt.scoring_version ?? 'deep_v2';

  const now = new Date().toISOString();

  if (scoringVersion === 'deep_v1') {
    const { scores, result_type, confidence } = calculateDeepV1(answers);
    const { data: updated, error: updateError } = await supabase
      .from('deep_test_attempts')
      .update({
        status: 'final',
        scores,
        result_type,
        confidence: Number(confidence),
        finalized_at: now,
        updated_at: now,
      })
      .eq('id', attemptId)
      .eq('user_id', userId)
      .eq('status', 'draft')
      .select()
      .single();

    if (updateError) {
      console.error('finalize error:', updateError);
      return NextResponse.json(
        { error: '확정 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: SOURCE,
      scoring_version: 'deep_v1',
      result: { scores, result_type, confidence },
      attempt: toAttemptPayload(updated!),
    });
  }

  const v2Result = calculateDeepV2(answers);
  const scoresPayload = {
    objectiveScores: v2Result.objectiveScores,
    finalScores: v2Result.finalScores,
    primaryFocus: v2Result.primaryFocus,
    secondaryFocus: v2Result.secondaryFocus,
    answeredCount: v2Result.answeredCount,
    totalCount: v2Result.totalCount,
  };

  const { data: updated, error: updateError } = await supabase
    .from('deep_test_attempts')
    .update({
      status: 'final',
      scores: scoresPayload,
      result_type: v2Result.result_type,
      confidence: v2Result.confidence,
      finalized_at: now,
      updated_at: now,
    })
    .eq('id', attemptId)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .select()
    .single();

  if (updateError) {
    console.error('finalize error:', updateError);
    return NextResponse.json(
      { error: '확정 처리에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    source: SOURCE,
    scoring_version: 'deep_v2',
    result: {
      result_type: v2Result.result_type,
      primaryFocus: v2Result.primaryFocus,
      secondaryFocus: v2Result.secondaryFocus,
      objectiveScores: v2Result.objectiveScores,
      finalScores: v2Result.finalScores,
      confidence: v2Result.confidence,
      answeredCount: v2Result.answeredCount,
      totalCount: v2Result.totalCount,
    },
    attempt: toAttemptPayload(updated!),
  });
}
